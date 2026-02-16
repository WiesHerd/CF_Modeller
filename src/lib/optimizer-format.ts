/**
 * Shared formatters for optimizer-related display (Compare Scenarios, export, configure stage).
 */

import type { BudgetConstraint } from '@/types/optimizer'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)
}

/** Format budget constraint for display (e.g. "None", "Cap 5%", "Cap $1,000,000"). */
export function formatBudgetConstraint(b: BudgetConstraint): string {
  if (b.kind === 'none') return 'None'
  if (b.kind === 'neutral') return 'Neutral'
  if (b.kind === 'cap_pct' && b.capPct != null) return `Cap ${b.capPct}%`
  if (b.kind === 'cap_dollars' && b.capDollars != null) return `Cap ${formatCurrency(b.capDollars)}`
  return b.kind
}
