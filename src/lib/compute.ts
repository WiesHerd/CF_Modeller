import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults, RiskAssessment, GovernanceFlags } from '@/types/scenario'
import { interpPercentile, inferPercentile } from '@/lib/interpolation'
import { num, safeDiv } from '@/utils/math'

/**
 * Imputed total cash compensation per wRVU.
 * Inputs: salary (TCC), total FTE, clinical FTE, actual wRVUs.
 * Normalizes wRVUs to a full 1.0 FTE (wRVUs / clinical FTE), then salary / adjusted wRVUs.
 * Equivalently: (salary * clinical FTE) / wRVUs.
 * Returns 0 on division by zero (clinical FTE or wRVUs zero).
 */
export function imputedTCCPerWRVU(
  salary: number,
  _totalFTE: number,
  clinicalFTE: number,
  actualWRVUs: number
): number {
  if (clinicalFTE <= 0 || actualWRVUs <= 0 || !Number.isFinite(salary)) return 0
  const adjustedWRVUs = actualWRVUs / clinicalFTE
  if (!Number.isFinite(adjustedWRVUs) || adjustedWRVUs <= 0) return 0
  const value = salary / adjustedWRVUs
  return Number.isFinite(value) ? value : 0
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

  const baseSalaryFromComponents =
    provider.basePayComponents?.length &&
    provider.basePayComponents.some((c) => Number(c?.amount) > 0)
      ? provider.basePayComponents.reduce(
          (sum, c) => sum + (typeof c?.amount === 'number' && Number.isFinite(c.amount) ? c.amount : 0),
          0
        )
      : 0
  const baseSalary =
    baseSalaryFromComponents > 0 ? baseSalaryFromComponents : num(provider.baseSalary)
  /** Clinical portion of salary: use explicit value when present, else baseSalary (treated as clinical base). */
  const clinicalBaseSalary =
    provider.clinicalFTESalary != null && Number.isFinite(provider.clinicalFTESalary)
      ? num(provider.clinicalFTESalary)
      : baseSalary
  const totalFTE = num(provider.totalFTE) || 1
  const clinicalFTE = num(provider.clinicalFTE) || totalFTE || 1
  const totalWRVUs =
    num(provider.totalWRVUs) ||
    num(provider.workRVUs) + num(provider.pchWRVUs) + num(provider.outsideWRVUs)
  const psqPercent = scenario.psqPercent ?? 0
  const currentPsqPercent = scenario.currentPsqPercent ?? 0
  const psqBasis = scenario.psqBasis ?? 'base_salary'
  // PSQ $ for base_salary / total_guaranteed computed after we have modeled base/non-clinical and incentive (for total_pay)
  const modeledBase = scenario.modeledBasePay != null && Number.isFinite(scenario.modeledBasePay) ? scenario.modeledBasePay : baseSalary

  if (clinicalFTE < LOW_FTE_RISK)
    highRisk.push(`Clinical FTE (${clinicalFTE}) < ${LOW_FTE_RISK}`)
  if (totalFTE < LOW_FTE_RISK)
    highRisk.push(`Total FTE (${totalFTE}) < ${LOW_FTE_RISK}`)
  if (totalWRVUs < LOW_WRVU_WARNING && totalWRVUs > 0)
    warnings.push(`Total wRVUs (${totalWRVUs}) low; ratios may be unstable`)

  const currentCF = num(provider.currentCF)
  // Baseline threshold: use provider value if set and positive, else clinical portion of salary ÷ CF
  const currentThresholdRaw = num(provider.currentThreshold)
  const currentThreshold =
    currentThresholdRaw > 0
      ? currentThresholdRaw
      : safeDiv(clinicalBaseSalary, currentCF, 0)
  const currentIncentive =
    currentCF > 0
      ? (totalWRVUs - currentThreshold) * currentCF
      : 0

  let modeledCF: number
  if (scenario.cfSource === 'override' && scenario.overrideCF != null && Number.isFinite(scenario.overrideCF)) {
    modeledCF = scenario.overrideCF
  } else {
    const interpolatedCF = interpPercentile(
      scenario.proposedCFPercentile,
      market.CF_25,
      market.CF_50,
      market.CF_75,
      market.CF_90
    )
    if (scenario.cfSource === 'target_percentile') {
      modeledCF = interpolatedCF
    } else {
      const cfAdjustmentPct = scenario.haircutPct ?? (1 - num(scenario.cfAdjustmentFactor)) * 100
      modeledCF = interpolatedCF * (1 - cfAdjustmentPct / 100)
    }
  }

  // Threshold (wRVUs) = Clinical Salary ÷ CF (clinical portion of base pay ÷ conversion factor).
  // Modeled clinical salary = modeled base × (clinical FTE / total FTE).
  const modeledClinicalSalary =
    totalFTE > 0 ? modeledBase * (clinicalFTE / totalFTE) : modeledBase
  const derivedThreshold = safeDiv(modeledClinicalSalary, modeledCF, 0)

  let annualThreshold: number
  if (scenario.thresholdMethod === 'derived') {
    annualThreshold = derivedThreshold
  } else if (scenario.thresholdMethod === 'annual') {
    const manual = num(scenario.annualThreshold) ?? num(provider.currentThreshold)
    // If no valid manual threshold, use derived (clinical base ÷ CF) so incentive is only above break-even
    annualThreshold = manual > 0 ? manual : derivedThreshold
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

  const modeledTotalWRVUs =
    scenario.modeledWRVUs != null && Number.isFinite(scenario.modeledWRVUs)
      ? scenario.modeledWRVUs
      : totalWRVUs
  const wRVUsAboveThreshold = modeledTotalWRVUs - annualThreshold
  const annualIncentive = wRVUsAboveThreshold * modeledCF

  // Total base pay = base salary + non-clinical (stipend/admin). When basePayComponents exist, their sum is already total base.
  // TCC = total base + wRVU incentive (if positive) + PSQ + quality payments + other incentives.
  const nonClinicalPay = num(provider.nonClinicalPay) || 0
  const totalBasePay =
    baseSalaryFromComponents > 0 ? baseSalaryFromComponents : baseSalary + nonClinicalPay

  const currentIncentiveForTCC = currentIncentive > 0 ? currentIncentive : 0
  const annualIncentiveForTCC = annualIncentive > 0 ? annualIncentive : 0
  // Quality payment (value-based): use qualityPayments column only. Do not use currentTCC as fallback (file Current TCC is total, not a component).
  const qualityPayments = num(provider.qualityPayments) || 0
  const otherIncentives =
    (num(provider.otherIncentives) || 0) +
    (num(provider.otherIncentive1) || 0) +
    (num(provider.otherIncentive2) || 0) +
    (num(provider.otherIncentive3) || 0)

  // PSQ dollars: current uses currentPsqPercent, modeled uses psqPercent. Same basis for both.
  let psqDollars: number
  let currentPsqDollars: number
  if (psqBasis === 'total_pay') {
    const otherComp = modeledBase + annualIncentiveForTCC
    psqDollars = psqPercent > 0 && psqPercent < 100 ? (otherComp * (psqPercent / 100)) / (1 - psqPercent / 100) : 0
    const currentOther = totalBasePay + currentIncentiveForTCC
    currentPsqDollars = currentPsqPercent > 0 && currentPsqPercent < 100 ? (currentOther * (currentPsqPercent / 100)) / (1 - currentPsqPercent / 100) : 0
  } else {
    const psqBase = totalBasePay
    currentPsqDollars = psqBase * (currentPsqPercent / 100)
    const modeledPsqBase = modeledBase
    psqDollars = modeledPsqBase * (psqPercent / 100)
  }

  // When the file supplies Current TCC, use it as the total. Otherwise compute from components.
  const computedCurrentTCC = totalBasePay + currentIncentiveForTCC + currentPsqDollars + qualityPayments + otherIncentives
  const fileCurrentTCCVal = num(provider.currentTCC)
  const fileCurrentTCC = fileCurrentTCCVal > 0 ? fileCurrentTCCVal : null
  const currentTCC = fileCurrentTCC ?? computedCurrentTCC
  const currentTCCFromFile = fileCurrentTCC != null
  // Modeled TCC mirrors currentTCC components: quality payments and other incentives are fixed (from file).
  const modeledTCC = modeledBase + annualIncentiveForTCC + psqDollars + qualityPayments + otherIncentives
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
  const cfModeledPctResult =
    scenario.cfSource === 'override'
      ? inferPercentile(
          modeledCF,
          market.CF_25,
          market.CF_50,
          market.CF_75,
          market.CF_90
        )
      : { percentile: scenario.proposedCFPercentile } // target_haircut and target_percentile: modeled CF is at this percentile
  const cfModeledPct = cfModeledPctResult.percentile

  if (wrvuPctResult.belowRange || wrvuPctResult.aboveRange)
    warnings.push('wRVU percentile is off-scale (below 25 or above 90)')
  if (tccPctResult.belowRange || tccPctResult.aboveRange)
    warnings.push('TCC percentile is off-scale (below 25 or above 90)')
  if (cfPctResult.belowRange || cfPctResult.aboveRange)
    warnings.push('CF percentile is off-scale (below 25 or above 90)')

  // Imputed TCC per wRVU: normalize wRVUs to 1.0 FTE (wRVUs / clinical FTE), then TCC / adjusted wRVUs. Handles FTE/wRVU zero.
  const imputedTCCPerWRVURatioCurrent = imputedTCCPerWRVU(currentTCC, totalFTE, clinicalFTE, totalWRVUs)
  const imputedTCCPerWRVURatioModeled = imputedTCCPerWRVU(modeledTCC, totalFTE, clinicalFTE, modeledTotalWRVUs)

  // Benchmark imputed $/wRVU using market TCC/wRVU percentile ratios (Rule: assign percentile via market $/wRVU distributions)
  const marketDp25 = safeDiv(market.TCC_25, market.WRVU_25, 0)
  const marketDp50 = safeDiv(market.TCC_50, market.WRVU_50, 0)
  const marketDp75 = safeDiv(market.TCC_75, market.WRVU_75, 0)
  const marketDp90 = safeDiv(market.TCC_90, market.WRVU_90, 0)
  const imputedPctCurrent =
    marketDp50 > 0
      ? inferPercentile(
          imputedTCCPerWRVURatioCurrent,
          marketDp25,
          marketDp50,
          marketDp75,
          marketDp90
        )
      : { percentile: 0 }
  const imputedPctModeled =
    marketDp50 > 0
      ? inferPercentile(
          imputedTCCPerWRVURatioModeled,
          marketDp25,
          marketDp50,
          marketDp75,
          marketDp90
        )
      : { percentile: 0 }

  const alignmentGapBaseline = tccPctResult.percentile - wrvuPctResult.percentile
  const alignmentGapModeled = tccModeledPctResult.percentile - wrvuPctResult.percentile

  const governanceFlags: GovernanceFlags = {
    underpayRisk: alignmentGapBaseline < -15 || alignmentGapModeled < -15,
    cfBelow25: cfPctResult.percentile < 25,
    modeledInPolicyBand:
      cfModeledPct >= 25 &&
      cfModeledPct <= 75 &&
      tccModeledPctResult.percentile >= 25 &&
      tccModeledPctResult.percentile <= 75,
    fmvCheckSuggested:
      tccModeledPctResult.percentile > 75 || alignmentGapModeled > 15,
  }

  const risk: RiskAssessment = { highRisk, warnings }

  return {
    totalWRVUs,
    wrvuNormalized: wrvuNorm,
    tccNormalized: tccNorm,
    modeledTccNormalized: modeledTccNorm,
    annualThreshold,
    wRVUsAboveThreshold,
    currentCF,
    modeledCF,
    currentIncentive,
    imputedTCCPerWRVURatioCurrent,
    imputedTCCPerWRVURatioModeled,
    imputedTCCPerWRVUPercentileCurrent: imputedPctCurrent.percentile,
    imputedTCCPerWRVUPercentileModeled: imputedPctModeled.percentile,
    annualIncentive,
    psqDollars,
    currentPsqDollars,
    currentTCC,
    currentTCCFromFile,
    modeledTCC,
    changeInTCC,
    alignmentGapBaseline,
    alignmentGapModeled,
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
    governanceFlags,
    risk,
    warnings,
  }
}
