/**
 * Compare two saved optimizer runs: assumptions diff, roll-up metrics, by-specialty table,
 * and a narrative summary in provider-compensation terms.
 */

import {
  type OptimizerComparisonRollupN,
  type OptimizerComparisonSpecialtyRowN,
  type OptimizerAssumptionsPerScenario,
  type OptimizerScenarioComparisonN,
  type ScenarioInfo,
  type OptimizerRunResult,
  type SavedOptimizerConfig,
  MAX_COMPARE_SCENARIOS,
} from '@/types/optimizer'

/** Returns true if the config has run results and can be used in comparison. */
export function canCompareOptimizerConfig(config: SavedOptimizerConfig): boolean {
  return config?.snapshot?.lastRunResult != null
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

/** Mean TCC percentile after recommended CF (modeled) across all included providers. */
function rollupMeanModeledTCCPercentile(result: OptimizerRunResult): number {
  let sum = 0
  let count = 0
  for (const row of result.bySpecialty) {
    for (const ctx of row.providerContexts) {
      if (ctx.included && ctx.modeledTCC_pctile != null) {
        sum += ctx.modeledTCC_pctile
        count += 1
      }
    }
  }
  return count > 0 ? sum / count : 0
}

// ---------------------------------------------------------------------------
// N-scenario comparison (2–4 scenarios)
// ---------------------------------------------------------------------------

function buildAssumptionsPerScenarioN(configs: SavedOptimizerConfig[]): OptimizerAssumptionsPerScenario[] {
  return configs.map((c) => {
    const settings = c.snapshot.settings
    const summary = c.snapshot.lastRunResult!.summary
    return {
      scenarioId: c.id,
      scenarioName: c.name,
      wRVUGrowthFactorPct: settings.wRVUGrowthFactorPct,
      optimizationObjective: settings.optimizationObjective,
      governanceConfig: settings.governanceConfig,
      providersIncluded: summary.providersIncluded,
      providersExcluded: summary.providersExcluded,
      manualExcludeCount: settings.manualExcludeProviderIds?.length ?? 0,
      manualIncludeCount: settings.manualIncludeProviderIds?.length ?? 0,
      budgetConstraint: settings.budgetConstraint,
      selectedSpecialties: c.snapshot.selectedSpecialties ?? [],
    }
  })
}

function buildRollupN(
  results: OptimizerRunResult[],
  scenarioIds: string[]
): OptimizerComparisonRollupN {
  const totalSpendImpactByScenario: Record<string, number> = {}
  const totalIncentiveByScenario: Record<string, number> = {}
  const meanTCCPercentileByScenario: Record<string, number> = {}
  const meanModeledTCCPercentileByScenario: Record<string, number> = {}
  const meanWRVUPercentileByScenario: Record<string, number> = {}
  const countMeetingAlignmentTargetByScenario: Record<string, number> = {}
  const countCFAbovePolicyByScenario: Record<string, number> = {}
  const countEffectiveRateAbove90ByScenario: Record<string, number> = {}

  scenarioIds.forEach((id, i) => {
    const result = results[i]
    if (!result) return
    const summary = result.summary
    totalSpendImpactByScenario[id] = summary.totalSpendImpactRaw
    totalIncentiveByScenario[id] = totalModeledIncentive(result)
    const { meanTCC, meanWRVU } = rollupMeanPercentiles(result)
    meanTCCPercentileByScenario[id] = meanTCC
    meanWRVUPercentileByScenario[id] = meanWRVU
    meanModeledTCCPercentileByScenario[id] = rollupMeanModeledTCCPercentile(result)
    countMeetingAlignmentTargetByScenario[id] = summary.countMeetingAlignmentTarget
    countCFAbovePolicyByScenario[id] = summary.countCFAbovePolicy
    countEffectiveRateAbove90ByScenario[id] = summary.countEffectiveRateAbove90
  })

  return {
    totalSpendImpactByScenario,
    totalIncentiveByScenario,
    meanTCCPercentileByScenario,
    meanModeledTCCPercentileByScenario,
    meanWRVUPercentileByScenario,
    countMeetingAlignmentTargetByScenario,
    countCFAbovePolicyByScenario,
    countEffectiveRateAbove90ByScenario,
  }
}

function buildBySpecialtyRowsN(
  results: OptimizerRunResult[],
  scenarioIds: string[]
): OptimizerComparisonSpecialtyRowN[] {
  const bySpecByScenario = results.map((r) => new Map(r.bySpecialty.map((row) => [row.specialty, row])))
  const allSpecialties = new Set<string>()
  bySpecByScenario.forEach((m) => m.forEach((_, spec) => allSpecialties.add(spec)))
  const sorted = [...allSpecialties].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  const rows: OptimizerComparisonSpecialtyRowN[] = []

  for (const specialty of sorted) {
    const scenarioIdsWithSpec: string[] = []
    const recommendedCFByScenario: Record<string, number | null> = {}
    const spendImpactByScenario: Record<string, number | null> = {}
    const meanTCCPercentileByScenario: Record<string, number | null> = {}
    const meanModeledTCCPercentileByScenario: Record<string, number | null> = {}
    const meanWRVUPercentileByScenario: Record<string, number | null> = {}

    scenarioIds.forEach((id, i) => {
      const row = bySpecByScenario[i]?.get(specialty)
      if (row) scenarioIdsWithSpec.push(id)
      recommendedCFByScenario[id] = row?.recommendedCF ?? null
      spendImpactByScenario[id] = row?.spendImpactRaw ?? null
      meanTCCPercentileByScenario[id] = row?.keyMetrics?.compPercentile ?? null
      meanWRVUPercentileByScenario[id] = row?.keyMetrics?.prodPercentile ?? null
      const included = row?.providerContexts?.filter((c) => c.included) ?? []
      meanModeledTCCPercentileByScenario[id] =
        included.length > 0
          ? included.reduce((s, c) => s + (c.modeledTCC_pctile ?? 0), 0) / included.length
          : null
    })

    rows.push({
      specialty,
      scenarioIds: scenarioIdsWithSpec,
      recommendedCFByScenario,
      spendImpactByScenario,
      meanTCCPercentileByScenario,
      meanModeledTCCPercentileByScenario,
      meanWRVUPercentileByScenario,
    })
  }
  return rows
}

function buildNarrativeSummaryN(
  scenarios: ScenarioInfo[],
  _assumptionsPerScenario: OptimizerAssumptionsPerScenario[],
  rollup: OptimizerComparisonRollupN
): string[] {
  if (scenarios.length === 2) {
    const [a, b] = scenarios
    const nameA = a.name
    const nameB = b.name
    const idA = a.id
    const idB = b.id
    const impactA = rollup.totalSpendImpactByScenario[idA] ?? 0
    const impactB = rollup.totalSpendImpactByScenario[idB] ?? 0
    const deltaSpend = impactB - impactA
    const deltaSpendPct = impactA !== 0 ? (deltaSpend / Math.abs(impactA)) * 100 : null
    const parts: string[] = []
    if (deltaSpend !== 0) {
      const direction = deltaSpend > 0 ? 'increases' : 'reduces'
      const pctStr =
        deltaSpendPct != null
          ? ` (${deltaSpendPct > 0 ? '+' : ''}${deltaSpendPct.toFixed(1)}% vs ${nameA})`
          : ''
      parts.push(
        `${nameB} ${direction} total modeled incentive spend by $${Math.abs(deltaSpend).toLocaleString('en-US', { maximumFractionDigits: 0 })} compared to ${nameA}${pctStr}. This is the budget impact of the recommended conversion factor changes.`
      )
    } else {
      parts.push('Total modeled incentive spend is the same in both scenarios.')
    }
    const meanWRVUA = rollup.meanWRVUPercentileByScenario[idA] ?? 0
    const meanWRVUB = rollup.meanWRVUPercentileByScenario[idB] ?? 0
    const meanTCCA = rollup.meanTCCPercentileByScenario[idA] ?? 0
    const meanTCCB = rollup.meanTCCPercentileByScenario[idB] ?? 0
    if (Math.abs(meanWRVUB - meanWRVUA) > 0.5 || Math.abs(meanTCCB - meanTCCA) > 0.5) {
      const wrvuNote =
        Math.abs(meanWRVUB - meanWRVUA) > 0.5
          ? ` Mean wRVU percentile is ${meanWRVUB.toFixed(1)} in ${nameB} vs ${meanWRVUA.toFixed(1)} in ${nameA}.`
          : ''
      const tccNote =
        Math.abs(meanTCCB - meanTCCA) > 0.5
          ? ` Mean TCC percentile is ${meanTCCB.toFixed(1)} in ${nameB} vs ${meanTCCA.toFixed(1)} in ${nameA}.`
          : ''
      parts.push(`Pay vs productivity positioning differs between scenarios.${wrvuNote}${tccNote}`)
    }
    const alignA = rollup.countMeetingAlignmentTargetByScenario[idA] ?? 0
    const alignB = rollup.countMeetingAlignmentTargetByScenario[idB] ?? 0
    if (alignA !== alignB) {
      parts.push(`Specialties meeting alignment target: ${nameA} ${alignA}, ${nameB} ${alignB}.`)
    }
    const cfA = rollup.countCFAbovePolicyByScenario[idA] ?? 0
    const cfB = rollup.countCFAbovePolicyByScenario[idB] ?? 0
    const effA = rollup.countEffectiveRateAbove90ByScenario[idA] ?? 0
    const effB = rollup.countEffectiveRateAbove90ByScenario[idB] ?? 0
    if (cfA !== cfB || effA !== effB) {
      parts.push(
        `Governance: CF above policy — ${nameA} ${cfA}, ${nameB} ${cfB}. Effective rate >90 — ${nameA} ${effA}, ${nameB} ${effB}.`
      )
    }
    return parts.length > 0 ? parts : ['Both scenarios have the same roll-up metrics and scope.']
  }

  // N > 2: short summary
  const names = scenarios.map((s) => s.name).join(', ')
  const spendValues = scenarios
    .map((s) => `${s.name}: $${(rollup.totalSpendImpactByScenario[s.id] ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
    .join('; ')
  return [
    `Comparing ${scenarios.length} scenarios: ${names}.`,
    `Total spend impact: ${spendValues}.`,
    'Use the roll-up table and drill-downs to compare metrics by scenario.',
  ]
}

/**
 * Compare 2–4 saved optimizer configs. All must have lastRunResult.
 * Returns the full N-scenario comparison.
 */
export function compareOptimizerScenariosN(
  configs: SavedOptimizerConfig[],
  baselineScenarioId?: string
): OptimizerScenarioComparisonN {
  const n = Math.min(Math.max(2, configs.length), MAX_COMPARE_SCENARIOS)
  const configsSlice = configs.slice(0, n)
  const scenarios: ScenarioInfo[] = configsSlice.map((c) => ({ id: c.id, name: c.name }))
  const results = configsSlice.map((c) => c.snapshot.lastRunResult!)
  const scenarioIds = scenarios.map((s) => s.id)

  const assumptionsPerScenario = buildAssumptionsPerScenarioN(configsSlice)
  const rollup = buildRollupN(results, scenarioIds)
  const bySpecialty = buildBySpecialtyRowsN(results, scenarioIds)
  const narrativeSummary = buildNarrativeSummaryN(scenarios, assumptionsPerScenario, rollup)

  return {
    scenarios,
    baselineScenarioId,
    assumptionsPerScenario,
    rollup,
    bySpecialty,
    narrativeSummary,
  }
}

/**
 * Compare two saved optimizer configs. Both must have lastRunResult.
 * Thin wrapper over compareOptimizerScenariosN([configA, configB]).
 */
export function compareOptimizerScenarios(
  configA: SavedOptimizerConfig,
  configB: SavedOptimizerConfig
): OptimizerScenarioComparisonN {
  return compareOptimizerScenariosN([configA, configB])
}
