import type { Metadata } from "next";
import { SupportTicketDetailContent } from "@/components/support/ticket-detail-content";

interface SupportTicketPageProps {
  params: { id: string };
}

export const metadata: Metadata = {
  title: "Support ticket — AjoSave",
};

export default function SupportTicketPage({ params }: SupportTicketPageProps) {
  return <SupportTicketDetailContent ticketId={params.id} />;
}
