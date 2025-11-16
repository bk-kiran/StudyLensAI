"use client";

import { useState } from "react";
import { CoursesList } from "./courses-list";
import { CourseFilesView } from "./course-files-view";

export type Course = {
  id: string;
  name: string;
  description: string;
  fileCount: number;
};

export type CourseFile = {
  id: string;
  name: string;
  courseId: string;
  uploadDate: string;
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