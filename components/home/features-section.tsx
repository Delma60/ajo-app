import {
  Shield,
  TrendingUp,
  Bell,
  Gavel,
  Smartphone,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Shield,
    title: "Trust score system",
    description:
      "Every circle earns a transparent trust score based on payment history. Know exactly who you're saving with.",
    accent: "emerald",
  },
  {
    icon: TrendingUp,
    title: "Grow with investments",
    description:
      "Earn up to 31% p.a. by placing your idle wallet balance in government-backed investment packages.",
    accent: "blue",
  },
  {
    icon: Bell,
    title: "SMS & in-app reminders",
    description:
      "Never miss a contribution. We send proactive reminders via SMS and push notification before your due date.",
    accent: "amber",
  },
  {
    icon: Gavel,
    title: "Dispute resolution",
    description:
      "Built-in dispute management with admin oversight ensures every issue is handled fairly and transparently.",
    accent: "rose",
  },
  {
    icon: Smartphone,
    title: "Works on any device",
    description:
      "Fully responsive web app. Check your circles, contribute, and track payouts from your phone in seconds.",
    accent: "purple",
  },
  {
    icon: Zap,
    title: "Instant payouts",
    description:
      "When it's your turn, payouts are credited to your AjoSave wallet instantly and ready to withdraw to any bank.",
    accent: "orange",
  },
];

const ACCENT_CLASSES: Record<string, { bg: string; icon: string; ring: string }> = {
  emerald: {
    bg: "bg-emerald-50",
    icon: "text-emerald-700",
    ring: "ring-emerald-100",
  },
  blue: { bg: "bg-blue-50", icon: "text-blue-700", ring: "ring-blue-100" },
  amber: { bg: "bg-amber-50", icon: "text-amber-700", ring: "ring-amber-100" },
  rose: { bg: "bg-rose-50", icon: "text-rose-700", ring: "ring-rose-100" },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-700",
    ring: "ring-purple-100",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "text-orange-700",
    ring: "ring-orange-100",
  },
};

export function FeaturesSection() {
  return (
    <section className="bg-white py-24 lg:py-32 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 lg:mb-20 items-end">
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold text-emerald-700 mb-3">
              Everything you need
            </p>
            <h2
              className="font-display text-4xl lg:text-5xl font-bold text-gray-900 leading-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Built for how Nigerians actually save
            </h2>
          </div>
          <p className="text-lg text-gray-500 leading-relaxed lg:max-w-md">
            We&apos;ve taken the Ajo/Esusu model that&apos;s worked for
            generations and made it transparent, automated, and completely
            trustworthy.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, accent }) => {
            const cls = ACCENT_CLASSES[accent];
            return (
              <div
                key={title}
                className="group rounded-2xl border border-gray-100 bg-gray-50/50 p-6 hover:border-gray-200 hover:bg-white hover:shadow-sm transition-all duration-200"
              >
                <div
                  className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl ${cls.bg} ring-4 ${cls.ring}`}
                >
                  <Icon className={`size-5 ${cls.icon}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}