"use client";

import { useState } from "react";
import type { Metadata } from "next";
import { SupportTicketForm } from "@/components/support/ticket-form";
import { SupportTicketList } from "@/components/support/ticket-list";
import {
  useSupportTickets,
  useCreateSupportTicket,
} from "@/lib/hooks/use-support";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Support — AjoSave",
};

export default function SupportPage() {
  const ticketsQuery = useSupportTickets();
  const createTicketMutation = useCreateSupportTicket();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (values: any) => {
    setFeedback(null);
    try {
      await createTicketMutation.mutateAsync(values);
      setFeedback("Your ticket was submitted. Support will contact you soon.");
    } catch (error) {
      console.error(error);
      setFeedback("Unable to submit your ticket. Please try again.");
    }
  };

  return (
    <div className="space-y-8 py-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Support
            </p>
            <h1 className="text-3xl font-semibold">Contact our support team</h1>
          </div>
          <div className="rounded-3xl border border-border bg-muted p-4 text-sm text-muted-foreground">
            Support responses typically arrive within 24–48 hours.
          </div>
        </div>
        {feedback ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        ) : null}
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-background p-6">
            <h2 className="text-xl font-semibold">Create a new ticket</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Describe your issue clearly so support can help you faster.
            </p>
            <div className="mt-6">
              <SupportTicketForm
                onSubmit={handleSubmit}
                isLoading={createTicketMutation.isLoading}
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-background p-6">
            <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
              <AlertTriangle className="size-4 text-amber-600" />
              <span>Need an update?</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              If you have already submitted a ticket, check your open tickets
              for updates and replies.
            </p>
          </div>
          <div>
            {ticketsQuery.isLoading ? (
              <div className="rounded-3xl border border-border bg-muted p-6 text-sm text-muted-foreground">
                Loading your tickets...
              </div>
            ) : ticketsQuery.data ? (
              <SupportTicketList tickets={ticketsQuery.data} />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
