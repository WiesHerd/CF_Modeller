import { cn } from '@/lib/utils'
import { DeltaIndicator, fmtMoney } from '@/components/delta-indicator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ScenarioResults } from '@/types/scenario'

const VALUE_CELL_WIDTH = '7.5rem'

const NINETIETH_PERCENTILE = 90

function fmtPct(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${Math.round(n)}${suffix}`
}

/** For comp review: when percentile > 90th, show how much over as a percentage (e.g. "11% over 90th"). */
function over90thLabel(percentile: number): string | null {
  if (percentile <= NINETIETH_PERCENTILE) return null
  const pctOver = ((percentile - NINETIETH_PERCENTILE) / NINETIETH_PERCENTILE) * 100
  const rounded = pctOver < 1 ? pctOver.toFixed(1) : Math.round(pctOver)
  return `${rounded}% over 90th`
}

interface MarketPositionTableProps {
  results: ScenarioResults | null
}

export function MarketPositionTable({ results }: MarketPositionTableProps) {
  if (!results) {
    return (
      <Card className="overflow-hidden rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-0 pt-6">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Market position
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <p className="text-muted-foreground py-8 text-center text-sm">
            Select a provider and market to see market position.
          </p>
        </CardContent>
      </Card>
    )
  }

  const {
    wrvuPercentile,
    cfPercentileCurrent,
    tccPercentile,
    cfPercentileModeled,
    modeledTCCPercentile,
    imputedTCCPerWRVURatioCurrent,
    imputedTCCPerWRVURatioModeled,
    alignmentGapBaseline,
    alignmentGapModeled,
  } = results

  const deltaCF = cfPercentileModeled - cfPercentileCurrent
  const deltaTCC = modeledTCCPercentile - tccPercentile
  const deltaImputed = imputedTCCPerWRVURatioModeled - imputedTCCPerWRVURatioCurrent
  const deltaGap = alignmentGapModeled - alignmentGapBaseline

  const rows: {
    metric: string
    baseline: React.ReactNode
    modeled: React.ReactNode
    delta: number
    deltaFormat: 'number' | 'currency'
    isChanged?: boolean
  }[] = [
    {
      metric: 'wRVU Percentile',
      baseline: fmtPct(wrvuPercentile),
      modeled: fmtPct(wrvuPercentile),
      delta: 0,
      deltaFormat: 'number',
    },
    {
      metric: 'CF Percentile',
      baseline: fmtPct(cfPercentileCurrent),
      modeled: fmtPct(cfPercentileModeled),
      delta: deltaCF,
      deltaFormat: 'number',
      isChanged: deltaCF !== 0,
    },
    {
      metric: 'TCC Percentile',
      baseline: (() => {
        const over = over90thLabel(tccPercentile)
        return (
          <span className="inline-flex flex-col items-end">
            <span>{fmtPct(tccPercentile)}</span>
            {over && (
              <span className="text-destructive/90 text-xs font-medium">{over}</span>
            )}
          </span>
        )
      })(),
      modeled: (() => {
        const over = over90thLabel(modeledTCCPercentile)
        return (
          <span className="inline-flex flex-col items-end">
            <span>{fmtPct(modeledTCCPercentile)}</span>
            {over && (
              <span className="text-destructive/90 text-xs font-medium">{over}</span>
            )}
          </span>
        )
      })(),
      delta: deltaTCC,
      deltaFormat: 'number',
      isChanged: deltaTCC !== 0,
    },
    {
      metric: 'Imputed TCC per wRVU',
      baseline:
        imputedTCCPerWRVURatioCurrent > 0
          ? fmtMoney(imputedTCCPerWRVURatioCurrent)
          : '—',
      modeled:
        imputedTCCPerWRVURatioModeled > 0
          ? fmtMoney(imputedTCCPerWRVURatioModeled)
          : '—',
      delta: deltaImputed,
      deltaFormat: 'currency',
      isChanged: deltaImputed !== 0,
    },
    {
      metric: 'Alignment Gap (TCC − wRVU)',
      baseline:
        alignmentGapBaseline > 0
          ? `+${Math.round(alignmentGapBaseline)}`
          : String(Math.round(alignmentGapBaseline)),
      modeled:
        alignmentGapModeled > 0
          ? `+${Math.round(alignmentGapModeled)}`
          : String(Math.round(alignmentGapModeled)),
      delta: deltaGap,
      deltaFormat: 'number',
      isChanged: deltaGap !== 0,
    },
  ]

  return (
    <Card className="overflow-hidden rounded-2xl border-2 border-border shadow-sm">
      <CardHeader className="pb-0 pt-6">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">
          Market position
        </CardTitle>
        <p className="text-muted-foreground mt-1 text-xs font-normal">
          Baseline vs. modeled — for compensation and alignment review
        </p>
      </CardHeader>
      <CardContent className="px-4 py-0 md:px-6">
        <Table className="table-fixed w-full border-collapse border border-border">
          <colgroup>
            <col style={{ width: '50%' }} />
            <col style={{ width: '50%' }} />
            <col style={{ width: VALUE_CELL_WIDTH }} />
          </colgroup>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                <span className="text-muted-foreground text-xs uppercase tracking-wider">
                  CURRENT (Baseline)
                </span>
              </TableHead>
              <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                <span className="text-muted-foreground text-xs uppercase tracking-wider">
                  MODELED (Scenario)
                </span>
              </TableHead>
              <TableHead
                className="border-border/80 bg-muted/20 px-3 py-3 text-right font-semibold md:px-4"
                style={{ width: VALUE_CELL_WIDTH }}
              >
                <span className="text-muted-foreground text-xs uppercase tracking-wider">
                  Variance
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.metric}
                className={cn(
                  'border-border hover:bg-transparent',
                  row.isChanged && 'bg-muted/25'
                )}
              >
                <TableCell className="border-border/80 bg-muted/20 px-4 py-3 align-middle md:border-r md:px-6">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <Label className="text-muted-foreground shrink-0 text-sm font-medium">
                      {row.metric}
                    </Label>
                    <div
                      className="tabular-nums sm:text-right"
                      style={{ minWidth: VALUE_CELL_WIDTH, width: VALUE_CELL_WIDTH }}
                    >
                      {row.baseline}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="border-border/80 px-4 py-3 align-middle md:border-r md:px-6">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                    <Label className="text-muted-foreground shrink-0 text-sm font-medium sm:min-w-0">
                      {row.metric}
                    </Label>
                    <div
                      className="shrink-0 tabular-nums text-right"
                      style={{ width: VALUE_CELL_WIDTH }}
                    >
                      {row.modeled}
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="border-border/60 px-3 py-3 text-right tabular-nums md:px-4"
                  style={{ width: VALUE_CELL_WIDTH }}
                >
                  <DeltaIndicator delta={row.delta} format={row.deltaFormat} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground/80 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 px-1 py-2 text-[10px]">
          <span>↑ increase</span>
          <span>↓ decrease</span>
          <span>— no change</span>
        </p>
      </CardContent>
    </Card>
  )
}
