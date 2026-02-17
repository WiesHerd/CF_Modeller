/**
 * Specialty Productivity Target Optimizer (Group Target – Method 1).
 * Types for group wRVU target per specialty, provider-level evaluation, and planning incentive.
 */

// ---------------------------------------------------------------------------
// Target approach
// ---------------------------------------------------------------------------

export type TargetApproach = 'wrvu_percentile' | 'pay_per_wrvu'

// ---------------------------------------------------------------------------
// Planning CF source
// ---------------------------------------------------------------------------

export type PlanningCFSource = 'market_percentile' | 'manual'

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ProductivityTargetSettings {
  targetPercentile: number
  cfPercentile: number
  targetApproach: TargetApproach
  alignmentTolerance: number
  rampFactorByProviderId?: Record<string, number>
  planningCFSource: PlanningCFSource
  planningCFPercentile: number
  planningCFManual?: number
}

export const DEFAULT_PRODUCTIVITY_TARGET_SETTINGS: ProductivityTargetSettings = {
  targetPercentile: 50,
  cfPercentile: 50,
  targetApproach: 'wrvu_percentile',
  alignmentTolerance: 10,
  planningCFSource: 'market_percentile',
  planningCFPercentile: 50,
}

// ---------------------------------------------------------------------------
// Status bands (percent to target)
// ---------------------------------------------------------------------------

export type ProviderTargetStatus = 'Above Target' | 'At Target' | 'Below Target'

export interface StatusBandCounts {
  below80: number
  eightyTo99: number
  hundredTo119: number
  atOrAbove120: number
}

// ---------------------------------------------------------------------------
// Provider input (built from ProviderRow + market match)
// ---------------------------------------------------------------------------

export interface ProductivityTargetProviderInput {
  providerId: string
  providerName?: string
  specialty: string
  cFTE: number
  actualWRVUs: number
  rampFactor: number
}

// ---------------------------------------------------------------------------
// Provider result (with target, variance, status, planning incentive)
// ---------------------------------------------------------------------------

export interface ProductivityTargetProviderResult extends ProductivityTargetProviderInput {
  targetWRVU: number
  rampedTargetWRVU: number
  varianceWRVU: number
  percentToTarget: number
  status: ProviderTargetStatus
  planningIncentiveDollars?: number
}

// ---------------------------------------------------------------------------
// Specialty summary
// ---------------------------------------------------------------------------

export interface ProductivityTargetSpecialtySummary {
  meanPercentToTarget: number
  medianPercentToTarget: number
  bandCounts: StatusBandCounts
}

// ---------------------------------------------------------------------------
// Specialty result
// ---------------------------------------------------------------------------

export interface ProductivityTargetSpecialtyResult {
  specialty: string
  groupTargetWRVU_1cFTE: number | null
  targetPercentile: number
  targetApproach: TargetApproach
  providers: ProductivityTargetProviderResult[]
  summary: ProductivityTargetSpecialtySummary
  totalPlanningIncentiveDollars: number
  warning?: string
}

// ---------------------------------------------------------------------------
// Full run result
// ---------------------------------------------------------------------------

export interface ProductivityTargetRunResult {
  bySpecialty: ProductivityTargetSpecialtyResult[]
}

// ---------------------------------------------------------------------------
// Config snapshot (for in-memory persistence and save/load)
// ---------------------------------------------------------------------------

export interface ProductivityTargetConfigSnapshot {
  settings: ProductivityTargetSettings
  configStep: number
  targetMode?: 'all' | 'custom'
  selectedSpecialties?: string[]
  /** When 'custom', only providers whose productivityModel is in selectedModels are in scope. */
  modelScopeMode?: 'all' | 'custom'
  selectedModels?: string[]
  /** When 'custom', only providers whose providerType (role) is in selectedProviderTypes are in scope. */
  providerTypeScopeMode?: 'all' | 'custom'
  selectedProviderTypes?: string[]
  /** Provider types (roles) to exclude after inclusion filters. */
  excludedProviderTypes?: string[]
  /** When 'custom', only providers whose id is in selectedProviderIds are in scope. */
  providerScopeMode?: 'all' | 'custom'
  selectedProviderIds?: string[]
  /** Provider IDs to exclude after inclusion filters. */
  excludedProviderIds?: string[]
  selectedDivisions?: string[]
  lastRunResult?: ProductivityTargetRunResult | null
}

// ---------------------------------------------------------------------------
// Saved config (persisted)
// ---------------------------------------------------------------------------

export interface SavedProductivityTargetConfig {
  id: string
  name: string
  createdAt: string
  snapshot: ProductivityTargetConfigSnapshot
}

// ---------------------------------------------------------------------------
// Multi-scenario comparison (2–4 scenarios)
// ---------------------------------------------------------------------------

export const MAX_COMPARE_TARGET_SCENARIOS = 4

export interface ProductivityTargetScenarioInfo {
  id: string
  name: string
}

/** Per-scenario roll-up metrics keyed by scenario id. */
export interface ProductivityTargetComparisonRollupN {
  /** Percentile used to set group wRVU target (e.g. 50 = 50th). */
  targetPercentileByScenario: Record<string, number>
  /** Target approach display label per scenario. */
  targetApproachByScenario: Record<string, string>
  totalPlanningIncentiveByScenario: Record<string, number>
  meanPercentToTargetByScenario: Record<string, number>
  below80ByScenario: Record<string, number>
  eightyTo99ByScenario: Record<string, number>
  hundredTo119ByScenario: Record<string, number>
  atOrAbove120ByScenario: Record<string, number>
}

/** One row in the by-specialty comparison table (N scenarios). */
export interface ProductivityTargetComparisonSpecialtyRowN {
  specialty: string
  scenarioIds: string[]
  groupTargetWRVUByScenario: Record<string, number | null>
  planningIncentiveByScenario: Record<string, number | null>
  meanPercentToTargetByScenario: Record<string, number | null>
  below80ByScenario: Record<string, number>
  eightyTo99ByScenario: Record<string, number>
  hundredTo119ByScenario: Record<string, number>
  atOrAbove120ByScenario: Record<string, number>
}

/** Full comparison result for 2–4 saved target configs (all with lastRunResult). */
export interface ProductivityTargetScenarioComparisonN {
  scenarios: ProductivityTargetScenarioInfo[]
  rollup: ProductivityTargetComparisonRollupN
  bySpecialty: ProductivityTargetComparisonSpecialtyRowN[]
  narrativeSummary?: string[]
}
