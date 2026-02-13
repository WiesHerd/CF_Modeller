/**
 * Conversion Factor Optimizer – types for audit-ready, consulting-grade specialty-level CF recommendations.
 * Supports alignment of productivity (wRVU percentile) and pay (TCC percentile) with governance guardrails.
 */

import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs } from '@/types/scenario'
import type { MarketMatchStatus } from '@/types/batch'
import type { TCCComponentInclusion, AdditionalTCCConfig } from '@/lib/tcc-components'

// ---------------------------------------------------------------------------
// Benchmark basis (CART-aware normalization)
// ---------------------------------------------------------------------------

export type BenchmarkBasis = 'per_cfte' | 'per_tfte' | 'raw'

// ---------------------------------------------------------------------------
// Optimization objective (replaces legacy target rule for new engine)
// ---------------------------------------------------------------------------

export type OptimizationObjectiveKind = 'align_percentile' | 'target_fixed_percentile' | 'hybrid'

export interface OptimizationObjectiveAlign {
  kind: 'align_percentile'
}

export interface OptimizationObjectiveTargetFixed {
  kind: 'target_fixed_percentile'
  /** Target TCC percentile (e.g. 40). */
  targetPercentile: number
}

export interface OptimizationObjectiveHybrid {
  kind: 'hybrid'
  /** Weight for productivity alignment (e.g. 0.7). */
  alignWeight: number
  /** Weight for fixed target (e.g. 0.3). */
  targetWeight: number
  targetPercentile: number
}

export type OptimizationObjective =
  | OptimizationObjectiveAlign
  | OptimizationObjectiveTargetFixed
  | OptimizationObjectiveHybrid

/** Error metric for objective: squared (MSE) or absolute (MAE). */
export type OptimizerErrorMetric = 'squared' | 'absolute'

export const DEFAULT_OPTIMIZATION_OBJECTIVE: OptimizationObjective = { kind: 'align_percentile' }
export const DEFAULT_OPTIMIZER_ERROR_METRIC: OptimizerErrorMetric = 'squared'

// ---------------------------------------------------------------------------
// Legacy target rule (kept for audit export compatibility)
// ---------------------------------------------------------------------------

export type TargetRuleKind = 'within' | 'range'

export interface TargetRuleWithin {
  kind: 'within'
  n: number
}

export interface TargetRuleRange {
  kind: 'range'
  minGap: number
  maxGap: number
}

export type TargetRule = TargetRuleWithin | TargetRuleRange

// ---------------------------------------------------------------------------
// Modeled TCC component toggles
// ---------------------------------------------------------------------------

export interface ModeledTCCToggles {
  base: boolean
  productivityIncentive: boolean
  valueBasedQuality: boolean
  otherIncentives: boolean
}

export const DEFAULT_MODELED_TCC_TOGGLES: ModeledTCCToggles = {
  base: true,
  productivityIncentive: true,
  valueBasedQuality: false,
  otherIncentives: false,
}

// ---------------------------------------------------------------------------
// Outlier detection
// ---------------------------------------------------------------------------

export type OutlierMethod = 'iqr' | 'mad_z'

export interface OutlierParams {
  method: OutlierMethod
  /** IQR: k for [Q1 - k*IQR, Q3 + k*IQR]. Default 1.5. */
  iqrK?: number
  /** MAD z-score: |z| > threshold → outlier. Default 3.5. */
  madZThreshold?: number
}

export const DEFAULT_OUTLIER_PARAMS: OutlierParams = {
  method: 'mad_z',
  madZThreshold: 3.5,
  iqrK: 1.5,
}

// ---------------------------------------------------------------------------
// CF bounds and budget
// ---------------------------------------------------------------------------

export type BudgetConstraintKind = 'none' | 'neutral' | 'cap_pct' | 'cap_dollars'

export interface BudgetConstraint {
  kind: BudgetConstraintKind
  capPct?: number
  capDollars?: number
}

export const DEFAULT_BUDGET_CONSTRAINT: BudgetConstraint = { kind: 'none' }

export interface CFBounds {
  /** Min CF = currentCF * (1 - minChangePct/100). */
  minChangePct: number
  /** Max CF = currentCF * (1 + maxChangePct/100). */
  maxChangePct: number
  /** Optional absolute floor/ceiling. */
  absoluteMin?: number
  absoluteMax?: number
}

