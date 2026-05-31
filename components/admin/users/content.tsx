"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SearchIcon,
  FilterIcon,
  UsersIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserXIcon,
  UserCheckIcon,
  MoreHorizontalIcon,
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckSquareIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { UserDetailSheet } from "@/components/admin/users/user-detail-sheet";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  status: "active" | "suspended" | "banned";
  onboardingComplete: boolean;
  circleIds: string[];
  referralCode: string;
  referralBonusAmount: number;
  bankAccounts: any[];
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Status / Role badge helpers ──────────────────────────────────────────

const STATUS_META = {
  active: {
    label: "Active",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  suspended: {
    label: "Suspended",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  banned: {
    label: "Banned",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const ROLE_META = {
  admin: {
    label: "Admin",
    cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  user: {
    label: "User",
    cls: "bg-muted text-muted-foreground",
  },
};

// ─── Stat card ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="h-6 w-14" />
          ) : (
            <p className="text-xl font-bold font-mono">{value.toLocaleString()}</p>
          )}
        </div>
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("size-4", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────

function UserRow({
  user,
  selected,
  onSelect,
  onAction,
  onOpenDetail,
}: {
  user: AdminUser;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onAction: (id: string, action: string) => void;
  onOpenDetail: (user: AdminUser) => void;
}) {
  const statusMeta = STATUS_META[user.status] ?? STATUS_META.active;
  const roleMeta = ROLE_META[user.role] ?? ROLE_META.user;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const joinedStr = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors",
        selected ? "bg-primary/5" : "hover:bg-muted/30"
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelect(user.id, !!v)}
        aria-label={`Select ${user.name}`}
        className="shrink-0"
      />

      {/* Avatar */}
      <button
        type="button"
        className="shrink-0"
        onClick={() => onOpenDetail(user)}
      >
        <Avatar className="size-9">
          <AvatarImage src={user.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="text-left w-full group"
          onClick={() => onOpenDetail(user)}
        >
          <p className="text-sm font-medium text-foreground truncate leading-tight group-hover:text-primary transition-colors">
            {user.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </button>
      </div>

      {/* Status badge */}
      <div className="hidden sm:block shrink-0">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            statusMeta.cls
          )}
        >
          {statusMeta.label}
        </span>
      </div>

      {/* Role badge */}
      <div className="hidden md:block shrink-0">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            roleMeta.cls
          )}
        >
          {roleMeta.label}
        </span>
      </div>

      {/* Circles */}
      <div className="hidden lg:flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <UsersIcon className="size-3" />
        {user.circleIds.length} circle{user.circleIds.length !== 1 ? "s" : ""}
      </div>

      {/* Joined */}
      <p className="hidden lg:block text-xs text-muted-foreground shrink-0 w-24 text-right">
        {joinedStr}
      </p>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onOpenDetail(user)}>
            View profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.status !== "active" && (
            <DropdownMenuItem onClick={() => onAction(user.id, "activate")}>
              <UserCheckIcon className="size-4" />
              Activate
            </DropdownMenuItem>
          )}
          {user.status === "active" && (
            <DropdownMenuItem onClick={() => onAction(user.id, "suspend")}>
              <ShieldOffIcon className="size-4" />
              Suspend
            </DropdownMenuItem>
          )}
          {user.status !== "banned" && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onAction(user.id, "ban")}
            >
              <UserXIcon className="size-4" />
              Ban user
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {user.role === "user" ? (
            <DropdownMenuItem onClick={() => onAction(user.id, "promote")}>
              <ShieldCheckIcon className="size-4" />
              Promote to admin
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onAction(user.id, "demote")}>
              <UsersIcon className="size-4" />
              Demote to user
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────

export function AdminUsersContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [orderBy, setOrderBy] = useState("createdAt");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    banned: 0,
  });

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(
    async (cursor: string | null = null, reset = true) => {
      reset ? setIsLoading(true) : setIsLoadingMore(true);

      try {
        const params = new URLSearchParams({ limit: "20", orderBy });
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (roleFilter !== "all") params.set("role", roleFilter);
        if (search.trim()) params.set("search", search.trim());
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/users?${params}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error ?? "Failed to load users");

        const data: AdminUser[] = json.data ?? [];

        setUsers((prev) => (reset ? data : [...prev, ...data]));
        setHasMore(json.meta?.hasMore ?? false);
        setNextCursor(json.meta?.nextCursor ?? null);

        if (reset) {
          // Update stats from this batch (approximate, full counts would need aggregation)
          setStats({
            total: json.meta?.approximateTotal ?? data.length,
            active: data.filter((u) => u.status === "active").length,
            suspended: data.filter((u) => u.status === "suspended").length,
            banned: data.filter((u) => u.status === "banned").length,
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        reset ? setIsLoading(false) : setIsLoadingMore(false);
      }
    },
    [statusFilter, roleFilter, orderBy, search]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSelected(new Set());
      fetchUsers(null, true);
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, statusFilter, roleFilter, orderBy, fetchUsers]);

  // ── Selection ────────────────────────────────────────────────────────────

  function handleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(users.map((u) => u.id)) : new Set());
  }

  const allSelected = users.length > 0 && selected.size === users.length;
  const someSelected = selected.size > 0 && selected.size < users.length;

  // ── Single action ─────────────────────────────────────────────────────────

  async function handleAction(id: string, action: string) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Action failed");

      const actionLabels: Record<string, string> = {
        activate: "User activated",
        suspend: "User suspended",
        ban: "User banned",
        promote: "User promoted to admin",
        demote: "User demoted to regular user",
      };

      toast.success(actionLabels[action] ?? "Done");

      // Update local state optimistically
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== id) return u;
          const updates: Partial<AdminUser> = {};
          if (action === "activate") updates.status = "active";
          if (action === "suspend") updates.status = "suspended";
          if (action === "ban") updates.status = "banned";
          if (action === "promote") updates.role = "admin";
          if (action === "demote") updates.role = "user";
          return { ...u, ...updates };
        })
      );

      // Also update detail sheet if open
      if (detailUser?.id === id) {
        setDetailUser((prev) => {
          if (!prev) return prev;
          const updates: Partial<AdminUser> = {};
          if (action === "activate") updates.status = "active";
          if (action === "suspend") updates.status = "suspended";
          if (action === "ban") updates.status = "banned";
          if (action === "promote") updates.role = "admin";
          if (action === "demote") updates.role = "user";
          return { ...prev, ...updates };
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  }

  // ── Bulk action ────────────────────────────────────────────────────────────

  async function handleBulkAction() {
    if (!bulkAction || selected.size === 0) return;
    setIsSubmittingAction(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action: bulkAction }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Bulk action failed");

      toast.success(`${selected.size} user${selected.size !== 1 ? "s" : ""} updated`);
      setBulkAction(null);
      setSelected(new Set());
      fetchUsers(null, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // ── Stats aggregation ──────────────────────────────────────────────────────

  const derivedStats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    suspended: users.filter((u) => u.status === "suspended").length,
    banned: users.filter((u) => u.status === "banned").length,
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Users</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage all registered members and their access.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(null, true)}
            className="gap-1.5 self-start sm:self-auto"
          >
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total users"
            value={derivedStats.total}
            icon={UsersIcon}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            isLoading={isLoading}
          />
          <StatCard
            label="Active"
            value={derivedStats.active}
            icon={UserCheckIcon}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            isLoading={isLoading}
          />
          <StatCard
            label="Suspended"
            value={derivedStats.suspended}
            icon={ShieldOffIcon}
            iconBg="bg-amber-100 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
            isLoading={isLoading}
          />
          <StatCard
            label="Banned"
            value={derivedStats.banned}
            icon={UserXIcon}
            iconBg="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
            isLoading={isLoading}
          />
        </div>

        {/* ── Filters bar ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, email, or phone…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <FilterIcon className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orderBy} onValueChange={setOrderBy}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Newest first</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="email">Email (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Bulk action bar ── */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
            <CheckSquareIcon className="size-4 text-primary shrink-0" />
            <p className="text-sm font-medium text-foreground flex-1">
              {selected.size} user{selected.size !== 1 ? "s" : ""} selected
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5"
                onClick={() => setBulkAction("activate")}
              >
                <UserCheckIcon className="size-3.5" />
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5"
                onClick={() => setBulkAction("suspend")}
              >
                <ShieldOffIcon className="size-3.5" />
                Suspend
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setBulkAction("ban")}
              >
                <UserXIcon className="size-3.5" />
                Ban
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-muted-foreground"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <Card>
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                data-state={someSelected ? "indeterminate" : undefined}
                onCheckedChange={handleSelectAll}
                aria-label="Select all users"
              />
              <CardTitle className="text-sm text-muted-foreground font-normal flex-1">
                {isLoading
                  ? "Loading…"
                  : `${users.length} user${users.length !== 1 ? "s" : ""}${hasMore ? "+" : ""}`}
              </CardTitle>
              {/* Column labels — desktop only */}
              <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground">
                <span className="w-16 text-center">Status</span>
                <span className="w-14 text-center">Role</span>
                <span className="w-16 text-center">Circles</span>
                <span className="w-24 text-right">Joined</span>
                <span className="w-7" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
                  >
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="size-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
                    <Skeleton className="h-5 w-14 rounded-full hidden md:block" />
                    <Skeleton className="size-7 rounded-md" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                  <UsersIcon className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No users found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || statusFilter !== "all" || roleFilter !== "all"
                    ? "Try adjusting your filters."
                    : "No users are registered yet."}
                </p>
              </div>
            ) : (
              <div>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    selected={selected.has(user.id)}
                    onSelect={handleSelect}
                    onAction={handleAction}
                    onOpenDetail={setDetailUser}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Load more ── */}
        {hasMore && !isLoading && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {users.length} users
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={() => fetchUsers(nextCursor, false)}
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

      {/* ── User detail sheet ── */}
      <UserDetailSheet
        user={detailUser}
        open={!!detailUser}
        onOpenChange={(open) => !open && setDetailUser(null)}
        onAction={handleAction}
      />

      {/* ── Bulk confirm dialog ── */}
      <AlertDialog
        open={!!bulkAction}
        onOpenChange={(open) => !open && setBulkAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "ban"
                ? `Ban ${selected.size} user${selected.size !== 1 ? "s" : ""}?`
                : bulkAction === "suspend"
                ? `Suspend ${selected.size} user${selected.size !== 1 ? "s" : ""}?`
                : `Activate ${selected.size} user${selected.size !== 1 ? "s" : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "ban"
                ? "Banned users will be immediately signed out and unable to log in. Their active circles will not be affected."
                : bulkAction === "suspend"
                ? "Suspended users cannot log in until reactivated. Their data is preserved."
                : "Selected users will be restored to active status and can log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingAction}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant={bulkAction === "activate" ? "default" : "destructive"}
              disabled={isSubmittingAction}
              onClick={handleBulkAction}
            >
              {isSubmittingAction ? "Processing…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}