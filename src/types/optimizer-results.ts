/**
 * Conversion Factor Optimizer – run result types.
 * Covers provider-level context, specialty-level results, run summary, audit export,
 * and CF sweep types.
 */

import type { ProviderRow } from '@/types/provider'
import type { MarketMatchStatus } from '@/types/batch'
import type {
  OptimizationObjective,
  OptimizerErrorMetric,
  TargetRule,
  DefaultExclusionRules,
  OutlierMethod,
  CFPolicyEnforcementMode,
} from '@/types/optimizer-settings'

// ---------------------------------------------------------------------------
// Provider-level optimizer context
// ---------------------------------------------------------------------------

export type ExclusionReason =
  | 'no_benchmarkable_fte_basis'
  | 'basis_fte_below_min'
  | 'loa_flagged'
  | 'new_hire_below_threshold'
  | 'outlier_wrvu'
  | 'outlier_tcc'
  | 'outlier_effective_rate'
  | 'manual_exclude'
  | 'missing_market'
  | 'low_wrvu_volume'

export interface OptimizerProviderContext {
  provider: ProviderRow
  providerId: string
  specialty: string
  matchStatus: MarketMatchStatus
  basisFTE: number
  currentTCCBaseline: number
  currentTCC_1p0: number
  currentTCC_pctile: number
  wRVU_1p0: number
  effectiveTotalWRVUs: number
  wrvuPercentile: number
  wrvuOffScale: boolean
  baselineGap: number
  modeledTCC_1p0: number
  modeledTCC_pctile: number
  modeledTCCRaw: number
  baselineIncentiveDollars?: number
  modeledIncentiveDollars?: number
  tccPercentile: number
  tccOffScale: boolean
  normalizedWRVU: number
  normalizedTCC: number
  effectiveRate: number
  effectiveRatePercentile: number
  effectiveRateOffScale: boolean
  included: boolean
  exclusionReasons: ExclusionReason[]
  includeAnyway: boolean
}

// ---------------------------------------------------------------------------
// Specialty-level result
// ---------------------------------------------------------------------------

export type PolicyCheckStatus = 'ok' | 'above_50' | 'above_75' | 'above_90'

export type OptimizerFlag =
  | 'outliers_excluded'
  | 'off_scale'
  | 'low_sample'
  | 'fmv_risk'
  | 'not_converged'
  | 'cf_capped'

export type OptimizerRecommendedAction = 'INCREASE' | 'DECREASE' | 'HOLD' | 'NO_RECOMMENDATION'

export type OptimizerStatus = 'GREEN' | 'YELLOW' | 'RED'

export interface OptimizerKeyMetrics {
  prodPercentile: number
  compPercentile: number
  gap: number
  tcc_1p0: number
  workRVU_1p0: number
}

export interface OptimizerExplanation {
  headline: string
  why: string[]
  whatToDoNext: string[]
}

export interface MarketCFBenchmarks {
  cf25: number
  cf50: number
  cf75: number
  cf90: number
}

export interface OptimizerSpecialtyResult {
  specialty: string
  includedCount: number
  excludedCount: number
  currentCF: number
  recommendedCF: number
  cfChangePct: number
  preGap: number
  postGap: number
  meanBaselineGap: number
  meanModeledGap: number
  maeBefore: number
  maeAfter: number
  spendImpactRaw: number
  policyCheck: PolicyCheckStatus
  cfPolicyPercentile: number
  effectiveRateFlag: boolean
  highRiskCount: number
  mediumRiskCount: number
  flags: OptimizerFlag[]
  notes: string[]
  keyMessages: string[]
  providerContexts: OptimizerProviderContext[]
  recommendedAction: OptimizerRecommendedAction
  status: OptimizerStatus
  constraintsHit: string[]
  explanation: OptimizerExplanation
  keyMetrics: OptimizerKeyMetrics
  marketCF: MarketCFBenchmarks
  manualCFOverride?: number
  manualOverrideComment?: string
  manualOverrideUser?: string
  manualOverrideTimestamp?: string
}

// ---------------------------------------------------------------------------
// Run summary and audit
// ---------------------------------------------------------------------------

export interface OptimizerRunSummary {
  scenarioId: string
  scenarioName: string
  timestamp: string
  specialtiesAnalyzed: number
  providersIncluded: number
  providersExcluded: number
  topExclusionReasons: { reason: ExclusionReason; count: number }[]
  totalSpendImpactRaw: number
  totalIncentiveDollars?: number
  countMeetingAlignmentTarget: number
  countCFAbovePolicy: number
  countEffectiveRateAbove90: number
  keyMessages: string[]
  marketDatasetVersion?: string
  mappingVersion?: string
}

export interface OptimizerAuditExport {
  scenarioId: string
  scenarioName: string
  timestamp: string
  benchmarkBasis: string
  marketBasisAssumption?: string
  optimizationObjective: OptimizationObjective
  errorMetric: OptimizerErrorMetric
  targetRule: TargetRule
  exclusionRules: DefaultExclusionRules
  outlierMethod: OutlierMethod
  outlierThresholds: { iqrK?: number; madZThreshold?: number }
  cfPolicyThreshold: number
  cfPolicyEnforcementMode: CFPolicyEnforcementMode
  results: OptimizerSpecialtyResult[]
  excludedProviders: { providerId: string; providerName: string; specialty: string; reasons: ExclusionReason[] }[]
  manualOverrides: {
    specialty: string
    recommendedCF: number
    comment: string
    user?: string
    timestamp: string
  }[]
  summary: OptimizerRunSummary
}

export interface OptimizerRunResult {
  summary: OptimizerRunSummary
  bySpecialty: OptimizerSpecialtyResult[]
  audit: OptimizerAuditExport
}

// ---------------------------------------------------------------------------
// CF percentile sweep
// ---------------------------------------------------------------------------

export interface CFSweepRow {
  cfPercentile: number
  cfDollars: number
  meanModeledTCCPctile: number
  meanWrvuPctile: number
  gap: number
  totalIncentiveDollars?: number
  spendImpactRaw?: number
}

export interface CFSweepSpecialtyResult {
  specialty: string
  rows: CFSweepRow[]
}

export interface CFSweepAllResult {
  bySpecialty: Record<string, CFSweepRow[]>
}

// ---------------------------------------------------------------------------
// Snapshot and saved config (references OptimizerRunResult so lives here)
// ---------------------------------------------------------------------------

import type { OptimizerSettings } from '@/types/optimizer-settings'

export type OptimizerProviderTypeFilter = 'all' | 'productivity' | 'base'

export interface OptimizerConfigSnapshot {
  providerTypeFilter: OptimizerProviderTypeFilter
  targetMode: 'all' | 'custom'
  selectedSpecialties: string[]
  selectedDivisions: string[]
  providerTypeScopeMode?: 'all' | 'custom'
  selectedProviderTypes?: string[]
  excludedProviderTypes: string[]
  settings: OptimizerSettings
  configStep: number
  lastRunResult?: OptimizerRunResult | null
}

export interface SavedOptimizerConfig {
  id: string
  name: string
  createdAt: string
  snapshot: OptimizerConfigSnapshot
}
