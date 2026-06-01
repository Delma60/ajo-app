import type { Metadata } from "next";
import { AdminSupportDetailContent } from "@/components/admin/support/detail-content";

interface AdminSupportTicketPageProps {
  params: { id: string };
}

export const metadata: Metadata = {
  title: "Support ticket — Admin — AjoSave",
};

export default function AdminSupportTicketPage({
  params,
}: AdminSupportTicketPageProps) {
  return <AdminSupportDetailContent ticketId={params.id} />;
}
