"""
StudyLens AI - Modal Service
Agentic RAG pipeline with Hybrid Search and Re-ranking
"""

import modal
import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Modal app setup
app = modal.App("studylens-ai")

# FastAPI app for HTTP endpoints
web_app = FastAPI()

# Image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "openai>=1.0.0",
        "pinecone-client>=3.0.0",
        "pinecone-text[splade]>=0.1.0",
        "cohere>=5.0.0",
        "langchain>=0.3.0",
        "langchain-openai>=0.2.0",
        "langgraph>=0.2.0",
        "pypdf>=5.0.0",
        "tiktoken>=0.7.0",
        "numpy>=1.24.0",
        "pydantic>=2.0.0",
        "fastapi>=0.104.0",
        "uvicorn>=0.24.0",
    )
    .env({
        "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY", ""),
        "PINECONE_API_KEY": os.environ.get("PINECONE_API_KEY", ""),
        "COHERE_API_KEY": os.environ.get("COHERE_API_KEY", ""),
    })
)

# Shared volume for temporary file storage (optional)
# volume = modal.Volume.from_name("studylens-temp", create_if_missing=True)

# Secrets
secrets = [
    modal.Secret.from_name("openai-secret"),
    modal.Secret.from_name("pinecone-secret"),
    modal.Secret.from_name("cohere-secret"),
]


# ============================================================================
# Data Models
# ============================================================================

class Chunk(BaseModel):
    content: str
    metadata: Dict[str, Any]
    dense_embedding: Optional[List[float]] = None
    sparse_embedding: Optional[Dict[str, float]] = None


class SearchResult(BaseModel):
    content: str
    file_id: str
    file_name: str
    score: float
    metadata: Optional[Dict[str, Any]] = None


class StudyPlanRequest(BaseModel):
    query: str
    course_id: str
    user_id: str
    num_days: Optional[int] = 3
    focus_topics: Optional[List[str]] = None


class StudyPlanResponse(BaseModel):
    plan: Dict[str, Any]
    days: List[Dict[str, Any]]
    sources: List[str]


# ============================================================================
# PDF Processing & Embedding Generation
# ============================================================================

@app.function(
    image=image,
    secrets=secrets,
    timeout=600,
    memory=2048,
)
def process_pdf_and_generate_embeddings(
    file_url: str,
    file_id: str,
    course_id: str,
    user_id: str,
    file_name: str,
) -> Dict[str, Any]:
    """
    Process PDF from URL, chunk it, and generate hybrid embeddings (dense + sparse).
    Returns embeddings ready for Pinecone upsert.
    """
    import requests
    from pypdf import PdfReader
    from io import BytesIO
    import openai
    from pinecone_text.sparse import BM25Encoder
    import tiktoken
    import numpy as np

    # Initialize clients
    openai_client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    
    # Download PDF
    response = requests.get(file_url)
    response.raise_for_status()
    pdf_bytes = BytesIO(response.content)
    
    # Extract text from PDF
    reader = PdfReader(pdf_bytes)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n\n"
    
    # Chunk text intelligently
    chunks = _chunk_text_intelligently(full_text, chunk_size=1000, overlap=200)
    
    # Initialize BM25 encoder (sparse vectors)
    bm25_encoder = BM25Encoder()
    bm25_encoder.fit([chunk["text"] for chunk in chunks])
    
    # Generate embeddings for all chunks
    chunk_texts = [chunk["text"] for chunk in chunks]
    
    # Dense embeddings (OpenAI)
    embedding_response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=chunk_texts,
    )
    dense_embeddings = [item.embedding for item in embedding_response.data]
    
    # Sparse embeddings (BM25)
    sparse_embeddings = bm25_encoder.encode_documents(chunk_texts)
    
    # Prepare for Pinecone
    vectors_to_upsert = []
    for i, chunk in enumerate(chunks):
        vector_id = f"{file_id}_{i}"
        vectors_to_upsert.append({
            "id": vector_id,
            "values": dense_embeddings[i],
            "sparse_values": {
                "indices": list(sparse_embeddings[i].keys()),
                "values": list(sparse_embeddings[i].values()),
            },
            "metadata": {
                "file_id": file_id,
                "file_name": file_name,
                "course_id": course_id,
                "user_id": user_id,
                "chunk_index": i,
                "content": chunk["text"],
                "page": chunk.get("page", 0),
            },
        })
    
    return {
        "vectors": vectors_to_upsert,
        "num_chunks": len(chunks),
        "file_id": file_id,
    }


