import { EventDetailContent } from "@/components/admin/events/event-detail-content";

export const metadata = {
  title: "Admin - Event Details",
  description: "View event details and claims",
};

interface AdminEventPageProps {
  params: { id: string };
}

export default function AdminEventPage({ params }: AdminEventPageProps) {
  return (
    <div className="container max-w-6xl py-8">
      <EventDetailContent eventId={params.id} />
    </div>
  );
}
