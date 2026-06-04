import { Suspense } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileHeader } from "@/components/dashboard/mobile-header";
import { BottomNav } from "@/components/dashboard/bottom-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <DashboardSidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile-only top header */}
        <MobileHeader />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}