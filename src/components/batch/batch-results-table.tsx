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
  type VisibilityState,
} from '@tanstack/react-table'
import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode, type ReactElement } from 'react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronLeft, ChevronRight, GripVertical, HelpCircle, Columns3, LayoutList } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getGapInterpretation } from '@/features/optimizer/components/optimizer-constants'
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
  /** When set, the entire row is clickable to open provider detail in a side drawer. */
  onRowClick?: (row: BatchRowResult) => void
  /** When set, rows for which this returns true get a distinct background highlight (e.g. flagged for review). */
  isRowHighlighted?: (row: BatchRowResult) => boolean
  /** When false, disables grid-style cell focus (click cell + arrow keys). Improves performance with large tables. Default true for backward compatibility. */
  enableCellFocus?: boolean
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

/** Default column order: Provider first (frozen), then Specialty, and the rest. ID is internal-only (not in upload mapping). */
const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
  'providerName',
  'specialty',
  'division',
  'providerType',
  'scenarioName',
  'currentTCC',
  'modeledTCC',
  'currentCF',
  'modeledCF',
  'workRVUs',
  'annualIncentive',
  'psqDollars',
  'tccPercentile',
  'modeledTCCPercentile',
  'wrvuPercentile',
  'alignmentGapModeled',
  'imputedTCCPerWRVU',
  'matchStatus',
  'matchedMarketSpecialty',
  'riskLevel',
  'warnings',
]

