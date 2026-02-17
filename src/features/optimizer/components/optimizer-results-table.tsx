import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { OptimizerSpecialtyResult } from '@/types/optimizer'
import {
  formatPercentile,
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
} from '@/features/optimizer/components/optimizer-constants'
import { MarketCFLine } from '@/features/optimizer/components/market-cf-line'

const RECOMMENDATION_LABEL: Record<string, string> = {
  INCREASE: 'Increase',
  DECREASE: 'Decrease',
  HOLD: 'Hold',
  NO_RECOMMENDATION: 'No recommendation',
}

function formatRecommendation(row: OptimizerSpecialtyResult): string {
  if (row.recommendedAction === 'HOLD' || row.recommendedAction === 'NO_RECOMMENDATION') {
    return RECOMMENDATION_LABEL[row.recommendedAction] ?? row.recommendedAction
  }
  const pct = row.cfChangePct >= 0 ? `+${row.cfChangePct.toFixed(1)}%` : `${row.cfChangePct.toFixed(1)}%`
  return `${RECOMMENDATION_LABEL[row.recommendedAction] ?? row.recommendedAction} ${pct}`
}

export function OptimizerResultsTable({
  rows,
  onOpenDetail,
}: {
  rows: OptimizerSpecialtyResult[]
  onOpenDetail: (row: OptimizerSpecialtyResult) => void
}) {
  return (
    <TooltipProvider>
      <div className="w-full overflow-auto rounded-md border border-border" style={{ maxHeight: 'min(70vh, 600px)', minHeight: 0 }}>
        <table className="w-full caption-bottom text-sm border-collapse">
          <thead className="sticky top-0 z-30 border-b border-border bg-muted shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] [&_th]:whitespace-nowrap [&_th]:bg-muted [&_th]:text-foreground [&_th]:font-medium">
            <TableRow>
              <TableHead className="min-w-[140px] px-3 py-2.5">Specialty</TableHead>
              <TableHead className="text-right min-w-[80px] px-3 py-2.5">wRVU %ile</TableHead>
              <TableHead className="text-right min-w-[80px] px-3 py-2.5">TCC %ile</TableHead>
              <TableHead className="min-w-[120px] px-3 py-2.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted">
                      Pay vs productivity
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    TCC %ile &gt; wRVU %ile = pay above productivity; wRVU %ile &gt; TCC %ile = underpaid.
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="min-w-[110px] px-3 py-2.5">Recommendation</TableHead>
              <TableHead className="min-w-[160px] px-3 py-2.5">Market line</TableHead>
              <TableHead className="w-12 text-right px-3 py-2.5">Details</TableHead>
            </TableRow>
          </thead>
          <TableBody>
            {rows.map((row, index) => {
              const gapInterpretation = getGapInterpretation(row.keyMetrics.gap)
              const gapColor =
                gapInterpretation === 'overpaid'
                  ? 'text-red-600 dark:text-red-400'
                  : gapInterpretation === 'underpaid'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
              const divisions = [
                ...new Set(
                  row.providerContexts
                    .map((c) => (c.provider.division ?? '').trim())
                    .filter(Boolean)
                ),
              ].join(', ')

              return (
                <TableRow
                  key={row.specialty}
                  className={cn(index % 2 === 1 && 'bg-muted/30', 'cursor-pointer hover:bg-muted/50')}
                  onClick={() => onOpenDetail(row)}
                >
                  <TableCell className="font-medium px-3 py-2.5">
                    <div>
                      <p className="truncate">{row.specialty}</p>
                      {divisions ? (
                        <p className="truncate text-xs text-muted-foreground" title={divisions}>
                          {divisions}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">
                    {formatPercentile(row.keyMetrics.prodPercentile)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">
                    {formatPercentile(row.keyMetrics.compPercentile)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className={gapColor}>
                      {GAP_INTERPRETATION_LABEL[gapInterpretation]}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums px-3 py-2.5">
                    {formatRecommendation(row)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {row.marketCF ? (
                      <MarketCFLine
                        currentCF={row.currentCF}
                        recommendedCF={row.recommendedCF}
                        marketCF={row.marketCF}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">No market</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => onOpenDetail(row)}
                          aria-label={`View details for ${row.specialty}`}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">View details</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </table>
      </div>
    </TooltipProvider>
  )
}
