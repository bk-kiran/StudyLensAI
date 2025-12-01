"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const { signIn } = useAuthActions();
  const verifyAndCreateAccount = useMutation(api.pendingAuth.verifyAndCreateAccount);

  useEffect(() => {
    if (!email) {
      router.push("/signin");
    }
  }, [email, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length !== 6) return;

    setIsVerifying(true);
    try {
      // Verify code and get credentials
      const result = await verifyAndCreateAccount({ email, code });
      
      // Now create the actual account
      await signIn("password", {
        email: result.email,
        password: result.password,
        flow: "signUp",
      });
      
      toast.success("Email verified! Account created successfully!");
      router.push("/courses");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid verification code";
      toast.error(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!email) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent a 6-digit verification code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Verification Code
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
                "Verify Email"
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              The code will expire in 10 minutes. Check your console for the code in development mode.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
