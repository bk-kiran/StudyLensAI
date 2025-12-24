"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { generateEmbeddings } from "../src/lib/embeddings";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

// Create file + embeddings (call from UI after extracting text from PDF)
export const createFile = action({
  args: {
    name: v.string(),
    courseId: v.id("courses"),
    storageId: v.id("_storage"),
    fileContent: v.string(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated to upload a file");
    const embeddings = await generateEmbeddings(args.fileContent);
    const fileId: Id<"files"> = await ctx.runMutation(
      internal.files.createFileWithEmbeddings,
      {
        name: args.name,
        courseId: args.courseId,
        storageId: args.storageId,
        userId,
        embeddings,
      }
    );
    return fileId;
  },
});

// Simple BM25-like scoring function
function calculateBM25Score(
  queryTerms: string[],
  content: string,
  contentLower: string,
  avgContentLength: number,
  totalDocs: number,
  docFreqs: Map<string, number>
): number {
  const k1 = 1.5; // Term frequency saturation parameter
  const b = 0.75; // Length normalization parameter
  const contentLength = content.split(/\s+/).length;
  
  let score = 0;
  
  for (const term of queryTerms) {
    if (term.length < 2) continue;
    
    // Count term frequency in this document
    const termRegex = new RegExp(`\\b${term}\\b`, 'gi');
    const termFreq = (content.match(termRegex) || []).length;
    
    if (termFreq === 0) continue;
    
    // Calculate IDF (Inverse Document Frequency)
    const docFreq = docFreqs.get(term) || 1;
    const idf = Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);
    
    // Calculate BM25 score component
    const numerator = termFreq * (k1 + 1);
    const denominator = termFreq + k1 * (1 - b + b * (contentLength / avgContentLength));
    const bm25Component = idf * (numerator / denominator);
    
    score += bm25Component;
  }
  
  return score;
}

