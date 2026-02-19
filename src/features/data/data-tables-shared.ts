/**
 * Shared constants and utility functions for the provider and market data tables.
 */

import { formatCurrency, formatNumber } from '@/utils/format'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'

export const EMPTY = '—'
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
/** Generous px per character fallback (covers most Latin fonts at 14px). */
export const PX_PER_CHAR = 9
/** Extra px for body cells: px-3 L+R (24) + breathing room (16). */
export const AUTO_RESIZE_CELL_PADDING = 40
/** Extra px for header cells: px-3 L+R (24) + grip icon (20) + gap (4) + resize handle + safety (24). */
export const AUTO_RESIZE_HEADER_PADDING = 72
export const COL_MIN = 60
export const COL_MAX = 500
/** Approximate row and header heights for dynamic table container (px). */
export const TABLE_ROW_HEIGHT = 41
export const TABLE_HEADER_HEIGHT = 41

let _measureCtx: CanvasRenderingContext2D | null = null
/**
 * Measure text width. Returns the MAXIMUM of canvas measurement and a
 * character-count fallback so we never underestimate when the web font
 * hasn't loaded or canvas returns stale metrics.
 */
export function measureTextPx(text: string): number {
  const charEstimate = Math.ceil(text.length * PX_PER_CHAR)
  if (typeof document !== 'undefined' && !_measureCtx) {
    const canvas = document.createElement('canvas')
    _measureCtx = canvas.getContext('2d')
    if (_measureCtx) _measureCtx.font = '500 14px Inter, ui-sans-serif, system-ui, sans-serif'
  }
  if (_measureCtx) return Math.max(Math.ceil(_measureCtx.measureText(text).width), charEstimate)
  return charEstimate
}

export function fmtCur(n: number | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatCurrency(n, { decimals })
}

export function fmtNum(n: number | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatNumber(n, decimals)
}

/** Return display string for a provider column (for auto-resize width estimation). */
export function getProviderCellDisplayString(columnId: string, row: ProviderRow): string {
  switch (columnId) {
    case 'providerName': return String(row.providerName ?? EMPTY)
    case 'specialty': return String(row.specialty ?? EMPTY)
    case 'division': return String(row.division ?? EMPTY)
    case 'providerType': return String(row.providerType ?? EMPTY)
    case 'totalFTE': return fmtNum(row.totalFTE, 2)
    case 'clinicalFTE': return fmtNum(row.clinicalFTE, 2)
    case 'adminFTE': return fmtNum(row.adminFTE, 2)
    case 'researchFTE': return fmtNum(row.researchFTE, 2)
    case 'teachingFTE': return fmtNum(row.teachingFTE, 2)
    case 'baseSalary': return fmtCur(row.baseSalary)
    case 'adminPay': return fmtCur(row.adminPay)
    case 'teachingPay': return fmtCur(row.teachingPay)
    case 'researchPay': return fmtCur(row.researchPay)
    case 'nonClinicalPay': return fmtCur(row.nonClinicalPay)
    case 'workRVUs': return fmtNum(row.workRVUs ?? row.pchWRVUs, 0)
    case 'outsideWRVUs': return fmtNum(row.outsideWRVUs, 0)
    case 'totalWRVUs': return fmtNum(row.totalWRVUs, 0)
    case 'currentCF': return fmtCur(row.currentCF, 2)
    case 'currentThreshold': return fmtNum(row.currentThreshold, 0)
    case 'qualityPayments': return fmtCur(row.qualityPayments)
    case 'otherIncentives': return fmtCur(row.otherIncentives)
    case 'currentTCC': return fmtCur(row.currentTCC)
    case 'productivityModel': return String(row.productivityModel ?? EMPTY)
    default: return ''
  }
}

/** Return display string for a market column (for auto-resize width estimation). */
export function getMarketCellDisplayString(columnId: string, row: MarketRow): string {
  if (columnId === 'specialty') return String(row.specialty ?? EMPTY)
  if (columnId === 'providerType') return String(row.providerType ?? EMPTY)
  if (columnId === 'region') return String(row.region ?? EMPTY)
  const numVal = (row as unknown as Record<string, unknown>)[columnId]
  if (columnId.startsWith('TCC_') || columnId.startsWith('CF_')) return fmtCur(numVal as number | undefined, columnId.startsWith('CF_') ? 2 : 0)
  if (columnId.startsWith('WRVU_')) return fmtNum(numVal as number | undefined, 0)
  return String(numVal ?? EMPTY)
}
