"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  signInWithGoogleRedirect,
  handleGoogleRedirectResult,
} from "@/lib/firebase/auth";

interface GoogleAuthButtonProps {
  label?: string;
}

export function GoogleAuthButton({
  label = "Continue with Google",
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Prevent React 18 Strict Mode double-firing
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    async function checkRedirectResult() {
      if (hasCheckedRef.current) return;
      hasCheckedRef.current = true;

      try {
        // Now returns the actual user data directly
        const appUser = await handleGoogleRedirectResult();

        if (appUser) {
          toast.success("Signed in successfully");

          // Determine redirect destination accurately
          if (appUser.role === "admin") {
            router.push("/admin");
          } else if (!appUser.onboardingComplete) {
            router.push("/onboarding");
          } else {
            router.push("/dashboard");
          }

          router.refresh();
        }
      } catch (err) {
        console.error("Failed to check redirect result:", err);
        toast.error("An error occurred during verification.");
      }
    }

    checkRedirectResult();
  }, [router]);

  async function handleGoogleAuth() {
    setIsLoading(true);
    try {
      await signInWithGoogleRedirect();
      // Notice: We intentionally DO NOT set isLoading(false) here.
      // This prevents the button from flashing back to normal before the redirect executes.
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(message);
      setIsLoading(false); // Only reset on failure
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2"
      onClick={handleGoogleAuth}
      disabled={isLoading}
    >
      <svg
        aria-hidden="true"
        className="size-4 shrink-0"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      {isLoading ? "Signing in…" : label}
    </Button>
  );
}
