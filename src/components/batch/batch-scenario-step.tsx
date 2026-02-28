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
import { Play, Loader2, Plus, Trash2, Sliders, ChevronDown, ChevronRight, ChevronLeft, LayoutGrid, Check, Search, Save, ArrowLeft, FolderOpen, Info, RotateCcw } from 'lucide-react'
import { formatDate } from '@/utils/format'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { BatchScenarioInline } from '@/components/batch/batch-scenario-inline'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'
import type { BatchOverrides, BatchResults, BatchScenarioSnapshot, SavedBatchRun, SavedBatchScenarioConfig, SynonymMap } from '@/types/batch'
import type { BatchWorkerRunPayload, BatchWorkerOutMessage } from '@/workers/batch-worker'
import type { ThresholdMethod } from '@/types/scenario'
import { cn } from '@/lib/utils'

/** CF override: by target percentile or fixed dollar. */
type CFOverrideMode = 'percentile' | 'dollar'
/** PSQ override: by percent of basis or fixed dollar. */
type PSQOverrideMode = 'percent' | 'dollar'

/** One row in By specialty overrides: optional advanced fields (empty = use base). */
interface SpecialtyOverrideRow {
  specialties: string[]
  cfMode: CFOverrideMode
  proposedCFPercentile: string
  overrideCF: string
  psqMode: PSQOverrideMode
  psqPercent: string
  psqDollars: string
  psqBasis?: string
  thresholdMethod?: string
  annualThreshold?: string
  wrvuPercentile?: string
}
/** One row in By provider overrides. */
interface ProviderOverrideRow {
  providerIds: string[]
  cfMode: CFOverrideMode
  proposedCFPercentile: string
  overrideCF: string
  psqMode: PSQOverrideMode
  psqPercent: string
  psqDollars: string
  psqBasis?: string
  thresholdMethod?: string
  annualThreshold?: string
  wrvuPercentile?: string
}

const DEFAULT_SPECIALTY_OVERRIDE_ROW: SpecialtyOverrideRow = {
  specialties: [],
  cfMode: 'percentile',
  proposedCFPercentile: '',
  overrideCF: '',
  psqMode: 'percent',
  psqPercent: '',
  psqDollars: '',
  psqBasis: '',
  thresholdMethod: '',
  annualThreshold: '',
  wrvuPercentile: '',
}
const DEFAULT_PROVIDER_OVERRIDE_ROW: ProviderOverrideRow = {
  providerIds: [],
  cfMode: 'percentile',
  proposedCFPercentile: '',
  overrideCF: '',
  psqMode: 'percent',
  psqPercent: '',
  psqDollars: '',
  psqBasis: '',
  thresholdMethod: '',
  annualThreshold: '',
  wrvuPercentile: '',
}

/** Step labels for bulk (Scenario Studio bulk flow). */
const CONFIG_STEPS_BULK = [
  { id: 1 as const, label: 'Target scope' },
  { id: 2 as const, label: 'Scope & guardrails' },
  { id: 3 as const, label: 'Run' },
] as const

/** Step labels for full (Scenario Studio full flow). */
const CONFIG_STEPS_FULL = [
  { id: 1 as const, label: 'Base scenario' },
  { id: 2 as const, label: 'Overrides' },
  { id: 3 as const, label: 'Run' },
] as const

