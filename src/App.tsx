import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '@/hooks/use-app-state'
import { computeScenario } from '@/lib/compute'
import { AppLayout, type AppStep } from '@/components/layout/app-layout'
import { UploadAndMapping } from '@/components/upload-and-mapping'
import { MarketDataCard, ProviderStatisticsContent } from '@/components/modeller-top-section'
import { SpecialtySelect } from '@/components/specialty-select'
import { ExistingProviderAndMarketCard } from '@/components/existing-provider-and-market-card'
import { NewProviderForm, DEFAULT_NEW_PROVIDER, deriveBasePayFromComponents, type NewProviderFormValues } from '@/components/new-provider-form'
import { BaselineVsModeledSection } from '@/components/baseline-vs-modeled-section'
import { ImpactReportPage } from '@/components/impact-report-page'
import { MarketPositionTable } from '@/components/market-position-table'
import { ModellerStepper, type ModellerStep } from '@/components/modeller-stepper'
import { GovernanceFlags } from '@/components/governance-flags'
import { SaveScenarioDialog } from '@/components/saved-scenarios-section'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BatchScenarioStep } from '@/components/batch/batch-scenario-step'
import { BatchCardPicker, type BatchCardId } from '@/components/batch/batch-card-picker'
import { ConversionFactorOptimizerScreen } from '@/features/optimizer/conversion-factor-optimizer-screen'
import { CompareScenariosScreen } from '@/features/optimizer/compare-scenarios-screen'
import { ImputedVsMarketScreen } from '@/features/optimizer/imputed-vs-market-screen'
import { DataTablesScreen } from '@/features/data/data-tables-screen'
import { HelpScreen } from '@/features/help/help-screen'
import { ReportsScreen } from '@/features/reports/reports-screen'
import { LegalPage } from '@/components/legal-page'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { ArrowLeft, ChevronDown, ChevronRight, FileUp, FolderOpen, LayoutGrid, Layers, RotateCcw, Save, Trash2, User } from 'lucide-react'
import type { ProviderRow } from '@/types/provider'
import type { BatchResults, BatchRowResult, BatchScenarioSnapshot } from '@/types/batch'
import { BatchResultsDashboard } from '@/components/batch/batch-results-dashboard'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'

type ModelMode = 'existing' | 'new'

function scopeResultsBySnapshot(
  results: BatchResults,
  snapshot: BatchScenarioSnapshot | null
): BatchResults {
  if (!snapshot) return results
  const hasSpecialtyScope = snapshot.selectedSpecialties && snapshot.selectedSpecialties.length > 0
  const hasProviderScope = snapshot.selectedProviderIds && snapshot.selectedProviderIds.length > 0
  if (!hasSpecialtyScope && !hasProviderScope) return results
  const specialtySet = hasSpecialtyScope
    ? new Set(snapshot.selectedSpecialties!.map((s) => s.trim().toLowerCase()))
    : null
  const providerSet = hasProviderScope
    ? new Set(snapshot.selectedProviderIds!.map((id) => String(id).trim()))
    : null
  const filteredRows = results.rows.filter((row: BatchRowResult) => {
    if (specialtySet && !specialtySet.has((row.specialty ?? '').trim().toLowerCase())) return false
    if (providerSet && !providerSet.has(String(row.providerId ?? '').trim())) return false
    return true
  })
  return { ...results, rows: filteredRows }
}

function getLegalViewFromHash(): 'privacy' | 'terms' | null {
  const h = window.location.hash.slice(1).toLowerCase()
  if (h === 'privacy') return 'privacy'
  if (h === 'terms') return 'terms'
  return null
}

