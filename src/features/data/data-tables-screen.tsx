'use client'

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
  type VisibilityState,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/utils/format'
import { ChevronLeft, ChevronRight, GripVertical, Columns3, Maximize2 } from 'lucide-react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'

const EMPTY = '—'
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
/** Approximate px per character (text-sm) for auto-resize. */
const PX_PER_CHAR = 8
const AUTO_RESIZE_PADDING = 32
const COL_MIN = 60
const COL_MAX = 500

function fmtCur(n: number | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatCurrency(n, { decimals })
}
function fmtNum(n: number | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatNumber(n, decimals)
}

/** Return display string for a provider column (for auto-resize width estimation). */
function getProviderCellDisplayString(columnId: string, row: ProviderRow): string {
  switch (columnId) {
    case 'providerName': return String(row.providerName ?? EMPTY)
    case 'specialty': return String(row.specialty ?? EMPTY)
    case 'division': return String(row.division ?? EMPTY)
    case 'totalFTE': return fmtNum(row.totalFTE, 2)
    case 'clinicalFTE': return fmtNum(row.clinicalFTE, 2)
    case 'adminFTE': return fmtNum(row.adminFTE, 2)
    case 'researchFTE': return fmtNum(row.researchFTE, 2)
    case 'teachingFTE': return fmtNum(row.teachingFTE, 2)
    case 'baseSalary': return fmtCur(row.baseSalary)
    case 'nonClinicalPay': return fmtCur(row.nonClinicalPay)
    case 'workRVUs': return fmtNum(row.workRVUs ?? row.pchWRVUs, 0)
    case 'outsideWRVUs': return fmtNum(row.outsideWRVUs, 0)
    case 'totalWRVUs': return fmtNum(row.totalWRVUs, 0)
    case 'currentCF': return fmtCur(row.currentCF, 2)
    case 'currentThreshold': return fmtNum(row.currentThreshold, 0)
    case 'qualityPayments': return fmtCur(row.qualityPayments)
    case 'otherIncentives': return fmtCur(row.otherIncentives)
    case 'currentTCC': return fmtCur(row.currentTCC)
    case 'productivityModel': return String(row.productivityModel ?? EMPTY)
    default: return ''
  }
}

/** Return display string for a market column (for auto-resize width estimation). */
function getMarketCellDisplayString(columnId: string, row: MarketRow): string {
  if (columnId === 'specialty') return String(row.specialty ?? EMPTY)
  if (columnId === 'providerType') return String(row.providerType ?? EMPTY)
  if (columnId === 'region') return String(row.region ?? EMPTY)
  const numVal = (row as unknown as Record<string, unknown>)[columnId]
  if (columnId.startsWith('TCC_') || columnId.startsWith('CF_')) return fmtCur(numVal as number | undefined, columnId.startsWith('CF_') ? 2 : 0)
  if (columnId.startsWith('WRVU_')) return fmtNum(numVal as number | undefined, 0)
  return String(numVal ?? EMPTY)
}

interface DataTablesScreenProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  onNavigateToUpload?: () => void
}

