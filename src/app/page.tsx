import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, FileText, Sparkles, Brain, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          {/* Logo with animation */}
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <Image
                src={logo}
                alt="StudyLens AI Logo"
                width={140}
                height={140}
                className="mx-auto relative z-10 drop-shadow-lg"
                priority
              />
            </div>
          </div>

          {/* Title with gradient */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                StudyLens AI
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light">
              Your intelligent study companion. Organize coursework, learn faster, and ace your exams with AI-powered insights.
            </p>
          </div>

          {/* CTA Button */}
          <div className="pt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <Button asChild size="lg" className="text-lg px-8 py-6 h-auto group">
              <Link href="/courses" className="flex items-center gap-2">
                Get Started
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-16 border-t animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <div className="group p-6 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Organize Courses</h3>
              <p className="text-sm text-muted-foreground">
                Keep all your coursework organized in one place with smart categorization
              </p>
            </div>

            <div className="group p-6 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">PDF Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Upload PDFs and let AI extract key information and insights
              </p>
            </div>

            <div className="group p-6 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Assistant</h3>
              <p className="text-sm text-muted-foreground">
                Get instant answers and explanations from your course materials
              </p>
            </div>
          </div>

          {/* Built with section */}
          <div className="pt-12 text-sm text-muted-foreground animate-in fade-in duration-700 delay-700">
            <p className="flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" />
              Powered by Convex, OpenAI and Vercel AI SDK
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} StudyLens AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
