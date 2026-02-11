import { useState, useEffect, useCallback } from 'react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults, SavedScenario } from '@/types/scenario'
import type { ColumnMapping } from '@/types/upload'
import type { BatchResults, SynonymMap } from '@/types/batch'
import * as storage from '@/lib/storage'
import * as batchStorage from '@/lib/batch-storage'
import { SAMPLE_PROVIDER_ROWS, SAMPLE_MARKET_ROWS } from '@/utils/fake-test-data'

export interface AppState {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  providerMapping: ColumnMapping | null
  marketMapping: ColumnMapping | null
  selectedSpecialty: string | null
  selectedProviderId: string | null
  scenarioInputs: ScenarioInputs
  lastResults: ScenarioResults | null
  savedScenarios: SavedScenario[]
  /** Set when loading a scenario and provider/specialty is missing; clear on next load or dismiss. */
  lastScenarioLoadWarning: string | null
  /** When set, provider Save on the Provider step updates this scenario's provider snapshot (same as Scenario planning). */
  currentScenarioId: string | null
  /** Last batch run results (persisted to localStorage when not too large). */
  batchResults: BatchResults | null
  /** Specialty synonym map for batch market matching (persisted). */
  batchSynonymMap: SynonymMap
  /** True when app started with no stored data and showed sample data (so UI can label it). */
  usedSampleDataOnLoad: boolean
}

const defaultScenarioInputs: ScenarioInputs = {
  proposedCFPercentile: 40,
  cfAdjustmentFactor: 0.95,
  haircutPct: 5,
  overrideCF: undefined,
  cfSource: 'target_haircut',
  psqPercent: 0,
  currentPsqPercent: 0,
  psqBasis: 'base_salary',
  thresholdMethod: 'derived',
  annualThreshold: 0,
  wrvuPercentile: 50,
}

