"use client";

import { useState } from "react";
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
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";
import { extractTextFromPDF } from "@/lib/pdfParser";

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseName: string;
  courseId: Id<"courses">;
}

export function UploadFileDialog({
  open,
  onOpenChange,
  courseName,
  courseId,
}: UploadFileDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFile = useAction(api.fileActions.createFile);

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // 1. Get upload URL
      const uploadUrl = await generateUploadUrl();

      // 2. Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      const { storageId } = await result.json();

      // 3. Extract text from PDF for embeddings
      const extractedText = await extractTextFromPDF(selectedFile);

      // 4. Atomically create file (metadata) and embeddings in Convex
      await createFile({
        name: selectedFile.name,
        courseId,
        storageId,
        fileContent: extractedText,
      });

      toast.success("File uploaded and embeddings are being processed!");
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload PDF</DialogTitle>
          <DialogDescription>
            Upload a PDF file to {courseName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Select PDF File
            </label>
            <Input
              type="file"
              accept=".pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              disabled={isUploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedFile || isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
