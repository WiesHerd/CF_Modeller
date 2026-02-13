import { cn } from '@/lib/utils'

export function MetricRail({
  label,
  value,
  valueLabel,
  dangerAbove = 75,
  cautionAbove = 60,
  goodAbove = 40,
}: {
  label: string
  value: number
  valueLabel?: string
  dangerAbove?: number
  cautionAbove?: number
  goodAbove?: number
}) {
  const pct = Math.max(0, Math.min(100, value))
  const color =
    value >= dangerAbove
      ? 'bg-red-500'
      : value >= cautionAbove
        ? 'bg-amber-500'
        : value >= goodAbove
          ? 'bg-emerald-500'
          : 'bg-sky-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{valueLabel ?? Math.round(value)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/60">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
