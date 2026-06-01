"use client";

import { useState } from "react";
import { AdminMobileHeader, AdminSidebar } from "./sidebar";
// import { AdminSidebar, AdminMobileHeader } from "@/components/admin/sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <AdminMobileHeader onMenuOpen={() => setMobileOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-auto flex flex-col">{children}</main>
      </div>
    </div>
  );
}
