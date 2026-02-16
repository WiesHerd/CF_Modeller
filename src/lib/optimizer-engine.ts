/**
 * Conversion Factor Optimizer – pure engine for specialty-level CF recommendations.
 * Baseline TCC = clinical base + PSQ only; modeled TCC = base + PSQ + incentive(CF).
 * Normalizes to 1.0 cFTE; minimizes MSE or MAE of percentile alignment per specialty.
 */

import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs } from '@/types/scenario'
import { inferPercentile, interpPercentile } from '@/lib/interpolation'
import { matchMarketRow, normalizeSpecialtyKey } from '@/lib/batch'
import {
  getBaselineTCCNormalizedForOptimizer,
  getClinicalBase,
  getClinicalFTE,
  getModeledTCCWithCF,
  getIncentiveDerived,
  getQualityDollarsForOptimizerConfig,
  getTotalWRVUs,
  getLayeredTCCAmount,
} from '@/lib/normalize-compensation'
import type {
  BenchmarkBasis,
  ModeledTCCToggles,
  OptimizerSettings,
  OptimizerSpecialtyResult,
  OptimizerProviderContext,
  OptimizerRunResult,
  OptimizerRunSummary,
  OptimizerAuditExport,
  ExclusionReason,
  OptimizerFlag,
  PolicyCheckStatus,
  OutlierMethod,
  OptimizerErrorMetric,
  OptimizerKeyMetrics,
  OptimizerRecommendedAction,
  OptimizerStatus,
  OptimizerExplanation,
  GovernanceConfig,
  MarketCFBenchmarks,
  CFSweepRow,
  CFSweepSpecialtyResult,
  CFSweepAllResult,
} from '@/types/optimizer'

// --- Helpers ---

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

/** LOA flag: optional field on provider (e.g. leaveOfAbsence or similar). */
function isLOA(provider: ProviderRow): boolean {
  const p = provider as unknown as Record<string, unknown>
  return p?.loa === true || p?.leaveOfAbsence === true || (typeof p?.LOA === 'string' && p.LOA.toLowerCase() === 'yes')
}

// ---------------------------------------------------------------------------
// 1) Percentile engine: value -> percentile (piecewise 25/50/75/90), off-scale not clamped
// ---------------------------------------------------------------------------

export interface PercentileResult {
  percentile: number
  belowRange: boolean
  aboveRange: boolean
}

/**
 * Map a value to a percentile using market benchmark points. Off-scale returns <25 or >90; not clamped.
 */
export function percentileFromBenchmarks(
  value: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number
): PercentileResult {
  const r = inferPercentile(value, p25, p50, p75, p90)
  return {
    percentile: r.percentile,
    belowRange: r.belowRange ?? false,
    aboveRange: r.aboveRange ?? false,
  }
}

/** Numeric percentile only (for callers that don't need flags). */
export function percentileFromBenchmarksValue(
  value: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number
): number {
  return inferPercentile(value, p25, p50, p75, p90).percentile
}

// ---------------------------------------------------------------------------
// 2) Basis FTE and normalization (CART-aware)
// ---------------------------------------------------------------------------

export function getBasisFTE(provider: ProviderRow, basis: BenchmarkBasis): number {
  const totalFTE = num(provider.totalFTE) || 1
  const clinicalFTE = num(provider.clinicalFTE)
  const clinicalPct = clinicalFTE > 0 && totalFTE > 0 ? clinicalFTE / totalFTE : 1
  const effectiveClinicalFTE = clinicalFTE > 0 ? clinicalFTE : totalFTE * clinicalPct

  if (basis === 'per_cfte') return effectiveClinicalFTE
  if (basis === 'per_tfte') return totalFTE
  return 1
}

// ---------------------------------------------------------------------------
// 3) Modeled TCC (component toggles, explicit CF)
// ---------------------------------------------------------------------------

/**
 * Compute modeled TCC in raw dollars for a provider given toggles and CF.
 * Uses base scenario for threshold method, PSQ, etc.; CF only affects productivity incentive.
 */
export function calculateModeledTCC(
  provider: ProviderRow,
  toggles: ModeledTCCToggles,
  CF: number,
  baseScenario: ScenarioInputs
): number {
  const baseSalaryFromComponents =
    provider.basePayComponents?.length &&
    provider.basePayComponents.some((c) => Number(c?.amount) > 0)
      ? provider.basePayComponents.reduce(
          (sum, c) => sum + (typeof c?.amount === 'number' && Number.isFinite(c.amount) ? c.amount : 0),
          0
        )
      : 0
  const baseSalary = baseSalaryFromComponents > 0 ? baseSalaryFromComponents : num(provider.baseSalary)
  const totalFTE = num(provider.totalFTE) || 1
  const clinicalFTE = num(provider.clinicalFTE) || totalFTE || 1
  const totalWRVUs =
    num(provider.totalWRVUs) ||
    num(provider.workRVUs) + num(provider.pchWRVUs) + num(provider.outsideWRVUs)
  const modeledBase = baseScenario.modeledBasePay != null && Number.isFinite(baseScenario.modeledBasePay)
    ? baseScenario.modeledBasePay
    : baseSalary

  let tcc = 0

  if (toggles.base) {
    tcc += modeledBase
  }

  if (toggles.productivityIncentive && CF > 0) {
    const modeledClinicalSalary = totalFTE > 0 ? modeledBase * (clinicalFTE / totalFTE) : modeledBase
    const derivedThreshold = safeDiv(modeledClinicalSalary, CF, 0)
    let annualThreshold: number
    if (baseScenario.thresholdMethod === 'derived') {
      annualThreshold = derivedThreshold
    } else if (baseScenario.thresholdMethod === 'annual') {
      const manual = num(baseScenario.annualThreshold) ?? num(provider.currentThreshold)
      annualThreshold = manual > 0 ? manual : derivedThreshold
    } else {
      // wrvu_percentile: need market; we don't have it here. Use derived as fallback.
      annualThreshold = derivedThreshold
    }
    const modeledTotalWRVUs =
      baseScenario.modeledWRVUs != null && Number.isFinite(baseScenario.modeledWRVUs)
        ? baseScenario.modeledWRVUs
        : totalWRVUs
    const wRVUsAbove = modeledTotalWRVUs - annualThreshold
    const incentive = wRVUsAbove > 0 ? wRVUsAbove * CF : 0
    tcc += incentive
  }

  if (toggles.valueBasedQuality) {
    const q = num(provider.qualityPayments)
    tcc += q
  }

  if (toggles.otherIncentives) {
    tcc += num(provider.otherIncentives)
  }

  // PSQ from base scenario (simplified: if base is on, add PSQ on modeled base for consistency)
  const psqPercent = baseScenario.psqPercent ?? 0
  if (toggles.base && psqPercent > 0 && baseScenario.psqBasis !== 'total_pay') {
    tcc += modeledBase * (psqPercent / 100)
  }

  return tcc
}

/**
 * Modeled TCC when threshold method is wRVU percentile (needs market for threshold interpolation).
 */
