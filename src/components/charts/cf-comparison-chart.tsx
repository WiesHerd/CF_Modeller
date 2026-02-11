import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { formatCurrency, formatOrdinal } from '@/utils/format'

interface CFComparisonChartProps {
  cfPercentileCurrent: number
  cfPercentileModeled: number
  currentCF: number
  modeledCF: number
}

export function CFComparisonChart({
  cfPercentileCurrent,
  cfPercentileModeled,
  currentCF,
  modeledCF,
}: CFComparisonChartProps) {
  const [chartHeight, setChartHeight] = useState(200)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 640px)')
    const update = () => setChartHeight(m.matches ? 220 : 200)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [])

  const data = [
    {
      name: 'CF %ile',
      Current: cfPercentileCurrent,
      Modeled: cfPercentileModeled,
    },
    {
      name: 'CF ($/wRVU)',
      Current: Math.round(currentCF * 100) / 100,
      Modeled: Math.round(modeledCF * 100) / 100,
    },
  ]
  const ariaLabel = `Bar chart: CF percentile Current ${formatOrdinal(cfPercentileCurrent)}, Modeled ${formatOrdinal(cfPercentileModeled)}; CF per wRVU Current ${formatCurrency(currentCF)}, Modeled ${formatCurrency(modeledCF)}`

  return (
    <div role="img" aria-label={ariaLabel} className="h-full w-full min-h-0">
      <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined, props: { payload?: { name?: string } }) => {
            const v = value ?? 0
            const metric = props.payload?.name ?? ''
            const series = name ?? ''
            if (metric === 'CF ($/wRVU)') return [formatCurrency(Number(v)), `${series} · $/wRVU`]
            return [`${Number(v).toFixed(1)}th percentile`, `${series} · CF %ile`]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, marginTop: 8 }} />
        <Bar dataKey="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="Current"
            position="top"
            formatter={(label: unknown) => {
              const v = Number(label)
              if (Number.isNaN(v)) return ''
              if (v >= 0 && v <= 100 && (Number.isInteger(v) || v < 1000)) return formatOrdinal(Math.round(v))
              return formatCurrency(v)
            }}
            style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          />
        </Bar>
        <Bar dataKey="Modeled" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="Modeled"
            position="top"
            formatter={(label: unknown) => {
              const v = Number(label)
              if (Number.isNaN(v)) return ''
              if (v >= 0 && v <= 100 && (Number.isInteger(v) || v < 1000)) return formatOrdinal(Math.round(v))
              return formatCurrency(v)
            }}
            style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  )
}
