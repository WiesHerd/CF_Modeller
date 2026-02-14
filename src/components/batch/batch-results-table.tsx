import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type ColumnOrderState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import { useState, useMemo, useRef, useCallback, type ReactNode, type ReactElement } from 'react'
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/utils/format'
import type { BatchRowResult } from '@/types/batch'

const columnHelper = createColumnHelper<BatchRowResult>()

const EMPTY = '—'

function numOrEmpty(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatNumber(n, 2)
}

function curOrEmpty(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatCurrency(n, { decimals: 0 })
}

export type CalculationColumnId = 'incentive' | 'tccPercentile' | 'modeledTCCPercentile' | 'wrvuPercentile'

interface BatchResultsTableProps {
  rows: BatchRowResult[]
  /** Optional filter applied externally (e.g. filtered rows from dashboard). */
  maxHeight?: string
  /** When set, Incentive / TCC %tile / Modeled TCC %tile / wRVU %tile cells are clickable to open calculation details. */
  onCalculationClick?: (row: BatchRowResult, column: CalculationColumnId) => void
}

function CalculationCellButton({
  children,
  onClick,
  className,
  title,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
  title?: string
}): ReactElement {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation()
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'cursor-pointer text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded',
        className
      )}
      title={title ?? 'See how this is calculated'}
    >
      {children}
    </button>
  )
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