export const DEFAULT_CF_BOUNDS: CFBounds = {
  minChangePct: 30,
  maxChangePct: 30,
}

// ---------------------------------------------------------------------------
// Default exclusions (configurable)
// ---------------------------------------------------------------------------

export interface DefaultExclusionRules {
  /** Exclude if clinical FTE < this. Default 0.5. */
  minBasisFTE: number
  /** Exclude if wRVU per 1.0 cFTE < this (low volume; ratios unstable). Default 1000. */
  minWRVUPer1p0CFTE: number
  /** Exclude if LOA flagged (when field exists). */
  excludeLOA: boolean
  /** Exclude new hires with tenure months < this (when tenure available). */
  newHireMonthsThreshold?: number
}

export const DEFAULT_EXCLUSION_RULES: DefaultExclusionRules = {
  minBasisFTE: 0.5,
  minWRVUPer1p0CFTE: 1000,
  excludeLOA: true,
  newHireMonthsThreshold: undefined,
}

// ---------------------------------------------------------------------------
// CF policy and effective rate governance
// ---------------------------------------------------------------------------

export type CFPolicyEnforcementMode = 'flag_only' | 'hard_cap'

export interface CFPolicySettings {
  thresholdPercentile: number
  enforcementMode: CFPolicyEnforcementMode
}

export const DEFAULT_CF_POLICY: CFPolicySettings = {
  thresholdPercentile: 50,
  enforcementMode: 'flag_only',
}

// ---------------------------------------------------------------------------
// Full optimizer settings
// ---------------------------------------------------------------------------

export interface OptimizerSettings {
  benchmarkBasis: BenchmarkBasis
  /** New objective (align / target fixed / hybrid) and error metric. */
  optimizationObjective: OptimizationObjective
  errorMetric: OptimizerErrorMetric
  /** Legacy; kept for audit. */
  targetRule: TargetRule
  modeledTCCToggles: ModeledTCCToggles
  outlierParams: OutlierParams
  defaultExclusionRules: DefaultExclusionRules
  cfBounds: CFBounds
  budgetConstraint: BudgetConstraint
  cfPolicy: CFPolicySettings
  /** Include PSQ (value-based % of base) in baseline and modeled TCC. */
  includePsqInBaselineAndModeled: boolean
  /** Include quality payments in baseline and modeled TCC. */
  includeQualityPaymentsInBaselineAndModeled: boolean
  /** When 'override_pct_of_base', quality = clinical base × this % instead of provider file. */
  qualityPaymentsSource?: 'from_file' | 'override_pct_of_base'
  /** e.g. 5 = 5% of base; used when qualityPaymentsSource is 'override_pct_of_base'. */
  qualityPaymentsOverridePct?: number
  /** Include work RVU incentive in baseline and modeled TCC. Baseline uses current CF/threshold; modeled uses recommended CF. */
  includeWorkRVUIncentiveInTCC: boolean
  /** Include other incentives (from provider file) in baseline and modeled TCC. */
  includeOtherIncentivesInBaselineAndModeled?: boolean
  /**
   * Optional: which TCC components are included and per-component options (e.g. normalize for FTE).
   * When set, overrides the individual include* booleans for baseline/config; allows custom components and options.
   */
  tccComponentInclusion?: TCCComponentInclusion
  /** Layered additional TCC (percent of base, dollar per FTE, flat) on top of components. */
  additionalTCC?: AdditionalTCCConfig
  /** When PSQ basis is fixed dollars, use this (global). */
  psqFixedDollars?: number
  manualExcludeProviderIds: string[]
  manualIncludeProviderIds: string[]
  baseScenarioInputs: ScenarioInputs
  /** Grid step as fraction of CF (e.g. 0.005 = 0.5%). Internal default; not exposed in UI. */
  gridStepPct?: number
  /** Cap: recommended CF will not exceed this market percentile (e.g. 50 = median) per specialty. */
  maxRecommendedCFPercentile?: number
  /** Governance thresholds for status/explanation logic. */
  governanceConfig: GovernanceConfig
}

