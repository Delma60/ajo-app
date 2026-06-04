"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Event } from "@/lib/types/event";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EventStatsStrip } from "./event-stats-strip";
import { ClaimsTable } from "./claims-table";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface EventDetailContentProps {
  eventId: string;
}

export function EventDetailContent({ eventId }: EventDetailContentProps) {
  const [claimsPage, setClaimsPage] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const queryClient = useQueryClient();

  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ["adminEvent", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/events/${eventId}`);
      if (!response.ok) throw new Error("Failed to fetch event");
      return response.json();
    },
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["eventClaims", eventId, claimsPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(claimsPage),
        limit: "20",
      });
      const response = await fetch(
        `/api/admin/events/${eventId}/claims?${params}`,
      );
      if (!response.ok) throw new Error("Failed to fetch claims");
      return response.json();
    },
  });

  const event = eventData?.data as Event | undefined;
  const claims = claimsData?.data || [];
  const stats = claimsData?.stats;
  const pagination = claimsData?.pagination;
  const router = useRouter();

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description);
    }
  }, [event]);

  if (eventLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");
      toast.success("Event status updated");
      queryClient.invalidateQueries({ queryKey: ["adminEvent", eventId] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update status",
      );
    }
  };

  const handleSave = async () => {
    if (!event) return;
    if (
      title.trim() === event.title &&
      description.trim() === event.description
    ) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Failed to save event");
      }

      toast.success("Event updated successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["adminEvent", eventId] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save event",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Failed to delete event");
      }

      toast.success("Event deleted");
      router.push("/admin/events");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete event",
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/admin/events">
        <Button variant="outline" size="sm">
          <ArrowLeft className="size-4" />
          Back to Events
        </Button>
      </Link>

      {/* Event header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground">{event.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditing(false);
                  setTitle(event.title);
                  setDescription(event.description);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditing(true)}>Edit event</Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete event
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                className="text-xs text-muted-foreground"
                htmlFor="event-title"
              >
                Title
              </label>
              <Input
                id="event-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label
                className="text-xs text-muted-foreground"
                htmlFor="event-description"
              >
                Description
              </label>
              <Textarea
                id="event-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Select value={event.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trigger Type</p>
              <p className="font-medium capitalize text-sm mt-2">
                {event.triggerType.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reward Type</p>
              <p className="font-medium capitalize text-sm mt-2">
                {event.rewardType.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Total Claims</p>
              <p className="font-medium text-sm mt-2">
                {event.maxClaimsTotal === 0
                  ? "Unlimited"
                  : event.maxClaimsTotal}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Per User</p>
              <p className="font-medium text-sm mt-2">
                {event.maxClaimsPerUser}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && <EventStatsStrip stats={stats} />}

      {/* Claims table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claims</CardTitle>
          <CardDescription>All reward claims for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <ClaimsTable
            claims={claims}
            currentPage={pagination?.page || 1}
            totalPages={pagination?.pages || 1}
            onPageChange={setClaimsPage}
          />
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Deleting the event will remove all
              associated claims and statistics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
