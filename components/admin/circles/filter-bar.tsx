"use client";

import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CircleFilters {
  search: string;
  status: string;
  payoutOrder: string;
  frequency: string;
  orderBy: string;
  order: "asc" | "desc";
}

interface CircleFiltersBarProps {
  filters: CircleFilters;
  onChange: (filters: CircleFilters) => void;
}

export function CircleFiltersBar({ filters, onChange }: CircleFiltersBarProps) {
  function update(partial: Partial<CircleFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Search */}
      <div className="relative flex-1">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search circles by name or description…"
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
          <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="paused">Paused</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Payout order */}
      <Select
        value={filters.payoutOrder}
        onValueChange={(v) => update({ payoutOrder: v })}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Payout" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="rotational">Rotational</SelectItem>
          <SelectItem value="random">Random</SelectItem>
          <SelectItem value="bidding">Bidding</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        value={`${filters.orderBy}:${filters.order}`}
        onValueChange={(v) => {
          const [orderBy, order] = v.split(":") as [string, "asc" | "desc"];
          update({ orderBy, order });
        }}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="createdAt:desc">Newest first</SelectItem>
          <SelectItem value="createdAt:asc">Oldest first</SelectItem>
          <SelectItem value="trustScore:desc">Highest trust</SelectItem>
          <SelectItem value="trustScore:asc">Lowest trust</SelectItem>
          <SelectItem value="memberCount:desc">Most members</SelectItem>
          <SelectItem value="contribution:desc">Highest contribution</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}