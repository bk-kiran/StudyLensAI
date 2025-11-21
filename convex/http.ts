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
            if (msg.content) return typeof msg.content === "string" ? msg.content : msg.content.map(c => typeof c === "string" ? c : c.text).join(" ");
            if (msg.parts) {
                return msg.parts
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text)
                    .join(" ");
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
- Always base your responses on the provided course materials when available

Your goal is to enhance the student's learning experience and help them achieve academic success.`;

        // Perform RAG search if courseId and user message are available
        if (courseId && lastUserMessageText) {
            try {
                const searchResults = await ctx.runAction(
                    api.fileActions.searchCourseEmbeddings,
                    {
                        courseId: courseId as Id<"courses">,
                        query: lastUserMessageText,
                        limit: 5,
                    }
                );

                if (searchResults && searchResults.length > 0) {
                    // Build context from search results
                    contextContent = "\n\nRelevant course materials:\n" +
                        searchResults
                            .map((result, idx) => 
                                `[Source: ${result.fileName}]\n${result.content}`
                            )
                            .join("\n\n---\n\n");
                    
                    systemPrompt += `\n\nIMPORTANT: Use the following course materials as the primary source for your response. Reference specific content from these materials when answering questions. If the question cannot be answered from these materials, acknowledge that and provide general guidance.`;
                }
            } catch (error) {
                console.error("RAG search error:", error);
                // Continue without context if search fails
            }
        }

        // Update system prompt based on generation mode
        if (generateMode) {
            const modePrompts: Record<string, string> = {
                "practice-questions": "Generate practice questions based on the course materials. Create questions that test understanding of key concepts, vary in difficulty (easy, medium, hard), and include both multiple-choice and open-ended questions. Provide answers and explanations.",
                "summary": "Create a comprehensive summary of the course materials. Organize the summary by topics, highlight key points, and ensure it covers all important concepts from the materials.",
                "key-concepts": "Extract and explain the key concepts from the course materials. List each concept clearly, provide definitions, and explain their importance and relationships.",
                "study-guide": "Create a detailed study guide covering all important topics from the course materials. Organize it by chapters or themes, include key points, definitions, and important examples.",
                "flashcards": "Generate flashcards with questions and answers from the materials. Format them clearly with the question on one side and the answer on the other. Cover a variety of topics.",
                "explain": "Explain the requested concept in detail using the course materials. Break it down into understandable parts, use examples from the materials, and relate it to other concepts when relevant.",
            };
            
            if (modePrompts[generateMode]) {
                systemPrompt += `\n\nCurrent task: ${modePrompts[generateMode]}`;
            }
        }

        const lastMessages = messages.slice(-10);
        
        // Add context to the last user message if available
        const messagesWithContext = [...lastMessages];
        if (contextContent && messagesWithContext.length > 0) {
            const lastMsg = messagesWithContext[messagesWithContext.length - 1];
            if (lastMsg.role === "user") {
                const userText = extractTextFromMessage(lastMsg);
                // Modify the message to include context
                if (typeof lastMsg === "string") {
                    messagesWithContext[messagesWithContext.length - 1] = userText + contextContent as any;
                } else {
                    messagesWithContext[messagesWithContext.length - 1] = {
                        ...lastMsg,
                        content: userText + contextContent,
                    } as any;
                }
            }
        }

        const result = streamText({
            model: openai("gpt-4o-mini"),
            system: systemPrompt,
            messages: convertToModelMessages(messagesWithContext),
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
