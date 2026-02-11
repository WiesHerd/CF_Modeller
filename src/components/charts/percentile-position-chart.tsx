import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  LabelList,
} from 'recharts'
import { formatOrdinal } from '@/utils/format'

interface PercentilePositionChartProps {
  tccPercentile: number
  modeledTCCPercentile: number
  /** Optional wRVU percentile (unchanged between current and modeled). */
  wrvuPercentile?: number
  /** When set, chart uses this height for uniform grid layout (e.g. 240). */
  height?: number
}

export function PercentilePositionChart({
  tccPercentile,
  modeledTCCPercentile,
  height: heightProp,
}: PercentilePositionChartProps) {
  const [responsiveHeight, setResponsiveHeight] = useState(140)
  useEffect(() => {
    if (heightProp != null) return
    const m = window.matchMedia('(min-width: 640px)')
    const update = () => setResponsiveHeight(m.matches ? 160 : 140)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [heightProp])
  const chartHeight = heightProp ?? responsiveHeight
  const legendHeight = 28
  const chartAreaHeight = chartHeight - legendHeight

  const data = [
    { name: 'Current', Current: Math.round(tccPercentile * 10) / 10, Modeled: null as number | null },
    { name: 'Modeled', Current: null as number | null, Modeled: Math.round(modeledTCCPercentile * 10) / 10 },
  ]
  const ariaLabel = `Bar chart: TCC percentile Current ${formatOrdinal(tccPercentile)}, Modeled ${formatOrdinal(modeledTCCPercentile)}`

  return (
    <div role="img" aria-label={ariaLabel} className="flex h-full w-full min-h-0 flex-col">
      <ResponsiveContainer width="100%" height={chartAreaHeight} className="min-h-0">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 60, bottom: 24 }}
        >
          <CartesianGrid strokeDasharray="2 6" className="stroke-muted" horizontal={false} strokeOpacity={0.4} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: 'TCC percentile (0–100)', position: 'insideBottom', offset: -4, fontSize: 11 }}
          />
          <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number | undefined) => {
              const v = Number(value ?? 0)
              const ord = v === 1 ? '1st' : v === 2 ? '2nd' : v === 3 ? '3rd' : `${Math.round(v)}th`
              return [`${ord} percentile`, 'TCC']
            }}
            contentStyle={{ fontSize: 12 }}
            labelFormatter={() => 'TCC percentile'}
          />
          <ReferenceArea
            x1={25}
            x2={75}
            fill="var(--muted)"
            fillOpacity={0.35}
            stroke="none"
            label={{ value: '25th–75th band', position: 'insideTopRight', fontSize: 10 }}
          />
          <ReferenceLine x={25} stroke="var(--border)" strokeDasharray="2 2" />
          <ReferenceLine x={75} stroke="var(--border)" strokeDasharray="2 2" />
          <Bar dataKey="Current" fill="var(--chart-1)" barSize={24} radius={[0, 4, 4, 0]} isAnimationActive>
            <LabelList
              dataKey="Current"
              position="right"
              formatter={(label: unknown) => (label != null && typeof label === 'number' ? formatOrdinal(label) : '')}
              style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            />
          </Bar>
          <Bar dataKey="Modeled" fill="var(--chart-2)" barSize={24} radius={[0, 4, 4, 0]} isAnimationActive>
            <LabelList
              dataKey="Modeled"
              position="right"
              formatter={(label: unknown) => (label != null && typeof label === 'number' ? formatOrdinal(label) : '')}
              style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--chart-1)]" aria-hidden />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--chart-2)]" aria-hidden />
          Modeled
        </span>
      </div>
    </div>
  )
}
