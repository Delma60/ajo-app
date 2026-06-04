// Zod schemas for circle create/edit
// NOTE: These validators use default values that must match DEFAULT_PLATFORM_SETTINGS
// in lib/types/admin-settings.ts. Server-side validation in app/api/circles/route.ts
// re-validates against the live admin settings.

import { z } from "zod";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";

type Unit = "NGN" | "KOBO";

/**
 * Build a circle create schema based on provided settings.
 * `unit` controls whether the `contribution` field is validated as NGN (user-facing form)
 * or KOBO (server payloads). Defaults to `NGN`.
 */
export function buildCreateCircleSchema(
  settings = DEFAULT_PLATFORM_SETTINGS,
  unit: Unit = "NGN",
) {
  const minContributionKobo = settings.circles.minContributionKobo;
  const maxContributionKobo = settings.circles.maxContributionKobo;
  const minMembers = settings.circles.minCircleMembers;
  const maxMembers = settings.circles.maxCircleMembers;

  const contributionDivisor = unit === "NGN" ? 100 : 1;

  return z.object({
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
    .min(minMembers, `Circle must have at least ${minMembers} members`)
    .max(maxMembers, `Maximum members allowed is ${maxMembers}`),
  contribution: z
    .coerce.number()
    .positive("Contribution must be a positive amount")
    .min(minContributionKobo / contributionDivisor, `Minimum contribution is ${
      unit === "NGN" ? "₦" : ""
    }${minContributionKobo / contributionDivisor}${unit === "NGN" ? "" : " (kobo)"}.`)
    .max(maxContributionKobo / contributionDivisor, `Maximum contribution is ${
      unit === "NGN" ? "₦" : ""
    }${maxContributionKobo / contributionDivisor}${unit === "NGN" ? "" : " (kobo)"}.`),
  frequency: z.enum(["daily", "weekly", "bi-weekly", "monthly"], {
    message: "Please select a valid frequency",
  }),
  payoutOrder: z.enum(["rotational", "random", "bidding"], {
    message: "Please select a valid payout order",
  }),
  isPrivate: z.boolean().default(false),
  invitePermission: z.enum(["admin", "members"]).default("admin"),
  tags: z.array(z.string()).max(5, "Max 5 tags allowed").optional().default([]),
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

// Export a default schema for client forms (NGN units) to preserve existing imports.
export const createCircleSchema = buildCreateCircleSchema(DEFAULT_PLATFORM_SETTINGS, "NGN");

export type CreateCircleFormValues = z.input<typeof createCircleSchema>;
export type JoinCircleRequest = z.infer<typeof joinCircleSchema>;
export type ContributeRequest = z.infer<typeof contributeSchema>;
export type PlaceBidRequest = z.infer<typeof placeBidSchema>;