"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { Course } from "./courses-page";

interface EditCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
}

export function EditCourseDialog({
  open,
  onOpenChange,
  course,
}: EditCourseDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const updateCourse = useMutation(api.courses.updateCourse);

  // Update form fields when course changes
  useEffect(() => {
    if (course) {
      setName(course.name);
      setDescription(course.description || "");
    }
  }, [course]);

  const handleSubmit = async () => {
    if (!name.trim() || !course) return;

    setIsLoading(true);
    try {
      await updateCourse({
        id: course._id as any,
        name: name.trim(),
        description: description.trim(),
      });
      toast.success("Course updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Update course error:", error);
      toast.error("Failed to update course");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>
            Update the course name and description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Course Name
            </label>
            <Input
              placeholder="e.g., Computer Science 250"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Description
            </label>
            <Textarea
              placeholder="Brief description of the course"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
            {isLoading ? "Updating..." : "Update Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
