"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, FileText, Trash2, Bot } from "lucide-react";
import { Course, CourseFile } from "./courses-page";
import { UploadFileDialog } from "./upload-file-dialog";
import { CourseAIChatBox } from "./course-ai-chat-box";

// Mock data - replace with actual data fetching
const mockFiles: CourseFile[] = [
  {
    id: "1",
    name: "Lecture_1_Introduction.pdf",
    courseId: "1",
    uploadDate: "2024-01-15",
  },
  {
    id: "2",
    name: "Practice_Exam_1.pdf",
    courseId: "1",
    uploadDate: "2024-01-20",
  },
  {
    id: "3",
    name: "Chapter_3_Notes.pdf",
    courseId: "2",
    uploadDate: "2024-01-18",
  },
];

interface CourseFilesViewProps {
  course: Course;
  onBack: () => void;
}

export function CourseFilesView({ course, onBack }: CourseFilesViewProps) {
  const [files, setFiles] = useState<CourseFile[]>(
    mockFiles.filter((f) => f.courseId === course.id)
  );
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleUploadFile = (file: File) => {
    const newFile: CourseFile = {
      id: Date.now().toString(),
      name: file.name,
      courseId: course.id,
      uploadDate: new Date().toISOString().split("T")[0],
    };
    setFiles([...files, newFile]);
    setUploadDialogOpen(false);
  };

  const handleDeleteFile = (fileId: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      setFiles(files.filter((f) => f.id !== fileId));
    }
  };

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
            <Card key={file.id} className="hover:shadow-md transition-shadow">
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
                    Uploaded: {file.uploadDate}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFile(file.id)}
                    className="h-8 w-8"
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
        onUploadFile={handleUploadFile}
      />

      <CourseAIChatBox
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        courseName={course.name}
      />
    </div>
  );
}