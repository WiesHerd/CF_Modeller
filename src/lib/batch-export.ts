import * as XLSX from 'xlsx'
import type { BatchResults, BatchRowResult } from '@/types/batch'

const EMPTY = '—'

/**
 * Flatten one BatchRowResult to a wide record for CSV/XLSX (one row per provider per scenario).
 */
function rowToWideRecord(r: BatchRowResult): Record<string, string | number> {
  const res = r.results
  return {
    providerId: r.providerId,
    providerName: r.providerName,
    specialty: r.specialty,
    division: r.division,
    providerType: r.providerType ?? '',
    scenarioId: r.scenarioId,
    scenarioName: r.scenarioName,
    matchStatus: r.matchStatus,
    matchedMarketSpecialty: r.matchedMarketSpecialty ?? '',
    riskLevel: r.riskLevel,
    warnings: r.warnings.join('; '),
    currentTCC: res?.currentTCC ?? EMPTY,
    modeledTCC: res?.modeledTCC ?? EMPTY,
    currentCF: res?.currentCF ?? EMPTY,
    modeledCF: res?.modeledCF ?? EMPTY,
    workRVUs: res?.totalWRVUs ?? EMPTY,
    currentIncentive: res?.currentIncentive ?? EMPTY,
    annualIncentive: res?.annualIncentive ?? EMPTY,
    psqDollars: res?.psqDollars ?? EMPTY,
    tccPercentile: res?.tccPercentile ?? EMPTY,
    modeledTCCPercentile: res?.modeledTCCPercentile ?? EMPTY,
    wrvuPercentile: res?.wrvuPercentile ?? EMPTY,
    alignmentGapBaseline: res?.alignmentGapBaseline ?? EMPTY,
    alignmentGapModeled: res?.alignmentGapModeled ?? EMPTY,
    imputedTCCPerWRVURatioCurrent: res?.imputedTCCPerWRVURatioCurrent ?? EMPTY,
    imputedTCCPerWRVURatioModeled: res?.imputedTCCPerWRVURatioModeled ?? EMPTY,
    imputedTCCPerWRVUPercentileCurrent: res?.imputedTCCPerWRVUPercentileCurrent ?? EMPTY,
    imputedTCCPerWRVUPercentileModeled: res?.imputedTCCPerWRVUPercentileModeled ?? EMPTY,
    underpayRisk: res?.governanceFlags?.underpayRisk ? 'Y' : 'N',
    cfBelow25: res?.governanceFlags?.cfBelow25 ? 'Y' : 'N',
    modeledInPolicyBand: res?.governanceFlags?.modeledInPolicyBand ? 'Y' : 'N',
    fmvCheckSuggested: res?.governanceFlags?.fmvCheckSuggested ? 'Y' : 'N',
  }
}

/**
 * Export batch results to CSV (wide: one row per provider per scenario).
 */
export function exportBatchResultsCSV(results: BatchResults): string {
  const rows = results.rows.map(rowToWideRecord)
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]!)
  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h]
      if (v === undefined || v === null) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    })
    lines.push(values.join(','))
  }
  return lines.join('\n')
}

/**
 * Export batch results to XLSX (wide: one row per provider per scenario).
 */
export function exportBatchResultsXLSX(results: BatchResults): void {
  const rows = results.rows.map(rowToWideRecord)
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Batch Results')
  XLSX.writeFile(wb, `batch-results-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Trigger CSV download for batch results.
 */
export function downloadBatchResultsCSV(results: BatchResults, filename?: string): void {
  const csv = exportBatchResultsCSV(results)
  const name = filename ?? `batch-results-${new Date().toISOString().slice(0, 10)}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
