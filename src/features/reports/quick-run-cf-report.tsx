import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, ChevronDown, Eraser, FileDown, FileSpreadsheet, Gauge, Play, Printer, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'
import { OptimizerReviewWorkspace } from '@/features/optimizer/components/optimizer-review-workspace'
import { getDefaultOptimizerSettings } from '@/types/optimizer'
import type { OptimizerRunResult, OptimizerSettings } from '@/types/optimizer'
import type { OptimizerWorkerOutMessage, OptimizerWorkerRunPayload } from '@/workers/optimizer-worker'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs } from '@/types/scenario'
import type { SynonymMap } from '@/types/batch'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'

function getTotalIncentiveDollars(result: OptimizerRunResult): number {
  if (result.summary.totalIncentiveDollars != null) return result.summary.totalIncentiveDollars
  let sum = 0
  for (const row of result.bySpecialty) {
    for (const ctx of row.providerContexts) {
      if (ctx.included && ctx.modeledIncentiveDollars != null) sum += ctx.modeledIncentiveDollars
    }
  }
  return sum
}

function exportOptimizerResultsToCSV(result: OptimizerRunResult): void {
  const headers = ['Specialty', 'Included', 'Excluded', 'CurrentCF', 'RecommendedCF', 'CFChangePct', 'MeanBaselineGap', 'MeanModeledGap', 'PolicyCheck', 'Flags']
  const rows = result.bySpecialty.map((row) => [
    row.specialty,
    row.includedCount,
    row.excludedCount,
    row.currentCF.toFixed(4),
    row.recommendedCF.toFixed(4),
    row.cfChangePct.toFixed(2),
    row.meanBaselineGap.toFixed(2),
    row.meanModeledGap.toFixed(2),
    row.policyCheck,
    row.flags.join('; '),
  ])
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recommended-cf-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportOptimizerResultsToExcel(result: OptimizerRunResult): void {
  const specialtyRows = result.bySpecialty.map((row) => ({
    Specialty: row.specialty,
    Included: row.includedCount,
    Excluded: row.excludedCount,
    CurrentCF: row.currentCF.toFixed(4),
    RecommendedCF: row.recommendedCF.toFixed(4),
    CFChangePct: row.cfChangePct.toFixed(2),
    MeanBaselineGap: row.meanBaselineGap.toFixed(2),
    MeanModeledGap: row.meanModeledGap.toFixed(2),
    MAEBefore: row.maeBefore.toFixed(2),
    MAEAfter: row.maeAfter.toFixed(2),
    SpendImpact: row.spendImpactRaw.toFixed(2),
    HighRiskCount: row.highRiskCount,
    MediumRiskCount: row.mediumRiskCount,
    PolicyCheck: row.policyCheck,
    Flags: row.flags.join('; '),
  }))
  const exclusionRows = result.audit.excludedProviders.map((provider) => ({
    ProviderID: provider.providerId,
    ProviderName: provider.providerName,
    Specialty: provider.specialty,
    Reasons: provider.reasons.join('; '),
  }))
  const specialtySheet = XLSX.utils.json_to_sheet(specialtyRows.length > 0 ? specialtyRows : [{}])
  const exclusionSheet = XLSX.utils.json_to_sheet(exclusionRows.length > 0 ? exclusionRows : [{}])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, specialtySheet, 'Specialty results')
  XLSX.utils.book_append_sheet(workbook, exclusionSheet, 'Exclusions')
  XLSX.writeFile(workbook, `recommended-cf-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Trigger label for scope dropdown (matches Compensation type pattern). emptyLabel when size 0, else allLabel when all selected, else count. */
function scopeSelectLabel(
  selected: Set<string>,
  all: string[],
  allLabel: string,
  emptyLabel?: string
): string {
  if (selected.size === 0) return emptyLabel ?? allLabel
  if (selected.size === all.length && all.length > 0) return allLabel
  const noun = allLabel.replace(/^All /, '').replace(/s$/, '') + 's'
  return `${selected.size} ${noun} selected`
}

export interface QuickRunCFReportProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  batchSynonymMap: SynonymMap
  onBack: () => void
}

export function QuickRunCFReport({
  providerRows,
  marketRows,
  scenarioInputs,
  batchSynonymMap,
  onBack,
}: QuickRunCFReportProps) {
  const [result, setResult] = useState<OptimizerRunResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState<{
    specialtyIndex: number
    totalSpecialties: number
    specialtyName: string
  } | null>(null)
  const workerRef = useRef<Worker | null>(null)

  // --- Scope selection ---
  const [selectedModels, setSelectedModels] = useState<Set<string>>(() => new Set(['productivity']))
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set())

  // Search state inside each dropdown
  const [modelSearch, setModelSearch] = useState('')
  const [typeSearch, setTypeSearch] = useState('')

  // Derived option lists from uploaded data
  const availableModels = useMemo(() => {
    const s = new Set(providerRows.map((p) => (p.productivityModel ?? '').trim()).filter(Boolean))
    return Array.from(s).sort()
  }, [providerRows])

  const availableTypes = useMemo(() => {
    const s = new Set(providerRows.map((p) => (p.providerType ?? '').trim()).filter(Boolean))
    return Array.from(s).sort()
  }, [providerRows])

  // Filtered lists for search
  const filteredModels = useMemo(
    () => availableModels.filter((m) => m.toLowerCase().includes(modelSearch.trim().toLowerCase())),
    [availableModels, modelSearch]
  )
  const filteredTypes = useMemo(
    () => availableTypes.filter((t) => t.toLowerCase().includes(typeSearch.trim().toLowerCase())),
    [availableTypes, typeSearch]
  )

  // Providers matching current scope
  const scopedProviders = useMemo(() => {
    return providerRows.filter((p) => {
      const model = (p.productivityModel ?? '').trim().toLowerCase()
      const type = (p.providerType ?? '').trim().toLowerCase()
      const modelMatch = Array.from(selectedModels).some((m) => model === m.toLowerCase())
      // empty selectedTypes = all types
      const typeMatch = selectedTypes.size === 0 || Array.from(selectedTypes).some((t) => type === t.toLowerCase())
      return modelMatch && typeMatch
    })
  }, [providerRows, selectedModels, selectedTypes])

  const hasData = providerRows.length > 0 && marketRows.length > 0
  const hasScopedProviders = scopedProviders.length > 0

  const isDefaultScope =
    selectedModels.size === 1 &&
    selectedModels.has('productivity') &&
    selectedTypes.size === 0

  const handleClearScope = () => {
    setSelectedModels(new Set(['productivity']))
    setSelectedTypes(new Set())
    setModelSearch('')
    setTypeSearch('')
  }

  const toggleModel = (model: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev)
      if (next.has(model)) {
        if (next.size > 1) next.delete(model)
      } else {
        next.add(model)
      }
      return next
    })
  }

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const handleRun = useCallback(() => {
    if (!hasData || !hasScopedProviders || workerRef.current) return
    setIsRunning(true)
    setResult(null)
    setRunError(null)
    setRunProgress(null)

    const worker = new Worker(new URL('../../workers/optimizer-worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<OptimizerWorkerOutMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        setRunProgress({ specialtyIndex: message.specialtyIndex, totalSpecialties: message.totalSpecialties, specialtyName: message.specialtyName })
        return
      }
      workerRef.current = null
      worker.terminate()
      setIsRunning(false)
      setRunProgress(null)
      if (message.type === 'done') setResult(message.result)
      else setRunError(message.message)
    }

    worker.onerror = () => {
      workerRef.current = null
      worker.terminate()
      setIsRunning(false)
      setRunProgress(null)
      setRunError('Optimizer worker failed.')
    }

    const settings: OptimizerSettings = getDefaultOptimizerSettings(scenarioInputs ?? DEFAULT_SCENARIO_INPUTS)
    const payload: OptimizerWorkerRunPayload = {
      type: 'run',
      providerRows: scopedProviders,
      marketRows,
      settings,
      scenarioId: crypto.randomUUID(),
      scenarioName: 'Quick run',
      synonymMap: batchSynonymMap ?? {},
    }
    worker.postMessage(payload)
  }, [hasData, hasScopedProviders, scopedProviders, marketRows, scenarioInputs, batchSynonymMap])

  const handleExport = useCallback(() => { if (result) exportOptimizerResultsToExcel(result) }, [result])
  const handleExportCSV = useCallback(() => { if (result) exportOptimizerResultsToCSV(result) }, [result])
  const handlePrint = useCallback(() => { window.print() }, [])

  if (!hasData) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<Gauge className="size-5 text-muted-foreground" />}>
          Recommended conversion factors
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Import provider and market data on the Upload screen to run this report.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Scope panel ──────────────────────────────────────────────────────────
  const scopePanel = (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground shrink-0" />
          <p className="text-sm font-medium text-foreground">Provider scope</p>
          <Badge variant="secondary" className="tabular-nums text-xs">
            {scopedProviders.length} provider{scopedProviders.length !== 1 ? 's' : ''} in scope
          </Badge>
        </div>
        {!isDefaultScope && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={handleClearScope}
                  aria-label="Reset scope to defaults"
                >
                  <Eraser className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Reset to defaults</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Filters grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        {/* ── Compensation model (same input dropdown pattern as Compensation type) ── */}
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs text-muted-foreground">Compensation model</Label>
          <DropdownMenu onOpenChange={(open) => { if (!open) setModelSearch('') }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
              >
                <span className="truncate">{scopeSelectLabel(selectedModels, availableModels, 'All models', 'No models selected')}</span>
                <ChevronDown className="size-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
              onCloseAutoFocus={(e: Event) => e.preventDefault()}
            >
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
              <div className="max-h-[200px] overflow-y-auto p-1">
                <DropdownMenuLabel>Compensation model</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedModels.size === availableModels.length && availableModels.length > 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedModels(new Set(availableModels))
                    else setSelectedModels(new Set())
                  }}
                >
                  All models
                </DropdownMenuCheckboxItem>
                {filteredModels.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                ) : (
                  filteredModels.map((model) => (
                    <DropdownMenuCheckboxItem
                      key={model}
                      checked={selectedModels.has(model)}
                      onSelect={(e) => { e.preventDefault() }}
                      onCheckedChange={() => toggleModel(model)}
                    >
                      {capitalize(model)}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] text-muted-foreground">
            CF optimizer works best with productivity-based providers.
          </p>
        </div>

        {/* ── Provider type (same input dropdown pattern as Compensation type) ── */}
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs text-muted-foreground">Provider type</Label>
          <DropdownMenu onOpenChange={(open) => { if (!open) setTypeSearch('') }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
              >
                <span className="truncate">{scopeSelectLabel(selectedTypes, availableTypes, 'All types')}</span>
                <ChevronDown className="size-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
              onCloseAutoFocus={(e: Event) => e.preventDefault()}
            >
              <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                <Search className="size-4 shrink-0 opacity-50" />
                <Input
                  placeholder="Search provider types…"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto p-1">
                <DropdownMenuLabel>Provider type</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedTypes.size === 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => { if (checked) setSelectedTypes(new Set()) }}
                >
                  All provider types
                </DropdownMenuCheckboxItem>
                {availableTypes.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No provider types in data</div>
                ) : filteredTypes.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                ) : (
                  filteredTypes.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={selectedTypes.has(type)}
                      onSelect={(e) => { e.preventDefault() }}
                      onCheckedChange={() => toggleType(type)}
                    >
                      {type}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] text-muted-foreground">
            Filter by provider type (MD, APP, etc.). Empty = all types.
          </p>
        </div>
      </div>

      {!hasScopedProviders && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          No providers match the current scope. Adjust the filters above.
        </p>
      )}
    </div>
  )

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <SectionTitleWithIcon icon={<Gauge className="size-5 text-muted-foreground" />}>
        Recommended conversion factors
      </SectionTitleWithIcon>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {runError ? <WarningBanner title="Optimizer run failed" message={runError} tone="error" /> : null}

          {scopePanel}

          {!result && !isRunning && !runError ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Recommended conversion factors by specialty using default settings.
                Adjust the scope above to include different provider types or compensation models.
              </p>
              <Button onClick={handleRun} disabled={!hasScopedProviders} className="gap-2">
                <Play className="size-4" /> Run
              </Button>
            </div>
          ) : null}

          {(isRunning || result) ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleRun} disabled={isRunning || !hasScopedProviders} className="gap-2">
                  {isRunning ? (
                    <span className="animate-pulse">
                      {runProgress
                        ? `Analyzing specialty ${runProgress.specialtyIndex + 1} of ${runProgress.totalSpecialties} (${runProgress.specialtyName || '...'})...`
                        : 'Running...'}
                    </span>
                  ) : (
                    <><Play className="size-4" /> Run again</>
                  )}
                </Button>
                {result ? (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                      <Printer className="size-4" /> Print
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                      <FileDown className="size-4" /> Export CSV
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleExport} className="gap-2">
                      <FileSpreadsheet className="size-4" /> Export to Excel
                    </Button>
                  </>
                ) : null}
              </div>

              {result ? (
                <div className="flex flex-col gap-4">
                  {result.summary.specialtiesAnalyzed === 0 ? (
                    <WarningBanner message="No specialties had matching market data. Check specialty names and synonym mappings on the Upload screen." />
                  ) : null}

                  <TooltipProvider delayDuration={300}>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium tabular-nums">{result.summary.specialtiesAnalyzed}</span> specialties
                      {' · '}
                      <span className="font-medium tabular-nums">{result.summary.providersIncluded}</span> in scope
                      {' · '}
                      <span className="font-medium tabular-nums">{result.summary.providersExcluded}</span> excluded
                    </p>

                    <p className="text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help font-medium tabular-nums text-primary underline decoration-dotted decoration-primary/50 underline-offset-2">
                            ${result.summary.totalSpendImpactRaw.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs">
                          Change in total TCC when moving from current CF to the recommended CF. Positive = total pay goes up; negative = total pay goes down.
                        </TooltipContent>
                      </Tooltip>
                      {' '}total impact{' · '}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted decoration-primary/50 underline-offset-2">
                            <span>Total incentive spend: </span>
                            <span className="font-medium tabular-nums text-primary">
                              ${getTotalIncentiveDollars(result).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs">
                          Total work RVU incentive dollars at the recommended CF across all included providers.
                        </TooltipContent>
                      </Tooltip>
                    </p>
                  </TooltipProvider>

                  <OptimizerReviewWorkspace
                    rows={result.bySpecialty}
                    settings={getDefaultOptimizerSettings(scenarioInputs ?? DEFAULT_SCENARIO_INPUTS)}
                    marketRows={marketRows}
                    synonymMap={batchSynonymMap ?? {}}
                  />

                  <p className="text-xs text-muted-foreground">
                    Want to customize objectives, governance, or TCC settings? Use <strong>CF Optimizer</strong> in Batch.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
