"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const {signOut} = useAuthActions();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  return (
    <Button variant="outline" onClick={handleSignOut} title="Sign out">
      <LogOut />
    </Button>
  );
}
