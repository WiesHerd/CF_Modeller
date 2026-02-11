import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '@/hooks/use-app-state'
import { computeScenario } from '@/lib/compute'
import { AppLayout, type AppStep, type AppMode } from '@/components/layout/app-layout'
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
import { SavedScenariosSection } from '@/components/saved-scenarios-section'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BatchScenarioStep } from '@/components/batch/batch-scenario-step'
import { BatchResultsDashboard } from '@/components/batch/batch-results-dashboard'
import { LegalPage } from '@/components/legal-page'
import type { ProviderRow } from '@/types/provider'
import type { BatchResults } from '@/types/batch'

type ModelMode = 'existing' | 'new'

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
    setScenarioInputs,
    setLastResults,
    dismissScenarioLoadWarning,
    saveCurrentScenario,
    loadScenario,
    deleteScenario,
    duplicateScenario,
    updateCurrentScenarioProviderSnapshot,
    setBatchResults,
    updateBatchSynonymMap,
    removeBatchSynonym,
  } = useAppState()

  const [step, setStep] = useState<AppStep>(
    () =>
      state.providerRows.length > 0 && state.marketRows.length > 0
        ? 'modeller'
        : 'upload'
  )
  const [appMode, setAppMode] = useState<AppMode>('single')
  const [modelMode, setModelMode] = useState<ModelMode>('existing')
  const [modellerStep, setModellerStep] = useState<ModellerStep>('provider')
  const [newProviderForm, setNewProviderForm] = useState<NewProviderFormValues>(DEFAULT_NEW_PROVIDER)

  const handleAppModeChange = (mode: AppMode) => {
    setAppMode(mode)
    if (mode === 'batch') {
      // When switching to Batch, show batch content: go to Batch scenario (or keep Results if already there)
      if (step !== 'batch-scenario' && step !== 'batch-results') {
        setStep('batch-scenario')
      }
    }
    if (mode === 'single' && (step === 'batch-scenario' || step === 'batch-results')) {
      setStep('modeller')
    }
  }

  const handleBatchRunComplete = (results: BatchResults) => {
    setBatchResults(results)
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
      onStepChange={setStep}
      appMode={appMode}
      onAppModeChange={handleAppModeChange}
      canShowModeller={hasData || state.marketRows.length > 0}
      canShowBatchResults={!!state.batchResults}
    >
      {step === 'upload' && (
        <div className="space-y-6">
          <h2 className="section-title">Upload & data</h2>
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
          />
        </div>
      )}

      {step === 'modeller' && (
        <div className="space-y-8">
          <ModellerStepper
            currentStep={modellerStep}
            onStepChange={setModellerStep}
            canAdvanceFromProvider={!!canShowScenario}
            canAdvanceFromScenario={!!canShowScenario}
            canAdvanceFromMarket={!!canShowScenario}
          />

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
                <TabsList className="mb-4 w-full max-w-md sm:grid sm:grid-cols-2">
                  <TabsTrigger value="existing" className="w-full">
                    From upload
                  </TabsTrigger>
                  <TabsTrigger value="new" className="w-full">
                    New
                  </TabsTrigger>
                </TabsList>

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
                      <div className="ml-auto shrink-0">
                        <SavedScenariosSection
                          scenarios={state.savedScenarios}
                          onLoad={loadScenario}
                          onDuplicate={duplicateScenario}
                          onDelete={deleteScenario}
                          onSaveNew={(name) =>
                            saveCurrentScenario(name, effectiveProvider ?? undefined)
                          }
                          loadWarning={state.lastScenarioLoadWarning}
                          onDismissWarning={dismissScenarioLoadWarning}
                          canSave={!!canShowScenario}
                        />
                      </div>
                    </div>
                  )}
                  {modelMode === 'new' && (
                    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                      <SavedScenariosSection
                        scenarios={state.savedScenarios}
                        onLoad={loadScenario}
                        onDuplicate={duplicateScenario}
                        onDelete={deleteScenario}
                        onSaveNew={(name) =>
                          saveCurrentScenario(name, effectiveProvider ?? undefined)
                        }
                        loadWarning={state.lastScenarioLoadWarning}
                        onDismissWarning={dismissScenarioLoadWarning}
                        canSave={!!canShowScenario}
                      />
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
                <>
                  <Card>
                    <CardContent className="py-6 text-center text-muted-foreground text-sm">
                      Select a provider on the Provider step first to set scenario parameters.
                    </CardContent>
                  </Card>
                  <div className="flex justify-end">
                    <SavedScenariosSection
                      scenarios={state.savedScenarios}
                      onLoad={loadScenario}
                      onDuplicate={duplicateScenario}
                      onDelete={deleteScenario}
                      onSaveNew={(name) =>
                        saveCurrentScenario(name, effectiveProvider ?? undefined)
                      }
                      loadWarning={state.lastScenarioLoadWarning}
                      onDismissWarning={dismissScenarioLoadWarning}
                      canSave={!!canShowScenario}
                    />
                  </div>
                </>
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
      )}

      {step === 'batch-scenario' && (
        <BatchScenarioStep
          providerRows={state.providerRows}
          marketRows={state.marketRows}
          scenarioInputs={state.scenarioInputs}
          setScenarioInputs={setScenarioInputs}
          savedScenarios={state.savedScenarios}
          batchSynonymMap={state.batchSynonymMap}
          onRunComplete={handleBatchRunComplete}
          onNavigateToUpload={() => setStep('upload')}
        />
      )}

      {step === 'batch-results' && state.batchResults && (
        <BatchResultsDashboard results={state.batchResults} />
      )}

      {step === 'batch-results' && !state.batchResults && (
        <div className="space-y-6">
          <h2 className="section-title">Batch results</h2>
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Run the model on the Batch scenario step first to see results.
            </CardContent>
          </Card>
        </div>
      )}

    </AppLayout>
  )
}
