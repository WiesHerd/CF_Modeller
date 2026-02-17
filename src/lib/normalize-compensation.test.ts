/**
 * Unit tests for normalize-compensation: baseline TCC with optional components,
 * quality override, and Per 1.0 FTE (normalizeForFTE).
 */

import { describe, it, expect } from 'vitest'
import {
  getBaselineTCCBreakdown,
  getBaselineTCCForOptimizer,
  type OptimizerBaselineTCCConfig,
} from './normalize-compensation'
import type { ProviderRow } from '@/types/provider'

function baseConfig(overrides: Partial<OptimizerBaselineTCCConfig> = {}): OptimizerBaselineTCCConfig {
  return {
    includeQualityPayments: false,
    includeWorkRVUIncentive: true,
    includeOtherIncentives: false,
    includeStipend: false,
    currentCF: 60,
    ...overrides,
  }
}

describe('getBaselineTCCBreakdown with optional TCC components', () => {
  it('includes qualityPayments, otherIncentives, and nonClinicalPay when toggles are on', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      specialty: 'Cardiology',
      totalFTE: 1,
      clinicalFTE: 1,
      baseSalary: 400_000,
      workRVUs: 6000,
      totalWRVUs: 6000,
      currentCF: 60,
      qualityPayments: 8_000,
      otherIncentives: 5_000,
      nonClinicalPay: 3_000,
    }
    const config = baseConfig({
      includeQualityPayments: true,
      includeOtherIncentives: true,
      includeStipend: true,
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.clinicalBase).toBe(400_000)
    expect(breakdown.quality).toBe(8_000)
    expect(breakdown.otherIncentives).toBe(5_000)
    expect(breakdown.stipend).toBe(3_000)
    expect(breakdown.total).toBe(
      breakdown.clinicalBase + breakdown.quality + breakdown.workRVUIncentive +
      breakdown.otherIncentives + breakdown.stipend
    )
  })

  it('excludes quality, other, stipend when toggles are off', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 1,
      baseSalary: 400_000,
      workRVUs: 6000,
      totalWRVUs: 6000,
      currentCF: 60,
      qualityPayments: 8_000,
      otherIncentives: 5_000,
      nonClinicalPay: 3_000,
    }
    const config = baseConfig({
      includeQualityPayments: false,
      includeOtherIncentives: false,
      includeStipend: false,
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.quality).toBe(0)
    expect(breakdown.otherIncentives).toBe(0)
    expect(breakdown.stipend).toBe(0)
    expect(breakdown.total).toBe(breakdown.clinicalBase + breakdown.workRVUIncentive)
  })
})

describe('quality override (% of base)', () => {
  it('uses override % of clinical base when qualityPaymentsSource is override_pct_of_base', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 1,
      baseSalary: 400_000,
      workRVUs: 5000,
      totalWRVUs: 5000,
      currentCF: 60,
      qualityPayments: 10_000,
    }
    const config = baseConfig({
      includeQualityPayments: true,
      qualityPaymentsSource: 'override_pct_of_base',
      qualityPaymentsOverridePct: 5,
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.quality).toBe(400_000 * 0.05)
    expect(breakdown.quality).toBe(20_000)
  })

  it('ignores provider.qualityPayments when override is set', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 1,
      baseSalary: 200_000,
      workRVUs: 5000,
      totalWRVUs: 5000,
      currentCF: 60,
      qualityPayments: 50_000,
    }
    const config = baseConfig({
      includeQualityPayments: true,
      qualityPaymentsSource: 'override_pct_of_base',
      qualityPaymentsOverridePct: 10,
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.quality).toBe(200_000 * 0.1)
    expect(breakdown.quality).toBe(20_000)
  })
})

describe('Per 1.0 FTE (normalizeForFTE)', () => {
  it('multiplies quality by clinical FTE when componentOptions.quality.normalizeForFTE is true', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 0.8,
      baseSalary: 400_000,
      workRVUs: 5000,
      totalWRVUs: 5000,
      currentCF: 60,
      qualityPayments: 10_000,
    }
    const config = baseConfig({
      includeQualityPayments: true,
      componentOptions: { quality: { normalizeForFTE: true } },
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.quality).toBe(10_000 * 0.8)
    expect(breakdown.quality).toBe(8_000)
  })

  it('uses raw value when normalizeForFTE is false', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 0.8,
      baseSalary: 400_000,
      workRVUs: 5000,
      totalWRVUs: 5000,
      currentCF: 60,
      qualityPayments: 10_000,
    }
    const config = baseConfig({
      includeQualityPayments: true,
      componentOptions: { quality: { normalizeForFTE: false } },
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.quality).toBe(10_000)
  })

  it('multiplies otherIncentives by clinical FTE when normalizeForFTE is true', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 0.5,
      baseSalary: 300_000,
      workRVUs: 5000,
      totalWRVUs: 5000,
      currentCF: 60,
      otherIncentives: 4_000,
    }
    const config = baseConfig({
      includeOtherIncentives: true,
      componentOptions: { otherIncentives: { normalizeForFTE: true } },
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.otherIncentives).toBe(4_000 * 0.5)
    expect(breakdown.otherIncentives).toBe(2_000)
  })

  it('multiplies stipend by clinical FTE when normalizeForFTE is true', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 0.75,
      baseSalary: 350_000,
      workRVUs: 5000,
      totalWRVUs: 5000,
      currentCF: 60,
      nonClinicalPay: 12_000,
    }
    const config = baseConfig({
      includeStipend: true,
      componentOptions: { stipend: { normalizeForFTE: true } },
    })
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(breakdown.stipend).toBe(12_000 * 0.75)
    expect(breakdown.stipend).toBe(9_000)
  })
})

describe('getBaselineTCCForOptimizer', () => {
  it('matches breakdown total when all optional components included', () => {
    const provider: ProviderRow = {
      providerId: 'p1',
      providerName: 'Dr A',
      totalFTE: 1,
      clinicalFTE: 1,
      baseSalary: 400_000,
      workRVUs: 6000,
      totalWRVUs: 6000,
      currentCF: 60,
      qualityPayments: 2_000,
      otherIncentives: 1_000,
      nonClinicalPay: 500,
    }
    const config = baseConfig({
      includeQualityPayments: true,
      includeOtherIncentives: true,
      includeStipend: true,
    })
    const total = getBaselineTCCForOptimizer(provider, config)
    const breakdown = getBaselineTCCBreakdown(provider, config)
    expect(total).toBe(breakdown.total)
  })
})
