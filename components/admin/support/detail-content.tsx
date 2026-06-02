"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  useAdminSupportTicket,
  useAdminUpdateSupportTicket,
  useAdminAddSupportMessage,
} from "@/lib/hooks/use-support";
import { cn } from "@/lib/utils";
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_CATEGORIES,
} from "@/lib/types/support";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageSquare,
  User,
  Settings2,
  Mail,
  FileText,
} from "lucide-react";

interface AdminSupportDetailContentProps {
  ticketId: string;
}

interface AdminTicketMessage {
  id: string;
  senderRole: "user" | "agent";
  text: string;
  createdAt: string;
  isInternal: boolean;
  attachmentUrl?: string;
}

export function AdminSupportDetailContent({
  ticketId,
}: AdminSupportDetailContentProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<AdminTicketMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const ticketQuery = useAdminSupportTicket(ticketId);
  const updateMutation = useAdminUpdateSupportTicket(ticketId);
  const replyMutation = useAdminAddSupportMessage(ticketId);

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
            }) as AdminTicketMessage,
        ),
      );
    });
    return () => unsub();
  }, [ticketId]);

  useEffect(() => {
    if (ticketQuery.data?.ticket) {
      setStatus(ticketQuery.data.ticket.status);
      setPriority(ticketQuery.data.ticket.priority);
      setAssignedTo(ticketQuery.data.ticket.assignedTo ?? null);
    }
  }, [ticketQuery.data]);

  const submitUpdate = async () => {
    await updateMutation.mutateAsync({
      status: status || undefined,
      priority: priority || undefined,
      assignedTo,
    });
  };

  const submitReply = async () => {
    if (!replyText.trim()) return;
    await replyMutation.mutateAsync({ text: replyText.trim(), isInternal });
    setReplyText("");
  };

  const ticket = ticketQuery.data?.ticket;
  const user = ticketQuery.data?.user;

  if (ticketQuery.isLoading) {
    return <div>Loading ticket...</div>;
  }

  if (!ticket) {
    return (
      <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        Unable to load the support ticket.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/admin/support")}
      >
        <ArrowLeft className="mr-2" /> Back to Support
      </Button>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-3 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Ticket ID {ticket.id}
                  </p>
                </div>
                <Badge>{SUPPORT_STATUS_LABELS[ticket.status]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Category
                  </p>
                  <p className="mt-1 text-foreground">
                    {SUPPORT_CATEGORIES[ticket.category]}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Priority
                  </p>
                  <p className="mt-1 text-foreground capitalize">
                    {ticket.priority}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Updated
                  </p>
                  <p className="mt-1 text-foreground">
                    {new Date(ticket.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="rounded-3xl border border-border p-4 bg-muted">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                  <MessageSquare className="size-4" /> Conversation
                </div>
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-3xl border p-4",
                        message.senderRole === "agent"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-border bg-white",
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                        {message.senderRole === "agent" ? "Agent" : "User"}
                        {message.isInternal && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                            Internal
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {message.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="size-4" /> Send response
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="reply">Message</Label>
                <Textarea
                  id="reply"
                  rows={5}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(event) => setIsInternal(event.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Internal note</span>
                </label>
                <div className="text-sm text-muted-foreground">
                  Internal notes are visible only to support staff.
                </div>
              </div>
              <Button
                onClick={submitReply}
                disabled={!replyText.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending ? "Sending…" : "Post reply"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="size-4" /> Ticket controls
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value)}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUPPORT_STATUS_LABELS).map(
                        ([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(value) => setPriority(value)}
                  >
                    <SelectTrigger id="priority" className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUPPORT_PRIORITIES).map(
                        ([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assignedTo">Assignee</Label>
                  <Input
                    id="assignedTo"
                    value={assignedTo ?? ""}
                    onChange={(event) =>
                      setAssignedTo(event.target.value || null)
                    }
                    placeholder="Agent user ID"
                  />
                </div>
              </div>
              <Button
                onClick={submitUpdate}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4" /> Requester
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
              {user ? (
                <>
                  <div>
                    <p className="font-semibold text-foreground">{user.name}</p>
                    <p>{user.email}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Phone
                    </p>
                    <p>{user.phone ?? "Not provided"}</p>
                  </div>
                </>
              ) : (
                <p>User profile not available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
