# StudyLens AI - Agentic Workflow Setup Guide

This guide will help you set up the agentic RAG pipeline with Hybrid Search and Re-ranking.

## Architecture Overview

The new architecture consists of:
1. **Frontend**: Next.js (existing)
2. **Backend**: Convex (existing)
3. **AI Compute Layer**: Modal (Python) - NEW
4. **Vector DB**: Pinecone (replaces Convex vector search) - NEW

## Prerequisites

1. Modal account: https://modal.com
2. Pinecone account: https://www.pinecone.io
3. Cohere account: https://cohere.com (for re-ranking)
4. OpenAI API key (existing)

## Step 1: Set Up Pinecone

1. Create a Pinecone account
2. Create a new serverless index:
   - Name: `studylens-ai`
   - Dimensions: `1536` (for text-embedding-3-small)
   - Metric: `cosine`
   - Enable sparse vector support (for hybrid search)
3. Copy your Pinecone API key

## Step 2: Set Up Modal

1. Install Modal CLI:
```bash
pip install modal
```

2. Authenticate:
```bash
modal token new
```

3. Create Modal secrets:
```bash
modal secret create openai-secret OPENAI_API_KEY=your_openai_key
modal secret create pinecone-secret PINECONE_API_KEY=your_pinecone_key
modal secret create cohere-secret COHERE_API_KEY=your_cohere_key
```

4. Deploy the Modal app:
```bash
cd modal_service
modal deploy app.py
```

5. Note the deployed URL (e.g., `https://your-username--studylens-ai.modal.run`)

## Step 3: Configure Convex

1. Add the Modal API URL to your Convex environment variables:
   - Go to your Convex dashboard
   - Settings → Environment Variables
   - Add: `MODAL_API_URL` = `https://your-username--studylens-ai.modal.run`

## Step 4: Update File Upload Flow

The file upload now uses Modal for processing:
- Files are uploaded to Convex storage
- Modal processes the PDF and generates hybrid embeddings
- Embeddings are stored in Pinecone (not Convex)

## Step 5: Test the Agentic Workflow

1. Upload a PDF file to a course
2. Wait for processing (check Convex logs)
3. Try a complex query like: "Create a 3-day study plan for my Biology final focusing on Cell Theory"
4. The system will:
   - Use the LangGraph agent to plan
   - Perform hybrid search for each day's topics
   - Re-rank results with Cohere
   - Generate a structured study plan

## Key Features

### Hybrid Search
- Combines dense vectors (semantic) with sparse vectors (keyword)
- Better recall for course-specific terminology
- Implemented in `modal_service/app.py::hybrid_search`

### Re-ranking
- Uses Cohere's Cross-Encoder to improve precision
- Filters top 50 candidates to top 5
- Implemented in `modal_service/app.py::rerank_results`

### Agentic Workflow
- LangGraph agent with 3 nodes:
  1. **Planner**: Decomposes query into study plan structure
  2. **Retriever**: Performs hybrid search for each day's topics
  3. **Writer**: Synthesizes retrieved content into final plan
- Implemented in `modal_service/app.py::generate_study_plan`

## Troubleshooting

### Modal functions not working
- Check Modal logs: `modal app logs studylens-ai`
- Verify secrets are set correctly
- Check API URL in Convex environment variables

### Pinecone errors
- Verify index name matches (`studylens-ai`)
- Check dimensions (1536)
- Ensure sparse vector support is enabled

### Embeddings not being created
- Check Convex logs for errors
- Verify file URL is accessible
- Check Modal function logs

## Cost Estimates

- **Modal**: ~$0.10 per 1000 PDF pages processed
- **Pinecone**: Free tier: 100K vectors, then $0.096 per 100K vectors/month
- **Cohere**: Free tier: 100 requests/day, then $1 per 1000 requests
- **OpenAI**: Existing costs for embeddings and chat

## Next Steps

1. Monitor performance and costs
2. Fine-tune chunk sizes and overlap
3. Adjust hybrid search alpha parameter (currently 0.5)
4. Add more agent nodes for specialized tasks