def _chunk_text_intelligently(
    text: str, chunk_size: int = 1000, overlap: int = 200
) -> List[Dict[str, Any]]:
    """
    Chunk text intelligently by paragraphs, preserving context.
    """
    import tiktoken
    
    encoding = tiktoken.encoding_for_model("gpt-4")
    
    # Split by paragraphs first
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    for para in paragraphs:
        para_tokens = len(encoding.encode(para))
        
        if current_tokens + para_tokens > chunk_size and current_chunk:
            # Save current chunk
            chunks.append({
                "text": current_chunk.strip(),
                "tokens": current_tokens,
            })
            # Start new chunk with overlap
            overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
            current_chunk = overlap_text + "\n\n" + para
            current_tokens = len(encoding.encode(current_chunk))
        else:
            current_chunk += "\n\n" + para if current_chunk else para
            current_tokens += para_tokens
    
    # Add final chunk
    if current_chunk.strip():
        chunks.append({
            "text": current_chunk.strip(),
            "tokens": current_tokens,
        })
    
    return chunks


# ============================================================================
# Hybrid Search with Pinecone
# ============================================================================

@app.function(
    image=image,
    secrets=secrets,
    timeout=60,
)
def hybrid_search(
    query: str,
    course_id: str,
    user_id: str,
    top_k: int = 50,
    alpha: float = 0.5,
    index_name: str = "studylens-ai",
) -> List[SearchResult]:
    """
    Perform hybrid search (dense + sparse) on Pinecone.
    Returns top_k candidates for re-ranking.
    """
    import openai
    from pinecone import Pinecone
    from pinecone_text.sparse import BM25Encoder
    import numpy as np

    # Initialize clients
    openai_client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index(index_name)
    
    # Generate dense embedding for query
    query_embedding_response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=[query],
    )
    dense_vector = query_embedding_response.data[0].embedding
    
    # Generate sparse embedding for query (BM25)
    # Note: In production, you'd want to pre-fit BM25 on your corpus
    # For now, we'll use a simple approach
    bm25_encoder = BM25Encoder()
    # In production, load pre-fitted encoder or fit on corpus
    sparse_vector = bm25_encoder.encode_queries([query])[0]
    
    # Convert sparse vector to Pinecone format
    sparse_dict = {
        "indices": list(sparse_vector.keys()),
        "values": list(sparse_vector.values()),
    }
    
    # Hybrid search on Pinecone
    results = index.query(
        vector=dense_vector,
        sparse_vector=sparse_dict,
        top_k=top_k,
        include_metadata=True,
        filter={
            "course_id": {"$eq": course_id},
            "user_id": {"$eq": user_id},
        },
    )
    
    # Format results
    search_results = []
    for match in results.matches:
        metadata = match.metadata or {}
        search_results.append(
            SearchResult(
                content=metadata.get("content", ""),
                file_id=metadata.get("file_id", ""),
                file_name=metadata.get("file_name", "Unknown"),
                score=match.score or 0.0,
                metadata=metadata,
            )
        )
    
    return search_results


# ============================================================================
# Re-ranking with Cohere
# ============================================================================

