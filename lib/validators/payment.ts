import { z } from "zod";

export const depositSchema = z.object({
  amount: z
    .number()
    .int()
    .positive()
    .refine((value) => value >= 50000, {
      message: "Minimum deposit is ₦500",
    }),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

export const withdrawSchema = z.object({
  amount: z.number().int().positive(),
  bankAccountId: z.string().min(1),
});

export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