export function calculateModeledTCCWithMarket(
  provider: ProviderRow,
  market: MarketRow,
  toggles: ModeledTCCToggles,
  CF: number,
  baseScenario: ScenarioInputs
): number {
  const baseSalaryFromComponents =
    provider.basePayComponents?.length &&
    provider.basePayComponents.some((c) => Number(c?.amount) > 0)
      ? provider.basePayComponents.reduce(
          (sum, c) => sum + (typeof c?.amount === 'number' && Number.isFinite(c.amount) ? c.amount : 0),
          0
        )
      : 0
  const baseSalary = baseSalaryFromComponents > 0 ? baseSalaryFromComponents : num(provider.baseSalary)
  const totalFTE = num(provider.totalFTE) || 1
  const clinicalFTE = num(provider.clinicalFTE) || totalFTE || 1
  const totalWRVUs =
    num(provider.totalWRVUs) ||
    num(provider.workRVUs) + num(provider.pchWRVUs) + num(provider.outsideWRVUs)
  const modeledBase = baseScenario.modeledBasePay != null && Number.isFinite(baseScenario.modeledBasePay)
    ? baseScenario.modeledBasePay
    : baseSalary

  let tcc = 0
  if (toggles.base) tcc += modeledBase

  if (toggles.productivityIncentive && CF > 0) {
    const modeledClinicalSalary = totalFTE > 0 ? modeledBase * (clinicalFTE / totalFTE) : modeledBase
    const derivedThreshold = safeDiv(modeledClinicalSalary, CF, 0)
    let annualThreshold: number
    if (baseScenario.thresholdMethod === 'derived') {
      annualThreshold = derivedThreshold
    } else if (baseScenario.thresholdMethod === 'annual') {
      const manual = num(baseScenario.annualThreshold) ?? num(provider.currentThreshold)
      annualThreshold = manual > 0 ? manual : derivedThreshold
    } else {
      const wrvuPct = baseScenario.wrvuPercentile ?? 50
      const thresholdPerFTE = interpPercentile(
        wrvuPct,
        market.WRVU_25,
        market.WRVU_50,
        market.WRVU_75,
        market.WRVU_90
      )
      annualThreshold = thresholdPerFTE * clinicalFTE
    }
    const modeledTotalWRVUs =
      baseScenario.modeledWRVUs != null && Number.isFinite(baseScenario.modeledWRVUs)
        ? baseScenario.modeledWRVUs
        : totalWRVUs
    const wRVUsAbove = modeledTotalWRVUs - annualThreshold
    const incentive = wRVUsAbove > 0 ? wRVUsAbove * CF : 0
    tcc += incentive
  }

  if (toggles.valueBasedQuality) tcc += num(provider.qualityPayments)
  if (toggles.otherIncentives) tcc += num(provider.otherIncentives)
  const psqPercent = baseScenario.psqPercent ?? 0
  if (toggles.base && psqPercent > 0 && baseScenario.psqBasis !== 'total_pay') {
    tcc += modeledBase * (psqPercent / 100)
  }
  return tcc
}

// ---------------------------------------------------------------------------
// 4) Outlier detection (IQR or MAD z-score)
// ---------------------------------------------------------------------------

export function detectOutliers(
  values: number[],
  method: OutlierMethod,
  params: { iqrK?: number; madZThreshold?: number }
): boolean[] {
  const n = values.length
  const isOutlier = values.map(() => false)
  if (n < 4) return isOutlier

  const sorted = [...values].sort((a, b) => a - b)
  const median = (i: number, j: number) => {
    const len = j - i + 1
    const mid = i + Math.floor(len / 2)
    return len % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }
  const med = median(0, n - 1)

  if (method === 'iqr') {
    const q1 = median(0, Math.floor(n / 2) - 1)
    const q3 = median(Math.ceil(n / 2), n - 1)
    const iqr = Math.max(0, q3 - q1)
    const k = params.iqrK ?? 1.5
    const low = q1 - k * iqr
    const high = q3 + k * iqr
    values.forEach((v, i) => {
      if (v < low || v > high) isOutlier[i] = true
    })
    return isOutlier
  }

  // MAD z-score: z = 0.6745 * (x - median) / MAD
  const absDev = values.map((v) => Math.abs(v - med))
  const absDevSorted = [...absDev].sort((a, b) => a - b)
  const m = absDevSorted.length
  const mid = Math.floor(m / 2)
  const madVal = m % 2 === 1 ? absDevSorted[mid] : (absDevSorted[mid - 1] + absDevSorted[mid]) / 2
  const zThreshold = params.madZThreshold ?? 3.5
  if (madVal <= 0) return isOutlier
  const scale = 0.6745 / madVal
  values.forEach((v, i) => {
    const z = Math.abs((v - med) * scale)
    if (z > zThreshold) isOutlier[i] = true
  })
  return isOutlier
}

// ---------------------------------------------------------------------------
// 5) Governance-aware helpers: normalizeSpecialtyMetrics, evaluateStatus,
//    buildExplanation (pure, deterministic, unit-testable)
// ---------------------------------------------------------------------------

/**
 * Compute aggregate key metrics for a specialty from its included provider contexts.
 * This is the "before" snapshot used by governance checks and explanation generation.
 */
export function normalizeSpecialtyMetrics(
  included: OptimizerProviderContext[]
): OptimizerKeyMetrics {
  if (included.length === 0) {
    return { prodPercentile: 0, compPercentile: 0, gap: 0, tcc_1p0: 0, workRVU_1p0: 0 }
  }
  const n = included.length
  const prodPercentile = included.reduce((s, c) => s + c.wrvuPercentile, 0) / n
  const compPercentile = included.reduce((s, c) => s + c.currentTCC_pctile, 0) / n
  const tcc_1p0 = included.reduce((s, c) => s + c.currentTCC_1p0, 0) / n
  const workRVU_1p0 = included.reduce((s, c) => s + c.wRVU_1p0, 0) / n
  return {
    prodPercentile,
    compPercentile,
    gap: compPercentile - prodPercentile,
    tcc_1p0,
    workRVU_1p0,
  }
}

/**
 * Determine traffic-light status and collect constraint violations.
 * Rules are deterministic and order-independent.
 */
export function evaluateStatus(
  keyMetrics: OptimizerKeyMetrics,
  governance: GovernanceConfig,
  cfChangePct: number,
  recommendedAction: OptimizerRecommendedAction
): { status: OptimizerStatus; constraintsHit: string[] } {
  const constraintsHit: string[] = []
  let status: OptimizerStatus = 'GREEN'

  // FMV red flag
  if (keyMetrics.compPercentile >= governance.fmvRedFlagPercentile) {
    status = 'RED'
    constraintsHit.push(`FMV_OVER_${governance.fmvRedFlagPercentile}`)
  }

  // Large positive gap (comp >> prod)
  if (keyMetrics.gap >= 10) {
    status = 'RED'
    constraintsHit.push('GAP_OVER_10')
  }

  // Hard cap exceeded
  if (keyMetrics.compPercentile > governance.hardCapPercentile) {
    if (status !== 'RED') status = 'YELLOW'
    constraintsHit.push(`HARD_CAP_${governance.hardCapPercentile}`)
  }

  // Soft cap zone
  if (
    keyMetrics.compPercentile > governance.hardCapPercentile &&
    keyMetrics.compPercentile <= governance.softCapPercentile &&
    status !== 'RED'
  ) {
    status = 'YELLOW'
    constraintsHit.push(`SOFT_CAP_${governance.softCapPercentile}`)
  }

  // Medium gap (comp moderately above prod)
  if (keyMetrics.gap >= 5 && keyMetrics.gap < 10 && status === 'GREEN') {
    status = 'YELLOW'
    constraintsHit.push('GAP_5_TO_10')
  }

  // CF change capped by bounds
  if (recommendedAction === 'INCREASE' || recommendedAction === 'DECREASE') {
    const absPct = Math.abs(cfChangePct)
    if (absPct >= 30) {
      constraintsHit.push('MAX_CHANGE_BOUND')
    }
  }

  return { status, constraintsHit }
}

