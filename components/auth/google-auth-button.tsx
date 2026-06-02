// components/auth/GoogleAuthButton.tsx
//
// Detects whether it's running inside the Expo WebView wrapper.
// If native: posts a message to the app to trigger the in-app browser flow.
// If web:    uses Firebase signInWithPopup as normal.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    __NATIVE_APP__?: boolean;
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}

export function GoogleAuthButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // ── Native WebView path ────────────────────────────────────────────────
      // The App.js handles the full OAuth flow externally. We just post a message
      // and wait — when auth completes, App.js reloads the WebView.
      if (
        typeof window !== "undefined" &&
        window.__NATIVE_APP__ &&
        window.ReactNativeWebView
      ) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "INITIATE_GOOGLE_LOGIN" }),
        );
        // Leave isLoading=true so the button stays disabled while the
        // in-app browser is open. App.js re-enables disabled buttons on cancel.
        return;
      }

      // ── Web browser path ────────────────────────────────────────────────────
      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");

      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();

      // Create server-side session cookie
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error("Session creation failed");

      router.push("/dashboard");
    } catch (err) {
      console.error("[GoogleAuthButton] Sign-in error:", err);
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {/* Google "G" icon */}
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
        />
      </svg>
      {isLoading ? "Signing in…" : "Continue with Google"}
    </Button>
  );
}
