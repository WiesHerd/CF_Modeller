/**
 * Compare 2–4 saved Productivity Target (Target Optimizer) runs:
 * roll-up metrics and by-specialty table for planning incentive and % to target.
 */

import type {
  SavedProductivityTargetConfig,
  ProductivityTargetRunResult,
  ProductivityTargetSpecialtyResult,
  ProductivityTargetScenarioComparisonN,
  ProductivityTargetScenarioInfo,
  ProductivityTargetComparisonRollupN,
  ProductivityTargetComparisonSpecialtyRowN,
} from '@/types/productivity-target'
import { MAX_COMPARE_TARGET_SCENARIOS } from '@/types/productivity-target'

/** Returns true if the config has run results and can be used in comparison. */
export function canCompareProductivityTargetConfig(
  config: SavedProductivityTargetConfig
): boolean {
  return config?.snapshot?.lastRunResult != null
}

function targetApproachLabel(approach: string): string {
  return approach === 'wrvu_percentile' ? 'wRVU percentile' : approach === 'pay_per_wrvu' ? 'Manual wRVU (at 1.0 cFTE)' : approach
}

function buildRollupN(
  configs: SavedProductivityTargetConfig[],
  results: ProductivityTargetRunResult[],
  scenarioIds: string[]
): ProductivityTargetComparisonRollupN {
  const targetPercentileByScenario: Record<string, number> = {}
  const targetApproachByScenario: Record<string, string> = {}
  const totalPlanningIncentiveByScenario: Record<string, number> = {}
  const meanPercentToTargetByScenario: Record<string, number> = {}
  const below80ByScenario: Record<string, number> = {}
  const eightyTo99ByScenario: Record<string, number> = {}
  const hundredTo119ByScenario: Record<string, number> = {}
  const atOrAbove120ByScenario: Record<string, number> = {}

  for (let i = 0; i < results.length; i++) {
    const config = configs[i]
    const result = results[i]
    const scenarioId = scenarioIds[i]
    const settings = config?.snapshot?.settings
    targetPercentileByScenario[scenarioId] = settings?.targetPercentile ?? 0
    targetApproachByScenario[scenarioId] = settings?.targetApproach
      ? targetApproachLabel(settings.targetApproach)
      : '—'
    let totalIncentive = 0
    let sumPercentToTarget = 0
    let providerCount = 0
    let below80 = 0
    let eightyTo99 = 0
    let hundredTo119 = 0
    let atOrAbove120 = 0

    for (const row of result.bySpecialty) {
      totalIncentive += row.totalPlanningIncentiveDollars ?? 0
      below80 += row.summary.bandCounts.below80
      eightyTo99 += row.summary.bandCounts.eightyTo99
      hundredTo119 += row.summary.bandCounts.hundredTo119
      atOrAbove120 += row.summary.bandCounts.atOrAbove120
      for (const p of row.providers) {
        sumPercentToTarget += p.percentToTarget
        providerCount += 1
      }
    }

    totalPlanningIncentiveByScenario[scenarioId] = totalIncentive
    meanPercentToTargetByScenario[scenarioId] =
      providerCount > 0 ? sumPercentToTarget / providerCount : 0
    below80ByScenario[scenarioId] = below80
    eightyTo99ByScenario[scenarioId] = eightyTo99
    hundredTo119ByScenario[scenarioId] = hundredTo119
    atOrAbove120ByScenario[scenarioId] = atOrAbove120
  }

  return {
    targetPercentileByScenario,
    targetApproachByScenario,
    totalPlanningIncentiveByScenario,
    meanPercentToTargetByScenario,
    below80ByScenario,
    eightyTo99ByScenario,
    hundredTo119ByScenario,
    atOrAbove120ByScenario,
  }
}

