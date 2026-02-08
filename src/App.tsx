import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/hooks/use-app-state'
import { computeScenario } from '@/lib/compute'
import { AppLayout, type AppStep } from '@/components/layout/app-layout'
import { UploadAndMapping } from '@/components/upload-and-mapping'
import { ModellerTopSection } from '@/components/modeller-top-section'
import { SpecialtySelect } from '@/components/specialty-select'
import { ProviderDivisionSelect } from '@/components/provider-division-select'
import { ScenarioControls } from '@/components/scenario-controls'
import { ResultsDashboard } from '@/components/results-dashboard'
import { DivisionTable, type DivisionRow } from '@/components/division-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function App() {
  const [step, setStep] = useState<AppStep>('upload')

  const {
    state,
    setProviderData,
    setMarketData,
    setSelectedSpecialty,
    setSelectedProvider,
    setSelectedDivision,
    setScenarioInputs,
    setLastResults,
    setDivisionResults,
  } = useAppState()

  const marketRow = useMemo(() => {
    if (!state.selectedSpecialty || state.marketRows.length === 0) return null
    return (
      state.marketRows.find(
        (r) =>
          (r.specialty ?? '').toLowerCase() ===
          state.selectedSpecialty!.toLowerCase()
      ) ?? null
    )
  }, [state.marketRows, state.selectedSpecialty])

  const selectedProvider = useMemo(() => {
    if (!state.selectedProviderId) return null
    return (
      state.providerRows.find(
        (p) => p.providerId === state.selectedProviderId
      ) ?? null
    )
  }, [state.providerRows, state.selectedProviderId])

  const divisionProviders = useMemo(() => {
    if (!state.selectedDivision) return []
    return state.providerRows.filter(
      (p) =>
        (p.division ?? '').toLowerCase() ===
        state.selectedDivision!.toLowerCase()
    )
  }, [state.providerRows, state.selectedDivision])

  const hasData = state.providerRows.length > 0 && state.marketRows.length > 0
  const hasSpecialty = !!state.selectedSpecialty && !!marketRow
  const canShowScenario =
    hasData &&
    hasSpecialty &&
    (!!state.selectedProviderId || !!state.selectedDivision)

  // Default selection when data exists but nothing selected
  useEffect(() => {
    if (!hasData) return
    if (!state.selectedSpecialty && state.marketRows.length > 0) {
      const first = state.marketRows[0]
      if (first?.specialty) setSelectedSpecialty(first.specialty)
    }
  }, [
    hasData,
    state.marketRows,
    state.selectedSpecialty,
    setSelectedSpecialty,
  ])

  useEffect(() => {
    if (
      hasData &&
      hasSpecialty &&
      !state.selectedProviderId &&
      !state.selectedDivision &&
      state.providerRows.length > 0
    ) {
      const first = state.providerRows[0]
      if (first?.providerId) setSelectedProvider(first.providerId)
    }
  }, [
    hasData,
    hasSpecialty,
    state.providerRows,
    state.selectedProviderId,
    state.selectedDivision,
    setSelectedProvider,
  ])

  useEffect(() => {
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
  }, [
    selectedProvider,
    marketRow,
    state.scenarioInputs,
    state.selectedProviderId,
    setLastResults,
  ])

  useEffect(() => {
    if (state.selectedDivision && divisionProviders.length > 0 && marketRow) {
      const results = divisionProviders.map((provider) =>
        computeScenario(provider, marketRow, state.scenarioInputs)
      )
      setDivisionResults(results)
    } else if (!state.selectedDivision) {
      setDivisionResults(null)
    }
  }, [
    state.selectedDivision,
    divisionProviders,
    marketRow,
    state.scenarioInputs,
    setDivisionResults,
  ])

  const divisionTableRows: DivisionRow[] = useMemo(() => {
    if (!state.divisionResults || state.divisionResults.length === 0 || divisionProviders.length === 0)
      return []
    return divisionProviders.map((provider, i) => ({
      provider,
      results: state.divisionResults![i]!,
    }))
  }, [state.divisionResults, divisionProviders])

  return (
    <AppLayout
      step={step}
      onStepChange={setStep}
      canShowModeller={hasData}
    >
      {step === 'upload' && (
        <div className="space-y-6">
          <h2 className="section-title">Upload & data</h2>
          <p className="section-subtitle mb-4">
            Import provider and market files (CSV or XLSX), then map columns if needed. One example provider and market row are pre-loaded for testing.
          </p>
          <UploadAndMapping
            onProviderData={setProviderData}
            onMarketData={setMarketData}
            existingProviderRows={state.providerRows}
            existingMarketRows={state.marketRows}
          />
        </div>
      )}

      {step === 'modeller' && (
        <div className="space-y-8">
          {/* Top portion: Provider Input + Market Data (Excel-style) */}
          <section>
            <ModellerTopSection
              provider={selectedProvider}
              marketRow={marketRow}
              scenarioInputs={state.scenarioInputs}
              specialtyLabel={state.selectedSpecialty ?? undefined}
            />
          </section>

          {/* Select specialty & provider */}
          <section>
            <h2 className="section-title">Select specialty & provider</h2>
            <p className="section-subtitle mb-4">
              Choose market cut and a single provider or division. Change any variable below to see how the model recalculates.
            </p>
            {state.marketRows.length > 0 && (
              <SpecialtySelect
                marketRows={state.marketRows}
                selectedSpecialty={state.selectedSpecialty}
                onSelect={setSelectedSpecialty}
              />
            )}
            {state.providerRows.length > 0 && (
              <ProviderDivisionSelect
                providerRows={state.providerRows}
                selectedSpecialty={state.selectedSpecialty}
                selectedProviderId={state.selectedProviderId}
                selectedDivision={state.selectedDivision}
                onSelectProvider={setSelectedProvider}
                onSelectDivision={setSelectedDivision}
              />
            )}
            {!hasData && (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  Upload provider and market files on the Upload screen first.
                </CardContent>
              </Card>
            )}
          </section>

          {/* Scenario controls */}
          <section>
            <h2 className="section-title">Scenario controls</h2>
            <p className="section-subtitle mb-4">
              Set CF percentile, adjustment factor, PSQ, and threshold method. Results update as you change values.
            </p>
            {canShowScenario ? (
              <ScenarioControls
                inputs={state.scenarioInputs}
                onChange={setScenarioInputs}
                selectedProvider={selectedProvider}
              />
            ) : (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  Select a specialty and a provider or division above to adjust scenario inputs.
                </CardContent>
              </Card>
            )}
          </section>

          {/* Results */}
          <section>
            <h2 className="section-title">Results</h2>
            <p className="section-subtitle mb-4">
              Current vs modeled TCC, percentiles, and risk assessment. Updates when you change selections or scenario inputs.
            </p>
            {state.lastResults && (
              <ResultsDashboard results={state.lastResults} />
            )}
            {divisionTableRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Division results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DivisionTable rows={divisionTableRows} />
                </CardContent>
              </Card>
            )}
            {canShowScenario && !state.lastResults && divisionTableRows.length === 0 && (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  Select a single provider (not a division) to see detailed results here, or view division results in the table above.
                </CardContent>
              </Card>
            )}
            {hasData && hasSpecialty && !state.selectedProviderId && !state.selectedDivision && (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  Select a provider or division above to see results.
                </CardContent>
              </Card>
            )}
            {!hasData && (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  Upload data on the Upload screen, then select a specialty and provider to see results.
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  )
}
