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
  DropdownMenuSeparator,
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
import { Play, Loader2, AlertCircle, Users, Target, Plus, Trash2, Sliders, ChevronDown, ChevronRight, Link2, Layers, Check, Search, Save, ArrowLeft, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BatchScenarioInline } from '@/components/batch/batch-scenario-inline'
import { ScenarioControls } from '@/components/scenario-controls'
import { Input } from '@/components/ui/input'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { BatchOverrides, SavedBatchScenarioConfig, SynonymMap } from '@/types/batch'
import type { BatchWorkerRunPayload, BatchWorkerOutMessage } from '@/workers/batch-worker'

interface BatchScenarioStepProps {
  providerRows: ProviderRow[]
  marketRows: import('@/types/market').MarketRow[]
  scenarioInputs: ScenarioInputs
  setScenarioInputs: (inputs: Partial<ScenarioInputs>) => void
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  onRunComplete: (results: import('@/types/batch').BatchResults, scenarioSnapshot?: import('@/types/batch').BatchScenarioSnapshot) => void
  /** When provided, show a link to edit synonyms on the Upload step. */
  onNavigateToUpload?: () => void
  /** When provided, Save scenario button is shown and this is called with current config. */
  onSaveScenario?: (config: Omit<SavedBatchScenarioConfig, 'id' | 'createdAt'>) => void
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
}

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
}: BatchScenarioStepProps) {
  const isBulk = mode === 'bulk'
  const isDetailed = mode === 'detailed'
  const isCardView = isBulk || isDetailed
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!appliedBatchScenarioConfig || !onBatchScenarioConfigApplied) return
    const c = appliedBatchScenarioConfig
    const bySpec = c.overrides?.bySpecialty ?? {}
    const byProv = c.overrides?.byProviderId ?? {}
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
    setSelectedSpecialties(c.selectedSpecialties ?? [])
    setSelectedProviderIds(c.selectedProviderIds ?? [])
    setRunBaseScenarioOnly(c.runBaseScenarioOnly ?? true)
    onBatchScenarioConfigApplied()
  }, [appliedBatchScenarioConfig, onBatchScenarioConfigApplied])
  const [saveScenarioDialogOpen, setSaveScenarioDialogOpen] = useState(false)
  const [saveScenarioName, setSaveScenarioName] = useState('')
  /** When true, run only the base scenario (controls at top). When false, run base + all from scenario library. */
  const [runBaseScenarioOnly, setRunBaseScenarioOnly] = useState(true)
  const [progress, setProgress] = useState({ processed: 0, total: 1, elapsedMs: 0 })
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const providerSpecialties = useMemo(() => {
    const set = new Set(providerRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [providerRows])

  /** Empty = all specialties. */
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  /** Empty = all providers (after specialty filter). */
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([])
  /** Search filter for Run for > Specialty dropdown. */
  const [specialtySearch, setSpecialtySearch] = useState('')
  /** Search filter for Run for > Provider dropdown. */
  const [providerSearch, setProviderSearch] = useState('')
  const specialtySearchInputRef = useRef<HTMLInputElement>(null)
  const providerSearchInputRef = useRef<HTMLInputElement>(null)
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

  const providersAfterSpecialtyFilter = useMemo(() => {
    if (selectedSpecialties.length === 0) return providerRows
    const set = new Set(selectedSpecialties)
    return providerRows.filter((p) => set.has((p.specialty ?? '').trim()))
  }, [providerRows, selectedSpecialties])

  const providersToRun = useMemo(() => {
    if (selectedProviderIds.length === 0) return providersAfterSpecialtyFilter
    const set = new Set(selectedProviderIds)
    return providersAfterSpecialtyFilter.filter((p) =>
      set.has((p.providerId ?? p.providerName ?? '').toString())
    )
  }, [providersAfterSpecialtyFilter, selectedProviderIds])

  /** Filtered specialties for Run for dropdown (searchable). */
  const filteredSpecialtiesForRun = useMemo(() => {
    const q = specialtySearch.trim().toLowerCase()
    if (!q) return providerSpecialties
    return providerSpecialties.filter((s) => s.toLowerCase().includes(q))
  }, [providerSpecialties, specialtySearch])

  /** Filtered providers for Run for dropdown (searchable by name or specialty). */
  const filteredProvidersForRun = useMemo(() => {
    const q = providerSearch.trim().toLowerCase()
    if (!q) return providersAfterSpecialtyFilter
    return providersAfterSpecialtyFilter.filter((p) => {
      const name = (p.providerName ?? p.providerId ?? '').toString().toLowerCase()
      const spec = (p.specialty ?? '').toLowerCase()
      return name.includes(q) || spec.includes(q)
    })
  }, [providersAfterSpecialtyFilter, providerSearch])

  /** For Overrides > By specialty: options when a row dropdown is open, filtered by search. */
  const filteredSpecialtyOverrideOptions = useMemo(() => {
    const q = specialtyOverrideSearch.trim().toLowerCase()
    if (!q) return providerSpecialties
    return providerSpecialties.filter((s) => s.toLowerCase().includes(q))
  }, [providerSpecialties, specialtyOverrideSearch])

  /** For Overrides > By provider: options when a row dropdown is open, filtered by search. */
  const filteredProviderOverrideOptions = useMemo(() => {
    const q = providerOverrideSearch.trim().toLowerCase()
    if (!q) return providersToRun
    return providersToRun.filter((p) => {
      const name = (p.providerName ?? p.providerId ?? '').toString().toLowerCase()
      const spec = (p.specialty ?? '').toLowerCase()
      return name.includes(q) || spec.includes(q)
    })
  }, [providersToRun, providerOverrideSearch])

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
      setError('No providers match the selected specialties and/or providers. Clear filters or change selection.')
      return
    }
    setError(null)
    setIsRunning(true)
    setProgress({ processed: 0, total: providersToRun.length, elapsedMs: 0 })

    const scenarios = runBaseScenarioOnly
      ? [{ id: 'current', name: 'Current', scenarioInputs: { ...scenarioInputs } }]
      : [
          { id: 'current', name: 'Current', scenarioInputs: { ...scenarioInputs } },
          ...savedScenarios.map((s) => ({
            id: s.id,
            name: s.name,
            scenarioInputs: s.scenarioInputs,
          })),
        ]
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
        const snapshot = { scenarios }
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
    providersToRun,
    marketRows,
    scenarioInputs,
    savedScenarios,
    runBaseScenarioOnly,
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

  const [activeStep, setActiveStep] = useState<'scenario' | 'overrides' | 'run'>('scenario')

  const scrollToSection = (id: 'batch-scenario' | 'batch-overrides' | 'batch-run') => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (id === 'batch-scenario') setActiveStep('scenario')
    else if (id === 'batch-overrides') setActiveStep('overrides')
    else if (id === 'batch-run') setActiveStep('run')
  }

  const scenarioComplete = true
  const overridesComplete = overrideCount > 0
  const synonymCount = Object.keys(batchSynonymMap).length

  type BatchStepId = 'batch-scenario' | 'batch-overrides' | 'batch-run'
  const steps: {
    id: 'scenario' | 'overrides' | 'run'
    num: number
    label: string
    icon: React.ReactNode
    sectionId: BatchStepId
    complete: boolean
    optional?: boolean
  }[] = [
    { id: 'scenario', num: 1, label: 'Scenario', icon: <Sliders className="size-4" />, sectionId: 'batch-scenario', complete: scenarioComplete },
    { id: 'overrides', num: 2, label: `Overrides${overrideCount > 0 ? ` (${overrideCount})` : ''}`, icon: <Layers className="size-4" />, sectionId: 'batch-overrides', complete: overridesComplete, optional: true },
    { id: 'run', num: 3, label: 'Run', icon: <Play className="size-4" />, sectionId: 'batch-run', complete: false },
  ]

  return (
    <div className="space-y-6">
      {isCardView && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {onBack && (
              <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2">
                <ArrowLeft className="size-4" />
                Back
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
                                  {new Date(config.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
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
      )}
      {!isCardView && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"
          aria-label="Batch steps"
        >
          {steps.map((step) => {
            const isActive = activeStep === step.id
            const isComplete = 'complete' in step && step.complete
            const isOptional = 'optional' in step && step.optional && !step.complete
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => scrollToSection(step.sectionId)}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                  'border-transparent',
                  isActive
                    ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-primary/20'
                    : 'bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    isActive && 'border-2 border-primary bg-primary text-primary-foreground',
                    isComplete && !isActive && 'border border-primary/50 bg-primary/10 text-primary',
                    !isActive && !isComplete && 'border border-border bg-background/80'
                  )}
                >
                  {isComplete && !isActive ? <Check className="size-4" /> : step.num}
                </span>
                <span className="hidden truncate sm:inline">
                  {step.label}
                  {isOptional && <span className="text-muted-foreground font-normal"> (optional)</span>}
                </span>
                {step.icon}
              </button>
            )
          })}
        </nav>
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
                                {new Date(config.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
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
              <span className="hidden sm:inline">{synonymCount} specialty synonym{synonymCount !== 1 ? 's' : ''} mapped — Edit in Upload step</span>
            </button>
          )}
          {onNavigateToUpload && synonymCount === 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={onNavigateToUpload}
              title="Edit synonyms (Upload step)"
              aria-label="Edit synonyms (Upload step)"
            >
              <Link2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      )}

      {!isDetailed && (
      <div id="batch-scenario" className="scroll-mt-6 space-y-6">
        <details open className="group rounded-lg border border-border/60 bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
            Base scenario
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
          </div>
        </details>
      </div>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Specialties</TableHead>
                    {baseUsesOverrideCF ? (
                      <TableHead className="w-[100px]">Target CF ($)</TableHead>
                    ) : (
                      <TableHead className="w-[90px]">CF %ile</TableHead>
                    )}
                    <TableHead className="w-[80px]">PSQ %</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specialtyOverrides.map((row, idx) => (
                    <TableRow key={`spec-${idx}`}>
                      <TableCell>
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
                                    : `${row.specialties.length} specialties`}
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
                                placeholder="Search…"
                                value={openSpecialtyOverrideRow === idx ? specialtyOverrideSearch : ''}
                                onChange={(e) => setSpecialtyOverrideSearch(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                              />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto p-1">
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
                        <TableCell>
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
                        <TableCell>
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
                      <TableCell>
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
                      <TableCell>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Providers</TableHead>
                    {baseUsesOverrideCF ? (
                      <TableHead className="w-[100px]">Target CF ($)</TableHead>
                    ) : (
                      <TableHead className="w-[90px]">CF %ile</TableHead>
                    )}
                    <TableHead className="w-[80px]">PSQ %</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerOverrides.map((row, idx) => (
                    <TableRow key={`prov-${idx}`}>
                      <TableCell>
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
                                    : `${row.providerIds.length} providers`}
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
                        <TableCell>
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
                        <TableCell>
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
                      <TableCell>
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
                      <TableCell>
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
            )}
          </div>
        </CardContent>
      </Card>
      )}

      <Card id="batch-run" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scenarios: base only vs base + library */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Scenarios to run">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="batch-run-mode"
                  checked={runBaseScenarioOnly}
                  onChange={() => setRunBaseScenarioOnly(true)}
                  disabled={isRunning}
                  className="size-4"
                />
                <span className="text-sm">Base scenario only</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="batch-run-mode"
                  checked={!runBaseScenarioOnly}
                  onChange={() => setRunBaseScenarioOnly(false)}
                  disabled={isRunning}
                  className="size-4"
                />
                <span className="text-sm">
                  Base + scenario library{savedScenarios.length > 0 ? ` (${savedScenarios.length} saved)` : ''}
                </span>
              </label>
            </div>
            {!runBaseScenarioOnly && savedScenarios.length > 0 && onClearSavedScenarios && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-destructive -ml-1"
                onClick={onClearSavedScenarios}
                disabled={isRunning}
              >
                Clear library
              </Button>
            )}
          </div>
          {/* Who to run: scope (all vs selected specialties/providers) */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="size-4" />
                  Specialty
                </Label>
                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open) setTimeout(() => specialtySearchInputRef.current?.focus(), 0)
                    else setSpecialtySearch('')
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="min-h-9 w-full justify-between font-normal"
                      disabled={isRunning || providerSpecialties.length === 0}
                    >
                      <span className="truncate">
                        {selectedSpecialties.length === 0
                          ? 'All specialties'
                          : `${selectedSpecialties.length} specialty${selectedSpecialties.length !== 1 ? 'ies' : ''} selected`}
                      </span>
                      <ChevronDown className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden flex flex-col p-0" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="flex items-center gap-2 border-b px-2 py-1.5">
                      <Search className="size-4 shrink-0 text-muted-foreground" />
                      <Input
                        ref={specialtySearchInputRef}
                        placeholder="Search specialties…"
                        value={specialtySearch}
                        onChange={(e) => setSpecialtySearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[260px] overflow-y-auto p-1">
                      <DropdownMenuCheckboxItem
                        checked={selectedSpecialties.length === 0}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedSpecialties([])
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        All specialties
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {filteredSpecialtiesForRun.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matching specialties</p>
                      ) : (
                        filteredSpecialtiesForRun.map((s) => (
                          <DropdownMenuCheckboxItem
                            key={s}
                            checked={selectedSpecialties.length > 0 && selectedSpecialties.includes(s)}
                            onCheckedChange={(checked) => {
                              setSelectedSpecialties((prev) =>
                                checked ? [...prev, s] : prev.filter((x) => x !== s)
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
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  Provider
                </Label>
                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open) setTimeout(() => providerSearchInputRef.current?.focus(), 0)
                    else setProviderSearch('')
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="min-h-9 w-full justify-between font-normal"
                      disabled={isRunning || providersAfterSpecialtyFilter.length === 0}
                    >
                      <span className="truncate">
                        {selectedProviderIds.length === 0
                          ? 'All providers'
                          : `${selectedProviderIds.length} provider${selectedProviderIds.length !== 1 ? 's' : ''} selected`}
                      </span>
                      <ChevronDown className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] overflow-hidden flex flex-col p-0" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="flex items-center gap-2 border-b px-2 py-1.5">
                      <Search className="size-4 shrink-0 text-muted-foreground" />
                      <Input
                        ref={providerSearchInputRef}
                        placeholder="Search by name or specialty…"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[260px] overflow-y-auto p-1">
                      <DropdownMenuCheckboxItem
                        checked={selectedProviderIds.length === 0}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedProviderIds([])
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        All providers
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {filteredProvidersForRun.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matching providers</p>
                      ) : (
                        filteredProvidersForRun.map((p) => {
                          const id = (p.providerId ?? p.providerName ?? '').toString()
                          const name = (p.providerName ?? id) || id
                          const sub = (p.specialty ?? '').trim()
                          return (
                            <DropdownMenuCheckboxItem
                              key={id}
                              checked={selectedProviderIds.includes(id)}
                              onCheckedChange={(checked) => {
                                setSelectedProviderIds((prev) =>
                                  checked ? [...prev, id] : prev.filter((x) => x !== id)
                                )
                              }}
                              onSelect={(e) => e.preventDefault()}
                            >
                              {name}
                              {sub ? ` · ${sub}` : ''}
                            </DropdownMenuCheckboxItem>
                          )
                        })
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedSpecialties.length === 0 && selectedProviderIds.length === 0
                ? 'All providers'
                : `${providersToRun.length} provider${providersToRun.length !== 1 ? 's' : ''} selected`}
            </p>
          </div>
          {/* One-line summary */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
            <span className="tabular-nums">
              {providersToRun.length} provider{providersToRun.length !== 1 ? 's' : ''} × {runBaseScenarioOnly ? '1' : 1 + savedScenarios.length} scenario{runBaseScenarioOnly || savedScenarios.length === 0 ? '' : 's'}
              {overrideCount > 0 && ` · ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`}
            </span>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <Button
                onClick={runBatch}
                disabled={isRunning || providersToRun.length === 0 || marketRows.length === 0}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-2" />
                    Run
                  </>
                )}
              </Button>
            </div>
          </div>
          {onSaveScenario && (
            <Dialog open={saveScenarioDialogOpen} onOpenChange={setSaveScenarioDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save scenario</DialogTitle>
                  <DialogDescription>
                    Save this batch scenario (base inputs, overrides, run-for selection) in this browser. Load it later from the Saved batch scenarios menu.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 py-2">
                  <Label htmlFor="batch-scenario-name">Scenario name</Label>
                  <Input
                    id="batch-scenario-name"
                    value={saveScenarioName}
                    onChange={(e) => setSaveScenarioName(e.target.value)}
                    placeholder="e.g. Pediatrics CF 50th"
                    onKeyDown={(e) => e.key === 'Enter' && (document.getElementById('batch-scenario-save-btn') as HTMLButtonElement)?.click()}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveScenarioDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    id="batch-scenario-save-btn"
                    onClick={() => {
                      const name = saveScenarioName.trim()
                      if (!name) return
                      onSaveScenario({
                        name,
                        scenarioInputs: { ...scenarioInputs },
                        overrides: batchOverrides,
                        selectedSpecialties: [...selectedSpecialties],
                        selectedProviderIds: [...selectedProviderIds],
                        runBaseScenarioOnly,
                      })
                      setSaveScenarioName('')
                      setSaveScenarioDialogOpen(false)
                    }}
                    disabled={!saveScenarioName.trim()}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
