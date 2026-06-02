"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TriggerType, RewardType } from "@/lib/types/event";

// ─── Validation Schema ─────────────────────────────────────────────────────

const createEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  triggerType: z.string().min(1, "Trigger type is required"),
  rewardType: z.string().min(1, "Reward type is required"),
  rewardAmountNaira: z.string().optional(),
  maxClaimsTotal: z.string(),
  maxClaimsPerUser: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  minMemberCount: z.string().optional(),
  minAmountNaira: z.string().optional(),
});

type CreateEventFormValues = z.infer<typeof createEventSchema>;

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: "circle_completed", label: "Circle Completed" },
  { value: "circle_moderated", label: "Circle Moderated" },
  { value: "first_contribution", label: "First Contribution" },
  { value: "contribution_streak", label: "Contribution Streak" },
  { value: "wallet_funded_threshold", label: "Wallet Funded Threshold" },
  {
    value: "wallet_total_saved_threshold",
    label: "Wallet Total Saved Threshold",
  },
  { value: "referral_milestone", label: "Referral Milestone" },
  { value: "circle_filled", label: "Circle Filled" },
  { value: "first_circle_joined", label: "First Circle Joined" },
  { value: "onboarding_complete", label: "Onboarding Complete" },
  { value: "investment_made", label: "Investment Made" },
];

const REWARD_TYPES: { value: RewardType; label: string }[] = [
  { value: "wallet_credit", label: "Wallet Credit" },
  { value: "badge", label: "Badge" },
  { value: "both", label: "Both (Wallet + Badge)" },
];

export function CreateEventForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      rewardType: "wallet_credit",
      maxClaimsTotal: "0",
      maxClaimsPerUser: "1",
    },
  });

  const watchedValues = watch();

  async function onSubmit(values: CreateEventFormValues) {
    try {
      setIsSubmitting(true);

      const conditions: Record<string, any> = {};

      if (
        values.triggerType === "wallet_funded_threshold" &&
        values.minAmountNaira
      ) {
        conditions.minAmountKobo = Math.round(
          parseFloat(values.minAmountNaira) * 100,
        );
      }

      if (values.triggerType === "circle_completed" && values.minMemberCount) {
        conditions.minMemberCount = parseInt(values.minMemberCount);
      }

      const payload = {
        title: values.title,
        description: values.description,
        triggerType: values.triggerType,
        rewardType: values.rewardType,
        rewardAmountKobo:
          (values.rewardType === "wallet_credit" ||
            values.rewardType === "both") &&
          values.rewardAmountNaira
            ? Math.round(parseFloat(values.rewardAmountNaira) * 100)
            : undefined,
        maxClaimsTotal: parseInt(values.maxClaimsTotal) || 0,
        maxClaimsPerUser: parseInt(values.maxClaimsPerUser) || 1,
        startDate: values.startDate,
        endDate: values.endDate,
        conditions,
      };

      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create event");
      }

      const result = await response.json();
      toast.success("Event created successfully!");
      router.push(`/admin/events/${result.data.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create event",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { n: 1, label: "Details" },
          { n: 2, label: "Trigger & Conditions" },
          { n: 3, label: "Review" },
        ].map(({ n, label }) => (
          <button
            type="button"
            key={n}
            onClick={() => setStep(n as 1 | 2 | 3)}
            className="flex items-center gap-2 group"
          >
            <span
              className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step >= n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {n}
            </span>
            <span
              className={`text-xs font-medium transition-colors hidden sm:block ${
                step === n ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {n < 3 && (
              <span className="text-muted-foreground/40 text-xs">—</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Step 1: Event Details ─────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              Basic information about this promotional event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                placeholder="e.g. Complete Your First Circle"
                aria-invalid={!!errors.title}
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this event about? What do users need to do?"
                className="min-h-[100px]"
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  aria-invalid={!!errors.startDate}
                  {...register("startDate")}
                />
                {errors.startDate && (
                  <p className="text-xs text-destructive">
                    {errors.startDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  aria-invalid={!!errors.endDate}
                  {...register("endDate")}
                />
                {errors.endDate && (
                  <p className="text-xs text-destructive">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <Button type="button" className="w-full" onClick={() => setStep(2)}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Trigger & Conditions ──────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Trigger & Conditions</CardTitle>
            <CardDescription>
              Define what triggers this reward and any conditions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="triggerType">Trigger Type</Label>
              <Controller
                name="triggerType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="triggerType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Conditional fields based on trigger type */}
            {watchedValues.triggerType === "wallet_funded_threshold" && (
              <div className="space-y-2">
                <Label htmlFor="minAmountNaira">Minimum Amount (₦)</Label>
                <Input
                  id="minAmountNaira"
                  type="number"
                  placeholder="e.g. 10000"
                  {...register("minAmountNaira")}
                />
              </div>
            )}

            {watchedValues.triggerType === "circle_completed" && (
              <div className="space-y-2">
                <Label htmlFor="minMemberCount">
                  Minimum Members (optional)
                </Label>
                <Input
                  id="minMemberCount"
                  type="number"
                  placeholder="e.g. 5"
                  {...register("minMemberCount")}
                />
              </div>
            )}

            <div className="pt-4 border-t space-y-4">
              <h3 className="font-medium text-sm">Claim Limits</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxClaimsTotal">
                    Max Total Claims (0 = unlimited)
                  </Label>
                  <Input
                    id="maxClaimsTotal"
                    type="number"
                    placeholder="0"
                    {...register("maxClaimsTotal")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxClaimsPerUser">Max Per User</Label>
                  <Input
                    id="maxClaimsPerUser"
                    type="number"
                    placeholder="1"
                    {...register("maxClaimsPerUser")}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Reward Setup & Review ────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Reward Setup & Review</CardTitle>
            <CardDescription>
              Configure the reward and review your event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rewardType">Reward Type</Label>
              <Controller
                name="rewardType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="rewardType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REWARD_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {(watchedValues.rewardType === "wallet_credit" ||
              watchedValues.rewardType === "both") && (
              <div className="space-y-2">
                <Label htmlFor="rewardAmountNaira">Reward Amount (₦)</Label>
                <Input
                  id="rewardAmountNaira"
                  type="number"
                  placeholder="e.g. 1000"
                  {...register("rewardAmountNaira")}
                />
              </div>
            )}

            {/* Summary */}
            <div className="pt-4 border-t space-y-3 bg-muted p-4 rounded-lg">
              <h4 className="font-medium text-sm">Event Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Title:</span>
                  <span className="font-medium">
                    {watchedValues.title || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trigger:</span>
                  <span className="font-medium capitalize">
                    {watchedValues.triggerType?.replace(/_/g, " ") || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reward:</span>
                  <span className="font-medium capitalize">
                    {watchedValues.rewardType?.replace(/_/g, " ") || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? "Creating…" : "Create Event"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
