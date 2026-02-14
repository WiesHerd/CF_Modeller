/**
 * Compare two saved optimizer runs: assumptions diff, roll-up metrics, by-specialty table,
 * and a narrative summary in provider-compensation terms.
 */

import type {
  OptimizerComparisonRollup,
  OptimizerComparisonSpecialtyRow,
  OptimizerAssumptionsDiff,
  OptimizerScenarioComparison,
  OptimizerRunResult,
  SavedOptimizerConfig,
} from '@/types/optimizer'

/** Returns true if the config has run results and can be used in comparison. */
export function canCompareOptimizerConfig(config: SavedOptimizerConfig): boolean {
  return config?.snapshot?.lastRunResult != null
}

/** Build assumptions diff from two saved configs (both must have lastRunResult). */
function buildAssumptionsDiff(
  configA: SavedOptimizerConfig,
  configB: SavedOptimizerConfig
): OptimizerAssumptionsDiff {
  const settingsA = configA.snapshot.settings
  const settingsB = configB.snapshot.settings
  const summaryA = configA.snapshot.lastRunResult!.summary
  const summaryB = configB.snapshot.lastRunResult!.summary
  return {
    wRVUGrowthFactorPctA: settingsA.wRVUGrowthFactorPct,
    wRVUGrowthFactorPctB: settingsB.wRVUGrowthFactorPct,
    objectiveA: settingsA.optimizationObjective,
    objectiveB: settingsB.optimizationObjective,
    governanceA: settingsA.governanceConfig,
    governanceB: settingsB.governanceConfig,
    providersIncludedA: summaryA.providersIncluded,
    providersIncludedB: summaryB.providersIncluded,
    providersExcludedA: summaryA.providersExcluded,
    providersExcludedB: summaryB.providersExcluded,
    manualExcludeCountA: settingsA.manualExcludeProviderIds?.length ?? 0,
    manualExcludeCountB: settingsB.manualExcludeProviderIds?.length ?? 0,
    manualIncludeCountA: settingsA.manualIncludeProviderIds?.length ?? 0,
    manualIncludeCountB: settingsB.manualIncludeProviderIds?.length ?? 0,
    budgetConstraintA: settingsA.budgetConstraint,
    budgetConstraintB: settingsB.budgetConstraint,
    selectedSpecialtiesA: configA.snapshot.selectedSpecialties ?? [],
    selectedSpecialtiesB: configB.snapshot.selectedSpecialties ?? [],
  }
}

/** Sum work RVU incentive dollars (modeled) across all included providers in the run. */
function totalModeledIncentive(result: OptimizerRunResult): number {
  let sum = 0
  for (const row of result.bySpecialty) {
    for (const ctx of row.providerContexts) {
      if (ctx.included && ctx.modeledIncentiveDollars != null) {
        sum += ctx.modeledIncentiveDollars
      }
    }
  }
  return sum
}

/** Roll-up mean TCC and wRVU percentile across specialties (simple average of keyMetrics). */
function rollupMeanPercentiles(result: OptimizerRunResult): { meanTCC: number; meanWRVU: number } {
  const bySpecialty = result.bySpecialty
  if (bySpecialty.length === 0) return { meanTCC: 0, meanWRVU: 0 }
  let sumTCC = 0
  let sumWRVU = 0
  for (const row of bySpecialty) {
    sumTCC += row.keyMetrics.compPercentile
    sumWRVU += row.keyMetrics.prodPercentile
  }
  return {
    meanTCC: sumTCC / bySpecialty.length,
    meanWRVU: sumWRVU / bySpecialty.length,
  }
}

