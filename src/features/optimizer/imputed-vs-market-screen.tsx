/**
 * Market positioning (imputed): compare effective $/wRVU by specialty to market 25/50/75/90.
 * Read-only view with your percentile and market CF targets.
 * Columns can be reordered via drag-and-drop on the header.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { Command, CommandInput } from '@/components/ui/command'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeft, GripVertical, Columns3, BarChart2, LayoutList, ChevronDown, HelpCircle, FileDown, FileSpreadsheet } from 'lucide-react'
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
  specialty: { label: 'Specialty', align: 'left', minWidth: 220 },
  n: { label: 'N', align: 'right', minWidth: 48 },
  imputed: { label: 'Imputed $/wRVU', align: 'right', minWidth: 100 },
  currentCf: { label: 'Current CF used', align: 'right', minWidth: 96 },
  market25: { label: 'Market 25th', align: 'right', minWidth: 88 },
  market50: { label: 'Market 50th', align: 'right', minWidth: 88 },
  market75: { label: 'Market 75th', align: 'right', minWidth: 88 },
  market90: { label: 'Market 90th', align: 'right', minWidth: 88 },
  yourPercentile: { label: 'Your $/wRVU %ile', align: 'right', minWidth: 100 },
  avgTCCPercentile: { label: 'Avg TCC %ile', align: 'right', minWidth: 96 },
  avgWRVUPercentile: { label: 'Avg wRVU %ile', align: 'right', minWidth: 96 },
  alignment: { label: 'Pay vs productivity', align: 'left', minWidth: 140 },
  cf25: { label: 'CF 25th', align: 'right', minWidth: 72 },
  cf50: { label: 'CF 50th', align: 'right', minWidth: 72 },
  cf75: { label: 'CF 75th', align: 'right', minWidth: 72 },
  cf90: { label: 'CF 90th', align: 'right', minWidth: 72 },
}

const DEFAULT_COL_WIDTH = 120

const MIN_PROVIDERS_OPTIONS = [
  { value: 0, label: 'All' },
  { value: 2, label: 'At least 2' },
  { value: 5, label: 'At least 5' },
  { value: 10, label: 'At least 10' },
] as const

type PercentileFilterValue = 'all' | 'below25' | '25-50' | '50-75' | '75-90' | 'above90'
const PERCENTILE_FILTER_OPTIONS: { value: PercentileFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'below25', label: 'Below 25th' },
  { value: '25-50', label: '25th–50th' },
  { value: '50-75', label: '50th–75th' },
  { value: '75-90', label: '75th–90th' },
  { value: 'above90', label: 'Above 90th' },
]

function getPercentileBucket(row: ImputedVsMarketRow): PercentileFilterValue {
  if (row.yourPercentileBelowRange) return 'below25'
  if (row.yourPercentileAboveRange) return 'above90'
  const p = row.yourPercentile
  if (p < 25) return 'below25'
  if (p < 50) return '25-50'
  if (p < 75) return '50-75'
  if (p <= 90) return '75-90'
  return 'above90'
}

/** TCC %ile − wRVU %ile: positive = pay above productivity, negative = underpaid. */
function getAlignmentForRow(row: ImputedVsMarketRow): GapInterpretation {
  const gap = row.avgTCCPercentile - row.avgWRVUPercentile
  return getGapInterpretation(gap)
}

type AlignmentFilterValue = 'all' | GapInterpretation
const ALIGNMENT_FILTER_OPTIONS: { value: AlignmentFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'aligned', label: 'Aligned' },
  { value: 'overpaid', label: 'Pay above productivity' },
  { value: 'underpaid', label: 'Underpaid vs productivity' },
]

