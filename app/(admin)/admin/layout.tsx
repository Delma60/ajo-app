import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getSettings } from "@/lib/services/settings-service";
import { AdminShell } from "@/components/admin/shell";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (!sessionCookie) redirect("/login");

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") {
      redirect("/dashboard");
    }

    // Check if admins are locked out due to maintenance mode with allowedAdminAccess=false
    const settings = await getSettings();
    if (
      settings.maintenance.maintenanceMode &&
      !settings.maintenance.allowedAdminAccess
    ) {
      redirect("/admin-locked");
    }
  } catch {
    redirect("/login");
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifyAdmin();

  return <AdminShell>{children}</AdminShell>;
}
