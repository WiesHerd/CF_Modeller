/**
 * Conversion Factor Optimizer – barrel re-export.
 *
 * Types are split across three focused modules:
 *   - optimizer-settings.ts  – OptimizerSettings, governance, objectives, etc.
 *   - optimizer-results.ts   – run results, specialty results, audit export, CF sweep
 *   - optimizer-compare.ts   – scenario comparison (2-scenario and N-scenario)
 *
 * All existing imports from '@/types/optimizer' continue to work unchanged.
 */

export type {
  BenchmarkBasis,
  OptimizationObjectiveKind,
  OptimizationObjectiveAlign,
  OptimizationObjectiveTargetFixed,
  OptimizationObjectiveHybrid,
  OptimizationObjective,
  OptimizerErrorMetric,
  TargetRuleKind,
  TargetRuleWithin,
  TargetRuleRange,
  TargetRule,
  ModeledTCCToggles,
  OutlierMethod,
  OutlierParams,
  BudgetConstraintKind,
  BudgetConstraint,
  CFBounds,
  DefaultExclusionRules,
  CFPolicyEnforcementMode,
  CFPolicySettings,
  GovernanceConfig,
  OptimizerSettings,
} from '@/types/optimizer-settings'

export {
  DEFAULT_OPTIMIZATION_OBJECTIVE,
  DEFAULT_OPTIMIZER_ERROR_METRIC,
  DEFAULT_MODELED_TCC_TOGGLES,
  DEFAULT_OUTLIER_PARAMS,
  DEFAULT_BUDGET_CONSTRAINT,
  DEFAULT_CF_BOUNDS,
  DEFAULT_EXCLUSION_RULES,
  DEFAULT_CF_POLICY,
  DEFAULT_GOVERNANCE_CONFIG,
  migrateAdditionalTCCToLayers,
  getDefaultOptimizerSettings,
} from '@/types/optimizer-settings'

export type {
  ExclusionReason,
  OptimizerProviderContext,
  PolicyCheckStatus,
  OptimizerFlag,
  OptimizerRecommendedAction,
  OptimizerStatus,
  OptimizerKeyMetrics,
  OptimizerExplanation,
  MarketCFBenchmarks,
  OptimizerSpecialtyResult,
  OptimizerRunSummary,
  OptimizerAuditExport,
  OptimizerRunResult,
  CFSweepRow,
  CFSweepSpecialtyResult,
  CFSweepAllResult,
  OptimizerProviderTypeFilter,
  OptimizerConfigSnapshot,
  SavedOptimizerConfig,
} from '@/types/optimizer-results'

export type {
  OptimizerAssumptionsDiff,
  OptimizerComparisonRollup,
  OptimizerComparisonSpecialtyRow,
  OptimizerScenarioComparison,
  ScenarioInfo,
  OptimizerAssumptionsPerScenario,
  OptimizerComparisonRollupN,
  OptimizerComparisonSpecialtyRowN,
  OptimizerScenarioComparisonN,
} from '@/types/optimizer-compare'

export { MAX_COMPARE_SCENARIOS } from '@/types/optimizer-compare'
