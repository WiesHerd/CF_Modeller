import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import type { ProductivityTargetSpecialtyResult } from '@/types/productivity-target'
import type { SpecialtyPercentiles } from '@/features/productivity-target/productivity-target-percentiles'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber as formatNum } from '@/utils/format'

export function ProductivityTargetResultsTable({
  rows,
  onOpenDetail,
  percentilesBySpecialty,
}: {
  rows: ProductivityTargetSpecialtyResult[]
  onOpenDetail: (row: ProductivityTargetSpecialtyResult) => void
  percentilesBySpecialty?: Record<string, SpecialtyPercentiles>
}) {
  return (
    <div className="rounded-md border border-border/80">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Specialty</TableHead>
            <TableHead className="text-right">Group target (1.0 cFTE)</TableHead>
            <TableHead className="text-right">Providers</TableHead>
            <TableHead className="text-right">Mean % to target</TableHead>
            <TableHead className="text-right">Mean TCC %ile</TableHead>
            <TableHead className="text-right">Mean wRVU %ile</TableHead>
            <TableHead className="text-right">Total potential incentive</TableHead>
            <TableHead className="text-right">&lt;80%</TableHead>
            <TableHead className="text-right">80–99%</TableHead>
            <TableHead className="text-right">100–119%</TableHead>
            <TableHead className="text-right">≥120%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const pct = percentilesBySpecialty?.[row.specialty]
            return (
              <TableRow
                key={row.specialty}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  row.warning && 'opacity-70'
                )}
                onClick={() => onOpenDetail(row)}
              >
                <TableCell className="w-8 p-1">
                  <Button variant="ghost" size="icon" className="size-7" aria-label="Open detail">
                    <ChevronRight className="size-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{row.specialty}</span>
                    {row.warning ? (
                      <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">({row.warning})</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.groupTargetWRVU_1cFTE != null ? formatNum(row.groupTargetWRVU_1cFTE, 0) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.providers.length}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNum(row.summary.meanPercentToTarget, 1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {pct != null ? formatNum(pct.meanTCCPercentile, 1) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {pct != null ? formatNum(pct.meanWRVUPercentile, 1) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.totalPlanningIncentiveDollars, { decimals: 0 })}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.summary.bandCounts.below80}</TableCell>
                <TableCell className="text-right tabular-nums">{row.summary.bandCounts.eightyTo99}</TableCell>
                <TableCell className="text-right tabular-nums">{row.summary.bandCounts.hundredTo119}</TableCell>
                <TableCell className="text-right tabular-nums">{row.summary.bandCounts.atOrAbove120}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
