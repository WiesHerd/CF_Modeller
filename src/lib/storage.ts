import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ColumnMapping } from '@/types/upload'

const KEY_PROVIDERS = 'cf-modeler-providers'
const KEY_MARKET = 'cf-modeler-market'
const KEY_PROVIDER_MAPPING = 'cf-modeler-provider-mapping'
const KEY_MARKET_MAPPING = 'cf-modeler-market-mapping'

export function loadProviders(): ProviderRow[] {
  try {
    const s = localStorage.getItem(KEY_PROVIDERS)
    if (!s) return []
    const data = JSON.parse(s) as unknown
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveProviders(rows: ProviderRow[]): void {
  localStorage.setItem(KEY_PROVIDERS, JSON.stringify(rows))
}

export function loadMarket(): MarketRow[] {
  try {
    const s = localStorage.getItem(KEY_MARKET)
    if (!s) return []
    const data = JSON.parse(s) as unknown
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveMarket(rows: MarketRow[]): void {
  localStorage.setItem(KEY_MARKET, JSON.stringify(rows))
}

export function loadProviderMapping(): ColumnMapping | null {
  try {
    const s = localStorage.getItem(KEY_PROVIDER_MAPPING)
    if (!s) return null
    const data = JSON.parse(s) as unknown
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as ColumnMapping) : null
  } catch {
    return null
  }
}

export function saveProviderMapping(mapping: ColumnMapping): void {
  localStorage.setItem(KEY_PROVIDER_MAPPING, JSON.stringify(mapping))
}

export function loadMarketMapping(): ColumnMapping | null {
  try {
    const s = localStorage.getItem(KEY_MARKET_MAPPING)
    if (!s) return null
    const data = JSON.parse(s) as unknown
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as ColumnMapping) : null
  } catch {
    return null
  }
}

export function saveMarketMapping(mapping: ColumnMapping): void {
  localStorage.setItem(KEY_MARKET_MAPPING, JSON.stringify(mapping))
}
