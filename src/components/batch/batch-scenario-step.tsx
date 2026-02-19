import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Play, Loader2, AlertCircle, Plus, Trash2, Sliders, ChevronDown, ChevronRight, ChevronLeft, Link2, LayoutGrid, Check, Search, Save, ArrowLeft, FolderOpen, Shield, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/format'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { BatchScenarioInline } from '@/components/batch/batch-scenario-inline'
import { ScenarioControls } from '@/components/scenario-controls'
import { Input } from '@/components/ui/input'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { BatchOverrides, BatchResults, BatchScenarioSnapshot, SavedBatchRun, SavedBatchScenarioConfig, SynonymMap } from '@/types/batch'
import type { BatchWorkerRunPayload, BatchWorkerOutMessage } from '@/workers/batch-worker'

interface BatchScenarioStepProps {
  providerRows: ProviderRow[]
  marketRows: import('@/types/market').MarketRow[]
  scenarioInputs: ScenarioInputs
  setScenarioInputs: (inputs: Partial<ScenarioInputs>) => void
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  onRunComplete: (results: BatchResults, scenarioSnapshot?: BatchScenarioSnapshot) => void
  /** When provided, show a link to edit synonyms on the Upload screen. */
  onNavigateToUpload?: () => void
  /** When provided, Save scenario button is shown. Pass updateId to overwrite that config; otherwise saves as new. */
  onSaveScenario?: (config: Omit<SavedBatchScenarioConfig, 'id' | 'createdAt'>, updateId?: string) => void
  /** When provided, Start fresh is shown to clear all saved scenarios from the library. */
  onClearSavedScenarios?: () => void
  /** When 'bulk', show only base scenario + run. When 'detailed', show only overrides + run. Default 'full' shows all. */
  mode?: 'full' | 'bulk' | 'detailed'
  /** When provided and mode is bulk/detailed, show a Back button that calls this. */
  onBack?: () => void
  /** Saved batch scenario configs (for load/delete UI). */
  savedBatchScenarioConfigs?: SavedBatchScenarioConfig[]
  /** When set, apply this config to local state then clear (trigger from parent). */
  appliedBatchScenarioConfig?: SavedBatchScenarioConfig | null
  onLoadBatchScenarioConfig?: (config: SavedBatchScenarioConfig) => void
  onBatchScenarioConfigApplied?: () => void
  onDeleteBatchScenarioConfig?: (id: string) => void
  /** Last run results for this card (bulk or detailed); when set, show Results section on the card. */
  lastResults?: BatchResults | null
  /** Snapshot for the last run (for save/display). */
  lastScenarioSnapshot?: BatchScenarioSnapshot | null
  /** Saved batch runs for load/delete (shared list; filter by mode in UI if desired). */
  savedBatchRuns?: SavedBatchRun[]
  onSaveRun?: (name?: string) => void
  onLoadRun?: (id: string) => void
  onDeleteRun?: (id: string) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- props accepted for API, used when mode/layout changes */
export function BatchScenarioStep({
  providerRows,
  marketRows,
  scenarioInputs,
  setScenarioInputs,
  savedScenarios,
  batchSynonymMap,
  onRunComplete,
  onNavigateToUpload,
  onSaveScenario,
  onClearSavedScenarios,
  mode = 'full',
  onBack,
  savedBatchScenarioConfigs = [],
  appliedBatchScenarioConfig = null,
  onLoadBatchScenarioConfig,
  onBatchScenarioConfigApplied,
  onDeleteBatchScenarioConfig,
  lastResults = null,
  lastScenarioSnapshot = null,
  savedBatchRuns = [],
  onSaveRun,
  onLoadRun,
  onDeleteRun,
}: BatchScenarioStepProps) {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  void savedScenarios
  void onClearSavedScenarios
  void lastResults
  void lastScenarioSnapshot
  void savedBatchRuns
  void onSaveRun
  void onLoadRun
  void onDeleteRun
  const isBulk = mode === 'bulk'
  const isDetailed = mode === 'detailed'
  const isCardView = isBulk || isDetailed
  const [isRunning, setIsRunning] = useState(false)
  const [saveScenarioDialogOpen, setSaveScenarioDialogOpen] = useState(false)
  const [saveScenarioName, setSaveScenarioName] = useState('')
  useEffect(() => {
    if (saveScenarioDialogOpen && appliedBatchScenarioConfig?.name)
      setSaveScenarioName(appliedBatchScenarioConfig.name)
    if (!saveScenarioDialogOpen) setSaveScenarioName('')
  }, [saveScenarioDialogOpen, appliedBatchScenarioConfig?.name])
  /** When true, run only the base scenario (controls at top). When false, run base + all from scenario library. */
  const [runBaseScenarioOnly, setRunBaseScenarioOnly] = useState(true)
  const [progress, setProgress] = useState({ processed: 0, total: 1, elapsedMs: 0 })
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  /** Which override row's specialty dropdown is open (null = none). */
  const [openSpecialtyOverrideRow, setOpenSpecialtyOverrideRow] = useState<number | null>(null)
  /** Which override row's provider dropdown is open (null = none). */
  const [openProviderOverrideRow, setOpenProviderOverrideRow] = useState<number | null>(null)
  /** Search filter for Overrides > By specialty dropdown. */
  const [specialtyOverrideSearch, setSpecialtyOverrideSearch] = useState('')
  /** Search filter for Overrides > By provider dropdown. */
  const [providerOverrideSearch, setProviderOverrideSearch] = useState('')
  const specialtyOverrideSearchRef = useRef<HTMLInputElement>(null)
  const providerOverrideSearchRef = useRef<HTMLInputElement>(null)
  /** Override rows: each row can apply to multiple specialties. */
  const [specialtyOverrides, setSpecialtyOverrides] = useState<
    { specialties: string[]; proposedCFPercentile: string; overrideCF: string; psqPercent: string }[]
  >([])
  /** Override rows: each row can apply to multiple providers. */
  const [providerOverrides, setProviderOverrides] = useState<
    { providerIds: string[]; proposedCFPercentile: string; overrideCF: string; psqPercent: string }[]
  >([])

  useEffect(() => {
    if (!appliedBatchScenarioConfig || !onBatchScenarioConfigApplied) return
    const c = appliedBatchScenarioConfig
    const bySpec = c.overrides?.bySpecialty ?? {}
    const byProv = c.overrides?.byProviderId ?? {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing applied config from parent into local state
    setSpecialtyOverrides(
      Object.entries(bySpec).map(([spec, inputs]) => ({
        specialties: [spec],
        proposedCFPercentile: inputs.proposedCFPercentile != null ? String(inputs.proposedCFPercentile) : '',
        overrideCF: inputs.overrideCF != null ? String(inputs.overrideCF) : '',
        psqPercent: inputs.psqPercent != null ? String(inputs.psqPercent) : '',
      }))
    )
    setProviderOverrides(
      Object.entries(byProv).map(([id, inputs]) => ({
        providerIds: [id],
        proposedCFPercentile: inputs.proposedCFPercentile != null ? String(inputs.proposedCFPercentile) : '',
        overrideCF: inputs.overrideCF != null ? String(inputs.overrideCF) : '',
        psqPercent: inputs.psqPercent != null ? String(inputs.psqPercent) : '',
      }))
    )
    setRunBaseScenarioOnly(c.runBaseScenarioOnly ?? true)
    onBatchScenarioConfigApplied()
  }, [appliedBatchScenarioConfig, onBatchScenarioConfigApplied])

  const providerSpecialties = useMemo(() => {
    const set = new Set(providerRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [providerRows])

  /** Bulk step-through: 1 = Base scenario, 2 = Scope & guardrails, 3 = Run */
  const [bulkStep, setBulkStep] = useState<1 | 2 | 3>(1)
  /** Bulk guardrails (same idea as CF Optimizer): exclude low FTE / low wRVU volume */
  const [minBasisFTE, setMinBasisFTE] = useState(0.5)
  const [minWRVUPer1p0CFTE, setMinWRVUPer1p0CFTE] = useState(1000)

  /** In detailed mode with overrides: run only providers that match the override scope.
   * - Only specialty overrides: run all providers in those specialties.
   * - Only provider overrides: run only those providers.
   * - Both: run only providers in the provider override list (so one provider like Wei Wei runs alone even if their specialty is also in overrides). */
  const providersAfterSpecialtyFilter = useMemo(() => {
    if (isBulk) return providerRows
    const specialtySet = new Set(
      specialtyOverrides.flatMap((r) => r.specialties.map((s) => s.trim()).filter(Boolean))
    )
    const providerIdSet = new Set(
      providerOverrides.flatMap((r) => r.providerIds.map((id) => String(id).trim()).filter(Boolean))
    )
    if (specialtySet.size === 0 && providerIdSet.size === 0) return providerRows
    return providerRows.filter((p) => {
      const pid = String(p.providerId ?? p.providerName ?? '').trim()
      const spec = (p.specialty ?? '').trim()
      if (providerIdSet.size > 0 && specialtySet.size > 0) {
        return providerIdSet.has(pid) && specialtySet.has(spec)
      }
      if (providerIdSet.size > 0 && providerIdSet.has(pid)) return true
      if (specialtySet.size > 0 && specialtySet.has(spec)) return true
      return false
    })
  }, [providerRows, isBulk, specialtyOverrides, providerOverrides])

  /** For bulk mode: basis FTE and total wRVUs per provider (for guardrail filter). */
  const getBasisFTE = useCallback((p: ProviderRow) => Math.max(0.01, (p.clinicalFTE ?? p.totalFTE ?? 1) as number), [])
  const getTotalWRVUs = useCallback((p: ProviderRow) => (p.totalWRVUs ?? (p.workRVUs ?? 0) + (p.outsideWRVUs ?? 0) + (p.pchWRVUs ?? 0)) || 0, [])

  const providersToRun = useMemo(() => {
    if (!isBulk) return providersAfterSpecialtyFilter
    return providersAfterSpecialtyFilter.filter((p) => {
      const fte = getBasisFTE(p)
      const wrvu = getTotalWRVUs(p)
      const wrvuPer1p0 = fte > 0 ? wrvu / fte : 0
      return fte >= minBasisFTE && wrvuPer1p0 >= minWRVUPer1p0CFTE
    })
  }, [providersAfterSpecialtyFilter, isBulk, minBasisFTE, minWRVUPer1p0CFTE, getBasisFTE, getTotalWRVUs])

  /** For Overrides > By specialty: options when a row dropdown is open, filtered by search. */
  const filteredSpecialtyOverrideOptions = useMemo(() => {
    const q = specialtyOverrideSearch.trim().toLowerCase()
    if (!q) return providerSpecialties
    return providerSpecialties.filter((s) => s.toLowerCase().includes(q))
  }, [providerSpecialties, specialtyOverrideSearch])

  /** When any "By specialty" override row has specialties selected, restrict "Add provider" to only those specialties (e.g. Gen Peds only when that's the override). */
  const providerOverridePool = useMemo(() => {
    const specialtiesInOverrides = new Set(
      specialtyOverrides.flatMap((r) => r.specialties.map((s) => s.trim()).filter(Boolean))
    )
    if (specialtiesInOverrides.size === 0) return providersToRun
    return providersToRun.filter((p) =>
      specialtiesInOverrides.has((p.specialty ?? '').trim())
    )
  }, [providersToRun, specialtyOverrides])

  /** For Overrides > By provider: options when a row dropdown is open, filtered by search; limited to providerOverridePool (e.g. only Gen Peds when that specialty is in By specialty). */
  const filteredProviderOverrideOptions = useMemo(() => {
    const q = providerOverrideSearch.trim().toLowerCase()
    if (!q) return providerOverridePool
    return providerOverridePool.filter((p) => {
      const name = (p.providerName ?? p.providerId ?? '').toString().toLowerCase()
      const spec = (p.specialty ?? '').toLowerCase()
      return name.includes(q) || spec.includes(q)
    })
  }, [providerOverridePool, providerOverrideSearch])

  const batchOverrides = useMemo((): BatchOverrides | undefined => {
    const bySpecialty: Record<string, Partial<ScenarioInputs>> = {}
    for (const row of specialtyOverrides) {
      const pct = row.proposedCFPercentile.trim() === '' ? undefined : Number(row.proposedCFPercentile)
      const cf = row.overrideCF.trim() === '' ? undefined : Number(row.overrideCF)
      const psq = row.psqPercent.trim() === '' ? undefined : Number(row.psqPercent)
      if (pct === undefined && cf === undefined && psq === undefined) continue
      for (const s of row.specialties) {
        if (!s.trim()) continue
        bySpecialty[s] = {}
        if (pct !== undefined && !Number.isNaN(pct)) bySpecialty[s].proposedCFPercentile = pct
        if (cf !== undefined && !Number.isNaN(cf)) bySpecialty[s].overrideCF = cf
        if (psq !== undefined && !Number.isNaN(psq)) bySpecialty[s].psqPercent = psq
      }
    }
    const byProviderId: Record<string, Partial<ScenarioInputs>> = {}
    for (const row of providerOverrides) {
      const pct = row.proposedCFPercentile.trim() === '' ? undefined : Number(row.proposedCFPercentile)
      const cf = row.overrideCF.trim() === '' ? undefined : Number(row.overrideCF)
      const psq = row.psqPercent.trim() === '' ? undefined : Number(row.psqPercent)
      if (pct === undefined && cf === undefined && psq === undefined) continue
      for (const id of row.providerIds) {
        if (!id.trim()) continue
        byProviderId[id] = {}
        if (pct !== undefined && !Number.isNaN(pct)) byProviderId[id].proposedCFPercentile = pct
        if (cf !== undefined && !Number.isNaN(cf)) byProviderId[id].overrideCF = cf
        if (psq !== undefined && !Number.isNaN(psq)) byProviderId[id].psqPercent = psq
      }
    }
    if (Object.keys(bySpecialty).length === 0 && Object.keys(byProviderId).length === 0) return undefined
    return { bySpecialty: Object.keys(bySpecialty).length ? bySpecialty : undefined, byProviderId: Object.keys(byProviderId).length ? byProviderId : undefined }
  }, [specialtyOverrides, providerOverrides])

  const runBatch = useCallback(() => {
    if (providerRows.length === 0 || marketRows.length === 0) {
      setError('Upload provider and market data first.')
      return
    }
    if (providersToRun.length === 0) {
      setError(isBulk
        ? 'No providers pass the scope guardrails. Adjust min FTE or min wRVU in Scope & guardrails.'
        : 'No providers match the selected overrides. Add at least one specialty or provider above, or clear overrides to run all.')
      return
    }
    setError(null)
    setIsRunning(true)
    setProgress({ processed: 0, total: providersToRun.length, elapsedMs: 0 })

    const scenarios = [{ id: 'current', name: 'Current', scenarioInputs: { ...scenarioInputs } }]
    const payload: BatchWorkerRunPayload = {
      type: 'run',
      providers: providersToRun,
      marketRows,
      scenarios,
      synonymMap: batchSynonymMap,
      chunkSize: 200,
      overrides: batchOverrides,
    }

    const worker = new Worker(
      new URL('../../workers/batch-worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<BatchWorkerOutMessage>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setProgress({
          processed: msg.processed,
          total: msg.total,
          elapsedMs: msg.elapsedMs,
        })
      } else if (msg.type === 'done') {
        worker.terminate()
        workerRef.current = null
        setIsRunning(false)
        const snapshot = {
          scenarios,
          selectedSpecialties: [...new Set(msg.results.rows.map((r) => r.specialty).filter(Boolean))],
          selectedProviderIds: [...new Set(msg.results.rows.map((r) => r.providerId).filter(Boolean))],
        }
        onRunComplete(msg.results, snapshot)
      }
    }
    worker.onerror = () => {
      setError('Batch worker failed.')
      worker.terminate()
      workerRef.current = null
      setIsRunning(false)
    }
    worker.postMessage(payload)
  }, [
    isBulk,
    providersToRun,
    marketRows,
    scenarioInputs,
    batchSynonymMap,
    batchOverrides,
    onRunComplete,
    providerRows.length,
  ])

  const total = Math.max(1, progress.total)
  const pct = Math.min(100, Math.round((100 * progress.processed) / total))
  const overrideCount = specialtyOverrides.reduce((n, r) => n + r.specialties.length, 0) + providerOverrides.reduce((n, r) => n + r.providerIds.length, 0)

  /** Base scenario uses Override CF ($); when false, only CF %ile is used in overrides. */
  const baseUsesOverrideCF = scenarioInputs.cfSource === 'override'

  const synonymCount = Object.keys(batchSynonymMap).length

  return (
    <div className="space-y-6">
      {isCardView && (
        <>
          <SectionTitleWithIcon
            icon={isBulk ? <LayoutGrid /> : <Sliders />}
          >
            {isBulk ? 'Create and Run Scenario' : 'Detailed scenario'}
          </SectionTitleWithIcon>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {onBack && (
                <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2">
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              )}
              {isBulk && bulkStep === 3 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setBulkStep(2)} className="gap-2">
                  <ArrowLeft className="size-4" />
                  Back to Scope & guardrails
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TooltipProvider delayDuration={300}>
                {onSaveScenario && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSaveScenarioName('')
                          setSaveScenarioDialogOpen(true)
                        }}
                        disabled={isRunning}
                        aria-label="Save scenario"
                      >
                        <Save className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Save scenario</TooltipContent>
                  </Tooltip>
                )}
                {onLoadBatchScenarioConfig && onDeleteBatchScenarioConfig && (
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Saved batch scenarios (${savedBatchScenarioConfigs.length})`}
                          >
                            <FolderOpen className="size-4" />
                            <ChevronDown className="size-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Saved batch scenarios{savedBatchScenarioConfigs.length > 0 ? ` (${savedBatchScenarioConfigs.length})` : ''}
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-[320px]">
                      {savedBatchScenarioConfigs.length === 0 ? (
                        <DropdownMenuItem disabled className="text-muted-foreground">
                          No saved batch scenarios yet. Use &quot;Save scenario&quot; to save base inputs, overrides, and run-for selection.
                        </DropdownMenuItem>
                      ) : (
                        <ScrollArea className="max-h-[280px]">
                          <div className="p-1">
                            {[...savedBatchScenarioConfigs].reverse().map((config) => (
                              <div
                                key={config.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                              >
                                <div className="min-w-0 flex-1 text-sm">
                                  <p className="font-medium truncate" title={config.name}>
                                    {config.name}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {formatDate(config.createdAt)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => onLoadBatchScenarioConfig(config)}
                                    title="Load this scenario"
                                  >
                                    <FolderOpen className="size-4" />
                                    <span className="sr-only">Load</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (window.confirm(`Delete "${config.name}"?`)) {
                                        onDeleteBatchScenarioConfig(config.id)
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
                )}
              </TooltipProvider>
            </div>
          </div>
        </>
      )}
      {!isCardView && (
      <>
        <SectionTitleWithIcon
          icon={isBulk ? <LayoutGrid /> : <Sliders />}
        >
          {isBulk ? 'Create and Run Scenario' : 'Detailed scenario'}
        </SectionTitleWithIcon>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 shrink-0">
          <TooltipProvider delayDuration={300}>
            {onSaveScenario && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSaveScenarioName('')
                      setSaveScenarioDialogOpen(true)
                    }}
                    disabled={isRunning}
                    aria-label="Save scenario"
                  >
                    <Save className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Save scenario</TooltipContent>
              </Tooltip>
            )}
            {onLoadBatchScenarioConfig && onDeleteBatchScenarioConfig && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Saved batch scenarios (${savedBatchScenarioConfigs.length})`}
                      >
                        <FolderOpen className="size-4" />
                        <ChevronDown className="size-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Saved batch scenarios{savedBatchScenarioConfigs.length > 0 ? ` (${savedBatchScenarioConfigs.length})` : ''}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-[320px]">
                  {savedBatchScenarioConfigs.length === 0 ? (
                    <DropdownMenuItem disabled className="text-muted-foreground">
                      No saved batch scenarios yet. Use &quot;Save scenario&quot; to save base inputs, overrides, and run-for selection.
                    </DropdownMenuItem>
                  ) : (
                    <ScrollArea className="max-h-[280px]">
                      <div className="p-1">
                        {[...savedBatchScenarioConfigs].reverse().map((config) => (
                          <div
                            key={config.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                          >
                            <div className="min-w-0 flex-1 text-sm">
                              <p className="font-medium truncate" title={config.name}>
                                {config.name}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {formatDate(config.createdAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => onLoadBatchScenarioConfig(config)}
                                title="Load this scenario"
                              >
                                <FolderOpen className="size-4" />
                                <span className="sr-only">Load</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (window.confirm(`Delete "${config.name}"?`)) {
                                    onDeleteBatchScenarioConfig(config.id)
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
            )}
          </TooltipProvider>
          {onNavigateToUpload && synonymCount > 0 && (
            <button
              type="button"
              onClick={onNavigateToUpload}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Link2 className="size-4" />
              <span className="hidden sm:inline">{synonymCount} specialty synonym{synonymCount !== 1 ? 's' : ''} mapped — Edit in Upload</span>
            </button>
          )}
          {onNavigateToUpload && synonymCount === 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={onNavigateToUpload}
              title="Edit synonyms (Upload)"
              aria-label="Edit synonyms (Upload)"
            >
              <Link2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      </>
      )}

      {/* Base scenario: for Detailed mode in a collapsible; for Bulk mode step 1 */}
      {(!isBulk || bulkStep === 1) && (
      <div id="batch-scenario" className="scroll-mt-6 space-y-6">
        <details open className="group rounded-lg border border-border/60 bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
            Base scenario
            {isBulk && (
              <span className="text-muted-foreground font-normal text-xs ml-1">
                — Set conversion factor, wRVU target, and PSQ
              </span>
            )}
          </summary>
          <div className="border-t border-border/60 px-4 pt-4 pb-4">
            <div className="space-y-4">
              <BatchScenarioInline
                inputs={scenarioInputs}
                onChange={setScenarioInputs}
                disabled={isRunning}
              />
              <div className="border-t border-border/60 pt-4">
                <ScenarioControls
                inputs={scenarioInputs}
                onChange={setScenarioInputs}
                selectedProvider={null}
                disabled={isRunning}
                variant="sharedOnly"
              />
              </div>
            </div>
            {isBulk && bulkStep === 1 && (
              <div className="flex justify-end border-t border-border/60 pt-4 mt-4">
                <Button type="button" onClick={() => setBulkStep(2)} className="gap-1.5">
                  Next: Scope & guardrails
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </details>
      </div>
      )}

      {/* Bulk only: Step 2 — Scope & guardrails (wRVU bumper, min FTE) */}
      {isBulk && bulkStep === 2 && (
        <Card id="batch-bulk-guardrails" className="scroll-mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4" />
              Scope & guardrails
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Exclude providers below these thresholds so the run focuses on those with stable volume (same idea as the CF Optimizer). Leave defaults to include everyone.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <TooltipProvider delayDuration={200}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="bulk-min-fte">Min clinical FTE</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Help">
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      Exclude providers with clinical FTE below this (e.g. 0.5 = exclude &lt; half-time).
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="bulk-min-fte"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={minBasisFTE}
                  onChange={(e) => setMinBasisFTE(Math.max(0, Math.min(1, Number(e.target.value) || 0.5)))}
                  disabled={isRunning}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="bulk-min-wrvu">Min wRVU per 1.0 cFTE</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Help">
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      Exclude providers whose wRVUs per 1.0 clinical FTE are below this (low volume; ratios can be unstable). Same as CF Optimizer bumper.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="bulk-min-wrvu"
                  type="number"
                  min={0}
                  value={minWRVUPer1p0CFTE}
                  onChange={(e) => setMinWRVUPer1p0CFTE(Math.max(0, Number(e.target.value) || 1000))}
                  disabled={isRunning}
                  className="w-28"
                />
              </div>
            </div>
            </TooltipProvider>
            <p className="text-xs text-muted-foreground border-t border-border/40 pt-3">
              <strong>{providersToRun.length}</strong> provider{providersToRun.length !== 1 ? 's' : ''} in scope
              {providerRows.length > 0 && providersToRun.length < providerRows.length && (
                <span> ({providerRows.length - providersToRun.length} excluded by guardrails)</span>
              )}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
              <Button type="button" variant="outline" onClick={() => setBulkStep(1)} className="gap-1.5">
                <ChevronLeft className="size-4" />
                Back
              </Button>
              <Button type="button" onClick={() => setBulkStep(3)} className="gap-1.5">
                Next: Run
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isBulk && (
      <Card id="batch-overrides" className="scroll-mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="size-4" />
            Overrides by specialty or provider (optional)
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Set different inputs (PSQ, percentiles, CF) by specialty and/or by provider. Base scenario is from the controls above. Provider overrides beat specialty overrides.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            The CF column matches the base scenario’s <strong>CF method</strong> above (Fixed CF ($) vs Target percentile).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* By specialty */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">By specialty</h4>
              <Button
                variant="outline"
                size="sm"
                disabled={isRunning || providerSpecialties.length === 0}
                onClick={() =>
                  setSpecialtyOverrides((prev) => [
                    ...prev,
                    { specialties: [], proposedCFPercentile: '', overrideCF: '', psqPercent: '' },
                  ])
                }
              >
                <Plus className="size-4 mr-2" />
                Add by specialty
              </Button>
            </div>
            {specialtyOverrides.length === 0 ? (
              <p className="text-muted-foreground text-sm py-2">No specialty overrides.</p>
            ) : (
              <div className="w-full overflow-auto rounded-md border border-border">
              <Table className="w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                  <TableRow>
                    <TableHead className="min-w-[160px] px-3 py-2.5">Specialties</TableHead>
                    {baseUsesOverrideCF ? (
                      <TableHead className="w-[100px] px-3 py-2.5">Target CF ($)</TableHead>
                    ) : (
                      <TableHead className="w-[90px] px-3 py-2.5">CF %ile</TableHead>
                    )}
                    <TableHead className="w-[80px] px-3 py-2.5">PSQ %</TableHead>
                    <TableHead className="w-[60px] px-3 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specialtyOverrides.map((row, idx) => (
                    <TableRow key={`spec-${idx}`} className={cn(idx % 2 === 1 && 'bg-muted/30')}>
                      <TableCell className="px-3 py-2.5">
                        <DropdownMenu
                          open={openSpecialtyOverrideRow === idx}
                          onOpenChange={(open) => {
                            if (open) {
                              setOpenSpecialtyOverrideRow(idx)
                              setSpecialtyOverrideSearch('')
                              setTimeout(() => specialtyOverrideSearchRef.current?.focus(), 0)
                            } else {
                              setOpenSpecialtyOverrideRow(null)
                              setSpecialtyOverrideSearch('')
                            }
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="h-9 w-full justify-between font-normal"
                              disabled={isRunning}
                            >
                              <span className="truncate">
                                {row.specialties.length === 0
                                  ? 'Select specialties…'
                                  : row.specialties.length === 1
                                    ? row.specialties[0]
                                    : `${row.specialties.length} specialty(ies)`}
                              </span>
                              <ChevronDown className="size-4 shrink-0 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[280px] overflow-hidden flex flex-col p-0"
                            align="start"
                            onCloseAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className="flex items-center gap-2 border-b px-2 py-1.5">
                              <Search className="size-4 shrink-0 text-muted-foreground" />
                              <Input
                                ref={openSpecialtyOverrideRow === idx ? specialtyOverrideSearchRef : undefined}
                                placeholder="Search specialties…"
                                value={openSpecialtyOverrideRow === idx ? specialtyOverrideSearch : ''}
                                onChange={(e) => setSpecialtyOverrideSearch(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                              />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto p-1">
                              <DropdownMenuLabel>Specialty</DropdownMenuLabel>
                              {filteredSpecialtyOverrideOptions.length === 0 ? (
                                <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matching specialties</p>
                              ) : (
                                filteredSpecialtyOverrideOptions.map((s) => (
                                  <DropdownMenuCheckboxItem
                                    key={s}
                                    checked={row.specialties.includes(s)}
                                    onCheckedChange={(checked) => {
                                      setSpecialtyOverrides((prev) =>
                                        prev.map((r, i) =>
                                          i === idx
                                            ? {
                                                ...r,
                                                specialties: checked ? [...r.specialties, s] : r.specialties.filter((x) => x !== s),
                                              }
                                            : r
                                        )
                                      )
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    {s}
                                  </DropdownMenuCheckboxItem>
                                ))
                              )}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      {baseUsesOverrideCF ? (
                        <TableCell className="px-3 py-2.5">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="—"
                            value={row.overrideCF}
                            onChange={(e) =>
                              setSpecialtyOverrides((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, overrideCF: e.target.value } : r))
                              )
                            }
                            disabled={isRunning}
                            className="h-9 w-full"
                          />
                        </TableCell>
                      ) : (
                        <TableCell className="px-3 py-2.5">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="—"
                            value={row.proposedCFPercentile}
                            onChange={(e) =>
                              setSpecialtyOverrides((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, proposedCFPercentile: e.target.value } : r))
                              )
                            }
                            disabled={isRunning}
                            className="h-9 w-full"
                          />
                        </TableCell>
                      )}
                      <TableCell className="px-3 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          placeholder="—"
                          value={row.psqPercent}
                          onChange={(e) =>
                            setSpecialtyOverrides((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, psqPercent: e.target.value } : r))
                            )
                          }
                          disabled={isRunning}
                          className="h-9 w-full"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setSpecialtyOverrides((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={isRunning}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </div>

          {/* By provider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">By provider</h4>
              <Button
                variant="outline"
                size="sm"
                disabled={isRunning || providersToRun.length === 0}
                onClick={() =>
                  setProviderOverrides((prev) => [
                    ...prev,
                    { providerIds: [], proposedCFPercentile: '', overrideCF: '', psqPercent: '' },
                  ])
                }
              >
                <Plus className="size-4 mr-2" />
                Add by provider
              </Button>
            </div>
            {providerOverrides.length === 0 ? (
              <p className="text-muted-foreground text-sm py-2">No provider overrides.</p>
            ) : (
              <div className="w-full overflow-auto rounded-md border border-border">
              <Table className="w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                  <TableRow>
                    <TableHead className="min-w-[160px] px-3 py-2.5">Providers</TableHead>
                    {baseUsesOverrideCF ? (
                      <TableHead className="w-[100px] px-3 py-2.5">Target CF ($)</TableHead>
                    ) : (
                      <TableHead className="w-[90px] px-3 py-2.5">CF %ile</TableHead>
                    )}
                    <TableHead className="w-[80px] px-3 py-2.5">PSQ %</TableHead>
                    <TableHead className="w-[60px] px-3 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerOverrides.map((row, idx) => (
                    <TableRow key={`prov-${idx}`} className={cn(idx % 2 === 1 && 'bg-muted/30')}>
                      <TableCell className="px-3 py-2.5">
                        <DropdownMenu
                          open={openProviderOverrideRow === idx}
                          onOpenChange={(open) => {
                            if (open) {
                              setOpenProviderOverrideRow(idx)
                              setProviderOverrideSearch('')
                              setTimeout(() => providerOverrideSearchRef.current?.focus(), 0)
                            } else {
                              setOpenProviderOverrideRow(null)
                              setProviderOverrideSearch('')
                            }
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="h-9 w-full justify-between font-normal"
                              disabled={isRunning}
                            >
                              <span className="truncate">
                                {row.providerIds.length === 0
                                  ? 'Select providers…'
                                  : row.providerIds.length === 1
                                    ? (providersToRun.find((p) => (p.providerId ?? p.providerName ?? '').toString() === row.providerIds[0])?.providerName ?? row.providerIds[0])
                                    : `${row.providerIds.length} provider(s)`}
                              </span>
                              <ChevronDown className="size-4 shrink-0 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden flex flex-col p-0"
                            align="start"
                            onCloseAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className="flex items-center gap-2 border-b px-2 py-1.5">
                              <Search className="size-4 shrink-0 text-muted-foreground" />
                              <Input
                                ref={openProviderOverrideRow === idx ? providerOverrideSearchRef : undefined}
                                placeholder="Search by name or specialty…"
                                value={openProviderOverrideRow === idx ? providerOverrideSearch : ''}
                                onChange={(e) => setProviderOverrideSearch(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                              />
                            </div>
                            <div className="max-h-[260px] overflow-y-auto p-1">
                              <DropdownMenuLabel>Providers</DropdownMenuLabel>
                              {filteredProviderOverrideOptions.length === 0 ? (
                                <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matching providers</p>
                              ) : (
                                filteredProviderOverrideOptions.map((p) => {
                                  const id = (p.providerId ?? p.providerName ?? '').toString()
                                  const name = (p.providerName ?? id).toString()
                                  const spec = (p.specialty ?? '').trim()
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={id}
                                      checked={row.providerIds.includes(id)}
                                      onCheckedChange={(checked) => {
                                        setProviderOverrides((prev) =>
                                          prev.map((r, i) =>
                                            i === idx
                                              ? {
                                                  ...r,
                                                  providerIds: checked ? [...r.providerIds, id] : r.providerIds.filter((x) => x !== id),
                                                }
                                              : r
                                          )
                                        )
                                      }}
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      {name}
                                      {spec ? ` · ${spec}` : ''}
                                    </DropdownMenuCheckboxItem>
                                  )
                                })
                              )}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      {baseUsesOverrideCF ? (
                        <TableCell className="px-3 py-2.5">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="—"
                            value={row.overrideCF}
                            onChange={(e) =>
                              setProviderOverrides((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, overrideCF: e.target.value } : r))
                              )
                            }
                            disabled={isRunning}
                            className="h-9 w-full"
                          />
                        </TableCell>
                      ) : (
                        <TableCell className="px-3 py-2.5">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="—"
                            value={row.proposedCFPercentile}
                            onChange={(e) =>
                              setProviderOverrides((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, proposedCFPercentile: e.target.value } : r))
                              )
                            }
                            disabled={isRunning}
                            className="h-9 w-full"
                          />
                        </TableCell>
                      )}
                      <TableCell className="px-3 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          placeholder="—"
                          value={row.psqPercent}
                          onChange={(e) =>
                            setProviderOverrides((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, psqPercent: e.target.value } : r))
                            )
                          }
                          disabled={isRunning}
                          className="h-9 w-full"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setProviderOverrides((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={isRunning}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {(!isBulk || bulkStep === 3) && (
      <Card id="batch-run" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isBulk && bulkStep === 3 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
              <span className="tabular-nums">
                {providersToRun.length} provider{providersToRun.length !== 1 ? 's' : ''} × 1 scenario
                {overrideCount > 0 && ` · ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`}
              </span>
            </div>
          )}
          {!isBulk && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
              <span className="tabular-nums">
                {providersToRun.length} provider{providersToRun.length !== 1 ? 's' : ''} × 1 scenario
                {overrideCount > 0 && ` · ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`}
              </span>
            </div>
          )}
          {error && (
            <WarningBanner message={error} tone="error" />
          )}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {progress.processed} / {total} rows
                </span>
                <span>{Math.round(progress.elapsedMs / 1000)}s</span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-muted-foreground text-xs">Results open when done.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              onClick={runBatch}
              disabled={isRunning || providersToRun.length === 0 || marketRows.length === 0}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Run
                </>
              )}
            </Button>
          </div>
          {onSaveScenario && (
            <Dialog open={saveScenarioDialogOpen} onOpenChange={setSaveScenarioDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save scenario</DialogTitle>
                  <DialogDescription>
                    Save this batch scenario (base inputs and overrides) in this browser. Load it later from the Saved batch scenarios menu.
                    {appliedBatchScenarioConfig && (
                      <span className="mt-1 block text-foreground/80">
                        You have a scenario loaded — update it or save as a new one.
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 py-2">
                  <Label htmlFor="batch-scenario-name">Scenario name</Label>
                  <Input
                    id="batch-scenario-name"
                    value={saveScenarioName}
                    onChange={(e) => setSaveScenarioName(e.target.value)}
                    placeholder={appliedBatchScenarioConfig?.name ?? 'e.g. Pediatrics CF 50th'}
                    onKeyDown={(e) => e.key === 'Enter' && (document.getElementById('batch-scenario-save-btn') as HTMLButtonElement)?.click()}
                  />
                </div>
                <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                  <Button variant="outline" onClick={() => setSaveScenarioDialogOpen(false)}>
                    Cancel
                  </Button>
                  <div className="flex gap-2">
                    {appliedBatchScenarioConfig && (
                      <Button
                        variant="secondary"
                        disabled={!saveScenarioName.trim()}
                        onClick={() => {
                          const name = saveScenarioName.trim()
                          if (!name) return
                          onSaveScenario(
                            {
                              name,
                              scenarioInputs: { ...scenarioInputs },
                              overrides: batchOverrides,
                              selectedSpecialties: [],
                              selectedProviderIds: [],
                              runBaseScenarioOnly,
                            },
                            appliedBatchScenarioConfig.id
                          )
                          setSaveScenarioName('')
                          setSaveScenarioDialogOpen(false)
                        }}
                      >
                        Update current
                      </Button>
                    )}
                    <Button
                      id="batch-scenario-save-btn"
                      onClick={() => {
                        const name = saveScenarioName.trim()
                        if (!name) return
                        onSaveScenario({
                          name,
                          scenarioInputs: { ...scenarioInputs },
                          overrides: batchOverrides,
                          selectedSpecialties: [],
                          selectedProviderIds: [],
                          runBaseScenarioOnly,
                        })
                        setSaveScenarioName('')
                        setSaveScenarioDialogOpen(false)
                      }}
                      disabled={!saveScenarioName.trim()}
                    >
                      {appliedBatchScenarioConfig ? 'Save as new' : 'Save'}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
      )}

    </div>
  )
}
