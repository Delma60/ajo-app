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
