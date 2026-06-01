"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BellIcon,
  BellRingIcon,
  SearchIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ChevronRightIcon,
  FilterIcon,
  XIcon,
  TrashIcon,
  CheckCheck,
  SendIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  UserIcon,
  CalendarIcon,
  LinkIcon,
  MoreHorizontalIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  MailOpenIcon,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { NotificationStatsStrip } from "@/components/admin/notifications/stats-strip";
import type {
  AdminNotification,
  AdminNotificationStats,
} from "@/lib/types/admin-notification";
import { NOTIFICATION_TYPE_META } from "@/lib/types/admin-notification";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateTime(iso);
}

// ─── Send Notification Dialog ─────────────────────────────────────────────────

interface SendNotifDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}

function SendNotificationDialog({
  open,
  onOpenChange,
  onSent,
}: SendNotifDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<
    {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
    }[]
  >([]);
  const [userQuery, setUserQuery] = useState("");
  const [userOptions, setUserOptions] = useState<
    {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
    }[]
  >([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const userSearchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [type, setType] = useState<string>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [isSending, setIsSending] = useState(false);

  function reset() {
    setSelectedUsers([]);
    setUserQuery("");
    setUserOptions([]);
    setIsSearchingUsers(false);
    setType("general");
    setTitle("");
    setBody("");
    setLink("");
  }

  async function handleSend() {
    if (selectedUsers.length === 0 || !title.trim() || !body.trim()) {
      toast.error("Select at least one user, and provide title and body.");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedUsers.map((u) => u.id),
          type,
          title: title.trim(),
          body: body.trim(),
          link: link.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to send");
      toast.success("Notification sent successfully");
      onSent();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification");
    } finally {
      setIsSending(false);
    }
  }

  // Debounced user search
  async function fetchUserOptions(query: string) {
    if (!query.trim()) {
      setUserOptions([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const params = new URLSearchParams({ limit: "10", search: query });
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (json.success) setUserOptions(json.data ?? []);
    } catch (e) {
      // ignore
    } finally {
      setIsSearchingUsers(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="size-4 text-primary" />
            Send Notification
          </DialogTitle>
          <DialogDescription>
            Manually send an in-app notification to one or more users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Recipients <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                {selectedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-muted text-sm"
                  >
                    <Avatar className="size-5">
                      <AvatarImage src={u.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {u.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[180px] truncate text-xs">
                      {u.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedUsers((prev) =>
                          prev.filter((p) => p.id !== u.id),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <Input
                placeholder="Search users by name, email, or phone"
                value={userQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setUserQuery(v);
                  if (userSearchTimerRef.current)
                    clearTimeout(userSearchTimerRef.current);
                  userSearchTimerRef.current = setTimeout(
                    () => fetchUserOptions(v),
                    300,
                  );
                }}
                className="pl-3 text-sm"
              />

              {userOptions.length > 0 && userQuery.trim() && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-56 overflow-auto">
                  {userOptions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        if (!selectedUsers.find((s) => s.id === u.id)) {
                          setSelectedUsers((prev) => [...prev, u]);
                        }
                        setUserQuery("");
                        setUserOptions([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-3"
                    >
                      <Avatar className="size-6">
                        <AvatarImage src={u.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {u.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Search and pick one or more users to receive this notification.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NOTIFICATION_TYPE_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span>{meta.icon}</span>
                      {meta.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Notification title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Notification body text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none text-sm"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {body.length}/500
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Deep Link{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <div className="relative">
              <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="/circles/abc123 or /wallet"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              isSending ||
              selectedUsers.length === 0 ||
              !title.trim() ||
              !body.trim()
            }
            className="gap-1.5"
          >
            {isSending ? (
              <RefreshCwIcon className="size-3.5 animate-spin" />
            ) : (
              <SendIcon className="size-3.5" />
            )}
            {isSending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notification Detail Sheet ────────────────────────────────────────────────

function NotificationDetailSheet({
  notification,
  open,
  onOpenChange,
  onToggleRead,
  onDelete,
}: {
  notification: AdminNotification | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (!notification) return null;

  const typeMeta =
    NOTIFICATION_TYPE_META[notification.type] ?? NOTIFICATION_TYPE_META.general;
  const initials = notification.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl text-lg",
                "bg-muted",
              )}
            >
              {typeMeta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm font-semibold leading-tight line-clamp-2">
                {notification.title}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                    typeMeta.badgeCls,
                  )}
                >
                  {typeMeta.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    notification.read
                      ? "bg-muted text-muted-foreground"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                  )}
                >
                  {notification.read ? "Read" : "Unread"}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Message */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Message
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm text-foreground leading-relaxed">
                {notification.body}
              </p>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Recipient
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={notification.userAvatarUrl ?? undefined} />
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {notification.userName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {notification.userEmail}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href={`/admin/users`}>
                  <ExternalLinkIcon className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Details
            </p>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-muted-foreground">
                  Notification ID
                </span>
                <span className="text-xs font-mono text-foreground truncate max-w-[160px]">
                  {notification.id}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-muted-foreground">User ID</span>
                <span className="text-xs font-mono text-foreground truncate max-w-[160px]">
                  {notification.userId}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-muted-foreground">Created</span>
                <span className="text-xs text-foreground">
                  {fmtDateTime(notification.createdAt)}
                </span>
              </div>
              {notification.link && (
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">
                    Deep link
                  </span>
                  <a
                    href={notification.link}
                    className="text-xs text-primary hover:underline truncate max-w-[160px]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {notification.link}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions footer */}
        <div className="border-t border-border px-5 py-4 flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => {
              onToggleRead(notification.id, !notification.read);
              onOpenChange(false);
            }}
          >
            {notification.read ? (
              <>
                <EyeOffIcon className="size-3.5" /> Mark unread
              </>
            ) : (
              <>
                <CheckCircle2Icon className="size-3.5" /> Mark read
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
            onClick={() => {
              onDelete(notification.id);
              onOpenChange(false);
            }}
          >
            <TrashIcon className="size-3.5" />
            Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onOpenDetail,
  onToggleRead,
  onDelete,
}: {
  notification: AdminNotification;
  onOpenDetail: (n: AdminNotification) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const typeMeta =
    NOTIFICATION_TYPE_META[notification.type] ?? NOTIFICATION_TYPE_META.general;
  const initials = notification.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors group",
        !notification.read && "bg-blue-50/50 dark:bg-blue-950/10",
      )}
    >
      {/* Unread indicator */}
      <div className="shrink-0 mt-2 flex items-center justify-center w-2">
        {!notification.read && (
          <span className="size-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
        )}
      </div>

      {/* Type icon */}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base">
        {typeMeta.icon}
      </div>

      {/* Content — clickable */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => onOpenDetail(notification)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm leading-tight truncate",
                !notification.read
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/80",
              )}
            >
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
              {notification.body}
            </p>
          </div>

          {/* Type badge — hidden on mobile */}
          <span
            className={cn(
              "hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0",
              typeMeta.badgeCls,
            )}
          >
            {typeMeta.label}
          </span>
        </div>

        {/* User + timestamp */}
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
          <Avatar className="size-4 shrink-0">
            <AvatarImage src={notification.userAvatarUrl ?? undefined} />
            <AvatarFallback className="text-[8px] font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate max-w-[140px]">
            {notification.userName}
          </span>
          <span className="shrink-0">·</span>
          <span className="shrink-0">
            {fmtRelative(notification.createdAt)}
          </span>
          {notification.link && (
            <>
              <span className="shrink-0">·</span>
              <LinkIcon className="size-3 shrink-0" />
            </>
          )}
        </div>
      </button>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => onOpenDetail(notification)}
            className="gap-2"
          >
            <EyeIcon className="size-3.5" />
            View detail
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onToggleRead(notification.id, !notification.read)}
            className="gap-2"
          >
            {notification.read ? (
              <>
                <EyeOffIcon className="size-3.5" /> Mark unread
              </>
            ) : (
              <>
                <CheckCircle2Icon className="size-3.5" /> Mark read
              </>
            )}
          </DropdownMenuItem>
          {notification.link && (
            <DropdownMenuItem asChild className="gap-2">
              <Link href={notification.link} target="_blank">
                <ExternalLinkIcon className="size-3.5" />
                Follow link
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(notification.id)}
            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <TrashIcon className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0">
      <Skeleton className="size-2 rounded-full shrink-0 mt-2" />
      <Skeleton className="size-9 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-52" />
            <Skeleton className="h-3 w-72" />
          </div>
          <Skeleton className="hidden sm:block h-5 w-24 rounded-full shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-full shrink-0" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="size-7 rounded-md shrink-0" />
    </div>
  );
}

// ─── Filters bar ──────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  type: string;
  read: string;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  type: "all",
  read: "all",
};

function FiltersBar({
  filters,
  onChange,
  activeCount,
  onClear,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  activeCount: number;
  onClear: () => void;
}) {
  function update(partial: Partial<Filters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Search */}
      <div className="relative flex-1">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search title, body, or user…"
          className="pl-8"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
        />
      </div>

      {/* Type */}
      <Select value={filters.type} onValueChange={(v) => update({ type: v })}>
        <SelectTrigger className="w-full sm:w-[170px]">
          <FilterIcon className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {Object.entries(NOTIFICATION_TYPE_META).map(([key, meta]) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-2">
                <span>{meta.icon}</span>
                {meta.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Read status */}
      <Select value={filters.read} onValueChange={(v) => update({ read: v })}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="false">Unread</SelectItem>
          <SelectItem value="true">Read</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground shrink-0"
          onClick={onClear}
        >
          <XIcon className="size-3.5" />
          Clear ({activeCount})
        </Button>
      )}
    </div>
  );
}

// ─── Bulk delete confirm ──────────────────────────────────────────────────────

function DeleteReadConfirmDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all read notifications?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete{" "}
            <strong>
              {count.toLocaleString()} read notification{count !== 1 ? "s" : ""}
            </strong>{" "}
            across all users. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? (
              <>
                <RefreshCwIcon className="size-3.5 mr-1.5 animate-spin" />{" "}
                Deleting…
              </>
            ) : (
              "Delete all read"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminNotificationsContent() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [stats, setStats] = useState<AdminNotificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeStatsFilter, setActiveStatsFilter] = useState<string>("all");

  const [detailNotif, setDetailNotif] = useState<AdminNotification | null>(
    null,
  );
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showDeleteReadDialog, setShowDeleteReadDialog] = useState(false);
  const [isBulkMarkingRead, setIsBulkMarkingRead] = useState(false);
  const [isDeletingRead, setIsDeletingRead] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(
    async (cursor: string | null = null, reset = true) => {
      reset ? setIsLoading(true) : setIsLoadingMore(true);
      setHasError(false);

      try {
        const params = new URLSearchParams({ limit: "30" });

        if (filters.type !== "all") params.set("type", filters.type);
        if (filters.read !== "all") params.set("read", filters.read);
        if (filters.search.trim()) params.set("search", filters.search.trim());

        // Translate stats strip filter to query params
        if (activeStatsFilter === "true") params.set("read", "true");
        if (activeStatsFilter === "false") params.set("read", "false");
        if (
          activeStatsFilter !== "all" &&
          activeStatsFilter !== "true" &&
          activeStatsFilter !== "false"
        ) {
          params.set("type", activeStatsFilter);
        }

        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/notifications?${params}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? "Failed to load");

        setNotifications((prev) =>
          reset ? json.data : [...prev, ...json.data],
        );
        setHasMore(json.meta?.hasMore ?? false);
        setNextCursor(json.meta?.nextCursor ?? null);
        if (reset && json.meta?.stats) setStats(json.meta.stats);
      } catch (err) {
        setHasError(true);
        toast.error(
          err instanceof Error ? err.message : "Failed to load notifications",
        );
      } finally {
        reset ? setIsLoading(false) : setIsLoadingMore(false);
      }
    },
    [filters, activeStatsFilter],
  );

  // Debounce search, immediate otherwise
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const delay = filters.search ? 400 : 0;
    searchTimerRef.current = setTimeout(
      () => fetchNotifications(null, true),
      delay,
    );
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, activeStatsFilter, fetchNotifications]);

  // ── Toggle read ────────────────────────────────────────────────────────────

  const handleToggleRead = useCallback(async (id: string, read: boolean) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read } : n)),
    );
    setStats((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        read: read ? prev.read + 1 : prev.read - 1,
        unread: read ? prev.unread - 1 : prev.unread + 1,
      };
    });

    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(read ? "Marked as read" : "Marked as unread");
    } catch (err) {
      // Revert
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: !read } : n)),
      );
      toast.error("Failed to update notification");
    }
  }, []);

  // ── Delete single ──────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      const removed = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      try {
        const res = await fetch(`/api/admin/notifications/${id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        toast.success("Notification deleted");
        if (stats) {
          setStats({
            ...stats,
            total: stats.total - 1,
            read: removed?.read ? stats.read - 1 : stats.read,
            unread: !removed?.read ? stats.unread - 1 : stats.unread,
          });
        }
      } catch (err) {
        if (removed) setNotifications((prev) => [...prev, removed]);
        toast.error("Failed to delete notification");
      }
    },
    [notifications, stats],
  );

  // ── Bulk mark all read ─────────────────────────────────────────────────────

  async function handleMarkAllRead() {
    setIsBulkMarkingRead(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(
        `Marked ${json.data?.count ?? "all"} notifications as read`,
      );
      fetchNotifications(null, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to mark all as read");
    } finally {
      setIsBulkMarkingRead(false);
    }
  }

  // ── Bulk delete read ───────────────────────────────────────────────────────

  async function handleDeleteRead() {
    setIsDeletingRead(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_read" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Deleted ${json.data?.count ?? 0} read notifications`);
      setShowDeleteReadDialog(false);
      fetchNotifications(null, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete read notifications");
    } finally {
      setIsDeletingRead(false);
    }
  }

  // ── Active filter count ────────────────────────────────────────────────────

  const activeFilterCount = [
    filters.type !== "all",
    filters.read !== "all",
  ].filter(Boolean).length;

  const hasUnread = (stats?.unread ?? 0) > 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BellIcon className="size-5 text-muted-foreground" />
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor and manage all in-app notifications across the platform.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNotifications(null, true)}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCwIcon
                className={cn("size-3.5", isLoading && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setShowSendDialog(true)}
              className="gap-1.5"
            >
              <PlusIcon className="size-3.5" />
              Send notification
            </Button>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <NotificationStatsStrip
          stats={stats}
          isLoading={isLoading}
          activeFilter={activeStatsFilter}
          onFilterChange={(f) => {
            setActiveStatsFilter(f);
            // Also reset read filter to avoid conflict
            if (f === "true" || f === "false") {
              setFilters((prev) => ({ ...prev, read: "all" }));
            }
          }}
        />

        {/* ── Bulk action bar ── */}
        {hasUnread && !isLoading && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-blue-50/50 dark:bg-blue-950/10 px-4 py-2.5">
            <BellRingIcon className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-400 flex-1">
              <span className="font-semibold">
                {(stats?.unread ?? 0).toLocaleString()} unread
              </span>{" "}
              notification{(stats?.unread ?? 0) !== 1 ? "s" : ""} across all
              users.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
              onClick={handleMarkAllRead}
              disabled={isBulkMarkingRead}
            >
              {isBulkMarkingRead ? (
                <RefreshCwIcon className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Mark all read
            </Button>
          </div>
        )}

        {/* ── Filters ── */}
        <FiltersBar
          filters={filters}
          onChange={setFilters}
          activeCount={activeFilterCount}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        />

        {/* ── Result count ── */}
        {!isLoading && !hasError && (
          <p className="text-xs text-muted-foreground">
            {notifications.length} notification
            {notifications.length !== 1 ? "s" : ""}
            {hasMore ? "+" : ""} found
          </p>
        )}

        {/* ── Table ── */}
        <Card>
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                {isLoading
                  ? "Loading…"
                  : `${notifications.length} result${notifications.length !== 1 ? "s" : ""}${hasMore ? "+" : ""}`}
              </CardTitle>

              {/* Delete read bulk action */}
              {(stats?.read ?? 0) > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setShowDeleteReadDialog(true)}
                >
                  <TrashIcon className="size-3.5" />
                  Delete read ({(stats?.read ?? 0).toLocaleString()})
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div>
                {Array.from({ length: 10 }).map((_, i) => (
                  <NotificationRowSkeleton key={i} />
                ))}
              </div>
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircleIcon className="size-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Failed to load notifications
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNotifications(null, true)}
                  className="gap-1.5"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <MailOpenIcon className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No notifications found</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {activeFilterCount > 0 || filters.search
                    ? "Try adjusting your filters."
                    : "No notifications have been generated yet."}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onOpenDetail={setDetailNotif}
                  onToggleRead={handleToggleRead}
                  onDelete={handleDelete}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* ── Load more ── */}
        {hasMore && !isLoading && !hasError && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {notifications.length} notification
              {notifications.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={() => fetchNotifications(nextCursor, false)}
              className="gap-1.5"
            >
              {isLoadingMore ? (
                <RefreshCwIcon className="size-3.5 animate-spin" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
              {isLoadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Dialogs & Sheets ── */}
      <NotificationDetailSheet
        notification={detailNotif}
        open={!!detailNotif}
        onOpenChange={(open) => !open && setDetailNotif(null)}
        onToggleRead={handleToggleRead}
        onDelete={handleDelete}
      />

      <SendNotificationDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        onSent={() => fetchNotifications(null, true)}
      />

      <DeleteReadConfirmDialog
        open={showDeleteReadDialog}
        onOpenChange={setShowDeleteReadDialog}
        count={stats?.read ?? 0}
        onConfirm={handleDeleteRead}
        isLoading={isDeletingRead}
      />
    </div>
  );
}
