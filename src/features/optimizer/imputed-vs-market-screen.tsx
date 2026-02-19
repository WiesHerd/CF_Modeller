/**
 * Market positioning (imputed): compare effective $/wRVU by specialty to market 25/50/75/90.
 * Read-only view with your percentile and market CF targets.
 * Columns can be reordered via drag-and-drop on the header.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Command, CommandInput } from '@/components/ui/command'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeft, ChevronLeft, ChevronRight, GripVertical, Columns3, BarChart2, LayoutList, ChevronDown, HelpCircle, Info, FileDown, FileSpreadsheet, Pin, Eraser, ListChecks, Minimize2 } from 'lucide-react'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import {
  computeImputedVsMarketBySpecialty,
  getImputedVsMarketProviderDetail,
  DEFAULT_IMPUTED_VS_MARKET_CONFIG,
  type ImputedVsMarketConfig,
  type ImputedVsMarketRow,
  type ImputedVsMarketProviderDetail,
} from '@/lib/imputed-vs-market'
import { MarketPositioningCalculationDrawer } from '@/features/optimizer/components/market-positioning-calculation-drawer'
import { formatCurrency } from '@/utils/format'
import { TCC_BUILTIN_COMPONENTS } from '@/lib/tcc-components'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'
import {
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
  getFmvRiskLevel,
  type GapInterpretation,
} from '@/features/optimizer/components/optimizer-constants'
import { downloadImputedVsMarketCSV, exportImputedVsMarketXLSX } from '@/lib/imputed-vs-market-export'
import { PINNED_HEADER_CLASS, PINNED_CELL_CLASS, PINNED_CELL_STRIPED_CLASS } from '@/lib/data-grid-styles'
import { Badge } from '@/components/ui/badge'

/** TCC components that can be included in imputed $/wRVU (subset of built-ins). */
const TCC_IMPUTED_OPTIONS = TCC_BUILTIN_COMPONENTS.filter(
  (c) => c.id === 'quality' || c.id === 'workRVUIncentive'
)

const MAIN_TABLE_COLUMN_IDS = [
  'specialty',
  'n',
  'imputed',
  'currentCf',
  'market25',
  'market50',
  'market75',
  'market90',
  'yourPercentile',
  'avgTCCPercentile',
  'avgWRVUPercentile',
  'alignment',
  'cf25',
  'cf50',
  'cf75',
  'cf90',
] as const
type MainTableColumnId = (typeof MAIN_TABLE_COLUMN_IDS)[number]

/** Tooltip for Market 50th: effective $/wRVU at the market's 50th percentile (from market file). */
const MARKET_50TH_TOOLTIP =
  "Effective $/wRVU at the market's 50th percentile: (Market TCC at 50th) ÷ (Market wRVU at 50th), from your market file."

/** Default: show only 50th percentile columns; user can show 25th/75th/90th via column selector. */
const DEFAULT_HIDDEN_COLUMN_IDS: MainTableColumnId[] = ['market25', 'market75', 'market90', 'cf25', 'cf75', 'cf90']
/** Default order: Market 50th next to CF 50th for easier comparison. */
const DEFAULT_COLUMN_ORDER: MainTableColumnId[] = [
  'specialty',
  'n',
  'imputed',
  'currentCf',
  'market50',
  'cf50',
  'yourPercentile',
  'avgTCCPercentile',
  'avgWRVUPercentile',
  'alignment',
  'market25',
  'market75',
  'market90',
  'cf25',
  'cf75',
  'cf90',
]

const IMPUTED_VS_MARKET_VIEW_KEY = 'cf-modeler-imputed-vs-market-view'
const COLUMN_IDS_SET = new Set<string>(MAIN_TABLE_COLUMN_IDS)

function loadImputedVsMarketViewState(): {
  columnOrder: MainTableColumnId[]
  hiddenColumnIds: Set<MainTableColumnId>
  pinnedLeftColumnIds: MainTableColumnId[]
  tccPercentileRange: [number, number]
  wrvuPercentileRange: [number, number]
  pageSize: number
} {
  const defaultRanges: { tccPercentileRange: [number, number]; wrvuPercentileRange: [number, number] } = {
    tccPercentileRange: [0, 100],
    wrvuPercentileRange: [0, 100],
  }
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return {
      columnOrder: [...DEFAULT_COLUMN_ORDER],
      hiddenColumnIds: new Set(DEFAULT_HIDDEN_COLUMN_IDS),
      pinnedLeftColumnIds: ['specialty'],
      ...defaultRanges,
      pageSize: 25,
    }
  }
  try {
    const raw = window.sessionStorage.getItem(IMPUTED_VS_MARKET_VIEW_KEY)
    if (!raw)
      return {
        columnOrder: [...DEFAULT_COLUMN_ORDER],
        hiddenColumnIds: new Set(DEFAULT_HIDDEN_COLUMN_IDS),
        pinnedLeftColumnIds: ['specialty'],
        ...defaultRanges,
        pageSize: 25,
      }
    const data = JSON.parse(raw) as Record<string, unknown>
    const columnOrder: MainTableColumnId[] = Array.isArray(data.columnOrder)
      ? (data.columnOrder as string[]).filter((id): id is MainTableColumnId => COLUMN_IDS_SET.has(id))
      : [...DEFAULT_COLUMN_ORDER]
    const hiddenColumnIds = new Set<MainTableColumnId>(
      Array.isArray(data.hiddenColumnIds)
        ? (data.hiddenColumnIds as string[]).filter((id): id is MainTableColumnId => COLUMN_IDS_SET.has(id))
        : []
    )
    const pinnedLeftColumnIds: MainTableColumnId[] = Array.isArray(data.pinnedLeftColumnIds)
      ? (data.pinnedLeftColumnIds as string[]).filter((id): id is MainTableColumnId => COLUMN_IDS_SET.has(id))
      : ['specialty']
    const tccPercentileRange: [number, number] =
      Array.isArray(data.tccPercentileRange) &&
      data.tccPercentileRange.length === 2 &&
      typeof data.tccPercentileRange[0] === 'number' &&
      typeof data.tccPercentileRange[1] === 'number'
        ? [Math.max(0, Math.min(100, data.tccPercentileRange[0])), Math.max(0, Math.min(100, data.tccPercentileRange[1]))]
        : [0, 100]
    const wrvuPercentileRange: [number, number] =
      Array.isArray(data.wrvuPercentileRange) &&
      data.wrvuPercentileRange.length === 2 &&
      typeof data.wrvuPercentileRange[0] === 'number' &&
      typeof data.wrvuPercentileRange[1] === 'number'
        ? [Math.max(0, Math.min(100, data.wrvuPercentileRange[0])), Math.max(0, Math.min(100, data.wrvuPercentileRange[1]))]
        : [0, 100]
    const pageSize =
      typeof data.pageSize === 'number' && [10, 25, 50, 100].includes(data.pageSize) ? data.pageSize : 25
    return {
      columnOrder: columnOrder.length ? columnOrder : [...DEFAULT_COLUMN_ORDER],
      hiddenColumnIds,
      pinnedLeftColumnIds: pinnedLeftColumnIds.length ? pinnedLeftColumnIds : ['specialty'],
      tccPercentileRange,
      wrvuPercentileRange,
      pageSize,
    }
  } catch {
    return {
      columnOrder: [...DEFAULT_COLUMN_ORDER],
      hiddenColumnIds: new Set(DEFAULT_HIDDEN_COLUMN_IDS),
      pinnedLeftColumnIds: ['specialty'],
      ...defaultRanges,
      pageSize: 25,
    }
  }
}

interface ImputedVsMarketScreenProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  synonymMap: Record<string, string>
  onBack: () => void
}

function formatPercentile(row: ImputedVsMarketRow): string {
  if (row.yourPercentileBelowRange) return `<25 (${row.yourPercentile.toFixed(1)})`
  if (row.yourPercentileAboveRange) return `>90 (${row.yourPercentile.toFixed(1)})`
  return row.yourPercentile.toFixed(1)
}

function formatProviderTccPercentile(p: ImputedVsMarketProviderDetail): string {
  if (p.tccPercentileBelowRange) return `<25`
  if (p.tccPercentileAboveRange) return `>90`
  return p.tccPercentile.toFixed(1)
}

function formatProviderWrvuPercentile(p: ImputedVsMarketProviderDetail): string {
  if (p.wrvuPercentileBelowRange) return `<25`
  if (p.wrvuPercentileAboveRange) return `>90`
  return p.wrvuPercentile.toFixed(1)
}

const MAIN_TABLE_COLUMNS: Record<
  MainTableColumnId,
  { label: string; align: 'left' | 'right'; minWidth?: number }
> = {
  /* minWidth must fit full header: pl-3 + grip + gap + label text + gap + pin + pr-8 (~92px chrome) */
  specialty: { label: 'Specialty', align: 'left', minWidth: 220 },
  n: { label: 'N', align: 'right', minWidth: 72 },
  imputed: { label: 'Imputed $/wRVU', align: 'right', minWidth: 200 },
  currentCf: { label: 'Current CF used', align: 'right', minWidth: 212 },
  market25: { label: 'Market 25th', align: 'right', minWidth: 180 },
  market50: { label: 'Market 50th', align: 'right', minWidth: 180 },
  market75: { label: 'Market 75th', align: 'right', minWidth: 180 },
  market90: { label: 'Market 90th', align: 'right', minWidth: 180 },
  yourPercentile: { label: 'Your $/wRVU %ile', align: 'right', minWidth: 228 },
  avgTCCPercentile: { label: 'Avg TCC %ile', align: 'right', minWidth: 188 },
  avgWRVUPercentile: { label: 'Avg wRVU %ile', align: 'right', minWidth: 196 },
  alignment: { label: 'Pay vs productivity', align: 'left', minWidth: 244 },
  cf25: { label: 'CF 25th', align: 'right', minWidth: 148 },
  cf50: { label: 'CF 50th', align: 'right', minWidth: 148 },
  cf75: { label: 'CF 75th', align: 'right', minWidth: 148 },
  cf90: { label: 'CF 90th', align: 'right', minWidth: 148 },
}

const ROW_HEIGHT_PX = 40
const TABLE_HEADER_HEIGHT_PX = 42
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/** TCC %ile − wRVU %ile: positive = pay above productivity, negative = underpaid. */
function getAlignmentForRow(row: ImputedVsMarketRow): GapInterpretation {
  const a = row.avgTCCPercentile
  const b = row.avgWRVUPercentile
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'aligned'
  const gap = a - b
  return getGapInterpretation(gap)
}

type AlignmentFilterValue = 'all' | GapInterpretation
const ALIGNMENT_FILTER_OPTIONS: { value: AlignmentFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'aligned', label: 'Aligned' },
  { value: 'overpaid', label: 'Pay above productivity' },
  { value: 'underpaid', label: 'Underpaid vs productivity' },
]

/** Comfortable default widths for "Auto-size columns" (matches minWidth so full header labels show). */
const AUTO_SIZE_COLUMN_WIDTHS: Record<MainTableColumnId, number> = {
  specialty: 320,
  n: 72,
  imputed: 200,
  currentCf: 212,
  market25: 180,
  market50: 180,
  market75: 180,
  market90: 180,
  yourPercentile: 228,
  avgTCCPercentile: 188,
  avgWRVUPercentile: 196,
  alignment: 244,
  cf25: 148,
  cf50: 148,
  cf75: 148,
  cf90: 148,
}

function getMainTableCellValue(colId: MainTableColumnId, row: ImputedVsMarketRow): string {
  switch (colId) {
    case 'specialty':
      return row.specialty
    case 'n':
      return String(row.providerCount)
    case 'imputed':
      return formatCurrency(row.medianImputedDollarPerWRVU)
    case 'currentCf':
      return formatCurrency(row.medianCurrentCFUsed)
    case 'market25':
      return formatCurrency(row.market25)
    case 'market50':
      return formatCurrency(row.market50)
    case 'market75':
      return formatCurrency(row.market75)
    case 'market90':
      return formatCurrency(row.market90)
    case 'yourPercentile':
      return formatPercentile(row)
    case 'avgTCCPercentile':
      return row.avgTCCPercentile.toFixed(1)
    case 'avgWRVUPercentile':
      return row.avgWRVUPercentile.toFixed(1)
    case 'alignment':
      return GAP_INTERPRETATION_LABEL[getAlignmentForRow(row)]
    case 'cf25':
      return formatCurrency(row.marketCF25)
    case 'cf50':
      return formatCurrency(row.marketCF50)
    case 'cf75':
      return formatCurrency(row.marketCF75)
    case 'cf90':
      return formatCurrency(row.marketCF90)
    default:
      return ''
  }
}

