/**
 * User-controlled scenario inputs.
 */
export type ThresholdMethod = 'annual' | 'wrvu_percentile'

export interface ScenarioInputs {
  proposedCFPercentile: number
  cfAdjustmentFactor: number
  psqPercent: number
  thresholdMethod: ThresholdMethod
  annualThreshold?: number
  wrvuPercentile?: number
}

export const DEFAULT_SCENARIO_INPUTS: ScenarioInputs = {
  proposedCFPercentile: 40,
  cfAdjustmentFactor: 0.95,
  psqPercent: 0,
  thresholdMethod: 'annual',
  annualThreshold: 0,
  wrvuPercentile: 50,
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
  annualThreshold: number
  wRVUsAboveThreshold: number
  currentCF: number
  modeledCF: number
  imputedTCCPerWRVURatioCurrent: number
  imputedTCCPerWRVURatioModeled: number
  annualIncentive: number
  psqDollars: number
  currentTCC: number
  modeledTCC: number
  changeInTCC: number
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
  risk: RiskAssessment
  warnings: string[]
}
