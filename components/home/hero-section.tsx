"use client";

import Link from "next/link";
import { ArrowRight, Shield, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATS = [
  { value: "12k+", label: "Active members" },
  { value: "₦2.4B", label: "Saved to date" },
  { value: "98%", label: "On-time payouts" },
];

const TRUST_PILLS = [
  { icon: Shield, text: "Bank-grade security" },
  { icon: TrendingUp, text: "Earn up to 31% p.a." },
  { icon: Users, text: "Circles up to 50 members" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden bg-[#0a1a12]">
      {/* Background texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(4,120,87,0.35) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 80% 60%, rgba(4,120,87,0.12) 0%, transparent 60%)`,
        }}
      />

      {/* Decorative circle top-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 size-[600px] rounded-full border border-emerald-900/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-[420px] rounded-full border border-emerald-800/20"
      />

      {/* Decorative grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-24 flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
        {/* Left: Copy */}
        <div className="flex-1 text-center lg:text-left">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800/50 bg-emerald-950/60 px-4 py-1.5 mb-8">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium tracking-widest uppercase text-emerald-400">
              Community savings, reimagined
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-white mb-6"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Save together.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
              Grow together.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg text-white/60 leading-relaxed max-w-md mx-auto lg:mx-0 mb-10">
            The modern Ajo &amp; Esusu platform. Join a circle, save
            consistently, and receive your pooled payout — safe, transparent,
            and on time.
          </p>

          {/* Trust pills */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-10">
            {TRUST_PILLS.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70"
              >
                <Icon className="size-3 text-emerald-400 shrink-0" />
                {text}
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 h-12 gap-2 transition-all duration-200 shadow-lg shadow-emerald-900/40"
            >
              <Link href="/register">
                Get started free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-full text-white/70 hover:text-white hover:bg-white/8 h-12 px-8 border border-white/10"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        {/* Right: Stats card */}
        <div className="flex-shrink-0 w-full max-w-sm lg:max-w-xs xl:max-w-sm">
          <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8">
            {/* Glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(4,120,87,0.15) 0%, transparent 60%)",
              }}
            />

            <p
              className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-6"
            >
              Platform snapshot
            </p>

            <div className="space-y-6">
              {STATS.map(({ value, label }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-white/50 text-sm">{label}</span>
                  <span
                    className="text-2xl font-bold text-white font-mono"
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-white/40 leading-relaxed">
                  Protected by bank-grade encryption. Your savings are always
                  safe.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#f9fafb] to-transparent"
      />
    </section>
  );
}