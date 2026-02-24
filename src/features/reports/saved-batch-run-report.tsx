import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Eraser, FileDown, FileSpreadsheet, Info, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { TccWrvuSummaryTable } from './tcc-wrvu-summary-table'
import { downloadBatchResultsCSV, exportBatchResultsXLSX } from '@/lib/batch-export'
import {
  getFmvRiskLevel,
  getGapInterpretation,
  FMV_RISK_LABEL,
  type FmvRiskLevel,
} from '@/features/optimizer/components/optimizer-constants'
import { FileText } from 'lucide-react'
import type { BatchResults, BatchRowResult, SavedBatchRun } from '@/types/batch'
import { formatDateTime as formatRunDate } from '@/utils/format'

/** Build a short, readable label for a saved run (mode + provider count + date) so users know what each run is. */
function getRunOptionLabel(r: SavedBatchRun): string {
  const n = r.results?.rows?.length ?? 0
  const modeLabel = r.mode === 'detailed' ? 'Detailed' : r.mode === 'bulk' ? 'Bulk' : 'Run'
  const providerLabel = n === 1 ? '1 provider' : `${n} providers`
  const dateStr = formatRunDate(r.createdAt)
  return `${r.name} — ${modeLabel}, ${providerLabel} — ${dateStr}`
}

export interface SavedBatchRunReportProps {
  savedBatchRuns: SavedBatchRun[]
  selectedRunId: string | null
  onSelectRunId: (id: string | null) => void
  onBack: () => void
  /** Navigate to Manage scenarios & runs (list/delete saved runs). */
  onManageRuns?: () => void
}

