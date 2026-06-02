import { EventDetailContent } from "@/components/admin/events/event-detail-content";

export const metadata = {
  title: "Admin - Event Details",
  description: "View event details and claims",
};

interface AdminEventPageProps {
  params: { id: string };
}

export default async function AdminEventPage({ params }: AdminEventPageProps) {
  const { id } = await params
  return (
    <div className="container max-w-6xl py-8 p-6 space-y-6">
      <EventDetailContent eventId={id} />
    </div>
  );
}
