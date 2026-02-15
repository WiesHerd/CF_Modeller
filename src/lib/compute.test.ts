/**
 * Unit tests for scenario computation (computeScenario).
 * Covers: file-supplied Current TCC used as total (no doubling).
 */

import { describe, it, expect } from 'vitest'
import { computeScenario } from './compute'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'

const minimalMarket: MarketRow = {
  specialty: 'IM',
  TCC_25: 200_000,
  TCC_50: 250_000,
  TCC_75: 300_000,
  TCC_90: 350_000,
  WRVU_25: 4000,
  WRVU_50: 5000,
  WRVU_75: 6000,
  WRVU_90: 7000,
  CF_25: 45,
  CF_50: 50,
  CF_75: 55,
  CF_90: 60,
}

describe('computeScenario', () => {
  it('uses file-supplied currentTCC as total and does not double it', () => {
    // Provider with Current TCC column = 181650; base and PSQ would otherwise sum to a different total.
    // Before fix: currentTCC was used as qualityPayments and added to base+PSQ, yielding 363300.
    const provider: ProviderRow = {
      providerName: 'Wei, Wei',
      baseSalary: 173_000,
      currentTCC: 181_650,
      totalFTE: 1,
      clinicalFTE: 1,
      totalWRVUs: 4000,
      currentCF: 50,
      currentThreshold: 5000, // above wRVUs so currentIncentive = 0
      currentPsqPercent: 5,
      // no qualityPayments, no otherIncentives
    }
    const scenario = {
      ...DEFAULT_SCENARIO_INPUTS,
      currentPsqPercent: 5,
      psqBasis: 'base_salary' as const,
    }
    const result = computeScenario(provider, minimalMarket, scenario)
    expect(result.currentTCC).toBe(181_650)
  })

  it('computes currentTCC from components when file does not supply currentTCC', () => {
    const provider: ProviderRow = {
      providerName: 'Test, Provider',
      baseSalary: 100_000,
      totalFTE: 1,
      clinicalFTE: 1,
      totalWRVUs: 5000,
      currentCF: 50,
      currentThreshold: 3000,
      qualityPayments: 10_000,
      otherIncentives: 0,
    }
    const result = computeScenario(provider, minimalMarket, DEFAULT_SCENARIO_INPUTS)
    // currentTCC = base + incentive + PSQ + quality + other. currentIncentive = (5000-3000)*50 = 100_000; PSQ 0.
    const expected = 100_000 + 100_000 + 0 + 10_000 + 0
    expect(result.currentTCC).toBe(expected)
  })
})
