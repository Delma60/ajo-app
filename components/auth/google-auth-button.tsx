"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  signInWithGoogle,
  signInWithGoogleRedirect,
  handleGoogleRedirectResult,
} from "@/lib/firebase/auth";

interface GoogleAuthButtonProps {
  label?: string;
}

/**
 * Detect if running inside Expo WebView
 * Expo sets a user agent with "Expo" or uses a specific pattern
 */
function isExpoWebView(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return ua.includes("Expo") || ua.includes("not a browser");
}

export function GoogleAuthButton({
  label = "Continue with Google",
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check for OAuth redirect result on component mount
  useEffect(() => {
    async function checkRedirectResult() {
      try {
        const wasSignedIn = await handleGoogleRedirectResult();
        if (wasSignedIn) {
          toast.success("Signed in successfully");
          // Determine redirect destination
          try {
            const metaCookie =
              typeof document !== "undefined"
                ? document.cookie
                    .split("; ")
                    .find((c) => c.trim().startsWith("__user_meta="))
                : null;
            if (metaCookie) {
              const raw = metaCookie.split("=").slice(1).join("=");
              const parsed = JSON.parse(decodeURIComponent(raw));
              if (parsed?.role === "admin") {
                router.push("/admin");
                router.refresh();
                return;
              }
            }
          } catch (e) {
            // ignore
          }
          router.push("/dashboard");
          router.refresh();
        }
      } catch (err) {
        console.error("Failed to check redirect result:", err);
      }
    }

    checkRedirectResult();
  }, [router]);

  async function handleGoogleAuth() {
    setIsLoading(true);
    try {
      const useRedirect = isExpoWebView();

      if (useRedirect) {
        // For Expo WebView: use redirect-based flow
        await signInWithGoogleRedirect();
        // Redirect happens, don't navigate here
      } else {
        // For regular web: use popup-based flow
        await signInWithGoogle();
        toast.success("Signed in successfully");
        // Determine redirect destination
        try {
          const metaCookie =
            typeof document !== "undefined"
              ? document.cookie
                  .split("; ")
                  .find((c) => c.trim().startsWith("__user_meta="))
              : null;
          if (metaCookie) {
            const raw = metaCookie.split("=").slice(1).join("=");
            const parsed = JSON.parse(decodeURIComponent(raw));
            if (parsed?.role === "admin") {
              router.push("/admin");
              router.refresh();
              return;
            }
          }
        } catch (e) {
          // ignore
        }
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed";
      if (!message.includes("popup-closed")) {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
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
      {/* Google SVG icon */}
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
