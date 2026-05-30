import { OnboardingShell } from "@/components/onboarding/content";
import type { Metadata } from "next";
// import { OnboardingShell } from "@/components/onboarding/content";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Complete your AjoSave profile to start saving with your community.",
};

export default function OnboardingPage() {
  return <OnboardingShell />;
}