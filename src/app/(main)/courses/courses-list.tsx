"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Trash2 } from "lucide-react";
import { CreateCourseDialog } from "./create-course-dialog";
import { Course } from "./courses-page";

// Mock data - replace with actual data fetching
const initialCourses: Course[] = [
  {
    id: "1",
    name: "Computer Science 101",
    description: "Introduction to Programming",
    fileCount: 5,
  },
  {
    id: "2",
    name: "Mathematics 201",
    description: "Calculus II",
    fileCount: 3,
  },
];

interface CoursesListProps {
  onSelectCourse: (course: Course) => void;
}

export function CoursesList({ onSelectCourse }: CoursesListProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleCreateCourse = (name: string, description: string) => {
    const newCourse: Course = {
      id: Date.now().toString(),
      name,
      description,
      fileCount: 0,
    };
    setCourses([...courses, newCourse]);
    setCreateDialogOpen(false);
  };

  const handleDeleteCourse = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(
        "Are you sure you want to delete this course? All files will be removed."
      )
    ) {
      setCourses(courses.filter((c) => c.id !== courseId));
    }
  };

  return (
    <div className="container xl:max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus />
          Create Course
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">
            No courses yet. Create your first course!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectCourse(course)}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="flex-1">{course.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 -mt-1"
                    onClick={(e) => handleDeleteCourse(course.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {course.description || "No description"}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>
                    {course.fileCount} file{course.fileCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCourseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateCourse={handleCreateCourse}
      />
    </div>
  );
}