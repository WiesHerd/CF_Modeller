import type { ExclusionReason, OptimizerFlag, PolicyCheckStatus } from '@/types/optimizer'

export const POLICY_CHIP: Record<
  PolicyCheckStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  ok: { label: 'OK', variant: 'default' },
  above_50: { label: '>50', variant: 'secondary' },
  above_75: { label: '>75', variant: 'destructive' },
  above_90: { label: '>90', variant: 'destructive' },
}

export const FLAG_LABELS: Record<OptimizerFlag, string> = {
  outliers_excluded: 'Outliers excluded',
  off_scale: 'Off-scale',
  low_sample: 'Low sample',
  fmv_risk: 'FMV risk',
  not_converged: 'Not converged',
  cf_capped: 'CF capped at bound',
}

export const EXCLUSION_REASON_LABELS: Record<ExclusionReason, string> = {
  no_benchmarkable_fte_basis: 'No benchmarkable FTE basis',
  basis_fte_below_min: 'Basis FTE below min',
  loa_flagged: 'LOA flagged',
  new_hire_below_threshold: 'New hire below threshold',
  outlier_wrvu: 'Outlier (wRVU)',
  outlier_tcc: 'Outlier (TCC)',
  outlier_effective_rate: 'Outlier (effective rate)',
  manual_exclude: 'Manual exclude',
  missing_market: 'Missing market',
  low_wrvu_volume: 'Low wRVU per 1.0 cFTE',
}

export function formatPercentile(p: number): string {
  if (p < 25) return `<25 (${p.toFixed(1)})`
  if (p > 90) return `>90 (${p.toFixed(1)})`
  return p.toFixed(1)
}

/** Tolerance (in percentile points) for considering pay and productivity "aligned". */
export const GAP_ALIGNMENT_TOLERANCE = 3

export type GapInterpretation = 'overpaid' | 'underpaid' | 'aligned'

/**
 * Interpret gap = TCC percentile − wRVU percentile.
 * - Positive gap: TCC > wRVU → group is overpaid relative to productivity.
 * - Negative gap: wRVU > TCC → group is underpaid relative to productivity.
 * - Near zero: aligned.
 */
export function getGapInterpretation(gap: number): GapInterpretation {
  if (Math.abs(gap) <= GAP_ALIGNMENT_TOLERANCE) return 'aligned'
  return gap > 0 ? 'overpaid' : 'underpaid'
}

export const GAP_INTERPRETATION_LABEL: Record<GapInterpretation, string> = {
  overpaid: 'Overpaid vs productivity',
  underpaid: 'Underpaid vs productivity',
  aligned: 'Aligned',
}
