import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getCourses = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Get file count for each course
    const coursesWithFileCount = await Promise.all(
      courses.map(async (course) => {
        const files = await ctx.db
          .query("files")
          .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
          .collect();

        return {
          ...course,
          fileCount: files.length,
        };
      })
    );

    return coursesWithFileCount;
  },
});

export const createCourse = mutation({
  args: {
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const courseId = await ctx.db.insert("courses", {
      userId,
      name: args.name,
      description: args.description,
      createdAt: Date.now(),
    });

    return courseId;
  },
});

export const deleteCourse = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const course = await ctx.db.get(args.id);
    if (!course || course.userId !== userId) {
      throw new Error("Course not found or unauthorized");
    }

    // Delete all files associated with this course
    const files = await ctx.db
      .query("files")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.id))
      .collect();

    for (const file of files) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    // Delete the course
    await ctx.db.delete(args.id);
  },
});