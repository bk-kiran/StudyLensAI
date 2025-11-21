import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get chat messages for a course
export const getChatMessages = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_course_and_user", (q) =>
        q.eq("courseId", args.courseId).eq("userId", userId)
      )
      .order("asc")
      .collect();

    return messages;
  },
});

// Save a chat message
export const saveChatMessage = mutation({
  args: {
    courseId: v.id("courses"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.insert("chatMessages", {
      courseId: args.courseId,
      userId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    });
  },
});

// Clear chat history for a course
export const clearChatHistory = mutation({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_course_and_user", (q) =>
        q.eq("courseId", args.courseId).eq("userId", userId)
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});
