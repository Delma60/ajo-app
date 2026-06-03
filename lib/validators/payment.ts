import { z } from "zod";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";

/**
 * Build a deposit schema based on provided settings.
 * Validates amount in KOBO (server payloads).
 */
export function buildDepositSchema(settings = DEFAULT_PLATFORM_SETTINGS) {
  const minDepositKobo = settings.wallet.minDepositKobo;
  return z.object({
    amount: z
      .number()
      .int()
      .positive()
      .refine((value) => value >= minDepositKobo, {
        message: `Minimum deposit is ₦${minDepositKobo / 100}`,
      }),
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
  });
}

/**
 * Build a withdrawal schema based on provided settings.
 * Validates amount in KOBO (server payloads).
 */
export function buildWithdrawSchema(settings = DEFAULT_PLATFORM_SETTINGS) {
  const minWithdrawKobo = settings.wallet.minWithdrawKobo;
  return z.object({
    amount: z
      .number()
      .int()
      .positive()
      .refine((value) => value >= minWithdrawKobo, {
        message: `Minimum withdrawal is ₦${minWithdrawKobo / 100}`,
      })
      .refine((value) => value <= settings.wallet.maxWithdrawKobo, {
        message: `Maximum withdrawal is ₦${settings.wallet.maxWithdrawKobo / 100}`,
      }),
    bankAccountId: z.string().min(1, "Bank account is required"),
  });
}

// Export default schemas for backward compatibility
export const depositSchema = buildDepositSchema();
export const withdrawSchema = buildWithdrawSchema();

export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