@app.function(
    image=image,
    secrets=secrets,
    timeout=60,
)
def rerank_results(
    query: str,
    candidates: List[SearchResult],
    top_n: int = 5,
) -> List[SearchResult]:
    """
    Re-rank search candidates using Cohere's Cross-Encoder.
    """
    import cohere
    
    if len(candidates) == 0:
        return []
    
    cohere_client = cohere.Client(api_key=os.environ["COHERE_API_KEY"])
    
    # Prepare documents for re-ranking
    documents = [candidate.content for candidate in candidates]
    
    # Re-rank
    rerank_response = cohere_client.rerank(
        model="rerank-english-v3.0",
        query=query,
        documents=documents,
        top_n=min(top_n, len(candidates)),
    )
    
    # Map re-ranked results back to SearchResult objects
    reranked_results = []
    for result in rerank_response.results:
        original_candidate = candidates[result.index]
        reranked_results.append(
            SearchResult(
                content=original_candidate.content,
                file_id=original_candidate.file_id,
                file_name=original_candidate.file_name,
                score=result.relevance_score,
                metadata=original_candidate.metadata,
            )
        )
    
    return reranked_results


# ============================================================================
# LangGraph Agent for Study Plan Generation
# ============================================================================

@app.function(
    image=image,
    secrets=secrets,
    timeout=300,
    memory=4096,
)
def generate_study_plan(
    request: StudyPlanRequest,
    index_name: str = "studylens-ai",
) -> StudyPlanResponse:
    """
    Agentic workflow to generate a structured study plan.
    Uses LangGraph with Planner -> Retriever -> Writer nodes.
    """
    from langchain_openai import ChatOpenAI
    from langgraph.graph import StateGraph, END
    from typing import TypedDict
    import json

    # Initialize LLM
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.7,
        api_key=os.environ["OPENAI_API_KEY"],
    )
    
    # Define state
    class AgentState(TypedDict):
        query: str
        course_id: str
        user_id: str
        num_days: int
        focus_topics: List[str]
        plan: Dict[str, Any]
        retrieved_content: List[Dict[str, Any]]
        study_plan: Dict[str, Any]
    
    # Node 1: Planner
    def planner_node(state: AgentState) -> AgentState:
        """Decompose query into study plan structure."""
        prompt = f"""You are a study planning assistant. The user wants to create a {state['num_days']}-day study plan.

User Query: {state['query']}
Focus Topics: {', '.join(state.get('focus_topics', [])) if state.get('focus_topics') else 'None specified'}

Your task:
1. Break down the topics into {state['num_days']} logical days
2. For each day, identify:
   - Main topics/concepts to cover
   - Sub-topics that need to be learned
   - Key terms and definitions needed
   - Practice areas

Return a JSON structure:
{{
  "days": [
    {{
      "day": 1,
      "topics": ["topic1", "topic2"],
      "subtopics": ["subtopic1", "subtopic2"],
      "key_terms": ["term1", "term2"],
      "search_queries": ["query1", "query2"]
    }}
  ]
}}"""
        
        response = llm.invoke(prompt)
        plan_json = json.loads(response.content)
        
        return {
            **state,
            "plan": plan_json,
        }
    
    # Node 2: Retriever
    def retriever_node(state: AgentState) -> AgentState:
        """Retrieve relevant content for each day's topics."""
        import openai
        from pinecone import Pinecone
        from pinecone_text.sparse import BM25Encoder
        import cohere
        
        retrieved_content = []
        
        # Initialize clients for direct use
        openai_client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        index = pc.Index(index_name)
        cohere_client = cohere.Client(api_key=os.environ["COHERE_API_KEY"])
        
        for day_plan in state["plan"]["days"]:
            day_content = []
            
            # Search for each query in the day plan
            for search_query in day_plan.get("search_queries", []):
                # Perform hybrid search directly
                query_embedding_response = openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=[search_query],
                )
                dense_vector = query_embedding_response.data[0].embedding
                
                # Generate sparse embedding
                bm25_encoder = BM25Encoder()
                sparse_vector = bm25_encoder.encode_queries([search_query])[0]
                sparse_dict = {
                    "indices": list(sparse_vector.keys()),
                    "values": list(sparse_vector.values()),
                }
                
                # Query Pinecone
                results = index.query(
                    vector=dense_vector,
                    sparse_vector=sparse_dict,
                    top_k=20,
                    include_metadata=True,
                    filter={
                        "course_id": {"$eq": state["course_id"]},
                        "user_id": {"$eq": state["user_id"]},
                    },
                )
                
                # Format results
                candidates = []
                for match in results.matches:
                    metadata = match.metadata or {}
                    candidates.append(SearchResult(
                        content=metadata.get("content", ""),
                        file_id=metadata.get("file_id", ""),
                        file_name=metadata.get("file_name", "Unknown"),
                        score=match.score or 0.0,
                        metadata=metadata,
                    ))
                
                # Re-rank with Cohere
                if candidates:
                    documents = [c.content for c in candidates]
                    rerank_response = cohere_client.rerank(
                        model="rerank-english-v3.0",
                        query=search_query,
                        documents=documents,
                        top_n=min(5, len(candidates)),
                    )
                    
                    reranked = []
                    for result in rerank_response.results:
                        original = candidates[result.index]
                        reranked.append({
                            "content": original.content,
                            "file_name": original.file_name,
                            "score": result.relevance_score,
                        })
                    
                    day_content.extend(reranked)
            
            retrieved_content.append({
                "day": day_plan["day"],
                "content": day_content,
            })
        
        return {
            **state,
            "retrieved_content": retrieved_content,
        }
    
    # Node 3: Writer
    def writer_node(state: AgentState) -> AgentState:
        """Synthesize retrieved content into final study plan."""
        prompt = f"""You are creating a comprehensive {state['num_days']}-day study plan.

Original Query: {state['query']}

Planned Structure:
{json.dumps(state['plan'], indent=2)}

Retrieved Course Materials:
{json.dumps(state['retrieved_content'], indent=2)}

Create a detailed, actionable study plan. For each day:
1. Overview of what will be covered
2. Key concepts and definitions (with citations from course materials)
3. Study activities and practice exercises
4. Review checklist

Format as JSON:
{{
  "overview": "Brief overview of the study plan",
  "days": [
    {{
      "day": 1,
      "title": "Day 1: [Topic]",
      "overview": "...",
      "key_concepts": [
        {{
          "concept": "...",
          "definition": "...",
          "source": "[filename]"
        }}
      ],
      "study_activities": ["activity1", "activity2"],
      "review_checklist": ["item1", "item2"]
    }}
  ],
  "sources": ["file1.pdf", "file2.pdf"]
}}"""
        
        response = llm.invoke(prompt)
        study_plan_json = json.loads(response.content)
        
        return {
            **state,
            "study_plan": study_plan_json,
        }
    
    # Build graph
    workflow = StateGraph(AgentState)
    workflow.add_node("planner", planner_node)
    workflow.add_node("retriever", retriever_node)
    workflow.add_node("writer", writer_node)
    
    # Define edges
    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "retriever")
    workflow.add_edge("retriever", "writer")
    workflow.add_edge("writer", END)
    
    # Compile and run
    app = workflow.compile()
    
    initial_state: AgentState = {
        "query": request.query,
        "course_id": request.course_id,
        "user_id": request.user_id,
        "num_days": request.num_days or 3,
        "focus_topics": request.focus_topics or [],
        "plan": {},
        "retrieved_content": [],
        "study_plan": {},
    }
    
    final_state = app.invoke(initial_state)
    
    return StudyPlanResponse(
        plan=final_state["study_plan"],
        days=final_state["study_plan"].get("days", []),
        sources=final_state["study_plan"].get("sources", []),
    )


