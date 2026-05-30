// Zod schemas for circle create/edit placeholder
import { z } from "zod";

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
    .max(50, "Maximum members allowed is 50"),
  contribution: z
    .coerce.number()
    .positive("Contribution must be a positive amount")
    .min(50000, "Minimum contribution is ₦500 (50,000 kobo)"),
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