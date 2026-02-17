import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ProductivityTargetRunResult } from '@/types/productivity-target'

/** Semantic colors: under target (warning), approaching, on target, exceeds */
const BAND_FILLS = [
  'var(--destructive)', // <80%
  'var(--chart-4)', // 80–99% (amber/caution)
  'var(--chart-1)', // 100–119% (green)
  'var(--chart-2)', // ≥120% (strong)
] as const

function summarySentence(
  total: number,
  below80: number,
  eightyTo99: number,
  hundredTo119: number,
  atOrAbove120: number
): string {
  if (total === 0) return ''
  const aboveTarget = hundredTo119 + atOrAbove120
  const belowTarget = below80 + eightyTo99
  if (atOrAbove120 >= total * 0.4) return 'Most providers exceed or meet target.'
  if (below80 >= total * 0.4) return 'A large share of providers are below target.'
  if (aboveTarget > belowTarget) return 'More providers are at or above target than below.'
  if (belowTarget > aboveTarget) return 'More providers are below target than at or above.'
  return 'Performance is spread across bands.'
}

export function ProductivityTargetHistogram({ result }: { result: ProductivityTargetRunResult }) {
  const { bandData, total, summary } = useMemo(() => {
    const bands = { below80: 0, eightyTo99: 0, hundredTo119: 0, atOrAbove120: 0 }
    for (const spec of result.bySpecialty) {
      bands.below80 += spec.summary.bandCounts.below80
      bands.eightyTo99 += spec.summary.bandCounts.eightyTo99
      bands.hundredTo119 += spec.summary.bandCounts.hundredTo119
      bands.atOrAbove120 += spec.summary.bandCounts.atOrAbove120
    }
    const data = [
      { band: '<80%', count: bands.below80 },
      { band: '80–99%', count: bands.eightyTo99 },
      { band: '100–119%', count: bands.hundredTo119 },
      { band: '≥120%', count: bands.atOrAbove120 },
    ]
    const tot = data.reduce((s, d) => s + d.count, 0)
    const summaryText =
      tot === 0
        ? ''
        : summarySentence(
            tot,
            bands.below80,
            bands.eightyTo99,
            bands.hundredTo119,
            bands.atOrAbove120
          )
    return { bandData: data, total: tot, summary: summaryText }
  }, [result.bySpecialty])

  if (total === 0) return null

  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Percent to target (all providers)</h3>
      <div className="mb-3 text-xs text-muted-foreground leading-relaxed">
        Of {total} provider{total !== 1 ? 's' : ''}, {bandData[0].count} below 80%, {bandData[1].count} at 80–99%,{' '}
        {bandData[2].count} at 100–119%, and {bandData[3].count} at or above 120%. {summary}
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bandData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="band" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <RechartsTooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value: number | undefined) => [value ?? 0, 'Providers']}
              labelFormatter={(label) => `% to target: ${label}`}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {bandData.map((_, index) => (
                <Cell key={bandData[index].band} fill={BAND_FILLS[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
