/**
 * Vertical bar chart: aggregated FTE by type (Clinical, Admin, Teaching, Research, Other).
 * Used in CF Optimizer run/review sidebar and optionally in the specialty detail drawer.
 */

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { AggregatedFTE } from '@/utils/aggregate-fte'

const FTE_LABELS: Record<keyof AggregatedFTE, string> = {
  clinical: 'Clinical',
  admin: 'Admin',
  teaching: 'Teaching',
  research: 'Research',
  other: 'Other',
}

const FTE_COLORS: Record<keyof AggregatedFTE, string> = {
  clinical: 'var(--chart-1)',
  admin: 'var(--chart-2)',
  teaching: 'var(--chart-3)',
  research: 'var(--chart-4)',
  other: 'var(--muted-foreground)',
}

export interface PopulationFTEChartProps {
  data: AggregatedFTE
  title?: string
  subtitle?: string
  /** Optional provider count for tooltip. */
  providerCount?: number
  /** Chart height. Default 220. */
  height?: number
  /** Bar thickness. Default 20. */
  barSize?: number
}

function formatFTE(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function PopulationFTEChart({
  data,
  title = 'Aggregated FTE',
  subtitle,
  providerCount,
  height = 220,
  barSize = 20,
}: PopulationFTEChartProps) {
  type ChartDatum = { key: keyof AggregatedFTE; name: string; value: number; fill: string }
  const chartData: ChartDatum[] = [
    { key: 'clinical', name: FTE_LABELS.clinical, value: data.clinical, fill: FTE_COLORS.clinical },
    { key: 'admin', name: FTE_LABELS.admin, value: data.admin, fill: FTE_COLORS.admin },
    { key: 'teaching', name: FTE_LABELS.teaching, value: data.teaching, fill: FTE_COLORS.teaching },
    { key: 'research', name: FTE_LABELS.research, value: data.research, fill: FTE_COLORS.research },
  ]
  if (data.other > 0) {
    chartData.push({ key: 'other', name: FTE_LABELS.other, value: data.other, fill: FTE_COLORS.other })
  }

  const hasAny = chartData.some((d) => d.value > 0)
  const ariaLabel = hasAny
    ? chartData.map((d) => `${d.name}: ${formatFTE(d.value)} FTE`).join('; ')
    : 'No FTE data'

  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h3>
      ) : null}
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      {!hasAny ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No providers in current selection.</p>
      ) : (
        <div role="img" aria-label={ariaLabel} className="w-full">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.4} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v)} width={36} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as { name: string; value: number }
                  return (
                    <div className="rounded border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted-foreground">
                        {formatFTE(p.value)} FTE
                        {providerCount != null ? ` · ${providerCount} provider(s)` : ''}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={barSize} isAnimationActive>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasAny && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {chartData.filter((d) => d.value > 0).map((d) => (
            <span key={d.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: d.fill }}
                aria-hidden
              />
              {d.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
