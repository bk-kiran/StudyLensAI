"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, FileText, Trash2, Bot } from "lucide-react";
import { Course } from "./courses-page";
import { UploadFileDialog } from "./upload-file-dialog";
import { CourseAIChatBox } from "./course-ai-chat-box";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface CourseFilesViewProps {
  course: Course;
  onBack: () => void;
}

export function CourseFilesView({ course, onBack }: CourseFilesViewProps) {
  const files = useQuery(api.files.getFilesByCourse, { courseId: course._id as any });
  const deleteFile = useMutation(api.files.deleteFile);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

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

  return (
    <div className="container xl:max-w-6xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Courses
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">{course.name}</h1>
            <p className="text-muted-foreground">{course.description}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setChatOpen(true)} variant="outline">
              <Bot />
              <span>Ask AI</span>
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload />
              Upload PDF
            </Button>
          </div>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            No files uploaded yet. Upload your first PDF!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {files.map((file) => (
            <Card key={file._id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-start gap-2">
                  <FileText className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                  <span className="flex-1 break-words text-base">
                    {file.name}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(file.uploadDate)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(file._id)}
                    className="h-8 w-8"
                    disabled={deletingId === file._id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UploadFileDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        courseName={course.name}
        courseId={course._id as any}
      />

      <CourseAIChatBox
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        courseName={course.name}
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
  return (
    <div className="container xl:max-w-6xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Courses
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">{course.name}</h1>
            <p className="text-muted-foreground">{course.description}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}