function SectionHeaderWithTooltip({
  title,
  tooltip,
  variant = 'subsection',
  className,
}: {
  title: string
  tooltip: string
  variant?: 'section' | 'subsection'
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <h3 className={cn(
        'font-medium',
        variant === 'section' ? 'text-base' : 'text-sm'
      )}>{title}</h3>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="More information"
          >
            <Info className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[320px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

interface BatchScenarioStepProps {
  providerRows: ProviderRow[]
  marketRows: import('@/types/market').MarketRow[]
  scenarioInputs: ScenarioInputs
  setScenarioInputs: (inputs: Partial<ScenarioInputs>) => void
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  /** When true, use fuzzy specialty match when no exact/synonym match (batch result status 'Fuzzy'). */
  allowFuzzyMatchSpecialty?: boolean
  setAllowFuzzyMatchSpecialty?: (value: boolean) => void
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
  allowFuzzyMatchSpecialty = false,
  setAllowFuzzyMatchSpecialty,
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
  void onNavigateToUpload
  void lastResults
  void lastScenarioSnapshot
  void savedBatchRuns
  void onSaveRun
  void onLoadRun
  void onDeleteRun
  const isBulk = mode === 'bulk'
  const isDetailed = mode === 'detailed'
  const isFull = mode === 'full'
  const isCardView = isBulk || isDetailed
  const [isRunning, setIsRunning] = useState(false)
  const [saveScenarioDialogOpen, setSaveScenarioDialogOpen] = useState(false)
  const [saveScenarioName, setSaveScenarioName] = useState('')
  useEffect(() => {
    if (saveScenarioDialogOpen && appliedBatchScenarioConfig?.name)
      setSaveScenarioName(appliedBatchScenarioConfig.name)
    if (!saveScenarioDialogOpen) setSaveScenarioName('')
  }, [saveScenarioDialogOpen, appliedBatchScenarioConfig?.name])
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
  const [specialtyOverrides, setSpecialtyOverrides] = useState<SpecialtyOverrideRow[]>([])
  /** Override rows: each row can apply to multiple providers. */
  const [providerOverrides, setProviderOverrides] = useState<ProviderOverrideRow[]>([])
  /** Which specialty override row has Advanced expanded (null = none). */
  const [, setExpandedSpecialtyRow] = useState<number | null>(null)
  /** Which provider override row has Advanced expanded (null = none). */
  const [, setExpandedProviderRow] = useState<number | null>(null)

  useEffect(() => {
    if (!appliedBatchScenarioConfig || !onBatchScenarioConfigApplied) return
    const c = appliedBatchScenarioConfig
    const bySpec = c.overrides?.bySpecialty ?? {}
    const byProv = c.overrides?.byProviderId ?? {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing applied config from parent into local state
    setSpecialtyOverrides(
      Object.entries(bySpec).map(([spec, inputs]) => ({
        specialties: [spec],
        cfMode: inputs.overrideCF != null && String(inputs.overrideCF).trim() !== '' ? 'dollar' : 'percentile',
        proposedCFPercentile: inputs.proposedCFPercentile != null ? String(inputs.proposedCFPercentile) : '',
        overrideCF: inputs.overrideCF != null ? String(inputs.overrideCF) : '',
        psqMode: inputs.psqDollars != null && String(inputs.psqDollars).trim() !== '' ? 'dollar' : 'percent',
        psqPercent: inputs.psqPercent != null ? String(inputs.psqPercent) : '',
        psqDollars: inputs.psqDollars != null ? String(inputs.psqDollars) : '',
        psqBasis: inputs.psqBasis ?? '',
        thresholdMethod: inputs.thresholdMethod ?? '',
        annualThreshold: inputs.annualThreshold != null ? String(inputs.annualThreshold) : '',
        wrvuPercentile: inputs.wrvuPercentile != null ? String(inputs.wrvuPercentile) : '',
      }))
    )
    setProviderOverrides(
      Object.entries(byProv).map(([id, inputs]) => ({
        providerIds: [id],
        cfMode: inputs.overrideCF != null && String(inputs.overrideCF).trim() !== '' ? 'dollar' : 'percentile',
        proposedCFPercentile: inputs.proposedCFPercentile != null ? String(inputs.proposedCFPercentile) : '',
        overrideCF: inputs.overrideCF != null ? String(inputs.overrideCF) : '',
        psqMode: inputs.psqDollars != null && String(inputs.psqDollars).trim() !== '' ? 'dollar' : 'percent',
        psqPercent: inputs.psqPercent != null ? String(inputs.psqPercent) : '',
        psqDollars: inputs.psqDollars != null ? String(inputs.psqDollars) : '',
        psqBasis: inputs.psqBasis ?? '',
        thresholdMethod: inputs.thresholdMethod ?? '',
        annualThreshold: inputs.annualThreshold != null ? String(inputs.annualThreshold) : '',
        wrvuPercentile: inputs.wrvuPercentile != null ? String(inputs.wrvuPercentile) : '',
      }))
    )
    onBatchScenarioConfigApplied()
  }, [appliedBatchScenarioConfig, onBatchScenarioConfigApplied])

  const providerSpecialties = useMemo(() => {
    const set = new Set(providerRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [providerRows])

  /** Bulk step-through: 1 = Target scope, 2 = Scope & guardrails, 3 = Run */
  const [bulkStep, setBulkStep] = useState<1 | 2 | 3>(1)
  /** Full mode step-through: 1 = Base scenario, 2 = Overrides, 3 = Run */
  const [fullStep, setFullStep] = useState<1 | 2 | 3>(1)
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

  /** Build partial ScenarioInputs from an override row (CF, PSQ, and advanced fields). */
  const rowToPartial = useCallback((row: SpecialtyOverrideRow | ProviderOverrideRow): Partial<ScenarioInputs> => {
    const partial: Partial<ScenarioInputs> = {}
    const pct = row.proposedCFPercentile.trim() === '' ? undefined : Number(row.proposedCFPercentile)
    const cf = row.overrideCF.trim() === '' ? undefined : Number(row.overrideCF)
    const psq = row.psqPercent.trim() === '' ? undefined : Number(row.psqPercent)
    const psq$ = row.psqDollars?.trim() === '' ? undefined : Number(row.psqDollars)
    if (row.cfMode === 'dollar' && cf !== undefined && !Number.isNaN(cf)) {
      partial.overrideCF = cf
      partial.cfSource = 'override'
    } else if (pct !== undefined && !Number.isNaN(pct)) {
      partial.proposedCFPercentile = pct
      partial.cfSource = 'target_percentile'
    }
    const useBaseQualityPay = !row.psqBasis || row.psqBasis === '_base'
    if (!useBaseQualityPay) {
      if (row.psqMode === 'dollar' && psq$ !== undefined && !Number.isNaN(psq$)) partial.psqDollars = psq$
      else if (psq !== undefined && !Number.isNaN(psq)) partial.psqPercent = psq
    }
    if (row.psqBasis === 'base_salary' || row.psqBasis === 'total_guaranteed' || row.psqBasis === 'total_pay') partial.psqBasis = row.psqBasis
    if (row.thresholdMethod === 'derived' || row.thresholdMethod === 'annual' || row.thresholdMethod === 'wrvu_percentile') partial.thresholdMethod = row.thresholdMethod as ThresholdMethod
    const ann = row.annualThreshold?.trim() === '' ? undefined : Number(row.annualThreshold)
    if (ann !== undefined && !Number.isNaN(ann)) partial.annualThreshold = ann
    const wrvu = row.wrvuPercentile?.trim() === '' ? undefined : Number(row.wrvuPercentile)
    if (wrvu !== undefined && !Number.isNaN(wrvu)) partial.wrvuPercentile = wrvu
    return partial
  }, [])

  const batchOverrides = useMemo((): BatchOverrides | undefined => {
    const bySpecialty: Record<string, Partial<ScenarioInputs>> = {}
    for (const row of specialtyOverrides) {
      const partial = rowToPartial(row)
      if (Object.keys(partial).length === 0) continue
      for (const s of row.specialties) {
        if (!s.trim()) continue
        bySpecialty[s] = { ...partial }
      }
    }
    const byProviderId: Record<string, Partial<ScenarioInputs>> = {}
    for (const row of providerOverrides) {
      const partial = rowToPartial(row)
      if (Object.keys(partial).length === 0) continue
      for (const id of row.providerIds) {
        if (!id.trim()) continue
        byProviderId[id] = { ...partial }
      }
    }
    if (Object.keys(bySpecialty).length === 0 && Object.keys(byProviderId).length === 0) return undefined
    return { bySpecialty: Object.keys(bySpecialty).length ? bySpecialty : undefined, byProviderId: Object.keys(byProviderId).length ? byProviderId : undefined }
  }, [specialtyOverrides, providerOverrides, rowToPartial])

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
      allowFuzzyMatch: allowFuzzyMatchSpecialty,
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
    allowFuzzyMatchSpecialty,
    onRunComplete,
    providerRows.length,
  ])

  const total = Math.max(1, progress.total)
  const pct = Math.min(100, Math.round((100 * progress.processed) / total))
  const overrideCount = specialtyOverrides.reduce((n, r) => n + r.specialties.length, 0) + providerOverrides.reduce((n, r) => n + r.providerIds.length, 0)

  const isWizardView = isBulk || isFull
  const wizardSteps = isBulk ? CONFIG_STEPS_BULK : CONFIG_STEPS_FULL
  const wizardStep = isBulk ? bulkStep : fullStep
  const setWizardStep = isBulk ? setBulkStep : setFullStep

  const wizardStepPillsNav = isWizardView && (
    <TooltipProvider delayDuration={200}>
      <nav
        className="flex items-center justify-end gap-0.5 rounded-md p-0.5 bg-muted/50 w-fit ml-auto"
        aria-label="Scenario Studio steps"
        onClick={(e) => e.stopPropagation()}
      >
        {wizardSteps.map((s) => {
          const isActive = wizardStep === s.id
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setWizardStep(s.id)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`${s.label}${isActive ? ' (current)' : ''}`}
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {s.id}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {s.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )

  return (
    <div className="space-y-6">
      {isCardView && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <SectionTitleWithIcon
                icon={isBulk ? <LayoutGrid /> : <Sliders />}
              >
                {isBulk ? 'Scenario Studio' : 'Detailed scenario'}
              </SectionTitleWithIcon>
              <p className="text-muted-foreground text-sm mt-1">
                {isBulk ? 'Design and run scenarios — base inputs plus optional overrides by specialty or provider.' : 'Run with overrides only; base comes from step 1.'}
              </p>
            </div>
            {onBack && (
              <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2">
                <ArrowLeft className="size-4" />
                Back
              </Button>
            )}
            {isWizardView && wizardStep === 3 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setWizardStep(2)} className="gap-2">
                <ArrowLeft className="size-4" />
                Change requirements
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
                        No saved batch scenarios yet. Use &quot;Save scenario&quot; to save base inputs and overrides.
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
      )}
      {!isCardView && (
      <>
        <div>
          <SectionTitleWithIcon icon={<LayoutGrid className="size-5 text-muted-foreground" />}>
            {isFull ? 'Scenario Studio' : isBulk ? 'Scenario Studio' : 'Detailed scenario'}
          </SectionTitleWithIcon>
          <p className="text-muted-foreground text-sm mt-1">
            {isFull || isBulk ? 'Design and run scenarios — base inputs plus optional overrides by specialty or provider.' : 'Run with overrides only; base comes from step 1.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBack}
                className="gap-2"
              >
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
                          aria-label={`Saved scenarios (${savedBatchScenarioConfigs.length})`}
                        >
                          <FolderOpen className="size-4" />
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Saved scenarios ({savedBatchScenarioConfigs.length})
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
                    {savedBatchScenarioConfigs.length === 0 ? (
                      <DropdownMenuItem disabled className="text-muted-foreground">
                        No saved scenarios yet. Use Save scenario to save base inputs and overrides.
                      </DropdownMenuItem>
                    ) : (
                      [...savedBatchScenarioConfigs].reverse().map((config) => (
                        <DropdownMenuItem
                          key={config.id}
                          onSelect={(e) => {
                            e.preventDefault()
                            onLoadBatchScenarioConfig(config)
                          }}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{config.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onDeleteBatchScenarioConfig(config.id)
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${config.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setScenarioInputs({ ...DEFAULT_SCENARIO_INPUTS })
                      setSpecialtyOverrides([])
                      setProviderOverrides([])
                      setExpandedSpecialtyRow(null)
                      setExpandedProviderRow(null)
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Reset configuration"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Reset configuration</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </>
      )}

      {/* Single Card wizard (CF Optimizer parity): bulk and full mode */}
      {isWizardView && (
      <Card id="batch-scenario" className="scroll-mt-6 rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardContent className="space-y-6 pt-6 pb-6 px-6 sm:px-8">
          <TooltipProvider delayDuration={200}>
            {wizardStepPillsNav}

            {/* Step 1: Bulk = Target scope (two-panel). Full = Base scenario (two-panel). */}
            {wizardStep === 1 && (
              <div className="space-y-6 rounded-2xl border border-border/40 bg-muted/30 p-6">
                <div>
                  <SectionHeaderWithTooltip
                    variant="section"
                    title={isFull ? 'Base scenario' : 'Target scope'}
                    tooltip={isFull
                      ? 'Set base scenario inputs (CF, wRVU target, quality pay, threshold) for the batch. In step 2 you can add overrides by specialty or provider.'
                      : 'Set base scenario inputs (CF, wRVU target, quality pay, threshold) for the batch. Scope and guardrails are configured in the next step.'}
                    className="text-foreground/90"
                  />
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {isFull ? 'Set base inputs below. They apply to every provider in the run.' : 'Set base inputs first, then apply scope and guardrails.'}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background p-5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Base scenario
                  </Label>
                  <div className="mt-4">
                    <BatchScenarioInline
                      inputs={scenarioInputs}
                      onChange={setScenarioInputs}
                      disabled={isRunning}
                      variant="panel"
                    />
                  </div>
                  <div className="mt-5 pt-4 border-t border-border/40 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{providerRows.length}</span> provider(s) in upload
                    {isBulk ? ' — scope and exclusions apply in step 2.' : ' — overrides (step 2) can narrow who is run.'}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Bulk = Scope & guardrails. Full = Overrides. */}
            {wizardStep === 2 && isBulk && (
              <div className="space-y-6 rounded-2xl border border-border/40 bg-muted/30 p-6">
                <div>
                  <SectionHeaderWithTooltip
                    variant="section"
                    title="Scope & guardrails"
                    tooltip="Exclude providers below these thresholds so the run focuses on those with stable volume (same idea as the CF Optimizer). Leave defaults to include everyone."
                    className="text-primary/90"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Exclude providers below min FTE or min wRVU per 1.0 cFTE.
                  </p>
                </div>
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
                <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{providersToRun.length}</span> provider(s) in scope
                  {providerRows.length > 0 && providersToRun.length < providerRows.length && (
                    <span> ({providerRows.length - providersToRun.length} excluded by guardrails)</span>
                  )}
                </div>
              </div>
            )}

            {wizardStep === 2 && isFull && (
              <div className="space-y-6 rounded-2xl border border-border/40 bg-muted/30 p-6">
                <div>
                  <SectionHeaderWithTooltip
                    variant="section"
                    title="Overrides"
                    tooltip="Set different quality pay, percentiles, or conversion factor by specialty and/or by provider. Base scenario comes from step 1. Provider overrides take precedence over specialty overrides."
                    className="text-foreground/90"
                  />
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Optional. Add rows to apply different inputs to specific specialties or providers.
                  </p>
                </div>
                <div className="space-y-6">
                  {/* By specialty */}
                  <section className="rounded-xl border border-border/40 bg-background overflow-hidden shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/40 bg-muted/40">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">By specialty</h3>
                        {specialtyOverrides.length > 0 && (
                          <Badge variant="secondary" className="font-mono text-xs tabular-nums rounded-md">
                            {specialtyOverrides.length}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isRunning || providerSpecialties.length === 0}
                        onClick={() =>
                          setSpecialtyOverrides((prev) => [...prev, { ...DEFAULT_SPECIALTY_OVERRIDE_ROW }])
                        }
                        className="gap-1.5 rounded-lg border-border/50"
                      >
                        <Plus className="size-4" />
                        Add row
                      </Button>
                    </div>
                    <div className="p-5">
                      {specialtyOverrides.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-10 text-center">
                          <p className="text-sm text-muted-foreground">No overrides for specialties yet.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-5 gap-1.5 rounded-lg"
                            disabled={isRunning || providerSpecialties.length === 0}
                            onClick={() =>
                              setSpecialtyOverrides((prev) => [...prev, { ...DEFAULT_SPECIALTY_OVERRIDE_ROW }])
                            }
                          >
                            <Plus className="size-4" />
                            Add by specialty
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full overflow-auto rounded-xl border border-border/40 bg-background">
                          <Table className="w-full caption-bottom text-sm">
                            <TableHeader>
                              <TableRow className="border-border/40 hover:bg-transparent bg-muted/30">
                                <TableHead className="min-w-[180px] px-4 py-3 text-muted-foreground font-medium">Apply to</TableHead>
                                <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">CF</TableHead>
                                <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · basis</TableHead>
                                <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · amount</TableHead>
                                <TableHead className="min-w-[140px] px-4 py-3 text-muted-foreground font-medium">Threshold</TableHead>
                                <TableHead className="w-14 px-4 py-3" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {specialtyOverrides.map((row, idx) => (
                                <TableRow key={`spec-${idx}`} className="hover:bg-muted/30 transition-colors border-border/30">
                                  <TableCell className="px-4 py-3">
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
                                          className="h-9 w-full justify-between font-normal border-border/60"
                                          disabled={isRunning}
                                        >
                                          <span className="truncate">
                                            {row.specialties.length === 0
                                              ? 'Select specialties…'
                                              : row.specialties.length === 1
                                                ? row.specialties[0]
                                                : `${row.specialties.length} selected`}
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
                                  <TableCell className="px-4 py-3">
                                    <div className="space-y-1.5">
                                      <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                                      <Select
                                        value={row.cfMode}
                                        onValueChange={(v: CFOverrideMode) =>
                                          setSpecialtyOverrides((prev) =>
                                            prev.map((r, i) => (i === idx ? { ...r, cfMode: v } : r))
                                          )
                                        }
                                        disabled={isRunning}
                                      >
                                        <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                          <SelectValue placeholder="Select…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="percentile">CF %ile</SelectItem>
                                          <SelectItem value="dollar">CF ($)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={row.cfMode === 'percentile' ? 100 : undefined}
                                        step={row.cfMode === 'dollar' ? 0.01 : 1}
                                        placeholder={row.cfMode === 'percentile' ? '%ile' : '$'}
                                        value={row.cfMode === 'dollar' ? row.overrideCF : row.proposedCFPercentile}
                                        onChange={(e) =>
                                          setSpecialtyOverrides((prev) =>
                                            prev.map((r, i) =>
                                              i === idx
                                                ? {
                                                    ...r,
                                                    ...(row.cfMode === 'dollar'
                                                      ? { overrideCF: e.target.value }
                                                      : { proposedCFPercentile: e.target.value }),
                                                  }
                                                : r
                                            )
                                          )
                                        }
                                        disabled={isRunning}
                                        className="h-9 w-full border-border/60"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    <Select
                                      value={row.psqBasis || '_base'}
                                      onValueChange={(v) =>
                                        setSpecialtyOverrides((prev) =>
                                          prev.map((r, i) => (i === idx ? { ...r, psqBasis: v === '_base' ? '' : v } : r))
                                        )
                                      }
                                      disabled={isRunning}
                                    >
                                      <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                        <SelectValue placeholder="From base" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="_base">From base</SelectItem>
                                        <SelectItem value="base_salary">% of base salary</SelectItem>
                                        <SelectItem value="total_guaranteed">% of total guaranteed</SelectItem>
                                        <SelectItem value="total_pay">% of total pay (TCC)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    {(row.psqBasis === '_base' || !row.psqBasis) ? (
                                      <span className="text-muted-foreground text-sm">—</span>
                                    ) : (
                                    <div className="space-y-1.5">
                                      <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                                      <Select
                                        value={row.psqMode}
                                        onValueChange={(v: PSQOverrideMode) =>
                                          setSpecialtyOverrides((prev) =>
                                            prev.map((r, i) => (i === idx ? { ...r, psqMode: v } : r))
                                          )
                                        }
                                        disabled={isRunning}
                                      >
                                        <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                          <SelectValue placeholder="Select…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="percent">%</SelectItem>
                                          <SelectItem value="dollar">$</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={row.psqMode === 'percent' ? 100 : undefined}
                                        step={row.psqMode === 'dollar' ? 0.01 : 0.5}
                                        placeholder={row.psqMode === 'percent' ? '%' : '$'}
                                        value={row.psqMode === 'dollar' ? row.psqDollars : row.psqPercent}
                                        onChange={(e) =>
                                          setSpecialtyOverrides((prev) =>
                                            prev.map((r, i) =>
                                              i === idx
                                                ? {
                                                    ...r,
                                                    ...(row.psqMode === 'dollar'
                                                      ? { psqDollars: e.target.value }
                                                      : { psqPercent: e.target.value }),
                                                  }
                                                : r
                                            )
                                          )
                                        }
                                        disabled={isRunning}
                                        className="h-9 w-full border-border/60"
                                      />
                                    </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    <div className="space-y-1.5">
                                      <Select
                                        value={row.thresholdMethod || '_base'}
                                        onValueChange={(v) =>
                                          setSpecialtyOverrides((prev) =>
                                            prev.map((r, i) => (i === idx ? { ...r, thresholdMethod: v === '_base' ? '' : v } : r))
                                          )
                                        }
                                        disabled={isRunning}
                                      >
                                        <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                          <SelectValue placeholder="From base scenario" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="_base">From base scenario</SelectItem>
                                          <SelectItem value="derived">Clinical $ ÷ CF</SelectItem>
                                          <SelectItem value="annual">Annual threshold (enter wRVUs)</SelectItem>
                                          <SelectItem value="wrvu_percentile">wRVU percentile (from market)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {row.thresholdMethod === 'annual' && (
                                        <Input
                                          type="number"
                                          min={0}
                                          placeholder="wRVUs"
                                          value={row.annualThreshold ?? ''}
                                          onChange={(e) =>
                                            setSpecialtyOverrides((prev) =>
                                              prev.map((r, i) => (i === idx ? { ...r, annualThreshold: e.target.value } : r))
                                            )
                                          }
                                          disabled={isRunning}
                                          className="h-9 w-full border-border/60"
                                        />
                                      )}
                                      {row.thresholdMethod === 'wrvu_percentile' && (
                                        <Input
                                          type="number"
                                          min={0}
                                          max={100}
                                          placeholder="%ile"
                                          value={row.wrvuPercentile ?? ''}
                                          onChange={(e) =>
                                            setSpecialtyOverrides((prev) =>
                                              prev.map((r, i) => (i === idx ? { ...r, wrvuPercentile: e.target.value } : r))
                                            )
                                          }
                                          disabled={isRunning}
                                          className="h-9 w-full border-border/60"
                                        />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setSpecialtyOverrides((prev) => prev.filter((_, i) => i !== idx))}
                                      disabled={isRunning}
                                      aria-label="Remove row"
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
                  </section>

                  {/* By provider - full step 2: reuse same table block from current Overrides card */}
                  <section className="rounded-xl border border-border/40 bg-background overflow-hidden shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/40 bg-muted/40">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">By provider</h3>
                        {providerOverrides.length > 0 && (
                          <Badge variant="secondary" className="font-mono text-xs tabular-nums rounded-md">
                            {providerOverrides.length}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isRunning || providersToRun.length === 0}
                        onClick={() =>
                          setProviderOverrides((prev) => [...prev, { ...DEFAULT_PROVIDER_OVERRIDE_ROW }])
                        }
                        className="gap-1.5 rounded-lg border-border/50"
                      >
                        <Plus className="size-4" />
                        Add row
                      </Button>
                    </div>
                    <div className="p-5">
                      {providerOverrides.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-10 text-center">
                          <p className="text-sm text-muted-foreground">No overrides for individual providers yet.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 gap-1.5 rounded-lg"
                            disabled={isRunning || providersToRun.length === 0}
                            onClick={() =>
                              setProviderOverrides((prev) => [...prev, { ...DEFAULT_PROVIDER_OVERRIDE_ROW }])
                            }
                          >
                            <Plus className="size-4" />
                            Add by provider
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full overflow-auto rounded-xl border border-border/40 bg-background">
                          <Table className="w-full caption-bottom text-sm">
                            <TableHeader>
                              <TableRow className="border-border/40 hover:bg-transparent bg-muted/30">
                                <TableHead className="min-w-[180px] px-4 py-3 text-muted-foreground font-medium">Apply to</TableHead>
                                <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">CF</TableHead>
                                <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · basis</TableHead>
                                <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · amount</TableHead>
                                <TableHead className="min-w-[140px] px-4 py-3 text-muted-foreground font-medium">Threshold</TableHead>
                                <TableHead className="w-14 px-4 py-3" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {providerOverrides.map((row, idx) => (
                                <TableRow key={`prov-${idx}`} className="hover:bg-muted/30 transition-colors border-border/30">
                                  <TableCell className="px-4 py-3">
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
                                          className="h-9 w-full justify-between font-normal border-border/60"
                                          disabled={isRunning}
                                        >
                                          <span className="truncate">
                                            {row.providerIds.length === 0
                                              ? 'Select providers…'
                                              : row.providerIds.length === 1
                                                ? (providersToRun.find((p) => (p.providerId ?? p.providerName ?? '').toString() === row.providerIds[0])?.providerName ?? row.providerIds[0])
                                                : `${row.providerIds.length} selected`}
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
                                  <TableCell className="px-4 py-3">
                                    <div className="space-y-1.5">
                                      <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                                      <Select
                                        value={row.cfMode}
                                        onValueChange={(v: CFOverrideMode) =>
                                          setProviderOverrides((prev) =>
                                            prev.map((r, i) => (i === idx ? { ...r, cfMode: v } : r))
                                          )
                                        }
                                        disabled={isRunning}
                                      >
                                        <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                          <SelectValue placeholder="Select…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="percentile">CF %ile</SelectItem>
                                          <SelectItem value="dollar">CF ($)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={row.cfMode === 'percentile' ? 100 : undefined}
                                        step={row.cfMode === 'dollar' ? 0.01 : 1}
                                        placeholder={row.cfMode === 'percentile' ? '%ile' : '$'}
                                        value={row.cfMode === 'dollar' ? row.overrideCF : row.proposedCFPercentile}
                                        onChange={(e) =>
                                          setProviderOverrides((prev) =>
                                            prev.map((r, i) =>
                                              i === idx
                                                ? {
                                                    ...r,
                                                    ...(row.cfMode === 'dollar'
                                                      ? { overrideCF: e.target.value }
                                                      : { proposedCFPercentile: e.target.value }),
                                                  }
                                                : r
                                            )
                                          )
                                        }
                                        disabled={isRunning}
                                        className="h-9 w-full border-border/60"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    <Select
                                      value={row.psqBasis || '_base'}
                                      onValueChange={(v) =>
                                        setProviderOverrides((prev) =>
                                          prev.map((r, i) => (i === idx ? { ...r, psqBasis: v === '_base' ? '' : v } : r))
                                        )
                                      }
                                      disabled={isRunning}
                                    >
                                      <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                        <SelectValue placeholder="From base" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="_base">From base</SelectItem>
                                        <SelectItem value="base_salary">% of base salary</SelectItem>
                                        <SelectItem value="total_guaranteed">% of total guaranteed</SelectItem>
                                        <SelectItem value="total_pay">% of total pay (TCC)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    {(row.psqBasis === '_base' || !row.psqBasis) ? (
                                      <span className="text-muted-foreground text-sm">—</span>
                                    ) : (
                                    <div className="space-y-1.5">
                                      <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                                      <Select
                                        value={row.psqMode}
                                        onValueChange={(v: PSQOverrideMode) =>
                                          setProviderOverrides((prev) =>
                                            prev.map((r, i) => (i === idx ? { ...r, psqMode: v } : r))
                                          )
                                        }
                                        disabled={isRunning}
                                      >
                                        <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                          <SelectValue placeholder="Select…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="percent">%</SelectItem>
                                          <SelectItem value="dollar">$</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={row.psqMode === 'percent' ? 100 : undefined}
                                        step={row.psqMode === 'dollar' ? 0.01 : 0.5}
                                        placeholder={row.psqMode === 'percent' ? '%' : '$'}
                                        value={row.psqMode === 'dollar' ? row.psqDollars : row.psqPercent}
                                        onChange={(e) =>
                                          setProviderOverrides((prev) =>
                                            prev.map((r, i) =>
                                              i === idx
                                                ? {
                                                    ...r,
                                                    ...(row.psqMode === 'dollar'
                                                      ? { psqDollars: e.target.value }
                                                      : { psqPercent: e.target.value }),
                                                  }
                                                : r
                                            )
                                          )
                                        }
                                        disabled={isRunning}
                                        className="h-9 w-full border-border/60"
                                      />
                                    </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    <div className="space-y-1.5">
                                      <Select
                                        value={row.thresholdMethod || '_base'}
                                        onValueChange={(v) =>
                                          setProviderOverrides((prev) =>
                                            prev.map((r, i) => (i === idx ? { ...r, thresholdMethod: v === '_base' ? '' : v } : r))
                                          )
                                        }
                                        disabled={isRunning}
                                      >
                                        <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                          <SelectValue placeholder="From base scenario" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="_base">From base scenario</SelectItem>
                                          <SelectItem value="derived">Clinical $ ÷ CF</SelectItem>
                                          <SelectItem value="annual">Annual threshold (enter wRVUs)</SelectItem>
                                          <SelectItem value="wrvu_percentile">wRVU percentile (from market)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {row.thresholdMethod === 'annual' && (
                                        <Input
                                          type="number"
                                          min={0}
                                          placeholder="wRVUs"
                                          value={row.annualThreshold ?? ''}
                                          onChange={(e) =>
                                            setProviderOverrides((prev) =>
                                              prev.map((r, i) => (i === idx ? { ...r, annualThreshold: e.target.value } : r))
                                            )
                                          }
                                          disabled={isRunning}
                                          className="h-9 w-full border-border/60"
                                        />
                                      )}
                                      {row.thresholdMethod === 'wrvu_percentile' && (
                                        <Input
                                          type="number"
                                          min={0}
                                          max={100}
                                          placeholder="%ile"
                                          value={row.wrvuPercentile ?? ''}
                                          onChange={(e) =>
                                            setProviderOverrides((prev) =>
                                              prev.map((r, i) => (i === idx ? { ...r, wrvuPercentile: e.target.value } : r))
                                            )
                                          }
                                          disabled={isRunning}
                                          className="h-9 w-full border-border/60"
                                        />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-3">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setProviderOverrides((prev) => prev.filter((_, i) => i !== idx))}
                                      disabled={isRunning}
                                      aria-label="Remove row"
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
                  </section>
                </div>
              </div>
            )}

            {/* Step 3: Run — summary, error, and progress only; Run is in the footer below */}
            {wizardStep === 3 && (
              <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
                    <span className="tabular-nums">
                      {providersToRun.length} provider{providersToRun.length !== 1 ? 's' : ''} × 1 scenario
                      {overrideCount > 0 && ` · ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {isFull && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {providersToRun.length === providerRows.length && overrideCount === 0
                        ? 'No overrides — running for everyone in upload.'
                        : 'Overrides applied — running only for selected specialties/providers.'}
                    </p>
                  )}
                </div>
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
              </div>
            )}

            {/* Step navigation footer */}
            <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {wizardStep > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setWizardStep((wizardStep - 1) as 1 | 2 | 3)}
                      className="gap-1.5"
                    >
                      <ChevronLeft className="size-4" />
                      Back
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3">
                  {wizardStep === 3 && setAllowFuzzyMatchSpecialty && (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={allowFuzzyMatchSpecialty}
                        onChange={(e) => setAllowFuzzyMatchSpecialty(e.target.checked)}
                        className="rounded border-border"
                      />
                      Auto-match similar specialty names (use when provider and market names differ slightly)
                    </label>
                  )}
                  <div className="flex gap-2">
                    {wizardStep < 3 ? (
                      <Button
                        type="button"
                        onClick={() => setWizardStep((wizardStep + 1) as 1 | 2 | 3)}
                        className="gap-1.5"
                      >
                        Next: {wizardSteps[wizardStep === 1 ? 1 : 2]?.label ?? ''}
                        <ChevronRight className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={runBatch}
                        disabled={isRunning || providersToRun.length === 0 || marketRows.length === 0}
                        className="gap-2"
                      >
                        <Play className="size-4" />
                        Run
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
      )}

      {/* Detailed mode: Overrides card + Run card (no wizard) */}
      {isDetailed && (
      <Card id="batch-overrides" className="scroll-mt-6 rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 px-6 sm:px-8 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Sliders className="size-5 text-muted-foreground" />
              Overrides
            </CardTitle>
            <Badge variant="outline" className="font-normal text-muted-foreground rounded-md">
              Optional
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1.5 max-w-2xl">
            Override only what you need. Use <strong>From base</strong> to keep step 1 values for that column. Provider overrides win over specialty overrides.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-6 sm:px-8 pb-6">
          {/* By specialty */}
          <section className="rounded-xl border border-border/40 bg-background overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/40 bg-muted/40">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">By specialty</h3>
                {specialtyOverrides.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs tabular-nums rounded-md">
                    {specialtyOverrides.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isRunning || providerSpecialties.length === 0}
                onClick={() =>
                  setSpecialtyOverrides((prev) => [...prev, { ...DEFAULT_SPECIALTY_OVERRIDE_ROW }])
                }
                className="gap-1.5 rounded-lg border-border/50"
              >
                <Plus className="size-4" />
                Add row
              </Button>
            </div>
            <div className="p-5">
              {specialtyOverrides.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-12 text-center">
                  <p className="text-sm text-muted-foreground">No specialty overrides yet.</p>
                  <p className="text-sm text-muted-foreground/80 mt-1">Add a row to apply different inputs to specific specialties.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5 rounded-lg"
                    disabled={isRunning || providerSpecialties.length === 0}
                    onClick={() =>
                      setSpecialtyOverrides((prev) => [...prev, { ...DEFAULT_SPECIALTY_OVERRIDE_ROW }])
                    }
                  >
                    <Plus className="size-4" />
                    Add by specialty
                  </Button>
                </div>
              ) : (
                <div className="w-full overflow-auto rounded-xl border border-border/40 bg-background">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent bg-muted/30">
                        <TableHead className="min-w-[180px] px-4 py-3 text-muted-foreground font-medium">Apply to</TableHead>
                        <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">CF</TableHead>
                        <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · basis</TableHead>
                        <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · amount</TableHead>
                        <TableHead className="min-w-[140px] px-4 py-3 text-muted-foreground font-medium">Threshold</TableHead>
                        <TableHead className="w-14 px-4 py-3" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {specialtyOverrides.map((row, idx) => (
                        <TableRow key={`spec-${idx}`} className="hover:bg-muted/30 transition-colors border-border/30">
                          <TableCell className="px-4 py-3">
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
                                  className="h-9 w-full justify-between font-normal border-border/60"
                                  disabled={isRunning}
                                >
                                  <span className="truncate">
                                    {row.specialties.length === 0
                                      ? 'Select specialties…'
                                      : row.specialties.length === 1
                                        ? row.specialties[0]
                                        : `${row.specialties.length} selected`}
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
<TableCell className="px-4 py-3">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                              <Select
                                value={row.cfMode}
                                onValueChange={(v: CFOverrideMode) =>
                                  setSpecialtyOverrides((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, cfMode: v } : r))
                                  )
                                }
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                  <SelectValue placeholder="Select…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentile">CF %ile</SelectItem>
                                  <SelectItem value="dollar">CF ($)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                max={row.cfMode === 'percentile' ? 100 : undefined}
                                step={row.cfMode === 'dollar' ? 0.01 : 1}
                                placeholder={row.cfMode === 'percentile' ? '%ile' : '$'}
                                value={row.cfMode === 'dollar' ? row.overrideCF : row.proposedCFPercentile}
                                onChange={(e) =>
                                  setSpecialtyOverrides((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            ...(row.cfMode === 'dollar'
                                              ? { overrideCF: e.target.value }
                                              : { proposedCFPercentile: e.target.value }),
                                          }
                                        : r
                                    )
                                  )
                                }
                                disabled={isRunning}
                                className="h-9 w-full border-border/60"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Select
                              value={row.psqBasis || '_base'}
                              onValueChange={(v) =>
                                setSpecialtyOverrides((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, psqBasis: v === '_base' ? '' : v } : r))
                                )
                              }
                              disabled={isRunning}
                            >
                              <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                <SelectValue placeholder="From base" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_base">From base</SelectItem>
                                <SelectItem value="base_salary">% of base salary</SelectItem>
                                <SelectItem value="total_guaranteed">% of total guaranteed</SelectItem>
                                <SelectItem value="total_pay">% of total pay (TCC)</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {(row.psqBasis === '_base' || !row.psqBasis) ? (
                              <span className="text-muted-foreground text-sm">—</span>
                            ) : (
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                              <Select
                                value={row.psqMode}
                                onValueChange={(v: PSQOverrideMode) =>
                                  setSpecialtyOverrides((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, psqMode: v } : r))
                                  )
                                }
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                  <SelectValue placeholder="Select…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent">%</SelectItem>
                                  <SelectItem value="dollar">$</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                max={row.psqMode === 'percent' ? 100 : undefined}
                                step={row.psqMode === 'dollar' ? 0.01 : 0.5}
                                placeholder={row.psqMode === 'percent' ? '%' : '$'}
                                value={row.psqMode === 'dollar' ? row.psqDollars : row.psqPercent}
                                onChange={(e) =>
                                  setSpecialtyOverrides((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            ...(row.psqMode === 'dollar'
                                              ? { psqDollars: e.target.value }
                                              : { psqPercent: e.target.value }),
                                          }
                                        : r
                                    )
                                  )
                                }
                                disabled={isRunning}
                                className="h-9 w-full border-border/60"
                              />
                            </div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="space-y-1.5">
                              <Select
                                value={row.thresholdMethod || '_base'}
                                onValueChange={(v) =>
                                  setSpecialtyOverrides((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, thresholdMethod: v === '_base' ? '' : v } : r))
                                  )
                                }
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                  <SelectValue placeholder="From base scenario" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_base">From base scenario</SelectItem>
                                  <SelectItem value="derived">Clinical $ ÷ CF</SelectItem>
                                  <SelectItem value="annual">Annual threshold (enter wRVUs)</SelectItem>
                                  <SelectItem value="wrvu_percentile">wRVU percentile (from market)</SelectItem>
                                </SelectContent>
                              </Select>
                              {row.thresholdMethod === 'annual' && (
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="wRVUs"
                                  value={row.annualThreshold ?? ''}
                                  onChange={(e) =>
                                    setSpecialtyOverrides((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, annualThreshold: e.target.value } : r))
                                    )
                                  }
                                  disabled={isRunning}
                                  className="h-9 w-full border-border/60"
                                />
                              )}
                              {row.thresholdMethod === 'wrvu_percentile' && (
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="%ile"
                                  value={row.wrvuPercentile ?? ''}
                                  onChange={(e) =>
                                    setSpecialtyOverrides((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, wrvuPercentile: e.target.value } : r))
                                    )
                                  }
                                  disabled={isRunning}
                                  className="h-9 w-full border-border/60"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setSpecialtyOverrides((prev) => prev.filter((_, i) => i !== idx))}
                              disabled={isRunning}
                              aria-label="Remove row"
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
          </section>

          {/* By provider */}
          <section className="rounded-xl border border-border/40 bg-background overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/40 bg-muted/40">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">By provider</h3>
                {providerOverrides.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs tabular-nums rounded-md">
                    {providerOverrides.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isRunning || providersToRun.length === 0}
                onClick={() =>
                  setProviderOverrides((prev) => [...prev, { ...DEFAULT_PROVIDER_OVERRIDE_ROW }])
                }
                className="gap-1.5 rounded-lg border-border/50"
              >
                <Plus className="size-4" />
                Add row
              </Button>
            </div>
            <div className="p-5">
              {providerOverrides.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 py-12 text-center">
                  <p className="text-sm text-muted-foreground">No provider overrides yet.</p>
                  <p className="text-sm text-muted-foreground/80 mt-1">Add a row to apply different inputs to individual providers.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 gap-1.5 rounded-lg"
                    disabled={isRunning || providersToRun.length === 0}
                    onClick={() =>
                      setProviderOverrides((prev) => [...prev, { ...DEFAULT_PROVIDER_OVERRIDE_ROW }])
                    }
                  >
                    <Plus className="size-4" />
                    Add by provider
                  </Button>
                </div>
              ) : (
                <div className="w-full overflow-auto rounded-xl border border-border/40 bg-background">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent bg-muted/30">
                        <TableHead className="min-w-[180px] px-4 py-3 text-muted-foreground font-medium">Apply to</TableHead>
                        <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">CF</TableHead>
                        <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · basis</TableHead>
                        <TableHead className="min-w-[130px] px-4 py-3 text-muted-foreground font-medium">Quality pay · amount</TableHead>
                        <TableHead className="min-w-[140px] px-4 py-3 text-muted-foreground font-medium">Threshold</TableHead>
                        <TableHead className="w-14 px-4 py-3" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providerOverrides.map((row, idx) => (
                        <TableRow key={`prov-${idx}`} className="hover:bg-muted/30 transition-colors border-border/30">
                          <TableCell className="px-4 py-3">
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
                                  className="h-9 w-full justify-between font-normal border-border/60"
                                  disabled={isRunning}
                                >
                                  <span className="truncate">
                                    {row.providerIds.length === 0
                                      ? 'Select providers…'
                                      : row.providerIds.length === 1
                                        ? (providersToRun.find((p) => (p.providerId ?? p.providerName ?? '').toString() === row.providerIds[0])?.providerName ?? row.providerIds[0])
                                        : `${row.providerIds.length} selected`}
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
                          <TableCell className="px-4 py-3">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                              <Select
                                value={row.cfMode}
                                onValueChange={(v: CFOverrideMode) =>
                                  setProviderOverrides((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, cfMode: v } : r))
                                  )
                                }
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                  <SelectValue placeholder="Select…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentile">CF %ile</SelectItem>
                                  <SelectItem value="dollar">CF ($)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                max={row.cfMode === 'percentile' ? 100 : undefined}
                                step={row.cfMode === 'dollar' ? 0.01 : 1}
                                placeholder={row.cfMode === 'percentile' ? '%ile' : '$'}
                                value={row.cfMode === 'dollar' ? row.overrideCF : row.proposedCFPercentile}
                                onChange={(e) =>
                                  setProviderOverrides((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            ...(row.cfMode === 'dollar'
                                              ? { overrideCF: e.target.value }
                                              : { proposedCFPercentile: e.target.value }),
                                          }
                                        : r
                                    )
                                  )
                                }
                                disabled={isRunning}
                                className="h-9 w-full border-border/60"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Select
                              value={row.psqBasis || '_base'}
                              onValueChange={(v) =>
                                setProviderOverrides((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, psqBasis: v === '_base' ? '' : v } : r))
                                )
                              }
                              disabled={isRunning}
                            >
                              <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                <SelectValue placeholder="From base" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_base">From base</SelectItem>
                                <SelectItem value="base_salary">% of base salary</SelectItem>
                                <SelectItem value="total_guaranteed">% of total guaranteed</SelectItem>
                                <SelectItem value="total_pay">% of total pay (TCC)</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {(row.psqBasis === '_base' || !row.psqBasis) ? (
                              <span className="text-muted-foreground text-sm">—</span>
                            ) : (
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-muted-foreground font-normal">Type</Label>
                              <Select
                                value={row.psqMode}
                                onValueChange={(v: PSQOverrideMode) =>
                                  setProviderOverrides((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, psqMode: v } : r))
                                  )
                                }
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-8 w-full min-w-0 border-border/60 text-xs">
                                  <SelectValue placeholder="Select…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent">%</SelectItem>
                                  <SelectItem value="dollar">$</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                max={row.psqMode === 'percent' ? 100 : undefined}
                                step={row.psqMode === 'dollar' ? 0.01 : 0.5}
                                placeholder={row.psqMode === 'percent' ? '%' : '$'}
                                value={row.psqMode === 'dollar' ? row.psqDollars : row.psqPercent}
                                onChange={(e) =>
                                  setProviderOverrides((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            ...(row.psqMode === 'dollar'
                                              ? { psqDollars: e.target.value }
                                              : { psqPercent: e.target.value }),
                                          }
                                        : r
                                    )
                                  )
                                }
                                disabled={isRunning}
                                className="h-9 w-full border-border/60"
                              />
                            </div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="space-y-1.5">
                              <Select
                                value={row.thresholdMethod || '_base'}
                                onValueChange={(v) =>
                                  setProviderOverrides((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, thresholdMethod: v === '_base' ? '' : v } : r))
                                  )
                                }
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-9 w-full min-w-0 border-border/60">
                                  <SelectValue placeholder="From base scenario" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_base">From base scenario</SelectItem>
                                  <SelectItem value="derived">Clinical $ ÷ CF</SelectItem>
                                  <SelectItem value="annual">Annual threshold (enter wRVUs)</SelectItem>
                                  <SelectItem value="wrvu_percentile">wRVU percentile (from market)</SelectItem>
                                </SelectContent>
                              </Select>
                              {row.thresholdMethod === 'annual' && (
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="wRVUs"
                                  value={row.annualThreshold ?? ''}
                                  onChange={(e) =>
                                    setProviderOverrides((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, annualThreshold: e.target.value } : r))
                                    )
                                  }
                                  disabled={isRunning}
                                  className="h-9 w-full border-border/60"
                                />
                              )}
                              {row.thresholdMethod === 'wrvu_percentile' && (
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="%ile"
                                  value={row.wrvuPercentile ?? ''}
                                  onChange={(e) =>
                                    setProviderOverrides((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, wrvuPercentile: e.target.value } : r))
                                    )
                                  }
                                  disabled={isRunning}
                                  className="h-9 w-full border-border/60"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setProviderOverrides((prev) => prev.filter((_, i) => i !== idx))}
                              disabled={isRunning}
                              aria-label="Remove row"
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
          </section>
                <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{providersToRun.length}</span> provider(s) will be run.
                  {providersToRun.length === providerRows.length && overrideCount === 0
                    ? ' No overrides — everyone in upload.'
                    : ' Overrides applied — only selected specialties/providers.'}
                </div>
        </CardContent>
      </Card>
      )}

      {isDetailed && (
      <Card id="batch-run" className="scroll-mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Play className="size-5 text-muted-foreground" />
              Run
            </CardTitle>
          </div>
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
          <div className="flex flex-wrap items-center justify-end gap-4">
            {setAllowFuzzyMatchSpecialty && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allowFuzzyMatchSpecialty}
                  onChange={(e) => setAllowFuzzyMatchSpecialty(e.target.checked)}
                  className="rounded border-border"
                />
                Auto-match similar specialty names
              </label>
            )}
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
        </CardContent>
      </Card>
      )}

      {onSaveScenario && (
        <Dialog open={saveScenarioDialogOpen} onOpenChange={setSaveScenarioDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save scenario</DialogTitle>
              <DialogDescription>
                Save the current base inputs and overrides so you can recall them later.
                {appliedBatchScenarioConfig && (
                  <span className="mt-1 block text-foreground/80">
                    You have a scenario loaded — update it or save as a new one.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
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
              <div className="flex flex-wrap gap-2">
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

    </div>
  )
}
