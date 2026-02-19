import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'
import type { ScenarioResults } from '@/types/scenario'

interface ImpactHeadlineProps {
  results: ScenarioResults
  /** Optional one-line summary of what drove the change (e.g. "Incentive and PSQ drive the increase"). */
  summary?: string
  /** When true, render without Card wrapper (e.g. for impact report hero). */
  minimal?: boolean
}

export function ImpactHeadline({ results, summary, minimal }: ImpactHeadlineProps) {
  const { changeInTCC, currentTCC } = results
  const isPositive = changeInTCC > 0
  const isNegative = changeInTCC < 0
  const isZero = changeInTCC === 0

  const pctChange =
    currentTCC > 0
      ? (changeInTCC / currentTCC) * 100
      : 0
  const pctText = Number.isFinite(pctChange)
    ? `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%`
    : '—'

  const amountText =
    isZero
      ? 'No change'
      : `${isPositive ? '+' : ''}${formatCurrency(changeInTCC, { decimals: 0 })}`

  const content = (
    <>
      <p className="text-muted-foreground mb-1 text-sm font-medium uppercase tracking-wider">
        Total compensation impact
      </p>
      <p
        className={cn(
          'tabular-nums text-3xl font-bold tracking-tight sm:text-4xl',
          isPositive && 'value-positive',
          isNegative && 'value-negative',
          isZero && 'text-foreground'
        )}
        aria-label={`Change in total cash compensation: ${amountText} ${pctText}`}
      >
        {amountText}
        <span className="text-foreground/80 ml-2 text-2xl font-semibold sm:ml-3 sm:text-3xl">
          ({pctText})
        </span>
      </p>
      {summary && (
        <p className="text-muted-foreground mt-2 text-sm">{summary}</p>
      )}
    </>
  )

  if (minimal) {
    return (
      <div className="py-0.5">
        <p
          className={cn(
            'tabular-nums text-xl font-bold tracking-tight sm:text-2xl',
            isPositive && 'value-positive',
            isNegative && 'value-negative',
            isZero && 'text-foreground'
          )}
          aria-label={`Change in total cash compensation: ${amountText} ${pctText}`}
        >
          {amountText}
          <span className="text-foreground/80 ml-1.5 text-lg font-semibold sm:ml-2 sm:text-xl">
            ({pctText})
          </span>
          {summary && (
            <span className="text-muted-foreground ml-2 text-sm font-normal sm:ml-3">
              — {summary}
            </span>
          )}
        </p>
      </div>
    )
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-2 border-border shadow-sm">
      <CardContent className="py-6">{content}</CardContent>
    </Card>
  )
}
