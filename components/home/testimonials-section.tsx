const TESTIMONIALS = [
  {
    quote:
      "I've been doing Ajo informally for years. AjoSave gave us the tools to track everything transparently. No more disputes, no more trust issues.",
    name: "Chidinma A.",
    role: "Circle admin, Lagos",
    initials: "CA",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    quote:
      "The investment feature is brilliant. My idle wallet balance is earning 22% while I wait for my payout cycle. I didn't expect that.",
    name: "Emeka O.",
    role: "Circle member, Abuja",
    initials: "EO",
    color: "bg-blue-100 text-blue-700",
  },
  {
    quote:
      "The trust score made me confident joining a circle with people I didn't know personally. Best savings decision of 2024.",
    name: "Fatima B.",
    role: "Circle member, Kano",
    initials: "FB",
    color: "bg-amber-100 text-amber-700",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-[#f9fafb] py-24 lg:py-32 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest font-semibold text-emerald-700 mb-3">
            Trusted by thousands
          </p>
          <h2
            className="font-display text-4xl lg:text-5xl font-bold text-gray-900"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            What our members say
          </h2>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, name, role, initials, color }) => (
            <div
              key={name}
              className="rounded-2xl bg-white border border-gray-100 p-7 flex flex-col gap-5 shadow-sm"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    viewBox="0 0 16 16"
                    className="size-3.5 fill-amber-400"
                    aria-hidden
                  >
                    <path d="M8 1l1.854 4.146L14 5.854l-3 2.854.708 4.146L8 10.854l-3.708 1.996L5 8.708 2 5.854l4.146-.708L8 1z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-[0.9375rem] text-gray-600 leading-relaxed flex-1">
                &ldquo;{quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-9 items-center justify-center rounded-full text-xs font-bold ${color}`}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-400">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}