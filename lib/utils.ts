import { CircleSettings } from "./types/admin-settings";
import { computeMaxJoinFee } from "./validators/circle";

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

/**
 * Validate that joinFeeKobo does not exceed the platform-enforced cap.
 * Throws a CircleError with code JOIN_FEE_EXCEEDS_CAP if the fee is too high.
 *
 * @param joinFeeEnabled  - Whether join fee is turned on
 * @param joinFeeKobo     - The proposed fee in kobo
 * @param contributionKobo - The circle's per-cycle contribution in kobo
 * @param settings        - Live platform CircleSettings
 */
export function validateJoinFee(
  joinFeeEnabled: boolean,
  joinFeeKobo: number,
  contributionKobo: number,
  settings: CircleSettings
): void {
  if (!joinFeeEnabled || joinFeeKobo <= 0) return;
 
  const maxKobo = computeMaxJoinFee(contributionKobo, "KOBO", {
    circles: settings,
  } as any);
 
  if (joinFeeKobo > maxKobo) {
    const fmtFee = `₦${(joinFeeKobo / 100).toLocaleString("en-NG")}`;
    const fmtCap = `₦${(maxKobo / 100).toLocaleString("en-NG")}`;
    const fmtContrib = `₦${(contributionKobo / 100).toLocaleString("en-NG")}`;
    const fmtAbsCap = `₦${(settings.maxJoinFeeKobo / 100).toLocaleString("en-NG")}`;
 
    throw Object.assign(
      new Error(
        `Join fee ${fmtFee} exceeds the platform cap of ${fmtCap} ` +
          `(${settings.maxJoinFeePercent}% of ${fmtContrib} contribution, ` +
          `absolute limit ${fmtAbsCap}).`
      ),
      { code: "JOIN_FEE_EXCEEDS_CAP" }
    );
  }
}