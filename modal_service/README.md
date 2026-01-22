# StudyLens AI - Modal Service

This is the Python compute layer for StudyLens AI's agentic RAG pipeline. It handles:
- PDF processing and hybrid embedding generation (dense + sparse)
- Hybrid search with Pinecone
- Re-ranking with Cohere
- LangGraph agent for study plan generation

## Setup

1. Install Modal CLI:
```bash
pip install modal
```

2. Set up Modal secrets:
```bash
modal secret create openai-secret OPENAI_API_KEY=your_key
modal secret create pinecone-secret PINECONE_API_KEY=your_key
modal secret create cohere-secret COHERE_API_KEY=your_key
```

3. Deploy the app:
```bash
modal deploy app.py
```

## Pinecone Setup

1. Create a Pinecone account at https://www.pinecone.io
2. Create a serverless index:
   - Name: `studylens-ai`
   - Dimensions: `1536` (for text-embedding-3-small)
   - Metric: `cosine`
   - Enable sparse vector support (hybrid search)

## Environment Variables

The following secrets need to be configured in Modal:
- `OPENAI_API_KEY`: Your OpenAI API key
- `PINECONE_API_KEY`: Your Pinecone API key
- `COHERE_API_KEY`: Your Cohere API key (for re-ranking)

## Functions

### `process_pdf_and_generate_embeddings`
Processes a PDF from a URL, chunks it, and generates hybrid embeddings.

### `hybrid_search`
Performs hybrid search (dense + sparse) on Pinecone.

### `rerank_results`
Re-ranks search candidates using Cohere's Cross-Encoder.

### `generate_study_plan`
Agentic workflow using LangGraph to generate structured study plans.

### `upsert_to_pinecone`
Upserts vectors to Pinecone index.

### `delete_from_pinecone`
Deletes all vectors for a file from Pinecone.




