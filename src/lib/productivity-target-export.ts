/**
 * CSV export for Productivity Target results (provider-level).
 */

import type { ProductivityTargetRunResult, ProductivityTargetProviderResult } from '@/types/productivity-target'

function escapeCsvValue(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function providerToRecord(r: ProductivityTargetProviderResult, specialty: string): Record<string, string | number> {
  return {
    specialty,
    providerId: r.providerId,
    providerName: r.providerName ?? '',
    cFTE: r.cFTE,
    actualWRVUs: r.actualWRVUs,
    targetWRVU: r.targetWRVU,
    rampedTargetWRVU: r.rampedTargetWRVU,
    percentToTarget: Math.round(r.percentToTarget * 100) / 100,
    varianceWRVU: r.varianceWRVU,
    status: r.status,
    planningIncentiveDollars: r.planningIncentiveDollars ?? '',
  }
}

/**
 * Flatten run result to provider-level records for CSV.
 */
export function productivityTargetResultsToRecords(result: ProductivityTargetRunResult): Record<string, string | number>[] {
  const records: Record<string, string | number>[] = []
  for (const spec of result.bySpecialty) {
    for (const p of spec.providers) {
      records.push(providerToRecord(p, spec.specialty))
    }
  }
  return records
}

/**
 * Export Productivity Target results to CSV string.
 */
export function exportProductivityTargetCSV(result: ProductivityTargetRunResult): string {
  const records = productivityTargetResultsToRecords(result)
  if (records.length === 0) return ''
  const headers = Object.keys(records[0]!)
  const lines = [headers.join(',')]
  for (const row of records) {
    const values = headers.map((h) => escapeCsvValue(row[h]))
    lines.push(values.join(','))
  }
  return lines.join('\n')
}

/**
 * Download Productivity Target results as CSV file.
 */
export function downloadProductivityTargetCSV(result: ProductivityTargetRunResult, filename?: string): void {
  const csv = exportProductivityTargetCSV(result)
  const name = filename ?? `productivity-target-${new Date().toISOString().slice(0, 10)}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
