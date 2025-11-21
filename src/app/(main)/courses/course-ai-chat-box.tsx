"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Sparkles, Trash } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { DefaultChatTransport } from "ai";
import Markdown from "@/components/markdown";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

type GenerateMode = "practice-questions" | "summary" | "key-concepts" | "study-guide" | "flashcards" | "explain" | null;

interface CourseAIChatBoxProps {
  courseName: string;
  courseId: Id<"courses">;
  generateMode: GenerateMode;
  onModeChange: (mode: GenerateMode) => void;
}

const MODE_PROMPTS: Record<NonNullable<GenerateMode>, string> = {
  "practice-questions": "Generate practice questions based on the course materials",
  "summary": "Create a comprehensive summary of the course materials",
  "key-concepts": "Extract and explain the key concepts from the course materials",
  "study-guide": "Create a detailed study guide covering all important topics",
  "flashcards": "Generate flashcards with questions and answers from the materials",
  "explain": "Explain a specific concept in detail",
};

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(
  /.cloud$/,
  ".site"
);

export function CourseAIChatBox({
  courseName,
  courseId,
  generateMode,
  onModeChange,
}: CourseAIChatBoxProps) {
  const token = useAuthToken();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const hasLoadedRef = useRef(false);
  const savedMessageIdsRef = useRef(new Set<string>());

  // Fetch chat history from Convex
  const savedMessages = useQuery(
    api.chatMessages.getChatMessages,
    courseId ? { courseId } : "skip"
  );
  
  const saveChatMessage = useMutation(api.chatMessages.saveChatMessage);
  const clearHistory = useMutation(api.chatMessages.clearChatHistory);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: `${convexSiteUrl}/api/chat`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  });

  const isProcessing = status === "submitted" || status === "streaming";

  // Load chat history once when data is available
  useEffect(() => {
    if (savedMessages !== undefined && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      
      if (Array.isArray(savedMessages) && savedMessages.length > 0) {
        const formattedMessages = savedMessages.map((msg, idx) => ({
          id: `${msg._id}-${idx}`,
          role: msg.role as "user" | "assistant",
          parts: [
            {
              type: "text" as const,
              text: msg.content,
            },
          ],
        }));
        setMessages(formattedMessages);
        
        // Track all loaded message IDs to prevent duplicates
        savedMessages.forEach((msg) => {
          const messageKey = `${msg.role}-${msg.content}`;
          savedMessageIdsRef.current.add(messageKey);
        });
      }
    }
  }, [savedMessages, setMessages]);

  // Save new messages to Convex
  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    if (
      hasLoadedRef.current &&
      courseId &&
      messages.length > prevMessagesLengthRef.current
    ) {
      // Get all new messages since last save
      const newMessages = messages.slice(prevMessagesLengthRef.current);
      
      newMessages.forEach((message) => {
        const lastPart = message.parts[message.parts.length - 1];
        
        if (lastPart?.type === "text" && message.role) {
          const messageKey = `${message.role}-${lastPart.text}`;
          
          // Only save if we haven't saved this exact message before
          if (!savedMessageIdsRef.current.has(messageKey)) {
            savedMessageIdsRef.current.add(messageKey);
            
            // For user messages, save immediately
            // For assistant messages, only save when complete (status is ready)
            if (message.role === "user" || status === "ready") {
              saveChatMessage({
                courseId,
                role: message.role as "user" | "assistant",
                content: lastPart.text,
              }).catch(console.error);
            }
          }
        }
      });

      // Update the counter only when status is ready (conversation complete)
      if (status === "ready") {
        prevMessagesLengthRef.current = messages.length;
      }
    }
  }, [messages.length, status, courseId, saveChatMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!input.trim() || isProcessing) return;

    let messageToSend = input.trim();

    if (generateMode) {
      const modePrompt = MODE_PROMPTS[generateMode];
      messageToSend = `${modePrompt}: ${messageToSend}`;
      onModeChange(null);
    }

    sendMessage({ text: messageToSend });
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (!courseId) return;
    
    try {
      await clearHistory({ courseId });
      setMessages([]);
      savedMessageIdsRef.current.clear();
      prevMessagesLengthRef.current = 0;
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const lastMessageIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";

  if (!hasLoadedRef.current && savedMessages === undefined) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Bot className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-background" style={{ minHeight: 0, maxHeight: "100%" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ minHeight: 0, maxHeight: "100%" }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base">{courseName}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                {generateMode
                  ? `I'll help you ${GENERATE_MODES.find(m => m.id === generateMode)?.label.toLowerCase()}. Ask me anything about your course materials.`
                  : "Ask me anything about your course materials, or use the Generate button to create study resources."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => {
              const currentStep = msg.parts[msg.parts.length - 1];
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
                >
                  <div className="flex gap-3 max-w-[80%]">
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl p-4 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {currentStep?.type === "text" && (
                        msg.role === "assistant" ? (
                          <Markdown>{currentStep.text}</Markdown>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentStep.text}</p>
                        )
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-primary">U</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {status === "submitted" && lastMessageIsUser && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div className="rounded-2xl p-4 bg-muted">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="rounded-2xl p-4 bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input - Sticky at bottom */}
      <div className="border-t bg-background p-3 sm:p-4 flex-shrink-0">
        {generateMode && (
          <div className="mb-2 sm:mb-3 flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-primary/10 rounded-md border border-primary/20 max-w-fit">
            <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-medium text-primary truncate">
              {GENERATE_MODES.find(m => m.id === generateMode)?.label}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-1 hover:bg-primary/20 flex-shrink-0"
              onClick={() => onModeChange(null)}
            >
              ×
            </Button>
          </div>
        )}
        <div className="flex gap-2 items-center mb-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              className="gap-1.5 text-xs h-8"
            >
              <Trash className="h-3.5 w-3.5" />
              Clear History
            </Button>
          )}
        </div>
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <div className="flex-1 relative min-w-0">
            <Input
              placeholder={
                generateMode
                  ? `Ask about ${GENERATE_MODES.find(m => m.id === generateMode)?.label.toLowerCase()}...`
                  : "Type your question here..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing}
              className="w-full h-auto min-h-[44px] sm:min-h-[48px] py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border-2 focus:border-primary/50 text-sm sm:text-base"
            />
          </div>
          <Button 
            type="submit"
            size="icon" 
            disabled={!input.trim() || isProcessing}
            className="h-11 w-11 sm:h-12 sm:w-12 bg-primary hover:bg-primary/90 rounded-xl flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

const GENERATE_MODES = [
  { id: "practice-questions" as const, label: "Practice Questions" },
  { id: "summary" as const, label: "Summary" },
  { id: "key-concepts" as const, label: "Key Concepts" },
  { id: "study-guide" as const, label: "Study Guide" },
  { id: "flashcards" as const, label: "Flashcards" },
  { id: "explain" as const, label: "Explain Concept" },
];