export function BatchResultsTable({ rows, maxHeight = '60vh', onCalculationClick }: BatchResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'providerName', desc: false },
  ])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const dragColIdRef = useRef<string | null>(null)

  const columns = useMemo<ColumnDef<BatchRowResult, any>[]>(
    () => [
      columnHelper.accessor('providerName', {
        header: 'Provider',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, sticky: true, minWidth: '140px' },
      }),
      columnHelper.accessor('providerId', {
        header: 'ID',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '80px' },
      }),
      columnHelper.accessor('specialty', {
        header: 'Specialty',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '140px' },
      }),
      columnHelper.accessor('division', {
        header: 'Division',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '100px' },
      }),
      columnHelper.accessor('providerType', {
        header: 'Type / Role',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '100px' },
      }),
      columnHelper.accessor('scenarioName', {
        header: 'Model name',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '120px' },
      }),
      columnHelper.accessor((r) => r.results?.currentTCC, {
        id: 'currentTCC',
        header: 'Current TCC',
        cell: (c) => curOrEmpty(c.getValue()),
        meta: { minWidth: '90px' },
      }),
      columnHelper.accessor((r) => r.results?.modeledTCC, {
        id: 'modeledTCC',
        header: 'Modeled TCC',
        cell: (c) => curOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.currentCF, {
        id: 'currentCF',
        header: 'Current CF',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.modeledCF, {
        id: 'modeledCF',
        header: 'Modeled CF',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.totalWRVUs, {
        id: 'workRVUs',
        header: 'wRVUs',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.annualIncentive, {
        id: 'annualIncentive',
        header: 'Incentive',
        cell: (c) => {
          const val = c.getValue() as number | undefined
          const text = curOrEmpty(val)
          const row = c.row.original
          const isNegative = val != null && Number.isFinite(val) && val < 0
          const isPositive = val != null && Number.isFinite(val) && val > 0
          const colorClass = isNegative ? 'text-destructive font-medium' : isPositive ? 'text-green-600 dark:text-green-400 font-medium' : undefined
          const content = colorClass ? <span className={colorClass}>{text}</span> : text
          if (text !== EMPTY && onCalculationClick) {
            return (
              <CalculationCellButton
                onClick={() => onCalculationClick(row, 'incentive')}
                className={colorClass}
              >
                {content}
              </CalculationCellButton>
            )
          }
          return content
        },
      }),
      columnHelper.accessor((r) => r.results?.psqDollars, {
        id: 'psqDollars',
        header: 'PSQ',
        cell: (c) => {
          const val = c.getValue() as number | undefined
          const text = curOrEmpty(val)
          if (text === EMPTY) return text
          const isNegative = val != null && Number.isFinite(val) && val < 0
          const isPositive = val != null && Number.isFinite(val) && val > 0
          const colorClass = isNegative ? 'text-destructive font-medium' : isPositive ? 'text-green-600 dark:text-green-400 font-medium' : undefined
          return colorClass ? <span className={colorClass}>{text}</span> : text
        },
      }),
      columnHelper.accessor((r) => r.results?.tccPercentile, {
        id: 'tccPercentile',
        header: 'TCC %tile',
        cell: (c) => {
          const val = c.getValue() as number | undefined
          const text = numOrEmpty(val)
          const row = c.row.original
          if (text !== EMPTY && onCalculationClick) {
            return (
              <CalculationCellButton onClick={() => onCalculationClick(row, 'tccPercentile')}>
                {text}
              </CalculationCellButton>
            )
          }
          return text
        },
      }),
      columnHelper.accessor((r) => r.results?.modeledTCCPercentile, {
        id: 'modeledTCCPercentile',
        header: 'Modeled TCC %tile',
        cell: (c) => {
          const val = c.getValue() as number | undefined
          const text = numOrEmpty(val)
          const row = c.row.original
          if (text !== EMPTY && onCalculationClick) {
            return (
              <CalculationCellButton onClick={() => onCalculationClick(row, 'modeledTCCPercentile')}>
                {text}
              </CalculationCellButton>
            )
          }
          return text
        },
      }),
      columnHelper.accessor((r) => r.results?.wrvuPercentile, {
        id: 'wrvuPercentile',
        header: 'wRVU %tile',
        cell: (c) => {
          const val = c.getValue() as number | undefined
          const text = numOrEmpty(val)
          const row = c.row.original
          if (text !== EMPTY && onCalculationClick) {
            return (
              <CalculationCellButton onClick={() => onCalculationClick(row, 'wrvuPercentile')}>
                {text}
              </CalculationCellButton>
            )
          }
          return text
        },
      }),
      columnHelper.accessor((r) => r.results?.alignmentGapModeled, {
        id: 'alignmentGapModeled',
        header: 'Gap (modeled)',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.imputedTCCPerWRVURatioModeled, {
        id: 'imputedTCCPerWRVU',
        header: 'Imputed $/wRVU',
        cell: (c) => curOrEmpty(c.getValue()),
      }),
      columnHelper.accessor('matchStatus', {
        header: 'Match',
        cell: (c) => {
          const v = c.getValue()
          const status = v as BatchRowResult['matchStatus']
          const variant =
            status === 'Missing'
              ? 'destructive'
              : status === 'Synonym'
                ? 'secondary'
                : 'outline'
          return <Badge variant={variant}>{status}</Badge>
        },
      }),
      columnHelper.accessor('matchedMarketSpecialty', {
        header: 'Matched market',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '120px' },
      }),
      columnHelper.accessor('riskLevel', {
        header: 'Risk',
        cell: (c) => {
          const v = c.getValue() as BatchRowResult['riskLevel']
          const variant =
            v === 'high' ? 'destructive' : v === 'medium' ? 'secondary' : 'outline'
          return <Badge variant={variant}>{v}</Badge>
        },
      }),
      columnHelper.accessor('warnings', {
        header: 'Messages',
        cell: (c) => {
          const w = c.getValue() as string[]
          if (!w?.length) return '—'
          const full = w.join('; ')
          return (
            <span className="block max-w-[220px] break-words text-left" title={full}>
              {w.length > 2 ? `${w.slice(0, 2).join('; ')} (+${w.length - 2} more)` : full}
            </span>
          )
        },
        meta: { wrap: true, minWidth: '180px' },
      }),
    ],
    [onCalculationClick]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, pagination, columnOrder, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    defaultColumn: { size: 140, minSize: 60, maxSize: 800 },
  })

  const getOrderedColumnIds = useCallback(() => {
    const order = table.getState().columnOrder
    if (order?.length) return order
    return table.getAllLeafColumns().map((c) => c.id)
  }, [table])

  const handleHeaderDragStart = useCallback((columnId: string) => {
    dragColIdRef.current = columnId
    setDraggedColId(columnId)
  }, [])

  const handleHeaderDragOver = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault()
      if (dragColIdRef.current === columnId) return
      setDropTargetColId(columnId)
    },
    []
  )

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

  const filteredRowCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const start = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filteredRowCount)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground hidden sm:block">
          Drag column headers to reorder; drag the right edge to resize.
        </p>
        <Input
          placeholder="Search table..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Label htmlFor="batch-rows-per-page" className="text-xs whitespace-nowrap">
            Rows per page
          </Label>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger id="batch-rows-per-page" className="h-9 w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div
        className="rounded-md border border-border overflow-x-auto overflow-y-auto"
        style={{ maxHeight }}
      >
        <table
          className="w-full caption-bottom text-sm min-w-max"
          style={{ minWidth: 'max-content' }}
        >
          <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as { sticky?: boolean; minWidth?: string; wrap?: boolean } | undefined
                  const stickyClass = meta?.sticky ? 'sticky left-0 z-20 bg-muted/95 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]' : ''
                  const wrapClass = meta?.wrap ? 'whitespace-normal' : 'whitespace-nowrap'
                  const colId = h.column.id
                  const isDragging = draggedColId === colId
                  const isDropTarget = dropTargetColId === colId
                  const canResize = h.column.getCanResize()
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        wrapClass,
                        stickyClass,
                        'px-3 py-2.5 relative group',
                        isDragging && 'opacity-60',
                        isDropTarget && 'ring-1 ring-primary'
                      )}
                      style={{
                        width: h.getSize(),
                        minWidth: h.getSize(),
                        maxWidth: h.getSize(),
                      }}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          draggable
                          onDragStart={() => handleHeaderDragStart(colId)}
                          onDragOver={(e) => handleHeaderDragOver(e, colId)}
                          onDrop={handleHeaderDrop}
                          onDragEnd={handleHeaderDragEnd}
                          onDragLeave={() => setDropTargetColId(null)}
                          className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-muted-foreground/20"
                          title="Drag to reorder column"
                        >
                          <GripVertical className="size-4 text-muted-foreground" />
                        </span>
                        {h.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={() => h.column.toggleSorting()}
                            className="hover:underline text-left flex-1 min-w-0"
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </button>
                        ) : (
                          <span className="flex-1 min-w-0">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </span>
                        )}
                      </div>
                      {canResize && (
                        <div
                          onMouseDown={h.getResizeHandler()}
                          onTouchStart={h.getResizeHandler()}
                          className={cn(
                            'absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none resize-handle',
                            h.column.getIsResizing() && 'bg-primary'
                          )}
                          title="Drag to resize column"
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <tbody className="[&_tr:last-child]:border-0">
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={cn(row.index % 2 === 1 && 'bg-muted/30')}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { sticky?: boolean; minWidth?: string; wrap?: boolean } | undefined
                  const stickyClass = meta?.sticky ? 'sticky left-0 z-10 bg-background shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''
                  const wrapClass = meta?.wrap ? 'whitespace-normal break-words align-top' : 'whitespace-nowrap'
                  const value = cell.getValue()
                  const titleAttr = meta?.wrap && typeof value === 'string' && value ? value : undefined
                  const size = cell.column.getSize()
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(wrapClass, stickyClass, 'px-3 py-2.5')}
                      style={{ width: size, minWidth: size, maxWidth: size }}
                      title={titleAttr}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          Showing {start}–{end} of {filteredRowCount} row{filteredRowCount !== 1 ? 's' : ''}
          {globalFilter && ` (filtered from ${rows.length})`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={pageIndex === 0}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <span className="px-2 text-xs text-muted-foreground tabular-nums">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => table.nextPage()}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
