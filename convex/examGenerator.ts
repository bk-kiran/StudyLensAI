import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { generateText, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Question schema for structured output - using discriminated union
const QuestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("multiple_choice"),
    question: z.string().describe("The question text"),
    options: z
      .array(z.string())
      .min(2)
      .describe("Answer options (at least 2 required for multiple choice)"),
    correctAnswer: z.string().describe("The correct answer"),
    explanation: z
      .string()
      .describe("Explanation of why this is the correct answer"),
    difficulty: z
      .enum(["easy", "medium", "hard"])
      .describe("Difficulty level of the question"),
  }),
  z.object({
    type: z.literal("short_answer"),
    question: z.string().describe("The question text"),
    correctAnswer: z.string().describe("The correct answer"),
    explanation: z
      .string()
      .describe("Explanation of why this is the correct answer"),
    difficulty: z
      .enum(["easy", "medium", "hard"])
      .describe("Difficulty level of the question"),
  }),
]);

// Practice exam generator - Agentic workflow
export const generatePracticeExam = action({
  args: {
    courseId: v.id("courses"),
    questionCount: v.optional(v.number()),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"), v.literal("mixed"))),
  },
  returns: v.id("examWorkflows"),
  handler: async (ctx, args): Promise<Id<"examWorkflows">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const questionCount = args.questionCount ?? 15;
    const difficulty = args.difficulty ?? "mixed";

    // Step 1: Create workflow record
    const workflowId: Id<"examWorkflows"> = await ctx.runMutation(internal.examGenerator.createWorkflow, {
      courseId: args.courseId,
      userId,
      difficulty: args.difficulty,
    });

    try {
      // Step 2: Analyze syllabus/notes
      await ctx.runMutation(internal.examGenerator.updateWorkflowStatus, {
        workflowId,
        status: "analyzing",
      });

      const allContent = await ctx.runAction(api.fileActions.getAllCourseEmbeddings, {
        courseId: args.courseId,
        limit: 100,
      });

      if (allContent.length === 0) {
        throw new Error("No course content found. Please upload files first.");
      }

      const courseContent = allContent
        .map((r: { fileName: string; content: string }) => `[Source: ${r.fileName}]\n${r.content}`)
        .join("\n\n---\n\n");

      // Analyze the content and detect exam questions
      const { text: analysis } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: `Analyze the following course materials and provide a comprehensive summary of:
1. Main topics and themes
2. Key concepts and definitions
3. Important relationships between concepts
4. Areas that would be tested in an exam
5. Any existing exam questions, practice problems, or sample questions found in the materials

Course Materials:
${courseContent}

Provide a detailed analysis that will be used to generate exam questions.`,
      });

      // Detect and extract exam questions from the content
      const { object: examQuestionsData } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          foundQuestions: z
            .array(
              z.object({
                question: z.string().describe("The exam question found in the materials"),
                type: z
                  .enum(["multiple_choice", "short_answer", "essay", "problem_solving"])
                  .describe("Type of question"),
                topic: z.string().describe("Topic or concept this question tests"),
                difficulty: z
                  .enum(["easy", "medium", "hard"])
                  .describe("Perceived difficulty level - infer based on question complexity"),
              })
            )
            .describe("List of exam questions found in the uploaded materials"),
          questionPatterns: z
            .string()
            .describe(
              "Summary of patterns, formats, and styles observed in the found exam questions"
            ),
        }),
        prompt: `Carefully examine the following course materials and identify ALL exam questions, practice problems, sample questions, or similar assessment items.

Look for:
- Questions with numbers (e.g., "1.", "Question 1:", "Problem 1")
- Multiple choice questions (with options A, B, C, D or numbered options)
- Short answer questions
- Problem-solving questions (especially in math, science, or technical subjects)
- Questions from past exams, practice tests, or study guides
- End-of-chapter questions or review questions

Course Materials:
${courseContent}

Extract all exam questions you find and identify patterns in their format, style, and content.`,
      });

      await ctx.runMutation(internal.examGenerator.updateWorkflowAnalysis, {
        workflowId,
        syllabusAnalysis: analysis,
      });

      // Step 3: Identify key topics
      await ctx.runMutation(internal.examGenerator.updateWorkflowStatus, {
        workflowId,
        status: "identifying_topics",
      });

      const { object: topicsData } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          topics: z
            .array(z.string())
            .describe("List of key topics that should be covered in the exam"),
        }),
        prompt: `Based on the following course analysis, identify the key topics that should be covered in a practice exam.
Aim for 8-12 distinct topics that represent the most important concepts.

Course Analysis:
${analysis}

Provide a list of key topics.`,
      });

      await ctx.runMutation(internal.examGenerator.updateWorkflowTopics, {
        workflowId,
        identifiedTopics: topicsData.topics,
      });

      // Step 4: Generate exam questions
      await ctx.runMutation(internal.examGenerator.updateWorkflowStatus, {
        workflowId,
        status: "generating_questions",
      });

      // Calculate question distribution
      const easyCount = difficulty === "easy" ? questionCount : difficulty === "hard" ? 0 : Math.floor(questionCount * 0.3);
      const mediumCount = difficulty === "medium" ? questionCount : difficulty === "easy" || difficulty === "hard" ? 0 : Math.floor(questionCount * 0.5);
      const hardCount = difficulty === "hard" ? questionCount : difficulty === "easy" ? 0 : questionCount - easyCount - mediumCount;

      // Determine how many questions should be similar to found exam questions
      const foundQuestionsCount = examQuestionsData.foundQuestions.length;
      const similarQuestionsCount = foundQuestionsCount > 0 ? Math.min(Math.floor(questionCount * 0.4), foundQuestionsCount * 2) : 0;
      const regularQuestionsCount = questionCount - similarQuestionsCount;

      // Generate questions in batches
      const allQuestions: z.infer<typeof QuestionSchema>[] = [];

      // First, generate questions similar to found exam questions if any were detected
      if (similarQuestionsCount > 0 && foundQuestionsCount > 0) {
        const similarEasyCount = difficulty === "easy" ? similarQuestionsCount : difficulty === "hard" ? 0 : Math.floor(similarQuestionsCount * 0.3);
        const similarMediumCount = difficulty === "medium" ? similarQuestionsCount : difficulty === "easy" || difficulty === "hard" ? 0 : Math.floor(similarQuestionsCount * 0.5);
        const similarHardCount = difficulty === "hard" ? similarQuestionsCount : difficulty === "easy" ? 0 : similarQuestionsCount - similarEasyCount - similarMediumCount;

        const foundQuestionsText = examQuestionsData.foundQuestions
          .map((q, idx) => `${idx + 1}. [${q.type}] ${q.question} (Topic: ${q.topic})`)
          .join("\n");

        if (similarEasyCount > 0) {
          const { object: similarEasyQuestions } = await generateObject({
            model: openai("gpt-4o-mini"),
            schema: z.object({
              questions: z.array(QuestionSchema),
            }),
            prompt: `Generate EXACTLY ${similarEasyCount} EASY difficulty exam questions (no more, no less) that are SIMILAR IN STYLE AND FORMAT to the exam questions found in the uploaded materials.

Found Exam Questions:
${foundQuestionsText}

Question Patterns Observed:
${examQuestionsData.questionPatterns}

Course Materials:
${courseContent}

Requirements:
- Create questions that match the style, format, and approach of the found exam questions
- Use similar question structures, wording patterns, and difficulty levels
- Test the same topics and concepts as the found questions, but with different specific content
- Mix of multiple choice and short answer questions (approximately 60% multiple choice, 40% short answer)
- Include clear explanations for answers
- Make questions EASY difficulty (basic understanding and recall)
- CRITICAL: For ANY mathematical formulas, equations, expressions, variables with subscripts, or mathematical notation, you MUST use LaTeX format with dollar signs:
  * Inline math: ALWAYS wrap with single dollar signs like $x^2 + y^2 = z^2$ or $X_1 = 2, X_2 = 4$
  * Block math: wrap with double dollar signs like $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
  * NEVER use parentheses like (X_1 = 2) - ALWAYS use $X_1 = 2$ instead
  * Variables with subscripts like X_1, theta_1, etc. MUST be wrapped in dollar signs: $X_1$, $\\theta_1$`,
          });
          allQuestions.push(...similarEasyQuestions.questions);
        }

        if (similarMediumCount > 0) {
          const { object: similarMediumQuestions } = await generateObject({
            model: openai("gpt-4o-mini"),
            schema: z.object({
              questions: z.array(QuestionSchema),
            }),
            prompt: `Generate EXACTLY ${similarMediumCount} MEDIUM difficulty exam questions (no more, no less) that are SIMILAR IN STYLE AND FORMAT to the exam questions found in the uploaded materials.

Found Exam Questions:
${foundQuestionsText}

Question Patterns Observed:
${examQuestionsData.questionPatterns}

Course Materials:
${courseContent}

Requirements:
- Create questions that match the style, format, and approach of the found exam questions
- Use similar question structures, wording patterns, and difficulty levels
- Test the same topics and concepts as the found questions, but with different specific content
- Mix of multiple choice and short answer questions (approximately 60% multiple choice, 40% short answer)
- Include clear explanations for answers
- Make questions MEDIUM difficulty (application and analysis)
- CRITICAL: For ANY mathematical formulas, equations, expressions, variables with subscripts, or mathematical notation, you MUST use LaTeX format with dollar signs:
  * Inline math: ALWAYS wrap with single dollar signs like $x^2 + y^2 = z^2$ or $X_1 = 2, X_2 = 4$
  * Block math: wrap with double dollar signs like $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
  * NEVER use parentheses like (X_1 = 2) - ALWAYS use $X_1 = 2$ instead
  * Variables with subscripts like X_1, theta_1, etc. MUST be wrapped in dollar signs: $X_1$, $\\theta_1$`,
          });
          allQuestions.push(...similarMediumQuestions.questions);
        }

        if (similarHardCount > 0) {
          const { object: similarHardQuestions } = await generateObject({
            model: openai("gpt-4o-mini"),
            schema: z.object({
              questions: z.array(QuestionSchema),
            }),
            prompt: `Generate EXACTLY ${similarHardCount} HARD difficulty exam questions (no more, no less) that are SIMILAR IN STYLE AND FORMAT to the exam questions found in the uploaded materials.

Found Exam Questions:
${foundQuestionsText}

Question Patterns Observed:
${examQuestionsData.questionPatterns}

Course Materials:
${courseContent}

Requirements:
- Create questions that match the style, format, and approach of the found exam questions
- Use similar question structures, wording patterns, and difficulty levels
- Test the same topics and concepts as the found questions, but with different specific content
- Mix of multiple choice and short answer questions (approximately 50% multiple choice, 50% short answer)
- Include detailed explanations for answers
- Make questions HARD difficulty (synthesis, evaluation, and critical thinking)
- CRITICAL: For ANY mathematical formulas, equations, expressions, variables with subscripts, or mathematical notation, you MUST use LaTeX format with dollar signs:
  * Inline math: ALWAYS wrap with single dollar signs like $x^2 + y^2 = z^2$ or $X_1 = 2, X_2 = 4$
  * Block math: wrap with double dollar signs like $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
  * NEVER use parentheses like (X_1 = 2) - ALWAYS use $X_1 = 2$ instead
  * Variables with subscripts like X_1, theta_1, etc. MUST be wrapped in dollar signs: $X_1$, $\\theta_1$`,
          });
          allQuestions.push(...similarHardQuestions.questions);
        }
      }

      // Then generate regular questions based on course content
      const regularEasyCount = Math.max(0, easyCount - (similarQuestionsCount > 0 && foundQuestionsCount > 0 ? Math.floor(similarQuestionsCount * 0.3) : 0));
      const regularMediumCount = Math.max(0, mediumCount - (similarQuestionsCount > 0 && foundQuestionsCount > 0 ? Math.floor(similarQuestionsCount * 0.5) : 0));
      const regularHardCount = Math.max(0, hardCount - (similarQuestionsCount > 0 && foundQuestionsCount > 0 ? (similarQuestionsCount - Math.floor(similarQuestionsCount * 0.3) - Math.floor(similarQuestionsCount * 0.5)) : 0));

      if (regularEasyCount > 0) {
        const { object: easyQuestions } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: z.object({
            questions: z.array(QuestionSchema),
          }),
          prompt: `Generate EXACTLY ${regularEasyCount} EASY difficulty exam questions (no more, no less) based on the course materials.

Topics to cover: ${topicsData.topics.join(", ")}

Course Materials:
${courseContent}

Requirements:
- Mix of multiple choice and short answer questions (approximately 60% multiple choice, 40% short answer)
- Questions should test basic understanding and recall
- Include clear explanations for answers
- Base all questions on the provided course materials
- CRITICAL: For ANY mathematical formulas, equations, expressions, variables with subscripts, or mathematical notation, you MUST use LaTeX format with dollar signs:
  * Inline math: ALWAYS wrap with single dollar signs like $x^2 + y^2 = z^2$ or $X_1 = 2, X_2 = 4$
  * Block math: wrap with double dollar signs like $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
  * NEVER use parentheses like (X_1 = 2) - ALWAYS use $X_1 = 2$ instead
  * Variables with subscripts like X_1, theta_1, etc. MUST be wrapped in dollar signs: $X_1$, $\\theta_1$`,
        });
        allQuestions.push(...easyQuestions.questions);
      }

      if (regularMediumCount > 0) {
        const { object: mediumQuestions } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: z.object({
            questions: z.array(QuestionSchema),
          }),
          prompt: `Generate EXACTLY ${regularMediumCount} MEDIUM difficulty exam questions (no more, no less) based on the course materials.

Topics to cover: ${topicsData.topics.join(", ")}

Course Materials:
${courseContent}

Requirements:
- Mix of multiple choice and short answer questions (approximately 60% multiple choice, 40% short answer)
- Questions should test application and analysis
- Include clear explanations for answers
- Base all questions on the provided course materials
- CRITICAL: For ANY mathematical formulas, equations, expressions, variables with subscripts, or mathematical notation, you MUST use LaTeX format with dollar signs:
  * Inline math: ALWAYS wrap with single dollar signs like $x^2 + y^2 = z^2$ or $X_1 = 2, X_2 = 4$
  * Block math: wrap with double dollar signs like $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
  * NEVER use parentheses like (X_1 = 2) - ALWAYS use $X_1 = 2$ instead
  * Variables with subscripts like X_1, theta_1, etc. MUST be wrapped in dollar signs: $X_1$, $\\theta_1$`,
        });
        allQuestions.push(...mediumQuestions.questions);
      }

      if (regularHardCount > 0) {
        const { object: hardQuestions } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: z.object({
            questions: z.array(QuestionSchema),
          }),
          prompt: `Generate EXACTLY ${regularHardCount} HARD difficulty exam questions (no more, no less) based on the course materials.

Topics to cover: ${topicsData.topics.join(", ")}

Course Materials:
${courseContent}

Requirements:
- Mix of multiple choice and short answer questions (approximately 50% multiple choice, 50% short answer)
- Questions should test synthesis, evaluation, and critical thinking
- Include detailed explanations for answers
- Base all questions on the provided course materials
- CRITICAL: For ANY mathematical formulas, equations, expressions, variables with subscripts, or mathematical notation, you MUST use LaTeX format with dollar signs:
  * Inline math: ALWAYS wrap with single dollar signs like $x^2 + y^2 = z^2$ or $X_1 = 2, X_2 = 4$
  * Block math: wrap with double dollar signs like $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
  * NEVER use parentheses like (X_1 = 2) - ALWAYS use $X_1 = 2$ instead
  * Variables with subscripts like X_1, theta_1, etc. MUST be wrapped in dollar signs: $X_1$, $\\theta_1$`,
        });
        allQuestions.push(...hardQuestions.questions);
      }

      // Shuffle questions and ensure we have exactly the requested count
      const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
      
      // Trim to exact question count (in case AI generated extra questions)
      const finalQuestions = shuffledQuestions.slice(0, questionCount);

      // Step 5: Save questions and complete workflow
      await ctx.runMutation(internal.examGenerator.updateWorkflowQuestions, {
        workflowId,
        questions: finalQuestions.map((q) => {
          if (q.type === "multiple_choice") {
            return {
              question: q.question,
              type: q.type as "multiple_choice",
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || "No explanation provided.",
              difficulty: q.difficulty,
            };
          } else {
            return {
              question: q.question,
              type: q.type as "short_answer",
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || "No explanation provided.",
              difficulty: q.difficulty,
            };
          }
        }),
      });

      await ctx.runMutation(internal.examGenerator.updateWorkflowStatus, {
        workflowId,
        status: "completed",
      });

      return workflowId;
    } catch (error) {
      await ctx.runMutation(internal.examGenerator.updateWorkflowStatus, {
        workflowId,
        status: "failed",
      });
      throw error;
    }
  },
});

