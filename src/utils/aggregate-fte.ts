/**
 * Aggregates FTE by type (CART + other) across a list of providers.
 * Used for population FTE splits chart (e.g. CF Optimizer run/review).
 */

import type { ProviderRow } from '@/types/provider'

function num(x: unknown): number {
  if (typeof x === 'number' && !Number.isNaN(x)) return x
  const n = Number(x)
  return Number.isNaN(n) ? 0 : n
}

export interface AggregatedFTE {
  clinical: number
  admin: number
  teaching: number
  research: number
  other: number
}

/**
 * Sum FTE by type across providers.
 * - clinical = sum(clinicalFTE ?? totalFTE) per provider
 * - admin, teaching, research = sum of those fields (0 when missing)
 * - other = max(0, sum(totalFTE) - clinical - admin - teaching - research)
 */
export function aggregateFTEByType(providers: ProviderRow[]): AggregatedFTE {
  let clinical = 0
  let admin = 0
  let teaching = 0
  let research = 0
  let totalFTESum = 0

  for (const p of providers) {
    const total = num(p.totalFTE)
    const c = num(p.clinicalFTE)
    const a = num(p.adminFTE)
    const t = num(p.teachingFTE)
    const r = num(p.researchFTE)

    totalFTESum += total
    clinical += c > 0 ? c : total
    admin += a
    teaching += t
    research += r
  }

  const cartSum = clinical + admin + teaching + research
  const other = Math.max(0, totalFTESum - cartSum)

  return { clinical, admin, teaching, research, other }
}
