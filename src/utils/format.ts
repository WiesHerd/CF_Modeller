/**
 * Shared number/currency formatting so dollar amounts show $ and commas app-wide.
 */

/** Format as USD with $ and commas (e.g. $12,345.67). */
export function formatCurrency(
  n: number,
  options?: { decimals?: number; compact?: boolean }
): string {
  const decimals = options?.decimals ?? 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

/** Format number with commas (no currency symbol). */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Compact currency for chart axes (e.g. $500k, $1.2M). */
export function formatCurrencyCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}

/** Format a date as "Jan 5, 2024" (en-US short month). Accepts a Date object or ISO string. */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Format a date+time as "Jan 5, 2024, 2:30 PM" (en-US). Accepts a Date object or ISO string. */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Format percentile as ordinal (e.g. 44 → "44th", 79 → "79th"). */
export function formatOrdinal(n: number): string {
  const s = String(Math.round(n))
  const last = s.slice(-1)
  const lastTwo = s.slice(-2)
  if (Number(lastTwo) >= 11 && Number(lastTwo) <= 13) return `${s}th`
  if (last === '1') return `${s}st`
  if (last === '2') return `${s}nd`
  if (last === '3') return `${s}rd`
  return `${s}th`
}
