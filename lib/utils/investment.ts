import type {
  Investment,
  InvestmentWithProgress,
} from "@/lib/types/investment";

export function enrichInvestment(inv: Investment): InvestmentWithProgress {
  const now = Date.now();
  const start = inv.startDate.toMillis();
  const maturity = inv.maturityDate.toMillis();
  const totalMs = Math.max(1, maturity - start);
  const elapsedMs = Math.min(now - start, totalMs);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((elapsedMs / totalMs) * 100))
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil((maturity - now) / (1000 * 60 * 60 * 24))
  );
  const accruedValueKobo = Math.round(
    inv.principalKobo + (inv.interestKobo * elapsedMs) / totalMs
  );
  const isMatured = now >= maturity;

  return {
    ...inv,
    progressPercent,
    daysRemaining,
    accruedValueKobo,
    isMatured,
  };
}
