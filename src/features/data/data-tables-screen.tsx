'use client'

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
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
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
import { DATA_GRID, getPinnedCellStyles, PINNED_HEADER_CLASS, PINNED_CELL_CLASS, PINNED_CELL_STRIPED_CLASS } from '@/lib/data-grid-styles'
import { loadDataBrowserFilters, saveDataBrowserFilters, type DataBrowserFilters } from '@/lib/storage'
import { formatCurrency, formatNumber } from '@/utils/format'
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, Columns3, LayoutList, Pencil, Pin, PinOff, Plus, Table2, Trash2 } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import { ProviderEditModal } from '@/features/data/provider-edit-modal'
import { MarketEditModal } from '@/features/data/market-edit-modal'

const EMPTY = '—'
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
/** Generous px per character fallback (covers most Latin fonts at 14px). */
const PX_PER_CHAR = 9
/** Extra px for body cells: px-3 L+R (24) + breathing room (16). */
const AUTO_RESIZE_CELL_PADDING = 40
/** Extra px for header cells: px-3 L+R (24) + grip icon (20) + gap (4) + resize handle + safety (24). */
const AUTO_RESIZE_HEADER_PADDING = 72
const COL_MIN = 60
const COL_MAX = 500
/** Approximate row and header heights for dynamic table container (px). */
const TABLE_ROW_HEIGHT = 41
const TABLE_HEADER_HEIGHT = 41

let _measureCtx: CanvasRenderingContext2D | null = null
/**
 * Measure text width. Returns the MAXIMUM of canvas measurement and a
 * character-count fallback so we never underestimate when the web font
 * hasn't loaded or canvas returns stale metrics.
 */
function measureTextPx(text: string): number {
  const charEstimate = Math.ceil(text.length * PX_PER_CHAR)
  if (typeof document !== 'undefined' && !_measureCtx) {
    const canvas = document.createElement('canvas')
    _measureCtx = canvas.getContext('2d')
    if (_measureCtx) _measureCtx.font = '500 14px Inter, ui-sans-serif, system-ui, sans-serif'
  }
  if (_measureCtx) return Math.max(Math.ceil(_measureCtx.measureText(text).width), charEstimate)
  return charEstimate
}

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
    case 'providerType': return String(row.providerType ?? EMPTY)
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
  /** Controlled tab when provided; use with onDataTabChange. */
  dataTab?: 'providers' | 'market'
  onDataTabChange?: (tab: 'providers' | 'market') => void
  onNavigateToUpload?: () => void
  onUpdateProvider?: (providerId: string, updates: Partial<ProviderRow>) => void
  onAddProvider?: (row: ProviderRow) => void
  onDeleteProvider?: (providerId: string) => void
  onUpdateMarketRow?: (existingRow: MarketRow, updates: Partial<MarketRow>) => void
  onAddMarketRow?: (row: MarketRow) => void
  onDeleteMarketRow?: (row: MarketRow) => void
}

export function DataTablesScreen({
  providerRows,
  marketRows,
  dataTab: controlledTab,
  onDataTabChange,
  onNavigateToUpload,
  onUpdateProvider,
  onAddProvider,
  onDeleteProvider,
  onUpdateMarketRow,
  onAddMarketRow,
  onDeleteMarketRow,
}: DataTablesScreenProps) {
  const defaultTab = providerRows.length > 0 ? 'providers' : 'market'
  const [persistedFilters, setPersistedFilters] = useState(loadDataBrowserFilters)
  useEffect(() => {
    saveDataBrowserFilters(persistedFilters)
  }, [persistedFilters])
  const [internalTab, setInternalTab] = useState<'providers' | 'market'>(() =>
    controlledTab ?? persistedFilters.dataTab ?? defaultTab
  )
  const hasAny = providerRows.length > 0 || marketRows.length > 0

  if (!hasAny) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<Table2 />}>Data browser</SectionTitleWithIcon>
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

  const tabValue = controlledTab ?? internalTab
  const handleTabChange = (v: string) => {
    const t = v as 'providers' | 'market'
    setPersistedFilters((prev: DataBrowserFilters) => ({ ...prev, dataTab: t }))
    if (onDataTabChange) onDataTabChange(t)
    else setInternalTab(t)
  }
  return (
    <div className="space-y-6">
      <SectionTitleWithIcon icon={<Table2 />}>Data browser</SectionTitleWithIcon>
      <Tabs value={tabValue} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="providers">Providers ({providerRows.length})</TabsTrigger>
          <TabsTrigger value="market">Market ({marketRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="providers" className="mt-4">
          {providerRows.length > 0 ? (
            <ProviderDataTable
              rows={providerRows}
              specialtyFilter={persistedFilters.providerSpecialty}
              onSpecialtyFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, providerSpecialty: v }))}
              divisionFilter={persistedFilters.providerDivision}
              onDivisionFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, providerDivision: v }))}
              modelFilter={persistedFilters.providerModel}
              onModelFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, providerModel: v }))}
              onUpdateProvider={onUpdateProvider}
              onAddProvider={onAddProvider}
              onDeleteProvider={onDeleteProvider}
            />
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
            <MarketDataTable
              rows={marketRows}
              specialtyFilter={persistedFilters.marketSpecialty}
              onSpecialtyFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, marketSpecialty: v }))}
              onUpdateMarketRow={onUpdateMarketRow}
              onAddMarketRow={onAddMarketRow}
              onDeleteMarketRow={onDeleteMarketRow}
            />
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

