"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, UserIcon, WalletIcon, UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StepProfile } from "./step-profile";
import { StepFundWallet } from "./step-fund-wallet";
import { StepJoinCircle } from "./step-join-circle";
import { OnboardingComplete } from "./onboarding-complete";

export type OnboardingStep = 1 | 2 | 3 | "done";

interface StepMeta {
  number: number;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepMeta[] = [
  { number: 1, label: "Your Profile", icon: <UserIcon className="size-4" /> },
  { number: 2, label: "Fund Wallet", icon: <WalletIcon className="size-4" /> },
  { number: 3, label: "Join Circle", icon: <UsersIcon className="size-4" /> },
];

interface StepIndicatorProps {
  steps: StepMeta[];
  currentStep: OnboardingStep;
}

function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const current = currentStep === "done" ? 4 : (currentStep as number);

  return (
    <div className="w-full max-w-lg mb-10 px-2">
      <div className="flex items-start justify-between relative">
        {/* Progress line */}
        <div className="absolute left-4 right-4 top-4 h-0.5 bg-border" />
        <motion.div
          className="absolute left-4 top-4 h-0.5 bg-primary origin-left"
          initial={{ scaleX: 0 }}
          animate={{
            scaleX:
              currentStep === "done" ? 1 : (current - 1) / (steps.length - 1),
          }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          style={{ right: "1rem" }}
        />

        {steps.map((step) => {
          const isCompleted = current > step.number;
          const isActive = current === step.number;

          return (
            <div
              key={step.number}
              className="relative z-10 flex flex-col items-center gap-2"
            >
              <motion.div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center border-2 transition-colors",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                      ? "bg-background border-primary text-primary"
                      : "bg-background border-border text-muted-foreground",
                )}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {isCompleted ? <CheckIcon className="size-4" /> : step.icon}
              </motion.div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

export function OnboardingShell() {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState(1);

  function goToStep(next: OnboardingStep) {
    const current = step === "done" ? 4 : (step as number);
    const nextNum = next === "done" ? 4 : (next as number);
    setDirection(nextNum > current ? 1 : -1);
    setStep(next);
  }

  if (step === "done") {
    return <OnboardingComplete />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg select-none">
          A
        </span>
        <span className="text-xl font-semibold tracking-tight">AjoSave</span>
      </div>

      <StepIndicator steps={STEPS} currentStep={step} />

      <div className="w-full max-w-lg overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {step === 1 && <StepProfile onComplete={() => goToStep(2)} />}
            {step === 2 && (
              <StepFundWallet
                onComplete={() => goToStep(3)}
                onBack={() => goToStep(1)}
              />
            )}
            {step === 3 && (
              <StepJoinCircle
                onComplete={() => goToStep("done")}
                onSkip={() => goToStep("done")}
                onBack={() => goToStep(2)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