export function DataTablesScreen({
  providerRows,
  marketRows,
  onNavigateToUpload,
}: DataTablesScreenProps) {
  const hasAny = providerRows.length > 0 || marketRows.length > 0

  if (!hasAny) {
    return (
      <div className="space-y-6">
        <h2 className="section-title">Data</h2>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No provider or market data loaded. Upload provider and market files on the Upload screen to browse and filter here.
            </p>
            {onNavigateToUpload && (
              <Button onClick={onNavigateToUpload}>Go to Upload</Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const defaultTab = providerRows.length > 0 ? 'providers' : 'market'
  return (
    <div className="space-y-6">
      <h2 className="section-title">Data</h2>
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList>
          <TabsTrigger value="providers">Providers ({providerRows.length})</TabsTrigger>
          <TabsTrigger value="market">Market ({marketRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="providers" className="mt-4">
          {providerRows.length > 0 ? (
            <ProviderDataTable rows={providerRows} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No provider data loaded.{' '}
                {onNavigateToUpload && (
                  <button type="button" onClick={onNavigateToUpload} className="text-primary hover:underline">
                    Upload
                  </button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="market" className="mt-4">
          {marketRows.length > 0 ? (
            <MarketDataTable rows={marketRows} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No market data loaded.{' '}
                {onNavigateToUpload && (
                  <button type="button" onClick={onNavigateToUpload} className="text-primary hover:underline">
                    Upload
                  </button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---- Provider table ----
const providerHelper = createColumnHelper<ProviderRow>()

function ProviderDataTable({ rows }: { rows: ProviderRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'providerName', desc: false }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const dragColIdRef = useRef<string | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const SCROLL_STEP = 120
  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
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
      case 'PageUp':
        el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' })
        e.preventDefault()
        break
      case 'PageDown':
        el.scrollBy({ top: el.clientHeight, behavior: 'smooth' })
        e.preventDefault()
        break
      default:
        break
    }
  }, [])

  // Filters
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [modelFilter, setModelFilter] = useState<string>('all')
  const [totalFTEMin, setTotalFTEMin] = useState<string>('')
  const [totalFTEMax, setTotalFTEMax] = useState<string>('')
  const [clinicalFTEMin, setClinicalFTEMin] = useState<string>('')
  const [clinicalFTEMax, setClinicalFTEMax] = useState<string>('')
  const [workRVUsMin, setWorkRVUsMin] = useState<string>('')
  const [workRVUsMax, setWorkRVUsMax] = useState<string>('')
  const [totalWRVUsMin, setTotalWRVUsMin] = useState<string>('')
  const [totalWRVUsMax, setTotalWRVUsMax] = useState<string>('')

  const specialties = useMemo(() => {
    const set = new Set(rows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])
  const divisions = useMemo(() => {
    const set = new Set(rows.map((r) => r.division).filter(Boolean))
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])
  const models = useMemo(() => {
    const set = new Set(rows.map((r) => r.productivityModel).filter(Boolean))
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])

  const columns = useMemo<ColumnDef<ProviderRow, any>[]>(
    () => [
      providerHelper.accessor('providerName', { header: 'Name', cell: (c) => c.getValue() ?? EMPTY, meta: { wrap: true }, size: 180, minSize: 100 }),
      providerHelper.accessor('specialty', { header: 'Specialty', cell: (c) => c.getValue() ?? EMPTY, size: 220, minSize: 120 }),
      providerHelper.accessor('division', { header: 'Division', cell: (c) => c.getValue() ?? EMPTY, size: 200, minSize: 100 }),
      providerHelper.accessor('totalFTE', { header: 'Total FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 100, minSize: 85 }),
      providerHelper.accessor('clinicalFTE', { header: 'Clinical FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('adminFTE', { header: 'Admin FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 100, minSize: 85 }),
      providerHelper.accessor('researchFTE', { header: 'Research FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('teachingFTE', { header: 'Teaching FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('baseSalary', { header: 'Base salary', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 125, minSize: 100 }),
      providerHelper.accessor('nonClinicalPay', { header: 'Non-clinical', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 120, minSize: 100 }),
      providerHelper.accessor((r) => r.workRVUs ?? r.pchWRVUs, { id: 'workRVUs', header: 'Work wRVUs', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('outsideWRVUs', { header: 'Outside wRVUs', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('totalWRVUs', { header: 'Total wRVUs', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('currentCF', { header: 'Current CF', cell: (c) => fmtCur(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('currentThreshold', { header: 'Threshold', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 95, minSize: 80 }),
      providerHelper.accessor('qualityPayments', { header: 'Quality', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 105, minSize: 85 }),
      providerHelper.accessor('otherIncentives', { header: 'Other incentives', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 130, minSize: 100 }),
      providerHelper.accessor('currentTCC', { header: 'Current TCC', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 125, minSize: 100 }),
      providerHelper.accessor('productivityModel', { header: 'Model', cell: (c) => c.getValue() ?? EMPTY, size: 110, minSize: 80 }),
    ],
    []
  )

  const filteredRows = useMemo(() => {
    let out = rows
    if (specialtyFilter && specialtyFilter !== 'all') out = out.filter((r) => (r.specialty ?? '') === specialtyFilter)
    if (divisionFilter && divisionFilter !== 'all') out = out.filter((r) => (r.division ?? '') === divisionFilter)
    if (modelFilter && modelFilter !== 'all') out = out.filter((r) => (r.productivityModel ?? '') === modelFilter)
    const tMin = totalFTEMin !== '' ? Number(totalFTEMin) : null
    const tMax = totalFTEMax !== '' ? Number(totalFTEMax) : null
    if (tMin != null && Number.isFinite(tMin)) out = out.filter((r) => (r.totalFTE ?? 0) >= tMin)
    if (tMax != null && Number.isFinite(tMax)) out = out.filter((r) => (r.totalFTE ?? 0) <= tMax)
    const cMin = clinicalFTEMin !== '' ? Number(clinicalFTEMin) : null
    const cMax = clinicalFTEMax !== '' ? Number(clinicalFTEMax) : null
    if (cMin != null && Number.isFinite(cMin)) out = out.filter((r) => (r.clinicalFTE ?? 0) >= cMin)
    if (cMax != null && Number.isFinite(cMax)) out = out.filter((r) => (r.clinicalFTE ?? 0) <= cMax)
    const wMin = workRVUsMin !== '' ? Number(workRVUsMin) : null
    const wMax = workRVUsMax !== '' ? Number(workRVUsMax) : null
    const workRvus = (r: ProviderRow) => r.workRVUs ?? r.pchWRVUs ?? 0
    if (wMin != null && Number.isFinite(wMin)) out = out.filter((r) => workRvus(r) >= wMin)
    if (wMax != null && Number.isFinite(wMax)) out = out.filter((r) => workRvus(r) <= wMax)
    const twMin = totalWRVUsMin !== '' ? Number(totalWRVUsMin) : null
    const twMax = totalWRVUsMax !== '' ? Number(totalWRVUsMax) : null
    if (twMin != null && Number.isFinite(twMin)) out = out.filter((r) => (r.totalWRVUs ?? 0) >= twMin)
    if (twMax != null && Number.isFinite(twMax)) out = out.filter((r) => (r.totalWRVUs ?? 0) <= twMax)
    return out
  }, [rows, specialtyFilter, divisionFilter, modelFilter, totalFTEMin, totalFTEMax, clinicalFTEMin, clinicalFTEMax, workRVUsMin, workRVUsMax, totalWRVUsMin, totalWRVUsMax])

  const getOrderedColumnIds = useCallback((table: ReturnType<typeof useReactTable<ProviderRow>>) => {
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
  const handleHeaderDrop = useCallback((table: ReturnType<typeof useReactTable<ProviderRow>>) => {
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
    data: filteredRows,
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
    defaultColumn: { minSize: COL_MIN, maxSize: COL_MAX },
  })

  const handleAutoResize = useCallback(() => {
    const cols = table.getAllLeafColumns()
    const sizing: ColumnSizingState = {}
    for (const col of cols) {
      const headerStr = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
      let maxLen = headerStr.length
      for (const row of filteredRows) {
        const s = getProviderCellDisplayString(col.id, row)
        if (s.length > maxLen) maxLen = s.length
      }
      const minSz = (col.columnDef.minSize as number) ?? COL_MIN
      const maxSz = (col.columnDef.maxSize as number) ?? COL_MAX
      const w = Math.max(minSz, Math.min(maxSz, maxLen * PX_PER_CHAR + AUTO_RESIZE_PADDING))
      sizing[col.id] = w
    }
    setColumnSizing(sizing)
  }, [table, filteredRows])

  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const start = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filteredCount)
  const hasActiveFilters = specialtyFilter !== 'all' || divisionFilter !== 'all' || modelFilter !== 'all' ||
    totalFTEMin !== '' || totalFTEMax !== '' || clinicalFTEMin !== '' || clinicalFTEMax !== '' ||
    workRVUsMin !== '' || workRVUsMax !== '' || totalWRVUsMin !== '' || totalWRVUsMax !== ''

  return (
    <div className="space-y-3">
      {/* Toolbar: search, filters, columns, page size */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search table..." value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-xs h-9" />
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Specialty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specialties</SelectItem>
            {specialties.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Division" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All divisions</SelectItem>
            {divisions.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((m) => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Label htmlFor="provider-page-size" className="text-xs whitespace-nowrap">Rows</Label>
          <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger id="provider-page-size" className="h-9 w-[85px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* FTE & wRVU range filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Ranges</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Total FTE</Label>
            <Input type="number" placeholder="Min" value={totalFTEMin} onChange={(e) => setTotalFTEMin(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={totalFTEMax} onChange={(e) => setTotalFTEMax(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Clinical FTE</Label>
            <Input type="number" placeholder="Min" value={clinicalFTEMin} onChange={(e) => setClinicalFTEMin(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={clinicalFTEMax} onChange={(e) => setClinicalFTEMax(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Work wRVUs</Label>
            <Input type="number" placeholder="Min" value={workRVUsMin} onChange={(e) => setWorkRVUsMin(e.target.value)} className="h-8 w-24 text-xs" min={0} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={workRVUsMax} onChange={(e) => setWorkRVUsMax(e.target.value)} className="h-8 w-24 text-xs" min={0} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Total wRVUs</Label>
            <Input type="number" placeholder="Min" value={totalWRVUsMin} onChange={(e) => setTotalWRVUsMin(e.target.value)} className="h-8 w-24 text-xs" min={0} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={totalWRVUsMax} onChange={(e) => setTotalWRVUsMax(e.target.value)} className="h-8 w-24 text-xs" min={0} />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag column headers to reorder; drag right edge to resize. Use Auto-resize to fit content. Focus the table and use arrow keys to scroll.
      </p>
      <div
        ref={tableScrollRef}
        role="region"
        aria-label="Provider data table"
        tabIndex={0}
        className="rounded-md border flex flex-col focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onKeyDown={handleTableKeyDown}
      >
        <div className="flex justify-end gap-0.5 px-2 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAutoResize} title="Size columns to fit content" aria-label="Auto-resize columns">
            <Maximize2 className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Show / hide columns" aria-label="Column visibility">
                <Columns3 className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Show / hide columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().filter((c) => c.id !== 'expand').map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                >
                  {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="overflow-x-auto overflow-y-auto min-h-0" style={{ maxHeight: 'min(880px, 65vh)' }}>
        <table className="w-full caption-bottom text-sm" style={{ minWidth: 'max-content' }}>
          <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const colId = h.column.id
                  const canResize = h.column.getCanResize()
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        (h.column.columnDef.meta as { align?: string })?.align === 'right' ? 'text-right' : 'text-left',
                        'px-3 py-2.5 whitespace-normal break-words relative group',
                        draggedColId === colId && 'opacity-60',
                        dropTargetColId === colId && 'ring-1 ring-primary'
                      )}
                      style={{ width: h.getSize(), minWidth: h.getSize(), maxWidth: h.getSize() }}
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
                          <button type="button" onClick={() => h.column.toggleSorting()} className="hover:underline text-left flex-1 min-w-0 break-words">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </button>
                        ) : (
                          <span className="flex-1 min-w-0 break-words">{flexRender(h.column.columnDef.header, h.getContext())}</span>
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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={cn(row.index % 2 === 1 && 'bg-muted/30')}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      (cell.column.columnDef.meta as { align?: string })?.align === 'right' ? 'text-right tabular-nums' : '',
                      'px-3 py-2.5'
                    )}
                    style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          Showing {start}–{end} of {filteredCount} row{filteredCount !== 1 ? 's' : ''}
          {(globalFilter || hasActiveFilters) && ` (from ${rows.length})`}
        </p>
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
  )
}

// ---- Market table ----
const marketHelper = createColumnHelper<MarketRow>()

function MarketDataTable({ rows }: { rows: MarketRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'specialty', desc: false }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const dragColIdRef = useRef<string | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const SCROLL_STEP = 120
  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
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
      case 'PageUp':
        el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' })
        e.preventDefault()
        break
      case 'PageDown':
        el.scrollBy({ top: el.clientHeight, behavior: 'smooth' })
        e.preventDefault()
        break
      default:
        break
    }
  }, [])

  const specialties = useMemo(() => {
    const set = new Set(rows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])

  const columns = useMemo<ColumnDef<MarketRow, any>[]>(
    () => [
      marketHelper.accessor('specialty', { header: 'Specialty', cell: (c) => c.getValue() ?? EMPTY, size: 200, minSize: 120 }),
      marketHelper.accessor('providerType', { header: 'Type', cell: (c) => c.getValue() ?? EMPTY, size: 100, minSize: 70 }),
      marketHelper.accessor('region', { header: 'Region', cell: (c) => c.getValue() ?? EMPTY, size: 100, minSize: 70 }),
      ...(['TCC_25', 'TCC_50', 'TCC_75', 'TCC_90'] as const).map((k) =>
        marketHelper.accessor(k, { header: k, cell: (c) => fmtCur(c.getValue() as number), meta: { align: 'right' }, size: 110, minSize: 90 })
      ),
      ...(['WRVU_25', 'WRVU_50', 'WRVU_75', 'WRVU_90'] as const).map((k) =>
        marketHelper.accessor(k, { header: k, cell: (c) => fmtNum(c.getValue() as number), meta: { align: 'right' }, size: 100, minSize: 85 })
      ),
      ...(['CF_25', 'CF_50', 'CF_75', 'CF_90'] as const).map((k) =>
        marketHelper.accessor(k, { header: k, cell: (c) => fmtCur(c.getValue() as number, 2), meta: { align: 'right' }, size: 100, minSize: 85 })
      ),
    ],
    []
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
    defaultColumn: { minSize: COL_MIN, maxSize: COL_MAX },
  })

  const handleAutoResize = useCallback(() => {
    const cols = table.getAllLeafColumns()
    const sizing: ColumnSizingState = {}
    for (const col of cols) {
      const headerStr = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
      let maxLen = headerStr.length
      for (const row of filteredBySpecialty) {
        const s = getMarketCellDisplayString(col.id, row)
        if (s.length > maxLen) maxLen = s.length
      }
      const minSz = (col.columnDef.minSize as number) ?? COL_MIN
      const maxSz = (col.columnDef.maxSize as number) ?? COL_MAX
      const w = Math.max(minSz, Math.min(maxSz, maxLen * PX_PER_CHAR + AUTO_RESIZE_PADDING))
      sizing[col.id] = w
    }
    setColumnSizing(sizing)
  }, [table, filteredBySpecialty])

  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const start = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filteredCount)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search table..." value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-xs h-9" />
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Specialty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specialties</SelectItem>
            {specialties.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Label htmlFor="market-page-size" className="text-xs whitespace-nowrap">Rows</Label>
          <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger id="market-page-size" className="h-9 w-[85px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag column headers to reorder; drag right edge to resize. Focus the table and use arrow keys to scroll.
      </p>
      <div
        ref={tableScrollRef}
        role="region"
        aria-label="Market data table"
        tabIndex={0}
        className="rounded-md border flex flex-col focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onKeyDown={handleTableKeyDown}
      >
        <div className="flex justify-end gap-0.5 px-2 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAutoResize} title="Size columns to fit content" aria-label="Auto-resize columns">
            <Maximize2 className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Show / hide columns" aria-label="Column visibility">
                <Columns3 className="size-4" />
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
        <div className="overflow-x-auto overflow-y-auto min-h-0" style={{ maxHeight: 'min(880px, 65vh)' }}>
        <table className="w-full caption-bottom text-sm" style={{ minWidth: 'max-content' }}>
          <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const colId = h.column.id
                  const canResize = h.column.getCanResize()
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        (h.column.columnDef.meta as { align?: string })?.align === 'right' ? 'text-right' : 'text-left',
                        'px-3 py-2.5 whitespace-normal break-words relative group',
                        draggedColId === colId && 'opacity-60',
                        dropTargetColId === colId && 'ring-1 ring-primary'
                      )}
                      style={{ width: h.getSize(), minWidth: h.getSize(), maxWidth: h.getSize() }}
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
                          <button type="button" onClick={() => h.column.toggleSorting()} className="hover:underline text-left flex-1 min-w-0 break-words">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </button>
                        ) : (
                          <span className="flex-1 min-w-0 break-words">{flexRender(h.column.columnDef.header, h.getContext())}</span>
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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={cn(row.index % 2 === 1 && 'bg-muted/30')}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      (cell.column.columnDef.meta as { align?: string })?.align === 'right' ? 'text-right tabular-nums' : '',
                      'px-3 py-2.5'
                    )}
                    style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
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
  )
}
