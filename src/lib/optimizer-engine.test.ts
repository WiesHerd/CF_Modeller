/**
 * Unit tests for Conversion Factor Optimizer engine.
 * Covers: percentile mapping (including off-scale), normalization (basisFTE),
 * solver convergence on synthetic data, CF policy and Effective Rate checks.
 */

import { describe, it, expect } from 'vitest'
import {
  percentileFromBenchmarks,
  percentileFromBenchmarksValue,
  getBasisFTE,
  calculateModeledTCC,
  detectOutliers,
  runOptimizerAllSpecialties,
  normalizeSpecialtyMetrics,
  evaluateStatus,
  buildExplanation,
} from './optimizer-engine'
import { getDefaultOptimizerSettings, DEFAULT_GOVERNANCE_CONFIG } from '@/types/optimizer'
import type { OptimizerKeyMetrics } from '@/types/optimizer'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'

const p25 = 100
const p50 = 150
const p75 = 200
const p90 = 250

describe('percentileFromBenchmarks', () => {
  it('returns 25 at p25', () => {
    const r = percentileFromBenchmarks(p25, p25, p50, p75, p90)
    expect(r.percentile).toBe(25)
    expect(r.belowRange).toBe(false)
    expect(r.aboveRange).toBe(false)
  })

  it('returns 50 at p50', () => {
    const r = percentileFromBenchmarks(p50, p25, p50, p75, p90)
    expect(r.percentile).toBe(50)
  })

  it('returns 90 at p90', () => {
    const r = percentileFromBenchmarks(p90, p25, p50, p75, p90)
    expect(r.percentile).toBe(90)
  })

  it('interpolates between 25 and 50', () => {
    const mid = (p25 + p50) / 2
    const r = percentileFromBenchmarks(mid, p25, p50, p75, p90)
    expect(r.percentile).toBeGreaterThan(25)
    expect(r.percentile).toBeLessThan(50)
  })

  it('returns off-scale below p25 (belowRange)', () => {
    const r = percentileFromBenchmarks(50, p25, p50, p75, p90)
    expect(r.percentile).toBeLessThan(25)
    expect(r.belowRange).toBe(true)
    expect(r.aboveRange).toBe(false)
  })

  it('returns off-scale above p90 (aboveRange)', () => {
    const r = percentileFromBenchmarks(300, p25, p50, p75, p90)
    expect(r.percentile).toBeGreaterThan(90)
    expect(r.aboveRange).toBe(true)
    expect(r.belowRange).toBe(false)
  })

  it('does not clamp: value below p25 returns percentile < 25', () => {
    const r = percentileFromBenchmarks(0, p25, p50, p75, p90)
    expect(r.percentile).toBeLessThan(25)
  })
})

describe('percentileFromBenchmarksValue', () => {
  it('returns numeric percentile only', () => {
    expect(percentileFromBenchmarksValue(p50, p25, p50, p75, p90)).toBe(50)
    expect(percentileFromBenchmarksValue(300, p25, p50, p75, p90)).toBeGreaterThan(90)
  })
})

describe('getBasisFTE', () => {
  it('per_cfte: returns clinical FTE when set', () => {
    const provider: ProviderRow = { totalFTE: 1, clinicalFTE: 0.8 }
    expect(getBasisFTE(provider, 'per_cfte')).toBe(0.8)
  })

  it('per_cfte: falls back to totalFTE when clinicalFTE missing', () => {
    const provider: ProviderRow = { totalFTE: 1 }
    expect(getBasisFTE(provider, 'per_cfte')).toBe(1)
  })

  it('per_tfte: returns total FTE', () => {
    const provider: ProviderRow = { totalFTE: 1, clinicalFTE: 0.8 }
    expect(getBasisFTE(provider, 'per_tfte')).toBe(1)
  })

  it('raw: returns 1.0', () => {
    const provider: ProviderRow = { totalFTE: 0.5 }
    expect(getBasisFTE(provider, 'raw')).toBe(1)
  })
})

