"use client";

import { SearchIcon, FilterIcon, XIcon, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface DisputeFilters {
  search: string;
  status: string;
  type: string;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_DISPUTE_FILTERS: DisputeFilters = {
  search: "",
  status: "all",
  type: "all",
  dateFrom: "",
  dateTo: "",
};

interface DisputeFiltersBarProps {
  filters: DisputeFilters;
  onChange: (f: DisputeFilters) => void;
  activeCount: number;
  onClear: () => void;
}

export function DisputeFiltersBar({
  filters,
  onChange,
  activeCount,
  onClear,
}: DisputeFiltersBarProps) {
  function update(partial: Partial<DisputeFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by reporter, circle, or description…"
            className="pl-8"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(v) => update({ status: v })}
        >
          <SelectTrigger className="w-full sm:w-[155px]">
            <FilterIcon className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        {/* Type */}
        <Select
          value={filters.type}
          onValueChange={(v) => update({ type: v })}
        >
          <SelectTrigger className="w-full sm:w-[185px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="missed_payout">💸 Missed Payout</SelectItem>
            <SelectItem value="admin_abuse">⚠️ Admin Abuse</SelectItem>
            <SelectItem value="fraudulent_member">🚫 Fraudulent Member</SelectItem>
            <SelectItem value="other">📋 Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date range */}
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <div className="flex items-center gap-2 flex-1">
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            className="h-8 text-xs flex-1"
            value={filters.dateFrom}
            onChange={(e) => update({ dateFrom: e.target.value })}
          />
          <span className="text-xs text-muted-foreground shrink-0">to</span>
          <Input
            type="date"
            className="h-8 text-xs flex-1"
            value={filters.dateTo}
            onChange={(e) => update({ dateTo: e.target.value })}
          />
        </div>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={onClear}
          >
            <XIcon className="size-3.5" />
            Clear filters ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}