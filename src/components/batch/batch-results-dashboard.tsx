import { useMemo, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, AlertCircle, MapPinOff, Gauge, Save, FolderOpen, Trash2, ChevronDown, Wallet, Coins, Target, BarChart2, Expand } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'
import { BatchResultsTable, type CalculationColumnId } from '@/components/batch/batch-results-table'
import { RowCalculationModal, type CalculationSection } from '@/components/batch/row-calculation-modal'
import { downloadBatchResultsCSV, exportBatchResultsXLSX } from '@/lib/batch-export'
import { formatCurrency, formatCurrencyCompact } from '@/utils/format'
import type { BatchResults, BatchRowResult, BatchRiskLevel, BatchScenarioSnapshot, MarketMatchStatus, SavedBatchRun } from '@/types/batch'
import type { MarketRow } from '@/types/market'
import {
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
  formatPercentile,
} from '@/features/optimizer/components/optimizer-constants'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatRunDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface BatchResultsDashboardProps {
  results: BatchResults
  marketRows?: MarketRow[]
  savedBatchRuns?: SavedBatchRun[]
  /** Run scope (specialties/providers) when this run was scoped; shown in summary. */
  scenarioSnapshot?: BatchScenarioSnapshot | null
  onSaveRun?: (name?: string) => void
  onLoadRun?: (id: string) => void
  onDeleteRun?: (id: string) => void
  onExportCSV?: () => void
  onExportXLSX?: () => void
  /** When set, header is one row: left content (Back + title) + icon-only Save/Saved runs on the right. */
  headerLeft?: React.ReactNode
}

const RISK_LEVELS: BatchRiskLevel[] = ['high', 'medium', 'low']
const MATCH_STATUSES: MarketMatchStatus[] = ['Exact', 'Normalized', 'Synonym', 'Missing']
const SHOW_TCC_SUMMARY_MAX_PROVIDERS = 15

function columnToSection(column: CalculationColumnId): CalculationSection {
  if (column === 'incentive') return 'incentive'
  if (column === 'wrvuPercentile') return 'wrvu'
  return 'tcc'
}

