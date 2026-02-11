import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

interface PercentileComparisonChartProps {
  wrvuCurrent: number
  wrvuModeled: number
  tccCurrent: number
  tccModeled: number
  /** When set, chart uses this height for uniform grid layout (e.g. 240). */
  height?: number
}

export function PercentileComparisonChart({
  wrvuCurrent,
  wrvuModeled,
  tccCurrent,
  tccModeled,
  height: heightProp,
}: PercentileComparisonChartProps) {
  const [responsiveHeight, setResponsiveHeight] = useState(200)
  useEffect(() => {
    if (heightProp != null) return
    const m = window.matchMedia('(min-width: 640px)')
    const update = () => setResponsiveHeight(m.matches ? 220 : 200)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [heightProp])
  const chartHeight = heightProp ?? responsiveHeight
  const legendHeight = 28
  const chartAreaHeight = chartHeight - legendHeight

  const data = [
    { name: 'wRVU %ile', Current: wrvuCurrent, Modeled: wrvuModeled },
    { name: 'TCC %ile', Current: tccCurrent, Modeled: tccModeled },
  ]
  const ariaLabel = `Bar chart: wRVU percentile Current ${Math.round(wrvuCurrent)}, Modeled ${Math.round(wrvuModeled)}; TCC percentile Current ${Math.round(tccCurrent)}, Modeled ${Math.round(tccModeled)}`

  return (
    <div role="img" aria-label={ariaLabel} className="flex h-full w-full min-h-0 flex-col">
      <ResponsiveContainer width="100%" height={chartAreaHeight} className="min-h-0">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={[0, 100]}
            label={{ value: 'Percentile (0–100)', position: 'insideLeft', angle: -90, fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number | undefined, _name, props) => {
              const v = Number(value ?? 0)
              const ord = v === 1 ? '1st' : v === 2 ? '2nd' : v === 3 ? '3rd' : `${Math.round(v)}th`
              return [ord + ' percentile', (props.payload as { name?: string })?.name ?? '']
            }}
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="Current"
              position="top"
              formatter={(label: unknown) => (label != null && typeof label === 'number' ? String(Math.round(label)) : '')}
              style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            />
          </Bar>
          <Bar dataKey="Modeled" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="Modeled"
              position="top"
              formatter={(label: unknown) => (label != null && typeof label === 'number' ? String(Math.round(label)) : '')}
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
