/**
 * Unit tests for Productivity Target engine.
 * Covers: cFTE scaling, Approach A/B, rampFactor, missing market, planning incentive.
 */

import { describe, it, expect } from 'vitest'
import {
  computeGroupTargetWRVU,
  computeProviderTargets,
  computeSpecialtySummary,
  getProviderTargetStatus,
  runBySpecialty,
  buildProviderInputs,
} from './productivity-target-engine'
import type { ProductivityTargetSettings, ProductivityTargetProviderInput } from '@/types/productivity-target'
import { DEFAULT_PRODUCTIVITY_TARGET_SETTINGS } from '@/types/productivity-target'
import type { MarketRow } from '@/types/market'
import type { ProviderRow } from '@/types/provider'

const marketWRVU50 = 6000
const market: MarketRow = {
  specialty: 'Cardiology',
  TCC_25: 300000,
  TCC_50: 400000,
  TCC_75: 500000,
  TCC_90: 600000,
  WRVU_25: 4500,
  WRVU_50: marketWRVU50,
  WRVU_75: 7500,
  WRVU_90: 9000,
  CF_25: 40,
  CF_50: 50,
  CF_75: 60,
  CF_90: 70,
}

describe('getProviderTargetStatus', () => {
  it('returns Above Target for >= 120%', () => {
    expect(getProviderTargetStatus(120)).toBe('Above Target')
    expect(getProviderTargetStatus(150)).toBe('Above Target')
  })
  it('returns At Target for 100-119%', () => {
    expect(getProviderTargetStatus(100)).toBe('At Target')
    expect(getProviderTargetStatus(119)).toBe('At Target')
  })
  it('returns Below Target for 80-99%', () => {
    expect(getProviderTargetStatus(80)).toBe('Below Target')
    expect(getProviderTargetStatus(99)).toBe('Below Target')
  })
  it('returns Below Target for < 80%', () => {
    expect(getProviderTargetStatus(79)).toBe('Below Target')
    expect(getProviderTargetStatus(0)).toBe('Below Target')
  })
})

describe('computeGroupTargetWRVU', () => {
  it('Approach A: returns market wRVU at targetPercentile 50', () => {
    const settings: ProductivityTargetSettings = {
      ...DEFAULT_PRODUCTIVITY_TARGET_SETTINGS,
      targetApproach: 'wrvu_percentile',
      targetPercentile: 50,
    }
    const result = computeGroupTargetWRVU('Cardiology', settings, market)
    expect(result).toBe(marketWRVU50)
  })

  it('Approach A: returns null when market is null', () => {
    const settings: ProductivityTargetSettings = {
      ...DEFAULT_PRODUCTIVITY_TARGET_SETTINGS,
      targetApproach: 'wrvu_percentile',
    }
    expect(computeGroupTargetWRVU('Unknown', settings, null)).toBeNull()
  })

  it('Approach B: group target = TCC_50 / CF_50', () => {
    const settings: ProductivityTargetSettings = {
      ...DEFAULT_PRODUCTIVITY_TARGET_SETTINGS,
      targetApproach: 'pay_per_wrvu',
      targetPercentile: 50,
      cfPercentile: 50,
    }
    const result = computeGroupTargetWRVU('Cardiology', settings, market)
    expect(result).toBe(400000 / 50)
    expect(result).toBe(8000)
  })
})

