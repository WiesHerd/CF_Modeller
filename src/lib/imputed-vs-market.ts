/**
 * Imputed vs market: by-specialty comparison of effective $/wRVU to market 25/50/75/90.
 * No optimizer; read-only view with percentile and market CF targets.
 */

import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { SynonymMap } from '@/types/batch'
import { matchMarketRow, normalizeSpecialtyKey } from '@/lib/batch'
import type { AdditionalTCCConfig } from '@/lib/tcc-components'
import {
  getClinicalFTE,
  getTotalWRVUs,
  getBaselineTCCForOptimizer,
  getBaselineTCCBreakdown,
  type OptimizerBaselineTCCConfig,
  type PSQConfig,
} from '@/lib/normalize-compensation'
import { imputedTCCPerWRVU } from '@/lib/compute'
import { inferPercentile } from '@/lib/interpolation'

function num(x: unknown): number {
  if (typeof x === 'number' && !Number.isNaN(x)) return x
  const n = Number(x)
  return Number.isNaN(n) ? 0 : n
}

function safeDiv(a: number, b: number, fallback: number): number {
  if (b == null || b === 0 || Number.isNaN(b)) return fallback
  const q = a / b
  return Number.isNaN(q) ? fallback : q
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export interface ImputedVsMarketConfig {
  includeQualityPayments: boolean
  includeWorkRVUIncentive: boolean
  includeOtherIncentives?: boolean
  /** Layered additional TCC (percent of base, dollar per FTE, flat). */
  additionalTCC?: AdditionalTCCConfig
  minBasisFTE?: number
  minWRVUPer1p0CFTE?: number
}

export const DEFAULT_IMPUTED_VS_MARKET_CONFIG: ImputedVsMarketConfig = {
  includeQualityPayments: true,
  includeWorkRVUIncentive: true,
  includeOtherIncentives: false,
  minBasisFTE: 0.5,
  minWRVUPer1p0CFTE: 1000,
}

export interface ImputedVsMarketRow {
  specialty: string
  providerCount: number
  medianImputedDollarPerWRVU: number
  /** Median of the current CF used per provider when computing baseline TCC (for work RVU incentive). */
  medianCurrentCFUsed: number
  market25: number
  market50: number
  market75: number
  market90: number
  yourPercentile: number
  yourPercentileBelowRange: boolean
  yourPercentileAboveRange: boolean
  /** Mean TCC percentile (baseline TCC per 1.0 cFTE vs market TCC curve). */
  avgTCCPercentile: number
  /** Mean wRVU percentile (wRVU per 1.0 cFTE vs market wRVU curve). */
  avgWRVUPercentile: number
  marketCF25: number
  marketCF50: number
  marketCF75: number
  marketCF90: number
}

/**
 * Compute imputed $/wRVU by specialty and compare to market 25/50/75/90.
 */
export function computeImputedVsMarketBySpecialty(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  synonymMap: SynonymMap = {},
  config: ImputedVsMarketConfig = DEFAULT_IMPUTED_VS_MARKET_CONFIG
): ImputedVsMarketRow[] {
  const minFTE = config.minBasisFTE ?? 0.5
  const minWRVU1p0 = config.minWRVUPer1p0CFTE ?? 1000
  const psqConfig: PSQConfig = { include: false, psqPercent: 0 }

  // Group providers by normalized specialty; collect imputed $/wRVU, current CF, and TCC/wRVU percentiles
  const bySpecialty = new Map<
    string,
    {
      rawSpecialty: string
      market: MarketRow
      imputedValues: number[]
      currentCFUsed: number[]
      tccPercentiles: number[]
      wrvuPercentiles: number[]
    }
  >()

  for (const provider of providerRows) {
    const match = matchMarketRow(provider, marketRows, synonymMap)
    const market = match.marketRow
    if (!market) continue

    const cFTE = getClinicalFTE(provider)
    if (cFTE < minFTE) continue

    const totalWRVUs = getTotalWRVUs(provider)
    const wRVU_1p0 = cFTE > 0 ? totalWRVUs / cFTE : 0
    if (wRVU_1p0 < minWRVU1p0 && wRVU_1p0 > 0) continue

    const rawSpecialty = (provider.specialty ?? '').trim()
    const specNorm = normalizeSpecialtyKey(rawSpecialty)
    if (!specNorm) continue

    const currentCF = num(provider.currentCF) || market.CF_50
    const baselineConfig: OptimizerBaselineTCCConfig = {
      psqConfig,
      includeQualityPayments: config.includeQualityPayments,
      includeWorkRVUIncentive: config.includeWorkRVUIncentive,
      includeOtherIncentives: config.includeOtherIncentives,
      currentCF,
      additionalTCC: config.additionalTCC,
    }
    const baselineTCC = getBaselineTCCForOptimizer(provider, baselineConfig)
    const totalFTE = num(provider.totalFTE) || 1
    const imputed = imputedTCCPerWRVU(baselineTCC, totalFTE, cFTE, totalWRVUs)
    if (!Number.isFinite(imputed) || imputed <= 0) continue

    const baselineTCC_1p0 = cFTE > 0 ? baselineTCC / cFTE : 0
    const tccPct = inferPercentile(
      baselineTCC_1p0,
      market.TCC_25,
      market.TCC_50,
      market.TCC_75,
      market.TCC_90
    ).percentile
    const wrvuPct = inferPercentile(
      wRVU_1p0,
      market.WRVU_25,
      market.WRVU_50,
      market.WRVU_75,
      market.WRVU_90
    ).percentile

    let entry = bySpecialty.get(specNorm)
    if (!entry) {
      entry = {
        rawSpecialty,
        market,
        imputedValues: [],
        currentCFUsed: [],
        tccPercentiles: [],
        wrvuPercentiles: [],
      }
      bySpecialty.set(specNorm, entry)
    }
    entry.imputedValues.push(imputed)
    entry.currentCFUsed.push(currentCF)
    entry.tccPercentiles.push(tccPct)
    entry.wrvuPercentiles.push(wrvuPct)
  }

  const result: ImputedVsMarketRow[] = []
  for (const [, entry] of bySpecialty) {
    if (entry.imputedValues.length === 0) continue

    const medianImputed = median(entry.imputedValues)
    const medianCurrentCF = median(entry.currentCFUsed)
    const m = entry.market
    const market25 = safeDiv(m.TCC_25, m.WRVU_25, 0)
    const market50 = safeDiv(m.TCC_50, m.WRVU_50, 0)
    const market75 = safeDiv(m.TCC_75, m.WRVU_75, 0)
    const market90 = safeDiv(m.TCC_90, m.WRVU_90, 0)

    const pctResult =
      market50 > 0
        ? inferPercentile(medianImputed, market25, market50, market75, market90)
        : { percentile: 0, belowRange: false, aboveRange: false }

    const avgTCCPercentile = mean(entry.tccPercentiles)
    const avgWRVUPercentile = mean(entry.wrvuPercentiles)

    result.push({
      specialty: (m.specialty ?? entry.rawSpecialty).trim() || entry.rawSpecialty,
      providerCount: entry.imputedValues.length,
      medianImputedDollarPerWRVU: medianImputed,
      medianCurrentCFUsed: medianCurrentCF,
      market25,
      market50,
      market75,
      market90,
      yourPercentile: pctResult.percentile,
      yourPercentileBelowRange: pctResult.belowRange ?? false,
      yourPercentileAboveRange: pctResult.aboveRange ?? false,
      avgTCCPercentile,
      avgWRVUPercentile,
      marketCF25: m.CF_25,
      marketCF50: m.CF_50,
      marketCF75: m.CF_75,
      marketCF90: m.CF_90,
    })
  }

  result.sort((a, b) => a.specialty.localeCompare(b.specialty, undefined, { sensitivity: 'base' }))
  return result
}

/** Provider-level detail for drawer drilldown (includes TCC build-up and percentiles). */
export interface ImputedVsMarketProviderDetail {
  providerId: string
  providerName: string
  division: string
  providerType: string
  cFTE: number
  totalWRVUs: number
  wRVU_1p0: number
  baselineTCC: number
  currentCFUsed: number
  imputedDollarPerWRVU: number
  /** TCC components for build-up display */
  clinicalBase: number
  psq: number
  quality: number
  workRVUIncentive: number
  otherIncentives: number
  /** Layered additional TCC (percent of base + dollar per FTE + flat). */
  additionalTCC?: number
  /** TCC percentile (baseline TCC per 1.0 cFTE vs market TCC curve). */
  tccPercentile: number
  tccPercentileBelowRange?: boolean
  tccPercentileAboveRange?: boolean
  /** wRVU percentile (wRVU per 1.0 cFTE vs market wRVU curve). */
  wrvuPercentile: number
  wrvuPercentileBelowRange?: boolean
  wrvuPercentileAboveRange?: boolean
  /** Market curve for display in calculation drawer (per 1.0 cFTE). */
  marketTCC_25: number
  marketTCC_50: number
  marketTCC_75: number
  marketTCC_90: number
  marketWRVU_25: number
  marketWRVU_50: number
  marketWRVU_75: number
  marketWRVU_90: number
}

/**
 * Get provider-level detail for a given specialty (for drawer drilldown).
 * Uses same filters and TCC logic as computeImputedVsMarketBySpecialty.
 */
export function getImputedVsMarketProviderDetail(
  specialtyDisplayName: string,
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  synonymMap: SynonymMap,
  config: ImputedVsMarketConfig
): ImputedVsMarketProviderDetail[] {
  const minFTE = config.minBasisFTE ?? 0.5
  const minWRVU1p0 = config.minWRVUPer1p0CFTE ?? 1000
  const psqConfig: PSQConfig = { include: false, psqPercent: 0 }
  const specNorm = normalizeSpecialtyKey(specialtyDisplayName)
  if (!specNorm) return []

  const detail: ImputedVsMarketProviderDetail[] = []

  for (const provider of providerRows) {
    const match = matchMarketRow(provider, marketRows, synonymMap)
    const market = match.marketRow
    if (!market) continue

    if (normalizeSpecialtyKey((provider.specialty ?? '').trim()) !== specNorm) continue

    const cFTE = getClinicalFTE(provider)
    if (cFTE < minFTE) continue

    const totalWRVUs = getTotalWRVUs(provider)
    const wRVU_1p0 = cFTE > 0 ? totalWRVUs / cFTE : 0
    if (wRVU_1p0 < minWRVU1p0 && wRVU_1p0 > 0) continue

    const currentCF = num(provider.currentCF) || market.CF_50
    const baselineConfig: OptimizerBaselineTCCConfig = {
      psqConfig,
      includeQualityPayments: config.includeQualityPayments,
      includeWorkRVUIncentive: config.includeWorkRVUIncentive,
      includeOtherIncentives: config.includeOtherIncentives,
      currentCF,
      additionalTCC: config.additionalTCC,
    }
    const breakdown = getBaselineTCCBreakdown(provider, baselineConfig)
    const baselineTCC = breakdown.total
    const totalFTE = num(provider.totalFTE) || 1
    const imputed = imputedTCCPerWRVU(baselineTCC, totalFTE, cFTE, totalWRVUs)
    if (!Number.isFinite(imputed) || imputed <= 0) continue

    const baselineTCC_1p0 = cFTE > 0 ? baselineTCC / cFTE : 0
    const tccResult = inferPercentile(
      baselineTCC_1p0,
      market.TCC_25,
      market.TCC_50,
      market.TCC_75,
      market.TCC_90
    )
    const wrvuResult = inferPercentile(
      wRVU_1p0,
      market.WRVU_25,
      market.WRVU_50,
      market.WRVU_75,
      market.WRVU_90
    )

    detail.push({
      providerId: (provider.providerId ?? provider.providerName ?? '').toString(),
      providerName: (provider.providerName ?? '').toString(),
      division: (provider.division ?? '').toString().trim() || '—',
      providerType: (provider.providerType ?? '').toString().trim() || '—',
      cFTE,
      totalWRVUs,
      wRVU_1p0,
      baselineTCC,
      currentCFUsed: currentCF,
      imputedDollarPerWRVU: imputed,
      clinicalBase: breakdown.clinicalBase,
      psq: breakdown.psq,
      quality: breakdown.quality,
      workRVUIncentive: breakdown.workRVUIncentive,
      otherIncentives: breakdown.otherIncentives,
      additionalTCC: breakdown.additionalTCC,
      tccPercentile: tccResult.percentile,
      tccPercentileBelowRange: tccResult.belowRange,
      tccPercentileAboveRange: tccResult.aboveRange,
      wrvuPercentile: wrvuResult.percentile,
      wrvuPercentileBelowRange: wrvuResult.belowRange,
      wrvuPercentileAboveRange: wrvuResult.aboveRange,
      marketTCC_25: market.TCC_25,
      marketTCC_50: market.TCC_50,
      marketTCC_75: market.TCC_75,
      marketTCC_90: market.TCC_90,
      marketWRVU_25: market.WRVU_25,
      marketWRVU_50: market.WRVU_50,
      marketWRVU_75: market.WRVU_75,
      marketWRVU_90: market.WRVU_90,
    })
  }

  detail.sort((a, b) => a.providerName.localeCompare(b.providerName, undefined, { sensitivity: 'base' }))
  return detail
}
