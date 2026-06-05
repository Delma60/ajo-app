import { z } from "zod";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";

type Unit = "NGN" | "KOBO";

/**
 * Compute the effective join fee cap given the current platform settings and
 * the contribution amount. Returns a value in the same unit as `unit`.
 *
 * The cap is: min(contribution × maxJoinFeePercent/100, maxJoinFeeKobo)
 * This prevents both percentage-based abuse (charging 500% of contribution)
 * and absolute abuse (charging ₦50k on a ₦500 circle).
 */
export function computeMaxJoinFee(
  contributionInUnit: number,
  unit: Unit,
  settings = DEFAULT_PLATFORM_SETTINGS
): number {
  const { maxJoinFeePercent, maxJoinFeeKobo } = settings.circles;
  const contributionKobo =
    unit === "NGN" ? contributionInUnit * 100 : contributionInUnit;

  const percentCapKobo = Math.floor(
    (contributionKobo * maxJoinFeePercent) / 100
  );
  const effectiveCapKobo = Math.min(percentCapKobo, maxJoinFeeKobo);

  return unit === "NGN" ? effectiveCapKobo / 100 : effectiveCapKobo;
}

/**
 * Build a circle create schema based on provided settings.
 * `unit` controls whether `contribution` and `joinFee` are validated as NGN
 * (user-facing form) or KOBO (server payloads). Defaults to `NGN`.
 *
 * Join fee protection rules enforced here:
 *  1. Fee cannot exceed `maxJoinFeePercent` % of the per-cycle contribution.
 *  2. Fee cannot exceed the absolute `maxJoinFeeKobo` cap (default ₦5,000).
 *  3. The effective cap = min(contribution × percent, absolute cap).
 *
 * These rules are also re-enforced server-side in circle-service.ts so
 * direct API callers cannot bypass the UI validation.
 */
export function buildCreateCircleSchema(
  settings = DEFAULT_PLATFORM_SETTINGS,
  unit: Unit = "NGN"
) {
  const {
    minContributionKobo,
    maxContributionKobo,
    minCircleMembers,
    maxCircleMembers,
    maxJoinFeePercent,
    maxJoinFeeKobo,
  } = settings.circles;

  const divisor = unit === "NGN" ? 100 : 1;
  const minContribution = minContributionKobo / divisor;
  const maxContribution = maxContributionKobo / divisor;
  // Absolute cap expressed in the current unit
  const absoluteCapInUnit = maxJoinFeeKobo / divisor;

  return z
    .object({
      name: z
        .string()
        .min(3, "Name must be at least 3 characters")
        .max(50, "Name must be under 50 characters"),
      description: z
        .string()
        .max(500, "Description must be under 500 characters")
        .optional()
        .or(z.literal("")),
      maxMembers: z
        .coerce.number()
        .int()
        .min(minCircleMembers, `Circle must have at least ${minCircleMembers} members`)
        .max(maxCircleMembers, `Maximum members allowed is ${maxCircleMembers}`),
      contribution: z
        .coerce.number()
        .positive("Contribution must be a positive amount")
        .min(
          minContribution,
          `Minimum contribution is ${unit === "NGN" ? "₦" : ""}${minContribution}${unit === "KOBO" ? " kobo" : ""}.`
        )
        .max(
          maxContribution,
          `Maximum contribution is ${unit === "NGN" ? "₦" : ""}${maxContribution}${unit === "KOBO" ? " kobo" : ""}.`
        ),
      frequency: z.enum(["daily", "weekly", "bi-weekly", "monthly"], {
        message: "Please select a valid frequency",
      }),
      payoutOrder: z.enum(["rotational", "random", "bidding"], {
        message: "Please select a valid payout order",
      }),
      isPrivate: z.boolean().default(false),
      invitePermission: z.enum(["admin", "members"]).default("admin"),
      tags: z.array(z.string()).max(5, "Max 5 tags allowed").optional().default([]),
      joinFeeEnabled: z.boolean().default(false),
      joinFee: z.coerce.number().min(0, "Join fee cannot be negative").default(0),
      joinFeeType: z
        .enum(["before_joining", "first_contribution"])
        .default("before_joining"),
    })
    .superRefine((data, ctx) => {
      if (!data.joinFeeEnabled || !data.joinFee || data.joinFee <= 0) return;

      const contribution = Number(data.contribution) || 0;
      if (contribution <= 0) return; // contribution validator will handle this

      // Effective cap = min(contribution × percent, absolute hard cap)
      const percentCapInUnit = (contribution * maxJoinFeePercent) / 100;
      const effectiveCapInUnit = Math.min(percentCapInUnit, absoluteCapInUnit);

      if (data.joinFee > effectiveCapInUnit) {
        const fmtContrib =
          unit === "NGN" ? `₦${contribution.toLocaleString("en-NG")}` : `${contribution} kobo`;
        const fmtCap =
          unit === "NGN"
            ? `₦${effectiveCapInUnit.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
            : `${Math.floor(effectiveCapInUnit)} kobo`;
        const fmtAbsCap =
          unit === "NGN"
            ? `₦${(absoluteCapInUnit).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
            : `${absoluteCapInUnit} kobo`;

        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: effectiveCapInUnit,
          inclusive: true,
          type: "number",
          origin: "number",
          path: ["joinFee"],
          message:
            `Join fee cannot exceed ${fmtCap} ` +
            `(${maxJoinFeePercent}% of ${fmtContrib} contribution, ` +
            `hard cap ${fmtAbsCap}).`,
        });
      }
    });
}

export const joinCircleSchema = z.object({
  inviteCode: z
    .string()
    .min(1, "Invite code is required for private circles")
    .optional(),
});

export const contributeSchema = z.object({
  amount: z.coerce.number().positive("Contribution amount is required"),
});

export const placeBidSchema = z.object({
  amount: z.coerce.number().positive("Bid amount must be positive"),
});

// Default client-side schema (NGN units)
export const createCircleSchema = buildCreateCircleSchema(
  DEFAULT_PLATFORM_SETTINGS,
  "NGN"
);

export type CreateCircleFormValues = z.input<typeof createCircleSchema>;
export type JoinCircleRequest = z.infer<typeof joinCircleSchema>;
export type ContributeRequest = z.infer<typeof contributeSchema>;
export type PlaceBidRequest = z.infer<typeof placeBidSchema>;