export function BatchResultsTable({ rows, maxHeight = '60vh', onCalculationClick, onRowClick, isRowHighlighted, enableCellFocus = true }: BatchResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'providerName', desc: false },
  ])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const dragColIdRef = useRef<string | null>(null)
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null)
  const focusedCellRef = useRef<HTMLTableCellElement>(null)
  const cellFocusEnabled = enableCellFocus === true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table column value types vary per column
  const columns = useMemo<ColumnDef<BatchRowResult, any>[]>(
    () => [
      columnHelper.accessor('providerName', {
        header: 'Provider',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, sticky: true, minWidth: '140px' },
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
          const display = w.length > 2 ? `${w.slice(0, 2).join('; ')} (+${w.length - 2} more)` : full
          return (
            <span className="block max-w-[220px] truncate text-left" title={full}>
              {display}
            </span>
          )
        },
        meta: { wrap: false, minWidth: '180px' },
      }),
    ],
    [onCalculationClick]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API returns non-memoizable refs
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, pagination, columnOrder, columnSizing, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
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

  const handleAutoSizeColumns = useCallback(() => {
    setColumnSizing({})
  }, [])

  const visibleRows = table.getRowModel().rows
  const rowCount = visibleRows.length
  const colCount = visibleRows[0]?.getVisibleCells().length ?? 0

  useEffect(() => {
    if (!cellFocusEnabled || focusedCell == null || rowCount === 0 || colCount === 0) return
    const el = focusedCellRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.focus()
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
    })
  }, [cellFocusEnabled, focusedCell, rowCount, colCount])

  useEffect(() => {
    if (!cellFocusEnabled) return
    if (rowCount === 0 || colCount === 0) {
      setFocusedCell(null)
      return
    }
    setFocusedCell((prev) => {
      if (prev == null) return null
      const r = Math.min(prev.rowIndex, Math.max(0, rowCount - 1))
      const c = Math.min(prev.columnIndex, Math.max(0, colCount - 1))
      return r === prev.rowIndex && c === prev.columnIndex ? prev : { rowIndex: r, columnIndex: c }
    })
  }, [cellFocusEnabled, rowCount, colCount])

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!cellFocusEnabled || focusedCell != null) return
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        setFocusedCell({ rowIndex: 0, columnIndex: 0 })
        e.preventDefault()
      }
    },
    [cellFocusEnabled, focusedCell]
  )

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => {
      if (rowCount === 0 || colCount === 0) return
      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      if (isArrow) {
        e.preventDefault()
        e.stopPropagation()
      }
      switch (e.key) {
        case 'ArrowLeft':
          setFocusedCell((prev) => (prev ? { ...prev, columnIndex: Math.max(0, columnIndex - 1) } : null))
          break
        case 'ArrowRight':
          setFocusedCell((prev) => (prev ? { ...prev, columnIndex: Math.min(colCount - 1, columnIndex + 1) } : null))
          break
        case 'ArrowUp':
          setFocusedCell((prev) => (prev ? { ...prev, rowIndex: Math.max(0, rowIndex - 1) } : null))
          break
        case 'ArrowDown':
          setFocusedCell((prev) => (prev ? { ...prev, rowIndex: Math.min(rowCount - 1, rowIndex + 1) } : null))
          break
        case 'Home':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            e.stopPropagation()
            setFocusedCell((prev) => (prev ? { ...prev, columnIndex: 0 } : null))
          }
          break
        case 'End':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            e.stopPropagation()
            setFocusedCell((prev) => (prev ? { ...prev, columnIndex: colCount - 1 } : null))
          }
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (onRowClick && visibleRows[rowIndex]) {
            onRowClick(visibleRows[rowIndex].original as BatchRowResult)
          }
          break
        default:
          break
      }
    },
    [rowCount, colCount, onRowClick, visibleRows]
  )

  const filteredRowCount = table.getFilteredRowModel().rows.length
  const visibleColumnCount = table.getVisibleLeafColumns().length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const start = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filteredRowCount)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search table..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground cursor-help inline-flex" aria-label="Table tips">
                <HelpCircle className="size-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px] text-xs">
              Drag column headers to reorder; drag the right edge to resize.
              {cellFocusEnabled ? ' Click a cell, then use arrow keys to move; Enter or double-click opens provider detail.' : ' Double-click a row to open provider detail.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleAutoSizeColumns}
            title="Auto-size columns"
            aria-label="Auto-size columns"
          >
            <Columns3 className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Show / hide columns"
                aria-label="Column visibility"
              >
                <LayoutList className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {table.getAllLeafColumns().map((col) => {
                const visible = col.getIsVisible()
                const isOnlyVisible = visible && visibleColumnCount <= 1
                return (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={visible}
                    disabled={isOnlyVisible}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  >
                    {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div
        role="grid"
        aria-rowcount={rowCount}
        aria-colcount={colCount}
        tabIndex={cellFocusEnabled ? 0 : undefined}
        className="rounded-md border border-border overflow-x-auto overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{ maxHeight }}
        onKeyDown={cellFocusEnabled ? handleTableKeyDown : undefined}
      >
        <table
          className="w-full caption-bottom text-sm min-w-max"
          style={{ minWidth: 'max-content' }}
        >
          <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground [&_th]:font-medium">
            {table.getHeaderGroups().map((hg) => {
              const visibleHeaders = hg.headers.filter((h) => h.column.getIsVisible())
              return (
              <TableRow key={hg.id}>
                {visibleHeaders.map((h) => {
                  const meta = h.column.columnDef.meta as { sticky?: boolean; minWidth?: string; wrap?: boolean } | undefined
                  const isStickyColumn = meta?.sticky === true || h.column.id === 'providerName'
                  const stickyClass = isStickyColumn
                    ? 'sticky left-0 top-0 z-30 bg-muted shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                    : 'sticky top-0 z-20 bg-muted'
                  const headerWrapClass = 'whitespace-normal break-words'
                  const colId = h.column.id
                  const isDragging = draggedColId === colId
                  const isDropTarget = dropTargetColId === colId
                  const canResize = h.column.getCanResize()
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        headerWrapClass,
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
              )
            })}
          </TableHeader>
          <tbody className="[&_tr:last-child]:border-0">
            {visibleRows.map((row, rowIndex) => {
              const original = row.original as BatchRowResult
              const highlighted = isRowHighlighted?.(original)
              const gap = original.results?.alignmentGapModeled
              const alignment =
                gap != null && Number.isFinite(gap) ? getGapInterpretation(gap) : null
              return (
              <TableRow
                key={row.id}
                className={cn(
                  row.index % 2 === 1 && !highlighted && 'bg-muted/30',
                  highlighted && 'bg-amber-100/70 dark:bg-amber-950/50',
                  alignment === 'aligned' && 'border-l-4 border-l-emerald-500/70',
                  alignment === 'overpaid' && 'border-l-4 border-l-red-500/70',
                  alignment === 'underpaid' && 'border-l-4 border-l-blue-500/70',
                  onRowClick &&
                    'cursor-pointer hover:bg-muted/60 transition-colors [&:focus-within]:outline [&:focus-within]:outline-2 [&:focus-within]:outline-offset-[-2px] [&:focus-within]:outline-ring',
                  onRowClick && highlighted && 'hover:bg-amber-200/70 dark:hover:bg-amber-900/50'
                )}
                role="row"
                aria-label={onRowClick ? `View details for ${original.providerName || original.providerId || 'provider'}` : undefined}
              >
                {row.getVisibleCells().map((cell, columnIndex) => {
                  const meta = cell.column.columnDef.meta as { sticky?: boolean; minWidth?: string; wrap?: boolean } | undefined
                  const isStickyColumn = meta?.sticky === true || cell.column.id === 'providerName'
                  const stickyBg =
                    isStickyColumn && highlighted
                      ? 'bg-amber-100 dark:bg-amber-950'
                      : isStickyColumn && row.index % 2 === 1
                        ? 'bg-muted'
                        : isStickyColumn
                          ? 'bg-background'
                          : ''
                  const stickyClass = isStickyColumn
                    ? `sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${stickyBg}`
                    : ''
                  const wrapClass = meta?.wrap ? 'whitespace-normal break-words align-top' : 'whitespace-nowrap'
                  const value = cell.getValue()
                  const titleAttr = meta?.wrap && typeof value === 'string' && value ? value : undefined
                  const size = cell.column.getSize()
                  const isFocused = cellFocusEnabled && focusedCell?.rowIndex === rowIndex && focusedCell?.columnIndex === columnIndex
                  const isCalculationColumn =
                    onCalculationClick &&
                    ['annualIncentive', 'tccPercentile', 'modeledTCCPercentile', 'wrvuPercentile'].includes(
                      cell.column.id
                    )
                  const isClickable = onRowClick || isCalculationColumn
                  return (
                    <TableCell
                      key={cell.id}
                      ref={isFocused ? focusedCellRef : undefined}
                      role="gridcell"
                      tabIndex={cellFocusEnabled ? (isFocused ? 0 : -1) : undefined}
                      aria-rowindex={rowIndex + 1}
                      aria-colindex={columnIndex + 1}
                      className={cn(
                        wrapClass,
                        stickyClass,
                        'px-3 py-2.5 outline-none',
                        isClickable ? 'cursor-pointer' : 'cursor-cell',
                        isFocused && 'ring-2 ring-primary ring-inset bg-primary/5'
                      )}
                      style={{ width: size, minWidth: size, maxWidth: size }}
                      title={titleAttr}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (cellFocusEnabled) setFocusedCell({ rowIndex, columnIndex })
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (onRowClick) onRowClick(original)
                      }}
                      onKeyDown={cellFocusEnabled ? (e) => handleCellKeyDown(e, rowIndex, columnIndex) : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
              )
            })}
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
