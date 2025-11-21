import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {convertToModelMessages, streamText, UIMessage} from "ai"
import {openai} from "@ai-sdk/openai"


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


        const {messages} : {messages: UIMessage[]} = await req.json();


        const lastMessages = messages.slice(-10)


        const result = streamText({
            model: openai("gpt-4o-mini"),
            system: `You are an intelligent AI study assistant for StudyLensAI, a course management platform. Your role is to help students learn and understand their course materials effectively.

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

                Your goal is to enhance the student's learning experience and help them achieve academic success.`,
            messages: convertToModelMessages(lastMessages),
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
