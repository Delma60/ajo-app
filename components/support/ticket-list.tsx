import Link from "next/link";
import { Clock3, CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { SupportTicket, SUPPORT_STATUS_LABELS } from "@/lib/types/support";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SupportTicketListProps {
  tickets: SupportTicket[];
}

export function SupportTicketList({ tickets }: SupportTicketListProps) {
  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="text-sm font-semibold">No support tickets yet.</p>
          <p className="text-sm text-muted-foreground">
            Create a ticket and our support team will respond within 24–48
            hours.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <Card key={ticket.id}>
          <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">
                {ticket.subject}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {ticket.category.replace(/_/g, " ")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-1">
                {SUPPORT_STATUS_LABELS[ticket.status]}
              </span>
              <span>
                {formatDistanceToNowStrict(new Date(ticket.updatedAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 border-t border-border/60 p-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <MessageSquare className="size-4" />
              <span>
                Last updated{" "}
                {formatDistanceToNowStrict(new Date(ticket.lastMessageAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <Link
              href={`/support/${ticket.id}`}
              className={cn(
                "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600",
              )}
            >
              View ticket
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
