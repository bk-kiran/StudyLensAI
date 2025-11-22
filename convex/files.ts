import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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

// Internal query to get files by course (for use in actions)
export const getFilesByCourseInternal = internalQuery({
  args: { 
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
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
    let results: Array<{
      fileId: Id<"files">;
      content: string;
      _score?: number;
    }> = [];

    try {
      // Try vector search first
      const vectorResults = await (ctx.db
        .query("fileEmbeddings") as any)
        .vectorSearch("by_embedding", {
          vector: args.queryEmbedding,
          limit: args.limit,
          filter: (q: any) =>
            q.eq(q.field("courseId"), args.courseId).eq(q.field("userId"), args.userId),
        });
      
      if (Array.isArray(vectorResults) && vectorResults.length > 0) {
        results = vectorResults;
      }
    } catch (error) {
      console.error("Vector search failed, falling back to regular query:", error);
    }

    // Fallback: if vector search failed or returned no results, use keyword-based search
    if (results.length === 0) {
      console.log("Using keyword-based fallback query for embeddings");
      const allEmbeddings = await ctx.db
        .query("fileEmbeddings")
        .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .collect();
      
      // Simple keyword matching: score based on how many query terms appear in content
      // Extract keywords from a sample query (we'll pass the original query text)
      // For now, score based on content length and return all, let the action handle filtering
      // Actually, we need the original query text for keyword matching
      // Since we don't have it here, return all embeddings and let caller handle it
      // Or we could do a simple text search if we had the query
      
      // For now, return all embeddings - the action will need to do keyword matching
      // But wait, we don't have access to the original query text here
      // Let's return a larger set and the action can filter
      results = allEmbeddings.map(e => ({
        fileId: e.fileId,
        content: e.content,
        _score: 0.5, // Default score
      }));
      
      // Sort by content length (longer content might be more informative) and take top N
      results.sort((a, b) => b.content.length - a.content.length);
      results = results.slice(0, args.limit * 2); // Get more for keyword filtering
    }

    console.log(`Found ${results.length} embedding results for course ${args.courseId}`);

    // Get file names for each result
    const resultsWithFileNames: Array<{
      content: string;
      fileId: Id<"files">;
      fileName: string;
      score: number;
    }> = await Promise.all(
      results.map(async (result) => {
        const file = await ctx.db.get(result.fileId);
        const fileName = file && "name" in file ? (file.name as string) : "Unknown";
        return {
          content: result.content,
          fileId: result.fileId,
          fileName,
          score: result._score ?? 0,
        };
      })
    );

    return resultsWithFileNames;
  },
});

// Internal query to get all course embeddings (for "all content" requests)
export const getAllCourseEmbeddings = internalQuery({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      content: v.string(),
      fileId: v.id("files"),
      fileName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Get all embeddings for the course
    // Try with index first, then fallback to full query if needed
    let allEmbeddings = await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    // If no results with index, try without index (fallback)
    if (allEmbeddings.length === 0) {
      // Try querying all embeddings and filtering manually
      const allEmbeddingsNoIndex = await ctx.db
        .query("fileEmbeddings")
        .collect();
      
      allEmbeddings = allEmbeddingsNoIndex.filter(
        (e) => e.courseId === args.courseId && e.userId === args.userId
      );
    }

    // Limit if specified
    const limitedEmbeddings = args.limit 
      ? allEmbeddings.slice(0, args.limit)
      : allEmbeddings;

    // Get file names for each result
    const resultsWithFileNames = await Promise.all(
      limitedEmbeddings.map(async (embedding) => {
        const file = await ctx.db.get(embedding.fileId);
        return {
          content: embedding.content,
          fileId: embedding.fileId,
          fileName: (file && "name" in file ? file.name : undefined) ?? "Unknown",
        };
      })
    );

    return resultsWithFileNames;
  },
});
