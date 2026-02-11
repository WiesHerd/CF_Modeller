import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  Customized,
} from 'recharts'
import type { BarShapeProps } from 'recharts'
import { formatCurrency, formatCurrencyCompact } from '@/utils/format'

export interface WaterfallSegment {
  name: string
  value: number
  type: 'start' | 'delta' | 'end'
}

const MIN_DELTA_BAR_PX = 10

interface TCCWaterfallChartProps {
  segments: WaterfallSegment[]
  /** When set, chart uses this height for uniform grid layout (e.g. 240). */
  height?: number
  /** Optional one-line call-out under the chart (e.g. "Net change: -$11k from Base and Incentive"). */
  calloutText?: string
}

function getSegmentFill(segment: WaterfallSegment): string {
  if (segment.type === 'start') return 'var(--chart-1)'
  if (segment.type === 'end') return 'var(--chart-2)'
  if (segment.type === 'delta' && segment.value === 0) return 'var(--muted)'
  if (segment.value >= 0) return 'var(--chart-1)'
  return 'var(--destructive)'
}

/** Bar shape: enforces minimum pixel height for delta segments so small/zero deltas stay visible. */
function WaterfallBarShape(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  const seg = payload?.segment as WaterfallSegment | undefined
  const isDelta = seg?.type === 'delta'
  const absH = Math.abs(height)
  // Show at least a thin bar for deltas: zero change or very small change
  const useMin = isDelta && (absH < MIN_DELTA_BAR_PX || absH === 0)
  const h = useMin ? (height >= 0 ? MIN_DELTA_BAR_PX : -MIN_DELTA_BAR_PX) : height
  const drawY = useMin && height >= 0 ? y + height - MIN_DELTA_BAR_PX : y
  const fill = seg ? getSegmentFill(seg) : 'var(--chart-1)'
  return <rect x={x} y={drawY} width={width} height={h} fill={fill} rx={4} ry={4} />
}

/** Draws thin vertical connector lines between waterfall segments. */
function WaterfallConnectors(props: {
  xAxisMap?: Record<string, { scale: (v: number) => number }>
  offset?: { left?: number; top?: number; height?: number }
  data?: { name: string }[]
}) {
  const { xAxisMap, offset = {}, data = [] } = props
  const xAxis = xAxisMap?.['0']
  if (!xAxis?.scale || data.length < 2) return null
  const scale = xAxis.scale as (v: number) => number
  const left = offset.left ?? 0
  const top = offset.top ?? 0
  const plotHeight = offset.height ?? 200
  const lines: React.ReactNode[] = []
  for (let i = 1; i < data.length; i++) {
    const x = scale(i)
    if (typeof x !== 'number' || !Number.isFinite(x)) continue
    const xPos = left + x
    lines.push(
      <line
        key={`connector-${i}`}
        x1={xPos}
        y1={top}
        x2={xPos}
        y2={top + plotHeight}
        stroke="var(--border)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
    )
  }
  return <g>{lines}</g>
}

export function TCCWaterfallChart({ segments, height: heightProp, calloutText }: TCCWaterfallChartProps) {
  const [responsiveHeight, setResponsiveHeight] = useState(180)
  useEffect(() => {
    if (heightProp != null) return
    const m = window.matchMedia('(min-width: 640px)')
    const update = () => setResponsiveHeight(m.matches ? 200 : 180)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [heightProp])
  const chartHeight = heightProp ?? responsiveHeight

  // Stacked bar: offset (transparent) + value (visible). First row: offset=0, value=start. Then each delta: offset=running, value=delta; running+=delta. Last row: offset=0, value=end.
  let running = 0
  const data = segments.map((seg) => {
    if (seg.type === 'start') {
      running = seg.value
      return { name: seg.name, offset: 0, value: seg.value, segment: seg }
    }
    if (seg.type === 'delta') {
      const row = { name: seg.name, offset: running, value: seg.value, segment: seg }
      running += seg.value
      return row
    }
    return { name: seg.name, offset: 0, value: seg.value, segment: seg }
  })

  const rawMax = Math.max(...data.map((d) => d.offset + d.value), 1)
  const rawMin = Math.min(0, ...data.map((d) => (d.value < 0 ? d.offset + d.value : d.offset)))
  const startVal = segments[0]?.value ?? 0
  const endVal = segments[segments.length - 1]?.value ?? 0
  const REF_CAP = 3_000_000
  const REF_FLOOR = 500_000
  const REF_MIN_NEG = -1_000_000
  const domainMax =
    rawMax > REF_CAP
      ? Math.min(REF_CAP, Math.max(2 * Math.max(startVal, endVal), REF_FLOOR))
      : rawMax * 1.05
  const domainMin =
    rawMin < REF_MIN_NEG
      ? Math.max(REF_MIN_NEG, 2 * rawMin)
      : rawMin - (domainMax - rawMin) * 0.05

  const ariaLabel = `Waterfall chart: Current TCC ${formatCurrency(startVal, { decimals: 0 })} to Modeled TCC ${formatCurrency(endVal, { decimals: 0 })}`

  return (
    <div role="img" aria-label={ariaLabel} className="flex h-full w-full min-h-0 flex-col">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 28 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="2 4" className="stroke-muted" vertical={false} strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatCurrencyCompact(v)}
            domain={[domainMin, domainMax]}
            label={{ value: 'TCC ($)', position: 'insideLeft', angle: -90, fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number | undefined, _name, props) => {
              const payload = props.payload as { segment?: WaterfallSegment }
              const seg = payload?.segment
              if (seg?.type === 'delta' && value !== 0) {
                return [formatCurrency(Number(value), { decimals: 0 }), seg.name]
              }
              return [formatCurrency(Number(value ?? 0), { decimals: 0 }), seg?.name ?? '']
            }}
            contentStyle={{ fontSize: 12 }}
            labelFormatter={(label) => label}
          />
          <Customized component={(p: Record<string, unknown>) => <WaterfallConnectors {...p} data={data} />} />
          <Bar dataKey="offset" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="value"
            stackId="waterfall"
            radius={[4, 4, 0, 0]}
            isAnimationActive={true}
            shape={(props: BarShapeProps) => <WaterfallBarShape {...props} />}
          >
            <LabelList
              dataKey="value"
              position="top"
              formatter={(label: unknown) => {
                const v = Number(label)
                if (Number.isNaN(v)) return ''
                return formatCurrencyCompact(v)
              }}
              style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getSegmentFill(entry.segment)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-muted-foreground mt-1.5 space-y-0.5 text-center text-xs">
        {calloutText ? <p>{calloutText}</p> : null}
        <p>Deltas show change from prior step.</p>
      </div>
    </div>
  )
}
