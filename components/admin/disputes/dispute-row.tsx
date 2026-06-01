"use client";

import {
  MoreHorizontalIcon,
  EyeIcon,
  SearchIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DISPUTE_STATUS_META,
  DISPUTE_TYPE_META,
  type AdminDispute,
} from "@/lib/types/admin-dispute";

interface DisputeRowProps {
  dispute: AdminDispute;
  onOpenDetail: (dispute: AdminDispute) => void;
  onQuickAction: (id: string, action: string) => void;
  isProcessing: boolean;
}

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function DisputeRow({
  dispute,
  onOpenDetail,
  onQuickAction,
  isProcessing,
}: DisputeRowProps) {
  const statusMeta = DISPUTE_STATUS_META[dispute.status];
  const typeMeta = DISPUTE_TYPE_META[dispute.type];

  const initials = dispute.reporterName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActionable = dispute.status === "open" || dispute.status === "under_review";

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={() => onOpenDetail(dispute)}
    >
      {/* Type icon + Reporter */}
      <div className="flex items-center gap-3 shrink-0 w-52 min-w-0">
        <div className="relative shrink-0">
          <Avatar className="size-9">
            <AvatarImage src={dispute.reporterAvatarUrl ?? undefined} />
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Urgency dot for open disputes */}
          {dispute.status === "open" && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 border-2 border-background" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {dispute.reporterName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {dispute.reporterEmail}
          </p>
        </div>
      </div>

      {/* Dispute type + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm shrink-0">{typeMeta.icon}</span>
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {typeMeta.label}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1 leading-relaxed">
          {dispute.description}
        </p>
        {dispute.againstUserName && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            vs <span className="font-medium">{dispute.againstUserName}</span>
          </p>
        )}
      </div>

      {/* Circle */}
      <div className="hidden md:block shrink-0 max-w-[140px]">
        <p className="text-xs font-medium text-foreground truncate">{dispute.circleName}</p>
        <Link
          href={`/circles/${dispute.circleId}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
        >
          View circle
          <ExternalLinkIcon className="size-2.5" />
        </Link>
      </div>

      {/* Status badge */}
      <div className="hidden sm:block shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium border",
            statusMeta.badgeCls
          )}
        >
          <span className={cn("size-1.5 rounded-full shrink-0", statusMeta.dotCls)} />
          {statusMeta.label}
        </span>
      </div>

      {/* Date */}
      <p className="hidden lg:block text-xs text-muted-foreground shrink-0 w-24 text-right">
        {fmtDate(dispute.createdAt)}
      </p>

      {/* Actions dropdown */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isProcessing}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onOpenDetail(dispute)}>
              <EyeIcon className="size-4" />
              View full details
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/circles/${dispute.circleId}`}
                target="_blank"
              >
                <ExternalLinkIcon className="size-4" />
                Open circle
              </Link>
            </DropdownMenuItem>

            {isActionable && <DropdownMenuSeparator />}

            {dispute.status === "open" && (
              <DropdownMenuItem
                disabled={isProcessing}
                onClick={() => onQuickAction(dispute.id, "mark_under_review")}
              >
                <SearchIcon className="size-4" />
                Mark under review
              </DropdownMenuItem>
            )}
            {(dispute.status === "open" || dispute.status === "under_review") && (
              <>
                <DropdownMenuItem
                  disabled={isProcessing}
                  onClick={() => onOpenDetail({ ...dispute, _quickAction: "resolve" } as any)}
                >
                  <CheckCircle2Icon className="size-4" />
                  Resolve dispute
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isProcessing}
                  onClick={() => onOpenDetail({ ...dispute, _quickAction: "dismiss" } as any)}
                >
                  <XCircleIcon className="size-4" />
                  Dismiss dispute
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}