import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFilesByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const files = await ctx.db
      .query("files")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    return files;
  },
});

export const saveFile = mutation({
  args: {
    courseId: v.id("courses"),
    name: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) {
      throw new Error("Course not found or unauthorized");
    }
    const fileId = await ctx.db.insert("files", {
      userId,
      courseId: args.courseId,
      name: args.name,
      storageId: args.storageId,
      uploadDate: Date.now(),
    });
    return fileId;
  },
});

// Internal mutation to bulk-insert all file embeddings associated with a save
export const createFileWithEmbeddings = internalMutation({
  args: {
    name: v.string(),
    courseId: v.id("courses"),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    embeddings: v.array(
      v.object({
        embedding: v.array(v.float64()),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const fileId = await ctx.db.insert("files", {
      userId: args.userId,
      courseId: args.courseId,
      name: args.name,
      storageId: args.storageId,
      uploadDate: Date.now(),
    });
    for (const embeddingData of args.embeddings) {
      await ctx.db.insert("fileEmbeddings", {
        fileId,
        content: embeddingData.content,
        embedding: embeddingData.embedding,
        courseId: args.courseId,
        userId: args.userId,
      });
    }
    return fileId;
  },
});

export const deleteFile = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const file = await ctx.db.get(args.id);
    if (!file || file.userId !== userId) {
      throw new Error("File not found or unauthorized");
    }
    // Delete from storage
    await ctx.storage.delete(file.storageId);
    // Delete the file record
    await ctx.db.delete(args.id);
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Internal query to search embeddings using vector search
export const searchEmbeddings = internalQuery({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
    queryEmbedding: v.array(v.float64()),
    limit: v.number(),
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
    // Use vector search to find similar embeddings
    // The filter is applied within vectorSearch for proper vector index usage
    const results = await ctx.db
      .query("fileEmbeddings")
      .vectorSearch("by_embedding", {
        vector: args.queryEmbedding,
        limit: args.limit,
        filter: (q) =>
          q.eq(q.field("courseId"), args.courseId).eq(q.field("userId"), args.userId),
      });

    // Get file names for each result
    const resultsWithFileNames = await Promise.all(
      results.map(async (result) => {
        const file = await ctx.db.get(result.fileId);
        return {
          content: result.content,
          fileId: result.fileId,
          fileName: file?.name ?? "Unknown",
          score: result._score ?? 0,
        };
      })
    );

    return resultsWithFileNames;
  },
});
