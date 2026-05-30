import type { Metadata } from "next";
import { CreateCircleForm } from "@/components/circles/create-form";
import { InfoIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Create Circle",
  description: "Start a new savings circle with your community.",
};

export default function CreateCirclePage() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold">Create a Circle</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set up your savings circle in 3 simple steps.
          </p>
        </div>

        {/* KYC note */}
        <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
          <InfoIcon className="size-4 shrink-0 mt-0.5" />
          <p>
            A <strong className="text-foreground">creation fee of 5%</strong> of
            the contribution amount will be deducted from your wallet. Circles
            above ₦50,000 require KYC verification.
          </p>
        </div>

        <CreateCircleForm />
      </div>
    </div>
  );
}