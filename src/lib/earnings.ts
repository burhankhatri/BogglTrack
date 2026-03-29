export function getApplicableRate(
  projectRate: number | null | undefined,
  userDefaultRate: number
): number {
  if (projectRate != null && projectRate > 0) {
    return projectRate;
  }
  return userDefaultRate;
}

export function calculateEarnings(
  durationSeconds: number,
  rate: number,
  billable: boolean
): number {
  if (!billable) return 0;
  return (durationSeconds / 3600) * rate;
}

export function formatCurrency(amount: number, symbol: string = "$"): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return `${hours.toFixed(1)}h`;
}
