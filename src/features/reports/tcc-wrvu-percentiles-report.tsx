import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Eraser, FileDown, FileSpreadsheet, Info, Lock, Percent, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Command, CommandInput } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/slider'
import { TccWrvuSummaryTable } from './tcc-wrvu-summary-table'
import { MarketPositioningCalculationDrawer } from '@/features/optimizer/components/market-positioning-calculation-drawer'
import { downloadBatchResultsCSV, exportBatchResultsXLSX } from '@/lib/batch-export'
import { runBatch } from '@/lib/batch'
import {
  getImputedVsMarketProviderDetail,
  DEFAULT_IMPUTED_VS_MARKET_CONFIG,
  type ImputedVsMarketProviderDetail,
} from '@/lib/imputed-vs-market'
import {
  getGapInterpretation,
  getFmvRiskLevel,
  FMV_RISK_LABEL,
  type FmvRiskLevel,
} from '@/features/optimizer/components/optimizer-constants'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { BatchResults, BatchRowResult } from '@/types/batch'
import type { SynonymMap } from '@/types/batch'

/** One-line summary of scenario inputs so users know what each saved scenario contains. */
function scenarioInputsSummary(inputs: ScenarioInputs): string {
  const parts: string[] = []
  if (inputs.cfSource === 'target_percentile') {
    parts.push(`CF: ${inputs.proposedCFPercentile ?? 40}th %ile`)
  } else if (inputs.cfSource === 'override' && inputs.overrideCF != null) {
    parts.push(`CF: $${inputs.overrideCF.toLocaleString('en-US', { maximumFractionDigits: 2 })} override`)
  } else if (inputs.cfSource === 'target_haircut') {
    parts.push(`CF: target − ${inputs.haircutPct ?? 0}%`)
  }
  parts.push(`PSQ: ${inputs.psqPercent ?? 0}%`)
  return parts.join(', ')
}

export interface TccWrvuPercentilesReportProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  onBack: () => void
}

