import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, FolderOpen, GitCompare, RotateCcw, Save, Target, Trash2 } from 'lucide-react'
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
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type {
  ProductivityTargetConfigSnapshot,
  ProductivityTargetSettings,
  ProductivityTargetRunResult,
  SavedProductivityTargetConfig,
} from '@/types/productivity-target'
import { DEFAULT_PRODUCTIVITY_TARGET_SETTINGS } from '@/types/productivity-target'
import { runBySpecialty } from '@/lib/productivity-target-engine'
import { downloadProductivityTargetCSV } from '@/lib/productivity-target-export'
import { ProductivityTargetConfigureStage } from '@/features/productivity-target/stages/productivity-target-configure-stage'
import { ProductivityTargetRunStage } from '@/features/productivity-target/stages/productivity-target-run-stage'

interface ProductivityTargetScreenProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  synonymMap: Record<string, string>
  onBack: () => void
  productivityTargetConfig: ProductivityTargetConfigSnapshot | null
  onProductivityTargetConfigChange: (snapshot: ProductivityTargetConfigSnapshot) => void
  onClearProductivityTargetConfig?: () => void
  savedProductivityTargetConfigs?: SavedProductivityTargetConfig[]
  loadedProductivityTargetConfigId?: string | null
  onSaveProductivityTargetConfig?: (name: string, updateId?: string) => void
  onLoadProductivityTargetConfig?: (id: string) => void
  onDeleteSavedProductivityTargetConfig?: (id: string) => void
  onNavigateToCompareScenarios?: () => void
}

function getInitialState(config: ProductivityTargetConfigSnapshot | null) {
  const defaultSettings = DEFAULT_PRODUCTIVITY_TARGET_SETTINGS
  if (!config) {
    return {
      settings: defaultSettings,
      result: null as ProductivityTargetRunResult | null,
      targetMode: 'all' as const,
      selectedSpecialties: [] as string[],
      modelScopeMode: 'all' as const,
      selectedModels: [] as string[],
      providerTypeScopeMode: 'all' as const,
      selectedProviderTypes: [] as string[],
      excludedProviderTypes: [] as string[],
      providerScopeMode: 'all' as const,
      selectedProviderIds: [] as string[],
      excludedProviderIds: [] as string[],
      configStep: 1,
    }
  }
  return {
    settings: { ...defaultSettings, ...config.settings },
    result: config.lastRunResult ?? null,
    targetMode: (config.targetMode ?? 'all') as 'all' | 'custom',
    selectedSpecialties: [...(config.selectedSpecialties ?? [])],
    modelScopeMode: (config.modelScopeMode ?? 'all') as 'all' | 'custom',
    selectedModels: [...(config.selectedModels ?? [])],
    providerTypeScopeMode: (config.providerTypeScopeMode ?? 'all') as 'all' | 'custom',
    selectedProviderTypes: [...(config.selectedProviderTypes ?? [])],
    excludedProviderTypes: [...(config.excludedProviderTypes ?? [])],
    providerScopeMode: (config.providerScopeMode ?? 'all') as 'all' | 'custom',
    selectedProviderIds: [...(config.selectedProviderIds ?? [])],
    excludedProviderIds: [...(config.excludedProviderIds ?? [])],
    configStep: Math.min(3, Math.max(1, config.configStep ?? 1)),
  }
}

