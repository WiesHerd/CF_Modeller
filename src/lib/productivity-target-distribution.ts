/**
 * Post-run incentive distribution for Productivity Target.
 * Applies a distribution method to an existing run result without re-running.
 */

import type {
  IncentiveDistributionMethod,
  ProductivityTargetRunResult,
  ProductivityTargetSpecialtyResult,
  ProductivityTargetProviderResult,
} from '@/types/productivity-target'

function safeDiv(a: number, b: number, fallback: number): number {
  if (b == null || b === 0 || Number.isNaN(b)) return fallback
  const q = a / b
  return Number.isNaN(q) ? fallback : q
}

/**
 * Apply incentive distribution to a run result.
 * Returns a new result with the same structure; only planningIncentiveDollars and totalPlanningIncentiveDollars may change.
 */
export function applyIncentiveDistribution(
  result: ProductivityTargetRunResult,
  method: IncentiveDistributionMethod
): ProductivityTargetRunResult {
  if (method === 'individual') {
    return result
  }

  const bySpecialty: ProductivityTargetSpecialtyResult[] = result.bySpecialty.map((spec) => {
    const providers = spec.providers
    const pool = providers.reduce((sum, p) => sum + (p.planningIncentiveDollars ?? 0), 0)

    if (pool === 0) {
      return spec
    }

    if (method === 'pool_by_wrvu_share') {
      const totalWRVU = providers.reduce((sum, p) => sum + p.actualWRVUs, 0)
      if (totalWRVU <= 0) return spec
      const newProviders: ProductivityTargetProviderResult[] = providers.map((p) => ({
        ...p,
        planningIncentiveDollars: pool * safeDiv(p.actualWRVUs, totalWRVU, 0),
      }))
      const totalPlanningIncentiveDollars = newProviders.reduce(
        (sum, p) => sum + (p.planningIncentiveDollars ?? 0),
        0
      )
      return {
        ...spec,
        providers: newProviders,
        totalPlanningIncentiveDollars,
      }
    }

    // pool_by_wrvu_above_target_share
    const aboveTargetWRVUs = providers.map((p) =>
      Math.max(0, p.actualWRVUs - p.rampedTargetWRVU)
    )
    const totalAbove = aboveTargetWRVUs.reduce((a, b) => a + b, 0)
    if (totalAbove <= 0) return spec
    const newProviders: ProductivityTargetProviderResult[] = providers.map((p, i) => ({
      ...p,
      planningIncentiveDollars: pool * safeDiv(aboveTargetWRVUs[i] ?? 0, totalAbove, 0),
    }))
    const totalPlanningIncentiveDollars = newProviders.reduce(
      (sum, p) => sum + (p.planningIncentiveDollars ?? 0),
      0
    )
    return {
      ...spec,
      providers: newProviders,
      totalPlanningIncentiveDollars,
    }
  })

  return {
    ...result,
    bySpecialty,
  }
}
