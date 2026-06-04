"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WalletIcon,
  SettingsIcon,
  CircleDollarSignIcon,
  CoinsIcon,
  TrendingUpIcon,
  ShieldCheckIcon,
  BellIcon,
  AlertTriangleIcon,
  SaveIcon,
  RotateCcwIcon,
  RefreshCwIcon,
  InfoIcon,
  CheckCircle2Icon,
  ClockIcon,
  ChevronDownIcon,
  HistoryIcon,
  UserIcon,
  AlertCircleIcon,
  CopyIcon,
  DownloadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PlatformSettings } from "@/lib/types/admin-settings";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";

// --- Constants ---

const TABS = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "appDistribution", label: "App", icon: DownloadIcon },
  { id: "wallet", label: "Wallet", icon: WalletIcon },
  { id: "circles", label: "Circles", icon: CircleDollarSignIcon },
  { id: "payouts", label: "Payouts", icon: CoinsIcon },
  { id: "investments", label: "Investments", icon: TrendingUpIcon },
  { id: "trustScore", label: "Trust Score", icon: ShieldCheckIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "maintenance", label: "Maintenance", icon: AlertTriangleIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

// --- Helpers ------------------------------------------------------------------

function koboToNaira(kobo: number): string {
  return (kobo / 100).toLocaleString("en-NG");
}

function nairaToKobo(naira: string): number {
  return Math.round(parseFloat(naira.replace(/,/g, "")) * 100);
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

// --- SettingRow component -----------------------------------------------------

function SettingRow({
  label,
  description,
  tip,
  children,
  changed,
}: {
  label: string;
  description?: string;
  tip?: string;
  children: React.ReactNode;
  changed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 border-b border-border last:border-0 transition-colors",
        changed && "bg-amber-50/50 dark:bg-amber-950/20 -mx-4 px-4 rounded-lg",
      )}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium leading-none">{label}</Label>
          {changed && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-semibold">
              modified
            </span>
          )}
          {tip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {tip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// --- NairaInput component -----------------------------------------------------

function NairaInput({
  valueKobo,
  onChange,
  min = 0,
  max,
  placeholder = "0",
  className,
}: {
  valueKobo: number;
  onChange: (kobo: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(koboToNaira(valueKobo));

  useEffect(() => {
    setRaw(koboToNaira(valueKobo));
  }, [valueKobo]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <span className="absolute left-3 text-sm font-semibold text-muted-foreground select-none">
        ₦
      </span>
      <Input
        className="pl-7 font-mono text-right w-36"
        value={raw}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, "");
          setRaw(v);
        }}
        onBlur={() => {
          const parsed = parseFloat(raw.replace(/,/g, ""));
          if (isNaN(parsed)) {
            setRaw(koboToNaira(valueKobo));
            return;
          }
          const kobo = Math.round(parsed * 100);
          const clamped = Math.max(
            min,
            max !== undefined ? Math.min(max, kobo) : kobo,
          );
          onChange(clamped);
          setRaw(koboToNaira(clamped));
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

// --- PercentInput -------------------------------------------------------------

function PercentInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="relative flex items-center">
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-24 text-right font-mono pr-7"
      />
      <span className="absolute right-3 text-sm font-semibold text-muted-foreground select-none">
        %
      </span>
    </div>
  );
}

// --- NumberInput --------------------------------------------------------------

function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <div className="relative flex items-center">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v))
            onChange(
              max !== undefined
                ? Math.min(max, Math.max(min, v))
                : Math.max(min, v),
            );
        }}
        className={cn("font-mono text-right", unit ? "pr-14 w-32" : "w-24")}
      />
      {unit && (
        <span className="absolute right-3 text-xs text-muted-foreground select-none whitespace-nowrap">
          {unit}
        </span>
      )}
    </div>
  );
}

// --- SectionHeader ------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  title,
  description,
  color,
  hasChanges,
  isSaving,
  onSave,
  onDiscard,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            color,
          )}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {hasChanges && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={isSaving}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCcwIcon className="size-3.5" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-8 gap-1.5 text-xs"
          >
            {isSaving ? (
              <RefreshCwIcon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Audit Log component ------------------------------------------------------

interface AuditEntry {
  id: string;
  adminName: string;
  section: string;
  changes: Record<string, unknown>;
  createdAt: string | null;
}

function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/admin/settings/audit")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setLogs(j.data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <HistoryIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Change History</span>
        </div>
        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="size-7 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-3 w-20 shrink-0" />
              </div>
            ))
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No changes recorded yet.
            </div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                  <UserIcon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {entry.adminName}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      updated{" "}
                      <span className="capitalize">{entry.section}</span>{" "}
                      settings
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {Object.entries(entry.changes)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" Â· ")}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                  {entry.createdAt
                    ? new Intl.DateTimeFormat("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Africa/Lagos",
                      }).format(new Date(entry.createdAt))
                    : "—"}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Content -------------------------------------------------------------

