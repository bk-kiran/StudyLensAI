"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function CompleteResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const password = searchParams.get("password");

  const [status, setStatus] = useState<"checking" | "creating" | "done" | "error">("checking");
  const { signIn } = useAuthActions();
  const checkPending = useMutation(api.passwordResetMutations.completePendingReset);
  const clearPending = useMutation(api.passwordResetMutations.clearPendingReset);

  useEffect(() => {
    if (!email || !password) {
      router.push("/signin");
      return;
    }

    const completeReset = async () => {
      try {
        setStatus("checking");
        
        // Check if there's a pending reset
        const result = await checkPending({ email });
        
        if (!result.hasPending) {
          toast.error("Reset session expired. Please try again.");
          router.push("/forgot-password");
          return;
        }

        setStatus("creating");
        
        // Now create the auth with sign-up
        await signIn("password", {
          email: email,
          password: password,
          flow: "signUp",
        });

        // Clear the pending reset
        await clearPending({ email });

        setStatus("done");
        toast.success("Password reset successfully!");
        
        setTimeout(() => {
          router.push("/courses");
        }, 1000);

      } catch (error: any) {
        console.error("Complete reset error:", error);
        
        // If account exists, auth was created, clear pending and sign in
        if (error.message?.includes("already exists") || error.message?.includes("Account")) {
          try {
            await clearPending({ email });
            
            await signIn("password", {
              email: email,
              password: password,
              flow: "signIn",
            });

            setStatus("done");
            toast.success("Password reset successfully!");
            
            setTimeout(() => {
              router.push("/courses");
            }, 1000);

          } catch (signInError: any) {
            console.error("Sign in error:", signInError);
            setStatus("error");
            toast.error("Please sign in manually with your new password.");
            setTimeout(() => {
              router.push(`/signin?email=${encodeURIComponent(email)}`);
            }, 2000);
          }
        } else {
          setStatus("error");
          toast.error(error.message || "Failed to complete reset");
          setTimeout(() => {
            router.push("/forgot-password");
          }, 2000);
        }
      }
    };

    completeReset();
  }, [email, password, router, signIn, checkPending, clearPending]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Completing Password Reset</CardTitle>
          <CardDescription>
            {status === "checking" && "Verifying reset request..."}
            {status === "creating" && "Creating your new password..."}
            {status === "done" && "Success! Redirecting..."}
            {status === "error" && "Something went wrong..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      </Card>
    </div>
  );
}
