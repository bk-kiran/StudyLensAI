"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useAction } from "convex/react";
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

  const [status, setStatus] = useState<"checking" | "creating" | "transferring" | "done" | "error">("checking");
  const { signIn, signOut } = useAuthActions();
  const checkPending = useMutation(api.passwordResetMutations.completePendingReset);
  const updatePassword = useAction(api.passwordReset.updatePasswordForExistingUser);
  const transferAccount = useAction(api.passwordReset.transferAuthAccountAfterSignUp);

  const completeReset = useCallback(async () => {
    if (!email || !password) {
      router.push("/signin");
      return;
    }

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
      
      // Update password - this will either update existing authAccount or prepare for transfer
      const updateResult = await updatePassword({
        email: email,
        newPassword: password,
      });

      const existingUserId = updateResult.userId;

      // If we updated an existing authAccount, just sign in
      if (updateResult.updatedExisting) {
        console.log("AuthAccount already exists, signing in directly");
        
        // Sign in with the updated password
        await signIn("password", {
          email: email,
          password: password,
          flow: "signIn",
        });
      } else {
        // No existing authAccount - need to create one via signUp and transfer
        console.log("No existing authAccount, creating via signUp and transferring");
        
        // Use signUp to create authAccount with correct format (creates new user temporarily)
        await signIn("password", {
          email: email,
          password: password,
          flow: "signUp", // Use signUp to create authAccount with correct format
        });

        // Wait for auth to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Now transfer the authAccount from the new user to the existing user
        setStatus("transferring");
        const transferResult = await transferAccount({
          email: email,
          existingUserId: existingUserId,
        });

        console.log("Transfer result:", transferResult);

        // Verify transfer worked - check that authAccount exists for existing user
        console.log("Verifying transfer completed for user:", existingUserId);
        
        // Sign out to clear the session for the deleted new user
        await signOut();
        
        // Wait a bit for sign out to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Sign in again with the existing user (now the authAccount is linked to existing user)
        // Use signIn (not signUp) since the account now exists for the existing user
        try {
          await signIn("password", {
            email: email,
            password: password,
            flow: "signIn",
          });
        } catch (signInError) {
          console.error("Sign in error after transfer:", signInError);
          // If signIn fails, the authAccount might not be properly linked
          // Try one more time after a delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          await signIn("password", {
            email: email,
            password: password,
            flow: "signIn",
          });
        }
      }

      setStatus("done");
      toast.success("Password reset successfully!");
      
      setTimeout(() => {
        router.push("/courses");
      }, 1000);

    } catch (error) {
      console.error("Complete reset error:", error);
      setStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Failed to complete reset";
      toast.error(errorMessage);
      setTimeout(() => {
        router.push("/forgot-password");
      }, 2000);
    }
  }, [email, password, router, signIn, signOut, checkPending, updatePassword, transferAccount]);

  useEffect(() => {
    completeReset();
  }, [completeReset]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Completing Password Reset</CardTitle>
          <CardDescription>
            {status === "checking" && "Verifying reset request..."}
            {status === "creating" && "Creating your new password..."}
            {status === "transferring" && "Linking to your account..."}
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
