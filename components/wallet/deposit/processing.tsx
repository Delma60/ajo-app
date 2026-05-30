"use client";

import { Loader2 } from "lucide-react";

interface DepositProcessingProps {
  message?: string;
  subMessage?: string;
}

export function DepositProcessing({
  message = "Initializing secure payment…",
  subMessage = "Please wait while we set up your transaction.",
}: DepositProcessingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Loader2 className="size-7 text-primary animate-spin" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{subMessage}</p>
      </div>
    </div>
  );
}