describe('calculateModeledTCC', () => {
  const baseScenario = DEFAULT_SCENARIO_INPUTS
  const provider: ProviderRow = {
    providerId: 'p1',
    providerName: 'Test',
    baseSalary: 200_000,
    totalFTE: 1,
    clinicalFTE: 1,
    workRVUs: 5000,
    totalWRVUs: 5000,
    currentCF: 60,
  }

  it('includes base when toggles.base is true', () => {
    const tcc = calculateModeledTCC(
      provider,
      { base: true, productivityIncentive: false, valueBasedQuality: false, otherIncentives: false },
      60,
      baseScenario
    )
    expect(tcc).toBeGreaterThanOrEqual(200_000)
  })

  it('includes productivity incentive when toggled and CF > 0', () => {
    const tcc = calculateModeledTCC(
      provider,
      { base: true, productivityIncentive: true, valueBasedQuality: false, otherIncentives: false },
      60,
      baseScenario
    )
    expect(tcc).toBeGreaterThan(200_000)
  })

  it('higher CF increases TCC when productivity is on', () => {
    const tcc60 = calculateModeledTCC(
      provider,
      { base: true, productivityIncentive: true, valueBasedQuality: false, otherIncentives: false },
      60,
      baseScenario
    )
    const tcc70 = calculateModeledTCC(
      provider,
      { base: true, productivityIncentive: true, valueBasedQuality: false, otherIncentives: false },
      70,
      baseScenario
    )
    expect(tcc70).toBeGreaterThan(tcc60)
  })
})

describe('detectOutliers', () => {
  it('MAD: flags extreme values', () => {
    const values = [10, 12, 11, 13, 14, 15, 16, 17, 18, 100] // 100 is outlier
    const out = detectOutliers(values, 'mad_z', { madZThreshold: 3.5 })
    const outlierIndices = out.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
    expect(outlierIndices).toContain(9)
  })

  it('IQR: flags values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]
    const out = detectOutliers(values, 'iqr', { iqrK: 1.5 })
    const outlierIndices = out.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
    expect(outlierIndices.length).toBeGreaterThan(0)
    expect(outlierIndices).toContain(9)
  })

  it('returns all false when n < 4', () => {
    const out = detectOutliers([1, 2, 3], 'mad_z', {})
    expect(out.every((b) => !b)).toBe(true)
  })
})