# ============================================================================
# Pinecone Management
# ============================================================================

@app.function(
    image=image,
    secrets=secrets,
    timeout=60,
)
def upsert_to_pinecone(
    vectors: List[Dict[str, Any]],
    index_name: str = "studylens-ai",
) -> Dict[str, Any]:
    """Upsert vectors to Pinecone index."""
    from pinecone import Pinecone
    
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index(index_name)
    
    # Batch upsert (Pinecone supports up to 100 vectors per request)
    batch_size = 100
    total_upserted = 0
    
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i : i + batch_size]
        index.upsert(vectors=batch)
        total_upserted += len(batch)
    
    return {
        "success": True,
        "vectors_upserted": total_upserted,
    }


@app.function(
    image=image,
    secrets=secrets,
    timeout=60,
)
def delete_from_pinecone(
    file_id: str,
    index_name: str = "studylens-ai",
) -> Dict[str, Any]:
    """Delete all vectors for a file from Pinecone."""
    from pinecone import Pinecone
    
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index(index_name)
    
    # Query to find all vectors for this file
    results = index.query(
        vector=[0.0] * 1536,  # Dummy vector
        top_k=10000,
        include_metadata=True,
        filter={"file_id": {"$eq": file_id}},
    )
    
    # Delete all matching vectors
    ids_to_delete = [match.id for match in results.matches]
    
    if ids_to_delete:
        index.delete(ids=ids_to_delete)
    
    return {
        "success": True,
        "vectors_deleted": len(ids_to_delete),
    }


