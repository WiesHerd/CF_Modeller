/**
 * Export scenario comparison as a single-sheet, report-style Excel file
 * with clear sections, formatted numbers, and readable column widths.
 * Supports 2–4 scenarios (N-column layout).
 */

import * as XLSX from 'xlsx'
import type {
  OptimizationObjective,
  OptimizerScenarioComparisonN,
} from '@/types/optimizer'
import { formatBudgetConstraint } from '@/lib/optimizer-format'
import { formatCurrency as _formatCurrency } from '@/utils/format'

function formatCurrency(value: number): string {
  return _formatCurrency(value, { decimals: 0 })
}

function formatPercentile(p: number): string {
  if (p < 25) return `Below 25th (${p.toFixed(1)}th)`
  if (p > 90) return `Above 90th (${p.toFixed(1)}th)`
  return `${p.toFixed(1)}th`
}

function formatObjective(obj: OptimizationObjective): string {
  switch (obj.kind) {
    case 'align_percentile':
      return 'Align TCC to wRVU percentile'
    case 'target_fixed_percentile':
      return `Target fixed ${obj.targetPercentile}th percentile`
    case 'hybrid':
      return `Hybrid (align ${(obj.alignWeight * 100).toFixed(0)}% / target ${(obj.targetWeight * 100).toFixed(0)}% @ ${obj.targetPercentile}th)`
    default:
      return String((obj as { kind: string }).kind)
  }
}

