import { useMemo, useState, useRef, useCallback } from 'react'
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
  type ColumnPinningState,
  type VisibilityState,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DATA_GRID, getPinnedCellStyles, PINNED_HEADER_CLASS, PINNED_CELL_CLASS, PINNED_CELL_STRIPED_CLASS } from '@/lib/data-grid-styles'
import { ChevronLeft, ChevronRight, GripVertical, Columns3, Eraser, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import type { MarketRow } from '@/types/market'
import { MarketEditModal } from '@/features/data/market-edit-modal'
import {
  EMPTY,
  PAGE_SIZE_OPTIONS,
  AUTO_RESIZE_CELL_PADDING,
  AUTO_RESIZE_HEADER_PADDING,
  COL_MIN,
  COL_MAX,
  TABLE_ROW_HEIGHT,
  TABLE_HEADER_HEIGHT,
  measureTextPx,
  fmtCur,
  fmtNum,
  getMarketCellDisplayString,
} from '@/features/data/data-tables-shared'
// ---- Market table ----
const marketHelper = createColumnHelper<MarketRow>()

interface MarketDataTableProps {
  rows: MarketRow[]
  specialtyFilter: string
  onSpecialtyFilterChange: (value: string) => void
  onUpdateMarketRow?: (existingRow: MarketRow, updates: Partial<MarketRow>) => void
  onAddMarketRow?: (row: MarketRow) => void
  onDeleteMarketRow?: (row: MarketRow) => void
}

export function MarketDataTable({ rows, specialtyFilter, onSpecialtyFilterChange, onUpdateMarketRow, onAddMarketRow, onDeleteMarketRow }: MarketDataTableProps) {
  const [marketModalOpen, setMarketModalOpen] = useState(false)
  const [marketModalMode, setMarketModalMode] = useState<'edit' | 'add'>('edit')
  const [marketEditRow, setMarketEditRow] = useState<MarketRow | null>(null)

  const [sorting, setSorting] = useState<SortingState>([{ id: 'specialty', desc: false }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['specialty'], right: [] })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const dragColIdRef = useRef<string | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const SCROLL_STEP = 120
  const handleScrollKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = tableScrollRef.current
    if (!el) return
    switch (e.key) {
      case 'ArrowLeft':
        el.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' })
        e.preventDefault()
        break
      case 'ArrowRight':
        el.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' })
        e.preventDefault()
        break
      case 'ArrowUp':
        el.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })
        e.preventDefault()
        break
      case 'ArrowDown':
        el.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })
        e.preventDefault()
        break
      case 'Home':
        if (!e.ctrlKey && !e.metaKey) {
          el.scrollLeft = 0
          e.preventDefault()
        }
        break
      case 'End':
        if (!e.ctrlKey && !e.metaKey) {
          el.scrollLeft = el.scrollWidth - el.clientWidth
          e.preventDefault()
        }
        break
      default:
        break
    }
  }, [])

  const specialties = useMemo(() => {
    const set = new Set(rows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])
  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return specialties
    const q = specialtySearch.toLowerCase()
    return specialties.filter((s) => String(s).toLowerCase().includes(q))
  }, [specialties, specialtySearch])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table column value types vary per column
  const columns = useMemo<ColumnDef<MarketRow, any>[]>(
    () => [
      marketHelper.accessor('specialty', { header: 'Specialty', cell: (c) => c.getValue() ?? EMPTY, size: 220, minSize: 140 }),
      marketHelper.accessor('providerType', { header: 'Type', cell: (c) => c.getValue() ?? EMPTY, size: 120, minSize: 90 }),
      marketHelper.accessor('region', { header: 'Region', cell: (c) => c.getValue() ?? EMPTY, size: 120, minSize: 90 }),
      ...(['TCC_25', 'TCC_50', 'TCC_75', 'TCC_90'] as const).map((k) =>
        marketHelper.accessor(k, { header: k, cell: (c) => fmtCur(c.getValue() as number), meta: { align: 'right' }, size: 120, minSize: 100 })
      ),
      ...(['WRVU_25', 'WRVU_50', 'WRVU_75', 'WRVU_90'] as const).map((k) =>
        marketHelper.accessor(k, { header: k, cell: (c) => fmtNum(c.getValue() as number), meta: { align: 'right' }, size: 115, minSize: 95 })
      ),
      ...(['CF_25', 'CF_50', 'CF_75', 'CF_90'] as const).map((k) =>
        marketHelper.accessor(k, { header: k, cell: (c) => fmtCur(c.getValue() as number, 2), meta: { align: 'right' }, size: 115, minSize: 95 })
      ),
      ...(onUpdateMarketRow || onDeleteMarketRow
        ? [
            marketHelper.display({
              id: 'actions',
              header: '',
              cell: ({ row }) => {
                const r = row.original
                const label = [r.specialty, r.providerType, r.region].filter(Boolean).join(' · ') || 'this market line'
                return (
                  <div className="flex items-center gap-0.5">
                    {onUpdateMarketRow && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Edit market line"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMarketEditRow(row.original)
                          setMarketModalMode('edit')
                          setMarketModalOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {onDeleteMarketRow && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label="Delete market line"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Delete market line "${label}"? This cannot be undone.`)) {
                            onDeleteMarketRow(row.original)
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )
              },
              size: (onUpdateMarketRow && onDeleteMarketRow ? 88 : 52),
              minSize: (onUpdateMarketRow && onDeleteMarketRow ? 88 : 52),
            }),
          ]
        : []),
    ],
    [onUpdateMarketRow, onDeleteMarketRow]
  )

  const filteredBySpecialty = useMemo(() => {
    if (!specialtyFilter || specialtyFilter === 'all') return rows
    return rows.filter((r) => r.specialty === specialtyFilter)
  }, [rows, specialtyFilter])

  const getOrderedColumnIds = useCallback((table: ReturnType<typeof useReactTable<MarketRow>>) => {
    const order = table.getState().columnOrder
    if (order?.length) return order
    return table.getAllLeafColumns().map((c) => c.id)
  }, [])
  const handleHeaderDragStart = useCallback((columnId: string) => {
    dragColIdRef.current = columnId
    setDraggedColId(columnId)
  }, [])
  const handleHeaderDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    if (dragColIdRef.current === columnId) return
    setDropTargetColId(columnId)
  }, [])
  const handleHeaderDrop = useCallback((table: ReturnType<typeof useReactTable<MarketRow>>) => {
    const dragged = dragColIdRef.current
    if (!dragged) return
    const ordered = getOrderedColumnIds(table)
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

  const table = useReactTable({
    data: filteredBySpecialty,
    columns,
    state: { sorting, globalFilter, pagination, columnOrder, columnSizing, columnPinning, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    defaultColumn: { minSize: COL_MIN, maxSize: COL_MAX },
  })

  const handleAutoResize = useCallback(() => {
    const cols = table.getVisibleLeafColumns()
    const sizing: ColumnSizingState = {}
    for (const col of cols) {
      const headerStr = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
      let maxPx = measureTextPx(headerStr) + AUTO_RESIZE_HEADER_PADDING
      for (const row of filteredBySpecialty) {
        const s = getMarketCellDisplayString(col.id, row)
        maxPx = Math.max(maxPx, measureTextPx(s) + AUTO_RESIZE_CELL_PADDING)
      }
      const minSz = (col.columnDef.minSize as number) ?? COL_MIN
      const maxSz = (col.columnDef.maxSize as number) ?? COL_MAX
      sizing[col.id] = Math.max(minSz, Math.min(maxSz, maxPx))
    }
    setColumnSizing(sizing)
  }, [table, filteredBySpecialty])

  const didAutoResizeOnMount = useRef(false)
  useEffect(() => {
    if (didAutoResizeOnMount.current || filteredBySpecialty.length === 0) return
    didAutoResizeOnMount.current = true
    requestAnimationFrame(() => handleAutoResize())
  }, [handleAutoResize, filteredBySpecialty.length])

  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const start = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filteredCount)

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <span className="mb-2 block text-xs font-medium text-muted-foreground">Filters</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Search table</Label>
            <Input
              placeholder="Search table..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 w-full min-w-0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Specialty</Label>
            <DropdownMenu onOpenChange={(open) => !open && setSpecialtySearch('')}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full min-w-0 justify-between gap-2">
                  <span className="truncate">
                    {specialtyFilter === 'all' ? 'All specialties' : specialtyFilter}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden p-0" onCloseAutoFocus={(e: Event) => e.preventDefault()}>
                <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                  <Search className="size-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search specialties…"
                    value={specialtySearch}
                    onChange={(e) => setSpecialtySearch(e.target.value)}
                    className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[260px] overflow-y-auto p-1">
                  <DropdownMenuLabel className="sr-only">Specialty</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => onSpecialtyFilterChange('all')}>
                    All specialties
                  </DropdownMenuItem>
                  {filteredSpecialties.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">No specialty found.</div>
                  ) : (
                    filteredSpecialties.map((s) => (
                      <DropdownMenuItem key={s} onSelect={() => onSpecialtyFilterChange(String(s))}>
                        {s}
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag column headers to reorder; drag right edge to resize. Click the pin icon to freeze a column. Click the table, then use arrow keys to scroll.
      </p>
      <div className="rounded-md border flex flex-col">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
          <div className="flex items-center gap-1">
            {onAddMarketRow && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 border border-border bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary"
                onClick={() => {
                  setMarketEditRow(null)
                  setMarketModalMode('add')
                  setMarketModalOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add Market Data
              </Button>
            )}
          </div>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAutoResize} title="Size columns to fit content" aria-label="Auto-resize columns">
              <Columns3 className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Show / hide columns" aria-label="Column visibility">
                  <LayoutList className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Show / hide columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table.getAllLeafColumns().map((col) => (
                  <DropdownMenuCheckboxItem key={col.id} checked={col.getIsVisible()} onCheckedChange={(v) => col.toggleVisibility(!!v)}>
                    {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div
          ref={tableScrollRef}
          tabIndex={0}
          role="region"
          aria-label="Table body: use arrow keys to scroll"
          className="rounded-b-md border border-t-0 border-border overflow-x-auto overflow-y-auto min-h-0 bg-background isolate focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          style={{ maxHeight: `min(${TABLE_HEADER_HEIGHT + pageSize * TABLE_ROW_HEIGHT}px, 90vh)` }}
          onKeyDown={handleScrollKeyDown}
        >
        <table className="w-full caption-bottom text-sm" style={{ minWidth: 'max-content' }}>
          <TableHeader className={DATA_GRID.header}>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const colId = h.column.id
                  const canResize = h.column.getCanResize()
                  const isPinned = h.column.getIsPinned()
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        (h.column.columnDef.meta as { align?: string })?.align === 'right' ? 'text-right' : 'text-left',
                        'px-3 py-2.5 whitespace-nowrap relative group',
                        isPinned && PINNED_HEADER_CLASS,
                        draggedColId === colId && 'opacity-60',
                        dropTargetColId === colId && 'ring-1 ring-primary'
                      )}
                      style={{ width: h.getSize(), minWidth: h.getSize(), maxWidth: h.getSize(), ...getPinnedCellStyles(h.column, true) }}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          draggable
                          onDragStart={() => handleHeaderDragStart(colId)}
                          onDragOver={(e) => handleHeaderDragOver(e, colId)}
                          onDrop={() => handleHeaderDrop(table)}
                          onDragEnd={handleHeaderDragEnd}
                          className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-muted-foreground/20 shrink-0"
                          title="Drag to reorder"
                        >
                          <GripVertical className="size-4 text-muted-foreground" />
                        </span>
                        {h.column.getCanSort() ? (
                          <button type="button" onClick={() => h.column.toggleSorting()} className="hover:underline text-left flex-1 min-w-0 truncate">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </button>
                        ) : (
                          <span className="flex-1 min-w-0 truncate">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                        )}
                        {colId !== 'actions' && (
                          <button
                            type="button"
                            onClick={() => h.column.pin(isPinned ? false : 'left')}
                            className={cn(
                              'shrink-0 rounded p-0.5 transition-colors',
                              isPinned
                                ? 'text-primary hover:text-primary/70'
                                : 'text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-primary'
                            )}
                            title={isPinned ? 'Unpin column' : 'Pin column to left'}
                          >
                            {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                          </button>
                        )}
                      </div>
                      {canResize && (
                        <div onMouseDown={h.getResizeHandler()} onTouchStart={h.getResizeHandler()} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50" title="Resize" />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <tbody>
            {table.getRowModel().rows.map((row, pageRowIdx) => (
              <TableRow key={row.id} className={cn(pageRowIdx % 2 === 1 && 'bg-muted/30', 'hover:bg-muted/50 transition-colors')}>
                {row.getVisibleCells().map((cell) => {
                  const isPinned = cell.column.getIsPinned()
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        (cell.column.columnDef.meta as { align?: string })?.align === 'right' ? 'text-right tabular-nums' : '',
                        'px-3 py-2.5',
                        isPinned && (pageRowIdx % 2 === 1 ? PINNED_CELL_STRIPED_CLASS : PINNED_CELL_CLASS)
                      )}
                      style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize(), ...getPinnedCellStyles(cell.column) }}
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
        <p className="text-xs text-muted-foreground">
          Showing {start}–{end} of {filteredCount} row{filteredCount !== 1 ? 's' : ''}
          {(globalFilter || specialtyFilter !== 'all') && ` (from ${rows.length})`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="market-page-size" className="text-xs whitespace-nowrap text-muted-foreground">Rows</Label>
            <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger id="market-page-size" className="h-8 w-[75px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-1" disabled={pageIndex === 0} onClick={() => table.previousPage()}>
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <span className="px-2 text-xs text-muted-foreground tabular-nums">Page {pageIndex + 1} of {pageCount}</span>
            <Button variant="outline" size="sm" className="h-8 gap-1" disabled={pageIndex >= pageCount - 1} onClick={() => table.nextPage()}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      {(onUpdateMarketRow ?? onAddMarketRow) && (
        <MarketEditModal
          open={marketModalOpen}
          onOpenChange={setMarketModalOpen}
          mode={marketModalMode}
          initialRow={marketModalMode === 'edit' ? marketEditRow : null}
          onSaveEdit={onUpdateMarketRow ?? (() => {})}
          onSaveAdd={onAddMarketRow ?? (() => {})}
        />
      )}
    </div>
  )
}
