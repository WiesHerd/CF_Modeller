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

interface PercentileComparisonChartProps {
  wrvuCurrent: number
  wrvuModeled: number
  tccCurrent: number
  tccModeled: number
}

export function PercentileComparisonChart({
  wrvuCurrent,
  wrvuModeled,
  tccCurrent,
  tccModeled,
}: PercentileComparisonChartProps) {
  const data = [
    { name: 'wRVU %ile', Current: wrvuCurrent, Modeled: wrvuModeled },
    { name: 'TCC %ile', Current: tccCurrent, Modeled: tccModeled },
  ]

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
        <Tooltip
          formatter={(value: number | undefined) => [`${Number(value ?? 0).toFixed(1)}%`, '']}
          labelFormatter={(label) => label}
        />
        <Legend />
        <Bar dataKey="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Modeled" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