interface ProviderDataTableProps {
  rows: ProviderRow[]
  specialtyFilter?: string
  onSpecialtyFilterChange?: (value: string) => void
  divisionFilter?: string
  onDivisionFilterChange?: (value: string) => void
  modelFilter?: string
  onModelFilterChange?: (value: string) => void
  onUpdateProvider?: (providerId: string, updates: Partial<ProviderRow>) => void
  onAddProvider?: (row: ProviderRow) => void
  onDeleteProvider?: (providerId: string) => void
}

function ProviderDataTable({
  rows,
  specialtyFilter: specialtyFilterProp = 'all',
  onSpecialtyFilterChange,
  divisionFilter: divisionFilterProp = 'all',
  onDivisionFilterChange,
  modelFilter: modelFilterProp = 'all',
  onModelFilterChange,
  onUpdateProvider,
  onAddProvider,
  onDeleteProvider,
}: ProviderDataTableProps) {
  const [internalSpecialty, setInternalSpecialty] = useState('all')
  const [internalDivision, setInternalDivision] = useState('all')
  const [internalModel, setInternalModel] = useState('all')
  const specialtyFilter = specialtyFilterProp ?? internalSpecialty
  const setSpecialtyFilter = onSpecialtyFilterChange ?? setInternalSpecialty
  const divisionFilter = divisionFilterProp ?? internalDivision
  const setDivisionFilter = onDivisionFilterChange ?? setInternalDivision
  const modelFilter = modelFilterProp ?? internalModel
  const setModelFilter = onModelFilterChange ?? setInternalModel

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
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return models
    const q = modelSearch.toLowerCase()
    return models.filter((m) => String(m).toLowerCase().includes(q))
  }, [models, modelSearch])

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
  const hasActiveFilters = specialtyFilter !== 'all' || divisionFilter !== 'all' || modelFilter !== 'all' ||
    totalFTEMin !== '' || totalFTEMax !== '' || clinicalFTEMin !== '' || clinicalFTEMax !== '' ||
    workRVUsMin !== '' || workRVUsMax !== '' || totalWRVUsMin !== '' || totalWRVUsMax !== ''

  return (
    <div className="space-y-3">
      {/* Toolbar: search + filters distributed across width like Ranges */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <span className="mb-2 block text-xs font-medium text-muted-foreground">Filters</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <Command shouldFilter={false} className="rounded-none border-0">
                <CommandInput placeholder="Search specialties…" value={specialtySearch} onValueChange={setSpecialtySearch} className="h-9" />
                <CommandList>
                  <CommandEmpty>No specialty found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="all" onSelect={() => setSpecialtyFilter('all')}>
                      All specialties
                    </CommandItem>
                    {filteredSpecialties.map((s) => (
                      <CommandItem key={s} value={String(s)} onSelect={() => setSpecialtyFilter(String(s))}>
                        {s}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Division</Label>
            <DropdownMenu onOpenChange={(open) => !open && setDivisionSearch('')}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full min-w-0 justify-between gap-2">
                  <span className="truncate">
                    {divisionFilter === 'all' ? 'All divisions' : divisionFilter}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden p-0" onCloseAutoFocus={(e: Event) => e.preventDefault()}>
                <Command shouldFilter={false} className="rounded-none border-0">
                  <CommandInput placeholder="Search divisions…" value={divisionSearch} onValueChange={setDivisionSearch} className="h-9" />
                  <CommandList>
                    <CommandEmpty>No division found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => setDivisionFilter('all')}>
                        All divisions
                      </CommandItem>
                      {filteredDivisions.map((d) => (
                        <CommandItem key={d} value={String(d)} onSelect={() => setDivisionFilter(String(d))}>
                          {d}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
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
                <Command shouldFilter={false} className="rounded-none border-0">
                  <CommandInput placeholder="Search models…" value={modelSearch} onValueChange={setModelSearch} className="h-9" />
                  <CommandList>
                    <CommandEmpty>No model found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => setModelFilter('all')}>
                        All models
                      </CommandItem>
                      {filteredModels.map((m) => (
                        <CommandItem key={m} value={String(m)} onSelect={() => setModelFilter(String(m))}>
                          {m}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
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

function MarketDataTable({ rows, specialtyFilter, onSpecialtyFilterChange, onUpdateMarketRow, onAddMarketRow, onDeleteMarketRow }: MarketDataTableProps) {
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
                <Command shouldFilter={false} className="rounded-none border-0">
                  <CommandInput placeholder="Search specialties…" value={specialtySearch} onValueChange={setSpecialtySearch} className="h-9" />
                  <CommandList>
                    <CommandEmpty>No specialty found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => onSpecialtyFilterChange('all')}>
                        All specialties
                      </CommandItem>
                      {filteredSpecialties.map((s) => (
                        <CommandItem key={s} value={String(s)} onSelect={() => onSpecialtyFilterChange(String(s))}>
                          {s}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
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
