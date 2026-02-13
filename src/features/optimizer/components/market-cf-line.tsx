import type { MarketCFBenchmarks } from '@/types/optimizer'

/**
 * Compact horizontal market CF line for table cells.
 * Shows 25/50/75/90 percentiles and current + recommended CF positions.
 */
export function MarketCFLine({
  currentCF,
  recommendedCF,
  marketCF,
  className,
}: {
  currentCF: number
  recommendedCF: number
  marketCF: MarketCFBenchmarks
  className?: string
}) {
  const min = marketCF.cf25 * 0.85
  const max = marketCF.cf90 * 1.1
  const range = max - min
  const pct = (value: number) => Math.max(0, Math.min(100, ((value - min) / range) * 100))
  const currentPct = pct(currentCF)
  const recommendedPct = pct(recommendedCF)
  const showBoth = Math.abs(currentCF - recommendedCF) > 0.01
  const tooltip = `25th: $${marketCF.cf25.toFixed(0)} · 50th: $${marketCF.cf50.toFixed(0)} · 75th: $${marketCF.cf75.toFixed(0)} · 90th: $${marketCF.cf90.toFixed(0)} · Current: $${currentCF.toFixed(0)} · Recommended: $${recommendedCF.toFixed(0)}`

  return (
    <div
      className={className}
      title={tooltip}
      role="img"
      aria-label={tooltip}
    >
      <div className="relative h-3 w-[140px]">
        <div className="absolute inset-x-0 top-1 h-1 rounded-full bg-muted/60" />
        <div
          className="absolute top-1 h-1 rounded-l-full bg-emerald-200 dark:bg-emerald-900/40"
          style={{
            left: `${pct(marketCF.cf25)}%`,
            width: `${pct(marketCF.cf50) - pct(marketCF.cf25)}%`,
          }}
        />
        <div
          className="absolute top-1 h-1 bg-amber-200 dark:bg-amber-900/40"
          style={{
            left: `${pct(marketCF.cf50)}%`,
            width: `${pct(marketCF.cf75) - pct(marketCF.cf50)}%`,
          }}
        />
        <div
          className="absolute top-1 h-1 rounded-r-full bg-red-200 dark:bg-red-900/40"
          style={{
            left: `${pct(marketCF.cf75)}%`,
            width: `${pct(marketCF.cf90) - pct(marketCF.cf75)}%`,
          }}
        />
        {showBoth ? (
          <>
            <div
              className="absolute top-0 size-2.5 rounded-full border-2 border-muted-foreground/40 bg-background"
              style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
            />
            <div
              className="absolute top-0 size-3 rounded-full border-2 border-primary bg-background"
              style={{ left: `${recommendedPct}%`, transform: 'translateX(-50%)' }}
            />
          </>
        ) : (
          <div
            className="absolute top-0 size-3 rounded-full border-2 border-primary bg-background"
            style={{ left: `${recommendedPct}%`, transform: 'translateX(-50%)' }}
            title="Current ≈ Recommended"
          />
        )}
      </div>
    </div>
  )
}

/**
 * Full-width market CF ruler for detail drawer / cards.
 * Shows 25/50/75/90 bands and current + recommended CF with labels.
 */
export function MarketCFRuler({
  currentCF,
  recommendedCF,
  marketCF,
  cfPercentile,
}: {
  currentCF: number
  recommendedCF: number
  marketCF: MarketCFBenchmarks
  cfPercentile: number
}) {
  const min = marketCF.cf25 * 0.85
  const max = marketCF.cf90 * 1.1
  const range = max - min
  const pct = (value: number) => Math.max(0, Math.min(100, ((value - min) / range) * 100))
  const currentPct = pct(currentCF)
  const recommendedPct = pct(recommendedCF)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Market CF position</span>
        <span className="font-semibold tabular-nums">{Math.round(cfPercentile)}th percentile</span>
      </div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-muted/60" />
        <div
          className="absolute top-2 h-1.5 rounded-l-full bg-emerald-200 dark:bg-emerald-900/40"
          style={{ left: `${pct(marketCF.cf25)}%`, width: `${pct(marketCF.cf50) - pct(marketCF.cf25)}%` }}
        />
        <div
          className="absolute top-2 h-1.5 bg-amber-200 dark:bg-amber-900/40"
          style={{ left: `${pct(marketCF.cf50)}%`, width: `${pct(marketCF.cf75) - pct(marketCF.cf50)}%` }}
        />
        <div
          className="absolute top-2 h-1.5 rounded-r-full bg-red-200 dark:bg-red-900/40"
          style={{ left: `${pct(marketCF.cf75)}%`, width: `${pct(marketCF.cf90) - pct(marketCF.cf75)}%` }}
        />
        {Math.abs(currentCF - recommendedCF) > 0.01 ? (
          <div
            className="absolute top-0.5 size-3 rounded-full border-2 border-muted-foreground/40 bg-background"
            style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
          />
        ) : null}
        <div
          className="absolute top-0 size-4 rounded-full border-2 border-primary bg-background"
          style={{ left: `${recommendedPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="relative h-4 text-xs text-muted-foreground tabular-nums">
        {[
          { label: '25', value: marketCF.cf25 },
          { label: '50', value: marketCF.cf50 },
          { label: '75', value: marketCF.cf75 },
          { label: '90', value: marketCF.cf90 },
        ].map((b) => (
          <span
            key={b.label}
            className="absolute -translate-x-1/2"
            style={{ left: `${pct(b.value)}%` }}
          >
            ${b.value.toFixed(0)}
          </span>
        ))}
      </div>
    </div>
  )
}
