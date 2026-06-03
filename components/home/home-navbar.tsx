"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/providers/settings";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "/download", label: "App" },
];

export function HomeNavbar() {
  const { general } = useSettings();
  const siteName = general.siteName ?? "AjoSave";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#0a1a12]/95 backdrop-blur-md border-b border-white/8 shadow-lg shadow-black/20"
          : "bg-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label={`${siteName} home`}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-700 shadow-md">
            <span className="text-white font-bold text-sm select-none font-mono">
              {siteName.charAt(0) || "A"}
            </span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            {siteName}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/8"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-5"
          >
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden flex items-center justify-center size-9 rounded-lg text-white/70 hover:text-white hover:bg-white/8 transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0a1a12]/98 backdrop-blur-md border-t border-white/8 px-6 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-colors"
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2 mt-3">
            <Button
              asChild
              variant="ghost"
              className="justify-start text-white/70 hover:text-white"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Link href="/register">Get started free</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
