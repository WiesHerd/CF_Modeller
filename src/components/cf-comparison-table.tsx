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

interface CFComparisonTableProps {
  cfPercentileCurrent: number
  cfPercentileModeled: number
  currentCF: number
  modeledCF: number
  className?: string
}

export function CFComparisonTable({
  cfPercentileCurrent,
  cfPercentileModeled,
  currentCF,
  modeledCF,
  className,
}: CFComparisonTableProps) {
  const cfPctileChange = cfPercentileModeled - cfPercentileCurrent
  const cfDollarChange = modeledCF - currentCF

  return (
    <div className={cn('rounded-lg border border-border/60 bg-muted/20 overflow-hidden', className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border/40 hover:bg-transparent">
            <TableHead className="text-muted-foreground h-8 text-xs font-medium">Metric</TableHead>
            <TableHead className="text-muted-foreground h-8 text-right text-xs font-medium">Current</TableHead>
            <TableHead className="text-muted-foreground h-8 text-right text-xs font-medium">Modeled</TableHead>
            <TableHead className="text-muted-foreground h-8 text-right text-xs font-medium">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-border/30">
            <TableCell className="py-1.5 text-xs font-medium">CF %ile</TableCell>
            <TableCell className="text-right tabular-nums text-xs py-1.5">
              {formatOrdinal(cfPercentileCurrent)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs py-1.5">
              {formatOrdinal(cfPercentileModeled)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
              {cfPctileChange !== 0 ? `${cfPctileChange >= 0 ? '+' : ''}${Math.round(cfPctileChange)}` : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/30">
            <TableCell className="py-1.5 text-xs font-medium">CF ($/wRVU)</TableCell>
            <TableCell className="text-right tabular-nums text-xs py-1.5">
              {formatCurrency(currentCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs py-1.5">
              {formatCurrency(modeledCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
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
