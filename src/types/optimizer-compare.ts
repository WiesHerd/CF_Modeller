/**
 * Conversion Factor Optimizer – scenario comparison types.
 * Covers side-by-side comparison of two or more saved optimizer runs (2–4 scenarios).
 */

import type {
  OptimizationObjective,
  BudgetConstraint,
  GovernanceConfig,
} from '@/types/optimizer-settings'

// ---------------------------------------------------------------------------
// Two-scenario comparison (legacy — kept for audit compatibility)
// ---------------------------------------------------------------------------

export interface OptimizerAssumptionsDiff {
  wRVUGrowthFactorPctA: number | undefined
  wRVUGrowthFactorPctB: number | undefined
  objectiveA: OptimizationObjective
  objectiveB: OptimizationObjective
  governanceA: GovernanceConfig
  governanceB: GovernanceConfig
  providersIncludedA: number
  providersIncludedB: number
  providersExcludedA: number
  providersExcludedB: number
  manualExcludeCountA: number
  manualExcludeCountB: number
  manualIncludeCountA: number
  manualIncludeCountB: number
  budgetConstraintA: BudgetConstraint
  budgetConstraintB: BudgetConstraint
  selectedSpecialtiesA: string[]
  selectedSpecialtiesB: string[]
}

export interface OptimizerComparisonRollup {
  totalSpendImpactA: number
  totalSpendImpactB: number
  deltaSpendImpact: number
  deltaSpendImpactPct: number | null
  totalIncentiveA: number
  totalIncentiveB: number
  deltaIncentive: number
  meanTCCPercentileA: number
  meanTCCPercentileB: number
  meanModeledTCCPercentileA: number
  meanModeledTCCPercentileB: number
  meanWRVUPercentileA: number
  meanWRVUPercentileB: number
  countMeetingAlignmentTargetA: number
  countMeetingAlignmentTargetB: number
  countCFAbovePolicyA: number
  countCFAbovePolicyB: number
  countEffectiveRateAbove90A: number
  countEffectiveRateAbove90B: number
}

export interface OptimizerComparisonSpecialtyRow {
  specialty: string
  presence: 'both' | 'a_only' | 'b_only'
  recommendedCFA: number | null
  recommendedCFB: number | null
  deltaCFPct: number | null
  spendImpactA: number | null
  spendImpactB: number | null
  deltaSpendImpact: number | null
  meanTCCPercentileA: number | null
  meanTCCPercentileB: number | null
  meanModeledTCCPercentileA: number | null
  meanModeledTCCPercentileB: number | null
  meanWRVUPercentileA: number | null
  meanWRVUPercentileB: number | null
}

export interface OptimizerScenarioComparison {
  scenarioAName: string
  scenarioBName: string
  scenarioAId: string
  scenarioBId: string
  assumptions: OptimizerAssumptionsDiff
  rollup: OptimizerComparisonRollup
  bySpecialty: OptimizerComparisonSpecialtyRow[]
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

export interface OptimizerComparisonSpecialtyRowN {
  specialty: string
  scenarioIds: string[]
  recommendedCFByScenario: Record<string, number | null>
  spendImpactByScenario: Record<string, number | null>
  meanTCCPercentileByScenario: Record<string, number | null>
  meanModeledTCCPercentileByScenario: Record<string, number | null>
  meanWRVUPercentileByScenario: Record<string, number | null>
  incentiveByScenario?: Record<string, number | null>
}

export interface OptimizerScenarioComparisonN {
  scenarios: ScenarioInfo[]
  baselineScenarioId?: string
  assumptionsPerScenario: OptimizerAssumptionsPerScenario[]
  rollup: OptimizerComparisonRollupN
  bySpecialty: OptimizerComparisonSpecialtyRowN[]
  narrativeSummary: string[]
}
