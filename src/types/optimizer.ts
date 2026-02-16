/**
 * Conversion Factor Optimizer – types for audit-ready, consulting-grade specialty-level CF recommendations.
 * Supports alignment of productivity (wRVU percentile) and pay (TCC percentile) with governance guardrails.
 */

import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs } from '@/types/scenario'
import type { MarketMatchStatus } from '@/types/batch'
import type { TCCComponentInclusion, AdditionalTCCConfig, TCCLayerConfig } from '@/lib/tcc-components'

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
  /** Include quality payments in baseline and modeled TCC. */
  includeQualityPaymentsInBaselineAndModeled: boolean
  /** When 'override_pct_of_base', quality = clinical base × this % instead of provider file. */
  qualityPaymentsSource?: 'from_file' | 'override_pct_of_base'
  /** e.g. 5 = 5% of base; used when qualityPaymentsSource is 'override_pct_of_base'. */
  qualityPaymentsOverridePct?: number
  /** Include work RVU incentive in baseline and modeled TCC. Baseline uses current CF/threshold; modeled uses recommended CF. */
  includeWorkRVUIncentiveInTCC: boolean
  /**
   * Optional: which TCC components are included and per-component options (e.g. normalize for FTE).
   * When set, overrides the individual include* booleans for baseline/config; allows custom components and options.
   */
  tccComponentInclusion?: TCCComponentInclusion
  /** Named layers (value-based, retention, etc.): percent of base, per FTE, flat, or from file. Replaces additionalTCC. */
  additionalTCCLayers?: TCCLayerConfig[]
  /** Legacy: migrated to additionalTCCLayers on load when present. */
  additionalTCC?: AdditionalTCCConfig
  /** Include PSQ (from base scenario % or fixed) in baseline and modeled TCC. When true, uses baseScenarioInputs.psqPercent and psqBasis. */
  includePsqInBaselineAndModeled?: boolean
  /** Include other incentives (retention, sign-on) in baseline/modeled TCC. When tccComponentInclusion is set, that overrides. */
  includeOtherIncentivesInBaselineAndModeled?: boolean
  /** Include stipend / non-clinical pay in baseline/modeled TCC. When tccComponentInclusion is set, that overrides. */
  includeStipendInBaselineAndModeled?: boolean
  /** When PSQ basis is fixed dollars, use this (global). Kept for non-optimizer flows. */
  psqFixedDollars?: number
  manualExcludeProviderIds: string[]
  manualIncludeProviderIds: string[]
  baseScenarioInputs: ScenarioInputs
  /** Grid step as fraction of CF (e.g. 0.005 = 0.5%). Internal default; not exposed in UI. */
  gridStepPct?: number
  /** Cap: recommended CF will not exceed this market percentile (e.g. 50 = median) per specialty. */
  maxRecommendedCFPercentile?: number
  /**
   * Assume productivity gain: scale recorded wRVUs by (1 + this/100) for this run only.
   * E.g. 5 = 5% higher wRVUs (budgeting for expected productivity growth). 0 or undefined = no scaling.
   */
  wRVUGrowthFactorPct?: number
  /** Governance thresholds for status/explanation logic. */
  governanceConfig: GovernanceConfig
}

