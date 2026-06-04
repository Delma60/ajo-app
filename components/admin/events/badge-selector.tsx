"use client";

import { useEffect, useState } from "react";
import { Badge as BadgeType } from "@/lib/types/event";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { CreateBadgeDialog } from "./create-badge-dialog";


interface BadgeSelectorProps {
  value?: string;
  onChange: (badgeId: string) => void;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Badge selector dropdown that queries available badges from Firestore
 * Shows badge icon, name, and rarity level
 */
export function BadgeSelector({
  value,
  onChange,
  disabled = false,
  required = false,
}: BadgeSelectorProps) {
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/admin/badges");
        if (!response.ok) throw new Error("Failed to fetch badges");
        const result = await response.json();
        setBadges(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load badges");
        console.error("Error fetching badges:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, []);

  const handleBadgeCreated = (newBadge: BadgeType) => {
    // Add the new badge to the list
    setBadges((prev) => [...prev, newBadge]);
    // Auto-select the newly created badge
    onChange(newBadge.id);
  };

  const rarityColors: Record<string, string> = {
    common: "text-slate-600",
    rare: "text-blue-600",
    legendary: "text-amber-600",
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="badgeSelect">
        Badge {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="badgeSelect" className="w-full">
          <SelectValue placeholder="Select a badge..." />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <div className="flex items-center justify-center py-2 px-2">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-2 px-2 text-xs text-destructive">{error}</div>
          ) : badges.length === 0 ? (
            <div className="py-2 px-2 text-xs text-muted-foreground">
              No badges available. Create one below.
            </div>
          ) : (
            badges.map((badge) => (
              <SelectItem key={badge.id} value={badge.id}>
                <div className="flex items-center gap-2">
                  <span>{badge.iconEmoji || "🏆"}</span>
                  <span>{badge.name}</span>
                  <span
                    className={`text-xs capitalize ${
                      rarityColors[badge.rarity] || "text-muted-foreground"
                    }`}
                  >
                    {badge.rarity}
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      
      {/* Create Badge Dialog */}
      <CreateBadgeDialog onBadgeCreated={handleBadgeCreated} />
    </div>
  );
}