/** Build roll-up comparison from two run results. */
function buildRollup(
  resultA: OptimizerRunResult,
  resultB: OptimizerRunResult
): OptimizerComparisonRollup {
  const sumA = resultA.summary
  const sumB = resultB.summary
  const impactA = sumA.totalSpendImpactRaw
  const impactB = sumB.totalSpendImpactRaw
  const deltaSpend = impactB - impactA
  const deltaSpendPct =
    impactA !== 0 ? (deltaSpend / Math.abs(impactA)) * 100 : null

  const incentiveA = totalModeledIncentive(resultA)
  const incentiveB = totalModeledIncentive(resultB)
  const { meanTCC: meanTCCA, meanWRVU: meanWRVUA } = rollupMeanPercentiles(resultA)
  const { meanTCC: meanTCCB, meanWRVU: meanWRVUB } = rollupMeanPercentiles(resultB)

  return {
    totalSpendImpactA: impactA,
    totalSpendImpactB: impactB,
    deltaSpendImpact: deltaSpend,
    deltaSpendImpactPct: deltaSpendPct,
    totalIncentiveA: incentiveA,
    totalIncentiveB: incentiveB,
    deltaIncentive: incentiveB - incentiveA,
    meanTCCPercentileA: meanTCCA,
    meanTCCPercentileB: meanTCCB,
    meanWRVUPercentileA: meanWRVUA,
    meanWRVUPercentileB: meanWRVUB,
    countMeetingAlignmentTargetA: sumA.countMeetingAlignmentTarget,
    countMeetingAlignmentTargetB: sumB.countMeetingAlignmentTarget,
    countCFAbovePolicyA: sumA.countCFAbovePolicy,
    countCFAbovePolicyB: sumB.countCFAbovePolicy,
    countEffectiveRateAbove90A: sumA.countEffectiveRateAbove90,
    countEffectiveRateAbove90B: sumB.countEffectiveRateAbove90,
  }
}

/** Build by-specialty comparison rows (all specialties from A and B). */
function buildBySpecialtyRows(
  resultA: OptimizerRunResult,
  resultB: OptimizerRunResult
): OptimizerComparisonSpecialtyRow[] {
  const bySpecA = new Map(resultA.bySpecialty.map((r) => [r.specialty, r]))
  const bySpecB = new Map(resultB.bySpecialty.map((r) => [r.specialty, r]))
  const allSpecialties = new Set([...bySpecA.keys(), ...bySpecB.keys()])
  const rows: OptimizerComparisonSpecialtyRow[] = []

  for (const specialty of [...allSpecialties].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))) {
    const rowA = bySpecA.get(specialty)
    const rowB = bySpecB.get(specialty)
    const presence: 'both' | 'a_only' | 'b_only' = rowA && rowB ? 'both' : rowA ? 'a_only' : 'b_only'

    const recommendedCFA = rowA?.recommendedCF ?? null
    const recommendedCFB = rowB?.recommendedCF ?? null
    let deltaCFPct: number | null = null
    if (recommendedCFA != null && recommendedCFB != null && recommendedCFA !== 0) {
      deltaCFPct = ((recommendedCFB - recommendedCFA) / recommendedCFA) * 100
    }

    const spendImpactA = rowA?.spendImpactRaw ?? null
    const spendImpactB = rowB?.spendImpactRaw ?? null
    const deltaSpendImpact =
      spendImpactA != null && spendImpactB != null ? spendImpactB - spendImpactA : null

    rows.push({
      specialty,
      presence,
      recommendedCFA,
      recommendedCFB,
      deltaCFPct,
      spendImpactA,
      spendImpactB,
      deltaSpendImpact,
      meanTCCPercentileA: rowA?.keyMetrics.compPercentile ?? null,
      meanTCCPercentileB: rowB?.keyMetrics.compPercentile ?? null,
      meanWRVUPercentileA: rowA?.keyMetrics.prodPercentile ?? null,
      meanWRVUPercentileB: rowB?.keyMetrics.prodPercentile ?? null,
    })
  }
  return rows
}

