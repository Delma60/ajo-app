import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthSkeleton } from "@/components/auth/auth-skeleton";
import { getSettings } from "@/lib/services/settings-service";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteName = settings.general.siteName ?? "AjoSave";

  return {
    title: {
      template: `%s — ${siteName}`,
      default: siteName,
    },
    description:
      settings.general.siteDescription ?? "Community savings, reimagined.",
  };
}

// ─── Brand panel (left / top on mobile) ──────────────────────────────────────

function BrandPanel({ siteName }: { siteName: string }) {
  return (
    <div
      className="hidden lg:flex lg:flex-col lg:justify-between lg:w-[480px] lg:shrink-0
                 relative overflow-hidden bg-[#047857] text-white p-10"
    >
      {/* Decorative circles */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-[420px]
                   rounded-full bg-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-80px] right-[-80px] size-[320px]
                   rounded-full bg-white/5"
      />

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 relative z-10">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/20 text-white font-bold text-lg select-none">
          {siteName.charAt(0) || "A"}
        </span>
        <span className="text-xl font-semibold tracking-tight">{siteName}</span>
      </Link>

      {/* Copy */}
      <div className="relative z-10 space-y-6">
        <blockquote className="text-2xl font-semibold leading-snug">
          &ldquo;Saving together is the oldest wealth strategy in Nigeria —
          we&apos;ve just made it safer and smarter.&rdquo;
        </blockquote>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
          {[
            { value: "12k+", label: "Active members" },
            { value: "₦2.4B", label: "Saved to date" },
            { value: "98%", label: "On-time payouts" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const siteName = settings.general.siteName ?? "AjoSave";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <BrandPanel siteName={siteName} />

      {/* Form panel */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-8">
        {/* Mobile logo */}
        <Link
          href="/"
          className="flex items-center gap-2 mb-10 lg:hidden"
          aria-label={`${siteName} home`}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#047857] text-white font-bold text-lg">
            {siteName.charAt(0) || "A"}
          </span>
          <span className="text-xl font-semibold tracking-tight">
            {siteName}
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <Suspense fallback={<AuthSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
