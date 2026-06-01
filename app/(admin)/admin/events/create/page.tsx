import { CreateEventForm } from "@/components/admin/events/create-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Admin - Create Event",
  description: "Create a new promotional event",
};

export default function CreateEventPage() {
  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <Link href="/admin/events">
        <Button variant="outline" size="sm">
          <ArrowLeft className="size-4" />
          Back to Events
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Create New Event</h1>
        <p className="text-muted-foreground mt-1">
          Set up a promotional event or rewards campaign
        </p>
      </div>

      <CreateEventForm />
    </div>
  );
}
