import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, ChevronDown, FolderOpen, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs } from '@/types/scenario'
import type {
  OptimizationObjective,
  OptimizerConfigSnapshot,
  OptimizerErrorMetric,
  OptimizerRunResult,
  OptimizerSettings,
} from '@/types/optimizer'
import type { SavedOptimizerConfig } from '@/types/optimizer'
import { getDefaultOptimizerSettings, migrateAdditionalTCCToLayers } from '@/types/optimizer'
import type { OptimizerWorkerOutMessage, OptimizerWorkerRunPayload } from '@/workers/optimizer-worker'
import { OptimizerConfigureStage } from '@/features/optimizer/stages/optimizer-configure-stage'
import { OptimizerRunStage } from '@/features/optimizer/stages/optimizer-run-stage'
import { CFSweepDrawer } from '@/features/optimizer/components/cf-sweep-drawer'

interface ConversionFactorOptimizerScreenProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  synonymMap: Record<string, string>
  onBack: () => void
  onSaveScenario?: (name: string) => void
  /** Persisted config (in-memory); when set, form initializes from it. */
  optimizerConfig: OptimizerConfigSnapshot | null
  onOptimizerConfigChange: (snapshot: OptimizerConfigSnapshot) => void
  onClearOptimizerConfig?: () => void
  savedOptimizerConfigs?: SavedOptimizerConfig[]
  onSaveOptimizerConfig?: (name: string) => void
  onLoadOptimizerConfig?: (id: string) => void
  onDeleteSavedOptimizerConfig?: (id: string) => void
}

/** Ensure settings from persisted config have required fields so OptimizerConfigureStage never crashes. */
function normalizeSettings(
  base: OptimizerSettings,
  persisted: Partial<OptimizerSettings> | undefined
): OptimizerSettings {
  if (!persisted) return base
  const merged = { ...base, ...persisted }
  if (!merged.optimizationObjective || typeof (merged.optimizationObjective as { kind?: string })?.kind !== 'string') {
    merged.optimizationObjective = base.optimizationObjective
  }
  if (!merged.errorMetric || (merged.errorMetric !== 'squared' && merged.errorMetric !== 'absolute')) {
    merged.errorMetric = base.errorMetric
  }
  return migrateAdditionalTCCToLayers(merged)
}

function getInitialState(
  scenarioInputs: ScenarioInputs,
  optimizerConfig: OptimizerConfigSnapshot | null
) {
  const defaultSettings = getDefaultOptimizerSettings(scenarioInputs)
  if (!optimizerConfig) {
    return {
      settings: defaultSettings,
      result: null as OptimizerRunResult | null,
      targetMode: 'all' as const,
      selectedSpecialties: [] as string[],
      selectedDivisions: [] as string[],
      providerTypeFilter: 'all' as const,
      configStep: 1,
    }
  }
  return {
    settings: normalizeSettings(defaultSettings, optimizerConfig.settings),
    result: optimizerConfig.lastRunResult ?? null,
    targetMode: optimizerConfig.targetMode,
    selectedSpecialties: [...(optimizerConfig.selectedSpecialties ?? [])],
    selectedDivisions: [...(optimizerConfig.selectedDivisions ?? [])],
    providerTypeFilter: optimizerConfig.providerTypeFilter,
    configStep: Math.min(4, Math.max(1, optimizerConfig.configStep ?? 1)),
  }
}