// Search embeddings for RAG - HYBRID SEARCH (BM25 + Vector)
export const searchCourseEmbeddings = action({
  args: {
    courseId: v.id("courses"),
    query: v.string(),
    limit: v.optional(v.number()),
    hybridAlpha: v.optional(v.number()), // Weight for vector vs keyword (0-1, default 0.5)
  },
  returns: v.array(
    v.object({
      content: v.string(),
      fileId: v.id("files"),
      fileName: v.string(),
      score: v.number(),
    })
  ),
  handler: async (ctx, args): Promise<Array<{
    content: string;
    fileId: Id<"files">;
    fileName: string;
    score: number;
  }>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const alpha = args.hybridAlpha ?? 0.5; // Default: equal weight for vector and keyword
    const limit = args.limit ?? 15;

    // Step 1: Vector Search (Semantic Similarity)
    const embeddingModel = openai.embedding("text-embedding-3-small");
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: args.query,
    });

    // Get vector search results (get more for combination)
    const vectorResults = await ctx.runQuery(internal.files.searchEmbeddings, {
      courseId: args.courseId,
      userId,
      queryEmbedding,
      limit: limit * 2, // Get more results for hybrid combination
    });

    // Step 2: Keyword Search (BM25-like)
    // Get all course embeddings for keyword search
    const allEmbeddings = await ctx.runQuery(internal.files.getAllCourseEmbeddings, {
      courseId: args.courseId,
      userId,
      limit: 500, // Get enough for BM25 calculation
    });

    if (allEmbeddings.length === 0) {
      return [];
    }

    // Prepare query terms for keyword search
    const queryLower = args.query.toLowerCase();
    const queryTerms = queryLower
      .split(/\s+/)
      .map(term => term.replace(/[^\w]/g, ''))
      .filter(term => term.length >= 2);

    // Calculate document frequencies for IDF
    const docFreqs = new Map<string, number>();
    const avgContentLength = allEmbeddings.reduce((sum, e) => {
      const words = e.content.split(/\s+/);
      const contentLower = e.content.toLowerCase();
      
      // Count document frequency for each query term
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          docFreqs.set(term, (docFreqs.get(term) || 0) + 1);
        }
      }
      
      return sum + words.length;
    }, 0) / allEmbeddings.length;

    // Calculate BM25 scores for all embeddings
    const keywordResults = allEmbeddings.map(embedding => {
      const contentLower = embedding.content.toLowerCase();
      const bm25Score = calculateBM25Score(
        queryTerms,
        embedding.content,
        contentLower,
        avgContentLength,
        allEmbeddings.length,
        docFreqs
      );
      
      return {
        content: embedding.content,
        fileId: embedding.fileId,
        fileName: embedding.fileName,
        keywordScore: bm25Score,
      };
    });

    // Normalize scores to 0-1 range for combination
    const maxVectorScore = Math.max(...vectorResults.map(r => r.score || 0), 1);
    const maxKeywordScore = Math.max(...keywordResults.map(r => r.keywordScore), 1) || 1;

    // Create a map of results by content for easy lookup
    const resultMap = new Map<string, {
      content: string;
      fileId: Id<"files">;
      fileName: string;
      vectorScore: number;
      keywordScore: number;
    }>();

    // Add vector results
    for (const result of vectorResults) {
      const normalizedVectorScore = (result.score || 0) / maxVectorScore;
      resultMap.set(result.content, {
        content: result.content,
        fileId: result.fileId,
        fileName: result.fileName,
        vectorScore: normalizedVectorScore,
        keywordScore: 0,
      });
    }

    // Add/merge keyword results
    for (const result of keywordResults) {
      const normalizedKeywordScore = result.keywordScore / maxKeywordScore;
      const existing = resultMap.get(result.content);
      
      if (existing) {
        existing.keywordScore = normalizedKeywordScore;
      } else {
        resultMap.set(result.content, {
          content: result.content,
          fileId: result.fileId,
          fileName: result.fileName,
          vectorScore: 0,
          keywordScore: normalizedKeywordScore,
        });
      }
    }

    // Combine scores using weighted average
    const hybridResults = Array.from(resultMap.values()).map(result => ({
      content: result.content,
      fileId: result.fileId,
      fileName: result.fileName,
      score: alpha * result.vectorScore + (1 - alpha) * result.keywordScore,
    }));

    // Sort by hybrid score and return top N
    hybridResults.sort((a, b) => b.score - a.score);
    const finalResults = hybridResults.slice(0, limit);

    console.log(`Hybrid search: ${finalResults.length} results (alpha=${alpha}, vector=${vectorResults.length}, keyword=${keywordResults.length})`);
    if (finalResults.length > 0) {
      console.log(`Top result: score=${finalResults[0].score.toFixed(3)}, file=${finalResults[0].fileName}`);
    }

    return finalResults;
  },
});

// Get all course embeddings (for "all content" requests)
export const getAllCourseEmbeddings = action({
  args: {
    courseId: v.id("courses"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      content: v.string(),
      fileId: v.id("files"),
      fileName: v.string(),
    })
  ),
  handler: async (ctx, args): Promise<Array<{
    content: string;
    fileId: Id<"files">;
    fileName: string;
  }>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    // First check if files exist for this course
    const courseFiles = await ctx.runQuery(internal.files.getFilesByCourseInternal, {
      courseId: args.courseId,
      userId,
    });

    if (!courseFiles || courseFiles.length === 0) {
      // No files found - return empty array
      console.log(`[getAllCourseEmbeddings] No files found for course ${args.courseId} and user ${userId}`);
      return [];
    }

    console.log(`[getAllCourseEmbeddings] Found ${courseFiles.length} files for course ${args.courseId}`);

    // Get all embeddings for the course
    const results = await ctx.runQuery(internal.files.getAllCourseEmbeddings, {
      courseId: args.courseId,
      userId,
      limit: args.limit ?? 100, // Increased default to 100 chunks for "all content" requests
    });

    console.log(`[getAllCourseEmbeddings] Found ${results.length} embeddings for course ${args.courseId}`);
    if (results.length > 0) {
      console.log(`[getAllCourseEmbeddings] Sample: ${results[0].fileName} - ${results[0].content.substring(0, 50)}...`);
    }

    return results;
  },
});
