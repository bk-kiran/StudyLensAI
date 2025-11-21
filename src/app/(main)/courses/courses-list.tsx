"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Trash2, BookOpen, ArrowRight } from "lucide-react";
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

  // If courses is null (error case), show empty state
  if (courses === null) {
    return (
      <div className="container xl:max-w-6xl mx-auto">
        <div className="text-center py-10">
          <p className="text-muted-foreground">
            Unable to load courses. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container xl:max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            My Courses
          </h1>
          <p className="text-muted-foreground">
            Organize and manage your coursework
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Create Course
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-primary/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Get started by creating your first course. Organize your studies and upload materials to begin learning with AI.
          </p>
          <Button onClick={() => setCreateDialogOpen(true)} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Create Your First Course
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const courseColor = course.color || "#3b82f6";
            const courseEmoji = course.emoji || "📚";
            
            return (
              <Card
                key={course._id}
                className="cursor-pointer group hover:shadow-xl transition-all duration-300 border-2 overflow-hidden relative"
                style={{
                  borderColor: course.color ? `${courseColor}40` : undefined,
                }}
                onClick={() => onSelectCourse(course as Course)}
              >
                {/* Gradient accent */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(to right, ${courseColor}, ${courseColor}80, transparent)`,
                  }}
                />
                
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">{courseEmoji}</span>
                      <span className="text-lg font-semibold transition-colors line-clamp-1 group-hover:opacity-80">
                        {course.name}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleEditClick(course as Course, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10"
                        onClick={(e) => handleDeleteClick(course._id, e)}
                        disabled={deletingId === course._id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {course.description || "No description provided"}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">
                        {course.fileCount} file{course.fileCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
