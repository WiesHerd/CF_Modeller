/**
 * Export Target Optimizer scenario comparison as a single-sheet Excel file
 * with roll-up metrics and by-specialty table (2–4 scenarios).
 */

import * as XLSX from 'xlsx'
import type { ProductivityTargetScenarioComparisonN } from '@/types/productivity-target'
import { formatCurrency as _formatCurrency } from '@/utils/format'

function formatCurrency(value: number): string {
  return _formatCurrency(value, { decimals: 0 })
}

function buildReportRows(
  comparison: ProductivityTargetScenarioComparisonN,
  scenarioNames: string[],
  generatedDate: string
): (string | number)[][] {
  const { scenarios, rollup, bySpecialty } = comparison
  const n = scenarios.length
  const names = scenarioNames.length >= n ? scenarioNames.slice(0, n) : scenarios.map((s) => s.name)

  const rows: (string | number)[][] = []

  // ----- Report header -----
  rows.push(['Target Optimizer — Scenario Comparison Report', ''])
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

  // ----- Roll-up metrics -----
  const metricHeader = ['Metric', ...names]
  rows.push(['Roll-up metrics', ...Array(metricHeader.length - 1).fill('')])
  rows.push(metricHeader)

  rows.push([
    'Target percentile',
    ...scenarios.map((s) => {
      const pct = rollup.targetPercentileByScenario[s.id]
      return pct != null ? `${pct}th` : '—'
    }),
  ])
  rows.push([
    'Target approach',
    ...scenarios.map((s) => rollup.targetApproachByScenario[s.id] ?? '—'),
  ])
  rows.push([
    'Total planning incentive',
    ...scenarios.map((s) => formatCurrency(rollup.totalPlanningIncentiveByScenario[s.id] ?? 0)),
  ])
  rows.push([
    'Mean % to target',
    ...scenarios.map((s) =>
      (rollup.meanPercentToTargetByScenario[s.id] ?? 0).toFixed(1).concat('%')
    ),
  ])
  rows.push([
    'Providers below 80%',
    ...scenarios.map((s) => String(rollup.below80ByScenario[s.id] ?? 0)),
  ])
  rows.push([
    'Providers 80–99%',
    ...scenarios.map((s) => String(rollup.eightyTo99ByScenario[s.id] ?? 0)),
  ])
  rows.push([
    'Providers 100–119%',
    ...scenarios.map((s) => String(rollup.hundredTo119ByScenario[s.id] ?? 0)),
  ])
  rows.push([
    'Providers at or above 120%',
    ...scenarios.map((s) => String(rollup.atOrAbove120ByScenario[s.id] ?? 0)),
  ])
  rows.push([''])

  // ----- By specialty -----
  const bySpecHeaders = ['Specialty', 'Presence']
  scenarios.forEach((s) => {
    bySpecHeaders.push(`Group target (${s.name})`)
  })
  scenarios.forEach((s) => {
    bySpecHeaders.push(`Incentive (${s.name})`)
  })
  scenarios.forEach((s) => {
    bySpecHeaders.push(`Mean % to target (${s.name})`)
  })
  rows.push(['By specialty', ...Array(bySpecHeaders.length - 1).fill('')])
  rows.push(bySpecHeaders)

  for (const row of bySpecialty) {
    const presenceLabel =
      row.scenarioIds.length === n
        ? 'All'
        : scenarios.filter((s) => row.scenarioIds.includes(s.id)).map((s) => s.name).join(', ')
    const r: (string | number)[] = [
      row.specialty,
      presenceLabel,
      ...scenarios.map((s) =>
        row.groupTargetWRVUByScenario[s.id] != null
          ? row.groupTargetWRVUByScenario[s.id]!.toFixed(0)
          : '—'
      ),
      ...scenarios.map((s) =>
        row.planningIncentiveByScenario[s.id] != null
          ? formatCurrency(row.planningIncentiveByScenario[s.id]!)
          : '—'
      ),
      ...scenarios.map((s) =>
        row.meanPercentToTargetByScenario[s.id] != null
          ? `${row.meanPercentToTargetByScenario[s.id]!.toFixed(1)}%`
          : '—'
      ),
    ]
    rows.push(r)
  }

  return rows
}

function getReportColWidths(n: number): { wch: number }[] {
  const widths = [{ wch: 28 }, { wch: 12 }]
  for (let i = 0; i < n * 3 + 2; i++) {
    widths.push({ wch: 14 })
  }
  return widths
}

export function exportTargetComparisonToExcel(
  comparison: ProductivityTargetScenarioComparisonN,
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
  XLSX.utils.book_append_sheet(wb, ws, 'Target Comparison')
  XLSX.writeFile(
    wb,
    `target-scenario-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`
  )
}
