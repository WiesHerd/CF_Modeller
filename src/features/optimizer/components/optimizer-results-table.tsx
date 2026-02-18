import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnSizingState,
} from '@tanstack/react-table'
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

const columnHelper = createColumnHelper<OptimizerSpecialtyResult>()

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
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})

  const columns = useMemo(
    () => [
      columnHelper.accessor('specialty', {
        id: 'specialty',
        header: 'Specialty',
        size: 180,
        minSize: 100,
        maxSize: 600,
        cell: ({ row }) => {
          const divisions = [
            ...new Set(
              row.original.providerContexts
                .map((c) => (c.provider.division ?? '').trim())
                .filter(Boolean)
            ),
          ].join(', ')
          return (
            <div>
              <p className="truncate">{row.original.specialty}</p>
              {divisions ? (
                <p className="truncate text-xs text-muted-foreground" title={divisions}>
                  {divisions}
                </p>
              ) : null}
            </div>
          )
        },
      }),
      columnHelper.accessor((r) => r.keyMetrics.prodPercentile, {
        id: 'wrvuPctile',
        header: 'wRVU %ile',
        size: 90,
        minSize: 72,
        maxSize: 140,
        cell: ({ row }) => formatPercentile(row.original.keyMetrics.prodPercentile),
        meta: { align: 'right' },
      }),
      columnHelper.accessor((r) => r.keyMetrics.compPercentile, {
        id: 'tccPctile',
        header: 'TCC %ile',
        size: 90,
        minSize: 72,
        maxSize: 140,
        cell: ({ row }) => formatPercentile(row.original.keyMetrics.compPercentile),
        meta: { align: 'right' },
      }),
      columnHelper.display({
        id: 'payVsProd',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted">Pay vs productivity</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              TCC %ile &gt; wRVU %ile = pay above productivity; wRVU %ile &gt; TCC %ile = underpaid.
            </TooltipContent>
          </Tooltip>
        ),
        size: 140,
        minSize: 100,
        maxSize: 220,
        cell: ({ row }) => {
          const gapInterpretation = getGapInterpretation(row.original.keyMetrics.gap)
          const gapColor =
            gapInterpretation === 'overpaid'
              ? 'text-red-600 dark:text-red-400'
              : gapInterpretation === 'underpaid'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
          return (
            <span className={gapColor}>
              {GAP_INTERPRETATION_LABEL[gapInterpretation]}
            </span>
          )
        },
      }),
      columnHelper.accessor(formatRecommendation, {
        id: 'recommendation',
        header: 'Recommendation',
        size: 140,
        minSize: 100,
        maxSize: 220,
        cell: ({ row }) => formatRecommendation(row.original),
      }),
      columnHelper.display({
        id: 'marketLine',
        header: 'Market line',
        size: 180,
        minSize: 120,
        maxSize: 320,
        cell: ({ row }) =>
          row.original.marketCF ? (
            <MarketCFLine
              currentCF={row.original.currentCF}
              recommendedCF={row.original.recommendedCF}
              marketCF={row.original.marketCF}
            />
          ) : (
            <span className="text-muted-foreground text-xs">No market</span>
          ),
      }),
      columnHelper.display({
        id: 'details',
        header: '',
        size: 48,
        minSize: 48,
        maxSize: 48,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenDetail(row.original)
                }}
                aria-label={`View details for ${row.original.specialty}`}
              >
                <ChevronRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">View details</TooltipContent>
          </Tooltip>
        ),
        meta: { align: 'right' },
      }),
    ],
    [onOpenDetail]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    defaultColumn: { minSize: 48, maxSize: 600 },
  })

  return (
    <TooltipProvider>
      <div
        className="w-full overflow-auto rounded-md border border-border"
        style={{ maxHeight: 'min(70vh, 600px)', minHeight: 0 }}
      >
        <table
          className="w-full caption-bottom text-sm border-collapse table-fixed"
          style={{ width: '100%' }}
        >
          <thead className="sticky top-0 z-30 border-b border-border bg-muted shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] [&_th]:bg-muted [&_th]:text-foreground [&_th]:font-medium">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canResize = header.column.getCanResize()
                  const alignRight = (header.column.columnDef.meta as { align?: string } | undefined)?.align === 'right'
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'relative px-3 py-2.5 whitespace-nowrap',
                        alignRight && 'text-right'
                      )}
                      style={{ width: header.getSize() }}
                    >
                      <div className="overflow-hidden text-ellipsis">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {canResize && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            'absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-primary/30',
                            header.column.getIsResizing() && 'bg-primary'
                          )}
                          title="Drag to resize column"
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </thead>
          <TableBody>
            {table.getRowModel().rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={cn(index % 2 === 1 && 'bg-muted/30', 'cursor-pointer hover:bg-muted/50')}
                onClick={() => onOpenDetail(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const alignRight = (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right'
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'px-3 py-2.5 overflow-hidden',
                        cell.column.id === 'specialty' && 'font-medium',
                        (cell.column.id === 'wrvuPctile' || cell.column.id === 'tccPctile' || cell.column.id === 'recommendation') && 'tabular-nums',
                        alignRight && 'text-right'
                      )}
                      style={{ width: cell.column.getSize() }}
                      onClick={cell.column.id === 'details' ? (e) => e.stopPropagation() : undefined}
                    >
                      <div className="overflow-hidden text-ellipsis">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </TooltipProvider>
  )
}