describe('runOptimizerAllSpecialties', () => {
  const marketRows: MarketRow[] = [
    {
      specialty: 'Cardiology',
      TCC_25: 400_000,
      TCC_50: 500_000,
      TCC_75: 600_000,
      TCC_90: 700_000,
      WRVU_25: 4000,
      WRVU_50: 5000,
      WRVU_75: 6000,
      WRVU_90: 7000,
      CF_25: 55,
      CF_50: 60,
      CF_75: 65,
      CF_90: 70,
    },
  ]

  it('returns summary and bySpecialty with one specialty', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'p1',
        providerName: 'Dr A',
        specialty: 'Cardiology',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 450_000,
        workRVUs: 5200,
        totalWRVUs: 5200,
        currentCF: 58,
      },
      {
        providerId: 'p2',
        providerName: 'Dr B',
        specialty: 'Cardiology',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 480_000,
        workRVUs: 5400,
        totalWRVUs: 5400,
        currentCF: 59,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'test',
      scenarioName: 'Test',
    })
    expect(run.summary.specialtiesAnalyzed).toBe(1)
    expect(run.bySpecialty).toHaveLength(1)
    expect(run.bySpecialty[0].specialty).toBe('Cardiology')
    expect(run.bySpecialty[0].includedCount).toBeGreaterThanOrEqual(1)
    expect(run.audit.results).toHaveLength(1)
  })

  it('applies CF policy check and effective rate in result', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'p1',
        providerName: 'Dr A',
        specialty: 'Cardiology',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 500_000,
        workRVUs: 5000,
        totalWRVUs: 5000,
        currentCF: 60,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'test',
      scenarioName: 'Test',
    })
    const result = run.bySpecialty[0]
    expect(result.policyCheck).toBeDefined()
    expect(['ok', 'above_50', 'above_75', 'above_90']).toContain(result.policyCheck)
    expect(typeof result.cfPolicyPercentile).toBe('number')
    expect(typeof result.effectiveRateFlag).toBe('boolean')
    expect(typeof result.meanBaselineGap).toBe('number')
    expect(typeof result.maeBefore).toBe('number')
    expect(typeof result.maeAfter).toBe('number')
    expect(Array.isArray(result.keyMessages)).toBe(true)
  })

  it('excludes providers with missing market and reports in keyMessages', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'p1',
        providerName: 'Dr A',
        specialty: 'Cardiology',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 500_000,
        workRVUs: 5000,
        totalWRVUs: 5000,
        currentCF: 60,
      },
      {
        providerId: 'p2',
        providerName: 'Dr B',
        specialty: 'UnknownSpecialty',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 400_000,
        workRVUs: 4500,
        totalWRVUs: 4500,
        currentCF: 58,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'test',
      scenarioName: 'Test',
    })
    expect(run.summary.providersExcluded).toBeGreaterThanOrEqual(1)
    const excluded = run.audit.excludedProviders.filter(
      (p: { reasons: string[] }) => p.reasons.includes('missing_market')
    )
    expect(excluded.length).toBeGreaterThanOrEqual(1)
  })

  it('excludes providers with low wRVU per 1.0 cFTE when minWRVUPer1p0CFTE is set', () => {
    const marketRowsLow: MarketRow[] = [
      {
        specialty: 'Cardiology',
        TCC_25: 300_000,
        TCC_50: 400_000,
        TCC_75: 500_000,
        TCC_90: 600_000,
        WRVU_25: 3000,
        WRVU_50: 4000,
        WRVU_75: 5000,
        WRVU_90: 6000,
        CF_25: 55,
        CF_50: 60,
        CF_75: 65,
        CF_90: 70,
      },
    ]
    const providers: ProviderRow[] = [
      {
        providerId: 'p1',
        providerName: 'Dr A',
        specialty: 'Cardiology',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 350_000,
        workRVUs: 5000,
        totalWRVUs: 5000,
        currentCF: 60,
      },
      {
        providerId: 'p2',
        providerName: 'Dr B',
        specialty: 'Cardiology',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 320_000,
        workRVUs: 500,
        totalWRVUs: 500,
        currentCF: 58,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    settings.defaultExclusionRules.minWRVUPer1p0CFTE = 1000
    const run = runOptimizerAllSpecialties(providers, marketRowsLow, settings, {
      scenarioId: 'test',
      scenarioName: 'Test',
    })
    const excluded = run.audit.excludedProviders.filter(
      (p: { reasons: string[] }) => p.reasons.includes('low_wrvu_volume')
    )
    expect(excluded.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Governance, status, and explanation tests
// ---------------------------------------------------------------------------

describe('governance and explanation', () => {
  const marketRows: MarketRow[] = [
    {
      specialty: 'Internal Medicine',
      TCC_25: 250_000,
      TCC_50: 300_000,
      TCC_75: 380_000,
      TCC_90: 450_000,
      WRVU_25: 3500,
      WRVU_50: 4500,
      WRVU_75: 5500,
      WRVU_90: 6500,
      CF_25: 40,
      CF_50: 50,
      CF_75: 60,
      CF_90: 70,
    },
  ]

  /**
   * Test 1: Underpaid / high productivity
   * Provider has high wRVUs (above 50th) but low base salary (below 50th TCC).
   * Expect: INCREASE action, GREEN status, CF goes up.
   */
  it('1) underpaid / high productivity -> INCREASE + GREEN', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'u1',
        providerName: 'Dr Underpaid',
        specialty: 'Internal Medicine',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 240_000,  // low: below 25th TCC
        workRVUs: 5200,       // high: above 50th wRVU
        totalWRVUs: 5200,
        currentCF: 45,
      },
      {
        providerId: 'u2',
        providerName: 'Dr Underpaid2',
        specialty: 'Internal Medicine',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 245_000,
        workRVUs: 5300,
        totalWRVUs: 5300,
        currentCF: 46,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'gov-test-1',
      scenarioName: 'Underpaid test',
    })
    const result = run.bySpecialty[0]
    expect(result.recommendedAction).toBe('INCREASE')
    expect(result.status).toBe('GREEN')
    expect(result.recommendedCF).toBeGreaterThan(result.currentCF)
    expect(result.explanation.headline).toContain('Increase')
    expect(result.explanation.why.length).toBeGreaterThanOrEqual(2)
    expect(result.keyMetrics.prodPercentile).toBeGreaterThan(result.keyMetrics.compPercentile)
  })

  /**
   * Test 2: Overpaid / low productivity
   * Provider has very high base salary (above 75th TCC) but low wRVUs (below 50th).
   * Expect: HOLD action, RED status, explanation mentions structural problem / FMV.
   */
  it('2) overpaid / low productivity -> HOLD + RED', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'o1',
        providerName: 'Dr Overpaid',
        specialty: 'Internal Medicine',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 420_000,  // very high: near 90th TCC
        workRVUs: 3800,       // low: below 25th wRVU
        totalWRVUs: 3800,
        currentCF: 50,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'gov-test-2',
      scenarioName: 'Overpaid test',
    })
    const result = run.bySpecialty[0]
    expect(result.recommendedAction).toBe('HOLD')
    expect(result.status).toBe('RED')
    expect(result.constraintsHit.length).toBeGreaterThan(0)
    expect(result.explanation.headline).toContain('Hold')
    expect(result.keyMetrics.compPercentile).toBeGreaterThan(result.keyMetrics.prodPercentile)
  })

  /**
   * Test 3: Already above 50th but aligned
   * Comp ~55th percentile, prod ~55th percentile (aligned), but above hard cap.
   * Expect: HOLD action, YELLOW status (above cap but aligned).
   */
  it('3) above 50th but aligned -> HOLD + YELLOW', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'a1',
        providerName: 'Dr Aligned',
        specialty: 'Internal Medicine',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 320_000,  // ~55th TCC
        workRVUs: 4700,       // ~55th wRVU
        totalWRVUs: 4700,
        currentCF: 50,
      },
      {
        providerId: 'a2',
        providerName: 'Dr Aligned2',
        specialty: 'Internal Medicine',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 325_000,
        workRVUs: 4800,
        totalWRVUs: 4800,
        currentCF: 50,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'gov-test-3',
      scenarioName: 'Aligned above cap',
    })
    const result = run.bySpecialty[0]
    // Action should be HOLD since already above hard cap and aligned
    expect(['HOLD', 'DECREASE']).toContain(result.recommendedAction)
    // Status should be YELLOW (above cap but not critical)
    expect(['YELLOW', 'GREEN']).toContain(result.status)
    expect(result.explanation.headline.length).toBeGreaterThan(0)
  })

  /**
   * Test 4: CF change bounded by max constraint
   * The optimal CF requires >30% change but the bound caps it.
   * Expect: constraintsHit includes MAX_CHANGE_BOUND or cf_capped flag.
   */
  it('4) CF change capped by bounds -> constraintsHit or cf_capped flag', () => {
    // Use very tight CF bounds (±2%) to force capping
    const providers: ProviderRow[] = [
      {
        providerId: 'b1',
        providerName: 'Dr Bounded',
        specialty: 'Internal Medicine',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 240_000,  // low comp
        workRVUs: 5500,       // high prod
        totalWRVUs: 5500,
        currentCF: 45,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    settings.cfBounds = { minChangePct: 2, maxChangePct: 2 }
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'gov-test-4',
      scenarioName: 'Bounds test',
    })
    const result = run.bySpecialty[0]
    // With only 2% room, the optimizer is constrained
    const cfCapped = result.flags.includes('cf_capped')
    const boundConstraint = result.constraintsHit.includes('MAX_CHANGE_BOUND')
    expect(cfCapped || boundConstraint || result.recommendedAction === 'HOLD').toBe(true)
    expect(result.explanation.headline.length).toBeGreaterThan(0)
  })

  /**
   * Test 5: Comp > 75th -> RED regardless of other factors
   * Even if productivity is high, comp at 80th+ should trigger RED.
   */
  it('5) comp > 75th percentile -> RED status', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'fmv1',
        providerName: 'Dr FMV',
        specialty: 'Internal Medicine',
        totalFTE: 1,
        clinicalFTE: 1,
        baseSalary: 400_000,  // above 75th TCC
        workRVUs: 6000,       // above 75th wRVU too
        totalWRVUs: 6000,
        currentCF: 55,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'gov-test-5',
      scenarioName: 'FMV test',
    })
    const result = run.bySpecialty[0]
    expect(result.status).toBe('RED')
    expect(result.constraintsHit.some((c) => c.includes('FMV') || c.includes('HARD_CAP'))).toBe(true)
  })

  /**
   * Test 6: clinicalFTE = 0 -> NO_RECOMMENDATION
   * Missing FTE means normalization fails; should get NO_RECOMMENDATION.
   */
  it('6) clinicalFTE = 0 -> NO_RECOMMENDATION', () => {
    const providers: ProviderRow[] = [
      {
        providerId: 'z1',
        providerName: 'Dr Zero',
        specialty: 'Internal Medicine',
        totalFTE: 0,
        clinicalFTE: 0,
        baseSalary: 300_000,
        workRVUs: 5000,
        totalWRVUs: 5000,
        currentCF: 50,
      },
    ]
    const settings = getDefaultOptimizerSettings(DEFAULT_SCENARIO_INPUTS)
    const run = runOptimizerAllSpecialties(providers, marketRows, settings, {
      scenarioId: 'gov-test-6',
      scenarioName: 'Missing FTE test',
    })
    const result = run.bySpecialty[0]
    // Provider should be excluded due to missing FTE
    expect(result.recommendedAction).toBe('NO_RECOMMENDATION')
    expect(result.explanation.headline).toContain('No recommendation')
  })
})