export function AdminSettingsContent() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [serverIpError, setServerIpError] = useState<string | null>(null);
  const [isFetchingServerIp, setIsFetchingServerIp] = useState(false);
  const [platformIpError, setPlatformIpError] = useState<string | null>(null);
  const [androidFile, setAndroidFile] = useState<File | null>(null);
  const [iosFile, setIosFile] = useState<File | null>(null);
  const [uploadingPlatform, setUploadingPlatform] = useState<
    "android" | "ios" | null
  >(null);

  // -- Load settings ---------------------------------------------------------

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSettings(json.data);
      setDraft(json.data);
      setLastUpdated(json.data.updatedAt ?? null);
      setLastUpdatedBy(json.data.updatedByName ?? null);
    } catch (err) {
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab !== "general") return;
    if (serverIp || isFetchingServerIp) return;

    setIsFetchingServerIp(true);
    setServerIpError(null);

    fetch("/api/admin/server-ip")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success)
          throw new Error(json.error || "Failed to fetch server IP");
        setServerIp(json.data.ip);
      })
      .catch((err) => {
        console.error("Failed to fetch server IP", err);
        setServerIp(null);
        setServerIpError("Unable to detect server IP. Try again later.");
      })
      .finally(() => setIsFetchingServerIp(false));
  }, [activeTab, serverIp, isFetchingServerIp]);

  // -- Derived change tracking -----------------------------------------------

  function hasChanges(section: TabId): boolean {
    if (!settings || !draft) return false;
    const s = settings[section];
    const d = draft[section];
    return JSON.stringify(s) !== JSON.stringify(d);
  }

  function discardSection(section: TabId) {
    if (!settings) return;
    setDraft((prev) =>
      prev ? { ...prev, [section]: { ...settings[section] } } : prev,
    );
  }

  // -- Save section ---------------------------------------------------------

  async function saveSection(section: TabId) {
    if (!draft) return;
    if (section === "general") {
      const ipValue = draft.general?.platformIpAddress?.trim();
      if (ipValue && !isValidIp(ipValue)) {
        setPlatformIpError("Enter a valid IPv4 or IPv6 address.");
        toast.error("Invalid platform IP address");
        return;
      }
    }

    setSavingSection(section);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, updates: draft[section] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Update local state first
      setSettings((prev) =>
        prev ? { ...prev, [section]: draft[section] } : prev,
      );
      setLastUpdated(new Date().toISOString());

      // Refetch from server to ensure cache is invalidated and we have fresh data
      await loadSettings();

      toast.success(
        `${TABS.find((t) => t.id === section)?.label} settings saved`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingSection(null);
    }
  }

  // -- Reset all ------------------------------------------------------------

  async function handleReset() {
    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Reset local state first
      setSettings(json.data);
      setDraft(json.data);
      setLastUpdated(new Date().toISOString());

      // Refetch from server to ensure cache is invalidated and we have fresh data
      await loadSettings();

      toast.success("All settings reset to defaults");
      setShowResetDialog(false);
    } catch (err) {
      toast.error("Failed to reset settings");
    } finally {
      setIsResetting(false);
    }
  }

  // -- Update helpers --------------------------------------------------------

  function updateWallet<K extends keyof PlatformSettings["wallet"]>(
    key: K,
    value: PlatformSettings["wallet"][K],
  ) {
    setDraft((prev) =>
      prev ? { ...prev, wallet: { ...prev.wallet, [key]: value } } : prev,
    );
  }

  function updateCircles<K extends keyof PlatformSettings["circles"]>(
    key: K,
    value: PlatformSettings["circles"][K],
  ) {
    setDraft((prev) =>
      prev ? { ...prev, circles: { ...prev.circles, [key]: value } } : prev,
    );
  }

  function updatePayouts<K extends keyof PlatformSettings["payouts"]>(
    key: K,
    value: PlatformSettings["payouts"][K],
  ) {
    setDraft((prev) =>
      prev ? { ...prev, payouts: { ...prev.payouts, [key]: value } } : prev,
    );
  }

  function updateInvestments<K extends keyof PlatformSettings["investments"]>(
    key: K,
    value: PlatformSettings["investments"][K],
  ) {
    setDraft((prev) =>
      prev
        ? { ...prev, investments: { ...prev.investments, [key]: value } }
        : prev,
    );
  }

  function updateTrustScore<K extends keyof PlatformSettings["trustScore"]>(
    key: K,
    value: PlatformSettings["trustScore"][K],
  ) {
    setDraft((prev) =>
      prev
        ? { ...prev, trustScore: { ...prev.trustScore, [key]: value } }
        : prev,
    );
  }

  function updateNotifications<
    K extends keyof PlatformSettings["notifications"],
  >(key: K, value: PlatformSettings["notifications"][K]) {
    setDraft((prev) =>
      prev
        ? { ...prev, notifications: { ...prev.notifications, [key]: value } }
        : prev,
    );
  }

  function updateMaintenance<K extends keyof PlatformSettings["maintenance"]>(
    key: K,
    value: PlatformSettings["maintenance"][K],
  ) {
    setDraft((prev) =>
      prev
        ? { ...prev, maintenance: { ...prev.maintenance, [key]: value } }
        : prev,
    );
  }

  function updateAppDistribution<
    K extends keyof PlatformSettings["appDistribution"],
  >(key: K, value: PlatformSettings["appDistribution"][K]) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            appDistribution: { ...prev.appDistribution, [key]: value },
          }
        : prev,
    );
  }

  function updateGeneral<K extends keyof PlatformSettings["general"]>(
    key: K,
    value: PlatformSettings["general"][K],
  ) {
    setDraft((prev) =>
      prev ? { ...prev, general: { ...prev.general, [key]: value } } : prev,
    );
  }

  async function uploadAppFile(platform: "android" | "ios") {
    const file = platform === "android" ? androidFile : iosFile;
    if (!file) {
      toast.error("Choose a file before uploading.");
      return;
    }

    setUploadingPlatform(platform);
    try {
      const formData = new FormData();
      formData.append("platform", platform);
      formData.append("file", file);
      formData.append(
        "version",
        draft?.appDistribution?.[platform]?.version || "latest",
      );
      formData.append(
        "releaseNotes",
        draft?.appDistribution?.[platform]?.releaseNotes || "",
      );

      const res = await fetch("/api/admin/app-distribution", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Upload failed");

      const metadata = json.data.appDistribution[platform];
      setDraft((prev) =>
        prev && prev.appDistribution
          ? {
              ...prev,
              appDistribution: {
                ...prev.appDistribution,
                [platform]: {
                  ...prev.appDistribution[platform],
                  ...metadata,
                },
              },
            }
          : prev,
      );
      setAndroidFile(platform === "android" ? null : androidFile);
      setIosFile(platform === "ios" ? null : iosFile);
      toast.success(
        `${platform === "android" ? "Android" : "iOS"} app uploaded`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPlatform(null);
    }
  }

  function isValidIp(value?: string) {
    if (!value) return false;
    const ip = value.trim();
    const ipv4 =
      /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
    const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4.test(ip) || ipv6.test(ip);
  }

  // -- Render loading --------------------------------------------------------

  if (isLoading || !draft) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-11 rounded-xl" />
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
            ))}
          </div>
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="border-b pb-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-3.5 w-64" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div
                      key={j}
                      className="flex justify-between items-center py-2 border-b border-border last:border-0"
                    >
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                      <Skeleton className="h-9 w-36 rounded-lg" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const anySectionChanged = TABS.some((t) => hasChanges(t.id));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* -- Page header -- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Platform Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure fees, limits, penalties, trust scores, and system
              behaviour.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetDialog(true)}
            className="gap-1.5 self-start sm:self-auto text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          >
            <RotateCcwIcon className="size-3.5" />
            Reset All Defaults
          </Button>
        </div>

        {/* -- Last updated bar -- */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
          {anySectionChanged ? (
            <>
              <AlertCircleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex-1">
                You have unsaved changes. Save each section individually.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                All settings are saved.
                {lastUpdated && (
                  <span className="ml-1">
                    Last updated {fmtDateTime(lastUpdated)}
                    {lastUpdatedBy && <span> by {lastUpdatedBy}</span>}.
                  </span>
                )}
              </p>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={loadSettings}
            className="shrink-0"
            title="Refresh"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
        </div>

        {/* -- Tab bar -- */}
        <div className="flex gap-1.5 p-2 bg-muted rounded-2xl overflow-x-auto">
          {TABS.map((tab) => {
            const changed = hasChanges(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap flex-none justify-center min-w-[100px] sm:min-w-[120px]",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-3.5 shrink-0" />
                {tab.label}
                {changed && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 border border-background" />
                )}
                {tab.id === "maintenance" &&
                  draft.maintenance?.maintenanceMode && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500 border border-background animate-pulse" />
                  )}
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* GENERAL / PLATFORM TAB */}
        {activeTab === "general" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={SettingsIcon}
                title="Platform"
                description="Site name, branding, contact and locale settings."
                color="bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400"
                hasChanges={hasChanges("general")}
                isSaving={savingSection === "general"}
                onSave={() => saveSection("general")}
                onDiscard={() => discardSection("general")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              <SettingRow
                label="Site Name"
                description="Displayed in emails, headings, and the admin console."
                changed={
                  draft.general?.siteName !== settings?.general?.siteName
                }
              >
                <Input
                  value={draft.general?.siteName}
                  onChange={(e) => updateGeneral("siteName", e.target.value)}
                  className="w-64"
                />
              </SettingRow>

              <SettingRow
                label="Site Description"
                description="Short description used in meta tags and emails."
                changed={
                  draft.general?.siteDescription !==
                  settings?.general?.siteDescription
                }
              >
                <Textarea
                  value={draft.general?.siteDescription}
                  onChange={(e) =>
                    updateGeneral("siteDescription", e.target.value)
                  }
                  rows={2}
                  className="w-96"
                />
              </SettingRow>

              <SettingRow
                label="Site URL"
                description="Public URL for the platform (used in emails and links)."
                changed={draft.general?.siteUrl !== settings?.general?.siteUrl}
              >
                <Input
                  value={draft.general?.siteUrl}
                  onChange={(e) => updateGeneral("siteUrl", e.target.value)}
                  className="w-72"
                />
              </SettingRow>

              <SettingRow
                label="Logo URL"
                description="Public URL to the platform logo used in emails and headers."
                changed={draft.general?.logoUrl !== settings?.general?.logoUrl}
              >
                <Input
                  value={draft.general?.logoUrl ?? ""}
                  onChange={(e) => updateGeneral("logoUrl", e.target.value)}
                  className="w-96"
                />
              </SettingRow>

              <SettingRow
                label="Support Email"
                description="Email used for support and transactional replies."
                changed={
                  draft.general?.supportEmail !==
                  settings?.general?.supportEmail
                }
              >
                <Input
                  value={draft.general?.supportEmail}
                  onChange={(e) =>
                    updateGeneral("supportEmail", e.target.value)
                  }
                  className="w-72"
                />
              </SettingRow>

              <SettingRow
                label="Support Phone"
                description="Optional phone number displayed in support contacts."
                changed={
                  draft.general?.supportPhone !==
                  settings?.general?.supportPhone
                }
              >
                <Input
                  value={draft.general?.supportPhone ?? ""}
                  onChange={(e) =>
                    updateGeneral("supportPhone", e.target.value)
                  }
                  className="w-72"
                />
              </SettingRow>

              <SettingRow
                label="Server IP"
                description="The server's public IP detected by a backend lookup. Use it to auto-fill the platform IP."
                changed={false}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={
                        isFetchingServerIp
                          ? "Detecting…"
                          : (serverIp ?? "Unable to detect server IP")
                      }
                      readOnly
                      className="w-72"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setServerIp(null);
                        setServerIpError(null);
                        setIsFetchingServerIp(true);
                        fetch("/api/admin/server-ip")
                          .then((res) => res.json())
                          .then((json) => {
                            if (!json.success)
                              throw new Error(json.error || "Fetch failed");
                            setServerIp(json.data.ip);
                          })
                          .catch((err) => {
                            console.error(err);
                            setServerIp(null);
                            setServerIpError(
                              "Unable to detect server IP. Try again later.",
                            );
                          })
                          .finally(() => setIsFetchingServerIp(false));
                      }}
                      className="h-8"
                    >
                      <RefreshCwIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!serverIp) {
                          toast.error("No IP address to copy");
                          return;
                        }
                        navigator.clipboard
                          .writeText(serverIp)
                          .then(() => toast.success("Server IP copied"))
                          .catch(() => toast.error("Failed to copy"));
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <CopyIcon className="size-3" />
                    </Button>
                  </div>
                  {serverIpError ? (
                    <p className="text-xs text-destructive">{serverIpError}</p>
                  ) : null}
                </div>
              </SettingRow>

              <SettingRow
                label="Timezone"
                description="Timezone used for scheduling and cron jobs."
                changed={
                  draft.general?.timezone !== settings?.general?.timezone
                }
              >
                <Input
                  value={draft.general?.timezone}
                  onChange={(e) => updateGeneral("timezone", e.target.value)}
                  className="w-56"
                />
              </SettingRow>

              <SettingRow
                label="Currency"
                description="Platform currency code used for display and formatting."
                changed={
                  draft.general?.currency !== settings?.general?.currency
                }
              >
                <Input
                  value={draft.general?.currency}
                  onChange={(e) => updateGeneral("currency", e.target.value)}
                  className="w-28"
                />
              </SettingRow>

              <SettingRow
                label="Default Locale"
                description="Locale used for formatting dates and numbers."
                changed={
                  draft.general?.defaultLocale !==
                  settings?.general?.defaultLocale
                }
              >
                <Input
                  value={draft.general?.defaultLocale}
                  onChange={(e) =>
                    updateGeneral("defaultLocale", e.target.value)
                  }
                  className="w-40"
                />
              </SettingRow>
            </CardContent>
          </Card>
        )}

        {/* APP DISTRIBUTION TAB */}
        {activeTab === "appDistribution" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={DownloadIcon}
                title="App Distribution"
                description="Upload Android and iOS app packages, and publish direct download links."
                color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                hasChanges={hasChanges("appDistribution")}
                isSaving={savingSection === "appDistribution"}
                onSave={() => saveSection("appDistribution")}
                onDiscard={() => discardSection("appDistribution")}
              />
            </CardHeader>
            <CardContent className="pt-2 space-y-6">
              <SettingRow
                label="Direct download notice"
                description="Message shown on the public home page download card."
                changed={
                  draft.appDistribution?.pageMessage !==
                  settings?.appDistribution?.pageMessage
                }
              >
                <Textarea
                  value={draft.appDistribution?.pageMessage}
                  onChange={(e) =>
                    updateAppDistribution("pageMessage", e.target.value)
                  }
                  rows={3}
                  className="w-full max-w-3xl"
                />
              </SettingRow>

              <div className="grid gap-6 xl:grid-cols-2">
                {(["android", "ios"] as const).map((platform) => {
                  const platformData = draft.appDistribution?.[platform];
                  const savedData = settings?.appDistribution?.[platform];
                  const fileLabel = platform === "android" ? "APK" : "IPA";
                  const selectedFile =
                    platform === "android" ? androidFile : iosFile;
                  return (
                    <div
                      key={platform}
                      className="rounded-3xl border border-border bg-background/80 p-5"
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                          <p className="text-sm font-semibold capitalize text-foreground">
                            {platform === "android" ? "Android" : "iOS"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Upload the latest {fileLabel} package and publish
                            the public download link.
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                          {fileLabel}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Package file
                          </label>
                          <input
                            type="file"
                            accept={platform === "android" ? ".apk" : ".ipa"}
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              if (platform === "android") {
                                setAndroidFile(file);
                              } else {
                                setIosFile(file);
                              }
                            }}
                            className="w-full text-sm text-foreground file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white file:rounded-lg file:bg-emerald-600 hover:file:bg-emerald-500"
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className="text-sm font-medium">
                              Version
                            </Label>
                            <Input
                              value={platformData?.version ?? ""}
                              onChange={(e) =>
                                updateAppDistribution(
                                  platform === "android" ? "android" : "ios",
                                  {
                                    ...platformData,
                                    version: e.target.value,
                                  } as any,
                                )
                              }
                              className="mt-2 w-full"
                              placeholder="1.0.0"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">
                              Release Notes
                            </Label>
                            <Input
                              value={platformData?.releaseNotes ?? ""}
                              onChange={(e) =>
                                updateAppDistribution(
                                  platform === "android" ? "android" : "ios",
                                  {
                                    ...platformData,
                                    releaseNotes: e.target.value,
                                  } as any,
                                )
                              }
                              className="mt-2 w-full"
                              placeholder="Bug fixes, performance improvements..."
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <Button
                            onClick={() => uploadAppFile(platform)}
                            disabled={
                              !selectedFile || uploadingPlatform === platform
                            }
                            className="w-full sm:w-auto"
                          >
                            {uploadingPlatform === platform
                              ? "Uploading…"
                              : `Upload ${fileLabel}`}
                          </Button>
                          {platformData?.downloadUrl ? (
                            <a
                              href={platformData.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-emerald-400 hover:text-emerald-300"
                            >
                              View current download
                            </a>
                          ) : null}
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            {platformData?.enabled
                              ? `Current version: ${platformData.version || "latest"}`
                              : "No published package yet."}
                          </p>
                          {platformData?.lastUploadedAt ? (
                            <p>
                              Last uploaded:{" "}
                              {fmtDateTime(platformData.lastUploadedAt)}
                            </p>
                          ) : null}
                          {platformData?.releaseNotes ? (
                            <p>Notes: {platformData.releaseNotes}</p>
                          ) : null}
                          {savedData?.fileName ? (
                            <p className="text-xs text-slate-500">
                              Stored file: {savedData.fileName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {/* WALLET TAB */}
        {activeTab === "wallet" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={WalletIcon}
                title="Wallet & Payments"
                description="Deposit limits, withdrawal fees, and wallet constraints."
                color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                hasChanges={hasChanges("wallet")}
                isSaving={savingSection === "wallet"}
                onSave={() => saveSection("wallet")}
                onDiscard={() => discardSection("wallet")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              <SettingRow
                label="Minimum Deposit"
                description="The smallest amount a user can deposit into their wallet."
                tip="Applied during Flutterwave payment initialisation. Set to at least ₦500 to cover gateway minimums."
                changed={
                  draft.wallet?.minDepositKobo !==
                  settings?.wallet?.minDepositKobo
                }
              >
                <NairaInput
                  valueKobo={draft.wallet?.minDepositKobo}
                  onChange={(v) => updateWallet("minDepositKobo", v)}
                  min={10000}
                />
              </SettingRow>

              <SettingRow
                label="Maximum Deposit"
                description="The highest amount a user can deposit into their wallet."
                tip="Applied during Flutterwave payment initialisation. Set to at least ₦500 to cover gateway minimums."
                changed={
                  draft.wallet?.maxDepositKobo !==
                  settings?.wallet?.maxDepositKobo
                }
              >
                <NairaInput
                  valueKobo={draft.wallet?.maxDepositKobo}
                  onChange={(v) => updateWallet("maxDepositKobo", v)}
                  min={10000}
                />
              </SettingRow>

              <SettingRow
                label="Minimum Withdrawal"
                description="The smallest amount a user can withdraw to their bank account."
                tip="Must cover the flat withdrawal fee plus at least ₦1 net transfer."
                changed={
                  draft.wallet?.minWithdrawKobo !==
                  settings?.wallet?.minWithdrawKobo
                }
              >
                <NairaInput
                  valueKobo={draft.wallet?.minWithdrawKobo}
                  onChange={(v) => updateWallet("minWithdrawKobo", v)}
                  min={10000}
                />
              </SettingRow>
              {/* maximum withdrawal */}
              <SettingRow
                label="Maximum Withdrawal"
                description="The hightest amount a user can withdraw to their bank account."
                tip="Must cover the flat withdrawal fee plus at least ₦1 net transfer."
                changed={
                  draft.wallet?.maxWithdrawKobo !==
                  settings?.wallet?.maxWithdrawKobo
                }
              >
                <NairaInput
                  valueKobo={draft.wallet?.maxWithdrawKobo}
                  onChange={(v) => updateWallet("maxWithdrawKobo", v)}
                  min={10000}
                />
              </SettingRow>

              <SettingRow
                label="Withdrawal Flat Fee"
                description="Fixed fee applied to every withdrawal, regardless of amount."
                changed={
                  draft.wallet?.withdrawFeeFlatKobo !==
                  settings?.wallet?.withdrawFeeFlatKobo
                }
              >
                <NairaInput
                  valueKobo={draft.wallet?.withdrawFeeFlatKobo}
                  onChange={(v) => updateWallet("withdrawFeeFlatKobo", v)}
                  min={0}
                />
              </SettingRow>

              <SettingRow
                label="Withdrawal Fee Percentage"
                description="Percentage of the withdrawal amount charged on top of the flat fee."
                tip="Formula: fee = (amount × %) + flat fee, capped at the maximum fee."
                changed={
                  draft.wallet?.withdrawFeePercent !==
                  settings?.wallet?.withdrawFeePercent
                }
              >
                <PercentInput
                  value={draft.wallet?.withdrawFeePercent}
                  onChange={(v) => updateWallet("withdrawFeePercent", v)}
                  min={0}
                  max={10}
                  step={0.1}
                />
              </SettingRow>

              <SettingRow
                label="Withdrawal Fee Cap"
                description="Maximum total withdrawal fee charged to any single transaction."
                tip="Prevents large withdrawals from being penalised disproportionately."
                changed={
                  draft.wallet?.withdrawFeeCapKobo !==
                  settings?.wallet?.withdrawFeeCapKobo
                }
              >
                <NairaInput
                  valueKobo={draft.wallet?.withdrawFeeCapKobo}
                  onChange={(v) => updateWallet("withdrawFeeCapKobo", v)}
                  min={0}
                />
              </SettingRow>

              <SettingRow
                label="Maximum Wallet Balance"
                description="Safety ceiling for any single wallet?. Set to 0 for unlimited."
                tip="Useful for regulatory compliance or fraud prevention. 0 = no limit."
                changed={
                  draft.wallet?.maxWalletBalanceKobo !==
                  settings?.wallet?.maxWalletBalanceKobo
                }
              >
                <NairaInput
                  valueKobo={draft.wallet?.maxWalletBalanceKobo}
                  onChange={(v) => updateWallet("maxWalletBalanceKobo", v)}
                  min={0}
                  placeholder="0 = unlimited"
                />
              </SettingRow>

              {/* Live fee preview */}
              <div className="mt-4 rounded-xl bg-muted/40 border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Fee Preview
                </p>
                {[50_000, 100_000, 500_000, 1_000_000, 5_000_000].map(
                  (amount) => {
                    const pctFee = Math.round(
                      amount * (draft.wallet?.withdrawFeePercent / 100),
                    );
                    const total = Math.min(
                      pctFee + draft.wallet?.withdrawFeeFlatKobo,
                      draft.wallet?.withdrawFeeCapKobo,
                    );
                    const net = amount - total;
                    return (
                      <div
                        key={amount}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-24 text-muted-foreground font-mono">
                          ₦{koboToNaira(amount)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-red-600 dark:text-red-400 font-mono w-20">
                          −₦{koboToNaira(total)}
                        </span>
                        <span className="text-muted-foreground">net</span>
                        <span className="font-mono font-semibold text-foreground">
                          ₦{koboToNaira(net)}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* CIRCLES TAB */}
        {activeTab === "circles" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={CircleDollarSignIcon}
                title="Savings Circles"
                description="Membership limits, contribution constraints, fees, and penalty rules."
                color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                hasChanges={hasChanges("circles")}
                isSaving={savingSection === "circles"}
                onSave={() => saveSection("circles")}
                onDiscard={() => discardSection("circles")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              <SettingRow
                label="Max Active Circles Per User"
                description="Maximum number of active circles a single user can be a member of simultaneously."
                tip="Applies across both created and joined circles. Prevents gaming via mass circle membership."
                changed={
                  draft.circles?.maxActiveCirclesPerUser !==
                  settings?.circles?.maxActiveCirclesPerUser
                }
              >
                <NumberInput
                  value={draft.circles?.maxActiveCirclesPerUser}
                  onChange={(v) => updateCircles("maxActiveCirclesPerUser", v)}
                  min={1}
                  max={100}
                />
              </SettingRow>

              <SettingRow
                label="Minimum Contribution Amount"
                description="The floor contribution any circle can be configured with."
                changed={
                  draft.circles?.minContributionKobo !==
                  settings?.circles?.minContributionKobo
                }
              >
                <NairaInput
                  valueKobo={draft.circles?.minContributionKobo}
                  onChange={(v) => updateCircles("minContributionKobo", v)}
                  min={1000}
                />
              </SettingRow>

              <SettingRow
                label="Maximum Contribution Amount"
                description="The ceiling contribution any circle can be configured with."
                changed={
                  draft.circles?.maxContributionKobo !==
                  settings?.circles?.maxContributionKobo
                }
              >
                <NairaInput
                  valueKobo={draft.circles?.maxContributionKobo}
                  onChange={(v) => updateCircles("maxContributionKobo", v)}
                  min={100000}
                />
              </SettingRow>

              <SettingRow
                label="Minimum Circle Members"
                description="The smallest number of members a circle must have (excluding admin)."
                changed={
                  draft.circles?.minCircleMembers !==
                  settings?.circles?.minCircleMembers
                }
              >
                <NumberInput
                  value={draft.circles?.minCircleMembers}
                  onChange={(v) => updateCircles("minCircleMembers", v)}
                  min={2}
                  max={10}
                />
              </SettingRow>

              <SettingRow
                label="Maximum Circle Members"
                description="The largest number of members allowed in any circle."
                changed={
                  draft.circles?.maxCircleMembers !==
                  settings?.circles?.maxCircleMembers
                }
              >
                <NumberInput
                  value={draft.circles?.maxCircleMembers}
                  onChange={(v) => updateCircles("maxCircleMembers", v)}
                  min={3}
                  max={500}
                />
              </SettingRow>

              <SettingRow
                label="Circle Creation Fee"
                description="Platform fee charged when creating a new circle, as a % of the contribution amount."
                tip="Deducted from the admin's wallet at circle creation. Covers platform costs and reduces spam."
                changed={
                  draft.circles?.creationFeePercent !==
                  settings?.circles?.creationFeePercent
                }
              >
                <PercentInput
                  value={draft.circles?.creationFeePercent}
                  onChange={(v) => updateCircles("creationFeePercent", v)}
                  min={0}
                  max={25}
                  step={0.5}
                />
              </SettingRow>

              <SettingRow
                label="Late Payment Penalty"
                description="Additional fee applied when a member pays a contribution after the grace period."
                tip="Applied on top of the regular contribution amount. e.g. ₦5,000 contribution + 10% = ₦5,500 total."
                changed={
                  draft.circles?.latePenaltyPercent !==
                  settings?.circles?.latePenaltyPercent
                }
              >
                <PercentInput
                  value={draft.circles?.latePenaltyPercent}
                  onChange={(v) => updateCircles("latePenaltyPercent", v)}
                  min={0}
                  max={50}
                  step={1}
                />
              </SettingRow>

              <SettingRow
                label="Split Late Penalty"
                description="Share late payment penalties with circle admins."
                tip="When enabled, a configured share of the late penalty is credited to the circle admin's wallet."
                changed={
                  draft.circles?.latePenaltySplitEnabled !==
                  settings?.circles?.latePenaltySplitEnabled
                }
              >
                <Switch
                  checked={draft.circles?.latePenaltySplitEnabled}
                  onCheckedChange={(checked) =>
                    updateCircles("latePenaltySplitEnabled", checked)
                  }
                />
              </SettingRow>

              {draft.circles?.latePenaltySplitEnabled && (
                <SettingRow
                  label="Circle Admin Share"
                  description="Percentage of the late penalty paid to the circle admin."
                  tip="The remainder of the penalty stays with the platform."
                  changed={
                    draft.circles?.latePenaltyCircleAdminSharePercent !==
                    settings?.circles?.latePenaltyCircleAdminSharePercent
                  }
                >
                  <PercentInput
                    value={
                      draft.circles?.latePenaltyCircleAdminSharePercent ??
                      50
                    }
                    onChange={(v) =>
                      updateCircles(
                        "latePenaltyCircleAdminSharePercent",
                        v,
                      )
                    }
                    min={0}
                    max={100}
                    step={1}
                  />
                </SettingRow>
              )}

              <SettingRow
                label="Grace Period"
                description="Number of hours after a due date before a contribution is marked as 'late'."
                tip="Status transitions: pending → late (after grace period). No penalty until this window passes."
                changed={
                  draft.circles?.gracePeriodHours !==
                  settings?.circles?.gracePeriodHours
                }
              >
                <NumberInput
                  value={draft.circles?.gracePeriodHours}
                  onChange={(v) => updateCircles("gracePeriodHours", v)}
                  min={1}
                  max={168}
                  unit="hours"
                />
              </SettingRow>

              <SettingRow
                label="Auto-Removal After Consecutive Missed Payments"
                description="Number of consecutive missed contribution cycles before a member is automatically removed."
                tip="Status machine: late → missed (after additional days). Once this limit is hit, the member is ejected and notified."
                changed={
                  draft.circles?.consecutiveMissedLimit !==
                  settings?.circles?.consecutiveMissedLimit
                }
              >
                <NumberInput
                  value={draft.circles?.consecutiveMissedLimit}
                  onChange={(v) => updateCircles("consecutiveMissedLimit", v)}
                  min={1}
                  max={10}
                  unit="cycles"
                />
              </SettingRow>

              <SettingRow
                label="Bid Window Closes Before Payout"
                description="Hours before the next payout date when bidding closes for bidding-order circles."
                tip="Prevents last-minute bids that disrupt payout processing. Winner is resolved at close."
                changed={
                  draft.circles?.bidCloseHoursBeforePayout !==
                  settings?.circles?.bidCloseHoursBeforePayout
                }
              >
                <NumberInput
                  value={draft.circles?.bidCloseHoursBeforePayout}
                  onChange={(v) =>
                    updateCircles("bidCloseHoursBeforePayout", v)
                  }
                  min={1}
                  max={72}
                  unit="hours"
                />
              </SettingRow>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* PAYOUTS TAB                                                         */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "payouts" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={CoinsIcon}
                title="Payouts & Referrals"
                description="Platform payout fees, KYC thresholds, and referral programme rules."
                color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                hasChanges={hasChanges("payouts")}
                isSaving={savingSection === "payouts"}
                onSave={() => saveSection("payouts")}
                onDiscard={() => discardSection("payouts")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              <SettingRow
                label="Platform Payout Fee"
                description="Platform fee taken from each circle payout as a percentage of the gross pool amount."
                tip="Formula: net_payout = (contribution × members) − (pool × fee%). This is the primary revenue mechanism."
                changed={
                  draft.payouts?.platformPayoutFeePercent !==
                  settings?.payouts?.platformPayoutFeePercent
                }
              >
                <PercentInput
                  value={draft.payouts?.platformPayoutFeePercent}
                  onChange={(v) => updatePayouts("platformPayoutFeePercent", v)}
                  min={0}
                  max={10}
                  step={0.1}
                />
              </SettingRow>

              <SettingRow
                label="KYC Required Above (Payout)"
                description="Payout amount above which KYC verification is required before processing."
                tip="Regulatory compliance threshold. Payouts above this are blocked until the user completes identity verification."
                changed={
                  draft.payouts?.kycRequiredAboveKobo !==
                  settings?.payouts?.kycRequiredAboveKobo
                }
              >
                <NairaInput
                  valueKobo={draft.payouts?.kycRequiredAboveKobo}
                  onChange={(v) => updatePayouts("kycRequiredAboveKobo", v)}
                  min={0}
                />
              </SettingRow>

              <Separator className="my-2" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-2">
                Referral Programme
              </p>

              <SettingRow
                label="Referral Bonus Amount"
                description="Amount credited to the referrer's wallet when a referee qualifies."
                tip="A user qualifies as a referee when they make their first deposit of at least the minimum qualifying amount."
                changed={
                  draft.payouts?.referralBonusKobo !==
                  settings?.payouts?.referralBonusKobo
                }
              >
                <NairaInput
                  valueKobo={draft.payouts?.referralBonusKobo}
                  onChange={(v) => updatePayouts("referralBonusKobo", v)}
                  min={0}
                />
              </SettingRow>

              <SettingRow
                label="Referral Qualifying Deposit"
                description="The minimum first deposit amount a referee must make for the referrer to earn the bonus."
                changed={
                  draft.payouts?.referralMinDepositKobo !==
                  settings?.payouts?.referralMinDepositKobo
                }
              >
                <NairaInput
                  valueKobo={draft.payouts?.referralMinDepositKobo}
                  onChange={(v) => updatePayouts("referralMinDepositKobo", v)}
                  min={10000}
                />
              </SettingRow>

              <SettingRow
                label="Referral Monthly Cap Per Referrer"
                description="Maximum number of referral bonuses a single user can earn within a calendar month."
                tip="Fraud prevention. Prevents mass fake-account referral farming."
                changed={
                  draft.payouts?.referralMonthlyLimit !==
                  settings?.payouts?.referralMonthlyLimit
                }
              >
                <NumberInput
                  value={draft.payouts?.referralMonthlyLimit}
                  onChange={(v) => updatePayouts("referralMonthlyLimit", v)}
                  min={1}
                  max={500}
                  unit="/ month"
                />
              </SettingRow>

              <Separator className="my-2" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-2">
                Settlement Policy
              </p>

              <SettingRow
                label="Payout Settlement Period"
                description="Number of hours the system withholds payouts from a member's available wallet balance before settling."
                tip="During this period, the payout is held in 'pending' status. After the period expires, it's credited to available balance. Allows time for transaction verification and fraud prevention."
                changed={
                  draft.payouts?.settlementPeriodHours !==
                  settings?.payouts?.settlementPeriodHours
                }
              >
                <NumberInput
                  value={draft.payouts?.settlementPeriodHours}
                  onChange={(v) => updatePayouts("settlementPeriodHours", v)}
                  min={0}
                  max={720}
                  unit="hours"
                />
              </SettingRow>

              {/* Revenue preview */}
              <div className="mt-4 rounded-xl bg-muted/40 border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Fee Preview — Payout Scenarios
                </p>
                {[
                  { label: "5 × ₦10k", pool: 5_000_000 },
                  { label: "10 × ₦50k", pool: 50_000_000 },
                  { label: "20 × ₦100k", pool: 200_000_000 },
                ].map(({ label, pool }) => {
                  const fee = Math.round(
                    pool * (draft.payouts?.platformPayoutFeePercent / 100),
                  );
                  return (
                    <div
                      key={label}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-28 text-muted-foreground">
                        {label} pool
                      </span>
                      <span className="text-red-600 dark:text-red-400 font-mono w-20">
                        −₦{koboToNaira(fee)} fee
                      </span>
                      <span className="text-muted-foreground">net</span>
                      <span className="font-mono font-semibold text-foreground">
                        ₦{koboToNaira(pool - fee)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* INVESTMENTS TAB */}
        {activeTab === "investments" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={TrendingUpIcon}
                title="Investments"
                description="Platform fee on investment interest and early withdrawal policy."
                color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                hasChanges={hasChanges("investments")}
                isSaving={savingSection === "investments"}
                onSave={() => saveSection("investments")}
                onDiscard={() => discardSection("investments")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              <SettingRow
                label="Platform Interest Fee"
                description="Percentage of earned interest taken as a platform fee when a user withdraws a matured investment."
                tip="Applied to interest only, not principal. Formula: platform_fee = interest × %. User keeps the rest."
                changed={
                  draft.investments.platformInterestFeePercent !==
                  settings?.investments.platformInterestFeePercent
                }
              >
                <PercentInput
                  value={draft.investments.platformInterestFeePercent}
                  onChange={(v) =>
                    updateInvestments("platformInterestFeePercent", v)
                  }
                  min={0}
                  max={20}
                  step={0.1}
                />
              </SettingRow>

              <SettingRow
                label="Allow Early Withdrawal"
                description="When enabled, users may request withdrawal before the maturity date. A pro-rated payout is calculated."
                tip="When off, investment terms are strictly enforced. Admins can still force payouts via the Investments admin page."
                changed={
                  draft.investments.earlyWithdrawalEnabled !==
                  settings?.investments.earlyWithdrawalEnabled
                }
              >
                <Switch
                  checked={draft.investments.earlyWithdrawalEnabled}
                  onCheckedChange={(v) =>
                    updateInvestments("earlyWithdrawalEnabled", v)
                  }
                />
              </SettingRow>

              {/* Investment fee preview */}
              <div className="mt-4 rounded-xl bg-muted/40 border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Fee Preview — Interest Earned
                </p>
                {[
                  {
                    label: "₦50k @ 18.5%",
                    principal: 5_000_000,
                    yield: 18.5,
                    days: 30,
                  },
                  {
                    label: "₦100k @ 22%",
                    principal: 10_000_000,
                    yield: 22,
                    days: 90,
                  },
                  {
                    label: "₦500k @ 26.5%",
                    principal: 50_000_000,
                    yield: 26.5,
                    days: 180,
                  },
                ].map(({ label, principal, yield: y, days }) => {
                  const interest = Math.round(
                    (principal * (y / 100) * days) / 365,
                  );
                  const fee = Math.round(
                    interest *
                      (draft.investments.platformInterestFeePercent / 100),
                  );
                  const net = interest - fee;
                  return (
                    <div
                      key={label}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-28 text-muted-foreground">
                        {label}
                      </span>
                      <span className="text-muted-foreground font-mono w-20">
                        +₦{koboToNaira(interest)}
                      </span>
                      <span className="text-red-600 dark:text-red-400 font-mono w-20">
                        −₦{koboToNaira(fee)} fee
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        ₦{koboToNaira(net)} net
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TRUST SCORE TAB                                                     */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "trustScore" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={ShieldCheckIcon}
                title="Trust Score Weights"
                description="Point adjustments applied to a circle's trust score for each payment outcome."
                color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                hasChanges={hasChanges("trustScore")}
                isSaving={savingSection === "trustScore"}
                onSave={() => saveSection("trustScore")}
                onDiscard={() => discardSection("trustScore")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              <div className="mb-4 rounded-xl bg-muted/30 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Formula:</strong> score =
                100 + (on_time × weight) + (late × weight) + (missed × weight),
                clamped to [0, 100]. Weights for late and missed should be
                negative.
              </div>

              <SettingRow
                label="On-Time Payment Weight"
                description="Points added to the circle's trust score for each contribution paid before the grace period expires."
                changed={
                  draft.trustScore.onTimePaymentWeight !==
                  settings?.trustScore.onTimePaymentWeight
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    +
                  </span>
                  <NumberInput
                    value={draft.trustScore.onTimePaymentWeight}
                    onChange={(v) => updateTrustScore("onTimePaymentWeight", v)}
                    min={0}
                    max={20}
                    unit="pts"
                  />
                </div>
              </SettingRow>

              <SettingRow
                label="Late Payment Weight"
                description="Points deducted from the circle's trust score for each late contribution. Enter as a positive number — it is applied as a deduction."
                changed={
                  draft.trustScore.latePaymentWeight !==
                  settings?.trustScore.latePaymentWeight
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                    −
                  </span>
                  <NumberInput
                    value={Math.abs(draft.trustScore.latePaymentWeight)}
                    onChange={(v) =>
                      updateTrustScore("latePaymentWeight", -Math.abs(v))
                    }
                    min={0}
                    max={50}
                    unit="pts"
                  />
                </div>
              </SettingRow>

              <SettingRow
                label="Missed Payment Weight"
                description="Points deducted for each missed (never paid) contribution. Enter as a positive number."
                changed={
                  draft.trustScore.missedPaymentWeight !==
                  settings?.trustScore.missedPaymentWeight
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
                    −
                  </span>
                  <NumberInput
                    value={Math.abs(draft.trustScore.missedPaymentWeight)}
                    onChange={(v) =>
                      updateTrustScore("missedPaymentWeight", -Math.abs(v))
                    }
                    min={0}
                    max={100}
                    unit="pts"
                  />
                </div>
              </SettingRow>

              {/* Score simulation */}
              <div className="mt-4 rounded-xl bg-muted/40 border border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Score Simulation
                </p>
                {[
                  {
                    label: "Perfect circle (10 on-time)",
                    on: 10,
                    late: 0,
                    missed: 0,
                  },
                  {
                    label: "1 late, rest on-time (10)",
                    on: 9,
                    late: 1,
                    missed: 0,
                  },
                  {
                    label: "2 missed, rest on-time (8)",
                    on: 8,
                    late: 0,
                    missed: 2,
                  },
                  { label: "Struggling (5/3/2)", on: 5, late: 3, missed: 2 },
                ].map(({ label, on, late, missed }) => {
                  const score = Math.max(
                    0,
                    Math.min(
                      100,
                      100 +
                        on * draft.trustScore.onTimePaymentWeight +
                        late * draft.trustScore.latePaymentWeight +
                        missed * draft.trustScore.missedPaymentWeight,
                    ),
                  );
                  const color =
                    score >= 80
                      ? "text-emerald-600 dark:text-emerald-400"
                      : score >= 55
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400";
                  return (
                    <div
                      key={label}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="flex-1 text-muted-foreground">
                        {label}
                      </span>
                      <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            score >= 80
                              ? "bg-emerald-500"
                              : score >= 55
                                ? "bg-amber-400"
                                : "bg-red-500",
                          )}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-mono font-bold w-12 text-right",
                          color,
                        )}
                      >
                        {score}/100
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* NOTIFICATIONS TAB                                                   */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "notifications" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={BellIcon}
                title="Notification Channels"
                description="Enable or disable SMS and email notification delivery globally."
                color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                hasChanges={hasChanges("notifications")}
                isSaving={savingSection === "notifications"}
                onSave={() => saveSection("notifications")}
                onDiscard={() => discardSection("notifications")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/30 p-4 flex items-start gap-3">
                <InfoIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  Disabling a channel globally overrides all per-user
                  preferences. SMS is the primary channel for time-sensitive
                  alerts. Email is the fallback and receipt channel. Changes
                  take effect immediately for all new notifications.
                </p>
              </div>

              <SettingRow
                label="SMS Notifications"
                description={`Enable Termii SMS delivery for contribution reminders, late warnings, and payout alerts. Provider: ${draft.notifications.smsProviderName}.`}
                tip="When disabled, users will only receive in-app and email notifications for time-sensitive events."
                changed={
                  draft.notifications.smsEnabled !==
                  settings?.notifications.smsEnabled
                }
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.notifications.smsEnabled}
                    onCheckedChange={(v) =>
                      updateNotifications("smsEnabled", v)
                    }
                  />
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] h-5 px-2",
                      draft.notifications.smsEnabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {draft.notifications.smsEnabled ? "On" : "Off"}
                  </Badge>
                </div>
              </SettingRow>

              <SettingRow
                label="Email Notifications"
                description={`Enable Nodemailer SMTP email delivery for receipts, payout notices, and dispute updates. Provider: ${draft.notifications.emailProviderName}.`}
                tip="Transactional emails (receipts, payout confirmations, dispute resolutions) should remain enabled."
                changed={
                  draft.notifications.emailEnabled !==
                  settings?.notifications.emailEnabled
                }
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.notifications.emailEnabled}
                    onCheckedChange={(v) =>
                      updateNotifications("emailEnabled", v)
                    }
                  />
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] h-5 px-2",
                      draft.notifications.emailEnabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {draft.notifications.emailEnabled ? "On" : "Off"}
                  </Badge>
                </div>
              </SettingRow>

              <Separator className="my-4" />

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Provider Health
                  </p>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        SMS — {draft.notifications.smsProviderName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Configured via TERMII_API_KEY env var
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      asChild
                    >
                      <a
                        href="/admin/settings"
                        onClick={(e) => e.preventDefault()}
                      >
                        Test SMS
                      </a>
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        Email — {draft.notifications.emailProviderName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Configured via NODEMAILER_* env vars
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/admin/email-health", {
                            method: "POST",
                          });
                          const j = await res.json();
                          if (j.success?.data?.sent)
                            toast.success(`Test email sent to ${j.data?.to}`);
                          else
                            toast.error(
                              "Email test failed. Check SMTP config.",
                            );
                        } catch {
                          toast.error("Failed to reach email health endpoint.");
                        }
                      }}
                    >
                      Test Email
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MAINTENANCE TAB                                                     */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "maintenance" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <SectionHeader
                icon={AlertTriangleIcon}
                title="Maintenance Mode"
                description="Take the platform offline for all non-admin users."
                color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                hasChanges={hasChanges("maintenance")}
                isSaving={savingSection === "maintenance"}
                onSave={() => saveSection("maintenance")}
                onDiscard={() => discardSection("maintenance")}
              />
            </CardHeader>
            <CardContent className="pt-2">
              {draft.maintenance.maintenanceMode && (
                <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800/30 px-4 py-3">
                  <AlertTriangleIcon className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                      Maintenance mode is currently ACTIVE
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">
                      All non-admin users are seeing the maintenance message
                      below. Save changes to disable.
                    </p>
                  </div>
                </div>
              )}

              <SettingRow
                label="Maintenance Mode"
                description="When enabled, all regular users will see the maintenance message and cannot access the app. Admin users retain full access."
                tip="Use this during deployments, database migrations, or emergency fixes. Toggle off and save to restore access."
                changed={
                  draft.maintenance.maintenanceMode !==
                  settings?.maintenance.maintenanceMode
                }
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.maintenance.maintenanceMode}
                    onCheckedChange={(v) =>
                      updateMaintenance("maintenanceMode", v)
                    }
                  />
                  <Badge
                    className={cn(
                      "text-[10px] h-5 px-2 font-semibold",
                      draft.maintenance.maintenanceMode
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {draft.maintenance.maintenanceMode ? "ACTIVE" : "Off"}
                  </Badge>
                </div>
              </SettingRow>

              <SettingRow
                label="Admins Can Still Access"
                description="When maintenance mode is on, this allows admin-role users to continue using the platform normally."
                tip="Keep this enabled unless you need to take down everything including the admin panel."
                changed={
                  draft.maintenance.allowedAdminAccess !==
                  settings?.maintenance.allowedAdminAccess
                }
              >
                <Switch
                  checked={draft.maintenance.allowedAdminAccess}
                  onCheckedChange={(v) =>
                    updateMaintenance("allowedAdminAccess", v)
                  }
                />
              </SettingRow>

              <SettingRow
                label="Maintenance Message"
                description="Message shown to users when maintenance mode is active."
                changed={
                  draft.maintenance.maintenanceMessage !==
                  settings?.maintenance.maintenanceMessage
                }
              >
                <div className="w-72">
                  <Textarea
                    value={draft.maintenance.maintenanceMessage}
                    onChange={(e) =>
                      updateMaintenance("maintenanceMessage", e.target.value)
                    }
                    rows={3}
                    className="resize-none text-sm"
                    maxLength={300}
                  />
                  <p className="text-[10px] text-muted-foreground text-right mt-1">
                    {draft.maintenance.maintenanceMessage.length}/300
                  </p>
                </div>
              </SettingRow>

              {/* Message preview */}
              <div className="mt-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 p-6 text-center space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  User Preview
                </p>
                <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto">
                  <AlertTriangleIcon className="size-6 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  AjoSave is under maintenance
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {draft.maintenance.maintenanceMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* -- Audit log -- */}
        <AuditLogPanel />
      </div>

      {/* -- Reset confirmation dialog -- */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Settings to Defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore every platform setting — fees, limits,
              penalties, trust score weights, and notification flags — to the
              factory defaults. Any custom configuration will be permanently
              overwritten. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isResetting}
              onClick={handleReset}
            >
              {isResetting ? (
                <>
                  <RefreshCwIcon className="size-3.5 mr-1.5 animate-spin" />
                  Resetting…
                </>
              ) : (
                "Yes, Reset All"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
