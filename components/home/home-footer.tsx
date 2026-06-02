"use client";

import Link from "next/link";
import { useSettings } from "@/lib/providers/settings";

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "#" },
      { label: "Terms of service", href: "#" },
      { label: "Cookie policy", href: "#" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help centre", href: "#" },
      { label: "Contact us", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
];

export function HomeFooter() {
  const { general } = useSettings();
  const siteName = general.siteName ?? "AjoSave";

  return (
    <footer className="bg-[#0a1a12] border-t border-white/8">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-700">
                <span className="text-white font-bold text-sm font-mono">
                  {siteName.charAt(0) || "A"}
                </span>
              </div>
              <span className="text-white font-semibold text-base tracking-tight">
                {siteName}
              </span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed">
              Community savings,
              <br />
              reimagined for Nigeria.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map(({ heading, links }) => (
            <div key={heading}>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-white/40 mb-4">
                {heading}
              </p>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
          <p className="text-xs text-white/30">
            Made with care for the Nigerian savings community.
          </p>
        </div>
      </div>
    </footer>
  );
}
