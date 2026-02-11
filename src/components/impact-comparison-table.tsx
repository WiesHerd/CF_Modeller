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
    <div className={cn('rounded-xl border border-border/80 bg-card overflow-hidden', className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            <TableHead className="text-muted-foreground font-medium">Metric</TableHead>
            <TableHead className="text-right font-medium">Current</TableHead>
            <TableHead className="text-right font-medium">Modeled</TableHead>
            <TableHead className="text-right font-medium">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-border/40">
            <TableCell className="font-medium">TCC</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(results.currentTCC, { decimals: 0 })}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(results.modeledTCC, { decimals: 0 })}
            </TableCell>
            <TableCell
              className={cn(
                'text-right tabular-nums font-medium',
                isPositiveDelta && 'text-emerald-600 dark:text-emerald-500',
                isNegativeDelta && 'text-rose-600 dark:text-rose-500'
              )}
            >
              {results.changeInTCC >= 0 ? '+' : ''}
              {formatCurrency(results.changeInTCC, { decimals: 0 })}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="font-medium">TCC %ile</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatOrdinal(results.tccPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatOrdinal(results.modeledTCCPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {tccPctileChange !== 0
                ? `${tccPctileChange >= 0 ? '+' : ''}${Math.round(tccPctileChange)}`
                : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="font-medium">wRVU %ile</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatOrdinal(results.wrvuPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatOrdinal(results.wrvuPercentile)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">—</TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="font-medium">CF %ile</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatOrdinal(results.cfPercentileCurrent)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatOrdinal(results.cfPercentileModeled)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {cfPctileChange !== 0
                ? `${cfPctileChange >= 0 ? '+' : ''}${Math.round(cfPctileChange)}`
                : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="font-medium">CF ($/wRVU)</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(results.currentCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(results.modeledCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
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
