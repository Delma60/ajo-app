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
  if (value == null) {
    return null;
  }

  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    const anyValue = value as any;

    if (typeof anyValue.toDate === "function") {
      date = anyValue.toDate();
    } else if (
      typeof anyValue.seconds === "number" &&
      typeof anyValue.nanoseconds === "number"
    ) {
      date = new Date(
        anyValue.seconds * 1000 + Math.round(anyValue.nanoseconds / 1e6),
      );
    } else {
      date = new Date(String(value));
    }
  }

  return date && !isNaN(date.getTime()) ? date : null;
}