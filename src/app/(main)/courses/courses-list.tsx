"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Trash2 } from "lucide-react";
import { CreateCourseDialog } from "./create-course-dialog";
import { Course } from "./courses-page";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pencil } from "lucide-react";
import { EditCourseDialog } from "./edit-course-dialog";

interface CoursesListProps {
  onSelectCourse: (course: Course) => void;
}

export function CoursesList({ onSelectCourse }: CoursesListProps) {
  const courses = useQuery(api.courses.getCourses);
  const deleteCourse = useMutation(api.courses.deleteCourse);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);

  const handleDeleteClick = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCourseToDelete(courseId);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;

    setDeletingId(courseToDelete);
    setConfirmDeleteOpen(false);
    
    try {
      await deleteCourse({ id: courseToDelete as any });
      toast.success("Course deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete course");
    } finally {
      setDeletingId(null);
      setCourseToDelete(null);
    }
  };

  const handleEditClick = (course: Course, e: React.MouseEvent) => {
    e.stopPropagation();
    setCourseToEdit(course);
    setEditDialogOpen(true);
  };


  if (courses === undefined) {
    return <LoadingSkeleton />;
  }

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
              key={course._id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectCourse(course as Course)}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="flex-1">{course.name}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mt-1"
                      onClick={(e) => handleEditClick(course as Course, e)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mt-1"
                      onClick={(e) => handleDeleteClick(course._id, e)}
                      disabled={deletingId === course._id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
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
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Course"
        description="Are you sure you want to delete this course? All files will be permanently removed. This action cannot be undone."
        confirmText="Delete Course"
        cancelText="Cancel"
        destructive={true}
      />

      <EditCourseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        course={courseToEdit}
      />
    </div>
  );
}



function LoadingSkeleton() {
  return (
    <div className="container xl:max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}