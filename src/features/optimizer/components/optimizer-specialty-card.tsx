import { useMemo, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { OptimizerRecommendedAction, OptimizerSpecialtyResult } from '@/types/optimizer'
import { MarketCFRuler } from '@/features/optimizer/components/market-cf-line'
import { MetricRail } from '@/features/optimizer/components/metric-rail'
import { StatusPill } from '@/features/optimizer/components/status-pill'
import {
  FLAG_LABELS,
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
} from '@/features/optimizer/components/optimizer-constants'
import { FlagChip, PolicyChip } from '@/features/optimizer/components/constraint-chip'

const ACTION_ICON: Record<OptimizerRecommendedAction, ReactNode> = {
  INCREASE: <TrendingUp className="size-4" />,
  DECREASE: <TrendingDown className="size-4" />,
  HOLD: <Minus className="size-4" />,
  NO_RECOMMENDATION: <Info className="size-4" />,
}

const ACTION_LABEL: Record<OptimizerRecommendedAction, string> = {
  INCREASE: 'Increase',
  DECREASE: 'Decrease',
  HOLD: 'Hold',
  NO_RECOMMENDATION: 'No recommendation',
}

export function OptimizerSpecialtyCard({
  result,
  onOpenDrilldown,
}: {
  result: OptimizerSpecialtyResult
  onOpenDrilldown: (specialty: string) => void
}) {
  const [showEvidence, setShowEvidence] = useState(false)
  const divisions = useMemo(
    () =>
      [...new Set(result.providerContexts.map((c) => (c.provider.division ?? '').trim()).filter(Boolean))].join(
        ', '
      ),
    [result.providerContexts]
  )

  const confidence = result.includedCount >= 10 ? 'High' : result.includedCount >= 5 ? 'Medium' : 'Low'

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{result.specialty}</CardTitle>
            {divisions ? <p className="truncate pt-1 text-xs text-muted-foreground">{divisions}</p> : null}
          </div>
          <StatusPill status={result.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <div className="grid gap-2 rounded-md border border-border/70 bg-background p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Recommended action</p>
            <p className="inline-flex items-center gap-1.5 font-medium">
              {ACTION_ICON[result.recommendedAction]}
              {ACTION_LABEL[result.recommendedAction]}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CF shift</p>
            <p className="font-medium tabular-nums">
              ${result.currentCF.toFixed(2)} &rarr; ${result.recommendedCF.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pay vs productivity</p>
            <p className="font-medium tabular-nums">
              {result.keyMetrics.gap > 0 ? '+' : ''}
              {result.keyMetrics.gap.toFixed(1)} pts · {GAP_INTERPRETATION_LABEL[getGapInterpretation(result.keyMetrics.gap)]}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="font-medium">{confidence}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <PolicyChip policy={result.policyCheck} />
          <span className={result.cfChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            {result.cfChangePct >= 0 ? '+' : ''}
            {result.cfChangePct.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">Budget:</span>
          <span className="tabular-nums">
            {result.spendImpactRaw > 0 ? '+' : ''}${Math.round(result.spendImpactRaw).toLocaleString('en-US')}
          </span>
          <span className="text-muted-foreground">In scope:</span>
          <span>{result.includedCount}</span>
        </div>

        <p className="text-sm font-medium leading-snug">{result.explanation.headline}</p>

        {result.marketCF ? (
          <MarketCFRuler
            currentCF={result.currentCF}
            recommendedCF={result.recommendedCF}
            marketCF={result.marketCF}
            cfPercentile={result.cfPolicyPercentile}
          />
        ) : null}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Gap = TCC %ile − wRVU %ile. Positive = pay above productivity; negative = underpaid.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricRail label="Work RVU percentile" value={result.keyMetrics.prodPercentile} />
            <MetricRail label="Total cash compensation percentile" value={result.keyMetrics.compPercentile} />
          </div>
        </div>

        {result.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {result.flags.map((flag) => (
              <FlagChip key={flag} label={FLAG_LABELS[flag]} />
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowEvidence((v) => !v)}
          >
            {showEvidence ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {showEvidence ? 'Hide evidence' : 'View evidence'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenDrilldown(result.specialty)}
          >
            Provider drilldown
          </Button>
          <Badge variant="secondary" className="ml-auto">
            {confidence} confidence
          </Badge>
        </div>

        {showEvidence ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
            {result.explanation.why.length > 0 ? (
              <ul className="space-y-1.5">
                {result.explanation.why.slice(0, 3).map((bullet, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    - {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.explanation.whatToDoNext.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next steps</p>
                {result.explanation.whatToDoNext.map((item, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">
                    {item}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