/** Build default optimizer settings with given base scenario inputs. */
export function getDefaultOptimizerSettings(baseScenarioInputs: ScenarioInputs): OptimizerSettings {
  return {
    benchmarkBasis: 'per_cfte',
    optimizationObjective: DEFAULT_OPTIMIZATION_OBJECTIVE,
    errorMetric: DEFAULT_OPTIMIZER_ERROR_METRIC,
    targetRule: { kind: 'within', n: 5 },
    modeledTCCToggles: DEFAULT_MODELED_TCC_TOGGLES,
    outlierParams: DEFAULT_OUTLIER_PARAMS,
    defaultExclusionRules: DEFAULT_EXCLUSION_RULES,
    cfBounds: DEFAULT_CF_BOUNDS,
    budgetConstraint: DEFAULT_BUDGET_CONSTRAINT,
    cfPolicy: DEFAULT_CF_POLICY,
    includePsqInBaselineAndModeled: false,
    includeQualityPaymentsInBaselineAndModeled: true,
    includeWorkRVUIncentiveInTCC: true,
    includeOtherIncentivesInBaselineAndModeled: false,
    tccComponentInclusion: undefined,
    additionalTCC: undefined,
    psqFixedDollars: undefined,
    manualExcludeProviderIds: [],
    manualIncludeProviderIds: [],
    baseScenarioInputs,
    gridStepPct: 0.005,
    maxRecommendedCFPercentile: 50,
    governanceConfig: DEFAULT_GOVERNANCE_CONFIG,
  }
}

// ---------------------------------------------------------------------------
// Provider-level optimizer context (basisFTE, normalized metrics, include/exclude)
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
  /** Market match status for messages (Exact / Synonym / Normalized / Missing). */
  matchStatus: MarketMatchStatus
  basisFTE: number
  /** Baseline (no incentive): clinical base + PSQ. */
  currentTCCBaseline: number
  currentTCC_1p0: number
  currentTCC_pctile: number
  wRVU_1p0: number
  wrvuPercentile: number
  wrvuOffScale: boolean
  /** TCC %ile − wRVU %ile at baseline. */
  baselineGap: number
  /** At recommended CF (for drilldown). */
  modeledTCC_1p0: number
  modeledTCC_pctile: number
  modeledTCCRaw: number
  /** Work RVU incentive dollars at current (specialty) CF. */
  baselineIncentiveDollars?: number
  /** Work RVU incentive dollars at recommended CF. */
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
// Specialty-level optimizer result
// ---------------------------------------------------------------------------

export type PolicyCheckStatus = 'ok' | 'above_50' | 'above_75' | 'above_90'

export type OptimizerFlag =
  | 'outliers_excluded'
  | 'off_scale'
  | 'low_sample'
  | 'fmv_risk'
  | 'not_converged'
  | 'cf_capped'

// ---------------------------------------------------------------------------
// Optimizer recommendation, status, explanation (governance-aware)
// ---------------------------------------------------------------------------

export type OptimizerRecommendedAction = 'INCREASE' | 'DECREASE' | 'HOLD' | 'NO_RECOMMENDATION'

export type OptimizerStatus = 'GREEN' | 'YELLOW' | 'RED'

export interface OptimizerKeyMetrics {
  /** Mean wRVU percentile (1.0 cFTE) across included providers. */
  prodPercentile: number
  /** Mean TCC percentile (1.0 cFTE) across included providers at baseline. */
  compPercentile: number
  /** compPercentile − prodPercentile. Positive = overpaid relative to productivity. */
  gap: number
  /** Mean TCC per 1.0 cFTE across included providers. */
  tcc_1p0: number
  /** Mean wRVU per 1.0 cFTE across included providers. */
  workRVU_1p0: number
}

export interface OptimizerExplanation {
  /** One-sentence summary of the recommendation. */
  headline: string
  /** 2-4 plain-English bullets explaining the reasoning. */
  why: string[]
  /** 0-2 optional next-step actions. */
  whatToDoNext: string[]
}

/** Market CF benchmarks for the specialty (passed through for UI display). */
export interface MarketCFBenchmarks {
  cf25: number
  cf50: number
  cf75: number
  cf90: number
}