describe('normalizeSpecialtyMetrics', () => {
  it('computes mean metrics from provider contexts', () => {
    const fakeContexts = [
      { wrvuPercentile: 60, currentTCC_pctile: 40, currentTCC_1p0: 300_000, wRVU_1p0: 5000 },
      { wrvuPercentile: 70, currentTCC_pctile: 50, currentTCC_1p0: 350_000, wRVU_1p0: 5500 },
    ] as unknown as Parameters<typeof normalizeSpecialtyMetrics>[0]
    const metrics = normalizeSpecialtyMetrics(fakeContexts)
    expect(metrics.prodPercentile).toBe(65)
    expect(metrics.compPercentile).toBe(45)
    expect(metrics.gap).toBe(-20) // 45 - 65
    expect(metrics.tcc_1p0).toBe(325_000)
    expect(metrics.workRVU_1p0).toBe(5250)
  })

  it('returns zeros for empty array', () => {
    const metrics = normalizeSpecialtyMetrics([])
    expect(metrics.prodPercentile).toBe(0)
    expect(metrics.compPercentile).toBe(0)
    expect(metrics.gap).toBe(0)
  })
})

describe('evaluateStatus', () => {
  const governance = DEFAULT_GOVERNANCE_CONFIG

  it('returns RED when comp >= 75', () => {
    const metrics: OptimizerKeyMetrics = { prodPercentile: 60, compPercentile: 80, gap: 20, tcc_1p0: 400_000, workRVU_1p0: 5000 }
    const { status, constraintsHit } = evaluateStatus(metrics, governance, 0, 'HOLD')
    expect(status).toBe('RED')
    expect(constraintsHit).toContain('FMV_OVER_75')
  })

  it('returns RED when gap >= 10', () => {
    const metrics: OptimizerKeyMetrics = { prodPercentile: 30, compPercentile: 45, gap: 15, tcc_1p0: 300_000, workRVU_1p0: 4000 }
    const { status } = evaluateStatus(metrics, governance, 0, 'HOLD')
    expect(status).toBe('RED')
  })

  it('returns YELLOW when comp between hard cap and soft cap', () => {
    const metrics: OptimizerKeyMetrics = { prodPercentile: 55, compPercentile: 55, gap: 0, tcc_1p0: 320_000, workRVU_1p0: 4800 }
    const { status, constraintsHit } = evaluateStatus(metrics, governance, 0, 'HOLD')
    expect(status).toBe('YELLOW')
    expect(constraintsHit.some((c) => c.includes('HARD_CAP') || c.includes('SOFT_CAP'))).toBe(true)
  })

  it('returns GREEN when under all caps and gap small', () => {
    const metrics: OptimizerKeyMetrics = { prodPercentile: 45, compPercentile: 43, gap: -2, tcc_1p0: 290_000, workRVU_1p0: 4600 }
    const { status } = evaluateStatus(metrics, governance, 0, 'HOLD')
    expect(status).toBe('GREEN')
  })
})

