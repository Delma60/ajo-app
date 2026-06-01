"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2Icon, SparklesIcon } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { useAuth } from "@/lib/hooks/use-auth";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

const CONFETTI_COLORS = [
  "#047857", // emerald-700
  "#34d399", // emerald-400
  "#f59e0b", // amber-400
  "#3b82f6", // blue-500
  "#ffffff",
];

interface ConfettiDot {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
}

function generateConfetti(count: number): ConfettiDot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: Math.random() * 8 + 4,
    duration: Math.random() * 2 + 2,
    delay: Math.random() * 1.5,
  }));
}

const dots = generateConfetti(30);

export function OnboardingComplete() {
  const { user } = useAuth();
  const router = useRouter();

  // Mark onboarding complete in Firestore
  useEffect(() => {
    if (!user) return;
    updateDoc(doc(db, "users", user.uid), {
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    })
      .then(async () => {
        try {
          await fetch("/api/auth/session/refresh", { method: "POST" });
        } catch (err) {
          console.error(err);
        }
        // Notify server to evaluate onboarding_complete triggers for this user
        try {
          await fetch("/api/events/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ triggerType: "onboarding_complete" }),
          });
        } catch (err) {
          console.error("Failed to call events trigger API:", err);
        }
      })
      .catch(console.error);
  }, [user]);

  // Auto-redirect after 3.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 3500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Confetti */}
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-sm pointer-events-none"
          style={{
            left: `${dot.x}%`,
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
          }}
          initial={{ y: "-10%", opacity: 1, rotate: 0 }}
          animate={{
            y: "110vh",
            opacity: [1, 1, 0],
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: dot.duration,
            delay: dot.delay,
            ease: "easeIn",
          }}
        />
      ))}

      {/* Content */}
      <motion.div
        className="relative z-10 w-full max-w-sm text-center space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg select-none">
            A
          </span>
          <span className="text-xl font-semibold tracking-tight">AjoSave</span>
        </div>

        {/* Icon */}
        <motion.div
          className="flex justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 18,
            delay: 0.2,
          }}
        >
          <div className="size-20 rounded-full bg-primary/10 ring-4 ring-primary/20 flex items-center justify-center">
            <CheckCircle2Icon className="size-10 text-primary" />
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            You're all set! 🎉
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Welcome to AjoSave. Your account is ready — start saving smarter
            with your community.
          </p>
        </motion.div>

        {/* Stats preview */}
        <motion.div
          className="grid grid-cols-3 gap-3 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {[
            { value: "₦0", label: "Wallet balance" },
            { value: "0", label: "Active circles" },
            { value: "0", label: "Total saved" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-muted/50 border border-border p-3 space-y-0.5"
            >
              <p className="font-mono text-base font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-2"
        >
          <Button
            className="w-full gap-2"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          >
            <SparklesIcon className="size-4" />
            Go to my dashboard
          </Button>
          <p className="text-xs text-muted-foreground">
            Redirecting automatically in a moment…
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
