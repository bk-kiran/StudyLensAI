"use client";

import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthFormValues, signinSchema } from "../schema";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";

export function SigninForm() {
  const [step, setStep] = useState<"signIn" | "signUp">("signIn");

  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  
  const createPendingUser = useMutation(api.pendingAuth.createPendingUser);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: AuthFormValues) {
    setIsLoading(true);
    try {
      if (step === "signUp") {
        await createPendingUser({ 
          email: values.email, 
          password: values.password 
        });
        
        toast.success("Please verify your email to complete registration.");
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
        
      } else {
        await signIn("password", {
          ...values,
          flow: "signIn",
        });
        
        toast.success("Successfully signed in!");
        router.push("/courses");
      }
    } catch (error: any) {
      console.error("Sign-in/up error:", error);
      
      // Handle specific error messages
      const errorMessage = error?.message || error?.toString() || "";
      
      if (errorMessage.includes("An account with this email already exists")) {
        form.setError("email", {
          type: "manual",
          message: "This email is already registered. Please sign in instead.",
        });
        toast.error("This email is already registered.");
      } else if (
        error instanceof Error &&
        (errorMessage.includes("InvalidAccountId") ||
          errorMessage.includes("InvalidSecret"))
      ) {
        form.setError("root", {
          type: "manual",
          message: "Invalid credentials. Please try again.",
        });
      } else if (errorMessage.includes("verify")) {
        toast.error("Please verify your email before signing in.");
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
      } else {
        // Generic error
        form.setError("root", {
          type: "manual",
          message: errorMessage || "An unexpected error occurred. Please try again.",
        });
        toast.error(errorMessage || "An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/50">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-lg shadow-lg">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-card-foreground">
            {step === "signIn" ? "Login" : "Create Account"}
          </h1>
          <p className="text-muted-foreground">
            {step === "signIn"
              ? "Enter your credentials to access your account."
              : "Enter your details to create a new account."}
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="you@example.com"
                      {...field}
                      type="email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    {step === "signIn" && (
                      <Link 
                        href="/forgot-password" 
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <FormControl>
                    <PasswordInput placeholder="Password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Confirm Password - Only show during sign-up */}
            {step === "signUp" && (
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Confirm Password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {form.formState.errors.root && (
              <div className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Loading..." : step === "signIn" ? "Sign In" : "Sign Up"}
            </Button>
          </form>
        </Form>
        <Button
          variant="link"
          type="button"
          className="w-full text-sm text-muted-foreground cursor-pointer"
          onClick={() => {
            setStep(step === "signIn" ? "signUp" : "signIn");
            form.reset();
          }}
        >
          {step === "signIn"
            ? "Don't have an account? Sign Up"
            : "Already have an account? Sign In"}
        </Button>
      </div>
    </div>
  );
}