export interface GovernanceConfig {
  /** TCC percentile hard cap: do NOT increase CF when comp is above this. Default 50. */
  hardCapPercentile: number
  /** Soft cap for yellow-zone flagging. Default 60. */
  softCapPercentile: number
  /** FMV red-flag threshold. Default 75. */
  fmvRedFlagPercentile: number
  /** Alignment tolerance: within ±this many percentile points counts as aligned. Default 3. */
  alignmentTolerancePctile: number
  /** Minimum CF change (fraction) to be considered meaningful. Default 0.01. */
  minMeaningfulChangePct: number
}

export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
  hardCapPercentile: 50,
  softCapPercentile: 60,
  fmvRedFlagPercentile: 75,
  alignmentTolerancePctile: 3,
  minMeaningfulChangePct: 0.01,
}

export interface OptimizerSpecialtyResult {
  specialty: string
  includedCount: number
  excludedCount: number
  currentCF: number
  recommendedCF: number
  cfChangePct: number
  /** Mean (TCC %ile − wRVU %ile) at baseline. */
  preGap: number
  /** Mean (TCC %ile − wRVU %ile) after recommended CF. */
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
  /** Governance-aware recommendation. */
  recommendedAction: OptimizerRecommendedAction
  /** Traffic-light status for quick scanning. */
  status: OptimizerStatus
  /** Constraints that limited the recommendation. */
  constraintsHit: string[]
  /** Plain-English explanation of the recommendation. */
  explanation: OptimizerExplanation
  /** Key metrics snapshot for the specialty (mean across included providers). */
  keyMetrics: OptimizerKeyMetrics
  /** Market CF benchmarks for this specialty (25th/50th/75th/90th). */
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
  countMeetingAlignmentTarget: number
  countCFAbovePolicy: number
  countEffectiveRateAbove90: number
  /** Roll-up of key messages from specialty results. */
  keyMessages: string[]
  marketDatasetVersion?: string
  mappingVersion?: string
}

export interface OptimizerAuditExport {
  scenarioId: string
  scenarioName: string
  timestamp: string
  benchmarkBasis: BenchmarkBasis
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

// ---------------------------------------------------------------------------
// Full run output (for UI and exports)
// ---------------------------------------------------------------------------

export interface OptimizerRunResult {
  summary: OptimizerRunSummary
  bySpecialty: OptimizerSpecialtyResult[]
  audit: OptimizerAuditExport
}

// ---------------------------------------------------------------------------
// CF percentile sweep (multi-scenario modeling at fixed CF percentiles)
// ---------------------------------------------------------------------------

/** One row from a CF sweep: modeled outcomes at a fixed CF percentile. */
export interface CFSweepRow {
  cfPercentile: number
  cfDollars: number
  meanModeledTCCPctile: number
  meanWrvuPctile: number
  gap: number
  /** Total work RVU incentive $ across included providers at this CF. */
  totalIncentiveDollars?: number
  /** Spend impact vs baseline (modeled TCC − baseline TCC) for included providers. */
  spendImpactRaw?: number
}

/** Sweep result for a single specialty. */
export interface CFSweepSpecialtyResult {
  specialty: string
  rows: CFSweepRow[]
}

/** Sweep result for all specialties (keyed by specialty name). */
export interface CFSweepAllResult {
  bySpecialty: Record<string, CFSweepRow[]>
}

// ---------------------------------------------------------------------------
// Snapshot for persisting optimizer config in memory and save/recall
// ---------------------------------------------------------------------------

export type OptimizerProviderTypeFilter = 'all' | 'productivity' | 'base'

/** Snapshot of CF Optimizer form state for in-memory persistence and saved scenarios. */
export interface OptimizerConfigSnapshot {
  providerTypeFilter: OptimizerProviderTypeFilter
  targetMode: 'all' | 'custom'
  selectedSpecialties: string[]
  selectedDivisions: string[]
  settings: OptimizerSettings
  configStep: number
  /** Optional: last run result so it can be restored when returning to the screen. */
  lastRunResult?: OptimizerRunResult | null
}

/** Saved optimizer scenario (name + snapshot) for recall. */
export interface SavedOptimizerConfig {
  id: string
  name: string
  createdAt: string
  /** Full snapshot so we can restore form and optionally last run result. */
  snapshot: OptimizerConfigSnapshot
}
