import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCurrency, formatOrdinal } from '@/utils/format'
import type { ScenarioResults } from '@/types/scenario'

interface ImpactComparisonTableProps {
  results: ScenarioResults
  className?: string
}

export function ImpactComparisonTable({ results, className }: ImpactComparisonTableProps) {
  const isPositiveDelta = results.changeInTCC > 0
  const isNegativeDelta = results.changeInTCC < 0
  const tccPctileChange = results.modeledTCCPercentile - results.tccPercentile
  const cfPctileChange = results.cfPercentileModeled - results.cfPercentileCurrent
  const cfDollarChange = results.modeledCF - results.currentCF

  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      <Table className="w-full caption-bottom text-sm">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/80 hover:bg-muted/80">
            <TableHead className="text-foreground px-3 py-2.5 text-sm font-semibold">Metric</TableHead>
            <TableHead className="text-foreground px-3 py-2.5 text-right text-sm font-semibold">Current</TableHead>
            <TableHead className="text-foreground px-3 py-2.5 text-right text-sm font-semibold">Modeled</TableHead>
            <TableHead className="text-foreground px-3 py-2.5 text-right text-sm font-semibold">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">TCC</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatCurrency(results.currentTCC, { decimals: 0 })}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatCurrency(results.modeledTCC, { decimals: 0 })}
            </TableCell>
            <TableCell
              className={cn(
                'text-right tabular-nums px-3 py-2.5 text-sm font-medium',
                isPositiveDelta && 'value-positive',
                isNegativeDelta && 'value-negative'
              )}
            >
              {results.changeInTCC >= 0 ? '+' : ''}
              {formatCurrency(results.changeInTCC, { decimals: 0 })}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40 bg-muted/30">
            <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">TCC %ile</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(results.tccPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(results.modeledTCCPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm text-muted-foreground">
              {tccPctileChange !== 0
                ? `${tccPctileChange >= 0 ? '+' : ''}${Math.round(tccPctileChange)}`
                : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">wRVU %ile</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(results.wrvuPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(results.wrvuPercentile)}
            </TableCell>
            <TableCell className="text-right px-3 py-2.5 text-sm text-muted-foreground">—</TableCell>
          </TableRow>
          <TableRow className="border-border/40 bg-muted/30">
            <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">CF %ile</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(results.cfPercentileCurrent)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(results.cfPercentileModeled)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm text-muted-foreground">
              {cfPctileChange !== 0
                ? `${cfPctileChange >= 0 ? '+' : ''}${Math.round(cfPctileChange)}`
                : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">CF ($/wRVU)</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatCurrency(results.currentCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatCurrency(results.modeledCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm text-muted-foreground">
              {cfDollarChange !== 0
                ? `${cfDollarChange >= 0 ? '+' : ''}${formatCurrency(cfDollarChange)}`
                : '—'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
