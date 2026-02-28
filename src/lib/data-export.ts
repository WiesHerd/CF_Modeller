import * as XLSX from 'xlsx'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import { PROVIDER_EXPECTED_COLUMNS } from '@/types/provider'
import { MARKET_EXPECTED_COLUMNS } from '@/types/market'

/** Column keys to export for provider data (identity first, then PROVIDER_EXPECTED_COLUMNS order). */
const PROVIDER_EXPORT_KEYS = [
  'providerId',
  ...PROVIDER_EXPECTED_COLUMNS,
  'totalWRVUs',
  'clinicalFTESalary',
  'currentThreshold',
] as const

function providerRowToRecord(row: ProviderRow): Record<string, string | number> {
  const rec: Record<string, string | number> = {}
  for (const key of PROVIDER_EXPORT_KEYS) {
    const v = (row as Record<string, unknown>)[key]
    if (v === undefined || v === null) {
      rec[key] = ''
    } else if (Array.isArray(v)) {
      rec[key] = JSON.stringify(v)
    } else {
      rec[key] = v as string | number
    }
  }
  return rec
}

function escapeCsvValue(v: string | number): string {
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Export provider rows to CSV string.
 */
export function exportProviderDataCSV(rows: ProviderRow[]): string {
  if (rows.length === 0) return ''
  const records = rows.map(providerRowToRecord)
  const headers = Object.keys(records[0]!)
  const lines = [headers.join(',')]
  for (const row of records) {
    const values = headers.map((h) => escapeCsvValue(row[h] ?? ''))
    lines.push(values.join(','))
  }
  return lines.join('\n')
}

/**
 * Trigger CSV download for provider data.
 */
export function downloadProviderDataCSV(rows: ProviderRow[], filename?: string): void {
  const csv = exportProviderDataCSV(rows)
  const name = filename ?? `provider-data-${new Date().toISOString().slice(0, 10)}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Trigger XLSX download for provider data.
 */
export function exportProviderDataXLSX(rows: ProviderRow[], filename?: string): void {
  const records = rows.map(providerRowToRecord)
  const ws = XLSX.utils.json_to_sheet(records.length > 0 ? records : [{}])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Providers')
  XLSX.writeFile(wb, filename ?? `provider-data-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Export market rows to CSV string.
 */
export function exportMarketDataCSV(rows: MarketRow[]): string {
  if (rows.length === 0) return ''
  const headers = MARKET_EXPECTED_COLUMNS as readonly string[]
  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((h) => escapeCsvValue((row as unknown as Record<string, string | number>)[h] ?? ''))
    lines.push(values.join(','))
  }
  return lines.join('\n')
}

/**
 * Trigger CSV download for market data.
 */
export function downloadMarketDataCSV(rows: MarketRow[], filename?: string): void {
  const csv = exportMarketDataCSV(rows)
  const name = filename ?? `market-data-${new Date().toISOString().slice(0, 10)}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Trigger XLSX download for market data.
 */
export function exportMarketDataXLSX(rows: MarketRow[], filename?: string): void {
  const rowsPlain = rows.map((r) => ({ ...r }))
  const ws = XLSX.utils.json_to_sheet(rowsPlain.length > 0 ? rowsPlain : [{}])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Market')
  XLSX.writeFile(wb, filename ?? `market-data-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