export function ImputedVsMarketScreen({
  providerRows,
  marketRows,
  synonymMap,
  onBack,
}: ImputedVsMarketScreenProps) {
  const [includeQualityPayments, setIncludeQualityPayments] = useState(
    DEFAULT_IMPUTED_VS_MARKET_CONFIG.includeQualityPayments
  )
  const [includeWorkRVUIncentive, setIncludeWorkRVUIncentive] = useState(
    DEFAULT_IMPUTED_VS_MARKET_CONFIG.includeWorkRVUIncentive
  )

  const config: ImputedVsMarketConfig = useMemo(
    () => ({
      ...DEFAULT_IMPUTED_VS_MARKET_CONFIG,
      includeQualityPayments,
      includeWorkRVUIncentive,
    }),
    [includeQualityPayments, includeWorkRVUIncentive]
  )

  const initialViewState = useMemo(() => loadImputedVsMarketViewState(), [])

  const [selectedProviderTypes, setSelectedProviderTypes] = useState<string[]>([])
  const [providerTypeSearch, setProviderTypeSearch] = useState('')
  const providerTypes = useMemo(() => {
    const set = new Set(providerRows.map((r) => (r.providerType ?? '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [providerRows])
  const filteredProviderTypes = useMemo(() => {
    if (!providerTypeSearch.trim()) return providerTypes
    const q = providerTypeSearch.toLowerCase()
    return providerTypes.filter((pt) => pt.toLowerCase().includes(q))
  }, [providerTypes, providerTypeSearch])

  const providersForCompute = useMemo(() => {
    if (selectedProviderTypes.length === 0) return providerRows
    const set = new Set(selectedProviderTypes)
    return providerRows.filter((p) => set.has((p.providerType ?? '').trim()))
  }, [providerRows, selectedProviderTypes])

  const rows = useMemo(
    () => computeImputedVsMarketBySpecialty(providersForCompute, marketRows, synonymMap, config),
    [providersForCompute, marketRows, synonymMap, config]
  )

  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [tccPercentileRange, setTccPercentileRange] = useState<[number, number]>(initialViewState.tccPercentileRange)
  const [wrvuPercentileRange, setWrvuPercentileRange] = useState<[number, number]>(initialViewState.wrvuPercentileRange)
  const [selectedAlignmentFilters, setSelectedAlignmentFilters] = useState<GapInterpretation[]>([])

  const availableSpecialties = useMemo(
    () => [...new Set(rows.map((r) => r.specialty))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [rows]
  )
  const filteredSpecialtiesForDropdown = useMemo(() => {
    if (!specialtySearch.trim()) return availableSpecialties
    const q = specialtySearch.trim().toLowerCase()
    return availableSpecialties.filter((s) => s.toLowerCase().includes(q))
  }, [availableSpecialties, specialtySearch])

  const filteredRows = useMemo(() => {
    let list = rows
    if (selectedSpecialties.length > 0) list = list.filter((r) => selectedSpecialties.includes(r.specialty))
    const [tccMin, tccMax] = tccPercentileRange
    if (tccMin > 0 || tccMax < 100) {
      list = list.filter((r) => {
        const p = r.avgTCCPercentile
        if (!Number.isFinite(p)) return false
        return p >= tccMin && p <= tccMax
      })
    }
    const [wrvuMin, wrvuMax] = wrvuPercentileRange
    if (wrvuMin > 0 || wrvuMax < 100) {
      list = list.filter((r) => {
        const p = r.avgWRVUPercentile
        if (!Number.isFinite(p)) return false
        return p >= wrvuMin && p <= wrvuMax
      })
    }
    if (selectedAlignmentFilters.length > 0) {
      const alignmentSet = new Set(selectedAlignmentFilters)
      list = list.filter((r) => alignmentSet.has(getAlignmentForRow(r)))
    }
    return list
  }, [rows, selectedSpecialties, tccPercentileRange, wrvuPercentileRange, selectedAlignmentFilters])

  const isFiltered =
    selectedSpecialties.length > 0 ||
    tccPercentileRange[0] > 0 ||
    tccPercentileRange[1] < 100 ||
    wrvuPercentileRange[0] > 0 ||
    wrvuPercentileRange[1] < 100 ||
    selectedAlignmentFilters.length > 0 ||
    selectedProviderTypes.length > 0

  const [drawerSpecialty, setDrawerSpecialty] = useState<string | null>(null)
  const [drawerSelectedProvider, setDrawerSelectedProvider] = useState<ImputedVsMarketProviderDetail | null>(null)

  const FIRST_DRAWER_WIDTH_MIN = 360
  const FIRST_DRAWER_WIDTH_MAX = 900
  const FIRST_DRAWER_WIDTH_DEFAULT = 576
  const [firstDrawerWidth, setFirstDrawerWidth] = useState(FIRST_DRAWER_WIDTH_DEFAULT)

  const handleFirstDrawerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = firstDrawerWidth
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setFirstDrawerWidth(
        Math.min(FIRST_DRAWER_WIDTH_MAX, Math.max(FIRST_DRAWER_WIDTH_MIN, startW + delta))
      )
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [firstDrawerWidth])

  const [columnOrder, setColumnOrder] = useState<MainTableColumnId[]>(initialViewState.columnOrder)
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<MainTableColumnId>>(initialViewState.hiddenColumnIds)
  const [pinnedLeftColumnIds, setPinnedLeftColumnIds] = useState<MainTableColumnId[]>(initialViewState.pinnedLeftColumnIds)
  const [columnWidths, setColumnWidths] = useState<Record<MainTableColumnId, number>>(() => ({
    ...AUTO_SIZE_COLUMN_WIDTHS,
  }))
  const [tableLayoutKey, setTableLayoutKey] = useState(0)
  const [draggedColumnId, setDraggedColumnId] = useState<MainTableColumnId | null>(null)
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null)
  const focusedCellRef = useRef<HTMLTableCellElement>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(initialViewState.pageSize)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(
          IMPUTED_VS_MARKET_VIEW_KEY,
          JSON.stringify({
            columnOrder,
            hiddenColumnIds: Array.from(hiddenColumnIds),
            pinnedLeftColumnIds,
            tccPercentileRange,
            wrvuPercentileRange,
            pageSize,
          })
        )
      }
    } catch {
      // ignore
    }
  }, [columnOrder, hiddenColumnIds, pinnedLeftColumnIds, tccPercentileRange, wrvuPercentileRange, pageSize])

  const visibleOrder = useMemo(
    () => columnOrder.filter((id) => !hiddenColumnIds.has(id)),
    [columnOrder, hiddenColumnIds]
  )
  const pinnedLeftSet = useMemo(() => new Set(pinnedLeftColumnIds), [pinnedLeftColumnIds])
  const toggleColumnPin = useCallback((colId: MainTableColumnId) => {
    setPinnedLeftColumnIds((prev) => {
      const set = new Set(prev)
      if (set.has(colId)) {
        set.delete(colId)
        return [...set]
      }
      return [...set, colId]
    })
  }, [])
  const toggleColumnVisibility = useCallback((colId: MainTableColumnId) => {
    setHiddenColumnIds((prev) => {
      const next = new Set(prev)
      if (next.has(colId)) {
        next.delete(colId)
      } else {
        const wouldBeVisible = columnOrder.filter((id) => id !== colId && !next.has(id)).length
        if (wouldBeVisible > 0) next.add(colId)
      }
      return next
    })
  }, [columnOrder])
  const columnDragStartedRef = useRef(false)
  const resizeRef = useRef<{
    colId: MainTableColumnId
    startX: number
    startWidth: number
  } | null>(null)

  const handleHeaderDragStart = useCallback((e: React.DragEvent, colId: MainTableColumnId) => {
    columnDragStartedRef.current = true
    setDraggedColumnId(colId)
    e.dataTransfer.setData('text/plain', colId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])
  const handleHeaderDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])
  const handleHeaderDrop = useCallback(
    (e: React.DragEvent, targetColId: MainTableColumnId) => {
      e.preventDefault()
      const sourceColId = e.dataTransfer.getData('text/plain') as MainTableColumnId
      setDraggedColumnId(null)
      if (!sourceColId || sourceColId === targetColId) return
      setColumnOrder((prev) => {
        const next = prev.filter((id) => id !== sourceColId)
        const targetIndex = next.indexOf(targetColId)
        next.splice(targetIndex, 0, sourceColId)
        return next
      })
    },
    []
  )
  const handleHeaderDragEnd = useCallback(() => {
    setDraggedColumnId(null)
    columnDragStartedRef.current = false
  }, [])

  const handleResizeStart = useCallback(
    (colId: MainTableColumnId, clientX: number, startWidth: number) => {
      const minW = MAIN_TABLE_COLUMNS[colId].minWidth ?? 48
      resizeRef.current = { colId, startX: clientX, startWidth }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      const onMove = (e: MouseEvent) => {
        if (!resizeRef.current) return
        const delta = e.clientX - resizeRef.current.startX
        const newWidth = Math.max(minW, resizeRef.current.startWidth + delta)
        setColumnWidths((prev) => ({ ...prev, [colId]: newWidth }))
      }
      const onUp = () => {
        resizeRef.current = null
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    []
  )

  const handleRowClick = useCallback(
    (specialty: string) => {
      if (columnDragStartedRef.current) {
        columnDragStartedRef.current = false
        return
      }
      setDrawerSpecialty(specialty)
    },
    []
  )

  const totalRowCount = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRowCount / pageSize))
  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1))
  const paginatedRows = useMemo(() => {
    const start = safePageIndex * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, safePageIndex, pageSize])

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, Math.max(0, totalPages - 1)))
  }, [totalPages])

  const rowCount = paginatedRows.length
  const colCount = visibleOrder.length
  const paginatedTableHeight = TABLE_HEADER_HEIGHT_PX + pageSize * ROW_HEIGHT_PX

  useEffect(() => {
    if (focusedCell == null) return
    const el = focusedCellRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.focus()
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
    })
  }, [focusedCell])

  useEffect(() => {
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
  }, [rowCount, colCount])

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (focusedCell != null) return
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        setFocusedCell({ rowIndex: 0, columnIndex: 0 })
        e.preventDefault()
      }
    },
    [focusedCell]
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
          if (filteredRows[rowIndex]) setDrawerSpecialty(filteredRows[rowIndex].specialty)
          break
        default:
          break
      }
    },
    [rowCount, colCount, filteredRows]
  )

  const drawerProviders = useMemo(
    () =>
      drawerSpecialty
        ? getImputedVsMarketProviderDetail(
            drawerSpecialty,
            providersForCompute,
            marketRows,
            synonymMap,
            config
          )
        : [],
    [drawerSpecialty, providersForCompute, marketRows, synonymMap, config]
  )

  const getWidth = useCallback(
    (colId: MainTableColumnId) => {
      const minW = MAIN_TABLE_COLUMNS[colId].minWidth ?? 48
      const w = columnWidths[colId] ?? minW
      return Math.max(minW, w)
    },
    [columnWidths]
  )

  const pinnedLeftOffsets = useMemo(() => {
    const offsets: Record<MainTableColumnId, number> = {} as Record<MainTableColumnId, number>
    let left = 0
    for (const colId of visibleOrder) {
      if (pinnedLeftSet.has(colId)) {
        offsets[colId] = left
        left += getWidth(colId)
      }
    }
    return offsets
  }, [visibleOrder, pinnedLeftSet, getWidth])

  const isLastPinnedLeft = useCallback(
    (colId: MainTableColumnId) => {
      if (!pinnedLeftSet.has(colId)) return false
      const idx = visibleOrder.indexOf(colId)
      for (let i = idx + 1; i < visibleOrder.length; i++) {
        if (pinnedLeftSet.has(visibleOrder[i])) return false
      }
      return true
    },
    [visibleOrder, pinnedLeftSet]
  )

  const handleAutoSizeColumns = useCallback(() => {
    setColumnWidths(() => {
      const next: Record<MainTableColumnId, number> = {} as Record<MainTableColumnId, number>
      for (const id of MAIN_TABLE_COLUMN_IDS) {
        next[id] = AUTO_SIZE_COLUMN_WIDTHS[id]
      }
      return next
    })
    setTableLayoutKey((k) => k + 1)
  }, [])

  const totalTableWidthPx = visibleOrder.reduce((sum, id) => sum + getWidth(id), 0)

  const hasData = providerRows.length > 0 && marketRows.length > 0
  const hasResults = rows.length > 0

  return (
    <div className="space-y-4">
      <div>
        <SectionTitleWithIcon icon={<BarChart2 className="size-5 text-muted-foreground" />}>
          Market positioning (imputed)
        </SectionTitleWithIcon>
        <div className="mt-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Answers: </span>
              Where does our effective $/wRVU stand by specialty vs market, and where are we paying above or below productivity?
            </p>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help inline-flex shrink-0" aria-label="About this table">
                    <Info className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[380px] text-xs font-normal space-y-2 text-background">
                  <p className="font-medium">About this table</p>
                  <p className="text-background/90">Compare your <strong>effective $/wRVU</strong> (total cash comp ÷ wRVUs, normalized to 1.0 cFTE) to market 25th–90th by specialty. <strong>Your $/wRVU %ile</strong> shows where you stand vs that market curve.</p>
                  <p className="text-background/90 font-medium">Market 25th / 50th / 75th / 90th:</p>
                  <p className="text-background/90">Effective $/wRVU <em>derived from your market file</em>: (Market TCC at that percentile) ÷ (Market wRVU at that percentile). So they form the curve your imputed $/wRVU is compared against to get &quot;Your $/wRVU %ile&quot;.</p>
                  <p className="text-background/90 font-medium">CF 25th / 50th / 75th / 90th:</p>
                  <p className="text-background/90">Conversion factor ($/wRVU) at those percentiles <em>as reported in the market survey</em> (direct from the market file). Use these as reference rates when setting or reviewing CF targets.</p>
                  <p className="text-background/90">Click a row to open provider-level detail. Use filters to find misalignments. Use the pin icon to pin columns to the left; drag headers to reorder; drag the right edge to resize.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground/80">
            Look at <span className="font-medium text-foreground">Your $/wRVU %ile</span> (vs market) and <span className="font-medium text-foreground">Pay vs productivity</span> (alignment).
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {filteredRows.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" aria-label="Export data">
                <FileDown className="size-4" />
                Export
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Export format</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => downloadImputedVsMarketCSV(filteredRows)} className="gap-2">
                <FileDown className="size-4" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportImputedVsMarketXLSX(filteredRows)} className="gap-2">
                <FileSpreadsheet className="size-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {!hasData && (
            <WarningBanner message="Upload provider and market data on the Upload screen first." />
          )}

          {hasData && (
            <>
              {hasData && (
                <>
                <div className="sticky top-0 z-20 rounded-lg border border-border/70 bg-background/95 p-3 backdrop-blur-sm">
                  {isFiltered && (
                    <div className="flex justify-end mb-2">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground text-xs"
                              onClick={() => {
                                setSelectedSpecialties([])
                                setTccPercentileRange([0, 100])
                                setWrvuPercentileRange([0, 100])
                                setSelectedAlignmentFilters([])
                                setSelectedProviderTypes([])
                              }}
                              aria-label="Clear filters"
                            >
                              <Eraser className="size-3.5" aria-hidden />
                              Clear filters
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Clear filters</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-3 w-full">
                    <div className="space-y-1.5 flex-1 min-w-[120px]">
                      <Label className="text-xs text-muted-foreground">Specialty</Label>
                      <DropdownMenu onOpenChange={(open) => !open && setSpecialtySearch('')}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between gap-1.5 h-9 bg-white dark:bg-background"
                          >
                            <span className="truncate text-left">
                              {selectedSpecialties.length === 0
                                ? 'All'
                                : `${selectedSpecialties.length} selected`}
                            </span>
                            <ChevronDown className="size-4 shrink-0 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="max-h-[320px] overflow-hidden p-0"
                          onCloseAutoFocus={(e: Event) => e.preventDefault()}
                        >
                          <Command shouldFilter={false} className="rounded-none border-0">
                            <CommandInput
                              placeholder="Search specialties…"
                              value={specialtySearch}
                              onValueChange={setSpecialtySearch}
                              className="h-9"
                            />
                          </Command>
                          <div className="max-h-[240px] overflow-y-auto p-1">
                            <DropdownMenuLabel>Specialty</DropdownMenuLabel>
                            {filteredSpecialtiesForDropdown.length === 0 ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                            ) : (
                              filteredSpecialtiesForDropdown.map((specialty) => (
                                <DropdownMenuCheckboxItem
                                  key={specialty}
                                  checked={selectedSpecialties.includes(specialty)}
                                  onCheckedChange={(checked) =>
                                    setSelectedSpecialties((prev) =>
                                      checked ? [...prev, specialty] : prev.filter((s) => s !== specialty)
                                    )
                                  }
                                >
                                  {specialty}
                                </DropdownMenuCheckboxItem>
                              ))
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex gap-3 flex-1 min-w-0 basis-full">
                      <div className="flex-1 min-w-0 rounded-lg border border-border/70 bg-white dark:bg-background p-3 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Avg TCC %ile</Label>
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                            {tccPercentileRange[0]} – {tccPercentileRange[1]}
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={tccPercentileRange}
                          onValueChange={(v) => setTccPercentileRange(v as [number, number])}
                          className="w-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0 rounded-lg border border-border/70 bg-white dark:bg-background p-3 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Avg wRVU %ile</Label>
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                            {wrvuPercentileRange[0]} – {wrvuPercentileRange[1]}
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={wrvuPercentileRange}
                          onValueChange={(v) => setWrvuPercentileRange(v as [number, number])}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-[140px]">
                      <Label className="text-xs text-muted-foreground">Pay vs productivity</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between gap-1.5 h-9 bg-white dark:bg-background"
                          >
                            <span className="truncate">
                              {selectedAlignmentFilters.length === 0
                                ? 'All'
                                : selectedAlignmentFilters.length === 1
                                  ? GAP_INTERPRETATION_LABEL[selectedAlignmentFilters[0]]
                                  : `${selectedAlignmentFilters.length} selected`}
                            </span>
                            <ChevronDown className="size-4 shrink-0 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Filter by alignment</DropdownMenuLabel>
                          {(ALIGNMENT_FILTER_OPTIONS.filter((o) => o.value !== 'all') as { value: GapInterpretation; label: string }[]).map((opt) => (
                            <DropdownMenuCheckboxItem
                              key={opt.value}
                              checked={selectedAlignmentFilters.includes(opt.value)}
                              onCheckedChange={(checked) =>
                                setSelectedAlignmentFilters((prev) =>
                                  checked ? [...prev, opt.value] : prev.filter((v) => v !== opt.value)
                                )
                              }
                            >
                              {opt.label}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-[120px]">
                      <Label className="text-xs text-muted-foreground">Provider type</Label>
                      <DropdownMenu onOpenChange={(open) => !open && setProviderTypeSearch('')}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between gap-1.5 h-9 bg-white dark:bg-background"
                          >
                            <span className="truncate">
                              {selectedProviderTypes.length === 0
                                ? 'All'
                                : selectedProviderTypes.length === 1
                                  ? selectedProviderTypes[0]
                                  : `${selectedProviderTypes.length} selected`}
                            </span>
                            <ChevronDown className="size-4 shrink-0 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden p-0"
                          onCloseAutoFocus={(e: Event) => e.preventDefault()}
                        >
                          <Command shouldFilter={false} className="rounded-none border-0">
                            <CommandInput
                              placeholder="Search provider types…"
                              value={providerTypeSearch}
                              onValueChange={setProviderTypeSearch}
                              className="h-9"
                            />
                          </Command>
                          <div className="max-h-[240px] overflow-y-auto p-1">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Provider type</DropdownMenuLabel>
                            <DropdownMenuCheckboxItem
                              checked={selectedProviderTypes.length === 0}
                              onCheckedChange={(checked) => checked && setSelectedProviderTypes([])}
                              onSelect={(e) => e.preventDefault()}
                              className="cursor-pointer"
                            >
                              All
                            </DropdownMenuCheckboxItem>
                            {filteredProviderTypes.length === 0 ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                            ) : (
                              filteredProviderTypes.map((pt) => (
                                <DropdownMenuCheckboxItem
                                  key={pt}
                                  checked={selectedProviderTypes.includes(pt)}
                                  onCheckedChange={(checked) =>
                                    setSelectedProviderTypes((prev) =>
                                      checked ? [...prev, pt] : prev.filter((v) => v !== pt)
                                    )
                                  }
                                  onSelect={(e) => e.preventDefault()}
                                  className="cursor-pointer"
                                >
                                  {pt}
                                </DropdownMenuCheckboxItem>
                              ))
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-[160px]">
                      <Label className="text-xs text-muted-foreground">Include in TCC</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between gap-1.5 h-9 bg-white dark:bg-background"
                          >
                            <span className="truncate text-left">
                              {TCC_IMPUTED_OPTIONS.filter(
                                (c) =>
                                  (c.id === 'quality' && includeQualityPayments) ||
                                  (c.id === 'workRVUIncentive' && includeWorkRVUIncentive)
                              )
                                .map((c) =>
                                  c.id === 'quality' ? 'Quality' : 'wRVU incentive'
                                )
                                .join(', ') || 'None'}
                            </span>
                            <ChevronDown className="size-4 shrink-0 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[260px]">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Include in TCC
                          </DropdownMenuLabel>
                          {TCC_IMPUTED_OPTIONS.map((opt) => {
                            const checked =
                              (opt.id === 'quality' && includeQualityPayments) ||
                              (opt.id === 'workRVUIncentive' && includeWorkRVUIncentive)
                            return (
                              <DropdownMenuCheckboxItem
                                key={opt.id}
                                checked={checked}
                                onCheckedChange={(v) => {
                                  if (opt.id === 'quality') setIncludeQualityPayments(!!v)
                                  else if (opt.id === 'workRVUIncentive') setIncludeWorkRVUIncentive(!!v)
                                }}
                              >
                                {opt.id === 'quality' ? 'Quality' : 'wRVU incentive'}
                              </DropdownMenuCheckboxItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                </>
              )}

              {!hasResults && (
                <WarningBanner
                  message="No specialties had matching market data. Check that provider specialties match your market file, or set up synonym mapping on the Upload screen."
                />
              )}

              {hasResults && (
                <>
                  {isFiltered && (
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredRows.length} of {rows.length} specialties.
                    </p>
                  )}
                  {filteredRows.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">
                      No specialties match your search or filters. Try changing the filters or search.
                    </p>
                  ) : (
                <>
                <div
                  className="flex flex-col w-full rounded-md border overflow-hidden"
                  style={{ maxHeight: `${paginatedTableHeight}px` }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
                    <p className="text-xs text-muted-foreground">
                      Row bar (pay vs productivity):{' '}
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Green</span> = {GAP_INTERPRETATION_LABEL.aligned} ·{' '}
                      <span className="font-medium text-red-600 dark:text-red-400">Red</span> = {GAP_INTERPRETATION_LABEL.overpaid} ·{' '}
                      <span className="font-medium text-blue-600 dark:text-blue-400">Blue</span> = {GAP_INTERPRETATION_LABEL.underpaid}
                    </p>
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
                        {visibleOrder.map((colId) => {
                          const isPinnedLeft = pinnedLeftSet.has(colId)
                          const label = MAIN_TABLE_COLUMNS[colId].label
                          return (
                            <DropdownMenuItem
                              key={colId}
                              onSelect={() => toggleColumnPin(colId)}
                              className="flex items-center gap-2"
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
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAutoSizeColumns()
                      }}
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
                      <DropdownMenuContent
                        align="end"
                        side="bottom"
                        collisionPadding={24}
                        className="max-h-[min(70vh,400px)] overflow-y-auto"
                      >
                        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => setHiddenColumnIds(new Set())}
                          className="font-medium gap-2"
                        >
                          <ListChecks className="size-4" />
                          Show all columns
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setHiddenColumnIds(new Set(DEFAULT_HIDDEN_COLUMN_IDS))
                            setColumnOrder([...DEFAULT_COLUMN_ORDER])
                          }}
                          className="gap-2"
                        >
                          <Minimize2 className="size-4" />
                          Minimal
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {MAIN_TABLE_COLUMN_IDS.map((colId) => {
                          const visible = !hiddenColumnIds.has(colId)
                          const isOnlyVisible =
                            visible && columnOrder.filter((id) => id !== colId && !hiddenColumnIds.has(id)).length === 0
                          return (
                            <DropdownMenuCheckboxItem
                              key={colId}
                              checked={visible}
                              disabled={isOnlyVisible}
                              onCheckedChange={() => toggleColumnVisibility(colId)}
                              onSelect={(e) => e.preventDefault()}
                            >
                              {MAIN_TABLE_COLUMNS[colId].label}
                            </DropdownMenuCheckboxItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                  <div
                    role="grid"
                    aria-label="Market positioning table"
                    aria-rowcount={rowCount}
                    aria-colcount={colCount}
                    tabIndex={0}
                    className="flex flex-1 flex-col min-h-0 min-w-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-b-md"
                    onKeyDown={handleTableKeyDown}
                  >
                  <div
                    className="flex-1 min-h-0 overflow-auto min-w-0 pb-2"
                    onKeyDownCapture={(e) => {
                      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && (e.target as HTMLElement).closest?.('td[role="gridcell"]')) {
                        e.preventDefault()
                      }
                    }}
                  >
                    <div
                      key={tableLayoutKey}
                      style={{ width: totalTableWidthPx, minWidth: totalTableWidthPx }}
                    >
                      <table
                        className="caption-bottom text-sm border-collapse w-full table-fixed"
                        style={{
                          width: `${totalTableWidthPx}px`,
                          minWidth: `${totalTableWidthPx}px`,
                        }}
                      >
                        <colgroup>
                          {visibleOrder.map((colId) => (
                            <col key={colId} style={{ width: `${getWidth(colId)}px`, minWidth: `${getWidth(colId)}px` }} />
                          ))}
                        </colgroup>
                        <thead className="sticky top-0 z-30 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                          <tr className="border-b border-border bg-muted">
                            {visibleOrder.map((colId) => {
                              const col = MAIN_TABLE_COLUMNS[colId]
                              const isDragging = draggedColumnId === colId
                              const w = getWidth(colId)
                              const wPx = `${w}px`
                              const isPinnedLeft = pinnedLeftSet.has(colId)
                              const leftOffset = pinnedLeftOffsets[colId]
                              const lastPinned = isLastPinnedLeft(colId)
                              const isSpecialtyCol = colId === 'specialty'
                              return (
                                <th
                                  key={colId}
                                  className={cn(
                                    'relative min-h-10 py-2.5 pl-3 pr-8 align-middle font-medium select-none group whitespace-nowrap',
                                    isSpecialtyCol && 'min-w-0 overflow-hidden',
                                    col.align === 'right' ? 'text-right' : 'text-left',
                                    isPinnedLeft && PINNED_HEADER_CLASS,
                                    !isPinnedLeft && 'bg-muted text-foreground',
                                    lastPinned && 'border-r border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                                  )}
                                  style={{
                                    width: wPx,
                                    minWidth: wPx,
                                    maxWidth: wPx,
                                    ...(isPinnedLeft && leftOffset !== undefined
                                      ? { position: 'sticky' as const, left: leftOffset, zIndex: 31 }
                                      : {}),
                                  }}
                                draggable
                                onDragStart={(e) => handleHeaderDragStart(e, colId)}
                                onDragOver={handleHeaderDragOver}
                                onDrop={(e) => handleHeaderDrop(e, colId)}
                                onDragEnd={handleHeaderDragEnd}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <GripVertical
                                    className="size-4 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground"
                                    aria-hidden
                                  />
                                  <span
                                    className={cn(
                                      'flex-1 min-w-0 overflow-hidden text-ellipsis',
                                      isDragging && 'opacity-50'
                                    )}
                                    title={colId === 'market50' ? MARKET_50TH_TOOLTIP : col.label}
                                  >
                                    {col.label}
                                  </span>
                                </div>
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize shrink-0 touch-none z-10"
                                  aria-hidden
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleResizeStart(colId, e.clientX, getWidth(colId))
                                  }}
                                />
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {paginatedRows.map((row, rowIndex) => {
                          const alignment = getAlignmentForRow(row)
                          const fmvRisk = getFmvRiskLevel(row.avgTCCPercentile, row.avgTCCPercentile)
                          return (
                          <tr
                            key={row.specialty}
                            role="row"
                            title="Click to view provider details"
                            className={cn(
                              rowIndex % 2 === 1 && 'bg-muted/30',
                              'cursor-pointer hover:bg-muted/50 border-b border-border transition-colors'
                            )}
                            onClick={() => handleRowClick(row.specialty)}
                          >
                            {visibleOrder.map((colId, colIndex) => {
                              const col = MAIN_TABLE_COLUMNS[colId]
                              const value = getMainTableCellValue(colId, row)
                              const isSpecialty = colId === 'specialty'
                              const isFirstCell = colIndex === 0
                              const w = getWidth(colId)
                              const wPx = `${w}px`
                              const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell?.columnIndex === colIndex
                              const isPinnedLeft = pinnedLeftSet.has(colId)
                              const leftOffset = pinnedLeftOffsets[colId]
                              const lastPinned = isLastPinnedLeft(colId)
                              const pinnedCellClass =
                                isPinnedLeft && (rowIndex % 2 === 1 ? PINNED_CELL_STRIPED_CLASS : PINNED_CELL_CLASS)
                              const alignmentBorder =
                                isFirstCell &&
                                (alignment === 'aligned'
                                  ? 'border-l-4 border-l-emerald-500/70'
                                  : alignment === 'overpaid'
                                    ? 'border-l-4 border-l-red-500/70'
                                    : alignment === 'underpaid'
                                      ? 'border-l-4 border-l-blue-500/70'
                                      : '')
                              return (
                                <td
                                  key={colId}
                                  ref={isFocused ? focusedCellRef : undefined}
                                  role="gridcell"
                                  tabIndex={isFocused ? 0 : -1}
                                  aria-rowindex={rowIndex + 1}
                                  aria-colindex={colIndex + 1}
                                  className={cn(
                                    'px-3 py-2.5 align-middle outline-none cursor-pointer',
                                    col.align === 'right' ? 'text-right' : 'text-left',
                                    isSpecialty && 'font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap',
                                    !isSpecialty && 'whitespace-nowrap',
                                    isFocused && 'bg-zinc-200 dark:bg-zinc-800',
                                    colId === 'avgTCCPercentile' && fmvRisk === 'elevated' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
                                    colId === 'avgTCCPercentile' && fmvRisk === 'high' && 'bg-destructive/15 text-destructive font-medium',
                                    isPinnedLeft && 'sticky isolate overflow-hidden',
                                    pinnedCellClass,
                                    alignmentBorder,
                                    lastPinned && 'border-r border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]'
                                  )}
                                  style={{
                                    width: wPx,
                                    minWidth: wPx,
                                    maxWidth: wPx,
                                    ...(isPinnedLeft && leftOffset !== undefined
                                      ? {
                                          position: 'sticky' as const,
                                          left: leftOffset,
                                          zIndex: isFirstCell && alignmentBorder ? 21 : 20,
                                        }
                                      : {}),
                                  }}
                                  title={isSpecialty ? value : colId === 'currentCf' ? 'Median CF used to compute baseline TCC (work RVU incentive) for this specialty' : colId === 'avgTCCPercentile' && fmvRisk !== 'low' ? `Avg TCC percentile ${fmvRisk}; may warrant FMV review` : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFocusedCell({ rowIndex, columnIndex: colIndex })
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    setDrawerSpecialty(row.specialty)
                                  }}
                                  onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                                >
                                  {colId === 'alignment' ? (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        alignment === 'aligned' && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                                        alignment === 'overpaid' && 'border-red-500/60 bg-red-500/15 text-red-800 dark:text-red-200',
                                        alignment === 'underpaid' && 'border-blue-500/60 bg-blue-500/15 text-blue-800 dark:text-blue-200'
                                      )}
                                    >
                                      {value}
                                    </Badge>
                                  ) : (
                                    value
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                          )
                        })}
                      </tbody>
                      </table>
                    </div>
                  </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-2 border border-t-0 rounded-b-md bg-muted/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        const n = Number(v)
                        if (PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) {
                          setPageSize(n)
                          setPageIndex(0)
                        }
                      }}
                    >
                      <SelectTrigger className="w-[72px] h-8">
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      {totalRowCount === 0
                        ? '0 rows'
                        : `${safePageIndex * pageSize + 1}–${Math.min((safePageIndex + 1) * pageSize, totalRowCount)} of ${totalRowCount}`}
                    </span>
                    <div className="flex gap-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePageIndex <= 0}
                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePageIndex >= totalPages - 1}
                        onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                        aria-label="Next page"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                </>
                  )}
              </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={drawerSpecialty != null} onOpenChange={(open) => !open && setDrawerSpecialty(null)}>
        <SheetContent
          side="right"
          className="flex flex-col w-full overflow-hidden sm:max-w-[none]"
          contentStyle={{ width: firstDrawerWidth, maxWidth: 'none' }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize drawer"
            className="absolute left-0 top-0 bottom-0 z-50 w-2 cursor-col-resize touch-none border-l border-transparent hover:border-primary/30 hover:bg-primary/10"
            onMouseDown={handleFirstDrawerResize}
          />
          <SheetHeader className="px-6 pt-6 pb-2 border-b border-border gap-2">
            <SheetTitle>{drawerSpecialty ?? 'Provider detail'}</SheetTitle>
            <SheetDescription>
              Provider-level imputed $/wRVU and baseline TCC for this specialty. Click a provider row to see how TCC and wRVU percentiles are calculated.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col flex-1 min-h-0 -mx-6 px-6 min-w-0">
            <p className="text-sm text-muted-foreground mb-3">
              TCC here = Clinical base + Quality payments (if enabled) + Work RVU incentive (if
              enabled). Same logic as the main table. Click a provider to open the calculation breakdown.
            </p>
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
            {drawerSpecialty && drawerProviders.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-auto min-w-0 overflow-x-auto border rounded-md">
                <table className="w-full caption-bottom text-sm border-collapse">
                  <TableHeader className="sticky top-0 z-[120] border-b border-border bg-muted shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)] [&_th]:bg-muted [&_th]:text-foreground [&_th]:whitespace-nowrap [&_th]:py-2.5 [&_th]:bg-muted">
                    <TableRow>
                      <TableHead className="sticky left-0 top-0 z-[110] isolate px-3 py-2.5 bg-muted border-r-2 border-border shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)] min-w-[140px] max-w-[140px] w-[140px]">Provider</TableHead>
                      <TableHead className="px-3 py-2.5">Division</TableHead>
                      <TableHead className="px-3 py-2.5">Type / Role</TableHead>
                      <TableHead className="text-right px-3 py-2.5">cFTE</TableHead>
                      <TableHead className="text-right px-3 py-2.5">wRVU (1.0 cFTE)</TableHead>
                      <TableHead className="text-right px-3 py-2.5 bg-primary/10 text-primary font-semibold">TCC %ile</TableHead>
                      <TableHead className="text-right px-3 py-2.5 bg-primary/10 text-primary font-semibold">wRVU %ile</TableHead>
                      <TableHead className="text-right px-3 py-2.5">Clinical base</TableHead>
                      <TableHead className="text-right px-3 py-2.5">Quality</TableHead>
                      <TableHead className="text-right px-3 py-2.5">Work RVU incentive</TableHead>
                      <TableHead className="text-right px-3 py-2.5 bg-primary/10 text-primary font-semibold">Total TCC</TableHead>
                      <TableHead className="text-right px-3 py-2.5">Current CF</TableHead>
                      <TableHead className="text-right px-3 py-2.5 bg-primary/10 text-primary font-semibold">Imputed $/wRVU</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drawerProviders.map((p, idx) => {
                      const gap = p.tccPercentile - p.wrvuPercentile
                      const alignment = getGapInterpretation(gap)
                      const percentileColor =
                        alignment === 'aligned'
                          ? 'value-positive font-medium'
                          : alignment === 'overpaid'
                            ? 'value-warning font-medium'
                            : 'text-blue-600 dark:text-blue-400 font-medium'
                      return (
                      <TableRow
                        key={p.providerId}
                        className={cn(
                          idx % 2 === 1 && 'bg-muted/30',
                          'cursor-pointer hover:bg-muted/50 transition-colors group'
                        )}
                        onClick={() => setDrawerSelectedProvider(p)}
                      >
                        <TableCell
                          className={cn(
                            'sticky left-0 z-[100] isolate font-medium px-3 py-2.5 border-r-2 border-border shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)] min-w-[140px] max-w-[140px] w-[140px] whitespace-nowrap overflow-hidden text-ellipsis',
                            idx % 2 === 1 ? 'bg-muted group-hover:bg-muted/80' : 'bg-background group-hover:bg-muted/50'
                          )}
                        >
                          {p.providerName || p.providerId}
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 py-2.5">{p.division}</TableCell>
                        <TableCell className="text-muted-foreground px-3 py-2.5">{p.providerType}</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">{p.cFTE.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">{p.wRVU_1p0.toFixed(0)}</TableCell>
                        <TableCell className={cn('text-right tabular-nums px-3 py-2.5', percentileColor)}>{formatProviderTccPercentile(p)}</TableCell>
                        <TableCell className={cn('text-right tabular-nums px-3 py-2.5', percentileColor)}>{formatProviderWrvuPercentile(p)}</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">{formatCurrency(p.clinicalBase, { decimals: 0 })}</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">{formatCurrency(p.quality, { decimals: 0 })}</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">{formatCurrency(p.workRVUIncentive, { decimals: 0 })}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-foreground px-3 py-2.5">{formatCurrency(p.baselineTCC, { decimals: 0 })}</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">{formatCurrency(p.currentCFUsed)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-primary px-3 py-2.5">{formatCurrency(p.imputedDollarPerWRVU)}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </table>
              </div>
            ) : drawerSpecialty ? (
              <p className="text-sm text-muted-foreground">No provider detail for this specialty.</p>
            ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MarketPositioningCalculationDrawer
        open={drawerSelectedProvider != null}
        onOpenChange={(open) => !open && setDrawerSelectedProvider(null)}
        onBack={() => setDrawerSelectedProvider(null)}
        provider={drawerSelectedProvider}
        specialtyLabel={drawerSpecialty ?? undefined}
      />
    </div>
  )
}
