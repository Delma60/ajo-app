"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  Controller,
  type UseFormRegister,
  type Control,
  type UseFormWatch,
  type UseFormSetValue,
} from "react-hook-form";
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
  TicketIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  AlertTriangleIcon,
} from "lucide-react";

import {
  buildCreateCircleSchema,
  computeMaxJoinFee,
  type CreateCircleFormValues,
} from "@/lib/validators/circle";
import { useCreateCircle } from "@/lib/hooks/use-circle";
import { useSettings } from "@/lib/providers/settings";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatNaira } from "@/lib/utils";
import type { PlatformSettings } from "@/lib/types/admin-settings";

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
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border last:border-0">
      <span
        className={cn(
          "text-muted-foreground",
          muted && "text-muted-foreground/60",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-medium font-mono",
          highlight && "text-primary",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Join fee type selector ───────────────────────────────────────────────────

function JoinFeeTypeButton({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left text-sm transition-all w-full",
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      <p className="font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </button>
  );
}

interface JoinFeeSectionProps {
  control: Control<CreateCircleFormValues>;
  register: UseFormRegister<CreateCircleFormValues>;
  watch: UseFormWatch<CreateCircleFormValues>;
  setValue: UseFormSetValue<CreateCircleFormValues>;
  settings: PlatformSettings;
  errors: Partial<Record<keyof CreateCircleFormValues, { message?: string }>>;
}

function JoinFeeSection({
  control,
  register,
  watch,
  setValue,
  settings,
  errors,
}: JoinFeeSectionProps) {
  const watchedValues = watch();
  const joinFeeEnabled = watchedValues.joinFeeEnabled ?? false;
  const joinFeeNum = Number(watchedValues.joinFee ?? 0) || 0;
  const joinFeeKobo = Math.round(joinFeeNum * 100);
  const joinFeeType = watchedValues.joinFeeType ?? "before_joining";
  const contributionNum = Number(watchedValues.contribution ?? 0) || 0;
  const maxMembersNum = Number(watchedValues.maxMembers ?? 0) || 0;

  const maxJoinFeeNGN =
    contributionNum > 0
      ? computeMaxJoinFee(contributionNum, "NGN", settings)
      : settings.circles.maxJoinFeeKobo / 100;

  const maxJoinFeePercent = settings.circles.maxJoinFeePercent;
  const maxJoinFeeAbsNGN = settings.circles.maxJoinFeeKobo / 100;
  const isOverCap =
    joinFeeEnabled && joinFeeNum > 0 && joinFeeNum > maxJoinFeeNGN;

  function handleJoinFeeBlur() {
    if (isOverCap) {
      setValue("joinFee", Math.floor(maxJoinFeeNGN), { shouldValidate: true });
    }
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              joinFeeEnabled ? "bg-primary/10" : "bg-muted",
            )}
          >
            <TicketIcon
              className={cn(
                "size-4 transition-colors",
                joinFeeEnabled ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <p className="text-sm font-medium">Join fee</p>
            <p className="text-xs text-muted-foreground">
              One-time fee charged to each new member
            </p>
          </div>
        </div>
        <Controller
          name="joinFeeEnabled"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>

      {joinFeeEnabled && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2.5 text-xs text-muted-foreground">
            <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
            <p>
              Platform rules:{" "}
              <span className="font-medium text-foreground">
                max {maxJoinFeePercent}% of contribution
              </span>{" "}
              and no more than{" "}
              <span className="font-medium text-foreground">
                {formatNaira(settings.circles.maxJoinFeeKobo)}
              </span>{" "}
              absolute.
              {contributionNum > 0 && (
                <>
                  {" "}
                  Your effective cap:{" "}
                  <span className="font-semibold text-foreground">
                    {formatNaira(Math.round(maxJoinFeeNGN * 100))}
                  </span>
                  .
                </>
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="join-fee">Fee amount (₦)</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₦
              </span>
              <Input
                id="join-fee"
                type="number"
                min="0"
                max={Math.floor(maxJoinFeeNGN)}
                step="100"
                placeholder="0"
                className={cn(
                  "pl-7",
                  isOverCap &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                aria-invalid={!!errors.joinFee || isOverCap}
                {...register("joinFee", { onBlur: handleJoinFeeBlur })}
              />
            </div>

            {isOverCap && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                <AlertTriangleIcon className="size-3.5 shrink-0 mt-0.5" />
                <p>
                  Fee exceeds the platform cap of{" "}
                  <strong>
                    {formatNaira(Math.round(maxJoinFeeNGN * 100))}
                  </strong>
                  .{" "}
                  {contributionNum > 0
                    ? `This is ${maxJoinFeePercent}% of your ₦${contributionNum.toLocaleString(
                        "en-NG",
                      )} contribution (capped at ${formatNaira(
                        settings.circles.maxJoinFeeKobo,
                      )} max).`
                    : `Maximum allowed is ${formatNaira(settings.circles.maxJoinFeeKobo)}.`}
                </p>
              </div>
            )}

            {errors.joinFee && !isOverCap && (
              <p className="text-xs text-destructive">
                {errors.joinFee.message}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              This fee goes directly to you (the circle admin). It is separate
              from members' regular contributions.
            </p>
          </div>

          <div className="space-y-2">
            <Label>When is the fee collected?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <JoinFeeTypeButton
                selected={joinFeeType === "before_joining"}
                onClick={() => setValue("joinFeeType", "before_joining")}
                label="Before joining"
                description="Deducted from member's wallet immediately when they join."
              />
              <JoinFeeTypeButton
                selected={joinFeeType === "first_contribution"}
                onClick={() => setValue("joinFeeType", "first_contribution")}
                label="With first contribution"
                description="Collected alongside their first contribution payment."
              />
            </div>
            <input type="hidden" {...register("joinFeeType")} />
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5 text-xs">
            <p className="font-semibold text-primary flex items-center gap-1.5">
              <InfoIcon className="size-3.5" />
              Fee preview
            </p>
            <div className="flex justify-between text-foreground/80">
              <span>Fee per member</span>
              <span className="font-mono font-semibold">
                {formatNaira(joinFeeKobo)}
              </span>
            </div>
            {maxMembersNum > 1 && (
              <div className="flex justify-between text-foreground/80">
                <span>
                  From {maxMembersNum - 1} other member
                  {maxMembersNum - 1 !== 1 ? "s" : ""}
                </span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatNaira(joinFeeKobo * (maxMembersNum - 1))}
                </span>
              </div>
            )}
            {joinFeeKobo > 0 && (
              <div className="pt-1 border-t border-border/60">
                <div className="flex justify-between text-muted-foreground">
                  <span>Cap utilisation</span>
                  <span className="font-mono">
                    {Math.round((joinFeeNum / maxJoinFeeNGN) * 100)}% of{" "}
                    {formatNaira(Math.round(maxJoinFeeNGN * 100))} cap
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      joinFeeNum / maxJoinFeeNGN >= 0.9
                        ? "bg-amber-500"
                        : "bg-primary",
                    )}
                    style={{
                      width: `${Math.min(100, Math.round((joinFeeNum / maxJoinFeeNGN) * 100))}%`,
                    }}
                  />
                </div>
                {isOverCap && (
                  <p className="mt-2 text-xs text-destructive">
                    Cap reached. The fee will be clamped to{" "}
                    {formatNaira(Math.round(maxJoinFeeNGN * 100))} on blur.
                  </p>
                )}
              </div>
            )}
            <p className="text-muted-foreground pt-0.5 border-t border-border/60">
              {joinFeeType === "before_joining"
                ? "Credited to your wallet as each member joins."
                : "Collected when each member makes their first contribution."}
            </p>
          </div>
        </div>
      )}
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
      joinFeeEnabled: false,
      joinFee: 0,
      joinFeeType: "before_joining",
    },
  });

  const watchedValues = watch();
  const contributionNum = Number(watchedValues.contribution ?? 0) || 0;
  const maxMembersNum = Number(watchedValues.maxMembers ?? 0) || 0;
  const goalKobo = contributionNum * 100 * maxMembersNum;
  const creationFeePercent = settings.circles.creationFeePercent;
  const creationFee = Math.round(goalKobo * (creationFeePercent / 100));

  // Join fee calculations
  const joinFeeEnabled = watchedValues.joinFeeEnabled ?? false;
  const joinFeeNum = Number(watchedValues.joinFee ?? 0) || 0;
  const joinFeeKobo = Math.round(joinFeeNum * 100);
  const joinFeeType = watchedValues.joinFeeType ?? "before_joining";

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
        joinFeeEnabled: values.joinFeeEnabled ?? false,
        joinFee: joinFeeKobo,
        joinFeeType: values.joinFeeType ?? "before_joining",
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

          {/* Live creation fee preview */}
          {goalKobo > 0 && (
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <InfoIcon className="size-3.5 shrink-0" />
                Creation fee ({creationFeePercent}% of total pool)
              </span>
              <span className="font-mono font-semibold text-foreground">
                {formatNaira(creationFee)}
              </span>
            </div>
          )}

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
                    <div className="flex-1">
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

          {/* ── Join Fee Section ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header toggle */}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    joinFeeEnabled ? "bg-primary/10" : "bg-muted",
                  )}
                >
                  <TicketIcon
                    className={cn(
                      "size-4 transition-colors",
                      joinFeeEnabled ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">Join fee</p>
                  <p className="text-xs text-muted-foreground">
                    Charge members a one-time fee when they join
                  </p>
                </div>
              </div>
              <Controller
                name="joinFeeEnabled"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* Expanded join fee config */}
            {joinFeeEnabled && (
              <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                {/* Fee amount input */}
                <div className="space-y-1.5">
                  <Label htmlFor="join-fee">Fee amount (₦)</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₦
                    </span>
                    <Input
                      id="join-fee"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="0"
                      className="pl-7"
                      aria-invalid={!!errors.joinFee}
                      {...register("joinFee")}
                    />
                  </div>
                  {errors.joinFee && (
                    <p className="text-xs text-destructive">
                      {errors.joinFee.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This fee goes directly to you (the circle admin).
                  </p>
                </div>

                {/* Fee collection timing */}
                <div className="space-y-2">
                  <Label>When is the fee collected?</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <JoinFeeTypeButton
                      selected={joinFeeType === "before_joining"}
                      onClick={() => setValue("joinFeeType", "before_joining")}
                      label="Before joining"
                      description="Deducted from member's wallet immediately when they join."
                    />
                    <JoinFeeTypeButton
                      selected={joinFeeType === "first_contribution"}
                      onClick={() =>
                        setValue("joinFeeType", "first_contribution")
                      }
                      label="With first contribution"
                      description="Collected alongside their first contribution payment."
                    />
                  </div>
                  <input type="hidden" {...register("joinFeeType")} />
                </div>

                {/* Live preview if fee is set */}
                {joinFeeKobo > 0 && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5 text-xs">
                    <p className="font-semibold text-primary flex items-center gap-1.5">
                      <InfoIcon className="size-3.5" />
                      Fee preview
                    </p>
                    <div className="flex justify-between text-foreground/80">
                      <span>Fee per member</span>
                      <span className="font-mono font-semibold">
                        {formatNaira(joinFeeKobo)}
                      </span>
                    </div>
                    {maxMembersNum > 1 && (
                      <div className="flex justify-between text-foreground/80">
                        <span>
                          Total from {maxMembersNum - 1} other member
                          {maxMembersNum - 1 !== 1 ? "s" : ""}
                        </span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatNaira(joinFeeKobo * (maxMembersNum - 1))}
                        </span>
                      </div>
                    )}
                    <p className="text-muted-foreground pt-0.5 border-t border-border/60">
                      {joinFeeType === "before_joining"
                        ? "Credited to your wallet as each member joins."
                        : "Collected when each member makes their first contribution."}
                    </p>
                  </div>
                )}
              </div>
            )}
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
              {/* Join fee summary rows */}
              {joinFeeEnabled && joinFeeKobo > 0 ? (
                <>
                  <SummaryRow
                    label="Join fee (per member)"
                    value={formatNaira(joinFeeKobo)}
                  />
                  <SummaryRow
                    label="Fee collection"
                    value={
                      joinFeeType === "before_joining"
                        ? "Before joining"
                        : "With first contribution"
                    }
                    muted
                  />
                </>
              ) : joinFeeEnabled ? (
                <SummaryRow label="Join fee" value="Enabled (₦0)" muted />
              ) : (
                <SummaryRow label="Join fee" value="None" muted />
              )}
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
                    : `${creationFeePercent}% of total pool`}
                </strong>{" "}
                ({creationFeePercent}% × {formatNaira(goalKobo || 0)} total
                pool) will be deducted from your wallet when you create this
                circle.
              </p>
            </div>
          </div>

          {/* Join fee admin notice */}
          {joinFeeEnabled && joinFeeKobo > 0 && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex gap-2.5">
              <TicketIcon className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-primary">
                  Join fee enabled
                </p>
                <p className="text-xs text-foreground/70">
                  Each new member will pay{" "}
                  <strong>{formatNaira(joinFeeKobo)}</strong>{" "}
                  {joinFeeType === "before_joining"
                    ? "immediately when joining"
                    : "alongside their first contribution"}
                  . This goes directly to your wallet.
                </p>
              </div>
            </div>
          )}

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
