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
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    // Generate embedding for the query
    const embeddingModel = openai.embedding("text-embedding-3-small");
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: args.query,
    });

    // Search for similar embeddings in the course
    const results = await ctx.runQuery(internal.files.searchEmbeddings, {
      courseId: args.courseId,
      userId,
      queryEmbedding,
      limit: args.limit ?? 5,
    });

    return results;
  },
});
