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

export interface InvestmentFilters {
  search: string;
  status: string;
  category: string;
  riskLevel: string;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_INVESTMENT_FILTERS: InvestmentFilters = {
  search: "",
  status: "all",
  category: "all",
  riskLevel: "all",
  dateFrom: "",
  dateTo: "",
};

interface InvestmentFiltersBarProps {
  filters: InvestmentFilters;
  onChange: (f: InvestmentFilters) => void;
  activeCount: number;
  onClear: () => void;
}

export function InvestmentFiltersBar({
  filters,
  onChange,
  activeCount,
  onClear,
}: InvestmentFiltersBarProps) {
  function update(partial: Partial<InvestmentFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by user name, email, or package…"
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
          <SelectTrigger className="w-full sm:w-[145px]">
            <FilterIcon className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="matured">Matured</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Category */}
        <Select
          value={filters.category}
          onValueChange={(v) => update({ category: v })}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All packages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All packages</SelectItem>
            <SelectItem value="treasury-bills">🏛️ Treasury Bills</SelectItem>
            <SelectItem value="money-market">💹 Money Market</SelectItem>
            <SelectItem value="fixed-deposit">🔒 Fixed Deposit</SelectItem>
            <SelectItem value="mutual-fund">📈 Mutual Fund</SelectItem>
          </SelectContent>
        </Select>

        {/* Risk */}
        <Select
          value={filters.riskLevel}
          onValueChange={(v) => update({ riskLevel: v })}
        >
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="All risk levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk levels</SelectItem>
            <SelectItem value="low">Low risk</SelectItem>
            <SelectItem value="medium">Medium risk</SelectItem>
            <SelectItem value="high">High risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date range row */}
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