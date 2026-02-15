import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, FileDown, FileSpreadsheet, Lock, Printer } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { TccWrvuSummaryTable } from './tcc-wrvu-summary-table'
import { MarketPositioningCalculationDrawer } from '@/features/optimizer/components/market-positioning-calculation-drawer'
import { downloadBatchResultsCSV, exportBatchResultsXLSX } from '@/lib/batch-export'
import { runBatch } from '@/lib/batch'
import {
  getImputedVsMarketProviderDetail,
  DEFAULT_IMPUTED_VS_MARKET_CONFIG,
  type ImputedVsMarketProviderDetail,
} from '@/lib/imputed-vs-market'
import { getGapInterpretation } from '@/features/optimizer/components/optimizer-constants'
import { FileText } from 'lucide-react'
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
  const [providerSearch, setProviderSearch] = useState<string>('')
  const [payVsProdFilter, setPayVsProdFilter] = useState<string>('all')
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
          (r.providerId ?? '').toString().toLowerCase().includes(q)
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
    return out
  }, [results?.rows, specialtyFilter, providerSearch, payVsProdFilter])

  const reportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const handlePrint = () => {
    window.print()
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
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
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
      <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
        TCC & wRVU percentiles
      </SectionTitleWithIcon>

      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex flex-wrap items-center gap-2">
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
        {exportResults && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" aria-label="Export data">
                <FileDown className="size-4" />
                Export
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Export / print</DropdownMenuLabel>
              <DropdownMenuItem onClick={handlePrint} className="gap-2">
                <Printer className="size-4" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadBatchResultsCSV(exportResults)} className="gap-2">
                <FileDown className="size-4" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportBatchResultsXLSX(exportResults)} className="gap-2">
                <FileSpreadsheet className="size-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {results && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <p className="text-muted-foreground">
                Scenario selects the inputs (e.g. CF target, PSQ). &quot;Current scenario&quot; uses the Single scenario inputs; other options are saved scenario snapshots from batch runs.
              </p>
            </div>
            <p className="text-sm font-medium text-foreground">Total cash and wRVU percentiles</p>
            {selectedScenarioId !== 'current' && effectiveScenario && (
              <p className="text-xs text-foreground/90">
                <strong>Selected scenario:</strong> {scenarioInputsSummary(effectiveScenario.inputs)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Scenario: {effectiveScenario.name}. Generated {reportDate}. {filteredRows.length} row(s)
              {filteredRows.length !== results.rows.length ? ` of ${results.rows.length}` : ''}.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-1.5">
              <strong>FMV risk:</strong> Total cash comp at or above the 75th percentile may warrant Fair Market Value review. Use the FMV risk column (Low / Elevated / High) to flag providers for attention.
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              Confidential — compensation planning
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {results.rows.length > 0 && (
              <div className="sticky top-0 z-20 rounded-lg border border-border/70 bg-background/95 p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1.5 min-w-[140px] flex-1 max-w-[200px]">
                    <Label className="text-xs text-muted-foreground">Specialty</Label>
                    <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                      <SelectTrigger className="w-full bg-white dark:bg-background">
                        <SelectValue placeholder="All specialties" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All specialties</SelectItem>
                        {specialtyOptions.map((s) => (
                          <SelectItem key={s ?? ''} value={s ?? ''}>
                            {s ?? '—'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 min-w-[200px] max-w-[260px] flex-1">
                    <Label className="text-xs text-muted-foreground">Search provider name or ID</Label>
                    <Input
                      placeholder="Search provider name or ID"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      className="w-full bg-white dark:bg-background"
                    />
                  </div>
                  <div className="space-y-1.5 w-[180px] shrink-0">
                    <Label className="text-xs text-muted-foreground">Pay vs productivity</Label>
                    <Select value={payVsProdFilter} onValueChange={setPayVsProdFilter}>
                      <SelectTrigger className="w-full bg-white dark:bg-background">
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
                  {(specialtyFilter !== 'all' || providerSearch.trim() || payVsProdFilter !== 'all') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={() => {
                        setSpecialtyFilter('all')
                        setProviderSearch('')
                        setPayVsProdFilter('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            )}
            {(specialtyFilter !== 'all' || providerSearch.trim() || payVsProdFilter !== 'all') && filteredRows.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredRows.length} of {results.rows.length} providers.
              </p>
            )}
            {(specialtyFilter !== 'all' || providerSearch.trim() || payVsProdFilter !== 'all') && filteredRows.length === 0 ? (
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