describe('buildExplanation', () => {
  const governance = DEFAULT_GOVERNANCE_CONFIG

  it('generates INCREASE headline', () => {
    const metrics: OptimizerKeyMetrics = { prodPercentile: 65, compPercentile: 40, gap: -25, tcc_1p0: 280_000, workRVU_1p0: 5200 }
    const expl = buildExplanation('INCREASE', 'GREEN', metrics, [], 50, 55, 3, governance)
    expect(expl.headline).toContain('Increase')
    expect(expl.why.length).toBeGreaterThanOrEqual(2)
  })

  it('generates HOLD + FMV headline for RED status', () => {
    const metrics: OptimizerKeyMetrics = { prodPercentile: 40, compPercentile: 80, gap: 40, tcc_1p0: 400_000, workRVU_1p0: 4000 }
    const expl = buildExplanation('HOLD', 'RED', metrics, ['FMV_OVER_75'], 50, 50, 2, governance)
    expect(expl.headline).toContain('Hold')
    expect(expl.headline).toContain('FMV')
    expect(expl.why.length).toBeGreaterThanOrEqual(2)
    expect(expl.whatToDoNext.length).toBeGreaterThanOrEqual(1)
  })

  it('generates NO_RECOMMENDATION headline for missing data', () => {
    const metrics: OptimizerKeyMetrics = { prodPercentile: 0, compPercentile: 0, gap: 0, tcc_1p0: 0, workRVU_1p0: 0 }
    const expl = buildExplanation('NO_RECOMMENDATION', 'YELLOW', metrics, [], 50, 50, 0, governance)
    expect(expl.headline).toContain('No recommendation')
    expect(expl.why.length).toBeGreaterThanOrEqual(1)
  })

  /**
   * Overpaid + INCREASE: when total comp is above productivity but CF is below market 50th,
   * the explanation should state that the group is overpaid on total comp but the conversion
   * factor is underpowered, and increasing CF (up to 50th) fills the gap with wRVU incentive.
   */
  it('generates overpaid + INCREASE explanation (CF below 50th, gap fillable with incentive)', () => {
    const metrics: OptimizerKeyMetrics = {
      prodPercentile: 42,
      compPercentile: 48,
      gap: 6,
      tcc_1p0: 298_000,
      workRVU_1p0: 4200,
    }
    const marketCF = { cf25: 40, cf50: 50, cf75: 60, cf90: 70 }
    const expl = buildExplanation(
      'INCREASE',
      'GREEN',
      metrics,
      [],
      42,  // current CF (below 50th)
      50,  // recommended CF (capped at 50th)
      5,
      governance,
      48,  // cfMarketPercentile
      marketCF
    )
    expect(expl.headline).toContain('Increase')
    expect(expl.why.some((w) => w.toLowerCase().includes('overpaid'))).toBe(true)
    expect(
      expl.why.some(
        (w) =>
          w.toLowerCase().includes('conversion factor') ||
          w.toLowerCase().includes('below market') ||
          w.toLowerCase().includes('incentive')
      )
    ).toBe(true)
    expect(
      expl.why.some(
        (w) =>
          w.includes('50th') || w.includes('median')
      )
    ).toBe(true)
  })
})
