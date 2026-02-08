import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults, RiskAssessment } from '@/types/scenario'
import { interpPercentile, inferPercentile } from '@/lib/interpolation'

function num(x: unknown): number {
  if (typeof x === 'number' && !Number.isNaN(x)) return x
  const n = Number(x)
  return Number.isNaN(n) ? 0 : n
}

function safeDiv(a: number, b: number, fallback: number): number {
  if (b == null || b === 0 || Number.isNaN(b)) return fallback
  const q = a / b
  return Number.isNaN(q) ? fallback : q
}

const LOW_FTE_RISK = 0.7
const LOW_WRVU_WARNING = 1000

export function computeScenario(
  provider: ProviderRow,
  market: MarketRow,
  scenario: ScenarioInputs
): ScenarioResults {
  const warnings: string[] = []
  const highRisk: string[] = []

  const baseSalary = num(provider.baseSalary)
  const totalFTE = num(provider.totalFTE) || 1
  const clinicalFTE = num(provider.clinicalFTE) || totalFTE || 1
  const totalWRVUs =
    num(provider.totalWRVUs) ||
    num(provider.pchWRVUs) + num(provider.outsideWRVUs)
  const psqPercent = scenario.psqPercent ?? 0
  const psqDollars = baseSalary * (psqPercent / 100)

  if (clinicalFTE < LOW_FTE_RISK)
    highRisk.push(`Clinical FTE (${clinicalFTE}) < ${LOW_FTE_RISK}`)
  if (totalFTE < LOW_FTE_RISK)
    highRisk.push(`Total FTE (${totalFTE}) < ${LOW_FTE_RISK}`)
  if (totalWRVUs < LOW_WRVU_WARNING && totalWRVUs > 0)
    warnings.push(`Total wRVUs (${totalWRVUs}) low; ratios may be unstable`)

  let annualThreshold: number
  if (scenario.thresholdMethod === 'annual') {
    annualThreshold = num(scenario.annualThreshold) ?? num(provider.currentThreshold) ?? 0
  } else {
    const wrvuPct = scenario.wrvuPercentile ?? 50
    const thresholdPerFTE = interpPercentile(
      wrvuPct,
      market.WRVU_25,
      market.WRVU_50,
      market.WRVU_75,
      market.WRVU_90
    )
    annualThreshold = thresholdPerFTE * clinicalFTE
  }

  const wRVUsAboveThreshold = Math.max(0, totalWRVUs - annualThreshold)

  const interpolatedCF = interpPercentile(
    scenario.proposedCFPercentile,
    market.CF_25,
    market.CF_50,
    market.CF_75,
    market.CF_90
  )
  const modeledCF = interpolatedCF * num(scenario.cfAdjustmentFactor)
  const currentCF = num(provider.currentCF)

  const annualIncentive = wRVUsAboveThreshold * modeledCF

  const currentTCCFromProvider = num(provider.currentTCC)
  const currentThreshold = num(provider.currentThreshold)
  const currentIncentive =
    currentCF > 0
      ? Math.max(0, totalWRVUs - currentThreshold) * currentCF
      : 0
  const currentTCC =
    currentTCCFromProvider > 0
      ? currentTCCFromProvider
      : baseSalary + currentIncentive + psqDollars

  const modeledTCC = baseSalary + annualIncentive + psqDollars
  const changeInTCC = modeledTCC - currentTCC

  const wrvuNorm = safeDiv(totalWRVUs, clinicalFTE, totalWRVUs)
  const tccNorm = safeDiv(currentTCC, totalFTE, currentTCC)
  const modeledTccNorm = safeDiv(modeledTCC, totalFTE, modeledTCC)

  const wrvuPctResult = inferPercentile(
    wrvuNorm,
    market.WRVU_25,
    market.WRVU_50,
    market.WRVU_75,
    market.WRVU_90
  )
  const tccPctResult = inferPercentile(
    tccNorm,
    market.TCC_25,
    market.TCC_50,
    market.TCC_75,
    market.TCC_90
  )
  const tccModeledPctResult = inferPercentile(
    modeledTccNorm,
    market.TCC_25,
    market.TCC_50,
    market.TCC_75,
    market.TCC_90
  )
  const cfPctResult =
    currentCF > 0
      ? inferPercentile(
          currentCF,
          market.CF_25,
          market.CF_50,
          market.CF_75,
          market.CF_90
        )
      : { percentile: 0 }
  const cfModeledPct = scenario.proposedCFPercentile

  if (wrvuPctResult.belowRange || wrvuPctResult.aboveRange)
    warnings.push('wRVU percentile is off-scale (below 25 or above 90)')
  if (tccPctResult.belowRange || tccPctResult.aboveRange)
    warnings.push('TCC percentile is off-scale (below 25 or above 90)')
  if (cfPctResult.belowRange || cfPctResult.aboveRange)
    warnings.push('CF percentile is off-scale (below 25 or above 90)')

  const imputedTCCPerWRVURatioCurrent = safeDiv(
    currentTCC,
    totalWRVUs,
    0
  )
  const imputedTCCPerWRVURatioModeled = safeDiv(
    modeledTCC,
    totalWRVUs,
    0
  )

  const risk: RiskAssessment = { highRisk, warnings }

  return {
    totalWRVUs,
    annualThreshold,
    wRVUsAboveThreshold,
    currentCF,
    modeledCF,
    imputedTCCPerWRVURatioCurrent,
    imputedTCCPerWRVURatioModeled,
    annualIncentive,
    psqDollars,
    currentTCC,
    modeledTCC,
    changeInTCC,
    wrvuPercentile: wrvuPctResult.percentile,
    wrvuPercentileBelowRange: wrvuPctResult.belowRange,
    wrvuPercentileAboveRange: wrvuPctResult.aboveRange,
    tccPercentile: tccPctResult.percentile,
    tccPercentileBelowRange: tccPctResult.belowRange,
    tccPercentileAboveRange: tccPctResult.aboveRange,
    modeledTCCPercentile: tccModeledPctResult.percentile,
    cfPercentileCurrent: cfPctResult.percentile,
    cfPercentileCurrentBelowRange: cfPctResult.belowRange,
    cfPercentileCurrentAboveRange: cfPctResult.aboveRange,
    cfPercentileModeled: cfModeledPct,
    risk,
    warnings,
  }
}
