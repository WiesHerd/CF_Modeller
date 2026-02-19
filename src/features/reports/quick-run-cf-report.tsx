import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, ChevronDown, ChevronUp, Eraser, FileDown, FileSpreadsheet, Gauge, ListChecks, Play, Search, UserX, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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

function getProviderScopeKey(p: ProviderRow): string {
  const id = (p.providerId ?? '').toString().trim()
  const name = (p.providerName ?? '').toString().trim()
  const specialty = (p.specialty ?? '').toString().trim()
  const division = (p.division ?? '').toString().trim()
  return `${id}|${name}|${specialty}|${division}`
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
  onNavigateToCfOptimizer?: () => void
}

export function QuickRunCFReport({
  providerRows,
  marketRows,
  scenarioInputs,
  batchSynonymMap,
  onBack,
  onNavigateToCfOptimizer,
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

  // --- Scope panel visibility ---
  const [scopeCollapsed, setScopeCollapsed] = useState(false)

  // --- Scope selection ---
  const [selectedModels, setSelectedModels] = useState<Set<string>>(() => new Set(['productivity']))
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set())
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(() => new Set())
  const [selectedDivisions, setSelectedDivisions] = useState<Set<string>>(() => new Set())
  const [excludedProviderKeys, setExcludedProviderKeys] = useState<Set<string>>(() => new Set())

  // Search state inside each dropdown
  const [modelSearch, setModelSearch] = useState('')
  const [typeSearch, setTypeSearch] = useState('')
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [divisionSearch, setDivisionSearch] = useState('')
  const [excludeProviderSearch, setExcludeProviderSearch] = useState('')

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

  const providersByModelAndType = useMemo(() => {
    return providerRows.filter((p) => {
      const model = (p.productivityModel ?? '').trim().toLowerCase()
      const type = (p.providerType ?? '').trim().toLowerCase()
      const modelMatch = Array.from(selectedModels).some((m) => model === m.toLowerCase())
      // empty selectedTypes = all types
      const typeMatch = selectedTypes.size === 0 || Array.from(selectedTypes).some((t) => type === t.toLowerCase())
      return modelMatch && typeMatch
    })
  }, [providerRows, selectedModels, selectedTypes])

  const availableSpecialties = useMemo(() => {
    const s = new Set(
      providersByModelAndType
        .map((p) => (p.specialty ?? '').trim())
        .filter(Boolean)
    )
    return Array.from(s).sort()
  }, [providersByModelAndType])

  const filteredSpecialties = useMemo(
    () => availableSpecialties.filter((s) => s.toLowerCase().includes(specialtySearch.trim().toLowerCase())),
    [availableSpecialties, specialtySearch]
  )

  const availableDivisions = useMemo(() => {
    const s = new Set(
      providersByModelAndType
        .map((p) => (p.division ?? '').trim())
        .filter(Boolean)
    )
    return Array.from(s).sort()
  }, [providersByModelAndType])

  const filteredDivisions = useMemo(
    () => availableDivisions.filter((d) => d.toLowerCase().includes(divisionSearch.trim().toLowerCase())),
    [availableDivisions, divisionSearch]
  )

  const providersInSpecialtyScope = useMemo(() => {
    let result = providersByModelAndType
    if (selectedSpecialties.size > 0)
      result = result.filter((p) => selectedSpecialties.has((p.specialty ?? '').trim()))
    if (selectedDivisions.size > 0)
      result = result.filter((p) => selectedDivisions.has((p.division ?? '').trim()))
    return result
  }, [providersByModelAndType, selectedSpecialties, selectedDivisions])

  const filteredExcludedProviders = useMemo(() => {
    const q = excludeProviderSearch.trim().toLowerCase()
    const sorted = [...providersInSpecialtyScope].sort((a, b) =>
      String(a.providerName ?? '').localeCompare(String(b.providerName ?? ''))
    )
    if (!q) return sorted
    return sorted.filter((p) => {
      const name = String(p.providerName ?? '').toLowerCase()
      const specialty = String(p.specialty ?? '').toLowerCase()
      const division = String(p.division ?? '').toLowerCase()
      const id = String(p.providerId ?? '').toLowerCase()
      return name.includes(q) || specialty.includes(q) || division.includes(q) || id.includes(q)
    })
  }, [providersInSpecialtyScope, excludeProviderSearch])

  // Providers matching full scope
  const scopedProviders = useMemo(() => {
    if (excludedProviderKeys.size === 0) return providersInSpecialtyScope
    return providersInSpecialtyScope.filter((p) => !excludedProviderKeys.has(getProviderScopeKey(p)))
  }, [providersInSpecialtyScope, excludedProviderKeys])

  const hasData = providerRows.length > 0 && marketRows.length > 0
  const hasScopedProviders = scopedProviders.length > 0

  const isDefaultScope =
    selectedModels.size === 1 &&
    selectedModels.has('productivity') &&
    selectedTypes.size === 0 &&
    selectedSpecialties.size === 0 &&
    selectedDivisions.size === 0 &&
    excludedProviderKeys.size === 0

  const handleClearScope = () => {
    setSelectedModels(new Set(['productivity']))
    setSelectedTypes(new Set())
    setSelectedSpecialties(new Set())
    setSelectedDivisions(new Set())
    setExcludedProviderKeys(new Set())
    setModelSearch('')
    setTypeSearch('')
    setSpecialtySearch('')
    setDivisionSearch('')
    setExcludeProviderSearch('')
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

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) => {
      const next = new Set(prev)
      if (next.has(specialty)) next.delete(specialty)
      else next.add(specialty)
      return next
    })
  }

  const toggleDivision = (division: string) => {
    setSelectedDivisions((prev) => {
      const next = new Set(prev)
      if (next.has(division)) next.delete(division)
      else next.add(division)
      return next
    })
  }

  const toggleExcludedProvider = (provider: ProviderRow) => {
    const key = getProviderScopeKey(provider)
    setExcludedProviderKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const allowed = new Set(availableSpecialties)
    setSelectedSpecialties((prev) => {
      const next = new Set([...prev].filter((s) => allowed.has(s)))
      return next.size === prev.size ? prev : next
    })
  }, [availableSpecialties])

  useEffect(() => {
    const allowed = new Set(availableDivisions)
    setSelectedDivisions((prev) => {
      const next = new Set([...prev].filter((d) => allowed.has(d)))
      return next.size === prev.size ? prev : next
    })
  }, [availableDivisions])

  useEffect(() => {
    const allowedKeys = new Set(providersInSpecialtyScope.map((p) => getProviderScopeKey(p)))
    setExcludedProviderKeys((prev) => {
      const next = new Set([...prev].filter((k) => allowedKeys.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [providersInSpecialtyScope])

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
    <div className="rounded-lg border border-border/70 bg-muted/30">
      {/* Header row — always visible, click to toggle */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setScopeCollapsed((c) => !c)}
        aria-expanded={!scopeCollapsed}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">Provider scope</span>
          <Badge variant="secondary" className="tabular-nums text-xs">
            {scopedProviders.length} provider{scopedProviders.length !== 1 ? 's' : ''} in scope
          </Badge>
          {excludedProviderKeys.size > 0 ? (
            <Badge variant="outline" className="tabular-nums text-xs">
              {excludedProviderKeys.size} excluded
            </Badge>
          ) : null}
          {!isDefaultScope && scopeCollapsed && (
            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-950/30">
              Custom scope
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isDefaultScope && !scopeCollapsed && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={(e) => { e.stopPropagation(); handleClearScope() }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleClearScope() }}}
                    aria-label="Reset scope to defaults"
                  >
                    <Eraser className="size-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">Reset to defaults</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {scopeCollapsed
            ? <ChevronDown className="size-4 text-muted-foreground" />
            : <ChevronUp className="size-4 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Filters grid — collapses */}
      {!scopeCollapsed && (
      <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

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
              className="max-h-[400px] overflow-hidden p-0 min-w-[200px] w-[var(--radix-dropdown-menu-trigger-width)]"
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
              <div className="max-h-[320px] overflow-y-auto p-1">
                <DropdownMenuLabel>Provider type</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedTypes.size === 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedTypes(new Set())
                    else setSelectedTypes(new Set(availableTypes))
                  }}
                  className="font-medium"
                >
                  <ListChecks className="size-4 shrink-0" />
                  {selectedTypes.size === 0 ? 'All selected' : 'Select all'}
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
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs text-muted-foreground">Specialty</Label>
          <DropdownMenu onOpenChange={(open) => { if (!open) setSpecialtySearch('') }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
              >
                <span className="truncate">{scopeSelectLabel(selectedSpecialties, availableSpecialties, 'All specialties')}</span>
                <ChevronDown className="size-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[400px] overflow-hidden p-0 min-w-[220px] w-[var(--radix-dropdown-menu-trigger-width)]"
              onCloseAutoFocus={(e: Event) => e.preventDefault()}
            >
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
              <div className="max-h-[320px] overflow-y-auto p-1">
                <DropdownMenuLabel>Specialty</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedSpecialties.size === 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedSpecialties(new Set())
                    else setSelectedSpecialties(new Set(availableSpecialties))
                  }}
                  className="font-medium"
                >
                  <ListChecks className="size-4 shrink-0" />
                  {selectedSpecialties.size === 0 ? 'All selected' : 'Select all'}
                </DropdownMenuCheckboxItem>
                {availableSpecialties.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No specialties in scope</div>
                ) : filteredSpecialties.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                ) : (
                  filteredSpecialties.map((specialty) => (
                    <DropdownMenuCheckboxItem
                      key={specialty}
                      checked={selectedSpecialties.has(specialty)}
                      onSelect={(e) => { e.preventDefault() }}
                      onCheckedChange={() => toggleSpecialty(specialty)}
                    >
                      {specialty}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] text-muted-foreground">
            Narrow the run to one or more specialties.
          </p>
        </div>

        {/* ── Division ── */}
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs text-muted-foreground">Division</Label>
          <DropdownMenu onOpenChange={(open) => { if (!open) setDivisionSearch('') }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
              >
                <span className="truncate">{scopeSelectLabel(selectedDivisions, availableDivisions, 'All divisions')}</span>
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
                  placeholder="Search divisions…"
                  value={divisionSearch}
                  onChange={(e) => setDivisionSearch(e.target.value)}
                  className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto p-1">
                <DropdownMenuLabel>Division</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedDivisions.size === 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => { if (checked) setSelectedDivisions(new Set()) }}
                >
                  All divisions
                </DropdownMenuCheckboxItem>
                {availableDivisions.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No divisions in scope</div>
                ) : filteredDivisions.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                ) : (
                  filteredDivisions.map((division) => (
                    <DropdownMenuCheckboxItem
                      key={division}
                      checked={selectedDivisions.has(division)}
                      onSelect={(e) => { e.preventDefault() }}
                      onCheckedChange={() => toggleDivision(division)}
                    >
                      {division}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] text-muted-foreground">
            Filter by division or department.
          </p>
        </div>

        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs text-muted-foreground">Exclude individuals</Label>
          <DropdownMenu onOpenChange={(open) => { if (!open) setExcludeProviderSearch('') }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
              >
                <span className="truncate">
                  {excludedProviderKeys.size === 0
                    ? 'No exclusions'
                    : `${excludedProviderKeys.size} excluded`}
                </span>
                <ChevronDown className="size-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[320px] overflow-hidden p-0 min-w-[280px] max-w-[min(90vw,420px)] w-auto"
              onCloseAutoFocus={(e: Event) => e.preventDefault()}
            >
              <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                <Search className="size-4 shrink-0 opacity-50" />
                <Input
                  placeholder="Search providers…"
                  value={excludeProviderSearch}
                  onChange={(e) => setExcludeProviderSearch(e.target.value)}
                  className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[240px] overflow-y-auto p-1">
                <DropdownMenuLabel>Exclude providers</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={excludedProviderKeys.size === 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => { if (checked) setExcludedProviderKeys(new Set()) }}
                  className="font-medium"
                >
                  <Eraser className="size-4 shrink-0" />
                  Clear all
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={
                    providersInSpecialtyScope.length > 0 &&
                    filteredExcludedProviders.length > 0 &&
                    filteredExcludedProviders.every((p) => excludedProviderKeys.has(getProviderScopeKey(p)))
                  }
                  disabled={filteredExcludedProviders.length === 0}
                  onSelect={(e) => { e.preventDefault() }}
                  onCheckedChange={(checked) => {
                    const keys = new Set(filteredExcludedProviders.map((p) => getProviderScopeKey(p)))
                    if (checked) {
                      setExcludedProviderKeys((prev) => new Set([...prev, ...keys]))
                    } else {
                      setExcludedProviderKeys((prev) => {
                        const next = new Set(prev)
                        keys.forEach((k) => next.delete(k))
                        return next
                      })
                    }
                  }}
                  className="font-medium"
                >
                  <UserX className="size-4 shrink-0" />
                  {filteredExcludedProviders.length === 0
                    ? 'Exclude all'
                    : `Exclude all (${filteredExcludedProviders.length})`}
                </DropdownMenuCheckboxItem>
                {providersInSpecialtyScope.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No providers in current scope</div>
                ) : filteredExcludedProviders.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                ) : (
                  filteredExcludedProviders.map((provider) => {
                    const key = getProviderScopeKey(provider)
                    const name = String(provider.providerName ?? provider.providerId ?? 'Unknown provider')
                    const subtitle = [provider.specialty, provider.division].filter(Boolean).join(' · ')
                    return (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={excludedProviderKeys.has(key)}
                        onSelect={(e) => { e.preventDefault() }}
                        onCheckedChange={() => toggleExcludedProvider(provider)}
                        className="min-w-0"
                      >
                        <span className="break-words line-clamp-2">
                          {name}{subtitle ? ` — ${subtitle}` : ''}
                        </span>
                      </DropdownMenuCheckboxItem>
                    )
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] text-muted-foreground">
            Exclude specific providers from this run.
          </p>
        </div>
      </div>

      {!hasScopedProviders && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          No providers match the current scope. Adjust the filters above.
        </p>
      )}
      </div>
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
                Adjust provider scope by compensation model, provider type, specialty, or excluded individuals.
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-2" aria-label="Export data">
                        <FileDown className="size-4" /> Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Export</DropdownMenuLabel>
                      <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                        <FileDown className="size-4" />
                        Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExport} className="gap-2">
                        <FileSpreadsheet className="size-4" />
                        Export to Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                    Want to customize objectives, governance, or TCC settings? Use{' '}
                    {onNavigateToCfOptimizer ? (
                      <button
                        type="button"
                        onClick={onNavigateToCfOptimizer}
                        className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer"
                      >
                        CF Optimizer
                      </button>
                    ) : (
                      <strong>CF Optimizer</strong>
                    )}{' '}
                    in Batch.
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
