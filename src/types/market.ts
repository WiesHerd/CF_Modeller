/**
 * Market survey row by specialty (and optional provider type/region).
 * Percentile points for TCC, WRVU, and CF.
 */
export interface MarketRow {
  specialty: string
  providerType?: string
  region?: string
  TCC_25: number
  TCC_50: number
  TCC_75: number
  TCC_90: number
  WRVU_25: number
  WRVU_50: number
  WRVU_75: number
  WRVU_90: number
  CF_25: number
  CF_50: number
  CF_75: number
  CF_90: number
}

/** Expected column names for market file (for mapping UI). */
export const MARKET_EXPECTED_COLUMNS = [
  'specialty',
  'providerType',
  'region',
  'TCC_25',
  'TCC_50',
  'TCC_75',
  'TCC_90',
  'WRVU_25',
  'WRVU_50',
  'WRVU_75',
  'WRVU_90',
  'CF_25',
  'CF_50',
  'CF_75',
  'CF_90',
] as const

export type MarketColumnKey = (typeof MARKET_EXPECTED_COLUMNS)[number]
