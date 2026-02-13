/**
 * Market positioning (imputed): compare effective $/wRVU by specialty to market 25/50/75/90.
 * Read-only view with your percentile and market CF targets.
 * Columns can be reordered via drag-and-drop on the header.
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, GripVertical, Columns3 } from 'lucide-react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import {
  computeImputedVsMarketBySpecialty,
  getImputedVsMarketProviderDetail,
  DEFAULT_IMPUTED_VS_MARKET_CONFIG,
  type ImputedVsMarketConfig,
  type ImputedVsMarketRow,
} from '@/lib/imputed-vs-market'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'

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

function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function formatPercentile(row: ImputedVsMarketRow): string {
  if (row.yourPercentileBelowRange) return `<25 (${row.yourPercentile.toFixed(1)})`
  if (row.yourPercentileAboveRange) return `>90 (${row.yourPercentile.toFixed(1)})`
  return row.yourPercentile.toFixed(1)
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
  yourPercentile: { label: 'Your percentile', align: 'right', minWidth: 100 },
  avgTCCPercentile: { label: 'Avg TCC %ile', align: 'right', minWidth: 96 },
  avgWRVUPercentile: { label: 'Avg wRVU %ile', align: 'right', minWidth: 96 },
  cf25: { label: 'CF 25th', align: 'right', minWidth: 72 },
  cf50: { label: 'CF 50th', align: 'right', minWidth: 72 },
  cf75: { label: 'CF 75th', align: 'right', minWidth: 72 },
  cf90: { label: 'CF 90th', align: 'right', minWidth: 72 },
}

const DEFAULT_COL_WIDTH = 120

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

  const rows = useMemo(
    () => computeImputedVsMarketBySpecialty(providerRows, marketRows, synonymMap, config),
    [providerRows, marketRows, synonymMap, config]
  )

  const [drawerSpecialty, setDrawerSpecialty] = useState<string | null>(null)

  const [columnOrder, setColumnOrder] = useState<MainTableColumnId[]>(() => [...MAIN_TABLE_COLUMN_IDS])
  const [columnWidths, setColumnWidths] = useState<Record<MainTableColumnId, number>>(() => ({
    ...AUTO_SIZE_COLUMN_WIDTHS,
  }))
  const [tableLayoutKey, setTableLayoutKey] = useState(0)
  const [draggedColumnId, setDraggedColumnId] = useState<MainTableColumnId | null>(null)
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

  const drawerProviders = useMemo(
    () =>
      drawerSpecialty
        ? getImputedVsMarketProviderDetail(
            drawerSpecialty,
            providerRows,
            marketRows,
            synonymMap,
            config
          )
        : [],
    [drawerSpecialty, providerRows, marketRows, synonymMap, config]
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

  const totalTableWidthPx = columnOrder.reduce((sum, id) => sum + getWidth(id), 0)

  const hasData = providerRows.length > 0 && marketRows.length > 0
  const hasResults = rows.length > 0

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" className="gap-2" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Market positioning (imputed)</CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              Compare your effective $/wRVU (total cash comp ÷ wRVUs, normalized to 1.0 cFTE) to market
              25th–90th by specialty. Your percentile shows where you stand vs market; market CF
              percentiles are reference targets. Click a row to open provider-level detail in a drawer.
              Drag column headers to reorder; drag the right edge to resize.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAutoSizeColumns()
              }}
            >
              <Columns3 className="size-4" aria-hidden />
              Auto-size columns
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasData && (
            <WarningBanner message="Upload provider and market data on the Upload screen first." />
          )}

          {hasData && (
            <>
              <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-medium">What to include in TCC for imputed $/wRVU</p>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeQualityPayments}
                      onChange={(e) => setIncludeQualityPayments(e.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    Quality payments (from provider file)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeWorkRVUIncentive}
                      onChange={(e) => setIncludeWorkRVUIncentive(e.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    Work RVU incentive
                  </label>
                </div>
              </div>

              {!hasResults && (
                <WarningBanner
                  message="No specialties had matching market data. Check that provider specialties match your market file, or set up synonym mapping on the Upload screen."
                />
              )}

              {hasResults && (
                <div
                  className="flex flex-col w-full rounded-md border overflow-hidden"
                  style={{ maxHeight: 'min(70vh, 600px)' }}
                >
                  <div className="flex-1 min-h-0 overflow-auto min-w-0">
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
                          {columnOrder.map((colId) => (
                            <col key={colId} style={{ width: `${getWidth(colId)}px`, minWidth: `${getWidth(colId)}px` }} />
                          ))}
                        </colgroup>
                        <thead className="sticky top-0 z-10 [&_tr]:border-b">
                          <tr className="border-b bg-muted/95">
                            {columnOrder.map((colId) => {
                              const col = MAIN_TABLE_COLUMNS[colId]
                              const isDragging = draggedColumnId === colId
                              const w = getWidth(colId)
                              const wPx = `${w}px`
                              return (
                                <th
                                  key={colId}
                                  className={`relative h-10 px-2 align-middle font-medium whitespace-nowrap bg-muted/95 text-foreground select-none ${col.align === 'right' ? 'text-right' : 'text-left'}`}
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
                        {rows.map((row) => (
                          <tr
                            key={row.specialty}
                            className="cursor-pointer hover:bg-muted/50 border-b transition-colors"
                            onClick={() => handleRowClick(row.specialty)}
                          >
                            {columnOrder.map((colId) => {
                              const col = MAIN_TABLE_COLUMNS[colId]
                              const value = getMainTableCellValue(colId, row)
                              const isSpecialty = colId === 'specialty'
                              const w = getWidth(colId)
                              const wPx = `${w}px`
                              return (
                                <td
                                  key={colId}
                                  className={`p-2 align-middle ${col.align === 'right' ? 'text-right' : ''} ${isSpecialty ? 'font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap' : 'whitespace-nowrap'}`}
                                  style={{ width: wPx, minWidth: wPx, maxWidth: wPx }}
                                  title={isSpecialty ? value : colId === 'currentCf' ? 'Median CF used to compute baseline TCC (work RVU incentive) for this specialty' : undefined}
                                >
                                  {value}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={drawerSpecialty != null} onOpenChange={(open) => !open && setDrawerSpecialty(null)}>
        <SheetContent side="right" className="flex flex-col w-full sm:max-w-xl overflow-hidden">
          <SheetHeader>
            <SheetTitle>{drawerSpecialty ?? 'Provider detail'}</SheetTitle>
            <SheetDescription>
              Provider-level imputed $/wRVU and baseline TCC for this specialty.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col flex-1 min-h-0 -mx-6 px-6 min-w-0">
            <p className="text-sm text-muted-foreground mb-3">
              TCC here = Clinical base + Quality payments (if enabled) + Work RVU incentive (if
              enabled). Same logic as the main table.
            </p>
            <div className="flex flex-col flex-1 min-h-0 overflow-x-auto min-w-0">
            {drawerSpecialty && drawerProviders.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-auto min-w-0">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 z-10 border-b bg-muted/95 shadow-sm [&_th]:bg-muted/95">
                      <TableHead>Provider</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead className="text-right">cFTE</TableHead>
                      <TableHead className="text-right">wRVU (1.0 cFTE)</TableHead>
                      <TableHead className="text-right">Clinical base</TableHead>
                      <TableHead className="text-right">Quality</TableHead>
                      <TableHead className="text-right">Work RVU incentive</TableHead>
                      <TableHead className="text-right">Total TCC</TableHead>
                      <TableHead className="text-right">Current CF</TableHead>
                      <TableHead className="text-right">Imputed $/wRVU</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drawerProviders.map((p) => (
                      <TableRow key={p.providerId}>
                        <TableCell className="font-medium">{p.providerName || p.providerId}</TableCell>
                        <TableCell className="text-muted-foreground">{p.division}</TableCell>
                        <TableCell className="text-right">{p.cFTE.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{p.wRVU_1p0.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.clinicalBase, 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.quality, 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.workRVUIncentive, 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.baselineTCC, 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.currentCFUsed)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.imputedDollarPerWRVU)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : drawerSpecialty ? (
              <p className="text-sm text-muted-foreground">No provider detail for this specialty.</p>
            ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
