import type { Metadata } from "next";
import { HomeNavbar } from "@/components/home/home-navbar";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { FeaturesSection } from "@/components/home/features-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { CtaSection } from "@/components/home/cta-section";
import { AppDownloadSection } from "@/components/home/app-download-section";
import { HomeFooter } from "@/components/home/home-footer";

export const metadata: Metadata = {
  title: "AjoSave — Community Savings, Reimagined",
  description:
    "Join circles, save together, and receive your payout. The modern, secure way to do Ajo and Esusu in Nigeria.",
  openGraph: {
    title: "AjoSave — Community Savings, Reimagined",
    description:
      "Join thousands of Nigerians saving smarter. Create or join a savings circle today.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <HomeNavbar />

      <main className="flex-1">
        {/* 1. Hero */}
        <HeroSection />

        {/* 2. How it works */}
        <section id="how-it-works">
          <HowItWorksSection />
        </section>

        {/* 3. Features */}
        <section id="features">
          <FeaturesSection />
        </section>

        {/* 4. Social proof */}
        <section id="testimonials">
          <TestimonialsSection />
        </section>

        {/* 5. App download */}
        <AppDownloadSection />

        {/* 6. Final CTA */}
        <CtaSection />
      </main>

      <HomeFooter />
    </div>
  );
}
