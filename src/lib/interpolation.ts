/**
 * Linear interpolation for percentile curves.
 * Given points at 25, 50, 75, 90, returns value at targetPct.
 */
const PERCENTILES = [25, 50, 75, 90] as const

export function interpPercentile(
  targetPct: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number
): number {
  const values = [p25, p50, p75, p90]
  if (targetPct <= 25) {
    if (targetPct < 25) {
      const valueAt0 = 2 * p25 - p50
      return valueAt0 + (targetPct / 25) * (p25 - valueAt0)
    }
    return p25
  }
  if (targetPct >= 90) {
    if (targetPct > 90) {
      return p90 + ((targetPct - 90) / 10) * (p90 - p75)
    }
    return p90
  }
  for (let i = 0; i < PERCENTILES.length - 1; i++) {
    const pctLow = PERCENTILES[i]
    const pctHigh = PERCENTILES[i + 1]
    if (targetPct >= pctLow && targetPct <= pctHigh) {
      const valueLow = values[i]
      const valueHigh = values[i + 1]
      const frac = (targetPct - pctLow) / (pctHigh - pctLow)
      return valueLow + frac * (valueHigh - valueLow)
    }
  }
  return p90
}

export interface InferPercentileResult {
  percentile: number
  belowRange?: boolean
  aboveRange?: boolean
}

/**
 * Inverse: given a value and the p25/p50/p75/p90 curve, estimate percentile.
 * Returns belowRange/aboveRange when value is outside [p25, p90].
 */
export function inferPercentile(
  value: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number
): InferPercentileResult {
  if (value <= p25) {
    if (value === p25) return { percentile: 25 }
    const slope = (p50 - p25) / 25
    const extrapolated = slope !== 0 ? 25 + (value - p25) / slope : 25
    return { percentile: Math.max(0, extrapolated), belowRange: true }
  }
  if (value >= p90) {
    if (value === p90) return { percentile: 90 }
    const slope = (p90 - p75) / 15
    const extrapolated = slope !== 0 ? 90 + (value - p90) / slope : 90
    return { percentile: Math.min(100, extrapolated), aboveRange: true }
  }
  const values = [p25, p50, p75, p90]
  for (let i = 0; i < PERCENTILES.length - 1; i++) {
    const pctLow = PERCENTILES[i]
    const pctHigh = PERCENTILES[i + 1]
    const valueLow = values[i]
    const valueHigh = values[i + 1]
    if (value >= valueLow && value <= valueHigh) {
      const frac =
        valueHigh === valueLow ? 0 : (value - valueLow) / (valueHigh - valueLow)
      const percentile = pctLow + frac * (pctHigh - pctLow)
      return { percentile }
    }
  }
  return { percentile: 90 }
}

const TOLERANCE = 0.02

function assertApprox(a: number, b: number, msg: string) {
  const diff = Math.abs(a - b)
  if (diff > TOLERANCE) {
    throw new Error(`${msg}: expected ~${b}, got ${a}`)
  }
}

/**
 * Self-check: round-trip and boundary tests for interpolation.
 * Call from console or a "Validate math" button.
 */
export function runInterpolationSelfCheck(): void {
  const p25 = 100
  const p50 = 150
  const p75 = 200
  const p90 = 250

  assertApprox(
    interpPercentile(25, p25, p50, p75, p90),
    p25,
    'interp(25) should equal p25'
  )
  assertApprox(
    interpPercentile(50, p25, p50, p75, p90),
    p50,
    'interp(50) should equal p50'
  )
  assertApprox(
    interpPercentile(75, p25, p50, p75, p90),
    p75,
    'interp(75) should equal p75'
  )
  assertApprox(
    interpPercentile(90, p25, p50, p75, p90),
    p90,
    'interp(90) should equal p90'
  )

  const v40 = interpPercentile(40, p25, p50, p75, p90)
  const back40 = inferPercentile(v40, p25, p50, p75, p90)
  assertApprox(back40.percentile, 40, 'infer(interp(40)) should be ~40')

  const v60 = interpPercentile(60, p25, p50, p75, p90)
  const back60 = inferPercentile(v60, p25, p50, p75, p90)
  assertApprox(back60.percentile, 60, 'infer(interp(60)) should be ~60')

  const below = inferPercentile(50, p25, p50, p75, p90)
  if (!below.belowRange) throw new Error('Value 50 < p25 should set belowRange')
  const above = inferPercentile(300, p25, p50, p75, p90)
  if (!above.aboveRange) throw new Error('Value 300 > p90 should set aboveRange')

  if (import.meta.env.DEV && typeof console !== 'undefined' && console.log) {
    console.log('Interpolation self-check passed.')
  }
}
