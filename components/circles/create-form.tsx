"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2,
  Users2Icon,
  TrendingUpIcon,
  CalendarIcon,
  ShuffleIcon,
  GavelIcon,
  RotateCcwIcon,
  LockIcon,
  GlobeIcon,
  InfoIcon,
  TagIcon,
  XIcon,
} from "lucide-react";

import {
  buildCreateCircleSchema,
  type CreateCircleFormValues,
} from "@/lib/validators/circle";
import { useCreateCircle } from "@/lib/hooks/use-circle";
import { useSettings } from "@/lib/providers/settings";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatNaira } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Template presets ─────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "weekly-5k",
    label: "Weekly ₦5k",
    description: "10 members, weekly contributions",
    contribution: 5000,
    maxMembers: 10,
    frequency: "weekly" as const,
    payoutOrder: "rotational" as const,
  },
  {
    id: "monthly-10k",
    label: "Monthly ₦10k",
    description: "12 members, monthly contributions",
    contribution: 10000,
    maxMembers: 12,
    frequency: "monthly" as const,
    payoutOrder: "rotational" as const,
  },
  {
    id: "daily-1k",
    label: "Daily ₦1k",
    description: "30 members, daily contributions",
    contribution: 1000,
    maxMembers: 30,
    frequency: "daily" as const,
    payoutOrder: "rotational" as const,
  },
];

// ─── Option selector ──────────────────────────────────────────────────────────

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  className?: string;
}

