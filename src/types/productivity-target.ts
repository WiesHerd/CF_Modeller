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