/** Comfortable default widths for "Auto-size columns" (wider than minWidth to avoid squished headers). */
const AUTO_SIZE_COLUMN_WIDTHS: Record<MainTableColumnId, number> = {
  specialty: 320,
  n: 56,
  imputed: 120,
  currentCf: 120,
  market25: 100,
  market50: 100,
  market75: 100,
  market90: 100,
  yourPercentile: 110,
  avgTCCPercentile: 100,
  avgWRVUPercentile: 100,
  alignment: 160,
  cf25: 88,
  cf50: 88,
  cf75: 88,
  cf90: 88,
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

  const [providerTypeFilter, setProviderTypeFilter] = useState<string>('all')
  const providerTypes = useMemo(() => {
    const set = new Set(providerRows.map((r) => (r.providerType ?? '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [providerRows])

  const providersForCompute = useMemo(() => {
    if (providerTypeFilter === 'all') return providerRows
    return providerRows.filter((p) => (p.providerType ?? '').trim() === providerTypeFilter)
  }, [providerRows, providerTypeFilter])

  const rows = useMemo(
    () => computeImputedVsMarketBySpecialty(providersForCompute, marketRows, synonymMap, config),
    [providersForCompute, marketRows, synonymMap, config]
  )

  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [minProviders, setMinProviders] = useState(0)
  const [percentileFilter, setPercentileFilter] = useState<PercentileFilterValue>('all')
  const [alignmentFilter, setAlignmentFilter] = useState<AlignmentFilterValue>('all')

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
    if (minProviders > 0) list = list.filter((r) => r.providerCount >= minProviders)
    if (percentileFilter !== 'all') list = list.filter((r) => getPercentileBucket(r) === percentileFilter)
    if (alignmentFilter !== 'all') list = list.filter((r) => getAlignmentForRow(r) === alignmentFilter)
    return list
  }, [rows, selectedSpecialties, minProviders, percentileFilter, alignmentFilter])

  const isFiltered =
    selectedSpecialties.length > 0 ||
    minProviders > 0 ||
    percentileFilter !== 'all' ||
    alignmentFilter !== 'all' ||
    providerTypeFilter !== 'all'

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
      setFirstDrawerWidth((w) =>
        Math.min(FIRST_DRAWER_WIDTH_MAX, Math.max(FIRST_DRAWER_WIDTH_MIN, w + delta))
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

  const [columnOrder, setColumnOrder] = useState<MainTableColumnId[]>(() => [...MAIN_TABLE_COLUMN_IDS])
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<MainTableColumnId>>(() => new Set())
  const [columnWidths, setColumnWidths] = useState<Record<MainTableColumnId, number>>(() => ({
    ...AUTO_SIZE_COLUMN_WIDTHS,
  }))
  const [tableLayoutKey, setTableLayoutKey] = useState(0)
  const [draggedColumnId, setDraggedColumnId] = useState<MainTableColumnId | null>(null)
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null)
  const focusedCellRef = useRef<HTMLTableCellElement>(null)

  const visibleOrder = useMemo(
    () => columnOrder.filter((id) => !hiddenColumnIds.has(id)),
    [columnOrder, hiddenColumnIds]
  )
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

  const rowCount = filteredRows.length
  const colCount = visibleOrder.length
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
    (colId: MainTableColumnId) => columnWidths[colId] ?? MAIN_TABLE_COLUMNS[colId].minWidth ?? DEFAULT_COL_WIDTH,
    [columnWidths]
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
      <SectionTitleWithIcon icon={<BarChart2 className="size-5 text-muted-foreground" />}>
        Market positioning (imputed)
      </SectionTitleWithIcon>
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
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              Compare your effective $/wRVU (total cash comp ÷ wRVUs, normalized to 1.0 cFTE) to market
              25th–90th by specialty. Your $/wRVU %ile shows where you stand vs market; market CF
              percentiles are reference targets. Click a row to open provider-level detail in a drawer.
              Drag column headers to reorder; drag the right edge to resize. Use the icons above the table to auto-size or show/hide columns.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasData && (
            <WarningBanner message="Upload provider and market data on the Upload screen first." />
          )}

          {hasData && (
            <>
              {hasData && (
                <>
                <div className="sticky top-0 z-20 rounded-lg border border-border/70 bg-background/95 p-4 backdrop-blur-sm">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
                      <div className="space-y-1.5 min-w-[140px] flex-1 max-w-[200px]">
                        <Label className="text-xs text-muted-foreground">Specialty</Label>
                        <DropdownMenu onOpenChange={(open) => !open && setSpecialtySearch('')}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-between gap-2 bg-white dark:bg-background"
                            >
                              <span className="truncate">
                                {selectedSpecialties.length === 0
                                  ? 'All specialties'
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
                    <div className="space-y-1.5 w-[130px] shrink-0">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Your $/wRVU %ile</Label>
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground cursor-help inline-flex" aria-label="What is Your $/wRVU %ile?">
                                <HelpCircle className="size-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] text-xs">
                              Percentile of your <strong>effective $/wRVU</strong> (total cash comp ÷ wRVUs, normalized to 1.0 cFTE) compared to market $/wRVU (25th–90th). Use this filter to show only specialties in a given range (e.g. &quot;Below 25th&quot; or &quot;Above 90th&quot;).
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select value={percentileFilter} onValueChange={(v) => setPercentileFilter(v as PercentileFilterValue)}>
                        <SelectTrigger className="w-full bg-white dark:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERCENTILE_FILTER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 w-[180px] shrink-0">
                      <Label className="text-xs text-muted-foreground">Pay vs productivity</Label>
                      <Select value={alignmentFilter} onValueChange={(v) => setAlignmentFilter(v as AlignmentFilterValue)}>
                        <SelectTrigger className="w-full bg-white dark:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALIGNMENT_FILTER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 w-[110px] shrink-0">
                      <Label className="text-xs text-muted-foreground">Min providers</Label>
                      <Select
                        value={minProviders === 0 ? 'all' : String(minProviders)}
                        onValueChange={(v) => setMinProviders(v === 'all' ? 0 : Number(v))}
                      >
                        <SelectTrigger className="w-full bg-white dark:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MIN_PROVIDERS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value === 0 ? 'all' : String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 w-[140px] shrink-0">
                      <Label className="text-xs text-muted-foreground">Provider type</Label>
                      <Select value={providerTypeFilter} onValueChange={setProviderTypeFilter}>
                        <SelectTrigger className="w-full bg-white dark:bg-background">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {providerTypes.map((pt) => (
                            <SelectItem key={pt} value={pt}>
                              {pt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    </div>
                    <div className="space-y-1.5 min-w-[280px] shrink-0 border-l border-border pl-4">
                      <Label className="text-xs text-muted-foreground">Include in TCC</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-w-[280px] w-full justify-between gap-2 bg-white dark:bg-background"
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
                <div
                  className="flex flex-col w-full rounded-md border overflow-hidden"
                  style={{ maxHeight: 'min(70vh, 600px)' }}
                >
                  <div className="flex justify-end gap-0.5 px-2 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
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
                      <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
                        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
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
                            >
                              {MAIN_TABLE_COLUMNS[colId].label}
                            </DropdownMenuCheckboxItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                    className="flex-1 min-h-0 overflow-auto min-w-0"
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
                        <thead className="sticky top-0 z-10 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                          <tr className="border-b border-border bg-muted">
                            {visibleOrder.map((colId) => {
                              const col = MAIN_TABLE_COLUMNS[colId]
                              const isDragging = draggedColumnId === colId
                              const w = getWidth(colId)
                              const wPx = `${w}px`
                              return (
                                <th
                                  key={colId}
                                  className={`relative min-h-10 px-3 py-2.5 align-middle font-medium whitespace-normal break-words bg-muted text-foreground select-none ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                  style={{ width: wPx, minWidth: wPx, maxWidth: wPx }}
                                draggable
                                onDragStart={(e) => handleHeaderDragStart(e, colId)}
                                onDragOver={handleHeaderDragOver}
                                onDrop={(e) => handleHeaderDrop(e, colId)}
                                onDragEnd={handleHeaderDragEnd}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <GripVertical
                                    className="size-4 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground"
                                    aria-hidden
                                  />
                                  <span className={isDragging ? 'opacity-50' : ''}>{col.label}</span>
                                  {colId === 'yourPercentile' && (
                                    <TooltipProvider delayDuration={300}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-muted-foreground cursor-help inline-flex shrink-0" aria-label="What is Your $/wRVU %ile?">
                                            <HelpCircle className="size-3.5" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[280px] text-xs">
                                          Your <strong>effective $/wRVU</strong> percentile vs market (total cash comp ÷ wRVUs, normalized to 1.0 cFTE). Not your CF percentile—market CF targets are in the CF 25th–90th columns.
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {colId === 'alignment' && (
                                    <TooltipProvider delayDuration={300}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-muted-foreground cursor-help inline-flex shrink-0" aria-label="What is Pay vs productivity?">
                                            <HelpCircle className="size-3.5" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[260px] text-xs">
                                          Compares <strong>Avg TCC %ile</strong> to <strong>Avg wRVU %ile</strong>. Aligned = within 3 points; Pay above productivity = TCC %ile &gt; wRVU %ile; Underpaid = TCC %ile &lt; wRVU %ile. Use the filter to show only misalignments.
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </span>
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize shrink-0 touch-none"
                                  aria-hidden
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleResizeStart(colId, e.clientX, columnWidths[colId])
                                  }}
                                />
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {filteredRows.map((row, rowIndex) => {
                          const alignment = getAlignmentForRow(row)
                          const fmvRisk = getFmvRiskLevel(row.avgTCCPercentile, row.avgTCCPercentile)
                          return (
                          <tr
                            key={row.specialty}
                            role="row"
                            title="Click to view provider details"
                            className={cn(
                              rowIndex % 2 === 1 && 'bg-muted/30',
                              'cursor-pointer hover:bg-muted/50 border-b border-border transition-colors',
                              alignment === 'aligned' && 'border-l-4 border-l-emerald-500/70',
                              alignment === 'overpaid' && 'border-l-4 border-l-red-500/70',
                              alignment === 'underpaid' && 'border-l-4 border-l-blue-500/70'
                            )}
                            onClick={() => handleRowClick(row.specialty)}
                          >
                            {visibleOrder.map((colId, colIndex) => {
                              const col = MAIN_TABLE_COLUMNS[colId]
                              const value = getMainTableCellValue(colId, row)
                              const isSpecialty = colId === 'specialty'
                              const w = getWidth(colId)
                              const wPx = `${w}px`
                              const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell?.columnIndex === colIndex
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
                                    isFocused && 'ring-2 ring-primary ring-inset bg-primary/5',
                                    colId === 'avgTCCPercentile' && fmvRisk === 'elevated' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
                                    colId === 'avgTCCPercentile' && fmvRisk === 'high' && 'bg-destructive/15 text-destructive font-medium'
                                  )}
                                  style={{ width: wPx, minWidth: wPx, maxWidth: wPx }}
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
          <SheetHeader>
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
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : alignment === 'overpaid'
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
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