/**
 * Build a plain-English explanation from the numeric optimizer state.
 * Deterministic: same inputs always produce the same explanation.
 */
export function buildExplanation(
  action: OptimizerRecommendedAction,
  status: OptimizerStatus,
  keyMetrics: OptimizerKeyMetrics,
  constraintsHit: string[],
  currentCF: number,
  recommendedCF: number,
  includedCount: number,
  governance: GovernanceConfig,
  cfMarketPercentile?: number,
  marketCF?: MarketCFBenchmarks
): OptimizerExplanation {
  const why: string[] = []
  const whatToDoNext: string[] = []
  let headline = ''

  const prodP = keyMetrics.prodPercentile
  const compP = keyMetrics.compPercentile
  const gap = keyMetrics.gap
  const cfDelta = recommendedCF - currentCF
  const cfPctChange = currentCF > 0 ? ((cfDelta / currentCF) * 100) : 0

  const fmtCF = (v: number) => `$${v.toFixed(2)}`
  const fmtPctile = (v: number) => `${Math.round(v)}`
  const ordinal = (v: number) => {
    const r = Math.round(v)
    if (r === 1 || r === 21 || r === 31 || r === 41 || r === 51 || r === 61 || r === 71 || r === 81 || r === 91) return `${r}st`
    if (r === 2 || r === 22 || r === 32 || r === 42 || r === 52 || r === 62 || r === 72 || r === 82 || r === 92) return `${r}nd`
    if (r === 3 || r === 23 || r === 33 || r === 43 || r === 53 || r === 63 || r === 73 || r === 83 || r === 93) return `${r}rd`
    return `${r}th`
  }

  if (action === 'NO_RECOMMENDATION') {
    headline = 'No recommendation -- insufficient data for reliable analysis.'
    why.push(`Only ${includedCount} provider(s) had enough data to analyze.`)
    why.push('Ensure providers have valid clinical FTE, work RVUs, and matching market data.')
    whatToDoNext.push('Review excluded providers and fix missing data if possible.')
    return { headline, why, whatToDoNext }
  }

  if (action === 'HOLD' && status === 'RED' && compP >= governance.fmvRedFlagPercentile) {
    // Overpaid / FMV risk
    headline = `Hold CF at ${fmtCF(currentCF)} -- compensation exceeds the ${ordinal(governance.fmvRedFlagPercentile)} percentile, flagging FMV risk.`
    why.push(`Compensation is at the ${ordinal(compP)} percentile, above the ${ordinal(governance.fmvRedFlagPercentile)} FMV threshold.`)
    why.push(`Productivity is at the ${ordinal(prodP)} percentile. The ${gap > 0 ? '+' : ''}${fmtPctile(gap)} percentile gap indicates pay exceeds output.`)
    why.push('Raising CF would further increase overmarket pay without creating meaningful incentive leverage.')
    whatToDoNext.push('Investigate structural compensation issues (base salary, guaranteed payments).')
    whatToDoNext.push('Consider holding or reducing base pay before adjusting CF.')
    return { headline, why, whatToDoNext }
  }

  if (action === 'HOLD' && constraintsHit.some((c) => c.startsWith('HARD_CAP'))) {
    // Above hard cap
    headline = `Hold CF at ${fmtCF(currentCF)} -- provider group already above the ${ordinal(governance.hardCapPercentile)} percentile policy cap.`
    why.push(`Compensation is at the ${ordinal(compP)} percentile, above the ${ordinal(governance.hardCapPercentile)} policy cap.`)
    why.push(`Productivity is at the ${ordinal(prodP)} percentile (gap: ${gap > 0 ? '+' : ''}${fmtPctile(gap)}).`)
    if (Math.abs(gap) <= governance.alignmentTolerancePctile) {
      why.push('Pay and productivity are well-aligned, but compensation is already above the target range.')
    } else {
      why.push('Raising CF would increase overmarket pay and will not create meaningful incentive leverage.')
    }
    whatToDoNext.push('Review whether the policy cap should be adjusted for this specialty.')
    return { headline, why, whatToDoNext }
  }

  if (action === 'HOLD') {
    // Aligned or change not meaningful
    headline = `Hold CF at ${fmtCF(currentCF)} -- no material change needed.`
    if (Math.abs(gap) <= governance.alignmentTolerancePctile) {
      why.push(`Productivity (${ordinal(prodP)}) and compensation (${ordinal(compP)}) percentiles are well-aligned.`)
      why.push('No CF adjustment would meaningfully improve alignment.')
    } else {
      why.push(`Productivity is at the ${ordinal(prodP)} percentile; compensation is at the ${ordinal(compP)} percentile.`)
      why.push('The optimal CF change is too small to materially impact incentives or alignment.')
      if (gap > 0) {
        why.push(
          'Raising the conversion factor would increase work RVU incentive dollars, which would raise total cash compensation and push TCC percentile higher, further increasing pay above productivity.'
        )
      }
    }
    if (constraintsHit.length > 0) {
      why.push(`Constraints: ${constraintsHit.join(', ')}.`)
    }
    return { headline, why, whatToDoNext }
  }

  // Market CF positioning bullet (shared helper)
  const addMarketCFContext = () => {
    if (cfMarketPercentile != null && marketCF) {
      const recCF = recommendedCF
      let position = ''
      if (recCF <= marketCF.cf25) position = `below the 25th percentile (${fmtCF(marketCF.cf25)})`
      else if (recCF <= marketCF.cf50) position = `between the 25th (${fmtCF(marketCF.cf25)}) and median (${fmtCF(marketCF.cf50)})`
      else if (recCF <= marketCF.cf75) position = `between the median (${fmtCF(marketCF.cf50)}) and 75th (${fmtCF(marketCF.cf75)})`
      else if (recCF <= marketCF.cf90) position = `between the 75th (${fmtCF(marketCF.cf75)}) and 90th (${fmtCF(marketCF.cf90)})`
      else position = `above the 90th percentile (${fmtCF(marketCF.cf90)})`
      why.push(`Recommended CF of ${fmtCF(recCF)} sits at the ${ordinal(cfMarketPercentile)} market percentile -- ${position}.`)
    }
  }

  if (action === 'INCREASE') {
    headline = `Increase CF from ${fmtCF(currentCF)} to ${fmtCF(recommendedCF)} (+${cfPctChange.toFixed(1)}%) to better align pay with productivity.`
    if (gap > 0) {
      // Overpaid on total comp but CF is low: increase (capped at 50th) fills the gap with wRVU incentive dollars.
      why.push(
        `Total compensation is at the ${ordinal(compP)} percentile while productivity is at the ${ordinal(prodP)} percentile -- pay is above productivity on total comp.`
      )
      why.push(
        `The conversion factor is below market median, so the incentive piece is underpowered. Increasing CF (up to the 50th percentile) fills the gap with wRVU incentive dollars and better aligns incentive pay with output.`
      )
      if (marketCF && recommendedCF >= marketCF.cf50 - 0.01) {
        why.push(`Recommended CF is capped at the market 50th percentile (${fmtCF(marketCF.cf50)}) for this group (pay above productivity) until a higher cap is explicitly allowed.`)
      }
    } else {
      why.push(`Productivity is at the ${ordinal(prodP)} percentile but compensation is only at the ${ordinal(compP)} percentile -- this group is underpaid relative to output.`)
      why.push(`A ${fmtCF(Math.abs(cfDelta))} CF increase narrows the gap from ${fmtPctile(Math.abs(gap))} to a closer alignment.`)
    }
    addMarketCFContext()
    if (!constraintsHit.some((c) => c.startsWith('HARD_CAP'))) {
      why.push(`Recommended CF stays within the ${ordinal(governance.hardCapPercentile)} percentile policy cap.`)
    }
    if (constraintsHit.includes('MAX_CHANGE_BOUND')) {
      why.push('CF change was capped by the maximum allowed adjustment bounds.')
      whatToDoNext.push('Consider phased implementation over 2 cycles if a larger increase is warranted.')
    }
    whatToDoNext.push('Review individual provider drilldown for outliers before finalizing.')
    return { headline, why, whatToDoNext }
  }

  if (action === 'DECREASE') {
    headline = `Decrease CF from ${fmtCF(currentCF)} to ${fmtCF(recommendedCF)} (${cfPctChange.toFixed(1)}%) to bring pay closer to productivity alignment.`
    why.push(`Compensation is at the ${ordinal(compP)} percentile while productivity is at the ${ordinal(prodP)} percentile -- pay is above productivity relative to output.`)
    why.push(`A ${fmtCF(Math.abs(cfDelta))} CF decrease brings compensation closer to the productivity level.`)
    addMarketCFContext()
    if (constraintsHit.includes('MAX_CHANGE_BOUND')) {
      why.push('CF change was capped by the maximum allowed adjustment bounds; full alignment may require further adjustment.')
      whatToDoNext.push('Consider phased implementation across multiple review cycles.')
    }
    whatToDoNext.push('Review individual provider drilldown and consult with division leadership.')
    return { headline, why, whatToDoNext }
  }

  // Fallback
  headline = `CF recommendation: ${fmtCF(recommendedCF)}.`
  why.push(`Productivity: ${ordinal(prodP)} percentile. Compensation: ${ordinal(compP)} percentile.`)
  return { headline, why, whatToDoNext }
}

