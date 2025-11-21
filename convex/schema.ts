import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
    ...authTables,

    pendingUsers: defineTable({
        email: v.string(),
        passwordHash: v.string(),
        code: v.string(),
        expiresAt: v.number(),
        verified: v.boolean(),
        attempts: v.number(),
    }).index("by_email", ["email"]),

    emailVerifications: defineTable({
        email: v.string(),
        code: v.string(),
        expiresAt: v.number(),
        verified: v.boolean(),
        attempts: v.number(),
    }).index("by_email", ["email"]),

    passwordResets: defineTable({
        email: v.string(),
        code: v.string(),
        expiresAt: v.number(),
        verified: v.boolean(),
        attempts: v.number(),
        oldPasswordHash: v.optional(v.string()),
    }).index("by_email", ["email"]),

    passwordResetTemp: defineTable({
        email: v.string(),
        tempPassword: v.string(),
        expiresAt: v.number(),
    }).index("by_email", ["email"]),
    
    // NEW: Track pending password resets
    pendingPasswordResets: defineTable({
        email: v.string(),
        newPassword: v.string(),
        expiresAt: v.number(),
    }).index("by_email", ["email"]),

    courses: defineTable({
        userId: v.id("users"),
        name: v.string(),
        description: v.string(),
        createdAt: v.number(),
        emoji: v.optional(v.string()),
        color: v.optional(v.string()),
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

    chatMessages: defineTable({
    courseId: v.id("courses"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("by_course_and_user", ["courseId", "userId"])
    .index("by_course", ["courseId"]),

    fileEmbeddings: defineTable({
        content: v.string(),
        embedding: v.array(v.float64()),
        fileId: v.id("files"),
        userId: v.id("users"),
        courseId: v.id("courses"), // Optional: to filter by course
    })
        .index("by_fileId", ["fileId"])
        .index("by_courseId", ["courseId"])
        .vectorIndex("by_embedding", {
        vectorField: "embedding",
        dimensions: 1536, // OpenAI text-embedding-3-small uses 1536 dimensions
        filterFields: ["userId", "courseId"],
    }),
});

export default schema;
