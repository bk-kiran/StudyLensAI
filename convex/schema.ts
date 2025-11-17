import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
    ...authTables,

    files: defineTable({
        userId: v.id("users"),
        title: v.string(),
        fileName: v.string(),
        fileType: v.string(), // "pdf", "txt", "docx", etc.
        storageId: v.id("_storage"), // Reference to Convex file storage
        content: v.string(), // Extracted text content
        uploadDate: v.number(),
        courseId: v.optional(v.string()), // Optional: organize by course
        tags: v.optional(v.array(v.string())),
    }).index("by_userId", ["userId"]).index("by_course", ["userId", "courseId"]).searchIndex("search_content", {searchField: "content", filterFields: ["userId", "courseId"],})
})

export default schema