const initialState: AppState = {
  providerRows: [],
  marketRows: [],
  providerMapping: null,
  marketMapping: null,
  selectedSpecialty: null,
  selectedProviderId: null,
  scenarioInputs: defaultScenarioInputs,
  lastResults: null,
  savedScenarios: [],
  lastScenarioLoadWarning: null,
  currentScenarioId: null,
  batchResults: null,
  batchSynonymMap: {},
  usedSampleDataOnLoad: false,
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    const providers = storage.loadProviders()
    const market = storage.loadMarket()
    const pm = storage.loadProviderMapping()
    const mm = storage.loadMarketMapping()
    const savedScenarios = storage.loadSavedScenarios()
    const batchResults = batchStorage.loadBatchResults()
    const batchSynonymMap = batchStorage.loadSynonymMap()
    // When no data has been uploaded yet, seed with one example provider + market for testing
    const hasStoredData = providers.length > 0 && market.length > 0
    return {
      ...initialState,
      providerRows: hasStoredData ? providers : SAMPLE_PROVIDER_ROWS,
      marketRows: hasStoredData ? market : SAMPLE_MARKET_ROWS,
      providerMapping: hasStoredData ? pm : null,
      marketMapping: hasStoredData ? mm : null,
      savedScenarios,
      batchResults,
      batchSynonymMap,
      usedSampleDataOnLoad: !hasStoredData,
    }
  })

  useEffect(() => {
    if (state.providerRows.length > 0) storage.saveProviders(state.providerRows)
  }, [state.providerRows])

  useEffect(() => {
    if (state.marketRows.length > 0) storage.saveMarket(state.marketRows)
  }, [state.marketRows])

  useEffect(() => {
    if (state.providerMapping && Object.keys(state.providerMapping).length > 0)
      storage.saveProviderMapping(state.providerMapping)
  }, [state.providerMapping])

  useEffect(() => {
    if (state.marketMapping && Object.keys(state.marketMapping).length > 0)
      storage.saveMarketMapping(state.marketMapping)
  }, [state.marketMapping])

  useEffect(() => {
    if (state.savedScenarios.length > 0)
      storage.saveSavedScenarios(state.savedScenarios)
  }, [state.savedScenarios])

  useEffect(() => {
    if (state.batchResults) batchStorage.saveBatchResults(state.batchResults)
  }, [state.batchResults])

  useEffect(() => {
    batchStorage.saveSynonymMap(state.batchSynonymMap)
  }, [state.batchSynonymMap])

  const setProviderData = useCallback(
    (rows: ProviderRow[], mapping: ColumnMapping | null) => {
      setState((s) => ({
        ...s,
        providerRows: rows,
        providerMapping: mapping,
        selectedProviderId: null,
        lastResults: null,
        usedSampleDataOnLoad: false,
      }))
    },
    []
  )

  const setMarketData = useCallback(
    (rows: MarketRow[], mapping: ColumnMapping | null) => {
      setState((s) => ({
        ...s,
        marketRows: rows,
        marketMapping: mapping,
        selectedSpecialty: null,
        lastResults: null,
        usedSampleDataOnLoad: false,
      }))
    },
    []
  )

  const setSelectedSpecialty = useCallback((specialty: string | null) => {
    setState((s) => ({
      ...s,
      selectedSpecialty: specialty,
      lastResults: null,
    }))
  }, [])

  const setSelectedProvider = useCallback((providerId: string | null) => {
    setState((s) => ({
      ...s,
      selectedProviderId: providerId,
      lastResults: null,
    }))
  }, [])

  const updateProvider = useCallback((providerId: string, updates: Partial<ProviderRow>) => {
    setState((s) => ({
      ...s,
      providerRows: s.providerRows.map((row) =>
        row.providerId === providerId ? { ...row, ...updates } : row
      ),
    }))
  }, [])

  const setScenarioInputs = useCallback((inputs: Partial<ScenarioInputs>) => {
    setState((s) => ({
      ...s,
      scenarioInputs: { ...s.scenarioInputs, ...inputs },
    }))
  }, [])

  const setLastResults = useCallback((results: ScenarioResults | null) => {
    setState((s) => ({ ...s, lastResults: results }))
  }, [])

  const dismissScenarioLoadWarning = useCallback(() => {
    setState((s) => ({ ...s, lastScenarioLoadWarning: null }))
  }, [])

  const saveCurrentScenario = useCallback(
    (name: string, providerSnapshot?: ProviderRow | null) => {
      setState((s) => {
        const saved: SavedScenario = {
          id: crypto.randomUUID(),
          name,
          createdAt: new Date().toISOString(),
          scenarioInputs: { ...s.scenarioInputs },
          selectedProviderId: s.selectedProviderId,
          selectedSpecialty: s.selectedSpecialty,
          ...(providerSnapshot && { providerSnapshot: { ...providerSnapshot } }),
        }
        const next = [...s.savedScenarios, saved]
        return {
          ...s,
          savedScenarios: next,
          lastScenarioLoadWarning: null,
          currentScenarioId: saved.id,
        }
      })
    },
    []
  )

  const updateCurrentScenarioProviderSnapshot = useCallback((provider: ProviderRow) => {
    setState((s) => {
      if (!s.currentScenarioId) return s
      const next = s.savedScenarios.map((sc) =>
        sc.id === s.currentScenarioId
          ? { ...sc, providerSnapshot: { ...provider } }
          : sc
      )
      return { ...s, savedScenarios: next }
    })
  }, [])

  const loadScenario = useCallback((id: string) => {
    setState((s) => {
      const scenario = s.savedScenarios.find((sc) => sc.id === id)
      if (!scenario) return s
      const providerExists =
        scenario.selectedProviderId == null ||
        s.providerRows.some((r) => r.providerId === scenario.selectedProviderId)
      const specialtyExists =
        scenario.selectedSpecialty == null ||
        s.marketRows.some(
          (r) =>
            (r.specialty ?? '').toLowerCase() ===
            (scenario.selectedSpecialty ?? '').toLowerCase()
        )
      let warning: string | null = null
      let selectedProviderId = scenario.selectedProviderId
      let selectedSpecialty = scenario.selectedSpecialty
      if (!providerExists) {
        warning = 'Provider from scenario not found; specialty and inputs restored.'
        selectedProviderId =
          scenario.selectedSpecialty != null
            ? s.providerRows.find(
                (r) =>
                  (r.specialty ?? '').toLowerCase() ===
                  (scenario.selectedSpecialty ?? '').toLowerCase()
              )?.providerId ?? null
            : null
      }
      if (!specialtyExists) {
        warning =
          warning ??
          'Specialty from scenario not in market data; inputs and provider restored.'
        selectedSpecialty = s.marketRows[0]?.specialty ?? null
      }
      return {
        ...s,
        scenarioInputs: { ...scenario.scenarioInputs },
        selectedProviderId,
        selectedSpecialty,
        lastResults: null,
        lastScenarioLoadWarning: warning,
        currentScenarioId: scenario.id,
      }
    })
  }, [])

  const deleteScenario = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedScenarios: s.savedScenarios.filter((sc) => sc.id !== id),
      currentScenarioId: s.currentScenarioId === id ? null : s.currentScenarioId,
    }))
  }, [])

  const duplicateScenario = useCallback((id: string) => {
    setState((s) => {
      const scenario = s.savedScenarios.find((sc) => sc.id === id)
      if (!scenario) return s
      const copy: SavedScenario = {
        ...scenario,
        id: crypto.randomUUID(),
        name: `Copy of ${scenario.name}`,
        createdAt: new Date().toISOString(),
        scenarioInputs: { ...scenario.scenarioInputs },
        ...(scenario.providerSnapshot && {
          providerSnapshot: { ...scenario.providerSnapshot },
        }),
      }
      return { ...s, savedScenarios: [...s.savedScenarios, copy] }
    })
  }, [])

  const setBatchResults = useCallback((results: BatchResults | null) => {
    setState((s) => ({ ...s, batchResults: results }))
  }, [])

  const setBatchSynonymMap = useCallback((map: SynonymMap) => {
    setState((s) => ({ ...s, batchSynonymMap: map }))
  }, [])

  const updateBatchSynonymMap = useCallback((key: string, value: string) => {
    setState((s) => ({
      ...s,
      batchSynonymMap: { ...s.batchSynonymMap, [key]: value },
    }))
  }, [])

  const removeBatchSynonym = useCallback((key: string) => {
    setState((s) => {
      const next = { ...s.batchSynonymMap }
      delete next[key]
      return { ...s, batchSynonymMap: next }
    })
  }, [])

  return {
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
    setBatchSynonymMap,
    updateBatchSynonymMap,
    removeBatchSynonym,
  }
}