describe('computeProviderTargets', () => {
  it('scales target by cFTE: 0.5 cFTE → half of group target', () => {
    const groupTarget = 6000
    const inputs: ProductivityTargetProviderInput[] = [
      {
        providerId: 'p1',
        specialty: 'Cardiology',
        cFTE: 0.5,
        actualWRVUs: 3500,
        rampFactor: 1,
      },
    ]
    const results = computeProviderTargets(inputs, groupTarget, DEFAULT_PRODUCTIVITY_TARGET_SETTINGS, market)
    expect(results).toHaveLength(1)
    expect(results[0]!.targetWRVU).toBe(3000)
    expect(results[0]!.rampedTargetWRVU).toBe(3000)
    expect(results[0]!.varianceWRVU).toBe(500)
    expect(results[0]!.percentToTarget).toBeCloseTo((3500 / 3000) * 100)
  })

  it('applies rampFactor: 0.8 → ramped target 80% of target', () => {
    const groupTarget = 6000
    const inputs: ProductivityTargetProviderInput[] = [
      {
        providerId: 'p1',
        specialty: 'Cardiology',
        cFTE: 0.5,
        actualWRVUs: 2600,
        rampFactor: 0.8,
      },
    ]
    const results = computeProviderTargets(inputs, groupTarget, DEFAULT_PRODUCTIVITY_TARGET_SETTINGS, market)
    expect(results[0]!.targetWRVU).toBe(3000)
    expect(results[0]!.rampedTargetWRVU).toBe(2400)
    expect(results[0]!.varianceWRVU).toBe(200)
    expect(results[0]!.percentToTarget).toBeCloseTo((2600 / 2400) * 100)
  })

  it('planning incentive: above target gets (actual - rampedTarget) * CF', () => {
    const groupTarget = 6000
    const inputs: ProductivityTargetProviderInput[] = [
      {
        providerId: 'p1',
        specialty: 'Cardiology',
        cFTE: 1,
        actualWRVUs: 7000,
        rampFactor: 1,
      },
    ]
    const results = computeProviderTargets(inputs, groupTarget, DEFAULT_PRODUCTIVITY_TARGET_SETTINGS, market)
    expect(results[0]!.planningIncentiveDollars).toBe((7000 - 6000) * 50)
    expect(results[0]!.planningIncentiveDollars).toBe(50000)
  })

  it('planning incentive: below target gets 0', () => {
    const groupTarget = 6000
    const inputs: ProductivityTargetProviderInput[] = [
      {
        providerId: 'p1',
        specialty: 'Cardiology',
        cFTE: 1,
        actualWRVUs: 2000,
        rampFactor: 1,
      },
    ]
    const results = computeProviderTargets(inputs, groupTarget, DEFAULT_PRODUCTIVITY_TARGET_SETTINGS, market)
    expect(results[0]!.planningIncentiveDollars).toBe(0)
  })

  it('manual planning CF is used when set', () => {
    const groupTarget = 6000
    const inputs: ProductivityTargetProviderInput[] = [
      {
        providerId: 'p1',
        specialty: 'Cardiology',
        cFTE: 1,
        actualWRVUs: 7000,
        rampFactor: 1,
      },
    ]
    const settings: ProductivityTargetSettings = {
      ...DEFAULT_PRODUCTIVITY_TARGET_SETTINGS,
      planningCFSource: 'manual',
      planningCFManual: 55,
    }
    const results = computeProviderTargets(inputs, groupTarget, settings, null)
    expect(results[0]!.planningIncentiveDollars).toBe(1000 * 55)
    expect(results[0]!.planningIncentiveDollars).toBe(55000)
  })
})

describe('computeSpecialtySummary', () => {
  it('computes mean, median, and band counts', () => {
    const providerResults = [
      { percentToTarget: 70, status: 'Below Target' as const, targetWRVU: 0, rampedTargetWRVU: 0, varianceWRVU: 0, providerId: 'a', specialty: 'X', cFTE: 1, actualWRVUs: 0, rampFactor: 1 },
      { percentToTarget: 110, status: 'At Target' as const, targetWRVU: 0, rampedTargetWRVU: 0, varianceWRVU: 0, providerId: 'b', specialty: 'X', cFTE: 1, actualWRVUs: 0, rampFactor: 1 },
      { percentToTarget: 130, status: 'Above Target' as const, targetWRVU: 0, rampedTargetWRVU: 0, varianceWRVU: 0, providerId: 'c', specialty: 'X', cFTE: 1, actualWRVUs: 0, rampFactor: 1 },
    ]
    const summary = computeSpecialtySummary(providerResults as import('@/types/productivity-target').ProductivityTargetProviderResult[])
    expect(summary.meanPercentToTarget).toBeCloseTo((70 + 110 + 130) / 3)
    expect(summary.medianPercentToTarget).toBe(110)
    expect(summary.bandCounts.below80).toBe(1)
    expect(summary.bandCounts.eightyTo99).toBe(0)
    expect(summary.bandCounts.hundredTo119).toBe(1)
    expect(summary.bandCounts.atOrAbove120).toBe(1)
  })
})

describe('runBySpecialty', () => {
  it('missing market yields warning and no group target', () => {
    const providerRows: ProviderRow[] = [
      {
        providerId: 'p1',
        providerName: 'Dr A',
        specialty: 'UnknownSpec',
        clinicalFTE: 1,
        totalFTE: 1,
        workRVUs: 5000,
      },
    ]
    const marketRows: MarketRow[] = [market]
    const result = runBySpecialty(providerRows, marketRows, {})
    expect(result.bySpecialty).toHaveLength(1)
    expect(result.bySpecialty[0]!.specialty).toBe('UnknownSpec')
    expect(result.bySpecialty[0]!.warning).toBe('Missing market data')
    expect(result.bySpecialty[0]!.groupTargetWRVU_1cFTE).toBeNull()
  })

  it('builds provider inputs with cFTE and actualWRVUs from provider rows', () => {
    const providerRows: ProviderRow[] = [
      {
        providerId: 'p1',
        providerName: 'Dr A',
        specialty: 'Cardiology',
        clinicalFTE: 0.5,
        totalFTE: 1,
        workRVUs: 3000,
      },
    ]
    const { bySpecialty } = buildProviderInputs(providerRows, [market], {}, DEFAULT_PRODUCTIVITY_TARGET_SETTINGS)
    const entry = bySpecialty.get('Cardiology')
    expect(entry).toBeDefined()
    expect(entry!.inputs).toHaveLength(1)
    expect(entry!.inputs[0]!.cFTE).toBe(0.5)
    expect(entry!.inputs[0]!.actualWRVUs).toBe(3000)
    expect(entry!.market).toEqual(market)
  })
})
