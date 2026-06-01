// Zod schemas for circle create/edit
// NOTE: These validators use default values that must match DEFAULT_PLATFORM_SETTINGS
// in lib/types/admin-settings.ts. Server-side validation in app/api/circles/route.ts
// re-validates against the live admin settings.

import { z } from "zod";

// Constants matching DEFAULT_PLATFORM_SETTINGS.circles
const MIN_CONTRIBUTION_KOBO = 50_000; // ₦500
const MAX_CONTRIBUTION_KOBO = 100_000_000; // ₦1,000,000
const MIN_CIRCLE_MEMBERS = 2;
const MAX_CIRCLE_MEMBERS = 50;

export const createCircleSchema = z.object({
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
    .min(2, "Circle must have at least 2 members")
    .min(MIN_CIRCLE_MEMBERS, `Circle must have at least ${MIN_CIRCLE_MEMBERS} members`)
    .max(MAX_CIRCLE_MEMBERS, `Maximum members allowed is ${MAX_CIRCLE_MEMBERS}`),
  contribution: z
    .coerce.number()
    .positive("Contribution must be a positive amount")
    .min(1000, "Minimum contribution is ₦1000"),
    .min(MIN_CONTRIBUTION_KOBO / 100, `Minimum contribution is ₦${MIN_CONTRIBUTION_KOBO / 100}.`)
    .max(MAX_CONTRIBUTION_KOBO / 100, `Maximum contribution is ₦${MAX_CONTRIBUTION_KOBO / 100}.`),
  frequency: z.enum(["daily", "weekly", "bi-weekly", "monthly"], {
    message: "Please select a valid frequency",
  }),
  payoutOrder: z.enum(["rotational", "random", "bidding"], {
    message: "Please select a valid payout order",
  }),
  isPrivate: z.boolean().default(false),
  tags: z.array(z.string()).max(5, "Max 5 tags allowed").optional().default([]),
});

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

export type CreateCircleFormValues = z.infer<typeof createCircleSchema>;
export type JoinCircleRequest = z.infer<typeof joinCircleSchema>;
export type ContributeRequest = z.infer<typeof contributeSchema>;
export type PlaceBidRequest = z.infer<typeof placeBidSchema>;