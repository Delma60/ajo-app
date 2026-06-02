import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="bg-[#0a1a12] py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 70% 70% at 50% 50%, rgba(4,120,87,0.25) 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <p className="text-xs uppercase tracking-widest font-semibold text-emerald-400 mb-4">
          Ready to start?
        </p>
        <h2
          className="font-display text-4xl lg:text-6xl font-bold text-white leading-tight mb-6"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Your circle is waiting for you
        </h2>
        <p className="text-lg text-white/50 leading-relaxed mb-10 max-w-xl mx-auto">
          Join 12,000+ Nigerians already saving smarter. Create your account in
          under 2 minutes — no paperwork, no hidden fees.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-10 h-12 gap-2 shadow-lg shadow-emerald-900/40"
          >
            <Link href="/register">
              Create free account
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="rounded-full text-white/60 hover:text-white hover:bg-white/8 border border-white/10 h-12 px-8"
          >
            <Link href="/login">Sign in instead</Link>
          </Button>
        </div>

        {/* Fine print */}
        <p className="mt-6 text-xs text-white/30">
          Free to join. Creation fee of 5% applies when starting a circle.
        </p>
      </div>
    </section>
  );
}