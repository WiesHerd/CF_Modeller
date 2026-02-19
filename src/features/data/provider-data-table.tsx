import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DATA_GRID, getPinnedCellStyles, PINNED_HEADER_CLASS, PINNED_CELL_CLASS, PINNED_CELL_STRIPED_CLASS } from '@/lib/data-grid-styles'
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, Columns3, Eraser, LayoutList, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import type { ProviderRow } from '@/types/provider'
import { ProviderEditModal } from '@/features/data/provider-edit-modal'
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
  getProviderCellDisplayString,
} from '@/features/data/data-tables-shared'
// ---- Provider table ----
const providerHelper = createColumnHelper<ProviderRow>()

interface ProviderDataTableProps {
  rows: ProviderRow[]
  /** Multi-select: empty = all specialties. */
  specialtyFilter?: string[]
  onSpecialtyFilterChange?: (value: string[]) => void
  /** Multi-select: empty = all divisions. */
  divisionFilter?: string[]
  onDivisionFilterChange?: (value: string[]) => void
  modelFilter?: string
  onModelFilterChange?: (value: string) => void
  /** Multi-select: empty = all provider types. */
  providerTypeFilter?: string[]
  onProviderTypeFilterChange?: (value: string[]) => void
  onUpdateProvider?: (providerId: string, updates: Partial<ProviderRow>) => void
  onAddProvider?: (row: ProviderRow) => void
  onDeleteProvider?: (providerId: string) => void
}