export function ProductivityTargetScreen({
  providerRows = [],
  marketRows = [],
  synonymMap = {},
  onBack,
  productivityTargetConfig,
  onProductivityTargetConfigChange,
  onClearProductivityTargetConfig,
  savedProductivityTargetConfigs = [],
  loadedProductivityTargetConfigId = null,
  onSaveProductivityTargetConfig,
  onLoadProductivityTargetConfig,
  onDeleteSavedProductivityTargetConfig,
  onNavigateToCompareScenarios,
}: ProductivityTargetScreenProps) {
  const initial = useMemo(() => getInitialState(productivityTargetConfig), [productivityTargetConfig])
  const [settings, setSettings] = useState<ProductivityTargetSettings>(initial.settings)
  const [result, setResult] = useState<ProductivityTargetRunResult | null>(initial.result)
  const [targetMode, setTargetMode] = useState<'all' | 'custom'>(initial.targetMode)
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(initial.selectedSpecialties)
  const [modelScopeMode, setModelScopeMode] = useState<'all' | 'custom'>(initial.modelScopeMode)
  const [selectedModels, setSelectedModels] = useState<string[]>(initial.selectedModels)
  const [providerTypeScopeMode, setProviderTypeScopeMode] = useState<'all' | 'custom'>(initial.providerTypeScopeMode)
  const [selectedProviderTypes, setSelectedProviderTypes] = useState<string[]>(initial.selectedProviderTypes)
  const [excludedProviderTypes, setExcludedProviderTypes] = useState<string[]>(initial.excludedProviderTypes)
  const [providerScopeMode, setProviderScopeMode] = useState<'all' | 'custom'>(initial.providerScopeMode)
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>(initial.selectedProviderIds)
  const [excludedProviderIds, setExcludedProviderIds] = useState<string[]>(initial.excludedProviderIds)
  const [configStep, setConfigStep] = useState(initial.configStep)
  const [targetStep, setTargetStep] = useState<'configure' | 'run'>(initial.result ? 'run' : 'configure')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveScenarioName, setSaveScenarioName] = useState('')
  const lastPushedSnapshotRef = useRef<ProductivityTargetConfigSnapshot | null>(null)

  useEffect(() => {
    if (saveDialogOpen && loadedProductivityTargetConfigId && savedProductivityTargetConfigs.length > 0) {
      const loaded = savedProductivityTargetConfigs.find((c) => c.id === loadedProductivityTargetConfigId)
      if (loaded?.name) setSaveScenarioName(loaded.name)
    }
    if (!saveDialogOpen) setSaveScenarioName('')
  }, [saveDialogOpen, loadedProductivityTargetConfigId, savedProductivityTargetConfigs])

  useEffect(() => {
    if (productivityTargetConfig === lastPushedSnapshotRef.current) return
    lastPushedSnapshotRef.current = null
    const next = getInitialState(productivityTargetConfig)
    setSettings(next.settings)
    setResult(next.result)
    setTargetMode(next.targetMode)
    setSelectedSpecialties(next.selectedSpecialties)
    setModelScopeMode(next.modelScopeMode)
    setSelectedModels(next.selectedModels)
    setProviderTypeScopeMode(next.providerTypeScopeMode)
    setSelectedProviderTypes(next.selectedProviderTypes)
    setExcludedProviderTypes(next.excludedProviderTypes)
    setProviderScopeMode(next.providerScopeMode)
    setSelectedProviderIds(next.selectedProviderIds)
    setExcludedProviderIds(next.excludedProviderIds)
    setConfigStep(next.configStep)
    setTargetStep(next.result ? 'run' : 'configure')
  }, [productivityTargetConfig])

  const buildSnapshot = useCallback(
    (): ProductivityTargetConfigSnapshot => ({
      settings,
      configStep,
      targetMode,
      selectedSpecialties: [...selectedSpecialties],
      modelScopeMode,
      selectedModels: [...selectedModels],
      providerTypeScopeMode,
      selectedProviderTypes: [...selectedProviderTypes],
      excludedProviderTypes: [...excludedProviderTypes],
      providerScopeMode,
      selectedProviderIds: [...selectedProviderIds],
      excludedProviderIds: [...excludedProviderIds],
      lastRunResult: result ?? undefined,
    }),
    [
      settings,
      configStep,
      targetMode,
      selectedSpecialties,
      modelScopeMode,
      selectedModels,
      providerTypeScopeMode,
      selectedProviderTypes,
      excludedProviderTypes,
      providerScopeMode,
      selectedProviderIds,
      excludedProviderIds,
      result,
    ]
  )

  useEffect(() => {
    const snapshot = buildSnapshot()
    if (lastPushedSnapshotRef.current === snapshot) return
    lastPushedSnapshotRef.current = snapshot
    onProductivityTargetConfigChange(snapshot)
  }, [buildSnapshot, onProductivityTargetConfigChange])

  const hasData = providerRows.length > 0 && marketRows.length > 0

  /** Specialties that are available given the current model scope (so dropdown shows only relevant options). */
  const availableSpecialties = useMemo(() => {
    let rows = providerRows
    if (modelScopeMode === 'custom' && selectedModels.length > 0) {
      const modelSet = new Set(selectedModels)
      rows = rows.filter((p) => modelSet.has((p.productivityModel ?? '').trim()))
    }
    const set = new Set(rows.map((p) => (p.specialty ?? '').trim()).filter(Boolean))
    return [...set].sort()
  }, [providerRows, modelScopeMode, selectedModels])

  /** Models that are available given the current specialty scope (so dropdown shows only relevant options). */
  const availableModels = useMemo(() => {
    let rows = providerRows
    if (targetMode === 'custom' && selectedSpecialties.length > 0) {
      const specialtySet = new Set(selectedSpecialties)
      rows = rows.filter((p) => specialtySet.has((p.specialty ?? '').trim()))
    }
    const set = new Set(rows.map((p) => (p.productivityModel ?? '').trim()).filter(Boolean))
    return [...set].sort()
  }, [providerRows, targetMode, selectedSpecialties])

  /** Providers in scope after specialty + model filter. */
  const rowsAfterSpecialtyAndModel = useMemo(() => {
    let rows = providerRows
    if (targetMode === 'custom' && selectedSpecialties.length > 0) {
      const specialtySet = new Set(selectedSpecialties)
      rows = rows.filter((p) => specialtySet.has((p.specialty ?? '').trim()))
    }
    if (modelScopeMode === 'custom' && selectedModels.length > 0) {
      const modelSet = new Set(selectedModels)
      rows = rows.filter((p) => modelSet.has((p.productivityModel ?? '').trim()))
    }
    return rows
  }, [providerRows, targetMode, selectedSpecialties, modelScopeMode, selectedModels])

  /** Provider types (roles) available in current specialty+model scope. */
  const availableProviderTypes = useMemo(() => {
    const set = new Set(rowsAfterSpecialtyAndModel.map((p) => (p.providerType ?? '').trim()).filter(Boolean))
    return [...set].sort()
  }, [rowsAfterSpecialtyAndModel])

  /** Providers in scope after specialty + model + provider type filter. */
  const rowsAfterSpecialtyModelAndProviderType = useMemo(() => {
    let rows = rowsAfterSpecialtyAndModel
    if (providerTypeScopeMode === 'custom' && selectedProviderTypes.length > 0) {
      const typeSet = new Set(selectedProviderTypes)
      rows = rows.filter((p) => typeSet.has((p.providerType ?? '').trim()))
    }
    return rows
  }, [rowsAfterSpecialtyAndModel, providerTypeScopeMode, selectedProviderTypes])

  /** For provider scope dropdown: list of providers in scope (after specialty + model + provider type), deduped by id. */
  const availableProvidersForSelection = useMemo(() => {
    const seen = new Set<string>()
    return rowsAfterSpecialtyModelAndProviderType
      .map((p) => {
        const id = (p.providerId ?? p.providerName ?? '').toString().trim()
        const name = (p.providerName ?? p.providerId ?? (id || '—')).toString()
        return { id, name }
      })
      .filter((x) => x.id && !seen.has(x.id) && (seen.add(x.id), true))
  }, [rowsAfterSpecialtyModelAndProviderType])

  /** Prune selections to only available values when the available lists change. */
  useEffect(() => {
    const availSpecSet = new Set(availableSpecialties)
    const availModelSet = new Set(availableModels)
    const availTypeSet = new Set(availableProviderTypes)
    const availProviderSet = new Set(availableProvidersForSelection.map((x) => x.id))
    const nextSpec = selectedSpecialties.filter((s) => availSpecSet.has(s))
    const nextModels = selectedModels.filter((m) => availModelSet.has(m))
    const nextTypes = selectedProviderTypes.filter((t) => availTypeSet.has(t))
    const nextExcludedTypes = excludedProviderTypes.filter((t) => availTypeSet.has(t))
    const nextProviders = selectedProviderIds.filter((id) => availProviderSet.has(id))
    const nextExcludedProviders = excludedProviderIds.filter((id) => availProviderSet.has(id))
    if (nextSpec.length !== selectedSpecialties.length) setSelectedSpecialties(nextSpec)
    if (nextModels.length !== selectedModels.length) setSelectedModels(nextModels)
    if (nextTypes.length !== selectedProviderTypes.length) setSelectedProviderTypes(nextTypes)
    if (nextExcludedTypes.length !== excludedProviderTypes.length) setExcludedProviderTypes(nextExcludedTypes)
    if (nextProviders.length !== selectedProviderIds.length) setSelectedProviderIds(nextProviders)
    if (nextExcludedProviders.length !== excludedProviderIds.length) setExcludedProviderIds(nextExcludedProviders)
  }, [
    availableSpecialties,
    availableModels,
    availableProviderTypes,
    availableProvidersForSelection,
    selectedSpecialties,
    selectedModels,
    selectedProviderTypes,
    excludedProviderTypes,
    selectedProviderIds,
    excludedProviderIds,
  ])

  const filteredProviderRowsForRun = useMemo(() => {
    let rows = rowsAfterSpecialtyModelAndProviderType
    if (providerScopeMode === 'custom' && selectedProviderIds.length > 0) {
      const idSet = new Set(selectedProviderIds)
      rows = rows.filter((p) => idSet.has((p.providerId ?? p.providerName ?? '').toString().trim()))
    }
    if (excludedProviderTypes.length > 0) {
      const excludedTypeSet = new Set(excludedProviderTypes)
      rows = rows.filter((p) => !excludedTypeSet.has((p.providerType ?? '').trim()))
    }
    if (excludedProviderIds.length > 0) {
      const excludedIdSet = new Set(excludedProviderIds)
      rows = rows.filter((p) => !excludedIdSet.has((p.providerId ?? p.providerName ?? '').toString().trim()))
    }
    return rows
  }, [
    rowsAfterSpecialtyModelAndProviderType,
    providerScopeMode,
    selectedProviderIds,
    excludedProviderTypes,
    excludedProviderIds,
  ])

  const hasInvalidSpecialtyOverride = useMemo(() => {
    const overrides = settings.specialtyTargetOverrides
    if (!overrides || Object.keys(overrides).length === 0) return false
    for (const rule of Object.values(overrides)) {
      if (rule.targetApproach === 'pay_per_wrvu') {
        if (
          rule.manualTargetWRVU == null ||
          !Number.isFinite(rule.manualTargetWRVU) ||
          rule.manualTargetWRVU < 0
        )
          return true
      } else {
        const p = rule.targetPercentile
        if (p == null || !Number.isFinite(p) || p < 1 || p > 99) return true
      }
    }
    return false
  }, [settings.specialtyTargetOverrides])

  const runDisabled =
    !hasData ||
    (targetMode === 'custom' && selectedSpecialties.length === 0) ||
    (modelScopeMode === 'custom' && selectedModels.length === 0) ||
    (providerTypeScopeMode === 'custom' && selectedProviderTypes.length === 0) ||
    (providerScopeMode === 'custom' && selectedProviderIds.length === 0) ||
    filteredProviderRowsForRun.length === 0 ||
    hasInvalidSpecialtyOverride ||
    (settings.targetApproach === 'pay_per_wrvu' &&
      (settings.manualTargetWRVU == null ||
        !Number.isFinite(settings.manualTargetWRVU) ||
        settings.manualTargetWRVU < 0))

  const handleRun = useCallback(() => {
    if (!hasData || runDisabled) return
    const runResult = runBySpecialty(filteredProviderRowsForRun, marketRows, synonymMap, settings)
    setResult(runResult)
    setTargetStep('run')
  }, [hasData, runDisabled, filteredProviderRowsForRun, marketRows, synonymMap, settings])

  const handleStartOver = useCallback(() => {
    setResult(null)
    setTargetStep('configure')
    setConfigStep(1)
  }, [])

  const handleExport = useCallback(() => {
    if (result) downloadProductivityTargetCSV(result)
  }, [result])

  const handleClearConfig = useCallback(() => {
    setSettings(DEFAULT_PRODUCTIVITY_TARGET_SETTINGS)
    setResult(null)
    setTargetMode('all')
    setSelectedSpecialties([])
    setModelScopeMode('all')
    setSelectedModels([])
    setProviderTypeScopeMode('all')
    setSelectedProviderTypes([])
    setExcludedProviderTypes([])
    setProviderScopeMode('all')
    setSelectedProviderIds([])
    setExcludedProviderIds([])
    setConfigStep(1)
    setTargetStep('configure')
    lastPushedSnapshotRef.current = null
    onClearProductivityTargetConfig?.()
  }, [onClearProductivityTargetConfig])

  return (
    <div className="space-y-6">
      <SectionTitleWithIcon icon={<Target className="size-5 text-muted-foreground" />}>
        Target Optimizer
      </SectionTitleWithIcon>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (targetStep === 'run') {
                setTargetStep('configure')
                setConfigStep(1)
              } else {
                onBack()
              }
            }}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {targetStep === 'run' ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setTargetStep('configure')}>
              Change requirements
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider delayDuration={300}>
            {onSaveProductivityTargetConfig ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={result == null ? 'inline-flex' : ''}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => result != null && setSaveDialogOpen(true)}
                        aria-label="Save scenario"
                        disabled={result == null}
                      >
                        <Save className="size-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {result == null ? 'Run the optimizer first to enable saving.' : 'Save scenario'}
                  </TooltipContent>
                </Tooltip>
                {savedProductivityTargetConfigs.length > 0 && onLoadProductivityTargetConfig ? (
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" aria-label={`Saved scenarios (${savedProductivityTargetConfigs.length})`}>
                            <FolderOpen className="size-4" />
                            <ChevronDown className="size-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Saved scenarios ({savedProductivityTargetConfigs.length})</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
                      {[...savedProductivityTargetConfigs].reverse().map((config) => (
                        <DropdownMenuItem
                          key={config.id}
                          onSelect={(e) => {
                            e.preventDefault()
                            onLoadProductivityTargetConfig(config.id)
                          }}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{config.name}</span>
                          {onDeleteSavedProductivityTargetConfig ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onDeleteSavedProductivityTargetConfig(config.id)
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
            {onNavigateToCompareScenarios ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateToCompareScenarios()}
                    aria-label="Compare scenarios"
                  >
                    <GitCompare className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Compare scenarios</TooltipContent>
              </Tooltip>
            ) : null}
            {onClearProductivityTargetConfig ? (
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

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save target scenario</DialogTitle>
            <DialogDescription>
              Save the current target scope, method, and run result so you can recall them later.
              {loadedProductivityTargetConfigId && (
                <span className="mt-1 block text-foreground/80">You have a scenario loaded — update it or save as a new one.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="target-scenario-name">Scenario name</Label>
            <Input
              id="target-scenario-name"
              value={saveScenarioName}
              onChange={(e) => setSaveScenarioName(e.target.value)}
              placeholder="e.g. Q1 Group target"
            />
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {loadedProductivityTargetConfigId && (
                <Button
                  variant="secondary"
                  disabled={!saveScenarioName.trim()}
                  onClick={() => {
                    const name = saveScenarioName.trim()
                    if (name && onSaveProductivityTargetConfig) {
                      onSaveProductivityTargetConfig(name, loadedProductivityTargetConfigId)
                      setSaveScenarioName('')
                      setSaveDialogOpen(false)
                    }
                  }}
                >
                  Update current
                </Button>
              )}
              <Button
                onClick={() => {
                  const name = saveScenarioName.trim()
                  if (name && onSaveProductivityTargetConfig) {
                    onSaveProductivityTargetConfig(name)
                    setSaveScenarioName('')
                    setSaveDialogOpen(false)
                  }
                }}
                disabled={!saveScenarioName.trim()}
              >
                {loadedProductivityTargetConfigId ? 'Save as new' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {targetStep === 'configure' ? (
        <ProductivityTargetConfigureStage
          hasData={hasData}
          settings={settings}
          runDisabled={runDisabled}
          filteredProviderRowsCount={filteredProviderRowsForRun.length}
          targetMode={targetMode}
          selectedSpecialties={selectedSpecialties}
          availableSpecialties={availableSpecialties}
          modelScopeMode={modelScopeMode}
          selectedModels={selectedModels}
          availableModels={availableModels}
          onSetModelScopeMode={setModelScopeMode}
          onSetSelectedModels={setSelectedModels}
          providerTypeScopeMode={providerTypeScopeMode}
          selectedProviderTypes={selectedProviderTypes}
          excludedProviderTypes={excludedProviderTypes}
          availableProviderTypes={availableProviderTypes}
          onSetProviderTypeScopeMode={setProviderTypeScopeMode}
          onSetSelectedProviderTypes={setSelectedProviderTypes}
          onSetExcludedProviderTypes={setExcludedProviderTypes}
          providerScopeMode={providerScopeMode}
          selectedProviderIds={selectedProviderIds}
          excludedProviderIds={excludedProviderIds}
          availableProviders={availableProvidersForSelection}
          onSetProviderScopeMode={setProviderScopeMode}
          onSetSelectedProviderIds={setSelectedProviderIds}
          onSetExcludedProviderIds={setExcludedProviderIds}
          onRun={handleRun}
          onSetTargetMode={setTargetMode}
          onSetSelectedSpecialties={setSelectedSpecialties}
          onSetSettings={setSettings}
          configStep={configStep}
          onSetConfigStep={setConfigStep}
        />
      ) : (
        <ProductivityTargetRunStage
          hasData={hasData}
          result={result}
          runDisabled={runDisabled}
          onRun={handleRun}
          onStartOver={handleStartOver}
          onExport={handleExport}
        />
      )}
    </div>
  )
}
