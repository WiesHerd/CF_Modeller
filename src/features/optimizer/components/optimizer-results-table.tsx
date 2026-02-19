import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnSizingState,
  type ColumnOrderState,
  type VisibilityState,
  type ColumnPinningState,
} from '@tanstack/react-table'
import { ChevronRight, GripVertical, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/format'
import type { OptimizerSpecialtyResult } from '@/types/optimizer'
import {
  formatPercentile,
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
} from '@/features/optimizer/components/optimizer-constants'
import { MarketCFLine } from '@/features/optimizer/components/market-cf-line'

const columnHelper = createColumnHelper<OptimizerSpecialtyResult>()

const COLUMN_HEADER_LABELS: Record<string, string> = {
  specialty: 'Specialty',
  wrvuPctile: 'wRVU %ile',
  tccPctile: 'TCC %ile',
  payVsProd: 'Pay vs productivity',
  recommendation: 'Recommendation',
  recommendedCf: 'Recommended CF',
  marketLine: 'Market line',
  details: 'Details',
}

const RECOMMENDATION_LABEL: Record<string, string> = {
  INCREASE: 'Increase',
  DECREASE: 'Decrease',
  HOLD: 'Hold',
  NO_RECOMMENDATION: 'No recommendation',
}

const QUICK_RUN_RESULTS_TABLE_LAYOUT_KEY = 'quick-run-results-table-layout-v1'

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
  const loadSavedLayout = useCallback(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(QUICK_RUN_RESULTS_TABLE_LAYOUT_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<{
        columnOrder: ColumnOrderState
        columnSizing: ColumnSizingState
        columnVisibility: VisibilityState
        columnPinning: ColumnPinningState
      }>
      return parsed
    } catch {
      return null
    }
  }, [])
  const savedLayout = useMemo(() => loadSavedLayout(), [loadSavedLayout])

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(savedLayout?.columnOrder ?? [])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(savedLayout?.columnSizing ?? {})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(savedLayout?.columnVisibility ?? {})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(savedLayout?.columnPinning ?? { left: [], right: [] })
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const dragColIdRef = useRef<string | null>(null)
  const measureRef = useRef<HTMLSpanElement>(null)

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
              ? 'value-negative'
              : gapInterpretation === 'underpaid'
                ? 'value-positive'
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
        size: 160,
        minSize: 100,
        maxSize: 220,
        cell: ({ row }) => {
          const rec = row.original.recommendedAction
          const tone =
            rec === 'INCREASE'
              ? 'value-positive'
              : rec === 'DECREASE'
                ? 'value-negative'
                : rec === 'HOLD'
                  ? 'value-neutral'
                  : 'value-warning'
          return <span className={tone}>{formatRecommendation(row.original)}</span>
        },
      }),
      columnHelper.accessor((r) => r.recommendedCF, {
        id: 'recommendedCf',
        header: 'Recommended CF',
        size: 110,
        minSize: 88,
        maxSize: 140,
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {formatCurrency(row.original.recommendedCF)}
          </span>
        ),
        meta: { align: 'right' },
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
        enableResizing: false,
        enableHiding: false,
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
    state: { columnOrder, columnSizing, columnVisibility, columnPinning },
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    defaultColumn: { minSize: 48, maxSize: 600 },
  })

  const visibleColumnCount = table.getVisibleLeafColumns().length

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        QUICK_RUN_RESULTS_TABLE_LAYOUT_KEY,
        JSON.stringify({
          columnOrder,
          columnSizing,
          columnVisibility,
          columnPinning,
        })
      )
    } catch {
      // Ignore storage errors (private mode/quota).
    }
  }, [columnOrder, columnSizing, columnVisibility, columnPinning])

  const getOrderedColumnIds = useCallback(() => {
    const order = table.getState().columnOrder
    if (order?.length) return order
    return table.getAllLeafColumns().map((c) => c.id)
  }, [table])

  const handleHeaderDragStart = useCallback((columnId: string) => {
    dragColIdRef.current = columnId
    setDraggedColId(columnId)
  }, [])

  const handleHeaderDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    if (dragColIdRef.current === columnId) return
    setDropTargetColId(columnId)
  }, [])

  const handleHeaderDrop = useCallback(() => {
    const dragged = dragColIdRef.current
    if (!dragged) return
    const ordered = getOrderedColumnIds()
    const fromIdx = ordered.indexOf(dragged)
    const toIdx = dropTargetColId ? ordered.indexOf(dropTargetColId) : fromIdx
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      setDraggedColId(null)
      setDropTargetColId(null)
      dragColIdRef.current = null
      return
    }
    const next = [...ordered]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragged)
    setColumnOrder(next)
    setDraggedColId(null)
    setDropTargetColId(null)
    dragColIdRef.current = null
  }, [dropTargetColId, getOrderedColumnIds])

  const handleHeaderDragEnd = useCallback(() => {
    setDraggedColId(null)
    setDropTargetColId(null)
    dragColIdRef.current = null
  }, [])


  return (
    <TooltipProvider>
      {/* Hidden element for measuring text width */}
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute opacity-0 whitespace-nowrap"
        style={{ visibility: 'hidden', position: 'absolute' }}
      />

      <div className="rounded-md border flex flex-col">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60 bg-muted shrink-0">
          <div />
          <div className="flex gap-0.5">
            {/* Show / hide columns */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Column visibility">
                      <LayoutList className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Show / hide columns</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {table.getAllLeafColumns()
                  .filter((col) => col.columnDef.enableHiding !== false)
                  .map((col) => {
                    const visible = col.getIsVisible()
                    const isOnly = visible && visibleColumnCount <= 2
                    return (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={visible}
                        disabled={isOnly}
                        onCheckedChange={(v) => col.toggleVisibility(!!v)}
                      >
                        {COLUMN_HEADER_LABELS[col.id] ?? col.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          className="rounded-b-md border border-t-0 border-border overflow-x-auto overflow-y-auto min-h-0 bg-background isolate"
          style={{ maxHeight: 'min(70vh, 600px)' }}
        >
        <table
          className="w-full caption-bottom text-sm border-collapse"
          style={{ minWidth: 'max-content' }}
        >
          <thead className="sticky top-0 z-30 border-b border-border bg-muted shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] [&_th]:bg-muted [&_th]:text-foreground [&_th]:font-medium">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers
                  .filter((h) => h.column.getIsVisible())
                  .map((header) => {
                    const canResize = header.column.getCanResize()
                    const alignRight = (header.column.columnDef.meta as { align?: string } | undefined)?.align === 'right'
                    const isPinned = header.column.getIsPinned() === 'left'
                    const colId = header.column.id
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          'relative px-3 py-2.5 whitespace-nowrap',
                          alignRight && 'text-right',
                          isPinned && 'sticky left-0 z-20 bg-muted shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]',
                          draggedColId === colId && 'opacity-60',
                          dropTargetColId === colId && 'ring-1 ring-primary'
                        )}
                        style={{ width: header.getSize(), minWidth: header.getSize(), maxWidth: header.getSize() }}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            draggable
                            onDragStart={() => handleHeaderDragStart(colId)}
                            onDragOver={(e) => handleHeaderDragOver(e, colId)}
                            onDrop={handleHeaderDrop}
                            onDragEnd={handleHeaderDragEnd}
                            className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-muted-foreground/20 shrink-0"
                            title="Drag to reorder"
                          >
                            <GripVertical className="size-4 text-muted-foreground" />
                          </span>
                          <div className="overflow-hidden text-ellipsis min-w-0">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
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
                  const isPinned = cell.column.getIsPinned() === 'left'
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'px-3 py-2.5 overflow-hidden',
                        cell.column.id === 'specialty' && 'font-medium',
                        (cell.column.id === 'wrvuPctile' || cell.column.id === 'tccPctile' || cell.column.id === 'recommendation' || cell.column.id === 'recommendedCf') && 'tabular-nums',
                        alignRight && 'text-right',
                        isPinned && 'sticky left-0 z-10 bg-background shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]'
                      )}
                      style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() }}
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
      </div>
    </TooltipProvider>
  )
}
