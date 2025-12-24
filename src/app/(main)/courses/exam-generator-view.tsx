"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { FileQuestion, Loader2, Download, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExamGeneratorViewProps {
  courseId: Id<"courses">;
}

export function ExamGeneratorView({ courseId }: ExamGeneratorViewProps) {
  const [questionCount, setQuestionCount] = useState(15);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [generating, setGenerating] = useState(false);
  const [viewingWorkflowId, setViewingWorkflowId] = useState<Id<"examWorkflows"> | null>(null);

  const workflows = useQuery(api.examGenerator.getWorkflowsByCourse, { courseId });
  const generateExam = useAction(api.examGenerator.generatePracticeExam);
  const exportExam = useAction(api.examGenerator.exportExamAsPDF);
  const deleteWorkflow = useMutation(api.examGenerator.deleteWorkflow);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const workflowId = await generateExam({
        courseId,
        questionCount,
        difficulty,
      });
      toast.success("Exam generation started! This may take a few moments.");
    } catch (error) {
      console.error("Generate error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate exam");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (workflowId: Id<"examWorkflows">) => {
    try {
      const html = await exportExam({ workflowId });
      
      // Create a blob and download
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `practice-exam-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Exam exported! Open the HTML file and print to PDF.");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export exam");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "analyzing":
        return "Analyzing course materials...";
      case "identifying_topics":
        return "Identifying key topics...";
      case "generating_questions":
        return "Generating questions...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  const handleDelete = async (workflowId: Id<"examWorkflows">) => {
    if (!confirm("Are you sure you want to delete this practice exam? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteWorkflow({ workflowId });
      toast.success("Practice exam deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete practice exam");
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Practice Exam Generator</h2>
        <p className="text-sm text-muted-foreground">
          Generate practice exams from your course materials using AI. The system will analyze your content, identify key topics, and create exam questions.
        </p>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-4">Generate New Exam</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="questionCount">Number of Questions</Label>
              <Input
                id="questionCount"
                type="number"
                min="5"
                max="50"
                value={questionCount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setQuestionCount(15);
                  } else {
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 5 && num <= 50) {
                      setQuestionCount(num);
                    }
                  }
                }}
                className="mt-1"
              />
          </div>
          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="mixed">Mixed (Recommended)</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Exam...
              </>
            ) : (
              <>
                <FileQuestion className="h-4 w-4 mr-2" />
                Generate Practice Exam
              </>
            )}
          </Button>
        </div>
      </Card>

      {workflows && workflows.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4">Generated Exams</h3>
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <Card 
                key={workflow._id} 
                className={`p-4 ${workflow.status === "completed" ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                onClick={() => workflow.status === "completed" && setViewingWorkflowId(workflow._id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(workflow.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {workflow.questions?.length || 0} Questions
                        </p>
                        {workflow.difficulty && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            workflow.difficulty === "easy"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : workflow.difficulty === "medium"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : workflow.difficulty === "hard"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {workflow.difficulty.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getStatusText(workflow.status)} • {new Date(workflow.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {workflow.status === "completed" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingWorkflowId(workflow._id)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExport(workflow._id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(workflow._id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {workflow.identifiedTopics && workflow.identifiedTopics.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Topics:</p>
                    <div className="flex flex-wrap gap-1">
                      {workflow.identifiedTopics.slice(0, 5).map((topic, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-muted rounded-md"
                        >
                          {topic}
                        </span>
                      ))}
                      {workflow.identifiedTopics.length > 5 && (
                        <span className="text-xs px-2 py-1 text-muted-foreground">
                          +{workflow.identifiedTopics.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Quiz Viewer */}
      {viewingWorkflowId && (
        <QuizViewer
          workflowId={viewingWorkflowId}
          onClose={() => setViewingWorkflowId(null)}
        />
      )}
    </div>
  );
}

// Quiz Viewer Component
function QuizViewer({ 
  workflowId, 
  onClose 
}: { 
  workflowId: Id<"examWorkflows">; 
  onClose: () => void;
}) {
  const workflow = useQuery(api.examGenerator.getWorkflow, { workflowId });
  const [showAnswers, setShowAnswers] = useState(false);

  if (!workflow || workflow.status !== "completed" || !workflow.questions) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b p-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Practice Exam</h2>
            <p className="text-sm text-muted-foreground">
              {workflow.questions.length} Questions • Generated {new Date(workflow.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAnswers(!showAnswers)}
            >
              {showAnswers ? "Hide" : "Show"} Answers
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {workflow.questions.map((q, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Question {idx + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      q.difficulty === "easy" 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : q.difficulty === "medium"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {q.difficulty.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="mb-4 text-base">{q.question}</p>
                
                {q.type === "multiple_choice" && q.options && (
                  <ol className="list-[upper-alpha] list-inside space-y-2 mb-4 ml-4">
                    {q.options.map((opt, optIdx) => (
                      <li key={optIdx} className="text-sm">{opt}</li>
                    ))}
                  </ol>
                )}
                
                {showAnswers && (
                  <div className="mt-4 p-3 bg-muted rounded-lg border-l-4 border-primary">
                    <p className="font-semibold text-sm mb-1">Answer:</p>
                    <p className="text-sm mb-2">{q.correctAnswer}</p>
                    {q.explanation && (
                      <>
                        <p className="font-semibold text-sm mb-1">Explanation:</p>
                        <p className="text-sm text-muted-foreground">{q.explanation}</p>
                      </>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

