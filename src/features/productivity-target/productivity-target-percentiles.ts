/**
 * Rollup TCC and wRVU percentiles for Target Optimizer run.
 * Uses same market-percentile logic as imputed-vs-market / batch so definitions stay consistent.
 */

import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ProductivityTargetRunResult } from '@/types/productivity-target'
import { matchMarketRow } from '@/lib/batch'
import { getClinicalFTE, getTotalWRVUs, getBaselineTCCForOptimizer } from '@/lib/normalize-compensation'
import type { OptimizerBaselineTCCConfig, PSQConfig } from '@/lib/normalize-compensation'
import { inferPercentile } from '@/lib/interpolation'

function num(x: unknown): number {
  if (typeof x === 'number' && !Number.isNaN(x)) return x
  const n = Number(x)
  return Number.isNaN(n) ? 0 : n
}

export interface SpecialtyPercentiles {
  meanTCCPercentile: number
  meanWRVUPercentile: number
}

export interface TargetOptimizerPercentileRollup {
  meanTCCPercentile: number
  meanWRVUPercentile: number
  bySpecialty: Record<string, SpecialtyPercentiles>
}

/**
 * Compute mean TCC and wRVU percentiles (vs market) for the provider set in the run result.
 * Skips providers with no market match or missing in providerRows; means are over the remaining set.
 */
export function computeTargetOptimizerPercentileRollup(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  synonymMap: Record<string, string>,
  result: ProductivityTargetRunResult
): TargetOptimizerPercentileRollup {
  const providerById = new Map<string, ProviderRow>()
  for (const row of providerRows) {
    const id = (row.providerId ?? row.providerName ?? '').toString().trim()
    if (id) providerById.set(id, row)
  }

  const psqConfig: PSQConfig = { include: false, psqPercent: 0 }
  const allTCC: number[] = []
  const allWRVU: number[] = []
  const bySpecialty: Record<string, { tcc: number[]; wrvu: number[] }> = {}

  for (const spec of result.bySpecialty) {
    const tccList: number[] = []
    const wrvuList: number[] = []

    for (const prov of spec.providers) {
      const provider = providerById.get(prov.providerId)
      if (!provider) continue

      const match = matchMarketRow(provider, marketRows, synonymMap)
      const market = match.marketRow
      if (!market) continue

      const cFTE = getClinicalFTE(provider)
      if (cFTE <= 0) continue

      const totalWRVUs = getTotalWRVUs(provider)
      const wRVU_1p0 = totalWRVUs / cFTE

      const currentCF = num(provider.currentCF) || market.CF_50
      const baselineConfig: OptimizerBaselineTCCConfig = {
        psqConfig,
        includeQualityPayments: true,
        includeWorkRVUIncentive: true,
        includeOtherIncentives: false,
        currentCF,
      }
      const baselineTCC = getBaselineTCCForOptimizer(provider, baselineConfig)
      const baselineTCC_1p0 = baselineTCC / cFTE

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

      tccList.push(tccResult.percentile)
      wrvuList.push(wrvuResult.percentile)
      allTCC.push(tccResult.percentile)
      allWRVU.push(wrvuResult.percentile)
    }

    if (tccList.length > 0) {
      bySpecialty[spec.specialty] = {
        tcc: tccList,
        wrvu: wrvuList,
      }
    }
  }

  const n = allTCC.length
  const meanTCCPercentile = n > 0 ? allTCC.reduce((a, b) => a + b, 0) / n : 0
  const meanWRVUPercentile = n > 0 ? allWRVU.reduce((a, b) => a + b, 0) / n : 0

  const bySpecialtyOut: Record<string, SpecialtyPercentiles> = {}
  for (const [specialty, lists] of Object.entries(bySpecialty)) {
    const k = lists.tcc.length
    bySpecialtyOut[specialty] = {
      meanTCCPercentile: k > 0 ? lists.tcc.reduce((a, b) => a + b, 0) / k : 0,
      meanWRVUPercentile: k > 0 ? lists.wrvu.reduce((a, b) => a + b, 0) / k : 0,
    }
  }

  return {
    meanTCCPercentile,
    meanWRVUPercentile,
    bySpecialty: bySpecialtyOut,
  }
}
