/**
 * Unit tests for post-run incentive distribution.
 */

import { describe, it, expect } from 'vitest'
import { applyIncentiveDistribution } from './productivity-target-distribution'
import type {
  ProductivityTargetRunResult,
  ProductivityTargetSpecialtyResult,
  IncentiveDistributionMethod,
} from '@/types/productivity-target'

function makeResult(
  specialtyRows: { specialty: string; providers: { actualWRVUs: number; rampedTargetWRVU: number; planningIncentiveDollars: number }[] }[]
): ProductivityTargetRunResult {
  const bySpecialty: ProductivityTargetSpecialtyResult[] = specialtyRows.map((row) => {
    const providers = row.providers.map((p) => ({
      providerId: `p-${p.actualWRVUs}`,
      specialty: row.specialty,
      cFTE: 1,
      actualWRVUs: p.actualWRVUs,
      rampFactor: 1,
      targetWRVU: p.rampedTargetWRVU,
      rampedTargetWRVU: p.rampedTargetWRVU,
      varianceWRVU: p.actualWRVUs - p.rampedTargetWRVU,
      percentToTarget: 100,
      status: 'At Target' as const,
      planningIncentiveDollars: p.planningIncentiveDollars,
    }))
    const totalPlanningIncentiveDollars = providers.reduce((s, p) => s + (p.planningIncentiveDollars ?? 0), 0)
    return {
      specialty: row.specialty,
      groupTargetWRVU_1cFTE: 5000,
      targetPercentile: 50,
      targetApproach: 'wrvu_percentile',
      providers,
      summary: { meanPercentToTarget: 100, medianPercentToTarget: 100, bandCounts: { below80: 0, eightyTo99: 0, hundredTo119: 1, atOrAbove120: 0 } },
      totalPlanningIncentiveDollars,
    }
  })
  return { bySpecialty, planningCFSummary: { source: 'market_percentile', percentile: 50 } }
}

describe('applyIncentiveDistribution', () => {
  it('individual returns result unchanged', () => {
    const result = makeResult([
      {
        specialty: 'Cardiology',
        providers: [
          { actualWRVUs: 6000, rampedTargetWRVU: 5000, planningIncentiveDollars: 50000 },
          { actualWRVUs: 7000, rampedTargetWRVU: 5000, planningIncentiveDollars: 100000 },
        ],
      },
    ])
    const out = applyIncentiveDistribution(result, 'individual')
    expect(out).toBe(result)
    expect(out.bySpecialty[0].providers[0].planningIncentiveDollars).toBe(50000)
    expect(out.bySpecialty[0].providers[1].planningIncentiveDollars).toBe(100000)
  })

  it('pool_by_wrvu_share redistributes by share of total wRVUs', () => {
    const result = makeResult([
      {
        specialty: 'Cardiology',
        providers: [
          { actualWRVUs: 6000, rampedTargetWRVU: 5000, planningIncentiveDollars: 50000 },
          { actualWRVUs: 9000, rampedTargetWRVU: 5000, planningIncentiveDollars: 100000 },
        ],
      },
    ])
    const pool = 50000 + 100000
    const totalWRVU = 6000 + 9000
    const out = applyIncentiveDistribution(result, 'pool_by_wrvu_share')
    expect(out).not.toBe(result)
    expect(out.bySpecialty[0].totalPlanningIncentiveDollars).toBe(pool)
    expect(out.bySpecialty[0].providers[0].planningIncentiveDollars).toBe(pool * (6000 / totalWRVU))
    expect(out.bySpecialty[0].providers[1].planningIncentiveDollars).toBe(pool * (9000 / totalWRVU))
  })

  it('pool_by_wrvu_above_target_share allocates only by wRVUs above target', () => {
    const result = makeResult([
      {
        specialty: 'Cardiology',
        providers: [
          { actualWRVUs: 6000, rampedTargetWRVU: 5000, planningIncentiveDollars: 50000 },
          { actualWRVUs: 9000, rampedTargetWRVU: 5000, planningIncentiveDollars: 100000 },
        ],
      },
    ])
    const pool = 50000 + 100000
    const above1 = 1000
    const above2 = 4000
    const totalAbove = above1 + above2
    const out = applyIncentiveDistribution(result, 'pool_by_wrvu_above_target_share')
    expect(out.bySpecialty[0].totalPlanningIncentiveDollars).toBe(pool)
    expect(out.bySpecialty[0].providers[0].planningIncentiveDollars).toBe(pool * (above1 / totalAbove))
    expect(out.bySpecialty[0].providers[1].planningIncentiveDollars).toBe(pool * (above2 / totalAbove))
  })

  it('pool_by_wrvu_above_target_share gives zero when no one is above target', () => {
    const result = makeResult([
      {
        specialty: 'Cardiology',
        providers: [
          { actualWRVUs: 4000, rampedTargetWRVU: 5000, planningIncentiveDollars: 0 },
          { actualWRVUs: 4500, rampedTargetWRVU: 5000, planningIncentiveDollars: 0 },
        ],
      },
    ])
    const out = applyIncentiveDistribution(result, 'pool_by_wrvu_above_target_share')
    expect(out.bySpecialty[0].providers[0].planningIncentiveDollars).toBe(0)
    expect(out.bySpecialty[0].providers[1].planningIncentiveDollars).toBe(0)
    expect(out.bySpecialty[0].totalPlanningIncentiveDollars).toBe(0)
  })

  it('pool with zero totalWRVU leaves specialty unchanged for pool_by_wrvu_share', () => {
    const result = makeResult([
      {
        specialty: 'Cardiology',
        providers: [
          { actualWRVUs: 0, rampedTargetWRVU: 5000, planningIncentiveDollars: 0 },
          { actualWRVUs: 0, rampedTargetWRVU: 5000, planningIncentiveDollars: 0 },
        ],
      },
    ])
    const out = applyIncentiveDistribution(result, 'pool_by_wrvu_share')
    expect(out.bySpecialty[0].providers[0].planningIncentiveDollars).toBe(0)
    expect(out.bySpecialty[0].totalPlanningIncentiveDollars).toBe(0)
  })
})