/** Build a single-sheet report (array of arrays) for the N-scenario comparison. */
function buildReportRows(
  comparison: OptimizerScenarioComparisonN,
  scenarioNames: string[],
  generatedDate: string
): (string | number)[][] {
  const { scenarios, rollup, assumptionsPerScenario, bySpecialty, narrativeSummary } = comparison
  const n = scenarios.length
  const names = scenarioNames.length >= n ? scenarioNames.slice(0, n) : scenarios.map((s) => s.name)

  const rows: (string | number)[][] = []

  // ----- Report header -----
  rows.push(['Scenario Comparison Report', ''])
  rows.push(['Generated', generatedDate])
  rows.push([''])
  rows.push(['Confidential — compensation planning', ''])
  rows.push([''])

  // ----- Scenarios -----
  rows.push(['Scenarios', ''])
  scenarios.forEach((s, i) => {
    rows.push([`Scenario ${i + 1}`, s.name])
  })
  rows.push([''])

  // ----- Summary -----
  rows.push(['Summary', ''])
  for (const line of narrativeSummary) {
    rows.push([line, ''])
  }
  rows.push([''])

  // ----- Roll-up metrics -----
  const metricHeader = ['Metric', ...names]
  if (n === 2) metricHeader.push('Change')
  rows.push(['Roll-up metrics', ...Array(metricHeader.length - 1).fill('')])
  rows.push(metricHeader)

  const spend0 = rollup.totalSpendImpactByScenario[scenarios[0].id] ?? 0
  const spend1 = n >= 2 ? (rollup.totalSpendImpactByScenario[scenarios[1].id] ?? 0) : 0
  const deltaSpend = n === 2 ? spend1 - spend0 : 0
  const deltaSpendPct = n === 2 && spend0 !== 0 ? (deltaSpend / Math.abs(spend0)) * 100 : null
  const inc0 = rollup.totalIncentiveByScenario[scenarios[0].id] ?? 0
  const inc1 = n >= 2 ? (rollup.totalIncentiveByScenario[scenarios[1].id] ?? 0) : 0
  const deltaIncentive = n === 2 ? inc1 - inc0 : 0

  const rollupRow = (label: string, values: (string | number)[], change?: string) => {
    const row = [label, ...values]
    if (n === 2 && change !== undefined) row.push(change)
    rows.push(row)
  }

  rollupRow(
    'Total spend impact',
    scenarios.map((s) => formatCurrency(rollup.totalSpendImpactByScenario[s.id] ?? 0)),
    n === 2 ? (deltaSpend !== 0 ? formatCurrency(deltaSpend) + (deltaSpendPct != null ? ` (${deltaSpendPct > 0 ? '+' : ''}${deltaSpendPct.toFixed(1)}%)` : '') : '—') : undefined
  )
  rollupRow(
    'Work RVU incentive (modeled)',
    scenarios.map((s) => formatCurrency(rollup.totalIncentiveByScenario[s.id] ?? 0)),
    n === 2 ? (deltaIncentive !== 0 ? formatCurrency(deltaIncentive) : '—') : undefined
  )
  rollupRow(
    'Budget (cap)',
    assumptionsPerScenario.map((a) => formatBudgetConstraint(a.budgetConstraint))
  )
  rollupRow(
    'Incentive vs budget',
    scenarios.map((s) => {
      const a = assumptionsPerScenario.find((ap) => ap.scenarioId === s.id)
      const cap = a?.budgetConstraint?.kind === 'cap_dollars' && a.budgetConstraint.capDollars != null ? a.budgetConstraint.capDollars : null
      if (cap == null) return '—'
      const incentive = rollup.totalIncentiveByScenario[s.id] ?? 0
      const over = incentive - cap
      if (over > 0) return `Over by ${formatCurrency(over)}`
      if (over < 0) return `Under by ${formatCurrency(Math.abs(over))}`
      return 'Within budget'
    })
  )
  rollupRow(
    'Mean TCC percentile',
    scenarios.map((s) => formatPercentile(rollup.meanTCCPercentileByScenario[s.id] ?? 0))
  )
  rollupRow(
    'Mean wRVU percentile',
    scenarios.map((s) => formatPercentile(rollup.meanWRVUPercentileByScenario[s.id] ?? 0))
  )
  rollupRow(
    'Specialties aligned',
    scenarios.map((s) => String(rollup.countMeetingAlignmentTargetByScenario[s.id] ?? 0))
  )
  rollupRow(
    'CF above policy',
    scenarios.map((s) => String(rollup.countCFAbovePolicyByScenario[s.id] ?? 0))
  )
  rollupRow(
    'Effective rate >90th',
    scenarios.map((s) => String(rollup.countEffectiveRateAbove90ByScenario[s.id] ?? 0))
  )
  rows.push([''])

  // ----- Assumptions -----
  rows.push(['Assumptions', ...Array(Math.max(0, n - 1)).fill('')])
  rows.push(['Setting', ...names])
  rows.push(['Productivity gain (wRVU growth %)', ...assumptionsPerScenario.map((x) => (x.wRVUGrowthFactorPct != null ? `${x.wRVUGrowthFactorPct}%` : '—'))])
  rows.push(['Objective', ...assumptionsPerScenario.map((a) => formatObjective(a.optimizationObjective))])
  rows.push(['Budget constraint', ...assumptionsPerScenario.map((a) => formatBudgetConstraint(a.budgetConstraint))])
  rows.push(['Providers included', ...assumptionsPerScenario.map((a) => String(a.providersIncluded))])
  rows.push(['Providers excluded', ...assumptionsPerScenario.map((a) => String(a.providersExcluded))])
  rows.push(['Hard cap (TCC %ile)', ...assumptionsPerScenario.map((a) => String(a.governanceConfig.hardCapPercentile))])
  rows.push([''])

  // ----- By specialty -----
  const bySpecHeaders = ['Specialty', 'Presence']
  scenarios.forEach((s) => {
    bySpecHeaders.push(`CF (${s.name})`)
  })
  scenarios.forEach((s) => {
    bySpecHeaders.push(`Spend (${s.name})`)
  })
  scenarios.forEach((s) => {
    bySpecHeaders.push(`TCC %ile (${s.name})`)
  })
  rows.push(['By specialty', ...Array(bySpecHeaders.length - 1).fill('')])
  rows.push(bySpecHeaders)
  for (const row of bySpecialty) {
    const presenceLabel = row.scenarioIds.length === n ? 'All' : scenarios.filter((s) => row.scenarioIds.includes(s.id)).map((s) => s.name).join(', ')
    const r: (string | number)[] = [
      row.specialty,
      presenceLabel,
      ...scenarios.map((s) => (row.recommendedCFByScenario[s.id] != null ? row.recommendedCFByScenario[s.id]!.toFixed(2) : '—')),
      ...scenarios.map((s) => (row.spendImpactByScenario[s.id] != null ? formatCurrency(row.spendImpactByScenario[s.id]!) : '—')),
      ...scenarios.map((s) => (row.meanModeledTCCPercentileByScenario[s.id] != null ? formatPercentile(row.meanModeledTCCPercentileByScenario[s.id]!) : '—')),
    ]
    rows.push(r)
  }

  return rows
}

/** Column widths (in characters) for the report sheet. */
function getReportColWidths(n: number): { wch: number }[] {
  const widths = [{ wch: 32 }, { wch: 12 }]
  for (let i = 0; i < n * 3 + 2; i++) {
    widths.push({ wch: 16 })
  }
  return widths
}

export function exportComparisonToExcel(
  comparison: OptimizerScenarioComparisonN,
  scenarioNames: string[]
): void {
  const generatedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const data = buildReportRows(comparison, scenarioNames, generatedDate)
  const ws = XLSX.utils.aoa_to_sheet(data)

  ws['!cols'] = getReportColWidths(comparison.scenarios.length)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison Report')
  XLSX.writeFile(wb, `scenario-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
