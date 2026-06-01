import { z } from "zod";

export const createSupportTicketSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(120, "Subject must be under 120 characters"),
  category: z.enum([
    "account_access",
    "payment_failure",
    "wallet_issue",
    "circle_problem",
    "feature_request",
    "general_inquiry",
  ]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  message: z.string().min(1, "Describe your issue so we can help."),
  screenshotUrl: z.string().url().optional(),
});

export const addSupportMessageSchema = z.object({
  text: z.string().min(1, "Message cannot be empty"),
  isInternal: z.boolean().optional(),
  attachmentUrl: z.string().url().optional(),
});

export const updateSupportTicketSchema = z.object({
  status: z
    .enum(["open", "in_progress", "waiting_on_user", "resolved", "closed"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
});

export type CreateSupportTicketValues = z.infer<typeof createSupportTicketSchema>;
export type AddSupportMessageValues = z.infer<typeof addSupportMessageSchema>;
export type UpdateSupportTicketValues = z.infer<typeof updateSupportTicketSchema>;