/** Migrate legacy additionalTCC to additionalTCCLayers when loading saved config. */
export function migrateAdditionalTCCToLayers(settings: OptimizerSettings): OptimizerSettings {
  const legacy = settings.additionalTCC
  if (!legacy || (settings.additionalTCCLayers && settings.additionalTCCLayers.length > 0)) {
    return settings
  }
  const layers: TCCLayerConfig[] = []
  if (legacy.percentOfBase != null && Number.isFinite(legacy.percentOfBase) && legacy.percentOfBase !== 0) {
    layers.push({
      id: `legacy-pct-${Date.now()}`,
      name: 'Percent of base',
      type: 'percent_of_base',
      value: legacy.percentOfBase,
    })
  }
  if (legacy.dollarPer1p0FTE != null && Number.isFinite(legacy.dollarPer1p0FTE) && legacy.dollarPer1p0FTE !== 0) {
    layers.push({
      id: `legacy-perfte-${Date.now()}`,
      name: 'Dollar per 1.0 FTE',
      type: 'dollar_per_1p0_FTE',
      value: legacy.dollarPer1p0FTE,
    })
  }
  if (legacy.flatDollar != null && Number.isFinite(legacy.flatDollar) && legacy.flatDollar !== 0) {
    layers.push({
      id: `legacy-flat-${Date.now()}`,
      name: 'Flat dollar',
      type: 'flat_dollar',
      value: legacy.flatDollar,
    })
  }
  if (layers.length === 0) return settings
  return { ...settings, additionalTCCLayers: layers }
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
    includeQualityPaymentsInBaselineAndModeled: true,
    includeWorkRVUIncentiveInTCC: true,
    tccComponentInclusion: undefined,
    additionalTCCLayers: [],
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
  /** wRVU per 1.0 cFTE used for this run (scaled by wRVUGrowthFactorPct when set). */
  wRVU_1p0: number
  /** Total wRVUs used for this run (scaled by wRVUGrowthFactorPct when set). */
  effectiveTotalWRVUs: number
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
  /** Total work RVU incentive $ at recommended CF across included providers. Optional for backward compat with saved runs. */
  totalIncentiveDollars?: number
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
  /** Provider types (roles) to exclude from the run, e.g. Division Chief, Medical Director. */
  excludedProviderTypes: string[]
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

// ---------------------------------------------------------------------------
// Scenario comparison (compare two saved optimizer runs)
// ---------------------------------------------------------------------------

/** Side-by-side or diff of key assumptions between two optimizer runs. */
export interface OptimizerAssumptionsDiff {
  /** Productivity gain (wRVU growth) assumption: A vs B. */
  wRVUGrowthFactorPctA: number | undefined
  wRVUGrowthFactorPctB: number | undefined
  /** Optimization objective: kind and params. */
  objectiveA: OptimizationObjective
  objectiveB: OptimizationObjective
  /** Governance: hard/soft cap, FMV threshold, alignment tolerance. */
  governanceA: GovernanceConfig
  governanceB: GovernanceConfig
  /** Scope: included/excluded counts from each run summary. */
  providersIncludedA: number
  providersIncludedB: number
  providersExcludedA: number
  providersExcludedB: number
  /** Manual include/exclude IDs (length or summary). */
  manualExcludeCountA: number
  manualExcludeCountB: number
  manualIncludeCountA: number
  manualIncludeCountB: number
  /** Budget constraint: kind and cap if set. */
  budgetConstraintA: BudgetConstraint
  budgetConstraintB: BudgetConstraint
  /** Selected specialties (for custom target mode). */
  selectedSpecialtiesA: string[]
  selectedSpecialtiesB: string[]
}

/** Roll-up metrics for comparison (spend, incentive, alignment, governance). */
export interface OptimizerComparisonRollup {
  totalSpendImpactA: number
  totalSpendImpactB: number
  deltaSpendImpact: number
  deltaSpendImpactPct: number | null
  /** Total work RVU incentive $ (modeled) across included providers; A and B. */
  totalIncentiveA: number
  totalIncentiveB: number
  deltaIncentive: number
  /** Mean TCC percentile (roll-up from bySpecialty keyMetrics). */
  meanTCCPercentileA: number
  meanTCCPercentileB: number
  /** Mean TCC percentile after recommended CF (modeled outcome); differs between scenarios. */
  meanModeledTCCPercentileA: number
  meanModeledTCCPercentileB: number
  /** Mean wRVU percentile (input data — unchanged by CF optimizer, so same for both when same scope). */
  meanWRVUPercentileA: number
  meanWRVUPercentileB: number
  countMeetingAlignmentTargetA: number
  countMeetingAlignmentTargetB: number
  countCFAbovePolicyA: number
  countCFAbovePolicyB: number
  countEffectiveRateAbove90A: number
  countEffectiveRateAbove90B: number
}

/** One row in the by-specialty comparison table. */
export interface OptimizerComparisonSpecialtyRow {
  specialty: string
  /** Present in scenario A only, B only, or both. */
  presence: 'both' | 'a_only' | 'b_only'
  recommendedCFA: number | null
  recommendedCFB: number | null
  deltaCFPct: number | null
  spendImpactA: number | null
  spendImpactB: number | null
  deltaSpendImpact: number | null
  /** Mean TCC percentile at baseline (before recommended CF); same for both runs if same data. */
  meanTCCPercentileA: number | null
  meanTCCPercentileB: number | null
  /** Mean TCC percentile after applying each run's recommended CF (modeled outcome). */
  meanModeledTCCPercentileA: number | null
  meanModeledTCCPercentileB: number | null
  meanWRVUPercentileA: number | null
  meanWRVUPercentileB: number | null
}

/** Full comparison result for two saved optimizer configs (both with lastRunResult). */
export interface OptimizerScenarioComparison {
  scenarioAName: string
  scenarioBName: string
  scenarioAId: string
  scenarioBId: string
  assumptions: OptimizerAssumptionsDiff
  rollup: OptimizerComparisonRollup
  bySpecialty: OptimizerComparisonSpecialtyRow[]
  /** Narrative summary in provider-compensation terms. Array = bullets, string = single paragraph (legacy). */
  narrativeSummary: string | string[]
}

// ---------------------------------------------------------------------------
// Multi-scenario comparison (2–4 scenarios)
// ---------------------------------------------------------------------------

export const MAX_COMPARE_SCENARIOS = 4

export interface ScenarioInfo {
  id: string
  name: string
}

/** Per-scenario assumptions (one entry per scenario in comparison). */
export interface OptimizerAssumptionsPerScenario {
  scenarioId: string
  scenarioName: string
  wRVUGrowthFactorPct: number | undefined
  optimizationObjective: OptimizationObjective
  governanceConfig: GovernanceConfig
  providersIncluded: number
  providersExcluded: number
  manualExcludeCount: number
  manualIncludeCount: number
  budgetConstraint: BudgetConstraint
  selectedSpecialties: string[]
}

/** Roll-up metrics keyed by scenario id (supports 2–4 scenarios). */
export interface OptimizerComparisonRollupN {
  totalSpendImpactByScenario: Record<string, number>
  totalIncentiveByScenario: Record<string, number>
  meanTCCPercentileByScenario: Record<string, number>
  meanModeledTCCPercentileByScenario: Record<string, number>
  meanWRVUPercentileByScenario: Record<string, number>
  countMeetingAlignmentTargetByScenario: Record<string, number>
  countCFAbovePolicyByScenario: Record<string, number>
  countEffectiveRateAbove90ByScenario: Record<string, number>
}

/** One row in the by-specialty comparison table (N scenarios). */
export interface OptimizerComparisonSpecialtyRowN {
  specialty: string
  /** Scenario ids that include this specialty. */
  scenarioIds: string[]
  recommendedCFByScenario: Record<string, number | null>
  spendImpactByScenario: Record<string, number | null>
  meanTCCPercentileByScenario: Record<string, number | null>
  meanModeledTCCPercentileByScenario: Record<string, number | null>
  meanWRVUPercentileByScenario: Record<string, number | null>
}

/** Full comparison result for 2–4 saved optimizer configs (all with lastRunResult). */
export interface OptimizerScenarioComparisonN {
  scenarios: ScenarioInfo[]
  /** Optional baseline scenario id for delta/vs-baseline display. */
  baselineScenarioId?: string
  assumptionsPerScenario: OptimizerAssumptionsPerScenario[]
  rollup: OptimizerComparisonRollupN
  bySpecialty: OptimizerComparisonSpecialtyRowN[]
  narrativeSummary: string[]
}