/** Build narrative summary in provider-compensation terms (one bullet per item). */
function buildNarrativeSummary(
  nameA: string,
  nameB: string,
  assumptions: OptimizerAssumptionsDiff,
  rollup: OptimizerComparisonRollup
): string[] {
  const parts: string[] = []

  // Total cash comp / spend
  const { deltaSpendImpact, deltaSpendImpactPct } = rollup
  if (deltaSpendImpact !== 0) {
    const direction = deltaSpendImpact > 0 ? 'increases' : 'reduces'
    const absDelta = Math.abs(deltaSpendImpact)
    const pctStr =
      deltaSpendImpactPct != null
        ? ` (${deltaSpendImpactPct > 0 ? '+' : ''}${deltaSpendImpactPct.toFixed(1)}% vs ${nameA})`
        : ''
    parts.push(
      `${nameB} ${direction} total modeled incentive spend by $${Math.abs(absDelta).toLocaleString('en-US', { maximumFractionDigits: 0 })} compared to ${nameA}${pctStr}. This is the budget impact of the recommended conversion factor changes.`
    )
  } else {
    parts.push(`Total modeled incentive spend is the same in both scenarios.`)
  }

  // Productivity (wRVU) and pay vs productivity alignment
  const { meanWRVUPercentileA, meanWRVUPercentileB, meanTCCPercentileA, meanTCCPercentileB } = rollup
  const wrvuDiff = meanWRVUPercentileB - meanWRVUPercentileA
  const tccDiff = meanTCCPercentileB - meanTCCPercentileA
  if (Math.abs(wrvuDiff) > 0.5 || Math.abs(tccDiff) > 0.5) {
    const wrvuNote =
      Math.abs(wrvuDiff) > 0.5
        ? ` Mean wRVU percentile is ${meanWRVUPercentileB.toFixed(1)} in ${nameB} vs ${meanWRVUPercentileA.toFixed(1)} in ${nameA} (e.g. due to different productivity gain or scope).`
        : ''
    const tccNote =
      Math.abs(tccDiff) > 0.5
        ? ` Mean TCC percentile is ${meanTCCPercentileB.toFixed(1)} in ${nameB} vs ${meanTCCPercentileA.toFixed(1)} in ${nameA}.`
        : ''
    parts.push(`Pay vs productivity positioning differs between scenarios.${wrvuNote}${tccNote}`)
  }

  // Alignment and governance
  const {
    countMeetingAlignmentTargetA,
    countMeetingAlignmentTargetB,
    countCFAbovePolicyA,
    countCFAbovePolicyB,
    countEffectiveRateAbove90A,
    countEffectiveRateAbove90B,
  } = rollup
  const alignDiff = countMeetingAlignmentTargetB - countMeetingAlignmentTargetA
  if (alignDiff !== 0) {
    parts.push(
      `Providers meeting the alignment target: ${nameA} ${countMeetingAlignmentTargetA}, ${nameB} ${countMeetingAlignmentTargetB}.`
    )
  }
  if (
    countCFAbovePolicyA !== countCFAbovePolicyB ||
    countEffectiveRateAbove90A !== countEffectiveRateAbove90B
  ) {
    parts.push(
      `Governance: CF above policy threshold — ${nameA} ${countCFAbovePolicyA}, ${nameB} ${countCFAbovePolicyB}. Effective rate above 90th — ${nameA} ${countEffectiveRateAbove90A}, ${nameB} ${countEffectiveRateAbove90B}.`
    )
  }

  // Scope if different
  if (
    assumptions.providersIncludedA !== assumptions.providersIncludedB ||
    assumptions.providersExcludedA !== assumptions.providersExcludedB
  ) {
    parts.push(
      `Scope differs: ${nameA} included ${assumptions.providersIncludedA} providers (${assumptions.providersExcludedA} excluded); ${nameB} included ${assumptions.providersIncludedB} (${assumptions.providersExcludedB} excluded).`
    )
  }

  return parts.length > 0 ? parts : ['Both scenarios have the same roll-up metrics and scope.']
}

/**
 * Compare two saved optimizer configs. Both must have lastRunResult.
 * Returns the full comparison (assumptions, rollup, bySpecialty, narrative).
 */
export function compareOptimizerScenarios(
  configA: SavedOptimizerConfig,
  configB: SavedOptimizerConfig
): OptimizerScenarioComparison {
  const resultA = configA.snapshot.lastRunResult!
  const resultB = configB.snapshot.lastRunResult!

  const assumptions = buildAssumptionsDiff(configA, configB)
  const rollup = buildRollup(resultA, resultB)
  const bySpecialty = buildBySpecialtyRows(resultA, resultB)
  const narrativeSummary = buildNarrativeSummary(
    configA.name,
    configB.name,
    assumptions,
    rollup
  )

  return {
    scenarioAName: configA.name,
    scenarioBName: configB.name,
    scenarioAId: configA.id,
    scenarioBId: configB.id,
    assumptions,
    rollup,
    bySpecialty,
    narrativeSummary,
  }
}
