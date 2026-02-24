import { useMemo } from 'react'
import { Target, Play, RotateCcw, FileDown, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ProductivityTargetRunResult, IncentiveDistributionMethod } from '@/types/productivity-target'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import { ProductivityTargetReviewWorkspace } from '@/features/productivity-target/productivity-target-review-workspace'
import { computeTargetOptimizerPercentileRollup } from '@/features/productivity-target/productivity-target-percentiles'
import { formatNumber as formatNum } from '@/utils/format'
import { cn } from '@/lib/utils'

const ALIGNMENT_TOLERANCE = 2

function GapValue({ gap }: { gap: number }) {
  const abs = Math.abs(gap)
  const gapClass =
    abs < ALIGNMENT_TOLERANCE
      ? 'value-positive'
      : gap > 0
        ? 'value-warning'
        : 'value-negative'
  const display = gap > 0 ? `+${formatNum(gap, 1)}` : formatNum(gap, 1)
  return <span className={cn('font-medium tabular-nums', gapClass)}>{display}</span>
}

export function ProductivityTargetRunStage({
  hasData,
  result,
  viewResult,
  incentiveDistributionMethod,
  onIncentiveDistributionMethodChange,
  runDisabled,
  onRun,
  onStartOver,
  onExport,
  providerRows,
  marketRows = [],
  synonymMap = {},
}: {
  hasData: boolean
  result: ProductivityTargetRunResult | null
  viewResult: ProductivityTargetRunResult | null
  incentiveDistributionMethod: IncentiveDistributionMethod
  onIncentiveDistributionMethodChange: (method: IncentiveDistributionMethod) => void
  runDisabled: boolean
  onRun: () => void
  onStartOver: () => void
  onExport: () => void
  providerRows?: ProviderRow[]
  marketRows?: MarketRow[]
  synonymMap?: Record<string, string>
}) {
  const rollup = useMemo(() => {
    if (!result || !providerRows?.length || !marketRows?.length) return null
    return computeTargetOptimizerPercentileRollup(providerRows, marketRows, synonymMap, result)
  }, [result, providerRows, marketRows, synonymMap])

  return (
    <TooltipProvider delayDuration={300}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
              <Target />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="leading-tight">Run and review</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="About Run and review"
                  >
                    <Info className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                  Run again recalculates with current data; Start over returns to configuration. Click a specialty row to open the detail drawer with group target, “how target is set,” and the provider table.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result && hasData ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onRun} disabled={runDisabled} className="gap-2">
                <Play className="size-4" />
                Run
              </Button>
            </div>
          ) : null}

          {result ? (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border/60 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={onRun} disabled={runDisabled} className="gap-2" size="sm">
                    <Play className="size-4" />
                    Run again
                  </Button>
                  <Button type="button" variant="outline" onClick={onStartOver} className="gap-2" size="sm">
                    <RotateCcw className="size-4" />
                    Start over
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onExport} className="gap-2">
                    <FileDown className="size-4" />
                    Export CSV
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium tabular-nums text-foreground">{result.bySpecialty.length}</span> specialties
                  {' · '}
                  <span className="font-medium tabular-nums text-foreground">
                    {result.bySpecialty.reduce((sum, s) => sum + s.providers.length, 0)}
                  </span>{' '}
                  providers
                </span>
                {rollup ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                        <span>Mean TCC %ile: <span className="font-medium tabular-nums text-foreground">{formatNum(rollup.meanTCCPercentile, 1)}</span></span>
                        <span>Mean wRVU %ile: <span className="font-medium tabular-nums text-foreground">{formatNum(rollup.meanWRVUPercentile, 1)}</span></span>
                        <span>Gap: <GapValue gap={rollup.meanTCCPercentile - rollup.meanWRVUPercentile} /></span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[320px] text-xs">
                      Alignment: TCC and wRVU percentiles vs market. Gap = TCC %ile − wRVU %ile; near 0 suggests pay aligned with productivity.
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>

              <ProductivityTargetReviewWorkspace
                result={viewResult ?? result}
                percentilesBySpecialty={rollup?.bySpecialty}
                incentiveDistributionMethod={incentiveDistributionMethod}
                onIncentiveDistributionMethodChange={onIncentiveDistributionMethodChange}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