// ---------------------------------------------------------------------------
// 6) Provider context: baseline TCC (clinical base + PSQ), normalized to 1.0 cFTE, include/exclude
// ---------------------------------------------------------------------------

const LOW_SAMPLE_THRESHOLD = 3

/** Exported for UI to build TCC breakdown in optimizer detail drawer (e.g. for calculation drilldown). */
export function getOptimizerBaselineTCCConfig(
  settings: OptimizerSettings,
  _provider: ProviderRow,
  currentCF: number
) {
  const inclusion = settings.tccComponentInclusion
  const useInclusion = inclusion && Object.keys(inclusion).length > 0
  const scenario = settings.baseScenarioInputs
  const psqConfig =
    settings.includePsqInBaselineAndModeled && (scenario.psqPercent ?? 0) > 0
      ? {
          include: true,
          psqPercent: scenario.psqPercent ?? 0,
          psqBasis: scenario.psqBasis,
          psqFixedDollars: settings.psqFixedDollars,
        }
      : undefined
  return {
    psqConfig,
    includeQualityPayments: useInclusion
      ? !!inclusion.quality?.included
      : settings.includeQualityPaymentsInBaselineAndModeled,
    qualityPaymentsSource: settings.qualityPaymentsSource,
    qualityPaymentsOverridePct: settings.qualityPaymentsOverridePct,
    includeWorkRVUIncentive: useInclusion
      ? !!inclusion.workRVUIncentive?.included
      : settings.includeWorkRVUIncentiveInTCC,
    includeOtherIncentives: useInclusion
      ? !!inclusion.otherIncentives?.included
      : (settings.includeOtherIncentivesInBaselineAndModeled ?? false),
    includeStipend: useInclusion
      ? !!inclusion.stipend?.included
      : (settings.includeStipendInBaselineAndModeled ?? false),
    currentCF,
    componentOptions: useInclusion
      ? Object.fromEntries(
          Object.entries(inclusion)
            .filter(([, v]) => v?.normalizeForFTE)
            .map(([id, v]) => [id, { normalizeForFTE: v?.normalizeForFTE }])
        )
      : undefined,
    additionalTCCLayers: settings.additionalTCCLayers ?? [],
    additionalTCC: settings.additionalTCC,
  }
}

function buildProviderContexts(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  settings: OptimizerSettings,
  synonymMap: Record<string, string>
): OptimizerProviderContext[] {
  const basis = settings.benchmarkBasis
  const minBasisFTE = settings.defaultExclusionRules.minBasisFTE
  const minWRVU1p0 = settings.defaultExclusionRules.minWRVUPer1p0CFTE
  const manualExclude = new Set(settings.manualExcludeProviderIds)
  const manualInclude = new Set(settings.manualIncludeProviderIds)

  const growthFactor = 1 + (settings.wRVUGrowthFactorPct ?? 0) / 100
  const contexts: OptimizerProviderContext[] = []
  for (const provider of providerRows) {
    const match = matchMarketRow(provider, marketRows, synonymMap)
    const market = match.marketRow
    const providerId = (provider.providerId ?? provider.providerName ?? '') as string
    const specialty = (provider.specialty ?? '').trim()

    const exclusionReasons: ExclusionReason[] = []
    if (match.status === 'Missing' || !market) {
      exclusionReasons.push('missing_market')
    }
    const currentCF = num(provider.currentCF) || (market?.CF_50 ?? 0)
    const baselineConfig = getOptimizerBaselineTCCConfig(settings, provider, currentCF)
    const { baselineTCC, baselineTCC_1p0, wRVU_1p0: rawWRVU_1p0, cFTE } = getBaselineTCCNormalizedForOptimizer(
      provider,
      baselineConfig
    )
    const totalWRVUs = getTotalWRVUs(provider)
    const effectiveTotalWRVUs = totalWRVUs * growthFactor
    const wRVU_1p0 = rawWRVU_1p0 * growthFactor
    const basisFTE = getBasisFTE(provider, basis)
    if (cFTE <= 0) {
      exclusionReasons.push('no_benchmarkable_fte_basis')
    } else if (cFTE < minBasisFTE) {
      exclusionReasons.push('basis_fte_below_min')
    }
    if (wRVU_1p0 < minWRVU1p0 && wRVU_1p0 > 0) {
      exclusionReasons.push('low_wrvu_volume')
    }
    if (settings.defaultExclusionRules.excludeLOA && isLOA(provider)) {
      exclusionReasons.push('loa_flagged')
    }
    if (manualExclude.has(providerId)) {
      exclusionReasons.push('manual_exclude')
    }

    const clinicalBase = getClinicalBase(provider)
    const qualityPaymentsDollars = getQualityDollarsForOptimizerConfig(provider, baselineConfig)
    const baseModeled =
      market && basisFTE > 0
        ? getModeledTCCWithCF(
            clinicalBase,
            0,
            effectiveTotalWRVUs,
            currentCF,
            qualityPaymentsDollars
          )
        : 0
    const layeredTCC = getLayeredTCCAmount(baselineConfig, provider, clinicalBase, cFTE)
    const modeledTCCRaw = baseModeled + layeredTCC
    const normalizedWRVU = basisFTE > 0 ? effectiveTotalWRVUs / basisFTE : 0
    const normalizedTCC = basisFTE > 0 ? modeledTCCRaw / basisFTE : 0
    const effectiveRate = normalizedWRVU > 0 ? normalizedTCC / normalizedWRVU : 0

    const wrvuRes = market
      ? percentileFromBenchmarks(
          wRVU_1p0,
          market.WRVU_25,
          market.WRVU_50,
          market.WRVU_75,
          market.WRVU_90
        )
      : { percentile: 0, belowRange: false, aboveRange: false }
    const tccRes = market
      ? percentileFromBenchmarks(
          baselineTCC_1p0,
          market.TCC_25,
          market.TCC_50,
          market.TCC_75,
          market.TCC_90
        )
      : { percentile: 0, belowRange: false, aboveRange: false }
    const baselineGap = tccRes.percentile - wrvuRes.percentile
    const effRes = market
      ? percentileFromBenchmarks(
          effectiveRate,
          market.CF_25,
          market.CF_50,
          market.CF_75,
          market.CF_90
        )
      : { percentile: 0, belowRange: false, aboveRange: false }

    const includeAnyway = manualInclude.has(providerId)
    const excludedByRule = exclusionReasons.length > 0 && !includeAnyway
    const included = !excludedByRule

    contexts.push({
      provider,
      providerId,
      specialty,
      matchStatus: match.status,
      basisFTE,
      currentTCCBaseline: baselineTCC,
      currentTCC_1p0: baselineTCC_1p0,
      currentTCC_pctile: tccRes.percentile,
      wRVU_1p0,
      effectiveTotalWRVUs,
      wrvuPercentile: wrvuRes.percentile,
      wrvuOffScale: wrvuRes.belowRange || wrvuRes.aboveRange,
      baselineGap,
      modeledTCC_1p0: 0,
      modeledTCC_pctile: 0,
      modeledTCCRaw,
      tccPercentile: tccRes.percentile,
      tccOffScale: tccRes.belowRange || tccRes.aboveRange,
      normalizedWRVU,
      normalizedTCC,
      effectiveRate,
      effectiveRatePercentile: effRes.percentile,
      effectiveRateOffScale: effRes.belowRange || effRes.aboveRange,
      included,
      exclusionReasons,
      includeAnyway,
    })
  }

  return contexts
}