// Create workflow record (internal - called from action)
export const createWorkflow = internalMutation({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"), v.literal("mixed"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("examWorkflows", {
      courseId: args.courseId,
      userId: args.userId,
      status: "analyzing",
      difficulty: args.difficulty,
      createdAt: Date.now(),
    });
  },
});

// Update workflow status (internal - called from action)
export const updateWorkflowStatus = internalMutation({
  args: {
    workflowId: v.id("examWorkflows"),
    status: v.union(
      v.literal("analyzing"),
      v.literal("identifying_topics"),
      v.literal("generating_questions"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workflowId, {
      status: args.status,
      ...(args.status === "completed" ? { completedAt: Date.now() } : {}),
    });
  },
});

// Update workflow analysis (internal - called from action)
export const updateWorkflowAnalysis = internalMutation({
  args: {
    workflowId: v.id("examWorkflows"),
    syllabusAnalysis: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workflowId, {
      syllabusAnalysis: args.syllabusAnalysis,
    });
  },
});

// Update workflow topics (internal - called from action)
export const updateWorkflowTopics = internalMutation({
  args: {
    workflowId: v.id("examWorkflows"),
    identifiedTopics: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workflowId, {
      identifiedTopics: args.identifiedTopics,
    });
  },
});

// Update workflow questions (internal - called from action)
export const updateWorkflowQuestions = internalMutation({
  args: {
    workflowId: v.id("examWorkflows"),
    questions: v.array(
      v.object({
        question: v.string(),
        type: v.union(v.literal("multiple_choice"), v.literal("short_answer")),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workflowId, {
      questions: args.questions,
    });
  },
});

// Get workflow
export const getWorkflow = query({
  args: {
    workflowId: v.id("examWorkflows"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow || workflow.userId !== userId) {
      throw new Error("Workflow not found or unauthorized");
    }

    return workflow;
  },
});

// Get all workflows for a course
export const getWorkflowsByCourse = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const workflows = await ctx.db
      .query("examWorkflows")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    return workflows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Delete a workflow
export const deleteWorkflow = mutation({
  args: {
    workflowId: v.id("examWorkflows"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow || workflow.userId !== userId) {
      throw new Error("Workflow not found or unauthorized");
    }

    await ctx.db.delete(args.workflowId);
  },
});

// Export exam as PDF (returns HTML that can be converted to PDF)
export const exportExamAsPDF = action({
  args: {
    workflowId: v.id("examWorkflows"),
  },
  returns: v.string(), // HTML content
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated");

    const workflow = await ctx.runQuery(api.examGenerator.getWorkflow, {
      workflowId: args.workflowId,
    });

    if (!workflow || workflow.status !== "completed" || !workflow.questions) {
      throw new Error("Exam not ready for export");
    }

    // Generate HTML for PDF
    const html: string = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Practice Exam</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 10px;
    }
    .question {
      margin: 30px 0;
      page-break-inside: avoid;
    }
    .question-number {
      font-weight: bold;
      font-size: 1.1em;
      margin-bottom: 10px;
    }
    .question-text {
      margin-bottom: 15px;
    }
    .options {
      list-style: none;
      padding-left: 0;
    }
    .options li {
      margin: 8px 0;
      padding: 5px;
    }
    .options li:before {
      content: counter(option-counter, upper-alpha) ". ";
      counter-increment: option-counter;
      font-weight: bold;
    }
    .options {
      counter-reset: option-counter;
    }
    .difficulty {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 0.85em;
      margin-left: 10px;
    }
    .difficulty.easy { background-color: #d4edda; color: #155724; }
    .difficulty.medium { background-color: #fff3cd; color: #856404; }
    .difficulty.hard { background-color: #f8d7da; color: #721c24; }
    .answer-section {
      margin-top: 40px;
      page-break-before: always;
    }
    .answer {
      margin: 20px 0;
      padding: 15px;
      background-color: #f5f5f5;
      border-left: 4px solid #333;
    }
    @media print {
      .answer-section {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <h1>Practice Exam</h1>
  <p><strong>Generated:</strong> ${new Date(workflow.createdAt).toLocaleDateString()}</p>
  <p><strong>Total Questions:</strong> ${workflow.questions.length}</p>
  
  <div class="questions">
    ${workflow.questions
      .map(
        (q: { question: string; type: "multiple_choice" | "short_answer"; options?: string[]; correctAnswer: string; explanation?: string; difficulty: "easy" | "medium" | "hard" }, idx: number) => `
    <div class="question">
      <div class="question-number">
        Question ${idx + 1}
        <span class="difficulty ${q.difficulty}">${q.difficulty.toUpperCase()}</span>
      </div>
      <div class="question-text">${q.question}</div>
      ${
        q.type === "multiple_choice" && q.options
          ? `
      <ol class="options" type="A">
        ${q.options.map((opt: string) => `<li>${opt}</li>`).join("")}
      </ol>
      `
          : ""
      }
    </div>
    `
      )
      .join("")}
  </div>
  
  <div class="answer-section">
    <h1>Answer Key</h1>
    ${workflow.questions
      .map(
        (q: { question: string; type: "multiple_choice" | "short_answer"; options?: string[]; correctAnswer: string; explanation?: string; difficulty: "easy" | "medium" | "hard" }, idx: number) => `
    <div class="answer">
      <strong>Question ${idx + 1}:</strong> ${q.correctAnswer}
      ${q.explanation ? `<br><em>Explanation:</em> ${q.explanation}` : ""}
    </div>
    `
      )
      .join("")}
  </div>
</body>
</html>
    `;

    return html;
  },
});