# ============================================================================
# FastAPI HTTP Endpoints
# ============================================================================

@web_app.post("/process_pdf_and_generate_embeddings")
async def process_pdf_endpoint(request: Dict[str, Any]):
    """HTTP endpoint for PDF processing."""
    try:
        result = process_pdf_and_generate_embeddings.remote(
            file_url=request["file_url"],
            file_id=request["file_id"],
            course_id=request["course_id"],
            user_id=request["user_id"],
            file_name=request["file_name"],
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
        )


@web_app.post("/hybrid_search")
async def hybrid_search_endpoint(request: Dict[str, Any]):
    """HTTP endpoint for hybrid search."""
    try:
        results = hybrid_search.remote(
            query=request["query"],
            course_id=request["course_id"],
            user_id=request["user_id"],
            top_k=request.get("top_k", 50),
        )
        # Convert Pydantic models to dicts
        return JSONResponse(content=[r.dict() for r in results])
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
        )


@web_app.post("/rerank_results")
async def rerank_endpoint(request: Dict[str, Any]):
    """HTTP endpoint for re-ranking."""
    try:
        # Convert dicts to SearchResult objects
        candidates = [SearchResult(**c) for c in request["candidates"]]
        results = rerank_results.remote(
            query=request["query"],
            candidates=candidates,
            top_n=request.get("top_n", 5),
        )
        return JSONResponse(content=[r.dict() for r in results])
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
        )


@web_app.post("/generate_study_plan")
async def generate_study_plan_endpoint(request: Dict[str, Any]):
    """HTTP endpoint for study plan generation."""
    try:
        study_plan_request = StudyPlanRequest(**request)
        result = generate_study_plan.remote(study_plan_request)
        return JSONResponse(content=result.dict())
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
        )


@web_app.post("/upsert_to_pinecone")
async def upsert_endpoint(request: Dict[str, Any]):
    """HTTP endpoint for Pinecone upsert."""
    try:
        result = upsert_to_pinecone.remote(
            vectors=request["vectors"],
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
        )


@web_app.post("/delete_from_pinecone")
async def delete_endpoint(request: Dict[str, Any]):
    """HTTP endpoint for Pinecone deletion."""
    try:
        result = delete_from_pinecone.remote(
            file_id=request["file_id"],
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
        )


# Mount FastAPI app to Modal
@app.asgi_app()
def fastapi_app():
    return web_app

