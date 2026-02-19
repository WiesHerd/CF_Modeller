import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type ColumnOrderState,
  type ColumnSizingState,
  type VisibilityState,
  type ColumnPinningState,
  type Updater,
} from '@tanstack/react-table'
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { DATA_GRID } from '@/lib/data-grid-styles'
import { formatCurrency } from '@/utils/format'
import {
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
  formatPercentile,
  getFmvRiskLevel,
  FMV_RISK_LABEL,
  type FmvRiskLevel,
} from '@/features/optimizer/components/optimizer-constants'
import type { BatchRowResult } from '@/types/batch'
import { ChevronLeft, ChevronRight, Columns3, GripVertical, HelpCircle, LayoutList, Pin } from 'lucide-react'

const columnHelper = createColumnHelper<BatchRowResult>()
const EMPTY = '—'
const PAGE_SIZE_OPTIONS = [25, 50, 75, 100, 200]
const ROW_HEIGHT_PX = 40
const TABLE_HEADER_HEIGHT_PX = 44
const EXPAND_MAX_VIEWPORT = '85vh'
const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
  'providerName',
  'specialty',
  'scenarioName',
  'currentTCC',
  'modeledTCC',
  'incentive',
  'tccPercentile',
  'cfPercentile',
  'modeledTCCPercentile',
  'wrvuPercentile',
  'payVsProductivity',
  'fmvRisk',
]

const COLUMN_HEADER_LABELS: Record<string, string> = {
  providerName: 'Provider',
  specialty: 'Specialty',
  scenarioName: 'Model name',
  currentTCC: 'Current TCC',
  modeledTCC: 'Modeled TCC',
  incentive: 'Incentive',
  tccPercentile: 'Current TCC %ile',
  cfPercentile: 'CF %ile',
  modeledTCCPercentile: 'Modeled TCC %ile',
  wrvuPercentile: 'wRVU %ile',
  payVsProductivity: 'Pay vs productivity',
  fmvRisk: 'FMV risk',
}

/** Returns the display string for a cell (for measuring width). Must match column cell renderers. */
function getCellDisplayString(row: BatchRowResult, columnId: string): string {
  switch (columnId) {
    case 'providerName':
      return (row.providerName || row.providerId || '') || EMPTY
    case 'specialty':
      return (row.specialty as string) || EMPTY
    case 'scenarioName':
      return (row.scenarioName as string) || EMPTY
    case 'currentTCC': {
      const v = row.results?.currentTCC
      return v != null && Number.isFinite(v) ? formatCurrency(v, { decimals: 0 }) : EMPTY
    }
    case 'modeledTCC': {
      const v = row.results?.modeledTCC
      return v != null && Number.isFinite(v) ? formatCurrency(v, { decimals: 0 }) : EMPTY
    }
    case 'incentive': {
      const v = row.results?.annualIncentive
      return v != null && Number.isFinite(v) ? formatCurrency(v, { decimals: 0 }) : EMPTY
    }
    case 'tccPercentile': {
      const v = row.results?.tccPercentile
      return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
    }
    case 'cfPercentile': {
      const v = row.results?.cfPercentileCurrent
      return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
    }
    case 'modeledTCCPercentile': {
      const v = row.results?.modeledTCCPercentile
      return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
    }
    case 'wrvuPercentile': {
      const v = row.results?.wrvuPercentile
      return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
    }
    case 'payVsProductivity': {
      const gap = row.results?.alignmentGapModeled
      const interpretation =
        gap != null && Number.isFinite(gap) ? getGapInterpretation(gap) : null
      return interpretation != null ? GAP_INTERPRETATION_LABEL[interpretation] : EMPTY
    }
    case 'fmvRisk': {
      const tcc = row.results?.tccPercentile
      const modeled = row.results?.modeledTCCPercentile
      const level = getFmvRiskLevel(tcc, modeled)
      return FMV_RISK_LABEL[level]
    }
    default:
      return EMPTY
  }
}

export interface TccWrvuSummaryTableProps {
  rows: BatchRowResult[]
  title?: string
  subtitle?: string
  showScenarioName?: boolean
  className?: string
  onProviderClick?: (row: BatchRowResult) => void
  /** Max height for the scrollable table area. Default 60vh. */
  maxHeight?: string
  /** When true, wrapper min-height grows with page size so 25/50/75 rows fit without internal scroll (capped at 85vh). Default true. */
  expandWithPageSize?: boolean
}

