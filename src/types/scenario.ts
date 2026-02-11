import type { ProviderRow } from '@/types/provider'

/**
 * User-controlled scenario inputs.
 */
export type ThresholdMethod = 'annual' | 'wrvu_percentile' | 'derived'

export type CFSource = 'target_haircut' | 'target_percentile' | 'override'

/** Basis for PSQ / value-based payment percentage. */
export type PSQBasis = 'base_salary' | 'total_guaranteed' | 'total_pay'

export interface ScenarioInputs {
  proposedCFPercentile: number
  /** Legacy; when cfSource is target_haircut, haircutPct (CF adjustment %) is preferred. */
  cfAdjustmentFactor: number
  /** Conversion factor adjustment %: when cfSource is target_haircut, Modeled CF = market CF at target percentile × (1 − cfAdjustmentPct/100). Used to carve out value-based payment (e.g. 5%) so the CF effectively pays for it. */
  haircutPct?: number
  /** When cfSource is override: Modeled CF = overrideCF. */
  overrideCF?: number
  cfSource: CFSource
  /** PSQ % for modeled scenario (value-based payment). */
  psqPercent: number
  /** PSQ % for current/baseline state; when set, current TCC includes this PSQ. */
  currentPsqPercent?: number
  /** base_salary / total_guaranteed: PSQ = % of base (total). total_pay: PSQ is % of total TCC. Base = total salary (non-clinical is part of it). */
  psqBasis?: PSQBasis
  thresholdMethod: ThresholdMethod
  annualThreshold?: number
  wrvuPercentile?: number
  /** Optional override for modeled scenario base (total) pay; when set, used instead of provider baseSalary for modeled TCC. */
  modeledBasePay?: number
  /** Optional override for modeled scenario non-clinical; when set, used for display/breakdown only (base is total, so TCC = base + incentive + PSQ). */
  modeledNonClinicalPay?: number
  /** Optional override for modeled scenario wRVUs produced; when set, used for modeled incentive/threshold comparison instead of provider totalWRVUs. */
  modeledWRVUs?: number
  /** Optional override for modeled scenario other (non-work) wRVUs; when set, modeled work = modeledWRVUs - this. */
  modeledOtherWRVUs?: number
  /** Optional override for modeled scenario work wRVUs; when set, modeled total = this + modeledOtherWRVUs. */
  modeledWorkWRVUs?: number
}

export const DEFAULT_SCENARIO_INPUTS: ScenarioInputs = {
  proposedCFPercentile: 40,
  cfAdjustmentFactor: 0.95,
  haircutPct: 5,
  overrideCF: undefined,
  cfSource: 'target_haircut',
  psqPercent: 0,
  currentPsqPercent: 0,
  psqBasis: 'base_salary',
  thresholdMethod: 'derived',
  annualThreshold: 0,
  wrvuPercentile: 50,
}

/** Persisted snapshot of a scenario for save/restore. */
export interface SavedScenario {
  id: string
  name: string
  createdAt: string
  scenarioInputs: ScenarioInputs
  selectedProviderId: string | null
  selectedSpecialty: string | null
  /** Optional snapshot of provider at save time (for future Option B). */
  providerSnapshot?: ProviderRow
}

export interface GovernanceFlags {
  underpayRisk: boolean
  cfBelow25: boolean
  modeledInPolicyBand: boolean
  fmvCheckSuggested: boolean
}

/**
 * Risk assessment flags from compute.
 */
export interface RiskAssessment {
  highRisk: string[]
  warnings: string[]
}

/**
 * All computed outputs for a single provider scenario.
 */
export interface ScenarioResults {
  totalWRVUs: number
  /** wRVU_normalized = Actual_wRVUs / ClinicalFTE */
  wrvuNormalized: number
  /** TCC_normalized = TotalCashComp / TotalFTE (baseline). */
  tccNormalized: number
  /** TCC_normalized for modeled scenario. */
  modeledTccNormalized: number
  annualThreshold: number
  wRVUsAboveThreshold: number
  currentCF: number
  modeledCF: number
  /** Baseline incentive dollars (from current plan). */
  currentIncentive: number
  /** Imputed TCC per wRVU = TCC_normalized / wRVU_normalized (baseline). */
  imputedTCCPerWRVURatioCurrent: number
  /** Imputed TCC per wRVU (modeled). */
  imputedTCCPerWRVURatioModeled: number
  /** Percentile of imputed $/wRVU vs market (baseline). */
  imputedTCCPerWRVUPercentileCurrent: number
  /** Percentile of imputed $/wRVU vs market (modeled). */
  imputedTCCPerWRVUPercentileModeled: number
  annualIncentive: number
  /** PSQ dollars in modeled scenario. */
  psqDollars: number
  /** PSQ dollars in baseline (when PSQ basis is total_pay, differs from psqDollars). */
  currentPsqDollars?: number
  currentTCC: number
  modeledTCC: number
  changeInTCC: number
  /** TCC percentile − wRVU percentile (baseline). */
  alignmentGapBaseline: number
  /** TCC percentile − wRVU percentile (modeled). */
  alignmentGapModeled: number
  wrvuPercentile: number
  wrvuPercentileBelowRange?: boolean
  wrvuPercentileAboveRange?: boolean
  tccPercentile: number
  tccPercentileBelowRange?: boolean
  tccPercentileAboveRange?: boolean
  modeledTCCPercentile: number
  cfPercentileCurrent: number
  cfPercentileCurrentBelowRange?: boolean
  cfPercentileCurrentAboveRange?: boolean
  cfPercentileModeled: number
  governanceFlags: GovernanceFlags
  risk: RiskAssessment
  warnings: string[]
}
