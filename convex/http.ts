import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {convertToModelMessages, streamText, UIMessage} from "ai"
import {openai} from "@ai-sdk/openai"
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";


const http = httpRouter();


auth.addHttpRoutes(http);


http.route({
    path: "/api/chat",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return Response.json({error: "Unauthorized"}, {status: 401})
        }


        const {messages, courseId, generateMode} : {
            messages: UIMessage[];
            courseId?: string;
            generateMode?: string | null;
        } = await req.json();

        // Get the last user message for RAG search
        const lastUserMessage = messages
            .filter((m) => m.role === "user")
            .slice(-1)[0];
        
        // Extract text from UIMessage format
        const extractTextFromMessage = (msg: UIMessage): string => {
            if (typeof msg === "string") return msg;
            if ("parts" in msg && msg.parts) {
                return msg.parts
                    .filter((p) => "type" in p && p.type === "text")
                    .map((p) => {
                        if ("text" in p && typeof p.text === "string") {
                            return p.text;
                        }
                        return "";
                    })
                    .join(" ");
            }
            if ("content" in msg) {
                const content = msg.content;
                if (typeof content === "string") return content;
                if (Array.isArray(content)) {
                    return content
                        .map((c) => {
                            if (typeof c === "string") return c;
                            if (typeof c === "object" && c !== null && "text" in c) {
                                return typeof c.text === "string" ? c.text : "";
                            }
                            return "";
                        })
                        .join(" ");
                }
            }
            return "";
        };

        const lastUserMessageText = lastUserMessage ? extractTextFromMessage(lastUserMessage) : "";
        
        let contextContent = "";
        let systemPrompt = `You are an intelligent AI study assistant for StudyLensAI, a course management platform. Your role is to help students learn and understand their course materials effectively.

Your capabilities include:
- Answering questions about lecture content and course materials
- Generating practice questions to test understanding
- Creating comprehensive summaries of topics
- Explaining complex concepts in simple, clear language
- Identifying and explaining key concepts from materials
- Creating study guides and flashcards
- Providing step-by-step explanations for difficult topics

Guidelines:
- Be encouraging, patient, and supportive in your responses
- Break down complex topics into digestible parts
- Use examples and analogies when helpful
- If you're unsure about something, acknowledge it honestly
- Encourage active learning by asking follow-up questions
- Tailor your explanations to the student's level of understanding
- Keep responses clear, concise, and well-structured
- When generating practice questions, ensure they cover key concepts and vary in difficulty
- ALWAYS base your responses on the provided course materials when available
- When course materials are provided, cite specific sources and quote relevant passages
- If the question cannot be fully answered from the materials, acknowledge what you can answer from the materials and what requires general knowledge

Your goal is to enhance the student's learning experience and help them achieve academic success.`;

        // Detect if user wants "all content" (for summaries, study guides, etc.)
        const wantsAllContent = (text: string): boolean => {
            const lowerText = text.toLowerCase();
            const allContentKeywords = [
                "all", "everything", "entire", "complete", "full", 
                "summarize all", "all content", "all materials", 
                "all slides", "all lectures", "all notes", "all files",
                "entire content", "complete summary", "full summary"
            ];
            return allContentKeywords.some(keyword => lowerText.includes(keyword));
        };

        const isAllContentRequest = wantsAllContent(lastUserMessageText) || 
                                    (generateMode === "summary" && (!lastUserMessageText || lastUserMessageText.trim().length === 0 || wantsAllContent(lastUserMessageText)));

        // Determine search query based on user message and generation mode
        let searchQuery = lastUserMessageText;
        
        // For generation modes, enhance the query to get relevant content
        if (generateMode && lastUserMessageText.trim().length > 0 && !isAllContentRequest) {
            const modeQueryEnhancements: Record<string, string> = {
                "practice-questions": `practice questions about ${lastUserMessageText}`,
                "summary": `summary of ${lastUserMessageText}`,
                "key-concepts": `key concepts about ${lastUserMessageText}`,
                "study-guide": `study guide for ${lastUserMessageText}`,
                "flashcards": `flashcards about ${lastUserMessageText}`,
                "explain": `explanation of ${lastUserMessageText}`,
            };
            searchQuery = modeQueryEnhancements[generateMode] || lastUserMessageText;
        }
        
        // If no specific query but generation mode, use a general search
        if (generateMode && (!lastUserMessageText || lastUserMessageText.trim().length === 0)) {
            searchQuery = generateMode === "summary" ? "course content summary" :
                        generateMode === "key-concepts" ? "key concepts important topics" :
                        generateMode === "study-guide" ? "study guide course materials" :
                        generateMode === "practice-questions" ? "practice questions course content" :
                        generateMode === "flashcards" ? "flashcards course content" :
                        "course materials";
        }

        // Perform RAG search if courseId is available
        if (courseId) {
            try {
                let searchResults: Array<{
                    content: string;
                    fileId: string;
                    fileName: string;
                    score?: number;
                }> = [];

                if (isAllContentRequest) {
                    // Get all course embeddings for "all content" requests
                    searchResults = await ctx.runAction(
                        api.fileActions.getAllCourseEmbeddings,
                        {
                            courseId: courseId as Id<"courses">,
                            limit: 100, // Get up to 100 chunks for comprehensive summaries
                        }
                    );
                } else if (searchQuery && searchQuery.trim().length > 0) {
                    // Use vector search for specific queries
                    searchResults = await ctx.runAction(
                        api.fileActions.searchCourseEmbeddings,
                        {
                            courseId: courseId as Id<"courses">,
                            query: searchQuery,
                            limit: 15, // Increased limit for better context
                        }
                    );
                }

                // Log for debugging
                console.log(`RAG search results: ${searchResults?.length || 0} chunks found for course ${courseId}`);
                if (searchResults && searchResults.length > 0) {
                    console.log(`Sample result: ${searchResults[0].fileName} - ${searchResults[0].content.substring(0, 100)}...`);
                } else {
                    console.log(`WARNING: No search results found. CourseId: ${courseId}, Query: ${searchQuery}`);
                }

                if (searchResults && searchResults.length > 0) {
                    // Build context from search results with better formatting
                    const contextSections = searchResults
                        .map((result: { fileName: string; content: string }, idx: number) => 
                            `[Source ${idx + 1}: ${result.fileName}]\n${result.content}`
                        )
                        .join("\n\n---\n\n");
                    
                    contextContent = `\n\n=== RELEVANT COURSE MATERIALS ===\n\n${contextSections}\n\n=== END OF COURSE MATERIALS ===\n\n`;
                    
                    if (isAllContentRequest) {
                        systemPrompt += `\n\nIMPORTANT INSTRUCTIONS FOR THIS CONVERSATION:
- The user has requested a comprehensive summary/overview of ALL their course materials
- Below are excerpts from their uploaded course files (this represents the available course content)
- You MUST use these materials as the primary source for your response
- Create a comprehensive summary/response that covers all the key topics and concepts from these materials
- Organize the content logically and cover all major themes
- Quote specific passages from the materials when relevant
- Reference the source file names when citing information
- This is a comprehensive request - make sure to cover all important content from the provided materials`;
                    } else {
                        systemPrompt += `\n\nCRITICAL: The user has uploaded course files and asked a question about them. 
BELOW YOU WILL SEE THE ACTUAL CONTENT FROM THEIR UPLOADED FILES.
YOU MUST USE THIS CONTENT TO ANSWER THEIR QUESTION.
DO NOT say you don't have access to files - you DO have access via the content below.
Answer their question using ONLY the course materials provided below.
If the materials don't fully answer the question, use what you can from the materials and acknowledge what's missing.
Always cite which file the information comes from (e.g., "According to [filename]...").`;
                    }
                } else {
                    // No results found - provide helpful message
                    systemPrompt += `\n\nIMPORTANT: No course materials (embeddings) were found for this course. This could mean:
1. No files have been uploaded yet - the user needs to upload PDF files first
2. Files were uploaded but embedding generation failed or is still in progress
3. There was an error during file processing

Politely inform the user that they need to upload PDF files to this course first. If they believe files were already uploaded, suggest they try uploading again or check if the files were processed successfully.`;
                }
            } catch (error) {
                console.error("RAG search error:", error);
                // Continue without context if search fails
                systemPrompt += `\n\nNOTE: There was an error searching course materials: ${error instanceof Error ? error.message : 'Unknown error'}. Answer based on general knowledge and inform the user about the error.`;
            }
        }

        // Update system prompt based on generation mode
        if (generateMode) {
            const modePrompts: Record<string, string> = {
                "practice-questions": "Generate practice questions based on the course materials. Create questions that test understanding of key concepts, vary in difficulty (easy, medium, hard), and include both multiple-choice and open-ended questions. Provide answers and explanations. Base questions on the actual content from the course materials.",
                "summary": "Create a comprehensive summary of the course materials. Organize the summary by topics, highlight key points, and ensure it covers all important concepts from the materials. Use the provided course materials as the source.",
                "key-concepts": "Extract and explain the key concepts from the course materials. List each concept clearly, provide definitions, and explain their importance and relationships. Base this on the actual course materials provided.",
                "study-guide": "Create a detailed study guide covering all important topics from the course materials. Organize it by chapters or themes, include key points, definitions, and important examples. Use the course materials as your primary source.",
                "flashcards": "Generate flashcards with questions and answers from the materials. Format them clearly with the question on one side and the answer on the other. Cover a variety of topics based on the course materials.",
                "explain": "Explain the requested concept in detail using the course materials. Break it down into understandable parts, use examples from the materials, and relate it to other concepts when relevant. Quote from the materials when helpful.",
            };
            
            if (modePrompts[generateMode]) {
                systemPrompt += `\n\nCURRENT TASK MODE: ${modePrompts[generateMode]}`;
            }
        }

        // Get recent messages (last 10 for context)
        const lastMessages = messages.slice(-10);
        
        // Add context to system prompt if available
        if (contextContent) {
            systemPrompt += contextContent;
            console.log(`Context added to system prompt. Context length: ${contextContent.length} chars`);
            console.log(`Context preview: ${contextContent.substring(0, 200)}...`);
        } else {
            console.log("WARNING: No contextContent to add to system prompt");
        }

        // Convert messages to model format
        let modelMessages = convertToModelMessages(lastMessages);
        
        // Also add context to the last user message if available (some models respond better this way)
        if (contextContent && modelMessages.length > 0) {
            const lastMessage = modelMessages[modelMessages.length - 1];
            console.log(`Last message role: ${lastMessage.role}, content type: ${typeof lastMessage.content}`);
            if (lastMessage.role === "user") {
                if (typeof lastMessage.content === "string") {
                    // Append context to user message
                    modelMessages[modelMessages.length - 1] = {
                        ...lastMessage,
                        content: lastMessage.content + "\n\n" + contextContent,
                    };
                    console.log("Context also added to user message (string content)");
                } else if (Array.isArray(lastMessage.content)) {
                    // Handle array content format
                    modelMessages[modelMessages.length - 1] = {
                        ...lastMessage,
                        content: [
                            ...lastMessage.content,
                            { type: "text", text: "\n\n" + contextContent }
                        ],
                    };
                    console.log("Context also added to user message (array content)");
                }
            }
        }
        
        console.log(`System prompt length: ${systemPrompt.length} chars`);
        console.log(`Number of messages: ${modelMessages.length}`);

        const result = streamText({
            model: openai("gpt-4o-mini"),
            system: systemPrompt,
            messages: modelMessages,
            onError(error) {
                console.error("streamText error: ", error)
            }
        })


        return result.toUIMessageStreamResponse({
            headers: new Headers({
                "Access-Control-Allow-Origin": "*",
                Vary: "origin",
            })
        })
    })
})

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

export default http;
