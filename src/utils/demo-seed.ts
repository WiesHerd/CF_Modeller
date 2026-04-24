/**
 * Demo-mode seed.
 *
 * When the app is opened with `?demo=1` in the URL, we pre-populate state with
 * the built-in sample CSVs so a visitor (e.g. from a portfolio link) lands
 * directly in the modelling workflow instead of the Upload step. Nothing about
 * this path writes to real uploads or persisted storage; it only hydrates the
 * in-memory `useAppState` store and sets session step/view to the Results
 * screen so the visual is representative of the modelling UI.
 *
 * No PII — sample CSVs contain fictional providers.
 */

import Papa from 'papaparse'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ColumnMapping, RawRow } from '@/types/upload'
import { PROVIDER_EXPECTED_COLUMNS } from '@/types/provider'
import { MARKET_EXPECTED_COLUMNS } from '@/types/market'
import {
  applyProviderMapping,
  applyMarketMapping,
  buildDefaultProviderMapping,
  buildDefaultMapping,
} from '@/lib/parse-file'
import { PROVIDER_SAMPLE_CSV, MARKET_SAMPLE_CSV } from '@/utils/sample-upload'

export interface DemoSeed {
  providerRows: ProviderRow[]
  providerMapping: ColumnMapping
  marketRows: MarketRow[]
  marketMapping: ColumnMapping
  defaultSpecialty: string | null
  defaultProviderId: string | null
}

function parseCsv(csv: string): { rows: RawRow[]; headers: string[] } {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  })
  const rows = parsed.data as RawRow[]
  const headers = rows.length ? Object.keys(rows[0]) : []
  return { rows, headers }
}

export function buildDemoSeed(): DemoSeed {
  const providerParsed = parseCsv(PROVIDER_SAMPLE_CSV)
  const providerMapping = buildDefaultProviderMapping(
    providerParsed.headers,
    PROVIDER_EXPECTED_COLUMNS
  )
  const { rows: providerRows } = applyProviderMapping(
    providerParsed.rows,
    providerParsed.headers,
    providerMapping
  )

  const marketParsed = parseCsv(MARKET_SAMPLE_CSV)
  const marketMapping = buildDefaultMapping(
    marketParsed.headers,
    MARKET_EXPECTED_COLUMNS
  )
  const { rows: marketRows } = applyMarketMapping(
    marketParsed.rows,
    marketParsed.headers,
    marketMapping
  )

  // Prefer a provider whose specialty matches a market row so the Results screen
  // has benchmark data to render; fall back to the first provider otherwise.
  const marketSpecialties = new Set(
    marketRows.map((r) => String(r.specialty ?? '').trim().toLowerCase())
  )
  const firstMatch = providerRows.find((p) =>
    marketSpecialties.has(String(p.specialty ?? '').trim().toLowerCase())
  )
  const seeded = firstMatch ?? providerRows[0] ?? null

  return {
    providerRows,
    providerMapping,
    marketRows,
    marketMapping,
    defaultSpecialty: seeded?.specialty != null ? String(seeded.specialty) : null,
    defaultProviderId: seeded?.providerId != null ? String(seeded.providerId) : null,
  }
}

/**
 * True when the current URL explicitly opts into demo mode. Used once on
 * app mount to auto-seed sample data.
 */
export function isDemoModeRequested(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('demo')
    return v === '1' || v === 'true' || v === 'yes'
  } catch {
    return false
  }
}
