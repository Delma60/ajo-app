"use client";

import Link from "next/link";
import * as React from "react";
import { Headphones } from "lucide-react";

export default function SupportFab() {
  return (
    <Link
      href="/support"
      aria-label="Contact support"
      className="fixed right-4 bottom-6 z-50 flex items-center rounded-full bg-primary px-4 py-3 text-white shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50 md:right-8 md:bottom-8"
    >
      <Headphones className="mr-2" />
      <span className="hidden sm:inline-block font-medium">Support</span>
    </Link>
  );
}
