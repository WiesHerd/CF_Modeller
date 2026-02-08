import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

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

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number | undefined, _name, props) => {
            const v = value ?? 0
            const label = props.payload?.name
            if (label === 'CF ($/wRVU)') return [`$${Number(v).toFixed(2)}`, '']
            return [`${Number(v).toFixed(1)}%`, '']
          }}
        />
        <Legend />
        <Bar dataKey="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Modeled" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
