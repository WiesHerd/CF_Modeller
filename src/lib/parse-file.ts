import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { RawRow } from '@/types/upload'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import { PROVIDER_EXPECTED_COLUMNS } from '@/types/provider'
import { MARKET_EXPECTED_COLUMNS } from '@/types/market'
import type { ColumnMapping } from '@/types/upload'

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsText(file, 'utf-8')
  })
}

/**
 * Parse CSV or XLSX file to raw rows and headers.
 */
export async function parseFile(
  file: File
): Promise<{ rows: RawRow[]; headers: string[] }> {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await readFileAsArrayBuffer(file)
    const wb = XLSX.read(buf, { type: 'array' })
    const firstSheet = wb.SheetNames[0]
    if (!firstSheet) throw new Error('Workbook has no sheets')
    const sheet = wb.Sheets[firstSheet]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
    })
    if (data.length === 0) throw new Error('Sheet is empty')
    const headers = (data[0] as string[]).map((h) => String(h ?? '').trim())
    const rows: RawRow[] = (data as string[][]).slice(1).map((row) => {
      const obj: RawRow = {}
      headers.forEach((h, i) => {
        obj[h] = row[i] != null ? String(row[i]) : ''
      })
      return obj
    })
    return { rows, headers }
  }

  const text = await readFileAsText(file)
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    const msg = parsed.errors.map((e) => e.message).join('; ')
    throw new Error(`CSV parse error: ${msg}`)
  }
  const rows = parsed.data as RawRow[]
  const headers = rows.length ? Object.keys(rows[0]) : []
  return { rows, headers }
}

/**
 * Parse a string to a number. Tolerates commas, spaces, and trailing junk (e.g. "1 -" from Excel).
 */
function toNum(v: string): number {
  if (v == null || v === '') return 0
  const s = String(v).replace(/,/g, '').trim()
  // Allow leading number then ignore rest (e.g. "1 -" or "0.8 something")
  const match = s.match(/^-?\d*\.?\d+/)
  const n = match ? Number(match[0]) : Number(s)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Apply mapping and coerce to ProviderRow[].
 */
export function applyProviderMapping(
  rows: RawRow[],
  headers: string[],
  mapping: ColumnMapping
): { rows: ProviderRow[]; errors: string[] } {
  const errors: string[] = []
  const out: ProviderRow[] = []
  const required: (keyof ProviderRow)[] = ['providerName', 'baseSalary']
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const row: ProviderRow = {}
    for (const key of PROVIDER_EXPECTED_COLUMNS) {
      const source = mapping[key] ?? (headers.includes(key) ? key : '')
      const val = source ? (raw[source] != null ? String(raw[source]) : '') : ''
      if (val === '') continue
      if (
        [
          'totalFTE',
          'clinicalFTE',
          'adminFTE',
          'researchFTE',
          'teachingFTE',
          'baseSalary',
          'clinicalFTESalary',
          'currentTCC',
          'qualityPayments',
          'otherIncentives',
          'workRVUs',
          'outsideWRVUs',
          'currentCF',
          'currentThreshold',
          'nonClinicalPay',
        ].includes(key)
      ) {
        ;(row as Record<string, number>)[key] = toNum(val)
      } else {
        if (key === 'productivityModel') {
          const v = val.trim().toLowerCase()
          ;(row as Record<string, string>)[key] = v === 'prod' ? 'productivity' : v === 'base' ? 'base' : val.trim()
        } else {
          ;(row as Record<string, string>)[key] = val
        }
      }
    }
    // Total wRVUs = work RVUs + other (outside) wRVUs; not a file column
    if (row.workRVUs != null || row.outsideWRVUs != null) {
      row.totalWRVUs = (row.workRVUs ?? 0) + (row.outsideWRVUs ?? 0)
    }
    // Selection key: use provider name when no ID in file
    if (row.providerName != null && row.providerName !== '' && row.providerId == null) {
      row.providerId = String(row.providerName)
    }
    const missing = required.filter((k) => row[k] == null || row[k] === '')
    if (missing.length) {
      errors.push(`Row ${i + 2}: missing ${missing.join(', ')}`)
      continue
    }
    out.push(row)
  }
  return { rows: out, errors }
}

/**
 * Build default mapping: expected name -> header name (if header matches expected, case-insensitive).
 */
