import { z } from "zod";

export const userProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be under 60 characters"),
  phone: z
    .string()
    .regex(/^(\+?234|0)[7-9][0-1]\d{8}$/, "Enter a valid Nigerian phone number"),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;