export function TccWrvuSummaryTable({
  rows,
  title,
  subtitle,
  showScenarioName = true,
  className,
  onProviderClick,
  maxHeight = '60vh',
  expandWithPageSize = true,
}: TccWrvuSummaryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'providerName', desc: false }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    showScenarioName ? DEFAULT_COLUMN_ORDER : DEFAULT_COLUMN_ORDER.filter((id) => id !== 'scenarioName')
  )
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnPinning, setColumnPinning] = useState({ left: [] as string[], right: [] as string[] })
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const dragColIdRef = useRef<string | null>(null)
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null)
  const focusedCellRef = useRef<HTMLTableCellElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)

  const columns = useMemo((): ColumnDef<BatchRowResult, unknown>[] => {
    const base = [
      columnHelper.accessor((r) => r.providerName || r.providerId, {
        id: 'providerName',
        header: 'Provider',
        cell: (c) => {
          const name = c.getValue() as string
          const display = name || EMPTY
          return onProviderClick ? (
            <span className="text-primary">{display}</span>
          ) : (
            display
          )
        },
        meta: { sticky: true, minWidth: 120 },
      }),
      columnHelper.accessor('specialty', {
        id: 'specialty',
        header: 'Specialty',
        cell: (c) => c.getValue() || EMPTY,
        meta: { minWidth: 100 },
      }),
      columnHelper.accessor('scenarioName', {
        id: 'scenarioName',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted">Model name</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              Scenario name for this row (e.g. &quot;Current&quot; = current scenario).
            </TooltipContent>
          </Tooltip>
        ),
        cell: (c) => c.getValue() || EMPTY,
        meta: { minWidth: 90 },
      }),
      columnHelper.accessor((r) => r.results?.currentTCC, {
        id: 'currentTCC',
        header: 'Current TCC',
        cell: (c) => {
          const v = c.getValue() as number | undefined
          return v != null && Number.isFinite(v) ? formatCurrency(v, { decimals: 0 }) : EMPTY
        },
        meta: { minWidth: 80, align: 'right' },
      }),
      columnHelper.accessor((r) => r.results?.modeledTCC, {
        id: 'modeledTCC',
        header: 'Modeled TCC',
        cell: (c) => {
          const v = c.getValue() as number | undefined
          return v != null && Number.isFinite(v) ? formatCurrency(v, { decimals: 0 }) : EMPTY
        },
        meta: { minWidth: 80, align: 'right' },
      }),
      columnHelper.accessor((r) => r.results?.annualIncentive, {
        id: 'incentive',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted">Incentive</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              Productivity (wRVU) incentive dollars at the modeled CF for this provider.
            </TooltipContent>
          </Tooltip>
        ),
        cell: (c) => {
          const v = c.getValue() as number | undefined
          return v != null && Number.isFinite(v) ? formatCurrency(v, { decimals: 0 }) : EMPTY
        },
        meta: { minWidth: 80, align: 'right' },
      }),
      columnHelper.accessor((r) => r.results?.tccPercentile, {
        id: 'tccPercentile',
        header: 'Current TCC %ile',
        cell: (c) => {
          const v = c.getValue() as number | undefined
          return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
        },
        meta: { minWidth: 70, align: 'right' },
      }),
      columnHelper.accessor((r) => r.results?.cfPercentileCurrent, {
        id: 'cfPercentile',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted">CF %ile</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              Percentile of current $/wRVU (conversion factor) vs market for this specialty.
            </TooltipContent>
          </Tooltip>
        ),
        cell: (c) => {
          const v = c.getValue() as number | undefined
          return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
        },
        meta: { minWidth: 70, align: 'right' },
      }),
      columnHelper.accessor((r) => r.results?.modeledTCCPercentile, {
        id: 'modeledTCCPercentile',
        header: 'Modeled TCC %ile',
        cell: (c) => {
          const v = c.getValue() as number | undefined
          return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
        },
        meta: { minWidth: 70, align: 'right' },
      }),
      columnHelper.accessor((r) => r.results?.wrvuPercentile, {
        id: 'wrvuPercentile',
        header: 'wRVU %ile',
        cell: (c) => {
          const v = c.getValue() as number | undefined
          return v != null && Number.isFinite(v) ? formatPercentile(v) : EMPTY
        },
        meta: { minWidth: 70, align: 'right' },
      }),
      columnHelper.accessor((r) => r.results?.alignmentGapModeled, {
        id: 'payVsProductivity',
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
        cell: (c) => {
          const gap = c.getValue() as number | undefined
          const interpretation =
            gap != null && Number.isFinite(gap) ? getGapInterpretation(gap) : null
          const color =
            interpretation === 'overpaid'
              ? 'value-negative'
              : interpretation === 'underpaid'
                ? 'value-positive'
                : 'text-muted-foreground'
          return (
            <span className={color}>
              {interpretation != null ? GAP_INTERPRETATION_LABEL[interpretation] : EMPTY}
            </span>
          )
        },
        meta: { minWidth: 120 },
      }),
      columnHelper.accessor(
        (r) => {
          const tcc = r.results?.tccPercentile
          const modeled = r.results?.modeledTCCPercentile
          return getFmvRiskLevel(tcc, modeled)
        },
        {
          id: 'fmvRisk',
          header: 'FMV risk',
          cell: (c) => {
            const fmvRisk = c.getValue() as FmvRiskLevel
            const riskColor =
              fmvRisk === 'high'
                ? 'value-negative font-medium'
                : fmvRisk === 'elevated'
                  ? 'value-warning'
                  : 'text-muted-foreground'
            return <span className={riskColor}>{FMV_RISK_LABEL[fmvRisk]}</span>
          },
          meta: { minWidth: 88 },
        }
      ),
    ] as ColumnDef<BatchRowResult, unknown>[]
    return showScenarioName ? base : base.filter((col) => col.id !== 'scenarioName')
  }, [showScenarioName, onProviderClick])

  const handleColumnPinningChange = useCallback((updaterOrValue: Updater<ColumnPinningState>) => {
    setColumnPinning((prev) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
      return { left: next?.left ?? [], right: next?.right ?? [] }
    })
  }, [])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination, columnOrder, columnSizing, columnVisibility, columnPinning },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: handleColumnPinningChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { size: 120, minSize: 60, maxSize: 400 },
  })

  const getOrderedColumnIds = useCallback(() => {
    const order = table.getState().columnOrder
    if (order?.length) return order
    return table.getAllLeafColumns().map((c) => c.id)
  }, [table])

  const handleHeaderDragStart = useCallback((colId: string) => {
    dragColIdRef.current = colId
    setDraggedColId(colId)
  }, [])

  const handleHeaderDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    if (dragColIdRef.current === colId) return
    setDropTargetColId(colId)
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

  const handleAutoSizeColumns = useCallback(() => {
    const el = measureRef.current
    if (!el) return
    const nextSizing: ColumnSizingState = {}
    for (const col of table.getVisibleLeafColumns()) {
      const headerLabel = COLUMN_HEADER_LABELS[col.id] ?? (typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id)
      const meta = col.columnDef.meta as { minWidth?: number } | undefined
      const minW = meta?.minWidth ?? 60
      const maxW = 800
      let maxMeasured = 0
      el.textContent = headerLabel
      maxMeasured = Math.max(maxMeasured, el.offsetWidth)
      for (const row of rows) {
        el.textContent = getCellDisplayString(row, col.id)
        maxMeasured = Math.max(maxMeasured, el.offsetWidth)
      }
      const size = Math.min(maxW, Math.max(minW, maxMeasured + 24))
      nextSizing[col.id] = size
    }
    setColumnSizing(nextSizing)
  }, [table, rows])

  // Auto-size columns when data or visible columns change so columns don't stay scrunched
  useEffect(() => {
    if (rows.length === 0) return
    const id = requestAnimationFrame(() => {
      handleAutoSizeColumns()
    })
    return () => cancelAnimationFrame(id)
  }, [rows, columnVisibility, handleAutoSizeColumns])

  const visibleRows = table.getRowModel().rows
  const visibleColumnCount = table.getVisibleLeafColumns().length
  const rowCount = visibleRows.length
  const colCount = visibleRows[0]?.getVisibleCells().length ?? 0

  useEffect(() => {
    if (focusedCell == null || rowCount === 0 || colCount === 0) return
    const el = focusedCellRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.focus()
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
    })
  }, [focusedCell, rowCount, colCount])

  useEffect(() => {
    if (rowCount === 0) {
      setFocusedCell(null)
      return
    }
    setFocusedCell((prev) => {
      if (prev == null) return null
      const r = Math.min(prev.rowIndex, Math.max(0, rowCount - 1))
      return r === prev.rowIndex ? prev : { rowIndex: r, columnIndex: 0 }
    })
  }, [rowCount])

  const handleProviderCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableCellElement>, rowIndex: number) => {
      if (rowCount === 0) return
      if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
      }
      switch (e.key) {
        case 'ArrowUp':
          setFocusedCell((prev) => (prev ? { rowIndex: Math.max(0, rowIndex - 1), columnIndex: 0 } : null))
          break
        case 'ArrowDown':
          setFocusedCell((prev) => (prev ? { rowIndex: Math.min(rowCount - 1, rowIndex + 1), columnIndex: 0 } : null))
          break
        case 'Enter':
          if (onProviderClick && visibleRows[rowIndex]) {
            onProviderClick(visibleRows[rowIndex].original)
          }
          break
        default:
          break
      }
    },
    [rowCount, onProviderClick, visibleRows]
  )

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (focusedCell != null) return
      if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
        setFocusedCell({ rowIndex: 0, columnIndex: 0 })
        e.preventDefault()
      }
    },
    [focusedCell]
  )

  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const start = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filteredRowCount)

  const wrapperStyle = expandWithPageSize
    ? {
        minHeight: TABLE_HEADER_HEIGHT_PX + Math.min(pageSize, rowCount) * ROW_HEIGHT_PX,
        maxHeight: EXPAND_MAX_VIEWPORT,
      }
    : { maxHeight }

  return (
    <TooltipProvider delayDuration={300}>
      <span
        ref={measureRef}
        aria-hidden
        className="absolute opacity-0 pointer-events-none text-sm whitespace-nowrap"
        style={{ position: 'absolute', left: -9999 }}
      />
      <div className={cn('space-y-2', className)}>
        {(title != null || subtitle != null) && (
          <div className="mb-2">
            {title != null && <p className="font-medium text-foreground">{title}</p>}
            {subtitle != null && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
        <div className="rounded-md border flex flex-col">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground cursor-help inline-flex" aria-label="Table tips">
                    <HelpCircle className="size-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                  Click a provider name to open details. Use the pin icon to pin columns to the left; drag headers to reorder; drag the right edge to resize. Use the icons to auto-size or show/hide columns. Arrow keys move between rows; Enter opens provider detail.
                </TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Label htmlFor="tcc-rows-per-page" className="text-xs whitespace-nowrap">
                  Rows per page
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger id="tcc-rows-per-page" className="h-9 w-[90px]">
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
            <div className="flex gap-0.5">
              <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Pin column to left"
                aria-label="Pin column"
              >
                <Pin className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto min-w-[180px]">
              <DropdownMenuLabel>Pin column to left</DropdownMenuLabel>
              {table.getAllLeafColumns()
                .filter((col) => col.getIsVisible())
                .map((col) => {
                  const isPinnedLeft =
                    typeof col.getIsPinned === 'function' && col.getIsPinned() === 'left'
                  const label = COLUMN_HEADER_LABELS[col.id] ?? col.id
                  const canPin = typeof col.pin === 'function'
                  return (
                    <DropdownMenuItem
                      key={col.id}
                      onSelect={() => canPin && col.pin(isPinnedLeft ? false : 'left')}
                      className="flex items-center gap-2"
                      disabled={!canPin}
                    >
                      <Pin className={cn('size-4 shrink-0', isPinnedLeft ? 'text-primary' : 'opacity-50')} aria-hidden />
                      <span className="truncate flex-1">{label}</span>
                      {isPinnedLeft && (
                        <span className="text-xs text-muted-foreground shrink-0">Pinned</span>
                      )}
                    </DropdownMenuItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
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
                    {COLUMN_HEADER_LABELS[col.id] ?? col.id}
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
            tabIndex={0}
            className="rounded-b-md border border-t-0 border-border overflow-x-auto overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            style={wrapperStyle}
            onKeyDown={handleTableKeyDown}
          >
        <table
          className="w-full caption-bottom text-sm min-w-max border-separate border-spacing-0"
          style={{ minWidth: 'max-content' }}
        >
          <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers
                  .filter((h) => h.column.getIsVisible())
                  .map((h) => {
                    const meta = h.column.columnDef.meta as { sticky?: boolean; minWidth?: number } | undefined
                    const isPinnedLeft =
                      typeof h.column.getIsPinned === 'function' && h.column.getIsPinned() === 'left'
                    const colId = h.column.id
                    const isDragging = draggedColId === colId
                    const isDropTarget = dropTargetColId === colId
                    const canResize = h.column.getCanResize()
                    const size = h.getSize()
                    const rawStart = isPinnedLeft && typeof h.column.getStart === 'function' ? h.column.getStart('left') : undefined
                    const start = typeof rawStart === 'number' && Number.isFinite(rawStart) ? rawStart : (isPinnedLeft ? 0 : undefined)
                    const thClass = isPinnedLeft
                      ? 'p-0 align-top border-b border-border bg-transparent relative overflow-hidden'
                      : 'sticky top-0 z-20 bg-muted px-3 py-2.5 relative group whitespace-normal break-words'
                    return (
                      <TableHead
                        key={h.id}
                        className={cn(thClass, isDragging && 'opacity-60', isDropTarget && 'ring-1 ring-primary')}
                        style={{
                          width: size,
                          minWidth: size,
                          maxWidth: size,
                          ...(isPinnedLeft && start !== undefined && start >= 0
                            ? { position: 'sticky' as const, left: start, zIndex: 30 }
                            : {}),
                        }}
                      >
                        {isPinnedLeft ? (
                          <div
                            className={cn(
                              'bg-zinc-100 dark:bg-zinc-900 border-b border-border overflow-hidden',
                              DATA_GRID.cellPadding,
                              'flex h-full w-full items-center gap-1 min-w-0',
                              (typeof h.column.getIsLastColumn === 'function' && h.column.getIsLastColumn('left')) && 'border-r border-border shadow-[4px_0_6px_-1px_rgba(0,0,0,0.1),4px_0_4px_-2px_rgba(0,0,0,0.06)]'
                            )}
                            style={{ width: size, minWidth: size }}
                          >
                            <span
                              draggable
                              onDragStart={() => handleHeaderDragStart(colId)}
                              onDragOver={(e) => handleHeaderDragOver(e, colId)}
                              onDrop={handleHeaderDrop}
                              onDragEnd={handleHeaderDragEnd}
                              onDragLeave={() => setDropTargetColId(null)}
                              className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-muted-foreground/20 shrink-0"
                              title="Drag to reorder column"
                            >
                              <GripVertical className="size-4 text-muted-foreground" />
                            </span>
                            {h.column.getCanSort() ? (
                              <button type="button" onClick={() => h.column.toggleSorting()} className="hover:underline flex-1 min-w-0 text-left">
                                {flexRender(h.column.columnDef.header, h.getContext())}
                              </button>
                            ) : (
                              <span className="flex-1 min-w-0">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                            )}
                          </div>
                        ) : (
                          <>
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
                                  className={cn('hover:underline flex-1 min-w-0', (meta as { align?: string })?.align === 'right' ? 'text-right' : 'text-left')}
                                >
                                  {flexRender(h.column.columnDef.header, h.getContext())}
                                </button>
                              ) : (
                                <span className={cn('flex-1 min-w-0', (meta as { align?: string })?.align === 'right' ? 'text-right' : 'text-left')}>
                                  {flexRender(h.column.columnDef.header, h.getContext())}
                                </span>
                              )}
                            </div>
                            {canResize && (
                              <div
                                onMouseDown={h.getResizeHandler()}
                                onTouchStart={h.getResizeHandler()}
                                className={cn('absolute right-0 top-0 z-30 h-full w-2 -translate-x-1 cursor-col-resize touch-none select-none hover:bg-primary/30', h.column.getIsResizing() && 'bg-primary')}
                                title="Drag to resize column"
                                aria-hidden
                              />
                            )}
                          </>
                        )}
                        {isPinnedLeft && canResize && (
                          <div
                            onMouseDown={h.getResizeHandler()}
                            onTouchStart={h.getResizeHandler()}
                            className={cn('absolute right-0 top-0 z-30 h-full w-2 -translate-x-1 cursor-col-resize touch-none select-none hover:bg-primary/30', h.column.getIsResizing() && 'bg-primary')}
                            title="Drag to resize column"
                            aria-hidden
                          />
                        )}
                      </TableHead>
                    )
                  })}
              </TableRow>
            ))}
          </TableHeader>
          <tbody className="[&_tr:last-child]:border-0">
            {visibleRows.map((row, rowIndex) => (
              <TableRow
                key={row.id}
                className={cn(
                  row.index % 2 === 1 && 'bg-muted/30',
                  onProviderClick && 'cursor-pointer hover:bg-muted/50 transition-colors'
                )}
                role="row"
                aria-label={onProviderClick ? `View details for ${row.original.providerName || row.original.providerId || 'provider'}` : undefined}
              >
                {row.getVisibleCells().map((cell, columnIndex) => {
                  const meta = cell.column.columnDef.meta as { sticky?: boolean; align?: string } | undefined
                  const isPinnedLeft =
                    typeof cell.column.getIsPinned === 'function' && cell.column.getIsPinned() === 'left'
                  const rawStart = isPinnedLeft && typeof cell.column.getStart === 'function' ? cell.column.getStart('left') : undefined
                  const start = typeof rawStart === 'number' && Number.isFinite(rawStart) ? rawStart : (isPinnedLeft ? 0 : undefined)
                  const isProviderCell = cell.column.id === 'providerName'
                  const stickyBg =
                    isPinnedLeft && row.index % 2 === 1
                      ? 'bg-zinc-100 dark:bg-zinc-900'
                      : isPinnedLeft
                        ? 'bg-white dark:bg-zinc-950'
                        : ''
                  const isLastPinned = typeof cell.column.getIsLastColumn === 'function' && cell.column.getIsLastColumn('left')
                  const pinnedCellClass = isPinnedLeft
                    ? `sticky z-20 isolate overflow-hidden ${stickyBg} ${isLastPinned ? 'border-r border-border shadow-[4px_0_6px_-1px_rgba(0,0,0,0.1),4px_0_4px_-2px_rgba(0,0,0,0.06)]' : ''}`
                    : 'z-0 relative'
                  const isFocused =
                    isProviderCell && focusedCell?.rowIndex === rowIndex && focusedCell?.columnIndex === 0
                  return (
                    <TableCell
                      key={cell.id}
                      ref={isFocused ? focusedCellRef : undefined}
                      role="gridcell"
                      tabIndex={isProviderCell ? (isFocused ? 0 : -1) : -1}
                      aria-rowindex={rowIndex + 1}
                      aria-colindex={columnIndex + 1}
                      title={isProviderCell && onProviderClick ? 'Click to open provider details' : undefined}
                      aria-label={isProviderCell && onProviderClick ? `Open details for ${row.original.providerName || row.original.providerId || 'provider'}` : undefined}
                      className={cn(
                        'px-3 py-2.5 outline-none whitespace-nowrap',
                        meta?.align === 'right' && 'text-right tabular-nums',
                        pinnedCellClass,
                        isFocused && 'bg-zinc-200 dark:bg-zinc-800'
                      )}
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                        ...(isPinnedLeft && start !== undefined && start >= 0
                          ? { position: 'sticky' as const, left: start, zIndex: 20 }
                          : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setFocusedCell({ rowIndex, columnIndex: 0 })
                        if (isProviderCell && onProviderClick) onProviderClick(row.original)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isProviderCell && onProviderClick) onProviderClick(row.original)
                      }}
                      onKeyDown={isProviderCell ? (e) => handleProviderCellKeyDown(e, rowIndex) : undefined}
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
        </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground tabular-nums">
          Showing {start}–{end} of {filteredRowCount} row{filteredRowCount !== 1 ? 's' : ''}
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
            Page {pageIndex + 1} of {Math.max(1, pageCount)}
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
    </TooltipProvider>
  )
}
