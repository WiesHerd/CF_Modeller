/**
 * Specialty Productivity Target Optimizer – pure engine.
 * Group wRVU target per specialty (1.0 cFTE), scaled by provider cFTE; planning incentive from target-as-threshold × CF.
 */

import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import { interpPercentile } from '@/lib/interpolation'
import { matchMarketRow } from '@/lib/batch'
import { getClinicalFTE, getTotalWRVUs } from '@/lib/normalize-compensation'
import type {
  ProductivityTargetSettings,
  ProductivityTargetProviderInput,
  ProductivityTargetProviderResult,
  ProductivityTargetSpecialtyResult,
  ProductivityTargetSpecialtySummary,
  ProductivityTargetRunResult,
  ProviderTargetStatus,
  StatusBandCounts,
} from '@/types/productivity-target'
import { DEFAULT_PRODUCTIVITY_TARGET_SETTINGS } from '@/types/productivity-target'

function safeDiv(a: number, b: number, fallback: number): number {
  if (b == null || b === 0 || Number.isNaN(b)) return fallback
  const q = a / b
  return Number.isNaN(q) ? fallback : q
}

// ---------------------------------------------------------------------------
// Status bands: <80% Below, 80-99% Below, 100-119% At, >=120% Above
// ---------------------------------------------------------------------------

export function getProviderTargetStatus(percentToTarget: number): ProviderTargetStatus {
  if (percentToTarget >= 120) return 'Above Target'
  if (percentToTarget >= 100 && percentToTarget < 120) return 'At Target'
  if (percentToTarget >= 80 && percentToTarget < 100) return 'Below Target'
  return 'Below Target'
}

// ---------------------------------------------------------------------------
// Group target at 1.0 cFTE
// ---------------------------------------------------------------------------

/**
 * Compute group wRVU target at 1.0 cFTE for a specialty.
 * Approach A: market wRVU at targetPercentile.
 * Approach B: market TCC at targetPercentile / market $/wRVU at cfPercentile.
 */
export function computeGroupTargetWRVU(
  _specialty: string,
  settings: ProductivityTargetSettings,
  marketRow: MarketRow | null
): number | null {
  if (!marketRow) return null
  const p = settings.targetPercentile
  if (settings.targetApproach === 'wrvu_percentile') {
    return interpPercentile(
      p,
      marketRow.WRVU_25,
      marketRow.WRVU_50,
      marketRow.WRVU_75,
      marketRow.WRVU_90
    )
  }
  const marketPay = interpPercentile(
    p,
    marketRow.TCC_25,
    marketRow.TCC_50,
    marketRow.TCC_75,
    marketRow.TCC_90
  )
  const dollarPerWRVU = interpPercentile(
    settings.cfPercentile,
    marketRow.CF_25,
    marketRow.CF_50,
    marketRow.CF_75,
    marketRow.CF_90
  )
  if (dollarPerWRVU <= 0) return null
  return marketPay / dollarPerWRVU
}

// ---------------------------------------------------------------------------
// Planning CF from settings and market
// ---------------------------------------------------------------------------

function getPlanningCF(
  settings: ProductivityTargetSettings,
  marketRow: MarketRow | null
): number | null {
  if (settings.planningCFSource === 'manual' && settings.planningCFManual != null && Number.isFinite(settings.planningCFManual)) {
    return settings.planningCFManual
  }
  if (!marketRow) return null
  return interpPercentile(
    settings.planningCFPercentile,
    marketRow.CF_25,
    marketRow.CF_50,
    marketRow.CF_75,
    marketRow.CF_90
  )
}

// ---------------------------------------------------------------------------
// Provider targets and evaluation
// ---------------------------------------------------------------------------

export function computeProviderTargets(
  providerInputs: ProductivityTargetProviderInput[],
  groupTargetWRVU_1cFTE: number,
  settings: ProductivityTargetSettings,
  marketRow: MarketRow | null
): ProductivityTargetProviderResult[] {
  const planningCF = getPlanningCF(settings, marketRow)
  const results: ProductivityTargetProviderResult[] = []
  for (const inp of providerInputs) {
    const targetWRVU = groupTargetWRVU_1cFTE * inp.cFTE
    const rampedTargetWRVU = targetWRVU * inp.rampFactor
    const varianceWRVU = inp.actualWRVUs - rampedTargetWRVU
    const percentToTarget = rampedTargetWRVU > 0
      ? safeDiv(inp.actualWRVUs, rampedTargetWRVU, 0) * 100
      : 0
    const status = getProviderTargetStatus(percentToTarget)
    const planningIncentiveDollars =
      planningCF != null && planningCF > 0 && rampedTargetWRVU > 0
        ? Math.max(0, inp.actualWRVUs - rampedTargetWRVU) * planningCF
        : undefined
    results.push({
      ...inp,
      targetWRVU,
      rampedTargetWRVU,
      varianceWRVU,
      percentToTarget,
      status,
      planningIncentiveDollars,
    })
  }
  return results
}

