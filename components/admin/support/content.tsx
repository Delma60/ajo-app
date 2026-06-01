"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useAdminSupportStats,
  useAdminSupportTickets,
} from "@/lib/hooks/use-support";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUS_LABELS,
} from "@/lib/types/support";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SearchIcon } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export function AdminSupportContent() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(50);

  const statsQuery = useAdminSupportStats();
  const ticketsQuery = useAdminSupportTickets({
    search: search.trim(),
    status: status || undefined,
    category: category || undefined,
    limit,
  });

  const statusOptions = useMemo(
    () => ["", "open", "in_progress", "waiting_on_user", "resolved"],
    [],
  );

  const categoryOptions = useMemo(
    () => ["", ...Object.keys(SUPPORT_CATEGORIES)],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Open tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {statsQuery.isLoading ? "—" : (statsQuery.data?.totalOpen ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              In progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {statsQuery.isLoading
                ? "—"
                : (statsQuery.data?.totalInProgress ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Waiting on user
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {statsQuery.isLoading
                ? "—"
                : (statsQuery.data?.totalWaitingOnUser ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Unassigned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {statsQuery.isLoading ? "—" : (statsQuery.data?.unassigned ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Support tickets</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <SearchIcon className="size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search subject or ticket ID"
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {statusOptions.slice(1).map((value) => (
                  <SelectItem key={value} value={value}>
                    {
                      SUPPORT_STATUS_LABELS[
                        value as keyof typeof SUPPORT_STATUS_LABELS
                      ]
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categoryOptions.slice(1).map((value) => (
                  <SelectItem key={value} value={value}>
                    {
                      SUPPORT_CATEGORIES[
                        value as keyof typeof SUPPORT_CATEGORIES
                      ]
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {ticketsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : ticketsQuery.data?.length ? (
            <div className="space-y-3">
              {ticketsQuery.data.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/admin/support/${ticket.id}`}
                  className="block rounded-3xl border border-border p-4 transition hover:border-emerald-300"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.category.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {SUPPORT_STATUS_LABELS[ticket.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Updated{" "}
                        {formatDistanceToNowStrict(
                          new Date(ticket.lastMessageAt),
                          { addSuffix: true },
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Priority: {ticket.priority}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted p-8 text-center text-sm text-muted-foreground">
              No support tickets match your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
