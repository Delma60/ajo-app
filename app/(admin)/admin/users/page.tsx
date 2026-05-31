import type { Metadata } from "next";
import { AdminUsersContent } from "@/components/admin/users/content";

export const metadata: Metadata = {
  title: "Users — AjoSave Admin",
  description: "Manage all registered users, their status, roles, and activity.",
};

export default function AdminUsersPage() {
  return <AdminUsersContent />;
}