function OptionCard({
  selected,
  onClick,
  icon,
  label,
  description,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border bg-background hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-8 rounded-lg flex items-center justify-center",
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </button>
  );
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("font-medium font-mono", highlight && "text-primary")}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function CreateCircleForm() {
  const router = useRouter();
  const { appUser } = useAuthStore();
  const settings = useSettings();
  const createCircle = useCreateCircle();
  const [tagInput, setTagInput] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Build dynamic schema based on live settings (NGN for client form)
  const circleSchema = buildCreateCircleSchema(settings, "NGN");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateCircleFormValues>({
    resolver: zodResolver(circleSchema),
    defaultValues: {
      frequency: "monthly",
      payoutOrder: "rotational",
      isPrivate: false,
      invitePermission: "admin",
      tags: [],
    },
  });

  const watchedValues = watch();
  const contributionNum = Number(watchedValues.contribution ?? 0) || 0;
  const maxMembersNum = Number(watchedValues.maxMembers ?? 0) || 0;
  const goalKobo = contributionNum * 100 * maxMembersNum;
  const creationFeePercent = settings.circles.creationFeePercent;
  const creationFee = Math.round(contributionNum * 100 * creationFeePercent);
  const walletBalance = appUser ? 0 : 0; // will come from wallet store

  function applyTemplate(tpl: (typeof TEMPLATES)[0]) {
    setValue("contribution", tpl.contribution);
    setValue("maxMembers", tpl.maxMembers);
    setValue("frequency", tpl.frequency);
    setValue("payoutOrder", tpl.payoutOrder);
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    const tags = watchedValues.tags ?? [];
    if (!tag || tags.includes(tag) || tags.length >= 5) return;
    setValue("tags", [...tags, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    const tags = watchedValues.tags ?? [];
    setValue(
      "tags",
      tags.filter((t) => t !== tag),
    );
  }

  async function onSubmit(values: CreateCircleFormValues) {
    if (!appUser) {
      toast.error("You must be signed in to create a circle.");
      return;
    }
    // KYC check removed

    try {
      const result = await createCircle.mutateAsync({
        name: values.name,
        description: values.description ?? "",
        contribution: Math.round(contributionNum * 100),
        maxMembers: Number(values.maxMembers),
        frequency: values.frequency,
        payoutOrder: values.payoutOrder,
        isPrivate: values.isPrivate ?? false,
        invitePermission: values.invitePermission ?? "admin",
        tags: values.tags ?? [],
      });
      toast.success("Circle created! Your creation fee has been deducted.");
      router.push(`/circles/${result.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create circle. Please try again.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { n: 1, label: "Details" },
          { n: 2, label: "Settings" },
          { n: 3, label: "Review" },
        ].map(({ n, label }) => (
          <button
            type="button"
            key={n}
            onClick={() => setStep(n as 1 | 2 | 3)}
            className="flex items-center gap-2 group"
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                step >= n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {n}
            </span>
            <span
              className={cn(
                "text-xs font-medium transition-colors hidden sm:block",
                step === n ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {n < 3 && (
              <span className="text-muted-foreground/40 text-xs">—</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Step 1: Basic Details ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Templates */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Quick start templates
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="rounded-xl border border-border p-3 text-left hover:border-primary/50 transition-colors group"
                >
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {tpl.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tpl.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="circle-name">Circle name</Label>
              <Input
                id="circle-name"
                placeholder="e.g. Lagos Finance Crew"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="circle-desc">Description</Label>
              <Textarea
                id="circle-desc"
                placeholder="What is this circle for? Who should join?"
                className="min-h-[80px]"
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label>
                Tags{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="e.g. savings, women"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  disabled={(watchedValues.tags ?? []).length >= 5}
                >
                  <TagIcon className="size-3.5" />
                  Add
                </Button>
              </div>
              {(watchedValues.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(watchedValues.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-destructive transition-colors"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button type="button" className="w-full" onClick={() => setStep(2)}>
            Continue to Settings
          </Button>
        </div>
      )}

      {/* ── Step 2: Settings ──────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Contribution & Members */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="circle-contribution">Contribution (₦)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₦
                </span>
                <Input
                  id="circle-contribution"
                  type="number"
                  min={String(settings.circles.minContributionKobo / 100)}
                  step="100"
                  placeholder="5000"
                  className="pl-7"
                  aria-invalid={!!errors.contribution}
                  {...register("contribution")}
                />
              </div>
              {errors.contribution && (
                <p className="text-xs text-destructive">
                  {errors.contribution.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="circle-members">Max members</Label>
              <Input
                id="circle-members"
                type="number"
                min={String(settings.circles.minCircleMembers)}
                max={String(settings.circles.maxCircleMembers)}
                placeholder="10"
                aria-invalid={!!errors.maxMembers}
                {...register("maxMembers")}
              />
              {errors.maxMembers && (
                <p className="text-xs text-destructive">
                  {errors.maxMembers.message}
                </p>
              )}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>Contribution frequency</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["daily", "weekly", "bi-weekly", "monthly"] as const).map(
                (freq) => (
                  <Controller
                    key={freq}
                    name="frequency"
                    control={control}
                    render={({ field }) => (
                      <button
                        type="button"
                        onClick={() => field.onChange(freq)}
                        className={cn(
                          "h-9 rounded-lg border text-sm font-medium transition-all capitalize",
                          field.value === freq
                            ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        {freq === "bi-weekly"
                          ? "Bi-weekly"
                          : freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </button>
                    )}
                  />
                ),
              )}
            </div>
          </div>

          {/* Payout order */}
          <div className="space-y-2">
            <Label>Payout order</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Controller
                name="payoutOrder"
                control={control}
                render={({ field }) => (
                  <>
                    <OptionCard
                      selected={field.value === "rotational"}
                      onClick={() => field.onChange("rotational")}
                      icon={<RotateCcwIcon className="size-4" />}
                      label="Rotational"
                      description="Members receive payout in a fixed order, one per cycle."
                    />
                    <OptionCard
                      selected={field.value === "random"}
                      onClick={() => field.onChange("random")}
                      icon={<ShuffleIcon className="size-4" />}
                      label="Random draw"
                      description="Recipient is drawn randomly each cycle — adds excitement."
                    />
                    <OptionCard
                      selected={field.value === "bidding"}
                      onClick={() => field.onChange("bidding")}
                      icon={<GavelIcon className="size-4" />}
                      label="Bidding"
                      description="Members bid to receive payout early; premium goes to pool."
                    />
                  </>
                )}
              />
            </div>
          </div>

          {/* Privacy */}
          <div className="space-y-4 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <Controller
                name="isPrivate"
                control={control}
                render={({ field }) => (
                  <>
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        field.value ? "bg-muted" : "bg-primary/10",
                      )}
                    >
                      {field.value ? (
                        <LockIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <GlobeIcon className="size-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {field.value ? "Private circle" : "Public circle"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {field.value
                          ? "Invite only — not discoverable publicly"
                          : "Anyone can request to join"}
                      </p>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="ml-auto"
                    />
                  </>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Invite permissions</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(["admin", "members"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue("invitePermission", value)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-sm transition-all",
                      watchedValues.invitePermission === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background hover:border-primary/40",
                    )}
                  >
                    <p className="font-semibold">
                      {value === "admin" ? "Admin only" : "Members can invite"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {value === "admin"
                        ? "Only the circle admin can share invite codes."
                        : "Any member can share the invite link and code."}
                    </p>
                  </button>
                ))}
              </div>
              <input type="hidden" {...register("invitePermission")} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button type="button" className="flex-1" onClick={() => setStep(3)}>
              Review Circle
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Submit ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {watchedValues.name || "—"}
              </CardTitle>
              <CardDescription>
                {watchedValues.description || "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border -mt-2">
              <SummaryRow
                label="Contribution / cycle"
                value={
                  contributionNum > 0 ? formatNaira(contributionNum * 100) : "—"
                }
              />
              <SummaryRow
                label="Members"
                value={
                  watchedValues.maxMembers
                    ? String(watchedValues.maxMembers)
                    : "—"
                }
              />
              <SummaryRow
                label="Frequency"
                value={
                  watchedValues.frequency
                    ? watchedValues.frequency.charAt(0).toUpperCase() +
                      watchedValues.frequency.slice(1)
                    : "—"
                }
              />
              <SummaryRow
                label="Payout order"
                value={
                  watchedValues.payoutOrder
                    ? watchedValues.payoutOrder.charAt(0).toUpperCase() +
                      watchedValues.payoutOrder.slice(1)
                    : "—"
                }
              />
              <SummaryRow
                label="Pool per cycle"
                value={goalKobo > 0 ? formatNaira(goalKobo) : "—"}
                highlight
              />
              <SummaryRow
                label="Visibility"
                value={watchedValues.isPrivate ? "Private" : "Public"}
              />
              <SummaryRow
                label="Invite permissions"
                value={
                  watchedValues.invitePermission === "members"
                    ? "Members can invite"
                    : "Admin only"
                }
              />
            </CardContent>
          </Card>

          {/* Creation fee notice */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30 p-3 flex gap-2.5">
            <InfoIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
                Creation fee
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                A one-time fee of{" "}
                <strong>
                  {creationFee > 0
                    ? formatNaira(creationFee)
                    : "5% of contribution"}
                </strong>{" "}
                will be deducted from your wallet when you create this circle.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setStep(2)}
            >
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createCircle.isPending}
            >
              {createCircle.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {createCircle.isPending ? "Creating…" : "Create Circle"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
