/**
 * Centralized normalization and baseline/modeled TCC for optimizer and batch.
 * All comparisons use 1.0 clinical FTE (cFTE) for apples-to-apples with market benchmarks.
 */

import type { ProviderRow } from '@/types/provider'
import type { PSQBasis } from '@/types/scenario'
import type { AdditionalTCCConfig } from '@/lib/tcc-components'

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

/** PSQ config for baseline/modeled TCC. When basis is fixed, use psqFixedDollars (global or per-provider). */
export interface PSQConfig {
  /** Include PSQ in TCC (if false, psq dollars = 0). */
  include: boolean
  /** Percent of base (when basis is base_salary or total_guaranteed). */
  psqPercent: number
  /** base_salary | total_guaranteed | total_pay. For optimizer baseline we use base_salary equivalent: % of clinical base. */
  psqBasis?: PSQBasis
  /** When basis is 'fixed', use this dollar amount (e.g. global or specialty override). */
  psqFixedDollars?: number
}

/**
 * Clinical base salary for a provider.
 * If clinicalFTESalary is present and finite, use it.
 * Else: baseSalary * (clinicalFTE / totalFTE).
 * If totalFTE is missing or zero, treat base as clinical (documented assumption).
 */
export function getClinicalBase(provider: ProviderRow): number {
  const fromComponents =
    provider.basePayComponents?.length &&
    provider.basePayComponents.some((c) => Number(c?.amount) > 0)
      ? provider.basePayComponents.reduce(
          (sum, c) => sum + (typeof c?.amount === 'number' && Number.isFinite(c.amount) ? c.amount : 0),
          0
        )
      : 0
  const baseSalary = fromComponents > 0 ? fromComponents : num(provider.baseSalary)
  if (
    provider.clinicalFTESalary != null &&
    Number.isFinite(provider.clinicalFTESalary)
  ) {
    return num(provider.clinicalFTESalary)
  }
  const totalFTE = num(provider.totalFTE) || 0
  const clinicalFTE = num(provider.clinicalFTE)
  if (totalFTE <= 0) {
    return baseSalary
  }
  return baseSalary * safeDiv(clinicalFTE, totalFTE, 1)
}

/**
 * PSQ dollars for baseline/modeled TCC.
 * If basis is percent of base: clinicalBase * (psqPercent/100).
 * If basis is fixed: psqFixedDollars (default 0 when not provided).
 */
export function getPSQDollars(
  clinicalBase: number,
  config: PSQConfig
): number {
  if (!config.include) return 0
  if (config.psqBasis === 'total_pay') {
    return 0
  }
  if (config.psqFixedDollars != null && Number.isFinite(config.psqFixedDollars)) {
    return config.psqFixedDollars
  }
  const pct = config.psqPercent ?? 0
  return clinicalBase * (pct / 100)
}

/**
 * Baseline TCC for optimizer: clinical base + PSQ only (no incentive).
 */
export function getBaselineTCC(provider: ProviderRow, psqConfig: PSQConfig): number {
  const clinicalBase = getClinicalBase(provider)
  const psq = getPSQDollars(clinicalBase, psqConfig)
  return clinicalBase + psq
}

/**
 * Clinical FTE (cFTE). Returns 0 when null/undefined/zero so callers can exclude.
 */
export function getClinicalFTE(provider: ProviderRow): number {
  const c = num(provider.clinicalFTE)
  if (c > 0) return c
  const t = num(provider.totalFTE)
  return t > 0 ? t : 0
}

/**
 * Total work RVUs for a provider (workRVUs + pchWRVUs + outsideWRVUs or totalWRVUs).
 */
export function getTotalWRVUs(provider: ProviderRow): number {
  return (
    num(provider.totalWRVUs) ||
    num(provider.workRVUs) + num(provider.pchWRVUs) + num(provider.outsideWRVUs)
  )
}

/**
 * TCC and wRVU normalized to 1.0 clinical FTE.
 * If cFTE is 0, returned values are 0 (caller should exclude provider).
 */
export interface NormalizedPer1p0CFTE {
  tcc_1p0: number
  wRVU_1p0: number
  cFTE: number
}

export function normalizeTo1p0CFTE(
  tccRaw: number,
  totalWRVUs: number,
  cFTE: number
): NormalizedPer1p0CFTE {
  if (cFTE <= 0) {
    return { tcc_1p0: 0, wRVU_1p0: 0, cFTE: 0 }
  }
  return {
    tcc_1p0: tccRaw / cFTE,
    wRVU_1p0: totalWRVUs / cFTE,
    cFTE,
  }
}

/**
 * One-stop: baseline TCC (clinical base + PSQ) and normalized metrics per 1.0 cFTE.
 */
