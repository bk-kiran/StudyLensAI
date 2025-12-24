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

    flashcards: defineTable({
        courseId: v.id("courses"),
        userId: v.id("users"),
        question: v.string(),
        answer: v.string(),
        // Spaced repetition fields (SM-2 algorithm)
        easeFactor: v.number(), // Default 2.5, adjusts based on performance
        interval: v.number(), // Days until next review
        repetitions: v.number(), // Number of successful reviews
        nextReviewDate: v.number(), // Timestamp for next review
        lastReviewDate: v.optional(v.number()),
        lastReviewQuality: v.optional(v.number()), // Last review quality (1-5) for display
        createdAt: v.number(),
    })
        .index("by_courseId", ["courseId"])
        .index("by_userId", ["userId"])
        .index("by_nextReviewDate", ["nextReviewDate"])
        .index("by_course_and_review", ["courseId", "nextReviewDate"]),

    examWorkflows: defineTable({
        courseId: v.id("courses"),
        userId: v.id("users"),
        status: v.union(
            v.literal("analyzing"),
            v.literal("identifying_topics"),
            v.literal("generating_questions"),
            v.literal("completed"),
            v.literal("failed")
        ),
        syllabusAnalysis: v.optional(v.string()),
        identifiedTopics: v.optional(v.array(v.string())),
        questions: v.optional(
            v.array(
                v.object({
                    question: v.string(),
                    type: v.union(v.literal("multiple_choice"), v.literal("short_answer")),
                    options: v.optional(v.array(v.string())),
                    correctAnswer: v.string(),
                    explanation: v.optional(v.string()),
                    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
                })
            )
        ),
        difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"), v.literal("mixed"))), // Overall quiz difficulty
        createdAt: v.number(),
        completedAt: v.optional(v.number()),
    })
        .index("by_courseId", ["courseId"])
        .index("by_userId", ["userId"])
        .index("by_status", ["status"]),
});

export default schema;
