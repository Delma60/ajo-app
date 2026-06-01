// Utility functions placeholder
export function cn(...args: any[]): string {
  return args.filter(Boolean).join(' ');
}

export function formatNaira(kobo: number, compact = false): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(naira);
}



// ─── Utility: currency formatter ──────────────────────────────────────────────

export function fmtNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

// ─── Utility: date formatter ──────────────────────────────────────────────────

export function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export function parseTimestamp(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }

  const anyValue = value as any;

  if (typeof anyValue.toDate === "function") {
    return anyValue.toDate();
  }

  if (
    typeof anyValue.seconds === "number" &&
    typeof anyValue.nanoseconds === "number"
  ) {
    return new Date(anyValue.seconds * 1000 + Math.round(anyValue.nanoseconds / 1e6));
  }

  return new Date(String(value));
}