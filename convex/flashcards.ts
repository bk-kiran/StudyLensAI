import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// SM-2 Algorithm constants
const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const INITIAL_INTERVAL = 1; // days

// SM-2 Algorithm implementation for spaced repetition
function calculateNextReview(
  easeFactor: number,
  interval: number,
  repetitions: number,
  quality: number // 0-5, where 5 is perfect recall
): { easeFactor: number; interval: number; repetitions: number; nextReviewDate: number } {
  let newEaseFactor = easeFactor;
  let newInterval = interval;
  let newRepetitions = repetitions;

  // Update ease factor based on quality
  newEaseFactor = newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEaseFactor = Math.max(newEaseFactor, MIN_EASE_FACTOR);

  if (quality < 3) {
    // If quality is low, reset repetitions and interval
    newRepetitions = 0;
    newInterval = INITIAL_INTERVAL;
  } else {
    // Increase repetitions
    newRepetitions = newRepetitions + 1;

    // Calculate new interval
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(newInterval * newEaseFactor);
    }
  }

  // Calculate next review date (in milliseconds)
  const nextReviewDate = Date.now() + newInterval * 24 * 60 * 60 * 1000;

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate,
  };
}

// Generate flashcards from course content using AI
export const generateFlashcards = action({
  args: {
    courseId: v.id("courses"),
    topic: v.optional(v.string()),
    count: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      question: v.string(),
      answer: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const count = args.count ?? 10;

    // Get relevant course content
    let contextContent = "";
    if (args.topic) {
      // Search for specific topic
      const searchResults = await ctx.runAction(api.fileActions.searchCourseEmbeddings, {
        courseId: args.courseId,
        query: args.topic,
        limit: 20,
      });
      contextContent = searchResults
        .map((r: { fileName: string; content: string }) => `[Source: ${r.fileName}]\n${r.content}`)
        .join("\n\n---\n\n");
    } else {
      // Get all course content
      const allContent = await ctx.runAction(api.fileActions.getAllCourseEmbeddings, {
        courseId: args.courseId,
        limit: 50,
      });
      contextContent = allContent
        .map((r: { fileName: string; content: string }) => `[Source: ${r.fileName}]\n${r.content}`)
        .join("\n\n---\n\n");
    }

    if (!contextContent) {
      throw new Error("No course content found. Please upload files to the course first.");
    }

    // Use structured output to generate flashcards
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        flashcards: z.array(
          z.object({
            question: z.string().describe("Clear, concise question that tests understanding"),
            answer: z.string().describe("Detailed answer that explains the concept"),
          })
        ),
      }),
      prompt: `Generate ${count} high-quality flashcards from the following course materials. 
Each flashcard should:
- Test understanding of key concepts, definitions, or relationships
- Have clear, concise questions
- Include detailed answers that explain the concept
- Cover different topics from the materials
- Be suitable for spaced repetition learning

Course Materials:
${contextContent}

Generate exactly ${count} flashcards.`,
    });

    return object.flashcards;
  },
});

// Save generated flashcards to database
export const saveFlashcards = mutation({
  args: {
    courseId: v.id("courses"),
    flashcards: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const now = Date.now();
    const flashcardIds: Id<"flashcards">[] = [];

    for (const flashcard of args.flashcards) {
      const flashcardId = await ctx.db.insert("flashcards", {
        courseId: args.courseId,
        userId,
        question: flashcard.question,
        answer: flashcard.answer,
        easeFactor: INITIAL_EASE_FACTOR,
        interval: INITIAL_INTERVAL,
        repetitions: 0,
        nextReviewDate: now - 1000, // Review immediately (set slightly in past to ensure query picks it up)
        createdAt: now,
      });
      flashcardIds.push(flashcardId);
    }

    return flashcardIds;
  },
});

// Get flashcards for a course
export const getFlashcards = query({
  args: {
    courseId: v.id("courses"),
    includeReviewed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    let flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    if (!args.includeReviewed) {
      // Only return flashcards that are due for review
      const now = Date.now();
      flashcards = flashcards.filter((f) => f.nextReviewDate <= now);
    }

    // Sort by nextReviewDate (earliest first)
    flashcards.sort((a, b) => a.nextReviewDate - b.nextReviewDate);

    return flashcards;
  },
});

// Get flashcards due for review
export const getDueFlashcards = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const now = Date.now();
    const flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_course_and_review", (q) =>
        q.eq("courseId", args.courseId).lte("nextReviewDate", now)
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    // Filter out empty flashcards and sort
    return flashcards
      .filter((f) => f.question.trim().length > 0 && f.answer.trim().length > 0)
      .sort((a, b) => a.nextReviewDate - b.nextReviewDate);
  },
});

// Review a flashcard (update spaced repetition data)
export const reviewFlashcard = mutation({
  args: {
    flashcardId: v.id("flashcards"),
    quality: v.number(), // 0-5 rating
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const flashcard = await ctx.db.get(args.flashcardId);
    if (!flashcard || flashcard.userId !== userId) {
      throw new Error("Flashcard not found or unauthorized");
    }

    if (args.quality < 0 || args.quality > 5) {
      throw new Error("Quality must be between 0 and 5");
    }

    const { easeFactor, interval, repetitions, nextReviewDate } = calculateNextReview(
      flashcard.easeFactor,
      flashcard.interval,
      flashcard.repetitions,
      args.quality
    );

    await ctx.db.patch(args.flashcardId, {
      easeFactor,
      interval,
      repetitions,
      nextReviewDate,
      lastReviewDate: Date.now(),
      lastReviewQuality: args.quality, // Store the quality for display
    });

    return {
      easeFactor,
      interval,
      repetitions,
      nextReviewDate,
    };
  },
});

// Delete a flashcard
export const deleteFlashcard = mutation({
  args: {
    flashcardId: v.id("flashcards"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const flashcard = await ctx.db.get(args.flashcardId);
    if (!flashcard || flashcard.userId !== userId) {
      throw new Error("Flashcard not found or unauthorized");
    }

    await ctx.db.delete(args.flashcardId);
  },
});

