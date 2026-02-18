/**
 * Run and review: explains how the optimizer chose the target and shows
 * market data (CF 25/50/75/90) plus a chart of recommended CF percentile by specialty.
 */
import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { inferPercentile } from '@/lib/interpolation'
import type { OptimizerRunResult, OptimizerSettings, OptimizationObjective } from '@/types/optimizer'

const MAX_SPECIALTIES_IN_CHART = 24

function formatObjective(obj: OptimizationObjective): string {
  switch (obj.kind) {
    case 'align_percentile':
      return 'Align TCC percentile to wRVU percentile (pay rank follows productivity rank).'
    case 'target_fixed_percentile':
      return `Target a fixed TCC percentile: move pay toward the ${obj.targetPercentile}th percentile vs market.`
    case 'hybrid':
      return `Hybrid: ${Math.round((obj.alignWeight ?? 0.7) * 100)}% align pay to productivity rank, ${Math.round((obj.targetWeight ?? 0.3) * 100)}% pull toward ${obj.targetPercentile}th percentile.`
    default:
      return String((obj as { kind: string }).kind)
  }
}

function formatOrdinal(n: number): string {
  const s = n.toFixed(1)
  if (s.endsWith('1') && !s.endsWith('11')) return `${s}st`
  if (s.endsWith('2') && !s.endsWith('12')) return `${s}nd`
  if (s.endsWith('3') && !s.endsWith('13')) return `${s}rd`
  return `${s}th`
}

export function OptimizerTargetExplanation({
  result,
  settings,
}: {
  result: OptimizerRunResult
  settings: OptimizerSettings | null | undefined
}) {
  const chartData = useMemo(() => {
    return result.bySpecialty.slice(0, MAX_SPECIALTIES_IN_CHART).map((row) => {
      const { percentile } = inferPercentile(
        row.recommendedCF,
        row.marketCF.cf25,
        row.marketCF.cf50,
        row.marketCF.cf75,
        row.marketCF.cf90
      )
      return {
        specialty: row.specialty,
        pct: Math.round(percentile * 10) / 10,
        recommendedCF: row.recommendedCF,
      }
    })
  }, [result.bySpecialty])

  const objectiveText = settings?.optimizationObjective
    ? formatObjective(settings.optimizationObjective)
    : 'Align pay (TCC) percentile to productivity (wRVU) percentile.'
  const errorMetricLabel = settings?.errorMetric === 'absolute' ? 'MAE (absolute)' : 'MSE (squared)'
  const truncatedCount = Math.max(0, result.bySpecialty.length - MAX_SPECIALTIES_IN_CHART)

  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 p-4 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2">
        How the target was chosen
      </h3>

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Objective: </span>
            {objectiveText}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Error metric: </span>
            {errorMetricLabel} — the optimizer picks a conversion factor (CF) per specialty that minimizes this error
            across included providers.
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Market data: </span>
            Each specialty uses your market file’s CF and TCC at the 25th, 50th, 75th, and 90th percentiles. The chart
            on the right shows where the <strong>recommended CF</strong> lands in that market range (as a percentile).
          </p>
        </div>

        <div className="min-h-[280px]">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Recommended CF market percentile by specialty
          </p>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 8, left: 100, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="2 4" className="stroke-muted" horizontal={false} strokeOpacity={0.4} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="specialty"
                  width={96}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => (v.length > 18 ? v.slice(0, 17) + '…' : v)}
                />
                <ReferenceLine x={25} stroke="var(--muted-foreground)" strokeDasharray="2 2" strokeOpacity={0.7} label={{ value: '25th', position: 'top', fontSize: 9 }} />
                <ReferenceLine x={50} stroke="var(--muted-foreground)" strokeDasharray="2 2" strokeOpacity={0.7} label={{ value: '50th', position: 'top', fontSize: 9 }} />
                <ReferenceLine x={75} stroke="var(--muted-foreground)" strokeDasharray="2 2" strokeOpacity={0.7} label={{ value: '75th', position: 'top', fontSize: 9 }} />
                <ReferenceLine x={90} stroke="var(--muted-foreground)" strokeDasharray="2 2" strokeOpacity={0.7} label={{ value: '90th', position: 'top', fontSize: 9 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as { specialty: string; pct: number; recommendedCF: number }
                    return (
                      <div className="rounded border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                        <div className="font-medium">{p.specialty}</div>
                        <div className="text-muted-foreground">
                          {formatOrdinal(p.pct)} percentile · ${p.recommendedCF.toFixed(0)}
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="pct" fill="var(--primary)" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {truncatedCount > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Showing first {MAX_SPECIALTIES_IN_CHART} specialties; {truncatedCount} more in table below.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-background/80 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Market CF benchmarks (sample)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="text-left py-1.5 pr-2 font-medium">Specialty</th>
                <th className="text-right py-1.5 px-2 tabular-nums">25th</th>
                <th className="text-right py-1.5 px-2 tabular-nums">50th</th>
                <th className="text-right py-1.5 px-2 tabular-nums">75th</th>
                <th className="text-right py-1.5 px-2 tabular-nums">90th</th>
                <th className="text-right py-1.5 px-2 tabular-nums font-medium text-foreground">Recommended</th>
                <th className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">CF %ile</th>
              </tr>
            </thead>
            <tbody>
              {result.bySpecialty.slice(0, 8).map((row) => {
                const { percentile } = inferPercentile(
                  row.recommendedCF,
                  row.marketCF.cf25,
                  row.marketCF.cf50,
                  row.marketCF.cf75,
                  row.marketCF.cf90
                )
                return (
                  <tr key={row.specialty} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 pr-2 font-medium">{row.specialty}</td>
                    <td className="text-right px-2 tabular-nums">${row.marketCF.cf25.toFixed(0)}</td>
                    <td className="text-right px-2 tabular-nums">${row.marketCF.cf50.toFixed(0)}</td>
                    <td className="text-right px-2 tabular-nums">${row.marketCF.cf75.toFixed(0)}</td>
                    <td className="text-right px-2 tabular-nums">${row.marketCF.cf90.toFixed(0)}</td>
                    <td className="text-right px-2 tabular-nums font-medium text-primary">
                      ${row.recommendedCF.toFixed(0)}
                    </td>
                    <td className="text-right px-2 tabular-nums text-muted-foreground">
                      {formatOrdinal(percentile)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          First 8 specialties. Click a row in the table below to see the full market band and recommendation for any
          specialty.
        </p>
      </div>
    </div>
  )
}
