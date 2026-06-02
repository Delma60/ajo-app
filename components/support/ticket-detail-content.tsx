"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  useSupportTicket,
  useAddSupportMessage,
} from "@/lib/hooks/use-support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportTicket, SUPPORT_STATUS_LABELS } from "@/lib/types/support";
import { cn } from "@/lib/utils";
import { MessageSquare, User, CheckCircle2, ArrowLeft } from "lucide-react";

interface SupportTicketDetailContentProps {
  ticketId: string;
}

interface TicketMessage {
  id: string;
  senderRole: "user" | "agent";
  text: string;
  createdAt: string;
  isInternal: boolean;
  attachmentUrl?: string;
}

export function SupportTicketDetailContent({
  ticketId,
}: SupportTicketDetailContentProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: ticket, isLoading, error } = useSupportTicket(ticketId);
  const addMessage = useAddSupportMessage(ticketId);

  useEffect(() => {
    if (!ticketId) return;
    const q = query(
      collection(db, "support_tickets", ticketId, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as TicketMessage,
        ),
      );
    });
    return () => unsub();
  }, [ticketId]);

  const submitMessage = async () => {
    if (!messageText.trim()) return;
    setIsSubmitting(true);
    try {
      await addMessage.mutateAsync({ text: messageText.trim() });
      setMessageText("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!ticket) return null;
    return SUPPORT_STATUS_LABELS[ticket.status];
  }, [ticket]);

  if (isLoading) {
    return <div className="space-y-4">Loading ticket...</div>;
  }

  if (error || !ticket) {
    return (
      <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load support ticket.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/support")}>
        <ArrowLeft className="mr-2" /> Back to tickets
      </Button>

      <Card>
        <CardHeader className="space-y-3 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-lg">{ticket.subject}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {ticket.category.replace(/_/g, " ")}
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {statusBadge}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted p-4 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
                Priority
              </p>
              <p className="mt-1 font-semibold capitalize">{ticket.priority}</p>
            </div>
            <div className="rounded-2xl bg-muted p-4 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
                Last updated
              </p>
              <p className="mt-1">
                {new Date(ticket.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl bg-muted p-4 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
                Ticket ID
              </p>
              <p className="mt-1 font-mono text-sm">{ticket.id}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="size-4" /> Conversation
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 max-h-[60vh] overflow-y-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-3xl border p-4",
                    message.senderRole === "agent"
                      ? "border-emerald-200 bg-emerald-50 text-foreground self-end"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {message.senderRole === "agent" ? "Agent" : "You"}
                    {message.isInternal && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                        Internal note
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {message.text}
                  </p>
                  {message.attachmentUrl ? (
                    <a
                      href={message.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm text-primary"
                    >
                      View attachment
                    </a>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="size-4" /> Add a reply
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="reply">Message</Label>
                <Textarea
                  id="reply"
                  rows={5}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                />
              </div>
              <Button
                onClick={submitMessage}
                disabled={isSubmitting || !messageText.trim()}
              >
                {isSubmitting ? "Sending…" : "Send reply"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card>
            <CardHeader className="p-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="size-4" /> Ticket details
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Category
                </p>
                <p className="mt-1 text-foreground">
                  {ticket.category.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Priority
                </p>
                <p className="mt-1 text-foreground capitalize">
                  {ticket.priority}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Status
                </p>
                <p className="mt-1 text-foreground">{statusBadge}</p>
              </div>
              {ticket.screenshotUrl ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Screenshot
                  </p>
                  <a
                    href={ticket.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex text-primary"
                  >
                    View attachment
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
