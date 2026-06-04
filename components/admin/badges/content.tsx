"use client";

import { useState, useEffect } from "react";
import { Badge as BadgeType, BadgeRarity } from "@/lib/types/event";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const RARITIES: BadgeRarity[] = ["common", "rare", "legendary"];

const RARITY_COLORS: Record<BadgeRarity, string> = {
  common: "bg-slate-100 text-slate-800",
  rare: "bg-blue-100 text-blue-800",
  legendary: "bg-amber-100 text-amber-800",
};

export function BadgesContent() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    iconName: "Trophy",
    rarity: "common" as BadgeRarity,
  });

  const {
    data: badgesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["adminBadges"],
    queryFn: async () => {
      const response = await fetch("/api/admin/badges");
      if (!response.ok) throw new Error("Failed to fetch badges");
      return response.json();
    },
  });

  const badges = badgesData?.data || [];

  const handleCreate = async () => {
    try {
      if (!formData.name.trim()) {
        toast.error("Badge name is required");
        return;
      }

      const response = await fetch("/api/admin/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to create badge");

      toast.success("Badge created successfully!");
      setFormData({
        name: "",
        description: "",
        iconName: "Trophy",
        rarity: "common",
      });
      setIsCreating(false);
      refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create badge",
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/badges/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete badge");

      toast.success("Badge deleted");
      setDeletingId(null);
      refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete badge",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Badges</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage badges that users can earn through events
          </p>
        </div>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Create Badge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Badge</DialogTitle>
              <DialogDescription>
                Add a new badge that can be awarded through events
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Badge Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Reliable Saver"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What does this badge represent?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iconName">Icon Name</Label>
                  <Input
                    id="iconName"
                    placeholder="Trophy"
                    value={formData.iconName}
                    onChange={(e) =>
                      setFormData({ ...formData, iconName: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rarity">Rarity</Label>
                  <Select
                    value={formData.rarity}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        rarity: value as BadgeRarity,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RARITIES.map((r) => (
                        <SelectItem key={r} value={r}>
                          <span className="capitalize">{r}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="flex items-center justify-center mb-3">
                  <DynamicIcon
                    name={formData.iconName || "Trophy"}
                    className="size-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formData.name || "Badge Name"}
                </p>
                <span
                  className={`inline-block text-xs px-2 py-1 rounded mt-2 capitalize ${
                    RARITY_COLORS[formData.rarity]
                  }`}
                >
                  {formData.rarity}
                </span>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleCreate}>
                  Create Badge
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Badges Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : badges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No badges yet. Create one to get started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {badges.map((badge: BadgeType) => (
            <Card key={badge.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">
                    <DynamicIcon
                      name={badge.iconName || "Trophy"}
                      className="size-6"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(badge.id)}
                      disabled
                    >
                      <Edit2 className="size-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeletingId(badge.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogTitle>Delete Badge?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the badge from the system. Events
                          referencing it will be affected.
                        </AlertDialogDescription>
                        <div className="flex gap-2 pt-4">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive"
                            onClick={() => handleDelete(badge.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <h3 className="font-semibold text-sm mb-1">{badge.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {badge.description}
                </p>

                <span
                  className={`inline-block text-xs px-2 py-1 rounded capitalize ${
                    RARITY_COLORS[badge.rarity as BadgeRarity]
                  }`}
                >
                  {badge.rarity}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
