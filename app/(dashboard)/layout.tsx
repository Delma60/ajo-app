import React from "react";
import SupportFab from "@/components/support/support-fab";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      {children}
      <SupportFab />
    </div>
  );
};

export default Layout;