export function TccWrvuPercentilesReport({
  providerRows,
  marketRows,
  scenarioInputs,
  savedScenarios,
  batchSynonymMap,
  onBack,
}: TccWrvuPercentilesReportProps) {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('current')
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [specialtySearch, setSpecialtySearch] = useState<string>('')
  const [providerSearch, setProviderSearch] = useState<string>('')
  const [payVsProdFilter, setPayVsProdFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [providerTypeFilter, setProviderTypeFilter] = useState<string>('all')
  const [compPlanFilter, setCompPlanFilter] = useState<string>('all')
  const [fmvRiskFilter, setFmvRiskFilter] = useState<string>('all')
  const [tccPercentileRange, setTccPercentileRange] = useState<[number, number]>([0, 100])
  const [wrvuPercentileRange, setWrvuPercentileRange] = useState<[number, number]>([0, 100])
  const [filtersOpen, setFiltersOpen] = useState<boolean>(true)
  const [drawerProvider, setDrawerProvider] = useState<ImputedVsMarketProviderDetail | null>(null)
  const [drawerSpecialtyLabel, setDrawerSpecialtyLabel] = useState<string | undefined>(undefined)

  const effectiveScenario = useMemo((): { id: string; name: string; inputs: ScenarioInputs } => {
    if (selectedScenarioId === 'current') {
      return { id: 'report', name: 'Current', inputs: scenarioInputs }
    }
    const saved = savedScenarios.find((s) => s.id === selectedScenarioId)
    if (saved) {
      return { id: saved.id, name: saved.name, inputs: saved.scenarioInputs }
    }
    return { id: 'report', name: 'Current', inputs: scenarioInputs }
  }, [selectedScenarioId, scenarioInputs, savedScenarios])

  const results = useMemo((): BatchResults | null => {
    if (providerRows.length === 0 || marketRows.length === 0) return null
    return runBatch(
      providerRows,
      marketRows,
      [{ id: effectiveScenario.id, name: effectiveScenario.name, scenarioInputs: effectiveScenario.inputs }],
      { synonymMap: batchSynonymMap }
    )
  }, [providerRows, marketRows, effectiveScenario, batchSynonymMap])

  const specialtyOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => r.specialty?.trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => (a ?? '').localeCompare(b ?? ''))
  }, [results?.rows])

  const filteredSpecialtyOptions = useMemo(() => {
    if (!specialtySearch.trim()) return specialtyOptions
    const q = specialtySearch.trim().toLowerCase()
    return specialtyOptions.filter((s) => (s ?? '').toLowerCase().includes(q))
  }, [specialtyOptions, specialtySearch])

  const divisionOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => (r.division ?? '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [results?.rows])

  const providerTypeOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => (r.providerType ?? '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [results?.rows])

  const compPlanOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => (r.productivityModel ?? '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [results?.rows])

  const filteredRows = useMemo((): BatchRowResult[] => {
    if (!results?.rows?.length) return []
    let out = results.rows
    if (specialtyFilter !== 'all') {
      out = out.filter((r) => (r.specialty?.trim() ?? '') === specialtyFilter)
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
        const interp = getGapInterpretation(gap)
        return interp === payVsProdFilter
      })
    }
    if (divisionFilter !== 'all') {
      out = out.filter((r) => (r.division ?? '').trim() === divisionFilter)
    }
    if (providerTypeFilter !== 'all') {
      out = out.filter((r) => (r.providerType ?? '').trim() === providerTypeFilter)
    }
    if (compPlanFilter !== 'all') {
      out = out.filter((r) => (r.productivityModel ?? '').trim() === compPlanFilter)
    }
    if (fmvRiskFilter !== 'all') {
      out = out.filter((r) => {
        const level = getFmvRiskLevel(r.results?.tccPercentile, r.results?.modeledTCCPercentile)
        return level === (fmvRiskFilter as FmvRiskLevel)
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
  }, [results?.rows, specialtyFilter, providerSearch, payVsProdFilter, divisionFilter, providerTypeFilter, compPlanFilter, fmvRiskFilter, tccPercentileRange, wrvuPercentileRange])

  const reportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const hasActiveFilters =
    specialtyFilter !== 'all' ||
    providerSearch.trim() !== '' ||
    payVsProdFilter !== 'all' ||
    divisionFilter !== 'all' ||
    providerTypeFilter !== 'all' ||
    compPlanFilter !== 'all' ||
    fmvRiskFilter !== 'all' ||
    tccPercentileRange[0] > 0 ||
    tccPercentileRange[1] < 100 ||
    wrvuPercentileRange[0] > 0 ||
    wrvuPercentileRange[1] < 100

  const clearFilters = () => {
    setSpecialtyFilter('all')
    setProviderSearch('')
    setPayVsProdFilter('all')
    setDivisionFilter('all')
    setProviderTypeFilter('all')
    setCompPlanFilter('all')
    setFmvRiskFilter('all')
    setTccPercentileRange([0, 100])
    setWrvuPercentileRange([0, 100])
  }

  const handleProviderClick = useCallback(
    (row: BatchRowResult) => {
      const specialty = (row.specialty ?? '').trim()
      if (!specialty || !providerRows.length || !marketRows.length) return
      const details = getImputedVsMarketProviderDetail(
        specialty,
        providerRows,
        marketRows,
        batchSynonymMap,
        DEFAULT_IMPUTED_VS_MARKET_CONFIG
      )
      const match = details.find(
        (p) =>
          String(p.providerId) === String(row.providerId) ||
          (p.providerName && row.providerName && p.providerName === row.providerName)
      )
      setDrawerProvider(match ?? null)
      setDrawerSpecialtyLabel(match ? specialty : undefined)
    },
    [providerRows, marketRows, batchSynonymMap]
  )

  if (providerRows.length === 0) {
    return (
      <div className="space-y-4">
        <SectionTitleWithIcon icon={<Percent className="size-5 text-muted-foreground" />}>
          TCC & wRVU percentiles
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Import provider and market data to generate this report.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const exportResults: BatchResults | null = results
    ? { ...results, rows: filteredRows }
    : null

  return (
    <div className="space-y-4 report-print">
      {/* Row 1: Title + confidential (left), scenario meta + Export (right) — matches Report library / Batch layout */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <SectionTitleWithIcon icon={<Percent className="size-5 text-muted-foreground" />}>
            TCC & wRVU percentiles
          </SectionTitleWithIcon>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Confidential — compensation planning
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {results && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Scenario: {effectiveScenario.name}. Generated {reportDate}. {filteredRows.length} row(s)
              {filteredRows.length !== results.rows.length ? ` of ${results.rows.length}` : ''}.
            </p>
          )}
          {exportResults && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 no-print" aria-label="Export data">
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
      </div>
      {/* Row 2: Back button (left), Current scenario dropdown (right) */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Scenario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current scenario</SelectItem>
            {savedScenarios.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {results && (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">Total cash and wRVU percentiles</p>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Scenario and FMV risk help"
                      >
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm space-y-2 p-3">
                      <p>
                        <strong className="text-foreground">Scenario:</strong> Selects the inputs (e.g. CF target, PSQ). &quot;Current scenario&quot; uses the Single scenario inputs; other options are saved scenario snapshots from batch runs.
                      </p>
                      <p>
                        <strong className="text-foreground">FMV risk:</strong> Total cash comp at or above the 75th percentile may warrant Fair Market Value review. Use the FMV risk column (Low / Elevated / High) to flag providers for attention.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {hasActiveFilters && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={clearFilters}
                        aria-label="Clear filters"
                      >
                        <Eraser className="size-4" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Clear all filters</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {selectedScenarioId !== 'current' && effectiveScenario && (
              <p className="text-xs text-foreground/90">
                <strong>Selected scenario:</strong> {scenarioInputsSummary(effectiveScenario.inputs)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {results.rows.length > 0 && (
              <div className="sticky top-0 z-20 rounded-lg border border-border/70 bg-background/95 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  aria-expanded={filtersOpen}
                  aria-controls="tcc-wrvu-filters-content"
                  id="tcc-wrvu-filters-toggle"
                >
                  <span>Filters</span>
                  {filtersOpen ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </button>
                <div
                  id="tcc-wrvu-filters-content"
                  role="region"
                  aria-labelledby="tcc-wrvu-filters-toggle"
                  className={filtersOpen ? 'block border-t border-border/70 p-3' : 'hidden'}
                >
                {/* Dropdowns: 4-column grid, 2 rows (8 slots) so top and bottom are even; no item alone */}
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                      <Input
                        placeholder="Provider, specialty, division, role, or comp plan…"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        className="bg-white pl-8 dark:bg-background h-9 w-full"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Specialty</Label>
                    <DropdownMenu onOpenChange={(open) => !open && setSpecialtySearch('')}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
                        >
                          <span className="truncate">
                            {specialtyFilter === 'all' ? 'All' : specialtyFilter || '—'}
                          </span>
                          <ChevronDown className="size-4 opacity-50 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
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
                        <div className="max-h-[200px] overflow-y-auto p-1">
                          <DropdownMenuLabel>Specialty</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setSpecialtyFilter('all')}>
                            All specialties
                          </DropdownMenuItem>
                          {filteredSpecialtyOptions.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                          ) : (
                            filteredSpecialtyOptions.map((s) => (
                              <DropdownMenuItem
                                key={s ?? ''}
                                onSelect={() => setSpecialtyFilter(s ?? '')}
                              >
                                {s ?? '—'}
                              </DropdownMenuItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Pay vs productivity</Label>
                    <Select value={payVsProdFilter} onValueChange={setPayVsProdFilter}>
                      <SelectTrigger className="w-full min-w-0 bg-white dark:bg-background h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="aligned">Aligned</SelectItem>
                        <SelectItem value="overpaid">Pay above productivity</SelectItem>
                        <SelectItem value="underpaid">Underpaid vs productivity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {divisionOptions.length > 0 ? (
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Division</Label>
                      <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                        <SelectTrigger className="w-full min-w-0 bg-white dark:bg-background h-9">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {divisionOptions.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="min-w-0" aria-hidden />
                  )}
                  {providerTypeOptions.length > 0 ? (
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Role / type</Label>
                      <Select value={providerTypeFilter} onValueChange={setProviderTypeFilter}>
                        <SelectTrigger className="w-full min-w-0 bg-white dark:bg-background h-9">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {providerTypeOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="min-w-0" aria-hidden />
                  )}
                  {compPlanOptions.length > 0 ? (
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Comp plan type</Label>
                      <Select value={compPlanFilter} onValueChange={setCompPlanFilter}>
                        <SelectTrigger className="w-full min-w-0 bg-white dark:bg-background h-9">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {compPlanOptions.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="min-w-0" aria-hidden />
                  )}
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">FMV risk</Label>
                    <Select value={fmvRiskFilter} onValueChange={setFmvRiskFilter}>
                      <SelectTrigger className="w-full min-w-0 bg-white dark:bg-background h-9">
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
                  <div className="min-w-0" aria-hidden />
                </div>
                {/* Row 2: Sliders — equal width containers */}
                <div className="flex gap-3 mt-3">
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
                <p className="text-xs text-muted-foreground mt-2">
                  Search matches provider name/ID, specialty, division, role, or comp plan type. Filter by dropdowns, pay vs productivity, FMV risk, or TCC/wRVU percentile ranges. Click a provider name for details.
                </p>
                </div>
              </div>
            )}
            {hasActiveFilters && filteredRows.length > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Showing {filteredRows.length} of {results.rows.length} providers.
              </p>
            )}
            {hasActiveFilters && filteredRows.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No providers match your search or filters. Try changing the filters.
              </p>
            ) : (
              <TccWrvuSummaryTable
                rows={filteredRows}
                showScenarioName={true}
                onProviderClick={handleProviderClick}
              />
            )}
          </CardContent>
        </Card>
      )}

      <MarketPositioningCalculationDrawer
        open={drawerProvider != null}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerProvider(null)
            setDrawerSpecialtyLabel(undefined)
          }
        }}
        provider={drawerProvider}
        specialtyLabel={drawerSpecialtyLabel}
      />

      {marketRows.length === 0 && providerRows.length > 0 && (
        <p className="text-muted-foreground text-sm">Import market data to compute percentiles.</p>
      )}
    </div>
  )
}
