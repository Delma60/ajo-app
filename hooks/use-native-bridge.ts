"use client";

/**
 * lib/hooks/use-native-bridge.ts
 *
 * A thin bridge between your Next.js web layer and the Expo WebView container.
 * Import this in any client component to trigger native haptics, check if
 * the app is running inside the WebView, or signal page transitions.
 *
 * Usage:
 *   const { haptic, isNative } = useNativeBridge();
 *   <button data-haptic="medium" onClick={() => haptic('medium')}>Pay</button>
 */

import { useCallback, useEffect, useState } from "react";

type HapticStyle =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

interface NativeBridge {
  /** True when running inside the Expo WebView wrapper */
  isNative: boolean;
  /** Trigger a haptic feedback pattern */
  haptic: (style?: HapticStyle) => void;
  /** Signal a page navigation is about to happen */
  signalNavTransition: () => void;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export function useNativeBridge(): NativeBridge {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Detect WebView on mount (window.ReactNativeWebView is injected by the native layer)
    setIsNative(typeof window !== "undefined" && !!window.ReactNativeWebView);
  }, []);

  const postMessage = useCallback((payload: Record<string, unknown>) => {
    if (typeof window !== "undefined" && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }, []);

  const haptic = useCallback(
    (style: HapticStyle = "selection") => {
      postMessage({ type: "HAPTIC", style });
    },
    [postMessage]
  );

  const signalNavTransition = useCallback(() => {
    postMessage({ type: "NAV_TRANSITION" });
  }, [postMessage]);

  return { isNative, haptic, signalNavTransition };
}

/**
 * A standalone function version — useful outside of React components,
 * e.g. in form submit handlers or toast callbacks.
 */
export function triggerNativeHaptic(style: HapticStyle = "selection") {
  if (typeof window !== "undefined" && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: "HAPTIC", style })
    );
  }
}