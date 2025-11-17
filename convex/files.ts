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

    // Verify the course belongs to the user
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