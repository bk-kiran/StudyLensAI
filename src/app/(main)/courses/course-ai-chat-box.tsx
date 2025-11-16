"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseAIChatBoxProps {
  open: boolean;
  onClose: () => void;
  courseName: string;
}

export function CourseAIChatBox({
  open,
  onClose,
  courseName,
}: CourseAIChatBoxProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "animate-in slide-in-from-bottom-10 bg-card fixed right-4 bottom-4 z-50 flex flex-col rounded-lg border shadow-lg duration-300",
        "h-[500px] max-h-[80vh] w-80 sm:w-96"
      )}
    >
      <div className="bg-primary text-primary-foreground flex items-center justify-between rounded-t-lg border-b p-3">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <h3 className="font-medium">{courseName} Assistant</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-primary-foreground hover:bg-primary/90 h-8 w-8"
        >
          <span className="text-xl">×</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm text-muted-foreground text-center py-8">
          AI chat will be connected to PDFs in this course.
          <br />
          (Backend implementation pending)
        </div>
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input placeholder="Ask about your course materials..." />
          <Button size="icon">
            <span className="text-lg">→</span>
          </Button>
        </div>
      </div>
    </div>
  );
}