export function buildDefaultMapping(
  headers: string[],
  expected: readonly string[]
): ColumnMapping {
  const lower = new Map(headers.map((h) => [h.toLowerCase(), h]))
  const mapping: ColumnMapping = {}
  for (const exp of expected) {
    const h = lower.get(exp.toLowerCase())
    if (h) mapping[exp] = h
  }
  return mapping
}

/** Aliases for provider file headers so "wRVUs", "Total FTE", "Quality payments", etc. map correctly. */
const PROVIDER_ALIASES: Record<string, string[]> = {
  workRVUs: ['workrvus', 'wrvus', 'work rvus'],
  productivityModel: ['productivitymodel', 'productivity', 'prod model'],
  totalFTE: ['totalfte', 'total fte', 'totalftes'],
  clinicalFTE: ['clinicalfte', 'clinical fte', 'clinicalftes'],
  adminFTE: ['adminfte', 'admin fte', 'adminftes'],
  researchFTE: ['researchfte', 'research fte', 'researchftes'],
  teachingFTE: ['teachingfte', 'teaching fte', 'teachingftes'],
  qualityPayments: ['qualitypayments', 'quality payments', 'currenttcc', 'current tcc'],
  otherIncentives: ['otherincentives', 'other incentives'],
}

/**
 * Build default provider mapping with aliases so columns like "wRVUs" and "Productivity" match.
 */
export function buildDefaultProviderMapping(
  headers: string[],
  expected: readonly string[]
): ColumnMapping {
  const base = buildDefaultMapping(headers, expected)
  const lowerHeaders = new Map(headers.map((h) => [h.toLowerCase().trim(), h]))
  for (const [exp, aliases] of Object.entries(PROVIDER_ALIASES)) {
    if (base[exp]) continue
    for (const alias of aliases) {
      const h = lowerHeaders.get(alias)
      if (h) {
        base[exp] = h
        break
      }
    }
    if (!base[exp]) {
      for (const [headerLower, header] of lowerHeaders) {
        if (exp === 'workRVUs' && headerLower.includes('wrvu') && !headerLower.includes('outside')) {
          base.workRVUs = header
          break
        }
        if (exp === 'productivityModel' && (headerLower.includes('productivity') || headerLower === 'prod')) {
          base.productivityModel = header
          break
        }
        if (exp === 'totalFTE' && headerLower.includes('total') && headerLower.includes('fte')) {
          base.totalFTE = header
          break
        }
        if (exp === 'clinicalFTE' && headerLower.includes('clinical') && headerLower.includes('fte')) {
          base.clinicalFTE = header
          break
        }
        if (exp === 'adminFTE' && headerLower.includes('admin') && headerLower.includes('fte')) {
          base.adminFTE = header
          break
        }
        if (exp === 'researchFTE' && headerLower.includes('research') && headerLower.includes('fte')) {
          base.researchFTE = header
          break
        }
        if (exp === 'teachingFTE' && headerLower.includes('teaching') && headerLower.includes('fte')) {
          base.teachingFTE = header
          break
        }
        if (exp === 'qualityPayments' && (headerLower.includes('quality') || headerLower.includes('currenttcc'))) {
          base.qualityPayments = header
          break
        }
        if (exp === 'otherIncentives' && headerLower.includes('other') && headerLower.includes('incentive')) {
          base.otherIncentives = header
          break
        }
      }
    }
  }
  return base
}

/**
 * Apply mapping and coerce to MarketRow[].
 */
export function applyMarketMapping(
  rows: RawRow[],
  headers: string[],
  mapping: ColumnMapping
): { rows: MarketRow[]; errors: string[] } {
  const errors: string[] = []
  const out: MarketRow[] = []
  const numericKeys = [
    'TCC_25', 'TCC_50', 'TCC_75', 'TCC_90',
    'WRVU_25', 'WRVU_50', 'WRVU_75', 'WRVU_90',
    'CF_25', 'CF_50', 'CF_75', 'CF_90',
  ]
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const row: Record<string, string | number> = { specialty: '' }
    for (const key of MARKET_EXPECTED_COLUMNS) {
      const source = mapping[key] ?? (headers.includes(key) ? key : '')
      const val = source ? (raw[source] != null ? String(raw[source]) : '') : ''
      if (numericKeys.includes(key)) {
        row[key] = toNum(val)
      } else if (val !== '') {
        row[key] = val
      }
    }
    if (!row.specialty) {
      errors.push(`Row ${i + 2}: missing specialty`)
    }
    out.push(row as unknown as MarketRow)
  }
  return { rows: out, errors }
}
