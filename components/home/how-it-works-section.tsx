import { CircleDollarSign, Users, Wallet } from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: Users,
    title: "Join or create a circle",
    description:
      "Browse public circles or create your own with custom contribution amounts, frequency, and payout order.",
  },
  {
    step: "02",
    icon: Wallet,
    title: "Save consistently",
    description:
      "Fund your AjoSave wallet and contribute each cycle. We send reminders before your due date so you never miss.",
  },
  {
    step: "03",
    icon: CircleDollarSign,
    title: "Receive your payout",
    description:
      "When it's your turn, the pooled contributions are credited directly to your wallet — withdraw anytime to your bank.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-[#f9fafb] py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          <p className="text-xs uppercase tracking-widest font-semibold text-emerald-700 mb-3">
            Simple by design
          </p>
          <h2
            className="font-display text-4xl lg:text-5xl font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            How AjoSave works
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Three steps. Hundreds of years of tradition. A safer, smarter
            future.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Connector line — desktop only */}
          <div
            aria-hidden
            className="hidden md:block absolute top-10 left-[calc(33.333%+1.5rem)] right-[calc(33.333%+1.5rem)] h-px bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200"
          />

          {STEPS.map(({ step, icon: Icon, title, description }) => (
            <div key={step} className="relative flex flex-col items-center text-center">
              {/* Step number + icon */}
              <div className="relative mb-6">
                <div className="flex size-20 items-center justify-center rounded-2xl bg-emerald-700 shadow-lg shadow-emerald-900/20">
                  <Icon className="size-9 text-white" />
                </div>
                <span className="absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full bg-white border-2 border-emerald-200 text-[10px] font-bold text-emerald-700 shadow-sm">
                  {step}
                </span>
              </div>

              <h3
                className="text-xl font-semibold text-gray-900 mb-3"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                {title}
              </h3>
              <p className="text-gray-500 leading-relaxed text-[0.9375rem]">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}