export function getBaselineTCCNormalized(
  provider: ProviderRow,
  psqConfig: PSQConfig
): { baselineTCC: number; baselineTCC_1p0: number; wRVU_1p0: number; cFTE: number } {
  const cFTE = getClinicalFTE(provider)
  const baselineTCC = getBaselineTCC(provider, psqConfig)
  const totalWRVUs = getTotalWRVUs(provider)
  const { tcc_1p0, wRVU_1p0 } = normalizeTo1p0CFTE(baselineTCC, totalWRVUs, cFTE)
  return {
    baselineTCC,
    baselineTCC_1p0: tcc_1p0,
    wRVU_1p0,
    cFTE,
  }
}

/** Per-component options (e.g. value in file is per 1.0 FTE). */
export interface TCCComponentOptions {
  /** When true, file value is per 1.0 FTE; use value * clinical FTE for raw TCC. */
  normalizeForFTE?: boolean
}

/** How quality payments are determined when included in TCC. */
export type QualityPaymentsSource = 'from_file' | 'override_pct_of_base'

/** Options for optimizer baseline TCC: what to include (quality, work RVU incentive, other incentives, etc.). */
export interface OptimizerBaselineTCCConfig {
  psqConfig: PSQConfig
  /** Include quality payments in baseline (and use same in modeled). */
  includeQualityPayments: boolean
  /** When 'override_pct_of_base', quality = clinicalBase * (qualityOverridePct/100) instead of provider file. */
  qualityPaymentsSource?: QualityPaymentsSource
  /** Used when qualityPaymentsSource is 'override_pct_of_base' (e.g. 5 = 5% of base). */
  qualityPaymentsOverridePct?: number
  /** Include current work RVU incentive in baseline. Target = clinical base / currentCF; incentive = max(0, (wRVUs - target) * currentCF). */
  includeWorkRVUIncentive: boolean
  /** Include provider.otherIncentives in baseline and modeled TCC. */
  includeOtherIncentives?: boolean
  /** Current CF for baseline incentive (when includeWorkRVUIncentive). */
  currentCF: number
  /** Optional per-component options (e.g. normalizeForFTE for quality or otherIncentives). */
  componentOptions?: Record<string, TCCComponentOptions>
  /** Layered additional TCC on top of components (percent of base, dollar per FTE, flat). */
  additionalTCC?: AdditionalTCCConfig
}

/**
 * Compute layered additional TCC (percent of base, dollar per FTE, flat).
 * Returns 0 if config.additionalTCC is missing or all values zero/undefined.
 */
export function getAdditionalTCCAmount(
  config: OptimizerBaselineTCCConfig,
  clinicalBase: number,
  cFTE: number
): number {
  const add = config.additionalTCC
  if (!add) return 0
  const pct = add.percentOfBase != null && Number.isFinite(add.percentOfBase) ? add.percentOfBase : 0
  const perFTE = add.dollarPer1p0FTE != null && Number.isFinite(add.dollarPer1p0FTE) ? add.dollarPer1p0FTE : 0
  const flat = add.flatDollar != null && Number.isFinite(add.flatDollar) ? add.flatDollar : 0
  if (pct === 0 && perFTE === 0 && flat === 0) return 0
  return clinicalBase * (pct / 100) + perFTE * (cFTE > 0 ? cFTE : 0) + flat
}

/**
 * Quality dollars for optimizer (baseline or modeled). Uses config.qualityPaymentsSource and override % when set.
 */
export function getQualityDollarsForOptimizerConfig(
  provider: ProviderRow,
  config: OptimizerBaselineTCCConfig
): number {
  if (!config.includeQualityPayments) return 0
  const clinicalBase = getClinicalBase(provider)
  const cFTE = getClinicalFTE(provider)
  if (config.qualityPaymentsSource === 'override_pct_of_base' && config.qualityPaymentsOverridePct != null) {
    return clinicalBase * (config.qualityPaymentsOverridePct / 100)
  }
  const raw = num(provider.qualityPayments)
  return resolveFromFileAmount(raw, 'quality', cFTE, config.componentOptions)
}

/**
 * Resolve a from-file amount: if componentOptions[id].normalizeForFTE is true, treat value as per 1.0 FTE (use value * cFTE).
 */
function resolveFromFileAmount(
  rawValue: number,
  componentId: string,
  cFTE: number,
  componentOptions?: Record<string, TCCComponentOptions>
): number {
  if (rawValue === 0 || cFTE <= 0) return rawValue
  const opts = componentOptions?.[componentId]
  if (opts?.normalizeForFTE) return rawValue * cFTE
  return rawValue
}

/**
 * Baseline TCC for optimizer with optional quality payments, work RVU incentive, and other incentives.
 * Work RVU incentive: target wRVUs = clinical base / CF; if actual wRVUs > target, incentive = (wRVUs - target) * CF.
 */