// ---------------------------------------------------------------------------
// Specialty summary (mean, median, band counts)
// ---------------------------------------------------------------------------

export function computeSpecialtySummary(
  providerResults: ProductivityTargetProviderResult[]
): ProductivityTargetSpecialtySummary {
  const bandCounts: StatusBandCounts = {
    below80: 0,
    eightyTo99: 0,
    hundredTo119: 0,
    atOrAbove120: 0,
  }
  const percents: number[] = []
  for (const r of providerResults) {
    percents.push(r.percentToTarget)
    if (r.percentToTarget < 80) bandCounts.below80 += 1
    else if (r.percentToTarget < 100) bandCounts.eightyTo99 += 1
    else if (r.percentToTarget < 120) bandCounts.hundredTo119 += 1
    else bandCounts.atOrAbove120 += 1
  }
  const n = percents.length
  const meanPercentToTarget = n > 0 ? percents.reduce((a, b) => a + b, 0) / n : 0
  const sorted = [...percents].sort((a, b) => a - b)
  const medianPercentToTarget =
    n === 0 ? 0 : n % 2 === 1 ? sorted[Math.floor(n / 2)]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
  return {
    meanPercentToTarget,
    medianPercentToTarget,
    bandCounts,
  }
}

// ---------------------------------------------------------------------------
// Build provider inputs from provider rows
// ---------------------------------------------------------------------------

export function buildProviderInputs(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  synonymMap: Record<string, string>,
  settings: ProductivityTargetSettings
): { bySpecialty: Map<string, { inputs: ProductivityTargetProviderInput[]; market: MarketRow | null }> } {
  const bySpecialty = new Map<string, { inputs: ProductivityTargetProviderInput[]; market: MarketRow | null }>()
  for (const provider of providerRows) {
    const match = matchMarketRow(provider, marketRows, synonymMap)
    const market = match.marketRow
    const specialty = (provider.specialty ?? '').trim()
    const providerId = (provider.providerId ?? provider.providerName ?? '').toString()
    const cFTE = getClinicalFTE(provider)
    const actualWRVUs = getTotalWRVUs(provider)
    const rampFactor = settings.rampFactorByProviderId?.[providerId] ?? 1.0
    if (!bySpecialty.has(specialty)) {
      bySpecialty.set(specialty, { inputs: [], market: market ?? null })
    }
    const entry = bySpecialty.get(specialty)!
    entry.inputs.push({
      providerId,
      providerName: provider.providerName,
      specialty,
      cFTE,
      actualWRVUs,
      rampFactor,
    })
    if (market && !entry.market) entry.market = market
  }
  return { bySpecialty }
}

// ---------------------------------------------------------------------------
// Run by specialty: group target, provider targets, summary, planning total
// ---------------------------------------------------------------------------

export function runBySpecialty(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  synonymMap: Record<string, string>,
  settings: ProductivityTargetSettings = DEFAULT_PRODUCTIVITY_TARGET_SETTINGS
): ProductivityTargetRunResult {
  const { bySpecialty } = buildProviderInputs(providerRows, marketRows, synonymMap, settings)
  const bySpecialtyResults: ProductivityTargetSpecialtyResult[] = []
  for (const [specialty, { inputs, market }] of bySpecialty) {
    const groupTargetWRVU_1cFTE = computeGroupTargetWRVU(specialty, settings, market)
    const warning = !market ? 'Missing market data' : groupTargetWRVU_1cFTE == null ? 'Could not compute group target' : undefined
    const providerResults =
      groupTargetWRVU_1cFTE != null && groupTargetWRVU_1cFTE > 0
        ? computeProviderTargets(inputs, groupTargetWRVU_1cFTE, settings, market)
        : inputs.map((inp) => ({
            ...inp,
            targetWRVU: 0,
            rampedTargetWRVU: 0,
            varianceWRVU: inp.actualWRVUs,
            percentToTarget: 0,
            status: 'Below Target' as ProviderTargetStatus,
            planningIncentiveDollars: undefined as number | undefined,
          }))
    const summary = computeSpecialtySummary(providerResults)
    const totalPlanningIncentiveDollars = providerResults.reduce(
      (sum, r) => sum + (r.planningIncentiveDollars ?? 0),
      0
    )
    bySpecialtyResults.push({
      specialty,
      groupTargetWRVU_1cFTE: groupTargetWRVU_1cFTE ?? null,
      targetPercentile: settings.targetPercentile,
      targetApproach: settings.targetApproach,
      providers: providerResults,
      summary,
      totalPlanningIncentiveDollars,
      warning,
    })
  }
  bySpecialtyResults.sort((a, b) => a.specialty.localeCompare(b.specialty))
  return { bySpecialty: bySpecialtyResults }
}
