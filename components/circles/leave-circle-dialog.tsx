"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  LogOutIcon,
  ShieldAlertIcon,
  Loader2,
  InfoIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { formatNaira } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface LeaveCircleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circleId: string;
  circleName: string;
  /** Whether the user has any pending contribution for this cycle */
  hasPendingContribution: boolean;
  /** Contribution amount in kobo — shown as a warning if pending */
  contributionKobo: number;
  /** Whether the user is the scheduled next recipient */
  isNextRecipient: boolean;
  /** User's current turn position */
  turnPosition: number;
  totalCycles: number;
  currentCycle: number;
}

type LeaveStage = "confirm" | "leaving" | "success";

export function LeaveCircleDialog({
  open,
  onOpenChange,
  circleId,
  circleName,
  hasPendingContribution,
  contributionKobo,
  isNextRecipient,
  turnPosition,
  totalCycles,
  currentCycle,
}: LeaveCircleDialogProps) {
  const router = useRouter();
  const [stage, setStage] = useState<LeaveStage>("confirm");

  // Compute risk signals
  const cyclesRemaining = totalCycles - currentCycle;
  const isLate = currentCycle > 1; // simplified — real check would compare dates

  async function handleLeave() {
    setStage("leaving");
    try {
      const res = await fetch(`/api/circles/${circleId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? "Failed to leave circle");
      }

      setStage("success");

      // Redirect after a short delay so the user sees the success state
      setTimeout(() => {
        onOpenChange(false);
        router.push("/circles");
        router.refresh();
        toast.success(`You have left "${circleName}".`);
      }, 1800);
    } catch (err) {
      setStage("confirm");
      toast.error(
        err instanceof Error ? err.message : "Could not leave the circle. Please try again."
      );
    }
  }

  function handleClose() {
    if (stage === "leaving") return; // prevent closing while in-flight
    setStage("confirm");
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-sm">
        {stage === "success" ? (
          <div className="flex flex-col items-center py-6 gap-4 text-center">
            <div className="size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2Icon className="size-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold">You've left the circle</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                You have been removed from "{circleName}". Redirecting…
              </p>
            </div>
          </div>
        ) : (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
                  <LogOutIcon className="size-4 text-destructive" />
                </div>
                <AlertDialogTitle>Leave "{circleName}"?</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                This action cannot be undone. You will permanently lose your
                position in this circle.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Consequence list */}
            <div className="space-y-2.5 py-1">
              {/* Payout position warning */}
              {turnPosition > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 border border-border p-3">
                  <InfoIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    You are currently{" "}
                    <strong>position #{turnPosition}</strong> in the payout rotation.
                    {cyclesRemaining > 0 && (
                      <> You will forfeit your scheduled payout{cyclesRemaining === 1 ? "" : "s"}.</>
                    )}
                  </p>
                </div>
              )}

              {/* Next recipient warning — hardblock */}
              {isNextRecipient && (
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30 p-3">
                  <ShieldAlertIcon className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                      You're the next payout recipient
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                      Leaving now forfeits your upcoming payout. Contact the admin if you need an alternative arrangement.
                    </p>
                  </div>
                </div>
              )}

              {/* Pending contribution warning */}
              {hasPendingContribution && contributionKobo > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30 p-3">
                  <AlertTriangleIcon className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                      Pending contribution will be cancelled
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                      Your {formatNaira(contributionKobo)} contribution for this cycle
                      will be cancelled. No funds will be deducted.
                    </p>
                  </div>
                </div>
              )}

              {/* Rejoin notice */}
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 border border-border p-3">
                <AlertTriangleIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/70 leading-relaxed">
                  You cannot rejoin unless the admin re-invites you. Your trust
                  score may be affected.
                </p>
              </div>
            </div>

            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel
                disabled={stage === "leaving"}
                className="flex-1"
              >
                Stay in circle
              </AlertDialogCancel>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={stage === "leaving"}
                onClick={handleLeave}
              >
                {stage === "leaving" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Leaving…
                  </>
                ) : (
                  <>
                    <LogOutIcon className="size-4" />
                    Leave circle
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}