// ---------------------------------------------------------------------------
// 6) Objective: MSE or MAE of (modeled TCC %ile - wRVU %ile)
// ---------------------------------------------------------------------------

function computeObjective(
  errors: number[],
  metric: OptimizerErrorMetric
): number {
  if (errors.length === 0) return 0
  if (metric === 'squared') {
    const sumSq = errors.reduce((s, e) => s + e * e, 0)
    return sumSq / errors.length
  }
  const sumAbs = errors.reduce((s, e) => s + Math.abs(e), 0)
  return sumAbs / errors.length
}

function meanOf(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function maeOf(errors: number[]): number {
  if (errors.length === 0) return 0
  return errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length
}

function medianOf(arr: number[]): number {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Derive high/medium risk from baseline gap and off-scale (align with Results page logic). */
function providerRiskLevel(ctx: OptimizerProviderContext): 'high' | 'medium' | 'low' {
  if (Math.abs(ctx.baselineGap) > 15 || ctx.wrvuOffScale || ctx.tccOffScale) return 'high'
  if (Math.abs(ctx.baselineGap) > 5 || ctx.wrvuPercentile < 25 || ctx.wrvuPercentile > 90) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// 7) Specialty-level solver: grid search with MSE/MAE
// ---------------------------------------------------------------------------

const GRID_STEPS_DEFAULT = 41
/** Cap grid steps so a small gridStepPct or wide bounds cannot cause 10+ minute runs. */
const GRID_STEPS_MAX = 101

export interface OptimizeCFResult {
  recommendedCF: number
  preGap: number
  postGap: number
  loss: number
  notes: string[]
  flags: OptimizerFlag[]
  spendImpact: number
  includedCount: number
  excludedCount: number
}

export function optimizeCFForSpecialty(
  _providers: ProviderRow[],
  market: MarketRow,
  settings: OptimizerSettings,
  providerContexts: OptimizerProviderContext[],
  _synonymMap: Record<string, string>
): OptimizerSpecialtyResult {
  const specialty = market.specialty ?? ''
  const specNorm = normalizeSpecialtyKey(specialty)
  const included = providerContexts.filter(
    (c) => c.included && normalizeSpecialtyKey(c.specialty) === specNorm
  )
  const excluded = providerContexts.filter(
    (c) => normalizeSpecialtyKey(c.specialty) === specNorm && !c.included
  )
  const specContexts = providerContexts.filter(
    (c) => normalizeSpecialtyKey(c.specialty) === specNorm
  )

  const notes: string[] = []
  const flags: OptimizerFlag[] = []
  const keyMessages: string[] = []

  const governance = settings.governanceConfig
  const emptyKeyMetrics: OptimizerKeyMetrics = { prodPercentile: 0, compPercentile: 0, gap: 0, tcc_1p0: 0, workRVU_1p0: 0 }
  const mktCF: MarketCFBenchmarks = { cf25: market.CF_25, cf50: market.CF_50, cf75: market.CF_75, cf90: market.CF_90 }
  const emptyResult = (): OptimizerSpecialtyResult => ({
    specialty,
    includedCount: 0,
    excludedCount: excluded.length,
    currentCF: market.CF_50,
    recommendedCF: market.CF_50,
    cfChangePct: 0,
    preGap: 0,
    postGap: 0,
    meanBaselineGap: 0,
    meanModeledGap: 0,
    maeBefore: 0,
    maeAfter: 0,
    spendImpactRaw: 0,
    policyCheck: 'ok' as PolicyCheckStatus,
    cfPolicyPercentile: 50,
    effectiveRateFlag: false,
    highRiskCount: 0,
    mediumRiskCount: 0,
    flags: ['low_sample'],
    notes: ['No included providers for this specialty.'],
    keyMessages,
    providerContexts: specContexts,
    recommendedAction: 'NO_RECOMMENDATION',
    status: 'YELLOW',
    constraintsHit: [],
    explanation: buildExplanation('NO_RECOMMENDATION', 'YELLOW', emptyKeyMetrics, [], market.CF_50, market.CF_50, 0, governance),
    keyMetrics: emptyKeyMetrics,
    marketCF: mktCF,
  })

  if (included.length === 0) {
    const missingCount = excluded.filter((c) => c.exclusionReasons.includes('missing_market')).length
    const lowCfteCount = excluded.filter((c) => c.exclusionReasons.includes('basis_fte_below_min') || c.exclusionReasons.includes('no_benchmarkable_fte_basis')).length
    if (missingCount > 0) keyMessages.push(`Missing market match for ${missingCount} provider(s).`)
    if (lowCfteCount > 0) keyMessages.push(`${lowCfteCount} provider(s) excluded due to low cFTE.`)
    return emptyResult()
  }

  if (included.length <= LOW_SAMPLE_THRESHOLD) {
    flags.push('low_sample')
    notes.push(`Low sample size (n=${included.length}); result is indicative only.`)
    keyMessages.push(`Low sample (n=${included.length}); result indicative only.`)
  }

  const currentCF =
    medianOf(included.map((c) => num(c.provider.currentCF) || market.CF_50)) || market.CF_50
  const bounds = settings.cfBounds
  const cfMin = Math.max(
    bounds.absoluteMin ?? 0,
    currentCF * (1 - bounds.minChangePct / 100)
  )
  const cfMax = Math.min(
    bounds.absoluteMax ?? 1e9,
    currentCF * (1 + bounds.maxChangePct / 100)
  )
  const gridStepPct = settings.gridStepPct ?? 0.005
  const range = cfMax - cfMin
  const preferredStep = Math.max(
    range / (GRID_STEPS_DEFAULT - 1),
    currentCF * gridStepPct
  )
  const numStepsUncapped = Math.max(2, Math.ceil(range / preferredStep))
  const numSteps = Math.min(numStepsUncapped, GRID_STEPS_MAX)
  const step = range / (numSteps - 1)
  const errorMetric = settings.errorMetric
  const objective = settings.optimizationObjective

  function getError(modeledTCCPctile: number, wrvuPctile: number): number {
    if (objective.kind === 'align_percentile') return modeledTCCPctile - wrvuPctile
    if (objective.kind === 'target_fixed_percentile')
      return modeledTCCPctile - (objective.targetPercentile ?? 40)
    const alignW = objective.alignWeight ?? 0.7
    const targetW = objective.targetWeight ?? 0.3
    const targetP = objective.targetPercentile ?? 40
    return alignW * (modeledTCCPctile - wrvuPctile) + targetW * (modeledTCCPctile - targetP)
  }

  const baselineErrors = included.map((c) => getError(c.currentTCC_pctile, c.wrvuPercentile))
  const meanBaselineGap = meanOf(included.map((c) => c.baselineGap))
  const maeBefore = maeOf(baselineErrors)

  // --- Governance pre-check: compute key metrics before grid search ---
  const preKeyMetrics = normalizeSpecialtyMetrics(included)

  // If comp percentile > hard cap, block CF increases (structural problem)
  const compAboveHardCap = preKeyMetrics.compPercentile > governance.hardCapPercentile

  let bestCF = currentCF
  let bestObjective = computeObjective(baselineErrors, errorMetric)
  let governanceBlockedIncrease = false

  if (compAboveHardCap) {
    // Only search CF values at or below current (don't increase)
    governanceBlockedIncrease = true
    notes.push('Governance pre-check: comp percentile above hard cap; CF increase blocked.')
  }

  for (let i = 0; i < numSteps; i++) {
    const cf = i === numSteps - 1 ? cfMax : cfMin + step * i
    // Governance: skip candidates above currentCF when increase is blocked
    if (governanceBlockedIncrease && cf > currentCF + 1e-6) continue
    const errors: number[] = []
    for (const ctx of included) {
      const clinicalBase = getClinicalBase(ctx.provider)
      const baselineConfigCtx = getOptimizerBaselineTCCConfig(settings, ctx.provider, cf)
      const qualityPaymentsDollars = getQualityDollarsForOptimizerConfig(ctx.provider, baselineConfigCtx)
      const cFTECtx = getClinicalFTE(ctx.provider)
      const baseModeled = getModeledTCCWithCF(
        clinicalBase,
        0,
        ctx.effectiveTotalWRVUs,
        cf,
        qualityPaymentsDollars
      )
      const modeledTCC = baseModeled + getLayeredTCCAmount(baselineConfigCtx, ctx.provider, clinicalBase, cFTECtx)
      const modeledTCC_1p0 = ctx.basisFTE > 0 ? modeledTCC / ctx.basisFTE : 0
      const tccRes = percentileFromBenchmarks(
        modeledTCC_1p0,
        market.TCC_25,
        market.TCC_50,
        market.TCC_75,
        market.TCC_90
      )
      errors.push(getError(tccRes.percentile, ctx.wrvuPercentile))
    }
    const obj = computeObjective(errors, errorMetric)
    if (obj < bestObjective) {
      bestObjective = obj
      bestCF = cf
    }
  }

  const atBound = bestCF <= cfMin + 1e-6 || bestCF >= cfMax - 1e-6
  if (atBound && (bestCF !== currentCF)) {
    flags.push('cf_capped')
    keyMessages.push('CF move capped at bound; alignment may be incomplete.')
  }

  // Overpaid + INCREASE: cap recommended CF at market 50th so we don't exceed until explicitly allowed.
  const overpaidAndIncreaseCap =
    preKeyMetrics.gap > 0 && bestCF > currentCF + 1e-6 && mktCF && bestCF > mktCF.cf50
  if (overpaidAndIncreaseCap) {
    bestCF = mktCF.cf50
    notes.push(
      'Pay above productivity: recommended CF capped at market 50th percentile; increase fills gap with wRVU incentive without exceeding market median.'
    )
    keyMessages.push('CF capped at market 50th (pay above productivity); increase adds incentive alignment.')
  }

  // User cap: do not recommend CF above the configured max market percentile (e.g. 50th) for any specialty.
  const maxPct = settings.maxRecommendedCFPercentile ?? 50
  if (mktCF && bestCF > 0) {
    const maxCFValue = interpPercentile(
      maxPct,
      mktCF.cf25,
      mktCF.cf50,
      mktCF.cf75,
      mktCF.cf90
    )
    if (bestCF > maxCFValue) {
      bestCF = maxCFValue
      notes.push(`Recommended CF capped at ${maxPct}th market percentile (${maxCFValue.toFixed(2)}) per policy.`)
      if (!flags.includes('cf_capped')) flags.push('cf_capped')
      keyMessages.push(`CF capped at ${maxPct}th percentile for this specialty.`)
    }
  }

  const spendBaseline = included.reduce((s, c) => s + c.currentTCCBaseline, 0)
  let spendModeled = 0
  for (const ctx of included) {
    const clinicalBase = getClinicalBase(ctx.provider)
    const baselineConfigCtx = getOptimizerBaselineTCCConfig(settings, ctx.provider, bestCF)
    const qualityPaymentsDollars = getQualityDollarsForOptimizerConfig(ctx.provider, baselineConfigCtx)
    const cFTECtx = getClinicalFTE(ctx.provider)
    const baseModeled = getModeledTCCWithCF(
      clinicalBase,
      0,
      ctx.effectiveTotalWRVUs,
      bestCF,
      qualityPaymentsDollars
    )
    const modeledTCC = baseModeled + getLayeredTCCAmount(baselineConfigCtx, ctx.provider, clinicalBase, cFTECtx)
    spendModeled += modeledTCC
    const modeledTCC_1p0 = ctx.basisFTE > 0 ? modeledTCC / ctx.basisFTE : 0
    const tccRes = percentileFromBenchmarks(
      modeledTCC_1p0,
      market.TCC_25,
      market.TCC_50,
      market.TCC_75,
      market.TCC_90
    )
    ctx.modeledTCC_1p0 = modeledTCC_1p0
    ctx.modeledTCC_pctile = tccRes.percentile
    ctx.modeledTCCRaw = modeledTCC
    ctx.baselineIncentiveDollars = getIncentiveDerived(clinicalBase, ctx.effectiveTotalWRVUs, currentCF)
    ctx.modeledIncentiveDollars = getIncentiveDerived(clinicalBase, ctx.effectiveTotalWRVUs, bestCF)
  }
  const spendImpact = spendModeled - spendBaseline

  const modeledErrors = included.map((c) => c.modeledTCC_pctile - c.wrvuPercentile)
  const meanModeledGap = meanOf(modeledErrors)
  const maeAfter = maeOf(modeledErrors)
  const preGap = meanBaselineGap
  const postGap = meanModeledGap

  if (bestObjective > 0 && !flags.includes('not_converged')) {
    const improved = maeAfter < maeBefore
    if (!improved) flags.push('not_converged')
  }

  const cfPolicyPct = percentileFromBenchmarksValue(
    bestCF,
    market.CF_25,
    market.CF_50,
    market.CF_75,
    market.CF_90
  )
  let policyCheck: PolicyCheckStatus = 'ok'
  if (cfPolicyPct > 90) policyCheck = 'above_90'
  else if (cfPolicyPct > 75) policyCheck = 'above_75'
  else if (cfPolicyPct > settings.cfPolicy.thresholdPercentile) policyCheck = 'above_50'

  const effectiveRateFlag = included.some(
    (c) => c.effectiveRatePercentile > 90 || c.effectiveRateOffScale
  )
  if (effectiveRateFlag) flags.push('fmv_risk')
  if (included.some((c) => c.wrvuOffScale || c.tccOffScale)) flags.push('off_scale')
  if (excluded.length > 0) flags.push('outliers_excluded')

  const highRiskCount = included.filter((c) => providerRiskLevel(c) === 'high').length
  const mediumRiskCount = included.filter((c) => providerRiskLevel(c) === 'medium').length

  const lowCfteExcluded = excluded.filter(
    (c) =>
      c.exclusionReasons.includes('basis_fte_below_min') ||
      c.exclusionReasons.includes('no_benchmarkable_fte_basis')
  ).length
  const missingMarketExcluded = excluded.filter((c) =>
    c.exclusionReasons.includes('missing_market')
  ).length
  const lowWrvuExcluded = excluded.filter((c) =>
    c.exclusionReasons.includes('low_wrvu_volume')
  ).length
  if (lowCfteExcluded > 0)
    keyMessages.push(`${lowCfteExcluded} provider(s) excluded due to low cFTE.`)
  if (missingMarketExcluded > 0)
    keyMessages.push(`Missing market match for ${missingMarketExcluded} provider(s).`)
  if (lowWrvuExcluded > 0)
    keyMessages.push(`${lowWrvuExcluded} provider(s) excluded due to low wRVU volume (ratios may be unstable).`)

  // --- Governance-aware action determination ---
  const cfChangePct = currentCF > 0 ? ((bestCF - currentCF) / currentCF) * 100 : 0
  const cfChangeAbsFrac = currentCF > 0 ? Math.abs(bestCF - currentCF) / currentCF : 0
  const minMeaningful = governance.minMeaningfulChangePct

  let recommendedAction: OptimizerRecommendedAction
  if (governanceBlockedIncrease && bestCF >= currentCF - 1e-6) {
    // Governance blocked increase and no decrease recommended
    recommendedAction = 'HOLD'
  } else if (cfChangeAbsFrac < minMeaningful) {
    // Change too small to be meaningful
    recommendedAction = 'HOLD'
  } else if (bestCF > currentCF) {
    recommendedAction = 'INCREASE'
  } else {
    recommendedAction = 'DECREASE'
  }

  const { status: govStatus, constraintsHit } = evaluateStatus(
    preKeyMetrics,
    governance,
    cfChangePct,
    recommendedAction
  )

  const explanation = buildExplanation(
    recommendedAction,
    govStatus,
    preKeyMetrics,
    constraintsHit,
    currentCF,
    bestCF,
    included.length,
    governance,
    cfPolicyPct,
    mktCF
  )

  return {
    specialty,
    includedCount: included.length,
    excludedCount: excluded.length,
    currentCF,
    recommendedCF: bestCF,
    cfChangePct,
    preGap,
    postGap,
    meanBaselineGap,
    meanModeledGap,
    maeBefore,
    maeAfter,
    spendImpactRaw: spendImpact,
    policyCheck,
    cfPolicyPercentile: cfPolicyPct,
    effectiveRateFlag,
    highRiskCount,
    mediumRiskCount,
    flags,
    notes,
    keyMessages,
    providerContexts: specContexts,
    recommendedAction,
    status: govStatus,
    constraintsHit,
    explanation,
    keyMetrics: preKeyMetrics,
    marketCF: mktCF,
  }
}

// ---------------------------------------------------------------------------
// 8) Run all specialties + audit
// ---------------------------------------------------------------------------

export function runOptimizerAllSpecialties(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  settings: OptimizerSettings,
  options: {
    scenarioId: string
    scenarioName: string
    synonymMap?: Record<string, string>
    marketDatasetVersion?: string
    mappingVersion?: string
    /** Optional progress callback: (specialtyIndex, totalSpecialties, specialtyName). */
    onProgress?: (specialtyIndex: number, totalSpecialties: number, specialtyName: string) => void
    /** When set, run only this specialty (display name or normalized match). */
    specialtyFilter?: string
  }
): OptimizerRunResult {
  const synonymMap = options.synonymMap ?? {}
  const providerContexts = buildProviderContexts(providerRows, marketRows, settings, synonymMap)

  const specialtyToMarket = new Map<string, MarketRow>()
  for (const m of marketRows) {
    const key = normalizeSpecialtyKey(m.specialty ?? '')
    if (key) specialtyToMarket.set(key, m)
  }

  const bySpecialty = new Map<string, { providers: ProviderRow[]; market: MarketRow }>()
  for (const provider of providerRows) {
    const rawSpec = (provider.specialty ?? '').trim()
    const norm = normalizeSpecialtyKey(rawSpec)
    const mapped = synonymMap[norm] ?? synonymMap[rawSpec] ?? rawSpec
    const marketKey = normalizeSpecialtyKey(mapped)
    const market = specialtyToMarket.get(marketKey)
    if (!market) continue
    const key = market.specialty ?? marketKey
    if (!bySpecialty.has(key)) {
      bySpecialty.set(key, { providers: [], market })
    }
    bySpecialty.get(key)!.providers.push(provider)
  }

  let entries = [...bySpecialty.entries()]
  if (options.specialtyFilter?.trim()) {
    const wantNorm = normalizeSpecialtyKey(options.specialtyFilter.trim())
    const wantDisplay = options.specialtyFilter.trim()
    entries = entries.filter(([, { market }]) => {
      const display = market.specialty ?? ''
      return normalizeSpecialtyKey(display) === wantNorm || display === wantDisplay
    })
  }
  const totalSpecialties = entries.length
  const onProgress = options.onProgress

  const bySpecialtyResult: OptimizerSpecialtyResult[] = []
  for (let i = 0; i < entries.length; i++) {
    const [key, { providers, market }] = entries[i]
    onProgress?.(i, totalSpecialties, market.specialty ?? key)
    const result = optimizeCFForSpecialty(providers, market, settings, providerContexts, synonymMap)
    bySpecialtyResult.push(result)
  }

  const excludedList: { providerId: string; providerName: string; specialty: string; reasons: ExclusionReason[] }[] = []
  for (const ctx of providerContexts) {
    if (!ctx.included && ctx.exclusionReasons.length > 0) {
      excludedList.push({
        providerId: ctx.providerId,
        providerName: (ctx.provider.providerName ?? ctx.providerId) as string,
        specialty: ctx.specialty,
        reasons: ctx.exclusionReasons,
      })
    }
  }

  const reasonCounts = new Map<ExclusionReason, number>()
  for (const item of excludedList) {
    for (const r of item.reasons) {
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1)
    }
  }
  const topExclusionReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const keyMessagesRollup: string[] = []
  const seen = new Set<string>()
  for (const r of bySpecialtyResult) {
    for (const msg of r.keyMessages) {
      if (!seen.has(msg)) {
        seen.add(msg)
        keyMessagesRollup.push(msg)
      }
    }
  }

  const summary: OptimizerRunSummary = {
    scenarioId: options.scenarioId,
    scenarioName: options.scenarioName,
    timestamp: new Date().toISOString(),
    specialtiesAnalyzed: bySpecialtyResult.length,
    providersIncluded: providerContexts.filter((c) => c.included).length,
    providersExcluded: excludedList.length,
    topExclusionReasons,
    totalSpendImpactRaw: bySpecialtyResult.reduce((s, r) => s + r.spendImpactRaw, 0),
    countMeetingAlignmentTarget: bySpecialtyResult.filter((r) => r.flags.indexOf('not_converged') === -1).length,
    countCFAbovePolicy: bySpecialtyResult.filter((r) => r.policyCheck !== 'ok').length,
    countEffectiveRateAbove90: bySpecialtyResult.filter((r) => r.effectiveRateFlag).length,
    keyMessages: keyMessagesRollup,
    marketDatasetVersion: options.marketDatasetVersion,
    mappingVersion: options.mappingVersion,
  }

  const audit: OptimizerAuditExport = {
    scenarioId: options.scenarioId,
    scenarioName: options.scenarioName,
    timestamp: summary.timestamp,
    benchmarkBasis: settings.benchmarkBasis,
    marketBasisAssumption: settings.benchmarkBasis === 'raw' ? 'Not apples-to-apples to market benchmarks' : undefined,
    optimizationObjective: settings.optimizationObjective,
    errorMetric: settings.errorMetric,
    targetRule: settings.targetRule,
    exclusionRules: settings.defaultExclusionRules,
    outlierMethod: settings.outlierParams.method,
    outlierThresholds: {
      iqrK: settings.outlierParams.iqrK,
      madZThreshold: settings.outlierParams.madZThreshold,
    },
    cfPolicyThreshold: settings.cfPolicy.thresholdPercentile,
    cfPolicyEnforcementMode: settings.cfPolicy.enforcementMode,
    results: bySpecialtyResult,
    excludedProviders: excludedList,
    manualOverrides: bySpecialtyResult
      .filter((r) => r.manualCFOverride != null && r.manualOverrideComment)
      .map((r) => ({
        specialty: r.specialty,
        recommendedCF: r.manualCFOverride!,
        comment: r.manualOverrideComment!,
        user: r.manualOverrideUser,
        timestamp: r.manualOverrideTimestamp!,
      })),
    summary,
  }

  return {
    summary,
    bySpecialty: bySpecialtyResult,
    audit,
  }
}

// ---------------------------------------------------------------------------
// 9) CF percentile sweep: model TCC at fixed CF percentiles (no recommendation)
// ---------------------------------------------------------------------------

/**
 * Run modeled TCC at several CF percentiles for one specialty. Returns one row per percentile
 * with mean modeled TCC %ile, mean wRVU %ile, gap, optional incentive $ and spend impact.
 */
export function runModeledTCCSweepForSpecialty(
  specialty: string,
  providerContexts: OptimizerProviderContext[],
  market: MarketRow,
  settings: OptimizerSettings,
  cfPercentiles: number[]
): CFSweepSpecialtyResult {
  const specNorm = normalizeSpecialtyKey(specialty)
  const included = providerContexts.filter(
    (c) => c.included && normalizeSpecialtyKey(c.specialty) === specNorm
  )
  const rows: CFSweepRow[] = []

  for (const pct of cfPercentiles) {
    const cfDollars = interpPercentile(
      pct,
      market.CF_25,
      market.CF_50,
      market.CF_75,
      market.CF_90
    )
    let sumModeledTCCPctile = 0
    let sumWrvuPctile = 0
    let totalIncentive = 0
    let sumModeledTCC = 0
    let sumBaseline = 0

    for (const ctx of included) {
      const clinicalBase = getClinicalBase(ctx.provider)
      const baselineConfigCtx = getOptimizerBaselineTCCConfig(settings, ctx.provider, cfDollars)
      const qualityPaymentsDollars = getQualityDollarsForOptimizerConfig(ctx.provider, baselineConfigCtx)
      const cFTECtx = getClinicalFTE(ctx.provider)
      const baseModeled = getModeledTCCWithCF(
        clinicalBase,
        0,
        ctx.effectiveTotalWRVUs,
        cfDollars,
        qualityPaymentsDollars
      )
      const modeledTCC = baseModeled + getLayeredTCCAmount(baselineConfigCtx, ctx.provider, clinicalBase, cFTECtx)
      const modeledTCC_1p0 = ctx.basisFTE > 0 ? modeledTCC / ctx.basisFTE : 0
      const tccRes = percentileFromBenchmarks(
        modeledTCC_1p0,
        market.TCC_25,
        market.TCC_50,
        market.TCC_75,
        market.TCC_90
      )
      sumModeledTCCPctile += tccRes.percentile
      sumWrvuPctile += ctx.wrvuPercentile
      totalIncentive += getIncentiveDerived(clinicalBase, ctx.effectiveTotalWRVUs, cfDollars)
      sumModeledTCC += modeledTCC
      sumBaseline += ctx.currentTCCBaseline
    }

    const n = included.length
    const meanModeledTCCPctile = n > 0 ? sumModeledTCCPctile / n : 0
    const meanWrvuPctile = n > 0 ? sumWrvuPctile / n : 0
    rows.push({
      cfPercentile: pct,
      cfDollars,
      meanModeledTCCPctile,
      meanWrvuPctile,
      gap: meanModeledTCCPctile - meanWrvuPctile,
      totalIncentiveDollars: totalIncentive,
      spendImpactRaw: sumModeledTCC - sumBaseline,
    })
  }

  return { specialty: market.specialty ?? specialty, rows }
}

/**
 * Run CF sweep for all specialties (or a filtered set). Builds provider contexts once,
 * then runs runModeledTCCSweepForSpecialty per specialty.
 */
export function runModeledTCCSweepAllSpecialties(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  settings: OptimizerSettings,
  options: {
    cfPercentiles: number[]
    synonymMap?: Record<string, string>
    /** When set, run only this specialty (display name or normalized match). */
    specialtyFilter?: string
  }
): CFSweepAllResult {
  const synonymMap = options.synonymMap ?? {}
  const providerContexts = buildProviderContexts(providerRows, marketRows, settings, synonymMap)

  const specialtyToMarket = new Map<string, MarketRow>()
  for (const m of marketRows) {
    const key = normalizeSpecialtyKey(m.specialty ?? '')
    if (key) specialtyToMarket.set(key, m)
  }

  const bySpecialty = new Map<string, MarketRow>()
  for (const provider of providerRows) {
    const rawSpec = (provider.specialty ?? '').trim()
    const norm = normalizeSpecialtyKey(rawSpec)
    const mapped = synonymMap[norm] ?? synonymMap[rawSpec] ?? rawSpec
    const marketKey = normalizeSpecialtyKey(mapped)
    const market = specialtyToMarket.get(marketKey)
    if (!market) continue
    const key = market.specialty ?? marketKey
    if (!bySpecialty.has(key)) bySpecialty.set(key, market)
  }

  let entries = [...bySpecialty.entries()]
  if (options.specialtyFilter?.trim()) {
    const wantNorm = normalizeSpecialtyKey(options.specialtyFilter.trim())
    const wantDisplay = options.specialtyFilter.trim()
    entries = entries.filter(([display, market]) => {
      const displayKey = market.specialty ?? display
      return normalizeSpecialtyKey(displayKey) === wantNorm || displayKey === wantDisplay
    })
  }

  const bySpecialtyOut: Record<string, CFSweepRow[]> = {}
  for (const [specialtyKey, market] of entries) {
    const result = runModeledTCCSweepForSpecialty(
      specialtyKey,
      providerContexts,
      market,
      settings,
      options.cfPercentiles
    )
    bySpecialtyOut[result.specialty] = result.rows
  }

  return { bySpecialty: bySpecialtyOut }
}