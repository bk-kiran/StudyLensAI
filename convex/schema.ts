import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  courses: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  files: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    name: v.string(),
    storageId: v.id("_storage"),
    uploadDate: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_courseId", ["courseId"]),
});

export default schema;