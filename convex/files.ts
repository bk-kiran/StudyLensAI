import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDocument = mutation({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    content: v.string(),
    courseId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const documentId = await ctx.db.insert("files", {
      userId,
      title: args.title,
      fileName: args.fileName,
      fileType: args.fileType,
      storageId: args.storageId,
      content: args.content,
      uploadDate: Date.now(),
      courseId: args.courseId,
      tags: args.tags,
    });

    return documentId;
  },
});

export const getDocuments = query({
  args: {
    courseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    let documents;
    if (args.courseId) {
      documents = await ctx.db
        .query("files")
        .withIndex("by_course", (q) => 
          q.eq("userId", userId).eq("courseId", args.courseId)
        )
        .collect();
    } else {
      documents = await ctx.db
        .query("files")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    }

    return documents;
  },
});

export const deleteDocument = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const document = await ctx.db.get(args.id);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found or unauthorized");
    }

    // Delete the file from storage
    await ctx.storage.delete(document.storageId);
    
    // Delete the document record
    await ctx.db.delete(args.id);
  },
});