export function ProviderDataTable({
  rows,
  specialtyFilter: specialtyFilterProp,
  onSpecialtyFilterChange,
  divisionFilter: divisionFilterProp,
  onDivisionFilterChange,
  modelFilter: modelFilterProp = 'all',
  onModelFilterChange,
  providerTypeFilter: providerTypeFilterProp,
  onProviderTypeFilterChange,
  onUpdateProvider,
  onAddProvider,
  onDeleteProvider,
}: ProviderDataTableProps) {
  const [internalSpecialty, setInternalSpecialty] = useState<string[]>([])
  const [internalDivision, setInternalDivision] = useState<string[]>([])
  const [internalModel, setInternalModel] = useState('all')
  const [internalProviderType, setInternalProviderType] = useState<string[]>([])
  const rawSpecialty = specialtyFilterProp ?? internalSpecialty
  const specialtyFilter = Array.isArray(rawSpecialty)
    ? rawSpecialty
    : rawSpecialty === 'all' || rawSpecialty === '' || rawSpecialty == null
      ? []
      : [rawSpecialty]
  const setSpecialtyFilter = onSpecialtyFilterChange ?? setInternalSpecialty
  const rawDivision = divisionFilterProp ?? internalDivision
  const divisionFilter = Array.isArray(rawDivision)
    ? rawDivision
    : rawDivision === 'all' || rawDivision === '' || rawDivision == null
      ? []
      : [rawDivision]
  const setDivisionFilter = onDivisionFilterChange ?? setInternalDivision
  const modelFilter = modelFilterProp ?? internalModel
  const setModelFilter = onModelFilterChange ?? setInternalModel
  const rawProviderType = providerTypeFilterProp ?? internalProviderType
  const providerTypeFilter = Array.isArray(rawProviderType)
    ? rawProviderType
    : rawProviderType === 'all' || rawProviderType === '' || rawProviderType == null
      ? []
      : [rawProviderType]
  const setProviderTypeFilter = onProviderTypeFilterChange ?? setInternalProviderType

  const [providerModalOpen, setProviderModalOpen] = useState(false)
  const [providerModalMode, setProviderModalMode] = useState<'edit' | 'add'>('edit')
  const [providerEditRow, setProviderEditRow] = useState<ProviderRow | null>(null)

  const [sorting, setSorting] = useState<SortingState>([{ id: 'providerName', desc: false }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['providerName'], right: [] })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
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

  // Filters (state lifted to DataTablesScreen for persistence; search strings stay local)
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [divisionSearch, setDivisionSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [providerTypeSearch, setProviderTypeSearch] = useState('')
  const [totalFTEMin, setTotalFTEMin] = useState<string>('')
  const [totalFTEMax, setTotalFTEMax] = useState<string>('')
  const [clinicalFTEMin, setClinicalFTEMin] = useState<string>('')
  const [clinicalFTEMax, setClinicalFTEMax] = useState<string>('')
  const [workRVUsMin, setWorkRVUsMin] = useState<string>('')
  const [workRVUsMax, setWorkRVUsMax] = useState<string>('')
  const [totalWRVUsMin, setTotalWRVUsMin] = useState<string>('')
  const [totalWRVUsMax, setTotalWRVUsMax] = useState<string>('')

  const specialties = useMemo(() => {
    const set = new Set(
      rows
        .map((r) => r.specialty)
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    )
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])
  const divisions = useMemo(() => {
    const set = new Set(
      rows
        .map((r) => r.division)
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    )
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])
  const models = useMemo(() => {
    const set = new Set(rows.map((r) => r.productivityModel).filter(Boolean))
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])

  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return specialties
    const q = specialtySearch.toLowerCase()
    return specialties.filter((s) => String(s).toLowerCase().includes(q))
  }, [specialties, specialtySearch])
  const filteredDivisions = useMemo(() => {
    if (!divisionSearch.trim()) return divisions
    const q = divisionSearch.toLowerCase()
    return divisions.filter((d) => String(d).toLowerCase().includes(q))
  }, [divisions, divisionSearch])

  const toggleSpecialty = useCallback((specialty: string) => {
    const next = specialtyFilter.includes(specialty)
      ? specialtyFilter.filter((s) => s !== specialty)
      : [...specialtyFilter, specialty]
    setSpecialtyFilter(next)
  }, [specialtyFilter, setSpecialtyFilter])
  const toggleDivision = useCallback((division: string) => {
    const next = divisionFilter.includes(division)
      ? divisionFilter.filter((d) => d !== division)
      : [...divisionFilter, division]
    setDivisionFilter(next)
  }, [divisionFilter, setDivisionFilter])
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return models
    const q = modelSearch.toLowerCase()
    return models.filter((m) => String(m).toLowerCase().includes(q))
  }, [models, modelSearch])
  const providerTypes = useMemo(() => {
    const set = new Set(
      rows
        .map((r) => r.providerType)
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    )
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  }, [rows])
  const filteredProviderTypes = useMemo(() => {
    if (!providerTypeSearch.trim()) return providerTypes
    const q = providerTypeSearch.toLowerCase()
    return providerTypes.filter((t) => String(t).toLowerCase().includes(q))
  }, [providerTypes, providerTypeSearch])
  const toggleProviderType = useCallback((providerType: string) => {
    const next = providerTypeFilter.includes(providerType)
      ? providerTypeFilter.filter((t) => t !== providerType)
      : [...providerTypeFilter, providerType]
    setProviderTypeFilter(next)
  }, [providerTypeFilter, setProviderTypeFilter])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table column value types vary per column
  const columns = useMemo<ColumnDef<ProviderRow, any>[]>(
    () => [
      providerHelper.accessor('providerName', { header: 'Name', cell: (c) => c.getValue() ?? EMPTY, meta: { wrap: true }, size: 180, minSize: 100 }),
      providerHelper.accessor('specialty', { header: 'Specialty', cell: (c) => c.getValue() ?? EMPTY, size: 220, minSize: 120 }),
      providerHelper.accessor('division', { header: 'Division', cell: (c) => c.getValue() ?? EMPTY, size: 200, minSize: 100 }),
      providerHelper.accessor('providerType', { header: 'Type / Role', cell: (c) => c.getValue() ?? EMPTY, size: 140, minSize: 90 }),
      providerHelper.accessor('totalFTE', { header: 'Total FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 100, minSize: 85 }),
      providerHelper.accessor('clinicalFTE', { header: 'Clinical FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('adminFTE', { header: 'Admin FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 100, minSize: 85 }),
      providerHelper.accessor('researchFTE', { header: 'Research FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('teachingFTE', { header: 'Teaching FTE', cell: (c) => fmtNum(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('baseSalary', { header: 'Base salary', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 125, minSize: 100 }),
      providerHelper.accessor('adminPay', { header: 'Admin pay', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('teachingPay', { header: 'Teaching pay', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('researchPay', { header: 'Research pay', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('nonClinicalPay', { header: 'Non-clinical', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 120, minSize: 100 }),
      providerHelper.accessor((r) => r.workRVUs ?? r.pchWRVUs, { id: 'workRVUs', header: 'Work wRVUs', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('outsideWRVUs', { header: 'Outside wRVUs', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('totalWRVUs', { header: 'Total wRVUs', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 115, minSize: 95 }),
      providerHelper.accessor('currentCF', { header: 'Current CF', cell: (c) => fmtCur(c.getValue() as number | undefined, 2), meta: { align: 'right' }, size: 108, minSize: 90 }),
      providerHelper.accessor('currentThreshold', { header: 'Threshold', cell: (c) => fmtNum(c.getValue() as number | undefined, 0), meta: { align: 'right' }, size: 95, minSize: 80 }),
      providerHelper.accessor('qualityPayments', { header: 'Quality payment', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 120, minSize: 95 }),
      providerHelper.accessor('otherIncentives', { header: 'Other incentives', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 130, minSize: 100 }),
      providerHelper.accessor('otherIncentive1', { header: 'Other incentive 1', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 120, minSize: 95 }),
      providerHelper.accessor('otherIncentive2', { header: 'Other incentive 2', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 120, minSize: 95 }),
      providerHelper.accessor('otherIncentive3', { header: 'Other incentive 3', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 120, minSize: 95 }),
      providerHelper.accessor('currentTCC', { header: 'Current TCC', cell: (c) => fmtCur(c.getValue() as number | undefined), meta: { align: 'right' }, size: 125, minSize: 100 }),
      providerHelper.accessor('productivityModel', { header: 'Model', cell: (c) => c.getValue() ?? EMPTY, size: 110, minSize: 80 }),
      ...(onUpdateProvider || onDeleteProvider
        ? [
            providerHelper.display({
              id: 'actions',
              header: '',
              cell: ({ row }) => {
                const providerId = row.original.providerId ?? row.original.providerName ?? ''
                return (
                  <div className="flex items-center gap-0.5">
                    {onUpdateProvider && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Edit provider"
                        onClick={(e) => {
                          e.stopPropagation()
                          setProviderEditRow(row.original)
                          setProviderModalMode('edit')
                          setProviderModalOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {onDeleteProvider && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label="Delete provider"
                        onClick={(e) => {
                          e.stopPropagation()
                          const name = row.original.providerName ?? providerId
                          if (window.confirm(`Delete provider "${name}"? This cannot be undone.`)) {
                            onDeleteProvider(providerId)
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )
              },
              size: (onUpdateProvider && onDeleteProvider ? 88 : 52),
              minSize: (onUpdateProvider && onDeleteProvider ? 88 : 52),
            }),
          ]
        : []),
    ],
    [onUpdateProvider, onDeleteProvider]
  )

  const filteredRows = useMemo(() => {
    let out = rows
    if (specialtyFilter.length > 0) out = out.filter((r) => specialtyFilter.includes(r.specialty ?? ''))
    if (divisionFilter.length > 0) out = out.filter((r) => divisionFilter.includes(r.division ?? ''))
    if (modelFilter && modelFilter !== 'all') out = out.filter((r) => (r.productivityModel ?? '') === modelFilter)
    if (providerTypeFilter.length > 0) out = out.filter((r) => providerTypeFilter.includes(r.providerType ?? ''))
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
  }, [rows, specialtyFilter, divisionFilter, modelFilter, providerTypeFilter, totalFTEMin, totalFTEMax, clinicalFTEMin, clinicalFTEMax, workRVUsMin, workRVUsMax, totalWRVUsMin, totalWRVUsMax])

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
    state: { sorting, globalFilter, pagination, columnOrder, columnSizing, columnPinning, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
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

  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()

  const handleAutoResize = useCallback(() => {
    const cols = table.getVisibleLeafColumns()
    const sizing: ColumnSizingState = {}
    for (const col of cols) {
      const headerStr = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
      let maxPx = measureTextPx(headerStr) + AUTO_RESIZE_HEADER_PADDING
      for (const row of filteredRows) {
        const s = getProviderCellDisplayString(col.id, row)
        maxPx = Math.max(maxPx, measureTextPx(s) + AUTO_RESIZE_CELL_PADDING)
      }
      const minSz = (col.columnDef.minSize as number) ?? COL_MIN
      const maxSz = (col.columnDef.maxSize as number) ?? COL_MAX
      sizing[col.id] = Math.max(minSz, Math.min(maxSz, maxPx))
    }
    setColumnSizing(sizing)
  }, [table, filteredRows])

  const didAutoResizeOnMount = useRef(false)
  useEffect(() => {
    if (didAutoResizeOnMount.current || filteredRows.length === 0) return
    didAutoResizeOnMount.current = true
    requestAnimationFrame(() => handleAutoResize())
  }, [handleAutoResize, filteredRows.length])

  const filteredCount = table.getFilteredRowModel().rows.length
  const start = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filteredCount)
  const hasActiveFilters = specialtyFilter.length > 0 || divisionFilter.length > 0 || modelFilter !== 'all' || providerTypeFilter.length > 0 ||
    totalFTEMin !== '' || totalFTEMax !== '' || clinicalFTEMin !== '' || clinicalFTEMax !== '' ||
    workRVUsMin !== '' || workRVUsMax !== '' || totalWRVUsMin !== '' || totalWRVUsMax !== ''

  return (
    <div className="space-y-3">
      {/* Toolbar: search + filters distributed across width like Ranges */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filters</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSpecialtyFilter([])
                setDivisionFilter([])
                setModelFilter('all')
                setProviderTypeFilter([])
                setGlobalFilter('')
                setTotalFTEMin('')
                setTotalFTEMax('')
                setClinicalFTEMin('')
                setClinicalFTEMax('')
                setWorkRVUsMin('')
                setWorkRVUsMax('')
                setTotalWRVUsMin('')
                setTotalWRVUsMax('')
              }}
            >
              <Eraser className="size-3" />
              Clear filters
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                    {specialtyFilter.length === 0
                      ? 'All specialties'
                      : specialtyFilter.length === 1
                        ? specialtyFilter[0]
                        : `${specialtyFilter.length} specialties selected`}
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
                <DropdownMenuCheckboxItem
                  checked={specialtyFilter.length === 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => { if (checked) setSpecialtyFilter([]) }}
                >
                  All specialties
                </DropdownMenuCheckboxItem>
                {filteredSpecialties.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No specialty found.</div>
                ) : (
                  filteredSpecialties.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={specialtyFilter.includes(s)}
                      onSelect={(e) => { e.preventDefault() }}
                      onCheckedChange={() => toggleSpecialty(s)}
                    >
                      {s}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Division</Label>
            <DropdownMenu onOpenChange={(open) => !open && setDivisionSearch('')}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full min-w-0 justify-between gap-2">
                  <span className="truncate">
                    {divisionFilter.length === 0
                      ? 'All divisions'
                      : divisionFilter.length === 1
                        ? divisionFilter[0]
                        : `${divisionFilter.length} divisions selected`}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden p-0" onCloseAutoFocus={(e: Event) => e.preventDefault()}>
                <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                  <Search className="size-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search divisions…"
                    value={divisionSearch}
                    onChange={(e) => setDivisionSearch(e.target.value)}
                    className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[260px] overflow-y-auto p-1">
                  <DropdownMenuLabel className="sr-only">Division</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={divisionFilter.length === 0}
                    onSelect={(e) => { e.preventDefault() }}
                    onCheckedChange={(checked) => { if (checked) setDivisionFilter([]) }}
                  >
                    All divisions
                  </DropdownMenuCheckboxItem>
                  {filteredDivisions.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">No division found.</div>
                  ) : (
                    filteredDivisions.map((d) => (
                      <DropdownMenuCheckboxItem
                        key={d}
                        checked={divisionFilter.includes(d)}
                        onSelect={(e) => { e.preventDefault() }}
                        onCheckedChange={() => toggleDivision(d)}
                      >
                        {d}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Model</Label>
            <DropdownMenu onOpenChange={(open) => !open && setModelSearch('')}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full min-w-0 justify-between gap-2">
                  <span className="truncate">
                    {modelFilter === 'all' ? 'All models' : modelFilter}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden p-0" onCloseAutoFocus={(e: Event) => e.preventDefault()}>
                <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                  <Search className="size-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search models…"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[260px] overflow-y-auto p-1">
                  <DropdownMenuLabel className="sr-only">Model</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => setModelFilter('all')}>
                    All models
                  </DropdownMenuItem>
                  {filteredModels.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">No model found.</div>
                  ) : (
                    filteredModels.map((m) => (
                      <DropdownMenuItem key={m} onSelect={() => setModelFilter(String(m))}>
                        {m}
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Provider type</Label>
            <DropdownMenu onOpenChange={(open) => !open && setProviderTypeSearch('')}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full min-w-0 justify-between gap-2">
                  <span className="truncate">
                    {providerTypeFilter.length === 0
                      ? 'All types'
                      : providerTypeFilter.length === 1
                        ? providerTypeFilter[0]
                        : `${providerTypeFilter.length} types selected`}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden p-0" onCloseAutoFocus={(e: Event) => e.preventDefault()}>
                <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                  <Search className="size-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search types…"
                    value={providerTypeSearch}
                    onChange={(e) => setProviderTypeSearch(e.target.value)}
                    className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[260px] overflow-y-auto p-1">
                  <DropdownMenuLabel className="sr-only">Provider type</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={providerTypeFilter.length === 0}
                    onSelect={(e) => { e.preventDefault() }}
                    onCheckedChange={(checked) => { if (checked) setProviderTypeFilter([]) }}
                  >
                    All types
                  </DropdownMenuCheckboxItem>
                  {filteredProviderTypes.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">No provider type found.</div>
                  ) : (
                    filteredProviderTypes.map((t) => (
                      <DropdownMenuCheckboxItem
                        key={t}
                        checked={providerTypeFilter.includes(t)}
                        onSelect={(e) => { e.preventDefault() }}
                        onCheckedChange={() => toggleProviderType(t)}
                      >
                        {t}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {/* Ranges: 2x2 grid so they don't stretch in one long line */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <span className="mb-2 block text-xs font-medium text-muted-foreground">Ranges</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-1.5">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Total FTE</Label>
            <Input type="number" placeholder="Min" value={totalFTEMin} onChange={(e) => setTotalFTEMin(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={totalFTEMax} onChange={(e) => setTotalFTEMax(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Clinical FTE</Label>
            <Input type="number" placeholder="Min" value={clinicalFTEMin} onChange={(e) => setClinicalFTEMin(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={clinicalFTEMax} onChange={(e) => setClinicalFTEMax(e.target.value)} className="h-8 w-20 text-xs" step="0.01" min={0} max={2} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Work wRVUs</Label>
            <Input type="number" placeholder="Min" value={workRVUsMin} onChange={(e) => setWorkRVUsMin(e.target.value)} className="h-8 w-20 text-xs" min={0} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={workRVUsMax} onChange={(e) => setWorkRVUsMax(e.target.value)} className="h-8 w-20 text-xs" min={0} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Total wRVUs</Label>
            <Input type="number" placeholder="Min" value={totalWRVUsMin} onChange={(e) => setTotalWRVUsMin(e.target.value)} className="h-8 w-20 text-xs" min={0} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" placeholder="Max" value={totalWRVUsMax} onChange={(e) => setTotalWRVUsMax(e.target.value)} className="h-8 w-20 text-xs" min={0} />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag column headers to reorder; drag right edge to resize. Click the pin icon to freeze a column. Click the table, then use arrow keys to scroll.
      </p>
      <div className="rounded-md border flex flex-col">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
          <div className="flex items-center gap-1">
            {onAddProvider && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 border border-border bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary"
                onClick={() => {
                  setProviderEditRow(null)
                  setProviderModalMode('add')
                  setProviderModalOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add provider
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
          {(globalFilter || hasActiveFilters) && ` (from ${rows.length})`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="provider-page-size" className="text-xs whitespace-nowrap text-muted-foreground">Rows</Label>
            <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger id="provider-page-size" className="h-8 w-[75px]"><SelectValue /></SelectTrigger>
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
      {(onUpdateProvider ?? onAddProvider) && (
        <ProviderEditModal
          open={providerModalOpen}
          onOpenChange={setProviderModalOpen}
          mode={providerModalMode}
          initialRow={providerModalMode === 'edit' ? providerEditRow : null}
          onSaveEdit={onUpdateProvider ?? (() => {})}
          onSaveAdd={onAddProvider ?? (() => {})}
        />
      )}
    </div>
  )
}

