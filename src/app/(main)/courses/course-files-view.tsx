"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, FileText, Trash2, Bot, ChevronDown, Sparkles, BookOpen, HelpCircle, Lightbulb, ListChecks, FileQuestion, ChevronLeft, ChevronRight } from "lucide-react";
import { Course } from "./courses-page";
import { UploadFileDialog } from "./upload-file-dialog";
import { CourseAIChatBox } from "./course-ai-chat-box";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CourseFilesViewProps {
  course: Course;
  onBack: () => void;
}

type GenerateMode = "practice-questions" | "summary" | "key-concepts" | "study-guide" | "flashcards" | "explain" | null;

const GENERATE_MODES = [
  { id: "practice-questions" as const, label: "Practice Questions", icon: FileQuestion },
  { id: "summary" as const, label: "Summary", icon: BookOpen },
  { id: "key-concepts" as const, label: "Key Concepts", icon: Lightbulb },
  { id: "study-guide" as const, label: "Study Guide", icon: ListChecks },
  { id: "flashcards" as const, label: "Flashcards", icon: Sparkles },
  { id: "explain" as const, label: "Explain Concept", icon: HelpCircle },
];

export function CourseFilesView({ course, onBack }: CourseFilesViewProps) {
  const files = useQuery(api.files.getFilesByCourse, { courseId: course._id as any });
  const deleteFile = useMutation(api.files.deleteFile);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [generateMode, setGenerateMode] = useState<GenerateMode>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [filesCollapsed, setFilesCollapsed] = useState(true);

  const handleDeleteClick = (fileId: string) => {
    setFileToDelete(fileId);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;

    setDeletingId(fileToDelete);
    setConfirmDeleteOpen(false);

    try {
      await deleteFile({ id: fileToDelete as any });
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    } finally {
      setDeletingId(null);
      setFileToDelete(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (files === undefined) {
    return <LoadingSkeleton onBack={onBack} course={course} />;
  }

  const courseColor = course.color || "#3b82f6";
  const courseEmoji = course.emoji || "📚";

  return (
    <div className="fixed inset-0 flex flex-col bg-background z-50" style={{ height: "100dvh", width: "100vw" }}>
      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex" style={{ minHeight: 0, overflow: "hidden" }}>
        {/* Left Sidebar - Files */}
        {!filesCollapsed && (
          <div className="hidden md:flex w-[280px] overflow-y-auto border-r bg-muted/30 transition-all duration-300 relative flex flex-col flex-shrink-0">
            {/* Sidebar Header */}
            <div className="p-3 sm:p-4 border-b bg-background flex-shrink-0">
              <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xl sm:text-2xl flex-shrink-0">{courseEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <h2 
                        className="font-semibold text-xs sm:text-sm truncate"
                        style={{ color: course.color ? courseColor : undefined }}
                      >
                        {course.name}
                      </h2>
                    </div>
                  </div>
                </div>
                {/* Collapse Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFilesCollapsed(true)}
                  className="h-7 w-7 bg-muted hover:bg-muted/80 flex-shrink-0"
                  title="Hide files"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
              
              <div className="flex gap-1.5 sm:gap-2">
                <Button 
                  onClick={() => setUploadDialogOpen(true)} 
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-8"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                </Button>
              </div>
              
              {generateMode && (
                <div className="mt-2 flex items-center gap-2 p-1.5 bg-primary/10 rounded-md border border-primary/20">
                  <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium flex-1 truncate">
                    {GENERATE_MODES.find(m => m.id === generateMode)?.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 flex-shrink-0"
                    onClick={() => setGenerateMode(null)}
                  >
                    ×
                  </Button>
                </div>
              )}
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto p-2">
              {files.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary/60" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">No files yet</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Upload your first PDF
                  </p>
                  <Button 
                    onClick={() => setUploadDialogOpen(true)} 
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="px-2 py-1.5">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Files ({files.length})
                    </h2>
                  </div>
                  <div className="space-y-0.5">
                    {files.map((file) => (
                      <button
                        key={file._id}
                        className="w-full group"
                        onClick={() => {}}
                      >
                        <div 
                          className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted transition-colors relative group/item"
                        >
                          <div 
                            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{
                              backgroundColor: course.color ? `${courseColor}15` : undefined,
                            }}
                          >
                            <FileText className="h-3 w-3" style={{ color: course.color ? courseColor : undefined }} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-medium line-clamp-1 truncate">
                              {file.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDate(file.uploadDate)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(file._id);
                            }}
                            className="h-6 w-6 hover:bg-destructive/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                            disabled={deletingId === file._id}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Side - AI Panel */}
        <div className="flex-1 flex flex-col relative bg-background min-w-0">
          {/* Top Bar */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {filesCollapsed && (
                  <>
                    {/* Expand sidebar button - with distinct styling */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setFilesCollapsed(false)}
                      className="h-8 w-8 flex-shrink-0"
                      title="Show files"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {/* Back button with text - with different styling */}
                    <Button 
                      variant="ghost" 
                      onClick={onBack} 
                      className="h-8 gap-1.5 px-3 flex-shrink-0 hover:bg-muted"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="text-sm">Back to Courses</span>
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg sm:text-xl flex-shrink-0">{courseEmoji}</span>
                <div className="min-w-0">
                  <h1 
                    className="text-sm sm:text-base font-semibold truncate"
                    style={{ color: course.color ? courseColor : undefined }}
                  >
                    {course.name}
                  </h1>
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">{course.description || "No description"}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {filesCollapsed && (
                <>
                  <Button 
                    onClick={() => setUploadDialogOpen(true)} 
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8 px-2 sm:px-3"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Upload</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-2">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Generate</span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {GENERATE_MODES.map((mode) => {
                        const Icon = mode.icon;
                        return (
                          <DropdownMenuItem
                            key={mode.id}
                            onClick={() => setGenerateMode(mode.id)}
                            className="gap-2"
                          >
                            <Icon className="h-4 w-4" />
                            {mode.label}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* AI Chat Box */}
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            <CourseAIChatBox
              courseName={course.name}
              courseId={course._id}
              generateMode={generateMode}
              onModeChange={setGenerateMode}
            />
          </div>
        </div>
      </div>

      <UploadFileDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        courseName={course.name}
        courseId={course._id as any}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleConfirmDelete}
        title="Delete File"
        description="Are you sure you want to delete this file? This action cannot be undone."
        confirmText="Delete File"
        cancelText="Cancel"
        destructive={true}
      />
    </div>
  );
}

function LoadingSkeleton({
  onBack,
  course,
}: {
  onBack: () => void;
  course: Course;
}) {
  const courseEmoji = course.emoji || "📚";

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[280px] border-r bg-muted/30 p-4">
          <Skeleton className="h-8 w-full mb-4" />
          <Skeleton className="h-6 w-20 mb-2" />
          <div className="space-y-1">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </div>

        {/* Right Side */}
        <div className="flex-1 flex flex-col">
          <div className="border-b px-6 py-3">
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}