export function BatchResultsDashboard({
  results,
  marketRows = [],
  savedBatchRuns = [],
  scenarioSnapshot = null,
  onSaveRun,
  onLoadRun,
  onDeleteRun,
  onExportCSV,
  onExportXLSX,
  headerLeft,
}: BatchResultsDashboardProps) {
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [providerTypeFilter, setProviderTypeFilter] = useState<string>('all')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>('all')
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const [showMissingOnly, setShowMissingOnly] = useState(false)
  const [calculationRow, setCalculationRow] = useState<BatchRowResult | null>(null)
  const [calculationSection, setCalculationSection] = useState<CalculationSection | undefined>(undefined)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveRunName, setSaveRunName] = useState('')
  type ExpandedChartId = 'gap' | 'incentive' | 'tccWrvu' | 'flagged' | null
  const [expandedChartId, setExpandedChartId] = useState<ExpandedChartId>(null)
  const [showVisualsSection, setShowVisualsSection] = useState(false)
  const gapChartRef = useRef<HTMLDivElement>(null)

  const defaultSaveRunName = useMemo(
    () =>
      `${results.providerCount} providers × ${results.scenarioCount} scenario(s) – ${new Date(results.runAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
    [results.providerCount, results.scenarioCount, results.runAt]
  )

  const sortedSavedRuns = useMemo(
    () => [...savedBatchRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [savedBatchRuns]
  )

  const { rows } = results

  const calculationMarketRow = useMemo(() => {
    if (!calculationRow?.matchedMarketSpecialty || marketRows.length === 0) return null
    return (
      marketRows.find(
        (m) =>
          (m.specialty ?? '').toLowerCase() === (calculationRow.matchedMarketSpecialty ?? '').toLowerCase()
      ) ?? null
    )
  }, [calculationRow?.matchedMarketSpecialty, marketRows])

  const handleCalculationClick = (row: BatchRowResult, column: CalculationColumnId) => {
    setCalculationRow(row)
    setCalculationSection(columnToSection(column))
  }

  const specialties = useMemo(() => {
    const set = new Set(rows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort()
  }, [rows])
  const divisions = useMemo(() => {
    const set = new Set(rows.map((r) => r.division).filter(Boolean))
    return Array.from(set).sort()
  }, [rows])
  const providerTypes = useMemo(() => {
    const set = new Set(rows.map((r) => r.providerType).filter(Boolean))
    return Array.from(set).sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    let out = rows
    if (specialtyFilter !== 'all') out = out.filter((r) => r.specialty === specialtyFilter)
    if (divisionFilter !== 'all') out = out.filter((r) => r.division === divisionFilter)
    if (providerTypeFilter !== 'all') out = out.filter((r) => (r.providerType ?? '') === providerTypeFilter)
    if (riskFilter !== 'all') out = out.filter((r) => r.riskLevel === riskFilter)
    if (matchStatusFilter !== 'all') out = out.filter((r) => r.matchStatus === matchStatusFilter)
    if (showFlaggedOnly)
      out = out.filter(
        (r) =>
          r.riskLevel === 'high' ||
          r.warnings.length > 0 ||
          (r.results?.governanceFlags &&
            (r.results.governanceFlags.underpayRisk || r.results.governanceFlags.fmvCheckSuggested))
      )
    if (showMissingOnly) out = out.filter((r) => r.matchStatus === 'Missing')
    return out
  }, [
    rows,
    specialtyFilter,
    divisionFilter,
    providerTypeFilter,
    riskFilter,
    matchStatusFilter,
    showFlaggedOnly,
    showMissingOnly,
  ])

  const summary = useMemo(() => {
    const byRisk = { high: 0, medium: 0, low: 0 }
    let missingMarket = 0
    let gapSum = 0
    let gapCount = 0
    let incentiveTotal = 0
    let psqTotal = 0
    let tccPctSum = 0
    let tccPctCount = 0
    let wrvuPctSum = 0
    let wrvuPctCount = 0
    for (const r of rows) {
      byRisk[r.riskLevel]++
      if (r.matchStatus === 'Missing') missingMarket++
      if (r.results?.alignmentGapModeled != null && Number.isFinite(r.results.alignmentGapModeled)) {
        gapSum += r.results.alignmentGapModeled
        gapCount++
      }
      if (r.results?.annualIncentive != null && Number.isFinite(r.results.annualIncentive)) {
        incentiveTotal += r.results.annualIncentive
      }
      if (r.results?.psqDollars != null && Number.isFinite(r.results.psqDollars)) {
        psqTotal += r.results.psqDollars
      }
      if (r.results?.modeledTCCPercentile != null && Number.isFinite(r.results.modeledTCCPercentile)) {
        tccPctSum += r.results.modeledTCCPercentile
        tccPctCount++
      }
      if (r.results?.wrvuPercentile != null && Number.isFinite(r.results.wrvuPercentile)) {
        wrvuPctSum += r.results.wrvuPercentile
        wrvuPctCount++
      }
    }
    return {
      byRisk,
      missingMarket,
      avgGap: gapCount > 0 ? gapSum / gapCount : null,
      incentiveTotal,
      psqTotal,
      avgTccPercentile: tccPctCount > 0 ? tccPctSum / tccPctCount : null,
      avgWrvuPercentile: wrvuPctCount > 0 ? wrvuPctSum / wrvuPctCount : null,
    }
  }, [rows])

  const gapBySpecialty = useMemo(() => {
    const sumBySpec = new Map<string, number>()
    const countBySpec = new Map<string, number>()
    for (const r of rows) {
      const g = r.results?.alignmentGapModeled
      if (g == null || !Number.isFinite(g)) continue
      const spec = r.specialty?.trim() || '—'
      sumBySpec.set(spec, (sumBySpec.get(spec) ?? 0) + g)
      countBySpec.set(spec, (countBySpec.get(spec) ?? 0) + 1)
    }
    return Array.from(countBySpec.entries())
      .map(([specialty]) => {
        const n = countBySpec.get(specialty) ?? 0
        const avgGap = n > 0 ? (sumBySpec.get(specialty) ?? 0) / n : 0
        return { specialty, avgGap }
      })
      .filter((d) => Number.isFinite(d.avgGap))
      .sort((a, b) => b.avgGap - a.avgGap)
  }, [rows])

  const flaggedByDivision = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      if (r.riskLevel !== 'high' && r.warnings.length === 0) continue
      const div = r.division || '—'
      map.set(div, (map.get(div) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([division, count]) => ({ division, count }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const incentiveByDivision = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const inc = r.results?.annualIncentive
      if (inc == null || !Number.isFinite(inc)) continue
      const div = r.division || '—'
      map.set(div, (map.get(div) ?? 0) + inc)
    }
    return Array.from(map.entries())
      .map(([division, incentiveTotal]) => ({ division, incentiveTotal }))
      .sort((a, b) => b.incentiveTotal - a.incentiveTotal)
  }, [rows])

  const tccWrvuGapBySpecialty = useMemo(() => {
    const sumBySpec = new Map<string, number>()
    const countBySpec = new Map<string, number>()
    for (const r of rows) {
      const tcc = r.results?.modeledTCCPercentile
      const wrvu = r.results?.wrvuPercentile
      if (tcc == null || !Number.isFinite(tcc) || wrvu == null || !Number.isFinite(wrvu)) continue
      const gap = tcc - wrvu
      const spec = r.specialty?.trim() || '—'
      sumBySpec.set(spec, (sumBySpec.get(spec) ?? 0) + gap)
      countBySpec.set(spec, (countBySpec.get(spec) ?? 0) + 1)
    }
    return Array.from(countBySpec.entries())
      .map(([specialty]) => {
        const n = countBySpec.get(specialty) ?? 0
        const avgGap = n > 0 ? (sumBySpec.get(specialty) ?? 0) / n : 0
        return { specialty, avgGap }
      })
      .filter((d) => Number.isFinite(d.avgGap))
      .sort((a, b) => b.avgGap - a.avgGap)
  }, [rows])

  const uniqueProviderCount = useMemo(() => {
    const set = new Set(rows.map((r) => r.providerId).filter(Boolean))
    return set.size
  }, [rows])

  const showTccSummary = uniqueProviderCount > 0 && uniqueProviderCount <= SHOW_TCC_SUMMARY_MAX_PROVIDERS

  return (
    <div className="space-y-8">
      <div className={headerLeft ? 'flex flex-wrap items-center justify-between gap-2' : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end'}>
        {headerLeft ? (
          <div className="flex flex-wrap items-center gap-2">{headerLeft}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {onSaveRun && (
            headerLeft ? (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSaveRunName(defaultSaveRunName)
                        setSaveDialogOpen(true)
                      }}
                      aria-label="Save this run"
                    >
                      <Save className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Save this run</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSaveRunName(defaultSaveRunName)
                  setSaveDialogOpen(true)
                }}
                className="gap-2"
              >
                <Save className="size-4" />
                Save this run
              </Button>
            )
          )}
          {onLoadRun && onDeleteRun && (
            headerLeft ? (
              <TooltipProvider delayDuration={300}>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" aria-label="Saved runs">
                          <FolderOpen className="size-4" />
                          {savedBatchRuns.length > 0 ? (
                            <span className="ml-1 text-xs tabular-nums">({savedBatchRuns.length})</span>
                          ) : null}
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Saved runs</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-[320px]">
                      {sortedSavedRuns.length === 0 ? (
                        <DropdownMenuItem disabled className="text-muted-foreground">
                          No saved runs yet. Save this run to revisit later.
                        </DropdownMenuItem>
                      ) : (
                        <ScrollArea className="max-h-[280px]">
                          <div className="p-1">
                            {sortedSavedRuns.map((run) => (
                              <div
                                key={run.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                              >
                                <div className="min-w-0 flex-1 text-sm">
                                  <p className="font-medium truncate" title={run.name}>
                                    {run.name}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {formatRunDate(run.createdAt)}
                                    {run.mode != null && (
                                      <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                        {run.mode === 'detailed' ? 'Detailed' : 'Bulk'}
                                      </span>
                                    )}
                                  </p>
                                  {run.scenarioSnapshot?.scenarios?.length ? (
                                    <p className="text-muted-foreground text-[11px] mt-0.5" title={run.scenarioSnapshot.scenarios.map((s) => s.name).join(', ')}>
                                      Scenarios: {run.scenarioSnapshot.scenarios.map((s) => s.name).join(', ')}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => onLoadRun(run.id)}
                                    title="Load this run"
                                  >
                                    <FolderOpen className="size-4" />
                                    <span className="sr-only">Load</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (window.confirm(`Delete "${run.name}"? This cannot be undone.`)) {
                                        onDeleteRun(run.id)
                                      }
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="size-4" />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 font-normal">
                    <FolderOpen className="size-4" />
                    Saved runs{savedBatchRuns.length > 0 ? ` (${savedBatchRuns.length})` : ''}
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[320px]">
                  {sortedSavedRuns.length === 0 ? (
                    <DropdownMenuItem disabled className="text-muted-foreground">
                      No saved runs yet. Save this run to revisit later.
                    </DropdownMenuItem>
                  ) : (
                    <ScrollArea className="max-h-[280px]">
                      <div className="p-1">
                        {sortedSavedRuns.map((run) => (
                          <div
                            key={run.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                          >
                            <div className="min-w-0 flex-1 text-sm">
                              <p className="font-medium truncate" title={run.name}>
                                {run.name}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {formatRunDate(run.createdAt)}
                                {run.mode != null && (
                                  <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                    {run.mode === 'detailed' ? 'Detailed' : 'Bulk'}
                                  </span>
                                )}
                              </p>
                              {run.scenarioSnapshot?.scenarios?.length ? (
                                <p className="text-muted-foreground text-[11px] mt-0.5" title={run.scenarioSnapshot.scenarios.map((s) => s.name).join(', ')}>
                                  Scenarios: {run.scenarioSnapshot.scenarios.map((s) => s.name).join(', ')}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => onLoadRun(run.id)}
                                title="Load this run"
                              >
                                <FolderOpen className="size-4" />
                                <span className="sr-only">Load</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (window.confirm(`Delete "${run.name}"? This cannot be undone.`)) {
                                    onDeleteRun(run.id)
                                  }
                                }}
                                title="Delete"
                              >
                                <Trash2 className="size-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent aria-describedby="save-run-desc">
          <DialogHeader>
            <DialogTitle>Save this run</DialogTitle>
            <DialogDescription id="save-run-desc">
              Give this batch run a name so you can load it later from Saved runs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="save-run-name">Name</Label>
            <Input
              id="save-run-name"
              value={saveRunName}
              onChange={(e) => setSaveRunName(e.target.value)}
              placeholder={defaultSaveRunName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSaveRun?.(saveRunName.trim() || undefined)
                  setSaveDialogOpen(false)
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSaveRun?.(saveRunName.trim() || undefined)
                setSaveDialogOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-l-4 border-l-destructive/80 bg-destructive/5 dark:bg-destructive/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setRiskFilter('high')
              setMatchStatusFilter('all')
              setShowMissingOnly(false)
            }}
            aria-pressed={riskFilter === 'high'}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">High risk</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">{summary.byRisk.high}</p>
                <p className="text-[11px] text-muted-foreground">rows need review</p>
              </div>
              {riskFilter === 'high' && (
                <span className="text-xs text-destructive font-medium shrink-0">Filtered</span>
              )}
            </CardContent>
          </button>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-amber-500/70 bg-amber-500/5 dark:bg-amber-500/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setRiskFilter('medium')
              setMatchStatusFilter('all')
              setShowMissingOnly(false)
            }}
            aria-pressed={riskFilter === 'medium'}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Medium risk</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">{summary.byRisk.medium}</p>
                <p className="text-[11px] text-muted-foreground">watch list</p>
              </div>
              {riskFilter === 'medium' && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0">Filtered</span>
              )}
            </CardContent>
          </button>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-orange-500/70 bg-orange-500/5 dark:bg-orange-500/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setMatchStatusFilter('Missing')
              setRiskFilter('all')
              setShowMissingOnly(false)
            }}
            aria-pressed={matchStatusFilter === 'Missing'}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
                <MapPinOff className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Missing market</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">{summary.missingMarket}</p>
                <p className="text-[11px] text-muted-foreground">no benchmark match</p>
              </div>
              {matchStatusFilter === 'Missing' && (
                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium shrink-0">Filtered</span>
              )}
            </CardContent>
          </button>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-[var(--chart-1)] bg-[var(--chart-1)]/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setRiskFilter('all')
              setMatchStatusFilter('all')
              setShowMissingOnly(false)
              setShowVisualsSection(true)
              setTimeout(() => gapChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
            }}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--chart-1)]/15 text-[var(--chart-1)]">
                <Gauge className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Avg alignment gap</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {summary.avgGap != null ? summary.avgGap.toFixed(1) : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground">comp vs prod %</p>
              </div>
            </CardContent>
          </button>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-emerald-600/70 bg-emerald-500/5 dark:bg-emerald-500/10 transition-all hover:shadow-md p-0 gap-0">
          <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Wallet className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Incentive total</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {formatCurrency(summary.incentiveTotal, { decimals: 0 })}
              </p>
              <p className="text-[11px] text-muted-foreground">modeled annual incentive</p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-teal-600/70 bg-teal-500/5 dark:bg-teal-500/10 transition-all hover:shadow-md p-0 gap-0">
          <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <Coins className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">PSQ total</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {formatCurrency(summary.psqTotal, { decimals: 0 })}
              </p>
              <p className="text-[11px] text-muted-foreground">modeled PSQ dollars</p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-blue-600/70 bg-blue-500/5 dark:bg-blue-500/10 transition-all hover:shadow-md p-0 gap-0">
          <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Target className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Avg TCC percentile</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {summary.avgTccPercentile != null ? summary.avgTccPercentile.toFixed(1) : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">modeled TCC %tile</p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-violet-600/70 bg-violet-500/5 dark:bg-violet-500/10 transition-all hover:shadow-md p-0 gap-0">
          <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <BarChart2 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Avg wRVU percentile</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {summary.avgWrvuPercentile != null ? summary.avgWrvuPercentile.toFixed(1) : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">wRVU %tile vs market</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {(() => {
        const hasAnyChart =
          gapBySpecialty.length > 0 ||
          incentiveByDivision.length > 0 ||
          tccWrvuGapBySpecialty.length > 0 ||
          flaggedByDivision.length > 0
        const chartCount = [gapBySpecialty, incentiveByDivision, tccWrvuGapBySpecialty, flaggedByDivision].filter(
          (d) => d.length > 0
        ).length
        return (
          <div className="flex flex-wrap items-center gap-3">
            {hasAnyChart && (
              <Button
                variant={showVisualsSection ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowVisualsSection((v) => !v)}
                className="shrink-0"
              >
                <BarChart2 className="size-4 mr-2" aria-hidden />
                {showVisualsSection ? 'Hide visuals' : 'View visuals'}
                {!showVisualsSection && chartCount > 0 && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {chartCount} chart{chartCount !== 1 ? 's' : ''}
                  </span>
                )}
              </Button>
            )}
          </div>
        )
      })()}

      <Dialog open={expandedChartId != null} onOpenChange={(open) => !open && setExpandedChartId(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-sm">
              {expandedChartId === 'gap' && 'Comp-vs-prod gap (modeled)'}
              {expandedChartId === 'incentive' && 'Incentive distribution (modeled)'}
              {expandedChartId === 'tccWrvu' && 'TCC %tile vs wRVU %tile by specialty'}
              {expandedChartId === 'flagged' && 'Flagged by division'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-[60vh] w-full">
            {expandedChartId === 'gap' && gapBySpecialty.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(400, Math.min(600, gapBySpecialty.length * 36))}>
                <BarChart data={gapBySpecialty} layout="vertical" margin={{ top: 8, right: 8, left: 50, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}`} />
                  <YAxis type="category" dataKey="specialty" width={120} tick={{ fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(value: number | undefined) => [value != null ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)} pts` : '—', 'Comp-vs-prod gap']} labelFormatter={(l) => `Specialty: ${l}`} />
                  <Bar dataKey="avgGap" radius={[0, 4, 4, 0]} name="Comp-vs-prod gap">
                    {gapBySpecialty.map((e) => (
                      <Cell key={e.specialty} fill={e.avgGap < 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {expandedChartId === 'incentive' && incentiveByDivision.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(400, Math.min(600, incentiveByDivision.length * 36))}>
                <BarChart data={incentiveByDivision} layout="vertical" margin={{ top: 8, right: 8, left: 50, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} />
                  <YAxis type="category" dataKey="division" width={120} tick={{ fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(value: number | undefined) => [value != null ? formatCurrency(value, { decimals: 0 }) : '—', 'Incentive total']} labelFormatter={(l) => `Division: ${l}`} />
                  <Bar dataKey="incentiveTotal" radius={[0, 4, 4, 0]}>
                    {incentiveByDivision.map((e) => (
                      <Cell key={e.division} fill={e.incentiveTotal < 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {expandedChartId === 'tccWrvu' && tccWrvuGapBySpecialty.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(400, Math.min(600, tccWrvuGapBySpecialty.length * 36))}>
                <BarChart data={tccWrvuGapBySpecialty} layout="vertical" margin={{ top: 8, right: 8, left: 50, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}`} />
                  <YAxis type="category" dataKey="specialty" width={120} tick={{ fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(value: number | undefined) => [value != null ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)} pts` : '—', 'Gap (TCC %tile − wRVU %tile)']} labelFormatter={(l) => `Specialty: ${l}`} />
                  <Bar dataKey="avgGap" radius={[0, 4, 4, 0]} name="Gap (TCC %tile − wRVU %tile)">
                    {tccWrvuGapBySpecialty.map((e) => (
                      <Cell key={e.specialty} fill={e.avgGap < 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {expandedChartId === 'flagged' && flaggedByDivision.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(400, Math.min(600, flaggedByDivision.length * 36))}>
                <BarChart data={flaggedByDivision} layout="vertical" margin={{ top: 8, right: 8, left: 50, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="division" width={120} tick={{ fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setExpandedChartId(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showVisualsSection && (
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3" ref={gapChartRef}>
        {gapBySpecialty.length > 0 && (
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() => setExpandedChartId('gap')}
            onKeyDown={(e) => e.key === 'Enter' && setExpandedChartId('gap')}
            aria-label="Expand Comp-vs-prod gap chart"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm">Comp-vs-prod gap (modeled)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {gapBySpecialty.length} specialty{gapBySpecialty.length !== 1 ? 'ies' : ''} · scroll to see all
                </p>
              </div>
              <Expand className="size-4 text-muted-foreground shrink-0" aria-hidden />
            </CardHeader>
            <CardContent>
              <div className="max-h-[min(60vh,480px)] overflow-y-auto overflow-x-hidden rounded-md border border-border/40 bg-muted/20">
                <ResponsiveContainer width="100%" height={Math.max(220, gapBySpecialty.length * 36)} minHeight={220}>
                  <BarChart data={gapBySpecialty} layout="vertical" margin={{ top: 8, right: 8, left: 40, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}`} />
                    <YAxis type="category" dataKey="specialty" width={80} tick={{ fontSize: 11 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(value: number | undefined) => [value != null ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)} pts` : '—', 'Comp-vs-prod gap']} labelFormatter={(l) => `Specialty: ${l}`} />
                    <Bar dataKey="avgGap" radius={[0, 4, 4, 0]} name="Comp-vs-prod gap">
                      {gapBySpecialty.map((e) => (
                        <Cell key={e.specialty} fill={e.avgGap < 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        {incentiveByDivision.length > 0 && (
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() => setExpandedChartId('incentive')}
            onKeyDown={(e) => e.key === 'Enter' && setExpandedChartId('incentive')}
            aria-label="Expand Incentive distribution chart"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm">Incentive distribution (modeled)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {incentiveByDivision.length} division{incentiveByDivision.length !== 1 ? 's' : ''} · scroll to see all
                </p>
              </div>
              <Expand className="size-4 text-muted-foreground shrink-0" aria-hidden />
            </CardHeader>
            <CardContent>
              <div className="max-h-[min(60vh,480px)] overflow-y-auto overflow-x-hidden rounded-md border border-border/40 bg-muted/20">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, incentiveByDivision.length * 36)}
                  minHeight={220}
                >
                  <BarChart
                    data={incentiveByDivision}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 40, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="division"
                      width={80}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number | undefined) => [value != null ? formatCurrency(value, { decimals: 0 }) : '—', 'Incentive total']}
                      labelFormatter={(label) => `Division: ${label}`}
                    />
                    <Bar dataKey="incentiveTotal" radius={[0, 4, 4, 0]} name="Incentive total">
                      {incentiveByDivision.map((entry) => (
                        <Cell
                          key={entry.division}
                          fill={entry.incentiveTotal < 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        {tccWrvuGapBySpecialty.length > 0 && (
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() => setExpandedChartId('tccWrvu')}
            onKeyDown={(e) => e.key === 'Enter' && setExpandedChartId('tccWrvu')}
            aria-label="Expand TCC vs wRVU percentile gap by specialty chart"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm">TCC %tile vs wRVU %tile by specialty</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {tccWrvuGapBySpecialty.length} specialty{tccWrvuGapBySpecialty.length !== 1 ? 'ies' : ''} · scroll to see all
                </p>
              </div>
              <Expand className="size-4 text-muted-foreground shrink-0" aria-hidden />
            </CardHeader>
            <CardContent>
              <div className="max-h-[min(60vh,480px)] overflow-y-auto overflow-x-hidden rounded-md border border-border/40 bg-muted/20">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, tccWrvuGapBySpecialty.length * 36)}
                  minHeight={220}
                >
                  <BarChart
                    data={tccWrvuGapBySpecialty}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 40, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="specialty"
                      width={80}
                      tick={{ fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number | undefined) => [value != null ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)} pts` : '—', 'Gap (TCC %tile − wRVU %tile)']}
                      labelFormatter={(label) => `Specialty: ${label}`}
                    />
                    <Bar dataKey="avgGap" radius={[0, 4, 4, 0]} name="Gap (TCC %tile − wRVU %tile)">
                      {tccWrvuGapBySpecialty.map((e) => (
                        <Cell key={e.specialty} fill={e.avgGap < 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        {flaggedByDivision.length > 0 && (
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() => setExpandedChartId('flagged')}
            onKeyDown={(e) => e.key === 'Enter' && setExpandedChartId('flagged')}
            aria-label="Expand Flagged by division chart"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm">Flagged by division</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {flaggedByDivision.length} division{flaggedByDivision.length !== 1 ? 's' : ''} · scroll to see all
                </p>
              </div>
              <Expand className="size-4 text-muted-foreground shrink-0" aria-hidden />
            </CardHeader>
            <CardContent>
              <div className="max-h-[min(60vh,480px)] overflow-y-auto overflow-x-hidden rounded-md border border-border/40 bg-muted/20">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, flaggedByDivision.length * 36)}
                  minHeight={220}
                >
                  <BarChart
                    data={flaggedByDivision}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 40, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="division"
                      width={80}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      <div className="rounded-lg border border-border/70 bg-background/95 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[140px] max-w-[200px]">
            <Label className="text-xs text-muted-foreground">Specialty</Label>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-full bg-white dark:bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {specialties.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[120px] max-w-[180px]">
            <Label className="text-xs text-muted-foreground">Division</Label>
            <Select value={divisionFilter} onValueChange={setDivisionFilter}>
              <SelectTrigger className="w-full bg-white dark:bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {divisions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[120px] max-w-[180px]">
            <Label className="text-xs text-muted-foreground">Type / Role</Label>
            <Select value={providerTypeFilter} onValueChange={setProviderTypeFilter}>
              <SelectTrigger className="w-full bg-white dark:bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {providerTypes.map((pt) => (
                  <SelectItem key={pt ?? ''} value={pt ?? ''}>
                    {pt ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-[100px] shrink-0">
            <Label className="text-xs text-muted-foreground">Risk</Label>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full bg-white dark:bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {RISK_LEVELS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-[110px] shrink-0">
            <Label className="text-xs text-muted-foreground">Match</Label>
            <Select value={matchStatusFilter} onValueChange={setMatchStatusFilter}>
              <SelectTrigger className="w-full bg-white dark:bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MATCH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 shrink-0 border-l border-border pl-4">
            <Label className="text-xs text-muted-foreground">Quick filters</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showFlaggedOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFlaggedOnly((v) => !v)}
              >
                Flagged only
              </Button>
              <Button
                variant={showMissingOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowMissingOnly((v) => !v)}
              >
                Missing market
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showTccSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total cash summary</CardTitle>
            <p className="text-sm text-muted-foreground">
              Compare providers: TCC and wRVU percentiles and pay vs productivity (modeled). Shown when run has {SHOW_TCC_SUMMARY_MAX_PROVIDERS} or fewer providers.
            </p>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-auto rounded-md border border-border">
              <Table className="w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 z-10 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                  <TableRow>
                    <TableHead className="min-w-[120px] px-3 py-2.5">Provider</TableHead>
                    <TableHead className="min-w-[100px] px-3 py-2.5">Specialty</TableHead>
                    <TableHead className="min-w-[90px] px-3 py-2.5">Model name</TableHead>
                    <TableHead className="text-right min-w-[80px] px-3 py-2.5">Current TCC</TableHead>
                    <TableHead className="text-right min-w-[80px] px-3 py-2.5">Modeled TCC</TableHead>
                    <TableHead className="text-right min-w-[70px] px-3 py-2.5">TCC %ile</TableHead>
                    <TableHead className="text-right min-w-[70px] px-3 py-2.5">wRVU %ile</TableHead>
                    <TableHead className="min-w-[120px] px-3 py-2.5">Pay vs productivity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const res = row.results
                    const gap = res?.alignmentGapModeled
                    const gapInterpretation =
                      gap != null && Number.isFinite(gap) ? getGapInterpretation(gap) : null
                    const gapColor =
                      gapInterpretation === 'overpaid'
                        ? 'text-red-600 dark:text-red-400'
                        : gapInterpretation === 'underpaid'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                    return (
                      <TableRow key={`${row.providerId}-${row.scenarioId}-${index}`} className={index % 2 === 1 ? 'bg-muted/30' : undefined}>
                        <TableCell className="px-3 py-2.5 font-medium">{row.providerName || row.providerId || '—'}</TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">{row.specialty || '—'}</TableCell>
                        <TableCell className="px-3 py-2.5">{row.scenarioName || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {res?.currentTCC != null && Number.isFinite(res.currentTCC)
                            ? formatCurrency(res.currentTCC, { decimals: 0 })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {res?.modeledTCC != null && Number.isFinite(res.modeledTCC)
                            ? formatCurrency(res.modeledTCC, { decimals: 0 })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {res?.modeledTCCPercentile != null && Number.isFinite(res.modeledTCCPercentile)
                            ? formatPercentile(res.modeledTCCPercentile)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {res?.wrvuPercentile != null && Number.isFinite(res.wrvuPercentile)
                            ? formatPercentile(res.wrvuPercentile)
                            : '—'}
                        </TableCell>
                        <TableCell className={`px-3 py-2.5 ${gapColor}`}>
                          {gapInterpretation != null ? GAP_INTERPRETATION_LABEL[gapInterpretation] : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Results table ({filteredRows.length} rows)</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV ?? (() => downloadBatchResultsCSV(results))}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportXLSX ?? (() => exportBatchResultsXLSX(results))}
            >
              Export XLSX
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BatchResultsTable
            rows={filteredRows}
            maxHeight="60vh"
            onCalculationClick={handleCalculationClick}
          />
        </CardContent>
      </Card>

      <RowCalculationModal
        open={calculationRow !== null}
        onOpenChange={(open) => !open && setCalculationRow(null)}
        row={calculationRow}
        marketRow={calculationMarketRow}
        scrollToSection={calculationSection}
      />
    </div>
  )
}
