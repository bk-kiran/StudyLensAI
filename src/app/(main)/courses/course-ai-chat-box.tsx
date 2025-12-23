"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Sparkles, Trash, ChevronDown, BookOpen, HelpCircle, Lightbulb, ListChecks, FileQuestion } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { DefaultChatTransport } from "ai";
import Markdown from "@/components/markdown";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const AUTO_GENERATE_PROMPTS: Record<NonNullable<GenerateMode>, string> = {
  "practice-questions": "Generate practice questions based on all the course materials. Create questions that test understanding of key concepts, vary in difficulty (easy, medium, hard), and include both multiple-choice and open-ended questions. Provide answers and explanations.",
  "summary": "Create a comprehensive summary of all the course materials. Organize the summary by topics, highlight key points, and ensure it covers all important concepts from the materials.",
  "key-concepts": "Extract and explain the key concepts from all the course materials. List each concept clearly, provide definitions, and explain their importance and relationships.",
  "study-guide": "Create a detailed study guide covering all important topics from all the course materials. Organize it by chapters or themes, include key points, definitions, and important examples.",
  "flashcards": "Generate flashcards with questions and answers from all the course materials. Format them clearly with the question on one side and the answer on the other. Cover a variety of topics.",
  "explain": "Please explain the key concepts from all the course materials in detail. Break them down into understandable parts, use examples from the materials, and relate them to other concepts when relevant.",
};

