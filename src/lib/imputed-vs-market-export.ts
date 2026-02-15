import * as XLSX from 'xlsx'
import type { ImputedVsMarketRow } from '@/lib/imputed-vs-market'
import { getGapInterpretation, GAP_INTERPRETATION_LABEL } from '@/features/optimizer/components/optimizer-constants'

/**
 * Flatten one ImputedVsMarketRow to a record for CSV/XLSX.
 */
function rowToRecord(r: ImputedVsMarketRow): Record<string, string | number> {
  const alignment = getGapInterpretation(r.avgTCCPercentile - r.avgWRVUPercentile)
  return {
    specialty: r.specialty,
    providerCount: r.providerCount,
    medianImputedDollarPerWRVU: r.medianImputedDollarPerWRVU,
    medianCurrentCFUsed: r.medianCurrentCFUsed,
    market25: r.market25,
    market50: r.market50,
    market75: r.market75,
    market90: r.market90,
    yourPercentile: r.yourPercentile,
    avgTCCPercentile: r.avgTCCPercentile,
    avgWRVUPercentile: r.avgWRVUPercentile,
    payVsProductivity: GAP_INTERPRETATION_LABEL[alignment],
    marketCF25: r.marketCF25,
    marketCF50: r.marketCF50,
    marketCF75: r.marketCF75,
    marketCF90: r.marketCF90,
  }
}

/**
 * Export market positioning rows to CSV.
 */
export function exportImputedVsMarketCSV(rows: ImputedVsMarketRow[]): string {
  if (rows.length === 0) return ''
  const records = rows.map(rowToRecord)
  const headers = Object.keys(records[0]!)
  const lines = [headers.join(',')]
  for (const row of records) {
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
 * Download market positioning data as CSV.
 */
export function downloadImputedVsMarketCSV(rows: ImputedVsMarketRow[], filename?: string): void {
  const csv = exportImputedVsMarketCSV(rows)
  const name = filename ?? `market-positioning-${new Date().toISOString().slice(0, 10)}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export market positioning rows to XLSX with human-readable column headers.
 */
export function exportImputedVsMarketXLSX(rows: ImputedVsMarketRow[]): void {
  const records = rows.map(rowToRecord)
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? records : [{}])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Market positioning')
  XLSX.writeFile(wb, `market-positioning-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
