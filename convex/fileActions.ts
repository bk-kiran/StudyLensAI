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

// Search embeddings for RAG - finds relevant content from course files
export const searchCourseEmbeddings = action({
  args: {
    courseId: v.id("courses"),
    query: v.string(),
    limit: v.optional(v.number()),
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

    // Generate embedding for the query
    const embeddingModel = openai.embedding("text-embedding-3-small");
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: args.query,
    });

    // Search for similar embeddings in the course
    let results = await ctx.runQuery(internal.files.searchEmbeddings, {
      courseId: args.courseId,
      userId,
      queryEmbedding,
      limit: (args.limit ?? 5) * 2, // Get more results for keyword filtering
    });

    // If vector search failed and we got fallback results, do keyword-based filtering
    if (results.length > 0 && results[0].score === 0.5) {
      // This means we're using the fallback - do keyword matching
      const queryLower = args.query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2); // Extract meaningful words
      
      // Score each result based on keyword matches
      const scoredResults = results.map(result => {
        const contentLower = result.content.toLowerCase();
        let score = 0;
        let matchCount = 0;
        
        // Count how many query words appear in the content
        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            matchCount++;
            // Give higher score for exact word matches
            const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
            if (wordRegex.test(result.content)) {
              score += 2; // Exact word match
            } else {
              score += 1; // Partial match
            }
          }
        }
        
        // Bonus for content that has multiple query terms
        if (matchCount === queryWords.length && queryWords.length > 0) {
          score += 5; // All words matched
        }
        
        return {
          ...result,
          score: score > 0 ? score : 0.3, // Lower score if no matches
        };
      });
      
      // Sort by score (highest first) and take top N
      scoredResults.sort((a, b) => b.score - a.score);
      results = scoredResults.slice(0, args.limit ?? 5);
      
      console.log(`Keyword filtering: ${results.length} results after filtering from ${scoredResults.length}`);
      if (results.length > 0) {
        console.log(`Top result score: ${results[0].score}, content preview: ${results[0].content.substring(0, 100)}...`);
      }
    }

    return results;
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