const GENERATE_MODES = [
  { id: "practice-questions" as const, label: "Practice Questions", icon: FileQuestion },
  { id: "summary" as const, label: "Summary", icon: BookOpen },
  { id: "key-concepts" as const, label: "Key Concepts", icon: Lightbulb },
  { id: "study-guide" as const, label: "Study Guide", icon: ListChecks },
  { id: "flashcards" as const, label: "Flashcards", icon: Sparkles },
  { id: "explain" as const, label: "Explain Concept", icon: HelpCircle },
];

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
  const tokenRef = useRef(token);
  tokenRef.current = token; // Keep ref in sync
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const hasLoadedRef = useRef(false);
  const savedMessageIdsRef = useRef(new Set<string>());
  const currentGenerateModeRef = useRef<GenerateMode>(null);
  const modeSelectInProgressRef = useRef(false);

  // Fetch chat history from Convex
  const savedMessages = useQuery(
    api.chatMessages.getChatMessages,
    courseId ? { courseId } : "skip"
  );
  
  const saveChatMessage = useMutation(api.chatMessages.saveChatMessage);
  const clearHistory = useMutation(api.chatMessages.clearChatHistory);

  // Memoize the fetch function to prevent transport recreation
  // Use refs for courseId and generateMode to avoid recreating on every change
  const courseIdRef = useRef(courseId);
  courseIdRef.current = courseId;
  
  const customFetch = useCallback(async (url: string, options?: RequestInit) => {
    // Intercept and modify the request body to include courseId and generateMode
    if (options?.body) {
      try {
        const body = JSON.parse(options.body as string);
        body.courseId = courseIdRef.current;
        // Use ref value (always up-to-date)
        body.generateMode = currentGenerateModeRef.current;
        options.body = JSON.stringify(body);
      } catch (e) {
        console.error("Failed to modify request body:", e);
      }
    }
    
    try {
      const response = await fetch(url, options);
      
      // Check if response is ok
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Fetch error:", response.status, errorData);
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      return response;
    } catch (fetchError) {
      console.error("Network error:", fetchError);
      throw fetchError;
    }
  }, []); // Empty deps - we use refs for all values

  // Memoize the transport to prevent useChat from resetting
  // Use ref for token to prevent recreation on every token change
  const transport = useMemo(() => {
    const currentToken = tokenRef.current;
    return new DefaultChatTransport({
      api: `${convexSiteUrl}/api/chat`,
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
      fetch: customFetch,
    });
  }, [customFetch]); // Only recreate if customFetch changes (which it shouldn't)

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport,
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isProcessing = status === "submitted" || status === "streaming";

  // Load chat history once when data is available
  const hasInitializedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const initializedMessagesRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only process once when data becomes available
    if (savedMessages === undefined) return;
    if (hasInitializedRef.current) return;
    if (isInitializingRef.current) return; // Prevent concurrent initialization
    
    // Create a stable key to check if we've already initialized with this data
    const messagesKey = Array.isArray(savedMessages) 
      ? savedMessages.map(m => `${m._id}-${m.content}`).join('|')
      : 'empty';
    
    if (initializedMessagesRef.current === messagesKey) return;
    
    isInitializingRef.current = true;
    hasInitializedRef.current = true;
    hasLoadedRef.current = true;
    initializedMessagesRef.current = messagesKey;
    
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
      
      // Track all loaded message IDs to prevent duplicates
      savedMessages.forEach((msg) => {
        const messageKey = `${msg.role}-${msg.content}`;
        savedMessageIdsRef.current.add(messageKey);
      });
      
      // Use requestAnimationFrame to defer setMessages and prevent immediate re-render loops
      requestAnimationFrame(() => {
        setMessages(formattedMessages);
        isInitializingRef.current = false;
      });
    } else {
      isInitializingRef.current = false;
    }
  }, [savedMessages, setMessages]);

  // Save new messages to Convex
  const prevMessagesLengthRef = useRef(0);
  const isSavingRef = useRef(false);
  const messagesRef = useRef(messages);
  const lastProcessedLengthRef = useRef(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep messages ref in sync without triggering effects
  messagesRef.current = messages;
  
  useEffect(() => {
    // Only process if we've loaded initial messages and have a courseId
    if (!hasLoadedRef.current || !courseId) return;
    if (isInitializingRef.current) return; // Don't save during initialization
    if (isSavingRef.current) return; // Prevent concurrent saves
    if (modeSelectInProgressRef.current) return; // Don't save immediately after mode select
    
    // CRITICAL: During streaming, messages update continuously causing infinite loops
    // Only save user messages immediately, wait for streaming to complete for assistant messages
    const isStreaming = status === "submitted" || status === "streaming";
    
    const currentMessages = messagesRef.current;
    const currentLength = currentMessages.length;
    const prevLength = prevMessagesLengthRef.current;
    
    // Only process if there are new messages and we haven't processed this length yet
    if (currentLength <= prevLength || currentLength === lastProcessedLengthRef.current) {
      // Update counter if status is ready (even if no new messages, in case we missed an update)
      if (status === "ready" && prevLength < currentLength) {
        prevMessagesLengthRef.current = currentLength;
        lastProcessedLengthRef.current = currentLength;
      }
      return;
    }
    
    // Get all new messages since last save
    const newMessages = currentMessages.slice(prevLength);
    
    // CRITICAL FIX: Only save user messages during streaming
    // Skip ALL processing during streaming to prevent infinite loops
    // We'll save assistant messages when status becomes "ready"
    if (isStreaming) {
      // During streaming, only save user messages (which are complete)
      const userMessages = newMessages.filter(msg => msg.role === "user");
      
      if (userMessages.length === 0) {
        // No user messages to save, skip entirely during streaming
        // Don't update lastProcessedLengthRef to allow processing when ready
        return;
      }
      
      // Only process user messages during streaming
      const saveUserMessages = async () => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        
        try {
          for (const message of userMessages) {
            const lastPart = message.parts[message.parts.length - 1];
            
            if (lastPart?.type === "text" && message.role === "user") {
              const messageKey = `user-${lastPart.text}`;
              
              if (!savedMessageIdsRef.current.has(messageKey)) {
                savedMessageIdsRef.current.add(messageKey);
                
                try {
                  await saveChatMessage({
                    courseId,
                    role: "user",
                    content: lastPart.text,
                  });
                } catch (error) {
                  console.error("Failed to save message:", error);
                }
              }
            }
          }
          
          // Update counter for user messages only
          prevMessagesLengthRef.current += userMessages.length;
          lastProcessedLengthRef.current = currentLength;
        } finally {
          isSavingRef.current = false;
        }
      };
      
      saveUserMessages();
      return; // Exit early - don't process assistant messages during streaming
    }
    
    // When NOT streaming (status is "ready"), process all new messages
    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    // Mark this length as being processed
    lastProcessedLengthRef.current = currentLength;
    
    const saveAllMessages = async () => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      
      try {
        for (const message of newMessages) {
          const lastPart = message.parts[message.parts.length - 1];
          
          if (lastPart?.type === "text" && message.role) {
            const messageKey = `${message.role}-${lastPart.text}`;
            
            if (!savedMessageIdsRef.current.has(messageKey)) {
              savedMessageIdsRef.current.add(messageKey);
              
              try {
                await saveChatMessage({
                  courseId,
                  role: message.role as "user" | "assistant",
                  content: lastPart.text,
                });
              } catch (error) {
                console.error("Failed to save message:", error);
              }
            }
          }
        }

        // Update the counter when complete
        prevMessagesLengthRef.current = currentLength;
      } finally {
        isSavingRef.current = false;
      }
    };
    
    // Save immediately when ready (not streaming)
    saveAllMessages();
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
      currentGenerateModeRef.current = generateMode;
    } else {
      currentGenerateModeRef.current = null;
    }
    
    if (generateMode) {
      onModeChange(null);
    }

    sendMessage({ text: messageToSend });
    setInput("");
  };

  const handleModeSelect = useCallback((mode: GenerateMode) => {
    if (!mode || isProcessing || modeSelectInProgressRef.current) return;
    
    modeSelectInProgressRef.current = true;
    
    // Set the mode in ref first (before any state updates)
    currentGenerateModeRef.current = mode;
    
    // Automatically send a message to generate the content
    const autoPrompt = AUTO_GENERATE_PROMPTS[mode];
    
    // Send the message immediately - the fetch interceptor will read from the ref
    sendMessage({ text: autoPrompt });
    
    // Update parent state after a brief delay to avoid immediate re-render
    setTimeout(() => {
      onModeChange(mode);
      
      // Clear the mode after fetch has captured it
      setTimeout(() => {
        currentGenerateModeRef.current = null;
        onModeChange(null);
        modeSelectInProgressRef.current = false;
      }, 1500); // Increased delay to ensure fetch has completed
    }, 100);
  }, [isProcessing, sendMessage, onModeChange]);

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
                    <p className="text-sm text-destructive">
                      {error?.message || "Something went wrong while generating the response. This might be due to a timeout or network issue. Please try again."}
                    </p>
                    {error && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Retry the last message if possible
                          const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0];
                          if (lastUserMessage) {
                            const lastPart = lastUserMessage.parts[lastUserMessage.parts.length - 1];
                            if (lastPart?.type === "text") {
                              sendMessage({ text: lastPart.text });
                            }
                          }
                        }}
                        className="mt-2 text-xs h-7"
                      >
                        Retry
                      </Button>
                    )}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isProcessing}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex-shrink-0 border-2"
                title="Generate content"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {GENERATE_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <DropdownMenuItem
                    key={mode.id}
                    onClick={() => handleModeSelect(mode.id)}
                    className="gap-2"
                    disabled={isProcessing}
                  >
                    <Icon className="h-4 w-4" />
                    {mode.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
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

