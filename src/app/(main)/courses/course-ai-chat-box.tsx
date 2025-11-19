"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Sparkles } from "lucide-react";

type GenerateMode = "practice-questions" | "summary" | "key-concepts" | "study-guide" | "flashcards" | "explain" | null;

interface CourseAIChatBoxProps {
  courseName: string;
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

export function CourseAIChatBox({
  courseName,
  generateMode,
  onModeChange,
}: CourseAIChatBoxProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage("");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    // If there's a generate mode, add a system prompt
    if (generateMode) {
      const modePrompt = MODE_PROMPTS[generateMode];
      // TODO: Call AI API with the mode prompt and user message
      // For now, just add a placeholder response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I'll help you with ${generateMode.replace("-", " ")}. This feature will be connected to your course PDFs soon.`,
          },
        ]);
        onModeChange(null); // Clear mode after use
      }, 500);
    } else {
      // Regular chat
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I'm here to help you with your course materials. This feature will be connected to your PDFs soon.",
          },
        ]);
      }, 500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
              <h3 className="font-semibold text-base">Hi, I'm your AI Study Assistant</h3>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                {generateMode
                  ? `I'll help you ${GENERATE_MODES.find(m => m.id === generateMode)?.label.toLowerCase()}. Ask me anything about your course materials.`
                  : "Ask me anything about your course materials, or use the Generate button to create study resources."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
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
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-primary">U</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative min-w-0">
            <Input
              placeholder={
                generateMode
                  ? `Ask about ${GENERATE_MODES.find(m => m.id === generateMode)?.label.toLowerCase()}...`
                  : "Type your question here..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full h-auto min-h-[44px] sm:min-h-[48px] py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border-2 focus:border-primary/50 text-sm sm:text-base"
            />
          </div>
          <Button 
            onClick={handleSend} 
            size="icon" 
            disabled={!message.trim()}
            className="h-11 w-11 sm:h-12 sm:w-12 bg-primary hover:bg-primary/90 rounded-xl flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
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