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
    <div className={cn('rounded-lg border border-border/60 bg-muted/20 overflow-hidden', className)}>
      <Table className="w-full caption-bottom text-sm">
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            <TableHead className="text-muted-foreground px-3 py-1.5 text-xs font-medium">Metric</TableHead>
            <TableHead className="text-muted-foreground px-3 py-1.5 text-right text-xs font-medium">Current</TableHead>
            <TableHead className="text-muted-foreground px-3 py-1.5 text-right text-xs font-medium">Modeled</TableHead>
            <TableHead className="text-muted-foreground px-3 py-1.5 text-right text-xs font-medium">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-1.5 text-xs font-medium">TCC</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatCurrency(results.currentTCC, { decimals: 0 })}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatCurrency(results.modeledTCC, { decimals: 0 })}
            </TableCell>
            <TableCell
              className={cn(
                'text-right tabular-nums px-3 py-1.5 text-xs font-medium',
                isPositiveDelta && 'text-emerald-600 dark:text-emerald-500',
                isNegativeDelta && 'text-rose-600 dark:text-rose-500'
              )}
            >
              {results.changeInTCC >= 0 ? '+' : ''}
              {formatCurrency(results.changeInTCC, { decimals: 0 })}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-1.5 text-xs font-medium">TCC %ile</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatOrdinal(results.tccPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatOrdinal(results.modeledTCCPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs text-muted-foreground">
              {tccPctileChange !== 0
                ? `${tccPctileChange >= 0 ? '+' : ''}${Math.round(tccPctileChange)}`
                : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-1.5 text-xs font-medium">wRVU %ile</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatOrdinal(results.wrvuPercentile)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatOrdinal(results.wrvuPercentile)}
            </TableCell>
            <TableCell className="text-right px-3 py-1.5 text-xs text-muted-foreground">—</TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-1.5 text-xs font-medium">CF %ile</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatOrdinal(results.cfPercentileCurrent)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatOrdinal(results.cfPercentileModeled)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs text-muted-foreground">
              {cfPctileChange !== 0
                ? `${cfPctileChange >= 0 ? '+' : ''}${Math.round(cfPctileChange)}`
                : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40">
            <TableCell className="px-3 py-1.5 text-xs font-medium">CF ($/wRVU)</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatCurrency(results.currentCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs">
              {formatCurrency(results.modeledCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-1.5 text-xs text-muted-foreground">
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
