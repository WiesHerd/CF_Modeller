/**
 * Export scenario comparison as a single-sheet, report-style Excel file
 * with clear sections, formatted numbers, and readable column widths.
 */

import * as XLSX from 'xlsx'
import type {
  BudgetConstraint,
  OptimizationObjective,
  OptimizerScenarioComparison,
} from '@/types/optimizer'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)
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

function formatBudgetConstraint(b: BudgetConstraint): string {
  if (b.kind === 'none') return 'None'
  if (b.kind === 'neutral') return 'Neutral'
  if (b.kind === 'cap_pct' && b.capPct != null) return `Cap ${b.capPct}%`
  if (b.kind === 'cap_dollars' && b.capDollars != null) return `Cap ${formatCurrency(b.capDollars)}`
  return b.kind
}

/** Build a single-sheet report (array of arrays) for the comparison. */
function buildReportRows(
  comparison: OptimizerScenarioComparison,
  nameA: string,
  nameB: string,
  generatedDate: string
): (string | number)[][] {
  const { rollup, assumptions, bySpecialty, narrativeSummary } = comparison
  const bullets = Array.isArray(narrativeSummary) ? narrativeSummary : [narrativeSummary]

  const rows: (string | number)[][] = []

  // ----- Report header -----
  rows.push(['Scenario Comparison Report', ''])
  rows.push(['Generated', generatedDate])
  rows.push([''])
  rows.push(['Confidential — compensation planning', ''])
  rows.push([''])

  // ----- Scenarios -----
  rows.push(['Scenarios', ''])
  rows.push(['Scenario A', nameA])
  rows.push(['Scenario B', nameB])
  rows.push([''])

  // ----- Summary -----
  rows.push(['Summary', ''])
  for (const line of bullets) {
    rows.push([line, ''])
  }
  rows.push([''])

  // ----- Roll-up metrics -----
  rows.push(['Roll-up metrics', '', '', ''])
  rows.push(['Metric', nameA, nameB, 'Change'])
  const rollupPairs: [string, string, string, string][] = [
    ['Total spend impact', formatCurrency(rollup.totalSpendImpactA), formatCurrency(rollup.totalSpendImpactB), rollup.deltaSpendImpact !== 0 ? formatCurrency(rollup.deltaSpendImpact) + (rollup.deltaSpendImpactPct != null ? ` (${rollup.deltaSpendImpactPct > 0 ? '+' : ''}${rollup.deltaSpendImpactPct.toFixed(1)}%)` : '') : '—'],
    ['Work RVU incentive (modeled)', formatCurrency(rollup.totalIncentiveA), formatCurrency(rollup.totalIncentiveB), rollup.deltaIncentive !== 0 ? formatCurrency(rollup.deltaIncentive) : '—'],
    ['Mean TCC percentile', formatPercentile(rollup.meanTCCPercentileA), formatPercentile(rollup.meanTCCPercentileB), '—'],
    ['Mean wRVU percentile', formatPercentile(rollup.meanWRVUPercentileA), formatPercentile(rollup.meanWRVUPercentileB), '—'],
    ['Specialties aligned', String(rollup.countMeetingAlignmentTargetA), String(rollup.countMeetingAlignmentTargetB), '—'],
    ['CF above policy', String(rollup.countCFAbovePolicyA), String(rollup.countCFAbovePolicyB), '—'],
    ['Effective rate >90th', String(rollup.countEffectiveRateAbove90A), String(rollup.countEffectiveRateAbove90B), '—'],
  ]
  for (const r of rollupPairs) {
    rows.push(r)
  }
  rows.push([''])

  // ----- Assumptions -----
  rows.push(['Assumptions', '', ''])
  rows.push(['Setting', nameA, nameB])
  rows.push(['Productivity gain (wRVU growth %)', assumptions.wRVUGrowthFactorPctA != null ? `${assumptions.wRVUGrowthFactorPctA}%` : '—', assumptions.wRVUGrowthFactorPctB != null ? `${assumptions.wRVUGrowthFactorPctB}%` : '—'])
  rows.push(['Objective', formatObjective(assumptions.objectiveA), formatObjective(assumptions.objectiveB)])
  rows.push(['Budget constraint', formatBudgetConstraint(assumptions.budgetConstraintA), formatBudgetConstraint(assumptions.budgetConstraintB)])
  rows.push(['Providers included', String(assumptions.providersIncludedA), String(assumptions.providersIncludedB)])
  rows.push(['Providers excluded', String(assumptions.providersExcludedA), String(assumptions.providersExcludedB)])
  rows.push(['Hard cap (TCC %ile)', String(assumptions.governanceA.hardCapPercentile), String(assumptions.governanceB.hardCapPercentile)])
  rows.push([''])

  // ----- By specialty -----
  rows.push(['By specialty', '', '', '', '', '', '', '', '', ''])
  rows.push([
    'Specialty',
    'Presence',
    `CF (${nameA})`,
    `CF (${nameB})`,
    'Δ CF %',
    `Spend (${nameA})`,
    `Spend (${nameB})`,
    'Δ Spend',
    `TCC %ile (${nameA})`,
    `TCC %ile (${nameB})`,
  ])
  for (const row of bySpecialty) {
    const presence = row.presence === 'both' ? 'Both' : row.presence === 'a_only' ? 'A only' : 'B only'
    rows.push([
      row.specialty,
      presence,
      row.recommendedCFA != null ? row.recommendedCFA.toFixed(2) : '—',
      row.recommendedCFB != null ? row.recommendedCFB.toFixed(2) : '—',
      row.deltaCFPct != null ? `${row.deltaCFPct >= 0 ? '+' : ''}${row.deltaCFPct.toFixed(1)}%` : '—',
      row.spendImpactA != null ? formatCurrency(row.spendImpactA) : '—',
      row.spendImpactB != null ? formatCurrency(row.spendImpactB) : '—',
      row.deltaSpendImpact != null ? formatCurrency(row.deltaSpendImpact) : '—',
      row.meanTCCPercentileA != null ? formatPercentile(row.meanTCCPercentileA) : '—',
      row.meanTCCPercentileB != null ? formatPercentile(row.meanTCCPercentileB) : '—',
    ])
  }

  return rows
}

/** Column widths (in characters) for the report sheet. */
const REPORT_COL_WIDTHS = [
  { wch: 32 }, // col A: labels / specialty
  { wch: 28 }, // col B: scenario A / value
  { wch: 28 }, // col C: scenario B / value
  { wch: 20 }, // col D: change
  { wch: 16 }, // col E–J: by-specialty numeric
  { wch: 16 },
  { wch: 16 },
  { wch: 16 },
  { wch: 16 },
  { wch: 16 },
]

export function exportComparisonToExcel(
  comparison: OptimizerScenarioComparison,
  nameA: string,
  nameB: string
): void {
  const generatedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const data = buildReportRows(comparison, nameA, nameB, generatedDate)
  const ws = XLSX.utils.aoa_to_sheet(data)

  ws['!cols'] = REPORT_COL_WIDTHS

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison Report')
  XLSX.writeFile(wb, `scenario-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
