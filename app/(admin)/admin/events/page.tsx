import { AdminEventsContent } from "@/components/admin/events/content";

export const metadata = {
  title: "Admin - Events",
  description: "Manage promotional events and rewards",
};

export default function AdminEventsPage() {
  return (
    <div className="p-6 max-w-4xl py-8  space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Events Management</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage promotional events and rewards.
        </p>
      </div>
      <AdminEventsContent />
    </div>
  );
}
