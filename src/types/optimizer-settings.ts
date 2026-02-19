/**
 * Conversion Factor Optimizer – configuration and settings types.
 * Covers the OptimizerSettings interface, all sub-option types, governance config,
 * and snapshot/saved-config types used for persistence.
 */

import type { ScenarioInputs } from '@/types/scenario'
import type { TCCComponentInclusion, AdditionalTCCConfig, TCCLayerConfig } from '@/lib/tcc-components'

// ---------------------------------------------------------------------------
// Benchmark basis (CART-aware normalization)
// ---------------------------------------------------------------------------

export type BenchmarkBasis = 'per_cfte' | 'per_tfte' | 'raw'

// ---------------------------------------------------------------------------
// Optimization objective
// ---------------------------------------------------------------------------

export type OptimizationObjectiveKind = 'align_percentile' | 'target_fixed_percentile' | 'hybrid'

export interface OptimizationObjectiveAlign {
  kind: 'align_percentile'
}

export interface OptimizationObjectiveTargetFixed {
  kind: 'target_fixed_percentile'
  targetPercentile: number
}

export interface OptimizationObjectiveHybrid {
  kind: 'hybrid'
  alignWeight: number
  targetWeight: number
  targetPercentile: number
}

export type OptimizationObjective =
  | OptimizationObjectiveAlign
  | OptimizationObjectiveTargetFixed
  | OptimizationObjectiveHybrid

export type OptimizerErrorMetric = 'squared' | 'absolute'

export const DEFAULT_OPTIMIZATION_OBJECTIVE: OptimizationObjective = { kind: 'align_percentile' }
export const DEFAULT_OPTIMIZER_ERROR_METRIC: OptimizerErrorMetric = 'squared'

// ---------------------------------------------------------------------------
// Legacy target rule
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
  iqrK?: number
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
  minChangePct: number
  maxChangePct: number
  absoluteMin?: number
  absoluteMax?: number
}

export const DEFAULT_CF_BOUNDS: CFBounds = {
  minChangePct: 30,
  maxChangePct: 30,
}

// ---------------------------------------------------------------------------
// Default exclusions
// ---------------------------------------------------------------------------

export interface DefaultExclusionRules {
  minBasisFTE: number
  minWRVUPer1p0CFTE: number
  excludeLOA: boolean
  newHireMonthsThreshold?: number
}

export const DEFAULT_EXCLUSION_RULES: DefaultExclusionRules = {
  minBasisFTE: 0.5,
  minWRVUPer1p0CFTE: 1000,
  excludeLOA: true,
  newHireMonthsThreshold: undefined,
}

// ---------------------------------------------------------------------------
// CF policy governance
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
// Governance configuration
// ---------------------------------------------------------------------------

export interface GovernanceConfig {
  hardCapPercentile: number
  softCapPercentile: number
  fmvRedFlagPercentile: number
  alignmentTolerancePctile: number
  minMeaningfulChangePct: number
}

export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
  hardCapPercentile: 50,
  softCapPercentile: 60,
  fmvRedFlagPercentile: 75,
  alignmentTolerancePctile: 3,
  minMeaningfulChangePct: 0.01,
}

// ---------------------------------------------------------------------------
// Full optimizer settings
// ---------------------------------------------------------------------------

export interface OptimizerSettings {
  benchmarkBasis: BenchmarkBasis
  optimizationObjective: OptimizationObjective
  errorMetric: OptimizerErrorMetric
  targetRule: TargetRule
  modeledTCCToggles: ModeledTCCToggles
  outlierParams: OutlierParams
  defaultExclusionRules: DefaultExclusionRules
  cfBounds: CFBounds
  budgetConstraint: BudgetConstraint
  cfPolicy: CFPolicySettings
  includeQualityPaymentsInBaselineAndModeled: boolean
  qualityPaymentsSource?: 'from_file' | 'override_pct_of_base'
  qualityPaymentsOverridePct?: number
  includeWorkRVUIncentiveInTCC: boolean
  tccComponentInclusion?: TCCComponentInclusion
  additionalTCCLayers?: TCCLayerConfig[]
  additionalTCC?: AdditionalTCCConfig
  includePsqInBaselineAndModeled?: boolean
  includeOtherIncentivesInBaselineAndModeled?: boolean
  includeStipendInBaselineAndModeled?: boolean
  psqFixedDollars?: number
  manualExcludeProviderIds: string[]
  manualIncludeProviderIds: string[]
  baseScenarioInputs: ScenarioInputs
  gridStepPct?: number
  maxRecommendedCFPercentile?: number
  wRVUGrowthFactorPct?: number
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
    layers.push({ id: `legacy-pct-${Date.now()}`, name: 'Percent of base', type: 'percent_of_base', value: legacy.percentOfBase })
  }
  if (legacy.dollarPer1p0FTE != null && Number.isFinite(legacy.dollarPer1p0FTE) && legacy.dollarPer1p0FTE !== 0) {
    layers.push({ id: `legacy-perfte-${Date.now()}`, name: 'Dollar per 1.0 FTE', type: 'dollar_per_1p0_FTE', value: legacy.dollarPer1p0FTE })
  }
  if (legacy.flatDollar != null && Number.isFinite(legacy.flatDollar) && legacy.flatDollar !== 0) {
    layers.push({ id: `legacy-flat-${Date.now()}`, name: 'Flat dollar', type: 'flat_dollar', value: legacy.flatDollar })
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