export function ConversionFactorOptimizerScreen({
  providerRows: providerRowsProp,
  marketRows: marketRowsProp,
  scenarioInputs,
  synonymMap,
  onBack,
  onSaveScenario,
  optimizerConfig,
  onOptimizerConfigChange,
  onClearOptimizerConfig,
  savedOptimizerConfigs = [],
  onSaveOptimizerConfig,
  onLoadOptimizerConfig,
  onDeleteSavedOptimizerConfig,
}: ConversionFactorOptimizerScreenProps) {
  const providerRows = providerRowsProp ?? []
  const marketRows = marketRowsProp ?? []

  const initial = useMemo(
    () => getInitialState(scenarioInputs, optimizerConfig),
    [scenarioInputs, optimizerConfig]
  )
  const [settings, setSettings] = useState<OptimizerSettings>(initial.settings)
  const [result, setResult] = useState<OptimizerRunResult | null>(initial.result)
  const [isRunning, setIsRunning] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [runError, setRunError] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState<{
    specialtyIndex: number
    totalSpecialties: number
    specialtyName: string
  } | null>(null)
  const [targetMode, setTargetMode] = useState<'all' | 'custom'>(initial.targetMode)
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(initial.selectedSpecialties)
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>(initial.selectedDivisions)
  const [providerTypeFilter, setProviderTypeFilter] = useState<'all' | 'productivity' | 'base'>(initial.providerTypeFilter)
  const [configStep, setConfigStep] = useState(initial.configStep)
  const [optimizerStep, setOptimizerStep] = useState<'configure' | 'run'>('configure')
  const [saveScenarioDialogOpen, setSaveScenarioDialogOpen] = useState(false)
  const [saveScenarioName, setSaveScenarioName] = useState('')
  const [cfSweepDrawerOpen, setCfSweepDrawerOpen] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  /** Ref to avoid rehydrating when optimizerConfig is the snapshot we just pushed. */
  const lastPushedSnapshotRef = useRef<OptimizerConfigSnapshot | null>(null)
  /** Rehydrate from optimizerConfig when it changes from outside (e.g. recall), not when it's the snapshot we just pushed. */
  useEffect(() => {
    if (!optimizerConfig || optimizerConfig === lastPushedSnapshotRef.current) return
    lastPushedSnapshotRef.current = null
    const defaultSettings = getDefaultOptimizerSettings(scenarioInputs)
    setSettings(normalizeSettings(defaultSettings, optimizerConfig.settings))
    setResult(optimizerConfig.lastRunResult ?? null)
    setTargetMode(optimizerConfig.targetMode)
    setSelectedSpecialties([...(optimizerConfig.selectedSpecialties ?? [])])
    setSelectedDivisions([...(optimizerConfig.selectedDivisions ?? [])])
    setProviderTypeFilter(optimizerConfig.providerTypeFilter)
    setConfigStep(Math.min(4, Math.max(1, optimizerConfig.configStep ?? 1)))
  }, [optimizerConfig])

  /** Persist current form state to parent so it survives tab switch. */
  const buildSnapshot = useCallback((): OptimizerConfigSnapshot => ({
    providerTypeFilter,
    targetMode,
    selectedSpecialties: [...selectedSpecialties],
    selectedDivisions: [...selectedDivisions],
    settings,
    configStep,
    lastRunResult: result ?? undefined,
  }), [providerTypeFilter, targetMode, selectedSpecialties, selectedDivisions, settings, configStep, result])

  useEffect(() => {
    const snapshot = buildSnapshot()
    if (lastPushedSnapshotRef.current === snapshot) return
    lastPushedSnapshotRef.current = snapshot
    onOptimizerConfigChange(snapshot)
  }, [buildSnapshot, onOptimizerConfigChange])

  const hasData = providerRows.length > 0 && marketRows.length > 0

  /** Provider rows filtered by compensation model only (used to derive available specialties/divisions). */
  const providerRowsByCompModel = useMemo(() => {
    if (providerTypeFilter === 'all') return providerRows
    if (providerTypeFilter === 'productivity') {
      return providerRows.filter((p) => (p.productivityModel ?? '').toLowerCase() === 'productivity')
    }
    return providerRows.filter((p) => {
      const model = (p.productivityModel ?? '').toLowerCase()
      return model === 'base' || model === ''
    })
  }, [providerRows, providerTypeFilter])

  /** Data-driven: only specialties that exist in the dataset for the selected compensation model. */
  const availableSpecialties = useMemo(() => {
    const values = new Set<string>()
    providerRowsByCompModel.forEach((provider) => {
      const specialty = (provider.specialty ?? '').trim()
      if (specialty) values.add(specialty)
    })
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [providerRowsByCompModel])

  /**
   * Data-driven: only divisions that exist in the dataset for the current scope.
   * When a specialty (e.g. Urology) is selected, show only divisions that have providers in that specialty.
   */
  const availableDivisions = useMemo(() => {
    let rows = providerRowsByCompModel
    if (targetMode === 'custom' && selectedSpecialties.length > 0) {
      const specialtySet = new Set(selectedSpecialties)
      rows = rows.filter((p) => specialtySet.has((p.specialty ?? '').trim()))
    }
    const values = new Set<string>()
    rows.forEach((provider) => {
      const division = (provider.division ?? '').trim()
      if (division) values.add(division)
    })
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [providerRowsByCompModel, targetMode, selectedSpecialties])

  /** When compensation model or specialty scope changes, prune selections to only those still in scope. */
  useEffect(() => {
    const specSet = new Set(availableSpecialties)
    const divSet = new Set(availableDivisions)
    setSelectedSpecialties((prev) => {
      const next = prev.filter((s) => specSet.has(s))
      return next.length !== prev.length || prev.some((s, i) => next[i] !== s) ? next : prev
    })
    setSelectedDivisions((prev) => {
      const next = prev.filter((d) => divSet.has(d))
      return next.length !== prev.length || prev.some((d, i) => next[i] !== d) ? next : prev
    })
  }, [availableSpecialties, availableDivisions])

  const filteredProviderRowsForRun = useMemo(() => {
    let rows = providerRows
    if (providerTypeFilter === 'productivity') {
      rows = rows.filter((provider) => (provider.productivityModel ?? '').toLowerCase() === 'productivity')
    } else if (providerTypeFilter === 'base') {
      rows = rows.filter((provider) => {
        const model = (provider.productivityModel ?? '').toLowerCase()
        return model === 'base' || model === ''
      })
    }

    if (targetMode === 'custom' && selectedSpecialties.length > 0) {
      const specialtySet = new Set(selectedSpecialties)
      const divisionSet = new Set(selectedDivisions)
      rows = rows.filter((provider) => {
        const specialty = (provider.specialty ?? '').trim()
        if (!specialtySet.has(specialty)) return false
        if (divisionSet.size === 0) return true
        const division = (provider.division ?? '').trim()
        return divisionSet.has(division)
      })
    }

    return rows
  }, [providerRows, providerTypeFilter, selectedDivisions, selectedSpecialties, targetMode])

  useEffect(() => {
    return () => {
      if (!workerRef.current) return
      workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const handleRun = useCallback(() => {
    if (!hasData || workerRef.current) return
    setIsRunning(true)
    setResult(null)
    setRunError(null)
    setRunProgress(null)
    const worker = new Worker(new URL('../../workers/optimizer-worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<OptimizerWorkerOutMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        setRunProgress({
          specialtyIndex: message.specialtyIndex,
          totalSpecialties: message.totalSpecialties,
          specialtyName: message.specialtyName,
        })
        return
      }

      workerRef.current = null
      worker.terminate()
      setIsRunning(false)
      setRunProgress(null)
      if (message.type === 'done') {
        setResult(message.result)
      } else {
        setRunError(message.message)
      }
    }

    worker.onerror = () => {
      workerRef.current = null
      worker.terminate()
      setIsRunning(false)
      setRunProgress(null)
      setRunError('Optimizer worker failed.')
    }

    const payload: OptimizerWorkerRunPayload = {
      type: 'run',
      providerRows: filteredProviderRowsForRun,
      marketRows,
      settings,
      scenarioId: crypto.randomUUID(),
      scenarioName: 'CF Optimizer run',
      synonymMap,
    }
    worker.postMessage(payload)
  }, [filteredProviderRowsForRun, hasData, marketRows, settings, synonymMap])

  const handleStartOver = useCallback(() => {
    setResult(null)
    setRunError(null)
    setRunProgress(null)
    setTargetMode('all')
    setSelectedSpecialties([])
    setSelectedDivisions([])
    setProviderTypeFilter('all')
    setOptimizerStep('configure')
  }, [])

  const handleClearConfig = useCallback(() => {
    onClearOptimizerConfig?.()
    lastPushedSnapshotRef.current = null
    const defaultSettings = getDefaultOptimizerSettings(scenarioInputs)
    setSettings(defaultSettings)
    setResult(null)
    setTargetMode('all')
    setSelectedSpecialties([])
    setSelectedDivisions([])
    setProviderTypeFilter('all')
    setConfigStep(1)
    setOptimizerStep('configure')
  }, [scenarioInputs, onClearOptimizerConfig])

  const setOptimizationObjective = useCallback(
    (objective: OptimizationObjective) =>
      setSettings((current) => ({ ...current, optimizationObjective: objective })),
    []
  )
  const setErrorMetric = useCallback(
    (errorMetric: OptimizerErrorMetric) => setSettings((current) => ({ ...current, errorMetric })),
    []
  )

  const exportToExcel = useCallback(() => {
    if (!result) return
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
    XLSX.writeFile(workbook, `optimizer-results-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [result])

  const runDisabled =
    !hasData ||
    isRunning ||
    (targetMode === 'custom' && selectedSpecialties.length === 0) ||
    filteredProviderRowsForRun.length === 0

  const handleRunAndOpenReview = useCallback(() => {
    setOptimizerStep('run')
    handleRun()
  }, [handleRun])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {optimizerStep === 'run' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOptimizerStep('configure')}
              className="gap-2"
            >
              Change requirements
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider delayDuration={300}>
          {onSaveOptimizerConfig ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveScenarioDialogOpen(true)}
                    aria-label="Save scenario"
                  >
                    <Save className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Save scenario</TooltipContent>
              </Tooltip>
              {savedOptimizerConfigs.length > 0 && onLoadOptimizerConfig ? (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Saved scenarios (${savedOptimizerConfigs.length})`}
                        >
                          <FolderOpen className="size-4" />
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Saved scenarios ({savedOptimizerConfigs.length})
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
                    {[...savedOptimizerConfigs].reverse().map((config) => (
                      <DropdownMenuItem
                        key={config.id}
                        onSelect={(e) => {
                          e.preventDefault()
                          onLoadOptimizerConfig(config.id)
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{config.name}</span>
                        {onDeleteSavedOptimizerConfig ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onDeleteSavedOptimizerConfig(config.id)
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${config.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </>
          ) : null}
          {onClearOptimizerConfig ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearConfig}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Reset configuration"
            >
              <RotateCcw className="size-4" />
            </Button>
          ) : null}
          </TooltipProvider>
        </div>
      </div>

      <Dialog open={saveScenarioDialogOpen} onOpenChange={setSaveScenarioDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save optimizer scenario</DialogTitle>
            <DialogDescription>
              Save the current target population, objective, governance, and TCC settings so you can recall them later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="optimizer-scenario-name">Scenario name</Label>
            <Input
              id="optimizer-scenario-name"
              value={saveScenarioName}
              onChange={(e) => setSaveScenarioName(e.target.value)}
              placeholder="e.g. Q1 Productivity run"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveScenarioDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const name = saveScenarioName.trim()
                if (name && onSaveOptimizerConfig) {
                  onSaveOptimizerConfig(name)
                  setSaveScenarioName('')
                  setSaveScenarioDialogOpen(false)
                }
              }}
              disabled={!saveScenarioName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {optimizerStep === 'configure' ? (
        <OptimizerConfigureStage
          hasData={hasData}
          settings={settings}
          runDisabled={runDisabled}
          filteredProviderRowsCount={filteredProviderRowsForRun.length}
          targetMode={targetMode}
          selectedSpecialties={selectedSpecialties}
          selectedDivisions={selectedDivisions}
          providerTypeFilter={providerTypeFilter}
          availableSpecialties={availableSpecialties}
          availableDivisions={availableDivisions}
          onRun={handleRunAndOpenReview}
          onSetOptimizationObjective={setOptimizationObjective}
          onSetErrorMetric={setErrorMetric}
          onSetTargetMode={setTargetMode}
          onSetProviderTypeFilter={setProviderTypeFilter}
          onSetSelectedSpecialties={setSelectedSpecialties}
          onSetSelectedDivisions={setSelectedDivisions}
          onSetSettings={setSettings}
          configStep={configStep}
          onSetConfigStep={setConfigStep}
        />
      ) : (
        <OptimizerRunStage
          hasData={hasData}
          result={result}
          isRunning={isRunning}
          runError={runError}
          runDisabled={runDisabled}
          runProgress={runProgress}
          saveName={saveName}
          onSaveNameChange={setSaveName}
          onRun={handleRun}
          onStartOver={handleStartOver}
          onExport={exportToExcel}
          onOpenCFSweep={() => setCfSweepDrawerOpen(true)}
          onSaveScenario={
            onSaveScenario
              ? () => {
                  if (!saveName.trim()) return
                  onSaveScenario(saveName.trim())
                  setSaveName('')
                }
              : undefined
          }
        />
      )}

      <CFSweepDrawer
        open={cfSweepDrawerOpen}
        onOpenChange={setCfSweepDrawerOpen}
        providerRows={filteredProviderRowsForRun}
        marketRows={marketRows}
        settings={settings}
        synonymMap={synonymMap}
        result={result}
      />
    </div>
  )
}
