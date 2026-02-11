import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/format'

/** Format numeric delta for display: always 2 decimal places for consistency in reports. */
export function fmtDelta(value: number): string {
  if (value === 0) return '0.00'
  const rounded = Math.round(value * 100) / 100
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded.toFixed(2)}`
}

/** Format as USD with $ and commas (e.g. $12,345.67). Use app-wide for all dollar amounts. */
export function fmtMoney(n: number, decimals = 2): string {
  return formatCurrency(n, { decimals })
}

/** Compact delta display: value only with color. Reused for baseline-vs-modeled and market-position. */
export function DeltaIndicator({
  delta,
  format = 'number',
  className,
}: {
  delta: number
  format?: 'number' | 'currency' | 'integer'
  className?: string
}) {
  const isPositive = delta > 0
  const isNegative = delta < 0
  const isZero = delta === 0

  const display =
    format === 'currency'
      ? isZero
        ? '—'
        : `${isPositive ? '+' : ''}${fmtMoney(delta)}`
      : format === 'integer'
        ? isZero
          ? '0'
          : `${isPositive ? '+' : ''}${Math.round(delta).toLocaleString('en-US')}`
        : isZero
          ? '0.00'
          : fmtDelta(delta)

  return (
    <span
      className={cn(
        'tabular-nums',
        isPositive && 'text-emerald-600 dark:text-emerald-500',
        isNegative && 'text-rose-600 dark:text-rose-500',
        isZero && 'text-muted-foreground',
        className
      )}
      title={isPositive ? 'Increase' : isNegative ? 'Decrease' : 'No change'}
    >
      {display}
    </span>
  )
}