export function getBaselineTCCForOptimizer(
  provider: ProviderRow,
  config: OptimizerBaselineTCCConfig
): number {
  const clinicalBase = getClinicalBase(provider)
  const cFTE = getClinicalFTE(provider)
  const psq = getPSQDollars(clinicalBase, config.psqConfig)
  const qualityRaw = config.includeQualityPayments
    ? config.qualityPaymentsSource === 'override_pct_of_base' && config.qualityPaymentsOverridePct != null
      ? clinicalBase * (config.qualityPaymentsOverridePct / 100)
      : num(provider.qualityPayments)
    : 0
  const quality =
    config.qualityPaymentsSource === 'override_pct_of_base'
      ? qualityRaw
      : resolveFromFileAmount(qualityRaw, 'quality', cFTE, config.componentOptions)
  const incentive = config.includeWorkRVUIncentive
    ? getIncentiveDerived(clinicalBase, getTotalWRVUs(provider), config.currentCF)
    : 0
  const otherRaw = config.includeOtherIncentives ? num(provider.otherIncentives) : 0
  const other = resolveFromFileAmount(otherRaw, 'otherIncentives', cFTE, config.componentOptions)
  const additional = getAdditionalTCCAmount(config, clinicalBase, cFTE)
  return clinicalBase + psq + quality + incentive + other + additional
}

/** Breakdown of baseline TCC components for display (e.g. drawer build-up). */
export interface BaselineTCCBreakdown {
  clinicalBase: number
  psq: number
  quality: number
  workRVUIncentive: number
  otherIncentives: number
  /** Layered additional TCC (percent of base + dollar per FTE + flat). */
  additionalTCC?: number
  total: number
}

/**
 * Return each component of baseline TCC (same logic as getBaselineTCCForOptimizer).
 */
export function getBaselineTCCBreakdown(
  provider: ProviderRow,
  config: OptimizerBaselineTCCConfig
): BaselineTCCBreakdown {
  const clinicalBase = getClinicalBase(provider)
  const cFTE = getClinicalFTE(provider)
  const psq = getPSQDollars(clinicalBase, config.psqConfig)
  const qualityRaw = config.includeQualityPayments
    ? config.qualityPaymentsSource === 'override_pct_of_base' && config.qualityPaymentsOverridePct != null
      ? clinicalBase * (config.qualityPaymentsOverridePct / 100)
      : num(provider.qualityPayments)
    : 0
  const qualityBreakdown =
    config.qualityPaymentsSource === 'override_pct_of_base'
      ? qualityRaw
      : resolveFromFileAmount(qualityRaw, 'quality', cFTE, config.componentOptions)
  const workRVUIncentive = config.includeWorkRVUIncentive
    ? getIncentiveDerived(clinicalBase, getTotalWRVUs(provider), config.currentCF)
    : 0
  const otherRaw = config.includeOtherIncentives ? num(provider.otherIncentives) : 0
  const otherIncentives = resolveFromFileAmount(otherRaw, 'otherIncentives', cFTE, config.componentOptions)
  const additionalTCC = getAdditionalTCCAmount(config, clinicalBase, cFTE)
  const total = clinicalBase + psq + qualityBreakdown + workRVUIncentive + otherIncentives + additionalTCC
  return { clinicalBase, psq, quality: qualityBreakdown, workRVUIncentive, otherIncentives, additionalTCC, total }
}

/**
 * Baseline TCC (with optional quality + work RVU incentive) and normalized per 1.0 cFTE for optimizer.
 */
export function getBaselineTCCNormalizedForOptimizer(
  provider: ProviderRow,
  config: OptimizerBaselineTCCConfig
): { baselineTCC: number; baselineTCC_1p0: number; wRVU_1p0: number; cFTE: number } {
  const cFTE = getClinicalFTE(provider)
  const baselineTCC = getBaselineTCCForOptimizer(provider, config)
  const totalWRVUs = getTotalWRVUs(provider)
  const { tcc_1p0, wRVU_1p0 } = normalizeTo1p0CFTE(baselineTCC, totalWRVUs, cFTE)
  return {
    baselineTCC,
    baselineTCC_1p0: tcc_1p0,
    wRVU_1p0,
    cFTE,
  }
}

/**
 * Incentive dollars using derived threshold: threshold = clinicalBase / CF, incentive = max(0, (wRVUs - threshold) * CF).
 * Same logic as batch/modeler derived threshold.
 */
export function getIncentiveDerived(
  clinicalBase: number,
  totalWRVUs: number,
  CF: number
): number {
  if (CF <= 0) return 0
  const threshold = safeDiv(clinicalBase, CF, 0)
  const above = totalWRVUs - threshold
  return above > 0 ? above * CF : 0
}

/**
 * Modeled TCC for optimizer evaluation: clinical base + PSQ + quality payments + incentive at given CF (derived threshold).
 * Work RVU incentive: target = clinical base / CF; if wRVUs > target, incentive = (wRVUs - target) * CF.
 */
export function getModeledTCCWithCF(
  clinicalBase: number,
  psqDollars: number,
  totalWRVUs: number,
  CF: number,
  qualityPaymentsDollars: number = 0
): number {
  const incentive = getIncentiveDerived(clinicalBase, totalWRVUs, CF)
  return clinicalBase + psqDollars + qualityPaymentsDollars + incentive
}