export function SavedBatchRunReport({
  savedBatchRuns,
  selectedRunId,
  onSelectRunId,
  onBack,
  onManageRuns,
}: SavedBatchRunReportProps) {
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [providerSearch, setProviderSearch] = useState<string>('')
  const [payVsProdFilter, setPayVsProdFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [providerTypeFilter, setProviderTypeFilter] = useState<string>('all')
  const [compPlanFilter, setCompPlanFilter] = useState<string>('all')
  const [fmvRiskFilter, setFmvRiskFilter] = useState<string>('all')
  const [tccPercentileRange, setTccPercentileRange] = useState<[number, number]>([0, 100])
  const [wrvuPercentileRange, setWrvuPercentileRange] = useState<[number, number]>([0, 100])
  const [filtersOpen, setFiltersOpen] = useState<boolean>(true)

  if (savedBatchRuns.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Saved batch run report
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="font-medium text-foreground">
              You don&apos;t save batch runs on this screen. This screen is only for <strong>viewing and exporting</strong> runs after they&apos;re saved.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium text-foreground text-sm">Where to save a batch run:</p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>In the sidebar, open <strong>Batch</strong>.</li>
                <li>Click <strong>Scenario Studio</strong> in Batch.</li>
                <li>Configure and <strong>run</strong> the scenario.</li>
                <li>On the <strong>results</strong> screen that appears, click <strong>Save this run</strong> (or the save icon), name the run, and save.</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-1">Saved runs then appear here and under Manage scenarios &amp; runs → Batch runs.</p>
            </div>
            {onManageRuns && (
              <p className="text-sm text-muted-foreground">
                To load or delete saved runs:{' '}
                <button
                  type="button"
                  onClick={onManageRuns}
                  className="font-medium text-primary hover:underline"
                >
                  Manage scenarios &amp; runs
                </button>
                {' '}→ Batch runs tab.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const effectiveRunId = selectedRunId ?? savedBatchRuns[0]?.id ?? null
  const effectiveRun = effectiveRunId ? savedBatchRuns.find((r) => r.id === effectiveRunId) ?? null : null

  if (!effectiveRunId || !effectiveRun) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Saved batch run report
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select a saved run.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const run = effectiveRun
  const results = run.results

  const specialtyOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => r.specialty?.trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => (a ?? '').localeCompare(b ?? ''))
  }, [results?.rows])

  const divisionOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => r.division?.trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => (a ?? '').localeCompare(b ?? ''))
  }, [results?.rows])

  const providerTypeOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => r.providerType?.trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => (a ?? '').localeCompare(b ?? ''))
  }, [results?.rows])

  const compPlanOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => r.productivityModel?.trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => (a ?? '').localeCompare(b ?? ''))
  }, [results?.rows])

  const filteredRows = useMemo((): BatchRowResult[] => {
    if (!results?.rows?.length) return []
    let out = results.rows
    if (specialtyFilter !== 'all') {
      out = out.filter((r) => (r.specialty?.trim() ?? '') === specialtyFilter)
    }
    if (divisionFilter !== 'all') {
      out = out.filter((r) => (r.division?.trim() ?? '') === divisionFilter)
    }
    if (providerTypeFilter !== 'all') {
      out = out.filter((r) => (r.providerType?.trim() ?? '') === providerTypeFilter)
    }
    if (compPlanFilter !== 'all') {
      out = out.filter((r) => (r.productivityModel?.trim() ?? '') === compPlanFilter)
    }
    if (providerSearch.trim()) {
      const q = providerSearch.trim().toLowerCase()
      out = out.filter(
        (r) =>
          (r.providerName ?? '').toLowerCase().includes(q) ||
          (r.providerId ?? '').toString().toLowerCase().includes(q) ||
          (r.specialty ?? '').toLowerCase().includes(q) ||
          (r.division ?? '').toLowerCase().includes(q) ||
          (r.providerType ?? '').toLowerCase().includes(q) ||
          (r.productivityModel ?? '').toLowerCase().includes(q)
      )
    }
    if (payVsProdFilter !== 'all') {
      out = out.filter((r) => {
        const gap = r.results?.alignmentGapModeled
        if (gap == null || !Number.isFinite(gap)) return false
        return getGapInterpretation(gap) === payVsProdFilter
      })
    }
    if (fmvRiskFilter !== 'all') {
      out = out.filter((r) => {
        const level = getFmvRiskLevel(r.results?.tccPercentile, r.results?.modeledTCCPercentile)
        return level === fmvRiskFilter
      })
    }
    const [tccMin, tccMax] = tccPercentileRange
    if (tccMin > 0 || tccMax < 100) {
      out = out.filter((r) => {
        const p = r.results?.modeledTCCPercentile
        if (p == null || !Number.isFinite(p)) return false
        return p >= tccMin && p <= tccMax
      })
    }
    const [wrvuMin, wrvuMax] = wrvuPercentileRange
    if (wrvuMin > 0 || wrvuMax < 100) {
      out = out.filter((r) => {
        const p = r.results?.wrvuPercentile
        if (p == null || !Number.isFinite(p)) return false
        return p >= wrvuMin && p <= wrvuMax
      })
    }
    return out
  }, [
    results?.rows,
    specialtyFilter,
    divisionFilter,
    providerTypeFilter,
    compPlanFilter,
    providerSearch,
    payVsProdFilter,
    fmvRiskFilter,
    tccPercentileRange,
    wrvuPercentileRange,
  ])

  const exportResults: BatchResults | null = results
    ? { ...results, rows: filteredRows }
    : null

  const hasActiveFilters =
    specialtyFilter !== 'all' ||
    divisionFilter !== 'all' ||
    providerTypeFilter !== 'all' ||
    compPlanFilter !== 'all' ||
    fmvRiskFilter !== 'all' ||
    providerSearch.trim() !== '' ||
    payVsProdFilter !== 'all' ||
    tccPercentileRange[0] > 0 ||
    tccPercentileRange[1] < 100 ||
    wrvuPercentileRange[0] > 0 ||
    wrvuPercentileRange[1] < 100

  const clearFilters = () => {
    setSpecialtyFilter('all')
    setDivisionFilter('all')
    setProviderTypeFilter('all')
    setCompPlanFilter('all')
    setFmvRiskFilter('all')
    setProviderSearch('')
    setPayVsProdFilter('all')
    setTccPercentileRange([0, 100])
    setWrvuPercentileRange([0, 100])
  }

  return (
    <div className="space-y-6 report-print">
      {/* Row 1: Title (left) | Saved run dropdown (right) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Saved batch run report
        </SectionTitleWithIcon>
        <Select value={effectiveRunId} onValueChange={(v) => onSelectRunId(v)}>
          <SelectTrigger className="w-[280px] h-9 bg-white dark:bg-background no-print shrink-0" aria-label={`Saved run (${savedBatchRuns.length})`}>
            <SelectValue placeholder="Select a run" />
          </SelectTrigger>
          <SelectContent>
            {[...savedBatchRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {getRunOptionLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Back (left) | Export (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2 h-9 w-fit" aria-label="Back">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {exportResults && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9" aria-label="Export data">
                <FileDown className="size-4" />
                Export
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Export</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => downloadBatchResultsCSV(exportResults)} className="gap-2">
                <FileDown className="size-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportBatchResultsXLSX(exportResults)} className="gap-2">
                <FileSpreadsheet className="size-4" />
                Export XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Single Card: Total cash and wRVU percentiles — collapsible Filters inside, then table */}
      {results && (
        <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-2">
              <p className="text-sm font-semibold text-foreground">Total cash and wRVU percentiles</p>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                      <Info className="size-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    Run: {run.name}. {results.rows.length} row(s). FMV risk: total cash at or above 75th percentile may warrant review.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-1 leading-relaxed">
              <strong>FMV risk:</strong> Total cash comp at or above the 75th percentile may warrant Fair Market Value review. Use the FMV risk column (Low / Elevated / High) to flag providers for attention.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {results.rows.length > 0 && (
              <div className="sticky top-0 z-20 rounded-lg border border-border/70 bg-background/95 backdrop-blur-sm no-print">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                  aria-expanded={filtersOpen}
                >
                  <span>Filters</span>
                  {filtersOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                </button>
                {filtersOpen && (
                  <div className="border-t border-border/70 p-3 space-y-4">
                    {/* 4-column grid: each cell min-w-0 so columns share width evenly; inputs w-full min-w-0 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Search</Label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="Provider, specialty, division, role,…"
                            value={providerSearch}
                            onChange={(e) => setProviderSearch(e.target.value)}
                            className="h-9 pl-8 w-full min-w-0 bg-white dark:bg-background"
                            aria-label="Search provider, specialty, division, role"
                          />
                        </div>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Specialty</Label>
                        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                          <SelectTrigger className="h-9 w-full min-w-0 bg-white dark:bg-background" aria-label="Filter by specialty">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {specialtyOptions.map((s) => (
                              <SelectItem key={s ?? ''} value={s ?? ''}>
                                {s ?? '—'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Pay vs productivity</Label>
                        <Select value={payVsProdFilter} onValueChange={setPayVsProdFilter}>
                          <SelectTrigger className="h-9 w-full min-w-0 bg-white dark:bg-background" aria-label="Filter by pay vs productivity">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="aligned">Aligned</SelectItem>
                            <SelectItem value="overpaid">Above market productivity</SelectItem>
                            <SelectItem value="underpaid">Below market productivity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Division</Label>
                        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                          <SelectTrigger className="h-9 w-full min-w-0 bg-white dark:bg-background" aria-label="Filter by division">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {divisionOptions.map((d) => (
                              <SelectItem key={d ?? ''} value={d ?? ''}>
                                {d ?? '—'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Role / type</Label>
                        <Select value={providerTypeFilter} onValueChange={setProviderTypeFilter}>
                          <SelectTrigger className="h-9 w-full min-w-0 bg-white dark:bg-background" aria-label="Filter by role or type">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {providerTypeOptions.map((t) => (
                              <SelectItem key={t ?? ''} value={t ?? ''}>
                                {t ?? '—'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Comp plan type</Label>
                        <Select value={compPlanFilter} onValueChange={setCompPlanFilter}>
                          <SelectTrigger className="h-9 w-full min-w-0 bg-white dark:bg-background" aria-label="Filter by comp plan type">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {compPlanOptions.map((c) => (
                              <SelectItem key={c ?? ''} value={c ?? ''}>
                                {c ?? '—'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">FMV risk</Label>
                        <Select value={fmvRiskFilter} onValueChange={setFmvRiskFilter}>
                          <SelectTrigger className="h-9 w-full min-w-0 bg-white dark:bg-background" aria-label="Filter by FMV risk">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {(Object.keys(FMV_RISK_LABEL) as FmvRiskLevel[]).map((level) => (
                              <SelectItem key={level} value={level}>
                                {FMV_RISK_LABEL[level]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {hasActiveFilters ? (
                        <div className="min-w-0 flex items-end pb-0.5">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button type="button" variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground gap-1.5" onClick={clearFilters} aria-label="Clear filters">
                                  <Eraser className="size-4" />
                                  Clear filters
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">Clear all filters</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      ) : (
                        <div className="min-w-0" aria-hidden />
                      )}
                    </div>
                    {/* Sliders: equal width, no max — fill half each */}
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0 rounded-lg border border-border/70 bg-white dark:bg-background p-3 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <Label className="text-xs text-muted-foreground">TCC %ile (modeled)</Label>
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
                          <Label className="text-xs text-muted-foreground">wRVU %ile</Label>
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
                    <p className="text-xs text-muted-foreground">
                      Search matches provider name/ID, specialty, division, role, or comp plan type. Filter by dropdowns, pay vs productivity, FMV risk, or TCC/wRVU percentile ranges. Click a provider name for details.
                    </p>
                  </div>
                )}
              </div>
            )}

            {hasActiveFilters && results.rows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Showing {filteredRows.length} of {results.rows.length} providers.
              </p>
            )}

            {filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No providers match the current filters.</p>
            ) : (
              <TccWrvuSummaryTable rows={filteredRows} showScenarioName={true} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
