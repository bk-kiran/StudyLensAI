"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const verifyCode = useMutation(api.passwordResetMutations.verifyResetCode);
  const completeReset = useAction(api.passwordReset.completePasswordReset);

  useEffect(() => {
    if (!email) {
      router.push("/forgot-password");
    }
  }, [email, router]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length !== 6) return;

    setIsVerifying(true);
    try {
      await verifyCode({ email, code });
      setIsCodeVerified(true);
      toast.success("Code verified! Enter your new password.");
    } catch (error: any) {
      toast.error(error.message || "Invalid code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsResetting(true);
    try {
      // Store pending password reset
      await completeReset({ 
        email, 
        code, 
        newPassword: newPassword 
      });
      
      toast.success("Almost done! Now create your new password on the next screen.");
      
      // Redirect to special reset completion page
      router.push(`/complete-reset?email=${encodeURIComponent(email)}&password=${encodeURIComponent(newPassword)}`);
      
    } catch (error: any) {
      console.error("Reset error:", error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setIsResetting(false);
    }
  };

  if (!email) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            {!isCodeVerified 
              ? `Enter the 6-digit code sent to ${email}`
              : "Enter your new password"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isCodeVerified ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Reset Code
                </label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-widest"
                  disabled={isVerifying}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={code.length !== 6 || isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Check your email for the code.
              </p>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  New Password
                </label>
                <PasswordInput
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isResetting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must be at least 8 characters
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Confirm New Password
                </label>
                <PasswordInput
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isResetting}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!newPassword || !confirmPassword || isResetting}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing Reset...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            The code will expire in 15 minutes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
