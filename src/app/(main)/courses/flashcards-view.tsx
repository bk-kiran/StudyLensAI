"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Sparkles, RotateCw, Trash2, Check, X, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FlashcardsViewProps {
  courseId: Id<"courses">;
}

type FilterType = "all" | "easy" | "medium" | "hard";

export function FlashcardsView({ courseId }: FlashcardsViewProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewAll, setReviewAll] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const flashcards = useQuery(
    api.flashcards.getFlashcards, 
    { courseId, includeReviewed: reviewAll }
  );
  const reviewFlashcard = useMutation(api.flashcards.reviewFlashcard);
  const deleteFlashcard = useMutation(api.flashcards.deleteFlashcard);
  const generateFlashcards = useAction(api.flashcards.generateFlashcards);
  const saveFlashcards = useMutation(api.flashcards.saveFlashcards);

  // Filter out empty flashcards and apply difficulty filter
  // Difficulty is based on lastReviewQuality: 5=easy, 3=medium, 1=hard
  const validFlashcards = flashcards?.filter((f) => {
    if (!f.question?.trim() || !f.answer?.trim()) return false;
    
    // Apply difficulty filter based on last review quality
    // If no review yet, only show in "all" filter
    if (filter === "all") return true;
    if (!f.lastReviewQuality) return false; // No review yet, only show in "all"
    
    // Map review quality to difficulty: 5=easy, 4=easy, 3=medium, 2=hard, 1=hard
    if (filter === "easy" && f.lastReviewQuality >= 4) return true;
    if (filter === "medium" && f.lastReviewQuality === 3) return true;
    if (filter === "hard" && f.lastReviewQuality <= 2) return true;
    
    return false;
  }) || [];
  
  // Ensure currentIndex is within bounds
  const safeIndex = validFlashcards.length > 0 
    ? Math.min(currentIndex, Math.max(0, validFlashcards.length - 1))
    : 0;
  const currentFlashcard = validFlashcards.length > 0 ? validFlashcards[safeIndex] : null;
  
  // Update index if it's out of bounds
  useEffect(() => {
    if (validFlashcards.length > 0 && currentIndex >= validFlashcards.length) {
      setCurrentIndex(Math.max(0, validFlashcards.length - 1));
    } else if (validFlashcards.length > 0 && currentIndex < 0) {
      setCurrentIndex(0);
    }
  }, [validFlashcards.length, currentIndex]);

  const handleGenerate = async () => {
    if (!topic.trim() && count < 1) {
      toast.error("Please enter a topic or set a count");
      return;
    }

    setGenerating(true);
    try {
      const generated = await generateFlashcards({
        courseId,
        topic: topic.trim() || undefined,
        count,
      });

      if (generated.length === 0) {
        toast.error("No flashcards could be generated");
        return;
      }

      await saveFlashcards({
        courseId,
        flashcards: generated,
      });

      toast.success(`Generated ${generated.length} flashcards!`);
      setDialogOpen(false);
      setTopic("");
      setCount(10);
      setIsFlipped(false);
      setCurrentIndex(0);
      
      // Convex queries are reactive and will automatically update
      // Reset index in case new flashcards appear
      setTimeout(() => {
        setCurrentIndex(0);
      }, 500);
    } catch (error) {
      console.error("Generate error:", error);
      toast.error("Failed to generate flashcards");
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async (quality: number) => {
    if (!currentFlashcard) return;

    try {
      await reviewFlashcard({
        flashcardId: currentFlashcard._id,
        quality,
      });

      // Move to next flashcard or reset
      const currentSafeIndex = validFlashcards.length > 0 
        ? Math.min(currentIndex, Math.max(0, validFlashcards.length - 1))
        : 0;
      const nextIndex = currentSafeIndex + 1;
      if (nextIndex < validFlashcards.length) {
        setCurrentIndex(nextIndex);
        setIsFlipped(false);
      } else {
        // All flashcards reviewed, reset
        setCurrentIndex(0);
        setIsFlipped(false);
        toast.success("All flashcards reviewed! Great job!");
      }
    } catch (error) {
      console.error("Review error:", error);
      toast.error("Failed to save review");
    }
  };

  const handleDelete = async (flashcardId: Id<"flashcards">) => {
    try {
      await deleteFlashcard({ flashcardId });
      toast.success("Flashcard deleted");
      // Adjust index if needed
      const currentSafeIndex = validFlashcards.length > 0 
        ? Math.min(currentIndex, Math.max(0, validFlashcards.length - 1))
        : 0;
      if (currentSafeIndex >= validFlashcards.length - 1 && currentSafeIndex > 0) {
        setCurrentIndex(currentSafeIndex - 1);
      } else if (validFlashcards.length === 1) {
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete flashcard");
    }
  };

  if (flashcards === undefined) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (validFlashcards.length === 0) {
    const hasFlashcards = flashcards && flashcards.length > 0;
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {hasFlashcards 
            ? `No ${filter !== "all" ? filter : ""} flashcards ${reviewAll ? "available" : "due for review"}`
            : "No flashcards to review"}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
          {hasFlashcards && filter !== "all"
            ? `Try selecting a different filter or enable "Review All" to see all flashcards.`
            : "Generate flashcards from your course materials to start practicing with spaced repetition."}
        </p>
        {hasFlashcards && (filter !== "all" || !reviewAll) && (
          <div className="flex gap-2">
            {filter !== "all" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFilter("all")}
              >
                Show All
              </Button>
            )}
            {!reviewAll && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewAll(true)}
              >
                Review All
              </Button>
            )}
          </div>
        )}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Flashcards
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Flashcards</DialogTitle>
              <DialogDescription>
                Create flashcards from your course materials using AI. You can specify a topic or generate general flashcards.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="topic">Topic (optional)</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., SQL basics, Economics principles"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="count">Number of flashcards</Label>
                <Input
                  id="count"
                  type="number"
                  min="1"
                  max="50"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Flashcards
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Flashcards</h2>
            <p className="text-sm text-muted-foreground">
              {validFlashcards.length > 0 ? (Math.min(currentIndex, validFlashcards.length - 1) + 1) : 0} of {validFlashcards.length} {reviewAll ? "total" : "due for review"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={reviewAll ? "default" : "outline"}
              onClick={() => {
                setReviewAll(!reviewAll);
                setCurrentIndex(0);
              }}
            >
              Review All
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate More
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Flashcards</DialogTitle>
                  <DialogDescription>
                    Create flashcards from your course materials using AI.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="topic">Topic (optional)</Label>
                    <Input
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., SQL basics, Economics principles"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="count">Number of flashcards</Label>
                    <Input
                      id="count"
                      type="number"
                      min="1"
                      max="50"
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Flashcards
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Filter buttons */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-muted-foreground mr-1">Filter:</span>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => {
              setFilter("all");
              setCurrentIndex(0);
            }}
            className="h-8 text-xs px-3"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "easy" ? "default" : "outline"}
            onClick={() => {
              setFilter("easy");
              setCurrentIndex(0);
            }}
            className="h-8 text-xs px-3"
          >
            Easy
          </Button>
          <Button
            size="sm"
            variant={filter === "medium" ? "default" : "outline"}
            onClick={() => {
              setFilter("medium");
              setCurrentIndex(0);
            }}
            className="h-8 text-xs px-3"
          >
            Medium
          </Button>
          <Button
            size="sm"
            variant={filter === "hard" ? "default" : "outline"}
            onClick={() => {
              setFilter("hard");
              setCurrentIndex(0);
            }}
            className="h-8 text-xs px-3"
          >
            Hard
          </Button>
        </div>
        
        {currentFlashcard && (
          <div className="flex items-center gap-3 text-xs mb-4">
            {currentFlashcard.lastReviewQuality ? (
              <span className={`px-2.5 py-1 rounded-md font-medium ${
                currentFlashcard.lastReviewQuality >= 4
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : currentFlashcard.lastReviewQuality === 3
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {currentFlashcard.lastReviewQuality >= 4 ? "Easy" : currentFlashcard.lastReviewQuality === 3 ? "Medium" : "Hard"}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                Not Reviewed
              </span>
            )}
            <span className="text-muted-foreground">
              {currentFlashcard.repetitions} reviews
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <Card
          className="w-full max-w-2xl h-[400px] cursor-pointer relative overflow-hidden"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {!isFlipped ? (
            <div className="absolute inset-0 p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Question</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentFlashcard) {
                      handleDelete(currentFlashcard._id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex-1 flex items-center justify-center px-4">
                <p className="text-xl font-medium text-center leading-relaxed">{currentFlashcard?.question}</p>
              </div>
              <div className="text-center text-sm text-muted-foreground mt-6">
                Click to reveal answer
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Answer</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                  }}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 flex items-center justify-center px-4">
                <p className="text-lg text-center leading-relaxed">{currentFlashcard?.answer}</p>
              </div>
              <div className="flex gap-4 justify-center pt-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview(1); // Hard
                  }}
                  className="gap-2 px-5"
                >
                  <X className="h-4 w-4 text-red-500" />
                  Hard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview(3); // Medium
                  }}
                  className="gap-2 px-5"
                >
                  Medium
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview(5); // Easy
                  }}
                  className="gap-2 px-5"
                >
                  <Check className="h-4 w-4 text-green-500" />
                  Easy
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

