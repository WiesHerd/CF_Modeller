import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
      <div className="w-full overflow-auto rounded-md border border-border/70">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[140px]">Specialty</TableHead>
              <TableHead className="text-right min-w-[80px]">wRVU %ile</TableHead>
              <TableHead className="text-right min-w-[80px]">TCC %ile</TableHead>
              <TableHead className="min-w-[120px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted">
                      Pay vs productivity
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    TCC %ile &gt; wRVU %ile = overpaid; wRVU %ile &gt; TCC %ile = underpaid.
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="min-w-[110px]">Recommendation</TableHead>
              <TableHead className="min-w-[160px]">Market line</TableHead>
              <TableHead className="w-12 text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
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
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => onOpenDetail(row)}
                >
                  <TableCell className="font-medium">
                    <div>
                      <p className="truncate">{row.specialty}</p>
                      {divisions ? (
                        <p className="truncate text-xs text-muted-foreground" title={divisions}>
                          {divisions}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercentile(row.keyMetrics.prodPercentile)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercentile(row.keyMetrics.compPercentile)}
                  </TableCell>
                  <TableCell>
                    <span className={gapColor}>
                      {GAP_INTERPRETATION_LABEL[gapInterpretation]}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatRecommendation(row)}
                  </TableCell>
                  <TableCell>
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
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
        </Table>
      </div>
    </TooltipProvider>
  )
}
