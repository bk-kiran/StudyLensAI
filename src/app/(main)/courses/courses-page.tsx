"use client";

import { useState } from "react";
import { CoursesList } from "./courses-list";
import { CourseFilesView } from "./course-files-view";
import { Id } from "../../../../convex/_generated/dataModel";

export type Course = {
  _id: Id<"courses">;
  name: string;
  description: string;
  fileCount: number;
  userId: string;
  createdAt: number;
  emoji?: string;
  color?: string;
};

export type CourseFile = {
  _id: Id<"files">;
  name: string;
  courseId: Id<"courses">;
  uploadDate: number;
  userId: string;
  storageId: Id<"_storage">;
};

export function CoursesPage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  if (!selectedCourse) {
    return <CoursesList onSelectCourse={setSelectedCourse} />;
  }

  return (
    <CourseFilesView
      course={selectedCourse}
      onBack={() => setSelectedCourse(null)}
    />
  );
}