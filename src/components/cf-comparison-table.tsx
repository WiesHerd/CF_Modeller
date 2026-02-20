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
            <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">CF %ile</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(cfPercentileCurrent)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatOrdinal(cfPercentileModeled)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm text-muted-foreground">
              {cfPctileChange !== 0 ? `${cfPctileChange >= 0 ? '+' : ''}${Math.round(cfPctileChange)}` : '—'}
            </TableCell>
          </TableRow>
          <TableRow className="border-border/40 bg-muted/30">
            <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">CF ($/wRVU)</TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatCurrency(currentCF)}
            </TableCell>
            <TableCell className="text-right tabular-nums px-3 py-2.5 text-sm">
              {formatCurrency(modeledCF)}
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
