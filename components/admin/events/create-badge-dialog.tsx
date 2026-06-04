"use client";

import { useState } from "react";
import { Badge as BadgeType, BadgeRarity } from "@/lib/types/event";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const RARITIES: BadgeRarity[] = ["common", "rare", "legendary"];

const ICON_SUGGESTIONS = [
  "Trophy",
  "Award",
  "Star",
  "Sparkles",
  "ShieldCheck",
  "Crown",
  "Rocket",
  "Gift",
  "Zap",
  "Heart",
  "Medal",
  "Gem",
  "CheckCircle2",
  "Shield",
  "Lightning",
];

interface CreateBadgeDialogProps {
  onBadgeCreated?: (badge: BadgeType) => void;
  onOpenChange?: (open: boolean) => void;
}

export function CreateBadgeDialog({
  onBadgeCreated,
  onOpenChange,
}: CreateBadgeDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    iconName: "Trophy",
    rarity: "common" as BadgeRarity,
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Badge name is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Badge description is required");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/admin/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create badge");
      }

      const result = await response.json();
      toast.success("Badge created successfully!");

      // Notify parent component
      onBadgeCreated?.(result.data);

      // Reset form
      setFormData({
        name: "",
        description: "",
        iconName: "Trophy",
        rarity: "common",
      });

      // Close dialog
      handleOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create badge",
      );
      console.error("Error creating badge:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          + Create New Badge
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Badge</DialogTitle>
          <DialogDescription>
            Add a new badge that users can earn through events
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="badge-name">Badge Name</Label>
            <Input
              id="badge-name"
              placeholder="e.g. Early Adopter"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="badge-desc">Description</Label>
            <Textarea
              id="badge-desc"
              placeholder="Brief description of what this badge represents"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Icon Name */}
          <div className="space-y-2">
            <Label htmlFor="badge-icon">Icon Name</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
              {ICON_SUGGESTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                    formData.iconName === icon
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary"
                  }`}
                  onClick={() => setFormData({ ...formData, iconName: icon })}
                >
                  <DynamicIcon name={icon} className="size-4" />
                  <span className="truncate">{icon}</span>
                </button>
              ))}
            </div>
            <Input
              id="badge-icon"
              placeholder="Lucide icon name e.g. Trophy"
              value={formData.iconName}
              onChange={(e) =>
                setFormData({ ...formData, iconName: e.target.value })
              }
              disabled={loading}
            />
          </div>

          {/* Rarity */}
          <div className="space-y-2">
            <Label htmlFor="badge-rarity">Rarity</Label>
            <Select
              value={formData.rarity}
              onValueChange={(value) =>
                setFormData({ ...formData, rarity: value as BadgeRarity })
              }
              disabled={loading}
            >
              <SelectTrigger id="badge-rarity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RARITIES.map((rarity) => (
                  <SelectItem key={rarity} value={rarity}>
                    <span className="capitalize">{rarity}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create Badge
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
