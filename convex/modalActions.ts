"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Modal API endpoint (set this in your environment variables)
const MODAL_API_URL = process.env.MODAL_API_URL || "https://your-username--studylens-ai.modal.run";

/**
 * Process PDF and generate embeddings using Modal service.
 * This replaces the client-side embedding generation with server-side processing.
 */
export const processPdfWithModal = action({
  args: {
    fileUrl: v.string(),
    fileId: v.id("files"),
    courseId: v.id("courses"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      const response = await fetch(`${MODAL_API_URL}/process_pdf_and_generate_embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_url: args.fileUrl,
          file_id: args.fileId,
          course_id: args.courseId,
          user_id: userId,
          file_name: args.fileName,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal API error: ${error}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error processing PDF with Modal:", error);
      throw error;
    }
  },
});

/**
 * Upsert vectors to Pinecone via Modal.
 */
export const upsertVectorsToPinecone = action({
  args: {
    vectors: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      const response = await fetch(`${MODAL_API_URL}/upsert_to_pinecone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectors: args.vectors,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal API error: ${error}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error upserting to Pinecone:", error);
      throw error;
    }
  },
});

/**
 * Perform hybrid search using Modal service.
 */
export const hybridSearch = action({
  args: {
    query: v.string(),
    courseId: v.id("courses"),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      const response = await fetch(`${MODAL_API_URL}/hybrid_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: args.query,
          course_id: args.courseId,
          user_id: userId,
          top_k: args.topK || 50,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal API error: ${error}`);
      }

      const results = await response.json();
      return results;
    } catch (error) {
      console.error("Error performing hybrid search:", error);
      throw error;
    }
  },
});

/**
 * Re-rank search results using Modal service.
 */
export const rerankSearchResults = action({
  args: {
    query: v.string(),
    candidates: v.array(
      v.object({
        content: v.string(),
        file_id: v.string(),
        file_name: v.string(),
        score: v.number(),
      })
    ),
    topN: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      const response = await fetch(`${MODAL_API_URL}/rerank_results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: args.query,
          candidates: args.candidates,
          top_n: args.topN || 5,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal API error: ${error}`);
      }

      const results = await response.json();
      return results;
    } catch (error) {
      console.error("Error re-ranking results:", error);
      throw error;
    }
  },
});

/**
 * Generate a study plan using the agentic workflow.
 */
export const generateStudyPlan = action({
  args: {
    query: v.string(),
    courseId: v.id("courses"),
    numDays: v.optional(v.number()),
    focusTopics: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      const response = await fetch(`${MODAL_API_URL}/generate_study_plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: args.query,
          course_id: args.courseId,
          user_id: userId,
          num_days: args.numDays || 3,
          focus_topics: args.focusTopics || [],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal API error: ${error}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error generating study plan:", error);
      throw error;
    }
  },
});

/**
 * Delete vectors from Pinecone when a file is deleted.
 */
export const deleteVectorsFromPinecone = action({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      const response = await fetch(`${MODAL_API_URL}/delete_from_pinecone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_id: args.fileId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal API error: ${error}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error deleting from Pinecone:", error);
      throw error;
    }
  },
});