function buildBySpecialtyRowsN(
  results: ProductivityTargetRunResult[],
  scenarioIds: string[]
): ProductivityTargetComparisonSpecialtyRowN[] {
  const allSpecialties = new Set<string>()
  for (const result of results) {
    for (const row of result.bySpecialty) {
      allSpecialties.add(row.specialty)
    }
  }

  const bySpecialtyByScenario = new Map<string, Map<string, ProductivityTargetSpecialtyResult>>()
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const scenarioId = scenarioIds[i]
    for (const row of result.bySpecialty) {
      let perScenario = bySpecialtyByScenario.get(row.specialty)
      if (!perScenario) {
        perScenario = new Map()
        bySpecialtyByScenario.set(row.specialty, perScenario)
      }
      perScenario.set(scenarioId, row)
    }
  }

  const rows: ProductivityTargetComparisonSpecialtyRowN[] = []
  for (const specialty of [...allSpecialties].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))) {
    const perScenario = bySpecialtyByScenario.get(specialty) ?? new Map()
    const scenarioIdsPresent = scenarioIds.filter((id) => perScenario.has(id))

    const groupTargetWRVUByScenario: Record<string, number | null> = {}
    const planningIncentiveByScenario: Record<string, number | null> = {}
    const meanPercentToTargetByScenario: Record<string, number | null> = {}
    const below80ByScenario: Record<string, number> = {}
    const eightyTo99ByScenario: Record<string, number> = {}
    const hundredTo119ByScenario: Record<string, number> = {}
    const atOrAbove120ByScenario: Record<string, number> = {}

    for (const scenarioId of scenarioIds) {
      const row = perScenario.get(scenarioId)
      if (row) {
        groupTargetWRVUByScenario[scenarioId] = row.groupTargetWRVU_1cFTE
        planningIncentiveByScenario[scenarioId] = row.totalPlanningIncentiveDollars
        meanPercentToTargetByScenario[scenarioId] = row.summary.meanPercentToTarget
        below80ByScenario[scenarioId] = row.summary.bandCounts.below80
        eightyTo99ByScenario[scenarioId] = row.summary.bandCounts.eightyTo99
        hundredTo119ByScenario[scenarioId] = row.summary.bandCounts.hundredTo119
        atOrAbove120ByScenario[scenarioId] = row.summary.bandCounts.atOrAbove120
      } else {
        groupTargetWRVUByScenario[scenarioId] = null
        planningIncentiveByScenario[scenarioId] = null
        meanPercentToTargetByScenario[scenarioId] = null
        below80ByScenario[scenarioId] = 0
        eightyTo99ByScenario[scenarioId] = 0
        hundredTo119ByScenario[scenarioId] = 0
        atOrAbove120ByScenario[scenarioId] = 0
      }
    }

    rows.push({
      specialty,
      scenarioIds: scenarioIdsPresent,
      groupTargetWRVUByScenario,
      planningIncentiveByScenario,
      meanPercentToTargetByScenario,
      below80ByScenario,
      eightyTo99ByScenario,
      hundredTo119ByScenario,
      atOrAbove120ByScenario,
    })
  }

  return rows
}

/**
 * Compare 2–4 saved target configs. All must have lastRunResult.
 * Returns the full N-scenario comparison.
 */
export function compareProductivityTargetScenariosN(
  configs: SavedProductivityTargetConfig[]
): ProductivityTargetScenarioComparisonN {
  const n = Math.min(Math.max(2, configs.length), MAX_COMPARE_TARGET_SCENARIOS)
  const configsSlice = configs.slice(0, n)
  const scenarios: ProductivityTargetScenarioInfo[] = configsSlice.map((c) => ({
    id: c.id,
    name: c.name,
  }))
  const results = configsSlice.map((c) => c.snapshot.lastRunResult!)
  const scenarioIds = scenarios.map((s) => s.id)

  const rollup = buildRollupN(configsSlice, results, scenarioIds)
  const bySpecialty = buildBySpecialtyRowsN(results, scenarioIds)

  return {
    scenarios,
    rollup,
    bySpecialty,
  }
}