export default function App() {
  const [legalView, setLegalView] = useState<'privacy' | 'terms' | null>(getLegalViewFromHash)

  useEffect(() => {
    const handler = () => setLegalView(getLegalViewFromHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const {
    state,
    setProviderData,
    setMarketData,
    setSelectedSpecialty,
    setSelectedProvider,
    updateProvider,
    addProvider,
    updateMarketRow,
    addMarketRow,
    setScenarioInputs,
    setLastResults,
    dismissScenarioLoadWarning,
    saveCurrentScenario,
    loadScenario,
    deleteScenario,
    clearAllScenarios,
    duplicateScenario: _duplicateScenario,
    updateCurrentScenarioProviderSnapshot,
    setBatchResults,
    saveCurrentBatchRun,
    loadSavedBatchRun,
    deleteSavedBatchRun,
    saveBatchScenarioConfig,
    loadBatchScenarioConfig,
    clearAppliedBatchScenarioConfig,
    deleteSavedBatchScenarioConfig,
    updateBatchSynonymMap,
    removeBatchSynonym,
    setOptimizerConfig,
    clearOptimizerConfig,
    saveOptimizerConfig,
    loadOptimizerConfig,
    deleteSavedOptimizerConfig,
  } = useAppState()
  void _duplicateScenario

  const [step, setStep] = useState<AppStep>('upload')
  const [modelMode, setModelMode] = useState<ModelMode>('existing')
  const [modellerStep, setModellerStep] = useState<ModellerStep>('provider')
  const [newProviderForm, setNewProviderForm] = useState<NewProviderFormValues>(DEFAULT_NEW_PROVIDER)
  const [batchCard, setBatchCard] = useState<BatchCardId | null>(null)
  const [dataTab, setDataTab] = useState<'providers' | 'market'>('providers')
  const [modellerSaveDialogOpen, setModellerSaveDialogOpen] = useState(false)
  const [uploadSaveDialogOpen, setUploadSaveDialogOpen] = useState(false)

  const handleStepChange = (newStep: AppStep, dataTabOption?: 'providers' | 'market') => {
    setStep(newStep)
    if (newStep === 'data' && dataTabOption) setDataTab(dataTabOption)
    if (newStep !== 'batch-scenario' && newStep !== 'batch-results') setBatchCard(null)
  }

  const handleBatchRunComplete = (
    mode: 'bulk' | 'detailed',
    results: BatchResults,
    scenarioSnapshot?: BatchScenarioSnapshot
  ) => {
    const snapshotWithMode = scenarioSnapshot ? { ...scenarioSnapshot, mode } : undefined
    setBatchResults(mode, results, snapshotWithMode ?? null)
    setBatchCard(mode === 'bulk' ? 'bulk-scenario' : 'detailed-scenario')
    setStep('batch-results')
  }

  const marketRow = useMemo(() => {
    if (!state.selectedSpecialty || state.marketRows.length === 0) return null
    const selected = state.selectedSpecialty
    const direct = state.marketRows.find(
      (r) => (r.specialty ?? '').toLowerCase() === selected.toLowerCase()
    )
    if (direct) return direct
    const mapped = state.batchSynonymMap[selected] ?? state.batchSynonymMap[selected.trim()] ?? state.batchSynonymMap[selected.toLowerCase()]
    if (mapped) {
      return state.marketRows.find((r) => (r.specialty ?? '').toLowerCase() === mapped.toLowerCase()) ?? null
    }
    return null
  }, [state.marketRows, state.selectedSpecialty, state.batchSynonymMap])

  const selectedProvider = useMemo(() => {
    if (!state.selectedProviderId) return null
    return (
      state.providerRows.find(
        (p) => p.providerId === state.selectedProviderId
      ) ?? null
    )
  }, [state.providerRows, state.selectedProviderId])

  const hasData = state.providerRows.length > 0 && state.marketRows.length > 0
  const hasSpecialty = !!state.selectedSpecialty && !!marketRow

  const syntheticProvider: ProviderRow | null = useMemo(() => {
    if (modelMode !== 'new' || !state.selectedSpecialty) return null
    const f = newProviderForm
    const components = f.basePayComponents?.length ? f.basePayComponents : [{ id: 'default', label: 'Clinical', amount: 0 }]
    const { baseSalary, nonClinicalPay, totalGuaranteed } = deriveBasePayFromComponents(components)
    return {
      providerId: 'hypothetical',
      providerName: f.providerName.trim() || 'Hypothetical provider',
      specialty: state.selectedSpecialty,
      totalFTE: f.clinicalFTE,
      clinicalFTE: f.clinicalFTE,
      adminFTE: 0,
      researchFTE: 0,
      teachingFTE: 0,
      baseSalary,
      nonClinicalPay,
      qualityPayments: 0,
      otherIncentives: 0,
      totalWRVUs: f.totalWRVUs,
      workRVUs: f.totalWRVUs,
      currentCF: 0,
      currentTCC: totalGuaranteed,
      currentThreshold: 0,
      productivityModel: f.productivityModel,
    }
  }, [modelMode, state.selectedSpecialty, newProviderForm])

  const effectiveProvider: ProviderRow | null =
    modelMode === 'existing' ? selectedProvider : syntheticProvider

  const canShowScenarioExisting =
    hasData && hasSpecialty && !!state.selectedProviderId
  const canShowScenarioNew = modelMode === 'new' && !!hasSpecialty && !!marketRow
  const canShowScenario =
    modelMode === 'existing' ? canShowScenarioExisting : canShowScenarioNew

  // Default to first provider only when list just became available (not when user cleared selection)
  const prevProviderCountRef = useRef(0)
  useEffect(() => {
    if (modelMode !== 'existing' || !hasData || state.providerRows.length === 0) {
      prevProviderCountRef.current = state.providerRows.length
      return
    }
    const count = state.providerRows.length
    if (state.selectedProviderId) {
      prevProviderCountRef.current = count
      return
    }
    // Only auto-select first provider when we went from 0 to N rows (e.g. after upload), not when user clicked X
    if (count > prevProviderCountRef.current) {
      const first = state.providerRows[0]
      if (first?.providerId) setSelectedProvider(first.providerId)
    }
    prevProviderCountRef.current = count
  }, [
    modelMode,
    hasData,
    state.providerRows,
    state.selectedProviderId,
    setSelectedProvider,
  ])

  // When user selects a provider, set market (specialty) from that provider (existing mode only)
  useEffect(() => {
    if (modelMode !== 'existing') return
    if (!selectedProvider?.specialty || state.marketRows.length === 0) return
    const hasMarketForSpecialty = state.marketRows.some(
      (r) => (r.specialty ?? '').toLowerCase() === (selectedProvider.specialty ?? '').toLowerCase()
    )
    if (hasMarketForSpecialty) setSelectedSpecialty(selectedProvider.specialty ?? null)
  }, [
    modelMode,
    selectedProvider?.providerId,
    selectedProvider?.specialty,
    state.marketRows,
    setSelectedSpecialty,
  ])

  // Default specialty when no provider selected (existing) or when in new mode with no specialty
  useEffect(() => {
    if (!state.marketRows.length) return
    if (modelMode === 'existing' && state.selectedProviderId) return
    if (state.selectedSpecialty) return
    const first = state.marketRows[0]
    if (first?.specialty) setSelectedSpecialty(first.specialty)
  }, [
    modelMode,
    state.marketRows,
    state.selectedSpecialty,
    state.selectedProviderId,
    setSelectedSpecialty,
  ])

  useEffect(() => {
    if (modelMode === 'existing') {
      if (selectedProvider && marketRow) {
        const results = computeScenario(
          selectedProvider,
          marketRow,
          state.scenarioInputs
        )
        setLastResults(results)
      } else if (!state.selectedProviderId) {
        setLastResults(null)
      }
      return
    }
    if (modelMode === 'new' && syntheticProvider && marketRow) {
      const results = computeScenario(
        syntheticProvider,
        marketRow,
        state.scenarioInputs
      )
      setLastResults(results)
    } else if (modelMode === 'new') {
      setLastResults(null)
    }
  }, [
    modelMode,
    selectedProvider,
    syntheticProvider,
    marketRow,
    state.scenarioInputs,
    state.selectedProviderId,
    setLastResults,
  ])

  if (legalView) {
    return (
      <LegalPage
        type={legalView}
        onBack={() => {
          window.location.hash = ''
          setLegalView(null)
        }}
      />
    )
  }

  return (
    <AppLayout
      step={step}
      onStepChange={handleStepChange}
      currentBatchCard={batchCard}
      onBatchCardSelect={(id) => setBatchCard(id)}
    >
      {step === 'upload' && (
        <div className="space-y-6">
          <SectionTitleWithIcon icon={<FileUp />}>Import data</SectionTitleWithIcon>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadSaveDialogOpen(true)}
                    aria-label="Save scenario"
                  >
                    <Save className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Save scenario</TooltipContent>
              </Tooltip>
              {state.savedScenarios.length > 0 && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Saved scenarios (${state.savedScenarios.length})`}
                        >
                          <FolderOpen className="size-4" />
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Saved scenarios ({state.savedScenarios.length})
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
                    {[...state.savedScenarios].reverse().map((sc) => (
                      <DropdownMenuItem
                        key={sc.id}
                        onSelect={(e) => {
                          e.preventDefault()
                          loadScenario(sc.id)
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{sc.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            deleteScenario(sc.id)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${sc.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </DropdownMenuItem>
                    ))}
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
                      if (window.confirm('Clear all provider and market data and start over? This cannot be undone.')) {
                        setProviderData([], null)
                        setMarketData([], null)
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Reset data"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Reset data</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <UploadAndMapping
            onProviderData={setProviderData}
            onMarketData={setMarketData}
            existingProviderRows={state.providerRows}
            existingMarketRows={state.marketRows}
            onUpdateProviderRow={updateProvider}
            usedSampleDataOnLoad={state.usedSampleDataOnLoad}
            batchSynonymMap={state.batchSynonymMap}
            onAddSynonym={updateBatchSynonymMap}
            onRemoveSynonym={removeBatchSynonym}
            onNavigateToData={(tab) => handleStepChange('data', tab)}
          />

          <SaveScenarioDialog
            open={uploadSaveDialogOpen}
            onOpenChange={setUploadSaveDialogOpen}
            onSave={(name) => {
              saveCurrentScenario(name)
              setUploadSaveDialogOpen(false)
            }}
          />
        </div>
      )}

      {step === 'data' && (
        <DataTablesScreen
          providerRows={state.providerRows}
          marketRows={state.marketRows}
          dataTab={dataTab}
          onDataTabChange={setDataTab}
          onNavigateToUpload={() => handleStepChange('upload')}
          onUpdateProvider={updateProvider}
          onAddProvider={addProvider}
          onUpdateMarketRow={updateMarketRow}
          onAddMarketRow={addMarketRow}
        />
      )}

      {step === 'modeller' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitleWithIcon icon={<User />}>
              Single scenario
            </SectionTitleWithIcon>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (modellerStep === 'scenario') setModellerStep('provider')
                  else if (modellerStep === 'market') setModellerStep('scenario')
                  else if (modellerStep === 'results') setModellerStep('market')
                  else handleStepChange('data')
                }}
                className="gap-2"
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setModellerSaveDialogOpen(true)}
                      disabled={!canShowScenario}
                      aria-label="Save scenario"
                    >
                      <Save className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Save scenario</TooltipContent>
                </Tooltip>
                {state.savedScenarios.length > 0 ? (
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Saved scenarios (${state.savedScenarios.length})`}
                          >
                            <FolderOpen className="size-4" />
                            <ChevronDown className="size-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Saved scenarios ({state.savedScenarios.length})
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
                      {[...state.savedScenarios].reverse().map((sc) => (
                        <DropdownMenuItem
                          key={sc.id}
                          onSelect={(e) => {
                            e.preventDefault()
                            loadScenario(sc.id)
                          }}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{sc.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              deleteScenario(sc.id)
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${sc.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setScenarioInputs({ ...DEFAULT_SCENARIO_INPUTS })}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Reset scenario"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Reset scenario</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            {modellerStep === 'provider' && (
              <Tabs
                value={modelMode}
                onValueChange={(v) => {
                  const mode = v as ModelMode
                  setModelMode(mode)
                  if (mode === 'new') setSelectedProvider(null)
                }}
              >
                <TabsList className="w-auto sm:grid sm:grid-cols-2">
                  <TabsTrigger value="existing">Uploaded</TabsTrigger>
                  <TabsTrigger value="new">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <ModellerStepper
              currentStep={modellerStep}
              onStepChange={setModellerStep}
              canAdvanceFromProvider={!!canShowScenario}
              canAdvanceFromScenario={!!canShowScenario}
              canAdvanceFromMarket={!!canShowScenario}
              showNavButtons={false}
            />
          </div>

          {/* Step content: keyed so transition runs when step changes */}
          <div key={modellerStep} className="animate-in fade-in-0 duration-200">
          {/* Screen 1: Provider — select or enter provider + specialty */}
          {modellerStep === 'provider' && (
            <section>
              <Tabs
                value={modelMode}
                onValueChange={(v) => {
                  const mode = v as ModelMode
                  setModelMode(mode)
                  if (mode === 'new') setSelectedProvider(null)
                }}
                className="w-full"
              >
                <TabsContent value="existing" className="mt-0">
                  {hasData ? (
                    <ExistingProviderAndMarketCard
                      providerRows={state.providerRows}
                      selectedSpecialty={state.selectedSpecialty}
                      selectedProviderId={state.selectedProviderId}
                      marketRows={state.marketRows}
                      onSelectProvider={setSelectedProvider}
                      onSelectSpecialty={setSelectedSpecialty}
                      selectedProvider={effectiveProvider}
                      onUpdateProvider={
                        modelMode === 'existing' && state.selectedProviderId
                          ? (updates) => updateProvider(state.selectedProviderId!, updates)
                          : undefined
                      }
                      readOnlyProductivityModel={modelMode === 'existing'}
                    >
                      {effectiveProvider && (
                        <ProviderStatisticsContent
                          provider={effectiveProvider}
                          onUpdateProvider={
                            modelMode === 'existing' && state.selectedProviderId
                              ? (updates) => updateProvider(state.selectedProviderId!, updates)
                              : undefined
                          }
                          onSaveComplete={updateCurrentScenarioProviderSnapshot}
                          readOnlyProductivityModel={modelMode === 'existing'}
                        />
                      )}
                    </ExistingProviderAndMarketCard>
                  ) : (
                    <Card>
                      <CardContent className="py-6 text-center text-muted-foreground text-sm">
                        Upload provider and market files on the Upload screen first.
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="new" className="mt-0">
                  <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
                    {state.marketRows.length > 0 && (
                      <div className="flex min-w-0 flex-col">
                        <SpecialtySelect
                          marketRows={state.marketRows}
                          selectedSpecialty={state.selectedSpecialty}
                          onSelect={setSelectedSpecialty}
                        />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col">
                      <NewProviderForm
                        values={newProviderForm}
                        onChange={(updates) =>
                          setNewProviderForm((prev) => ({ ...prev, ...updates }))
                        }
                        disabled={state.marketRows.length === 0}
                        psqPercent={state.scenarioInputs.psqPercent}
                        psqBasis={state.scenarioInputs.psqBasis}
                      />
                    </div>
                  </div>
                  {state.marketRows.length === 0 && (
                    <Card>
                      <CardContent className="py-6 text-center text-muted-foreground text-sm">
                        Upload market data on the Upload screen first to model a hypothetical provider.
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </section>
          )}

          {/* Screen 2: Scenario — current vs modeled table (main levers: CF, wRVUs, PSQ) */}
          {modellerStep === 'scenario' && (
            <section className="space-y-6">
              {canShowScenario && state.lastResults ? (
                <>
                  {modelMode === 'existing' && effectiveProvider && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                      {effectiveProvider.providerName && (
                        <span>
                          <span className="text-muted-foreground font-medium">Provider:</span>{' '}
                          <span className="text-foreground">{effectiveProvider.providerName}</span>
                        </span>
                      )}
                      {(state.selectedSpecialty ?? effectiveProvider.specialty) && (
                        <span>
                          <span className="text-muted-foreground font-medium">Specialty:</span>{' '}
                          <span className="text-foreground">{state.selectedSpecialty ?? effectiveProvider.specialty}</span>
                        </span>
                      )}
                    </div>
                  )}
                  <BaselineVsModeledSection
                    provider={effectiveProvider}
                    results={state.lastResults}
                    scenarioInputs={state.scenarioInputs}
                    onScenarioChange={setScenarioInputs}
                  />
                </>
              ) : (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground text-sm">
                    Select a provider on the Provider step first to set scenario parameters.
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* Screen 3: Market data */}
          {modellerStep === 'market' && (
            <section>
              <h2 className="section-title">Market data</h2>
              <p className="section-subtitle mb-4">
                TCC, wRVU, and CF percentiles for the selected specialty.
              </p>
              {canShowScenario ? (
                <MarketDataCard
                  marketRow={marketRow}
                  specialtyLabel={state.selectedSpecialty ?? undefined}
                />
              ) : (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground text-sm">
                    Select a provider and specialty on the Provider step first.
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* Screen 4: Results — impact report first, then detailed comparison */}
          {modellerStep === 'results' && (
            <div className="space-y-10">
              {canShowScenario && state.lastResults ? (
                <>
                  <ImpactReportPage
                    results={state.lastResults}
                    provider={effectiveProvider}
                    scenarioInputs={state.scenarioInputs}
                    providerLabel={
                      effectiveProvider?.providerName
                        ? `${effectiveProvider.providerName}${effectiveProvider.specialty ? ` · ${effectiveProvider.specialty}` : ''}`
                        : undefined
                    }
                  />
                  <section className="border-border/60 border-t pt-8">
                    <h2 className="section-title mb-4">Market position & governance</h2>
                    <div className="grid gap-6 md:grid-cols-1">
                      <MarketPositionTable results={state.lastResults} />
                      <GovernanceFlags results={state.lastResults} />
                    </div>
                  </section>
                </>
              ) : (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground text-sm">
                    Select a provider and set scenario parameters in the previous steps to see results.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          </div>

          {state.lastScenarioLoadWarning && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
              role="alert"
            >
              <span className="text-amber-800 dark:text-amber-200">{state.lastScenarioLoadWarning}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                onClick={dismissScenarioLoadWarning}
              >
                Dismiss
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
            {modellerStep !== 'results' && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-1.5"
                disabled={
                  (modellerStep === 'provider' && !canShowScenario) ||
                  (modellerStep === 'scenario' && !canShowScenario) ||
                  (modellerStep === 'market' && !canShowScenario)
                }
                onClick={() => {
                  if (modellerStep === 'provider') setModellerStep('scenario')
                  else if (modellerStep === 'scenario') setModellerStep('market')
                  else if (modellerStep === 'market') setModellerStep('results')
                }}
              >
                Next:{' '}
                {modellerStep === 'provider'
                  ? 'Scenario'
                  : modellerStep === 'scenario'
                    ? 'Market data'
                    : 'Results'}
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>

          <SaveScenarioDialog
            open={modellerSaveDialogOpen}
            onOpenChange={setModellerSaveDialogOpen}
            onSave={(name) => saveCurrentScenario(name, effectiveProvider ?? undefined)}
          />
        </div>
      )}

      {step === 'batch-scenario' && batchCard === null && (
        <div className="space-y-6">
          <SectionTitleWithIcon icon={<LayoutGrid />}>Batch</SectionTitleWithIcon>
          <BatchCardPicker onSelect={setBatchCard} />
        </div>
      )}
      {step === 'compare-scenarios' && (
        <CompareScenariosScreen
          savedOptimizerConfigs={state.savedOptimizerConfigs}
          onBack={() => handleStepChange('upload')}
        />
      )}

      {step === 'reports' && (
        <ReportsScreen
          providerRows={state.providerRows}
          marketRows={state.marketRows}
          scenarioInputs={state.scenarioInputs}
          savedScenarios={state.savedScenarios}
          savedBatchRuns={state.savedBatchRuns}
          batchSynonymMap={state.batchSynonymMap}
          onBack={() => handleStepChange('upload')}
          onNavigateToCompareScenarios={() => handleStepChange('compare-scenarios')}
          onNavigateToBatchCard={(id) => {
            handleStepChange('batch-scenario')
            setBatchCard(id)
          }}
        />
      )}

      {step === 'help' && (
        <HelpScreen
          onNavigate={(s, batchCard) => {
            handleStepChange(s)
            if (batchCard != null) setBatchCard(batchCard)
          }}
        />
      )}

      {step === 'batch-scenario' && batchCard === 'cf-optimizer' && (
        <ConversionFactorOptimizerScreen
          providerRows={state.providerRows}
          marketRows={state.marketRows}
          scenarioInputs={state.scenarioInputs}
          synonymMap={state.batchSynonymMap}
          onBack={() => setBatchCard(null)}
          optimizerConfig={state.optimizerConfig}
          onOptimizerConfigChange={setOptimizerConfig}
          onClearOptimizerConfig={clearOptimizerConfig}
          savedOptimizerConfigs={state.savedOptimizerConfigs}
          onSaveOptimizerConfig={saveOptimizerConfig}
          onLoadOptimizerConfig={loadOptimizerConfig}
          onDeleteSavedOptimizerConfig={deleteSavedOptimizerConfig}
          onNavigateToCompareScenarios={() => handleStepChange('compare-scenarios')}
        />
      )}
      {step === 'batch-scenario' && batchCard === 'imputed-vs-market' && (
        <ImputedVsMarketScreen
          providerRows={state.providerRows}
          marketRows={state.marketRows}
          synonymMap={state.batchSynonymMap}
          onBack={() => setBatchCard(null)}
        />
      )}
      {step === 'batch-scenario' && batchCard === 'bulk-scenario' && (
        <BatchScenarioStep
          providerRows={state.providerRows}
          marketRows={state.marketRows}
          scenarioInputs={state.scenarioInputs}
          setScenarioInputs={setScenarioInputs}
          savedScenarios={state.savedScenarios}
          savedBatchScenarioConfigs={state.savedBatchScenarioConfigs}
          appliedBatchScenarioConfig={state.appliedBatchScenarioConfig}
          onLoadBatchScenarioConfig={loadBatchScenarioConfig}
          onBatchScenarioConfigApplied={clearAppliedBatchScenarioConfig}
          onDeleteBatchScenarioConfig={deleteSavedBatchScenarioConfig}
          batchSynonymMap={state.batchSynonymMap}
          onRunComplete={(results, snapshot) => handleBatchRunComplete('bulk', results, snapshot)}
          onNavigateToUpload={() => setStep('upload')}
          onSaveScenario={saveBatchScenarioConfig}
          onClearSavedScenarios={clearAllScenarios}
          mode="bulk"
          onBack={() => setBatchCard(null)}
          lastResults={state.batchResultsBulk}
          lastScenarioSnapshot={state.lastBatchScenarioSnapshotBulk}
          savedBatchRuns={state.savedBatchRuns}
          onSaveRun={(name) => saveCurrentBatchRun('bulk', name)}
          onLoadRun={(id) => loadSavedBatchRun(id, (mode) => {
            setStep('batch-results')
            setBatchCard(mode === 'bulk' ? 'bulk-scenario' : 'detailed-scenario')
          })}
          onDeleteRun={deleteSavedBatchRun}
        />
      )}
      {step === 'batch-scenario' && batchCard === 'detailed-scenario' && (
        <BatchScenarioStep
          providerRows={state.providerRows}
          marketRows={state.marketRows}
          scenarioInputs={state.scenarioInputs}
          setScenarioInputs={setScenarioInputs}
          savedScenarios={state.savedScenarios}
          savedBatchScenarioConfigs={state.savedBatchScenarioConfigs}
          appliedBatchScenarioConfig={state.appliedBatchScenarioConfig}
          onLoadBatchScenarioConfig={loadBatchScenarioConfig}
          onBatchScenarioConfigApplied={clearAppliedBatchScenarioConfig}
          onDeleteBatchScenarioConfig={deleteSavedBatchScenarioConfig}
          batchSynonymMap={state.batchSynonymMap}
          onRunComplete={(results, snapshot) => handleBatchRunComplete('detailed', results, snapshot)}
          onNavigateToUpload={() => setStep('upload')}
          onSaveScenario={saveBatchScenarioConfig}
          onClearSavedScenarios={clearAllScenarios}
          mode="detailed"
          onBack={() => setBatchCard(null)}
          lastResults={state.batchResultsDetailed}
          lastScenarioSnapshot={state.lastBatchScenarioSnapshotDetailed}
          savedBatchRuns={state.savedBatchRuns}
          onSaveRun={(name) => saveCurrentBatchRun('detailed', name)}
          onLoadRun={(id) => loadSavedBatchRun(id, (mode) => {
            setStep('batch-results')
            setBatchCard(mode === 'bulk' ? 'bulk-scenario' : 'detailed-scenario')
          })}
          onDeleteRun={deleteSavedBatchRun}
        />
      )}

      {step === 'batch-results' && (() => {
        const isDetailed = batchCard === 'detailed-scenario'
        const results = isDetailed ? state.batchResultsDetailed : state.batchResultsBulk
        const scenarioSnapshot = isDetailed ? state.lastBatchScenarioSnapshotDetailed : state.lastBatchScenarioSnapshotBulk
        const handleBack = () => {
          setStep('batch-scenario')
          setBatchCard(isDetailed ? 'detailed-scenario' : 'bulk-scenario')
        }
        if (!results) {
          return (
            <div className="space-y-6">
              <SectionTitleWithIcon icon={<Layers className="size-5" />}>
                Scenario results
              </SectionTitleWithIcon>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleBack} className="gap-2" aria-label="Back">
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              </div>
              <p className="text-muted-foreground">No results for this run. Run a scenario to see results here.</p>
            </div>
          )
        }
        const scopedResults = scopeResultsBySnapshot(results, scenarioSnapshot ?? null)
        const headerTitle = (
          <SectionTitleWithIcon icon={<Layers className="size-5" />}>
            Scenario results
          </SectionTitleWithIcon>
        )
        const headerLeft = (
          <Button type="button" variant="outline" size="sm" onClick={handleBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        )
        return (
          <div className="space-y-6">
            <BatchResultsDashboard
              results={scopedResults}
              marketRows={state.marketRows}
              savedBatchRuns={state.savedBatchRuns}
              scenarioSnapshot={scenarioSnapshot ?? null}
              onSaveRun={(name) => saveCurrentBatchRun(isDetailed ? 'detailed' : 'bulk', name)}
              onLoadRun={(id) => loadSavedBatchRun(id, (mode) => {
                setStep('batch-results')
                setBatchCard(mode === 'bulk' ? 'bulk-scenario' : 'detailed-scenario')
              })}
              onDeleteRun={deleteSavedBatchRun}
              headerTitle={headerTitle}
              headerLeft={headerLeft}
              providerRows={state.providerRows}
              synonymMap={state.batchSynonymMap}
            />
          </div>
        )
      })()}

    </AppLayout>
  )
}
