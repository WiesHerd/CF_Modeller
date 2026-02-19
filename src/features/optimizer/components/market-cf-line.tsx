import type { MarketCFBenchmarks } from '@/types/optimizer'
import { inferPercentile } from '@/lib/interpolation'

/**
 * Map a CF dollar value to a position 0–100 on a percentile-scaled bar.
 * 25th/50th/75th/90th then sit at 25/50/75/90% so the circle at "50th percentile" is in the middle.
 */
function cfToPercentilePosition(
  value: number,
  cf25: number,
  cf50: number,
  cf75: number,
  cf90: number
): number {
  const { percentile } = inferPercentile(value, cf25, cf50, cf75, cf90)
  return Math.max(0, Math.min(100, percentile))
}

/**
 * Compact horizontal market CF line for table cells.
 * Axis is percentile (0–100): 25/50/75/90 at 25%/50%/75%/90% width so the circle aligns correctly (e.g. 50th at center).
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
  const { cf25, cf50, cf75, cf90 } = marketCF
  const toPos = (value: number) => cfToPercentilePosition(value, cf25, cf50, cf75, cf90)
  const currentPct = toPos(currentCF)
  const recommendedPct = toPos(recommendedCF)
  const showBoth = Math.abs(currentCF - recommendedCF) > 0.01
  const tooltip = `25th: $${cf25.toFixed(0)} · 50th: $${cf50.toFixed(0)} · 75th: $${cf75.toFixed(0)} · 90th: $${cf90.toFixed(0)} · Current: $${currentCF.toFixed(0)} · Recommended: $${recommendedCF.toFixed(0)}`

  return (
    <div
      className={className}
      title={tooltip}
      role="img"
      aria-label={tooltip}
    >
      <div className="relative h-3 w-full min-w-[140px]">
        <div className="absolute inset-x-0 top-1 h-1 rounded-full bg-muted/60" />
        <div
          className="absolute top-1 h-1 rounded-l-full bg-emerald-200 dark:bg-emerald-900/40"
          style={{ left: '25%', width: '25%' }}
        />
        <div
          className="absolute top-1 h-1 bg-amber-200 dark:bg-amber-900/40"
          style={{ left: '50%', width: '25%' }}
        />
        <div
          className="absolute top-1 h-1 rounded-r-full bg-red-200 dark:bg-red-900/40"
          style={{ left: '75%', width: '15%' }}
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
 * Axis is percentile (0–100): 25/50/75/90 at fixed positions; circle at inferred percentile.
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
  const { cf25, cf50, cf75, cf90 } = marketCF
  const toPos = (value: number) => cfToPercentilePosition(value, cf25, cf50, cf75, cf90)
  const currentPct = toPos(currentCF)
  const recommendedPct = toPos(recommendedCF)

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
          style={{ left: '25%', width: '25%' }}
        />
        <div
          className="absolute top-2 h-1.5 bg-amber-200 dark:bg-amber-900/40"
          style={{ left: '50%', width: '25%' }}
        />
        <div
          className="absolute top-2 h-1.5 rounded-r-full bg-red-200 dark:bg-red-900/40"
          style={{ left: '75%', width: '15%' }}
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
          { label: '25', value: cf25 },
          { label: '50', value: cf50 },
          { label: '75', value: cf75 },
          { label: '90', value: cf90 },
        ].map((b) => (
          <span
            key={b.label}
            className="absolute -translate-x-1/2"
            style={{ left: `${b.label === '25' ? 25 : b.label === '50' ? 50 : b.label === '75' ? 75 : 90}%` }}
          >
            ${b.value.toFixed(0)}
          </span>
        ))}
      </div>
    </div>
  )
}
