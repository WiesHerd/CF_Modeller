import { useState, useEffect, useCallback } from 'react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults, SavedScenario } from '@/types/scenario'
import type { ColumnMapping } from '@/types/upload'
import type { BatchResults, BatchOverrides, BatchScenarioSnapshot, SavedBatchRun, SavedBatchScenarioConfig, SynonymMap } from '@/types/batch'
import type { OptimizerConfigSnapshot, SavedOptimizerConfig } from '@/types/optimizer'
import * as storage from '@/lib/storage'
import * as batchStorage from '@/lib/batch-storage'
import * as optimizerStorage from '@/lib/optimizer-storage'

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
  /** Scenario(s) used for the last batch run; attached when saving a run so you can refer back. */
  lastBatchScenarioSnapshot: BatchScenarioSnapshot | null
  /** Saved batch runs the user can load or delete (persisted). */
  savedBatchRuns: SavedBatchRun[]
  /** Saved batch scenario configs (inputs, overrides, run-for) for reload and retweak (persisted). */
  savedBatchScenarioConfigs: SavedBatchScenarioConfig[]
  /** When set, batch scenario step should apply this config to its local state then clear (not persisted). */
  appliedBatchScenarioConfig: SavedBatchScenarioConfig | null
  /** Specialty synonym map for batch market matching (persisted). */
  batchSynonymMap: SynonymMap
  /** Batch provider file name and last uploaded time (for Dataset card). */
  batchFileName: string | null
  batchUploadedAt: string | null
  /** True when app started with no stored data and showed sample data (so UI can label it). */
  usedSampleDataOnLoad: boolean
  /** CF Optimizer form state (in-memory; persists when switching to Results and back until user clears). */
  optimizerConfig: OptimizerConfigSnapshot | null
  /** Saved optimizer scenarios for save/recall (persisted). */
  savedOptimizerConfigs: SavedOptimizerConfig[]
}

const defaultScenarioInputs: ScenarioInputs = {
  proposedCFPercentile: 40,
  cfAdjustmentFactor: 0.95,
  haircutPct: 5,
  overrideCF: undefined,
  cfSource: 'target_percentile',
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
  lastBatchScenarioSnapshot: null,
  savedBatchRuns: [],
  savedBatchScenarioConfigs: [],
  appliedBatchScenarioConfig: null,
  batchSynonymMap: {},
  batchFileName: null,
  batchUploadedAt: null,
  usedSampleDataOnLoad: false,
  optimizerConfig: null,
  savedOptimizerConfigs: [],
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    const providers = storage.loadProviders()
    const market = storage.loadMarket()
    const pm = storage.loadProviderMapping()
    const mm = storage.loadMarketMapping()
    const savedScenarios = storage.loadSavedScenarios()
    const batchResults = batchStorage.loadBatchResults()
    const savedBatchRuns = batchStorage.loadSavedBatchRuns()
    const savedBatchScenarioConfigs = batchStorage.loadSavedBatchScenarioConfigs()
    const savedOptimizerConfigs = optimizerStorage.loadSavedOptimizerConfigs()
    const batchSynonymMap = batchStorage.loadSynonymMap()
    const batchUploadMeta = batchStorage.loadBatchUploadMeta()
    const hasStoredData = providers.length > 0 && market.length > 0
    return {
      ...initialState,
      providerRows: hasStoredData ? providers : [],
      marketRows: hasStoredData ? market : [],
      providerMapping: hasStoredData ? pm : null,
      marketMapping: hasStoredData ? mm : null,
      savedScenarios,
      batchResults,
      savedBatchRuns,
      savedBatchScenarioConfigs,
      savedOptimizerConfigs,
      batchSynonymMap,
      batchFileName: batchUploadMeta.fileName ?? null,
      batchUploadedAt: batchUploadMeta.uploadedAt ?? null,
      usedSampleDataOnLoad: false,
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
    batchStorage.saveSavedBatchRuns(state.savedBatchRuns)
  }, [state.savedBatchRuns])

  useEffect(() => {
    batchStorage.saveSavedBatchScenarioConfigs(state.savedBatchScenarioConfigs)
  }, [state.savedBatchScenarioConfigs])

  useEffect(() => {
    optimizerStorage.saveSavedOptimizerConfigs(state.savedOptimizerConfigs)
  }, [state.savedOptimizerConfigs])

  useEffect(() => {
    batchStorage.saveSynonymMap(state.batchSynonymMap)
  }, [state.batchSynonymMap])

  useEffect(() => {
    if (state.batchFileName != null || state.batchUploadedAt != null)
      batchStorage.saveBatchUploadMeta({ fileName: state.batchFileName, uploadedAt: state.batchUploadedAt })
  }, [state.batchFileName, state.batchUploadedAt])

  const setProviderData = useCallback(
    (rows: ProviderRow[], mapping: ColumnMapping | null, fileName?: string) => {
      const now = new Date().toISOString()
      setState((s) => ({
        ...s,
        providerRows: rows,
        providerMapping: mapping,
        batchFileName: fileName ?? null,
        batchUploadedAt: fileName != null ? now : null,
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

  /** Clear all saved scenarios from the library (start fresh). */
  const clearAllScenarios = useCallback(() => {
    setState((s) => ({
      ...s,
      savedScenarios: [],
      currentScenarioId: null,
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

  const setBatchResults = useCallback((results: BatchResults | null, scenarioSnapshot?: BatchScenarioSnapshot | null) => {
    setState((s) => ({
      ...s,
      batchResults: results,
      lastBatchScenarioSnapshot: scenarioSnapshot ?? (results ? s.lastBatchScenarioSnapshot : null),
    }))
  }, [])

  const saveCurrentBatchRun = useCallback((name?: string) => {
    setState((s) => {
      if (!s.batchResults) return s
      const run = s.batchResults
      const displayName =
        name?.trim() ||
        `${run.providerCount} providers × ${run.scenarioCount} scenario(s) – ${new Date(run.runAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      const saved: SavedBatchRun = {
        id: crypto.randomUUID(),
        name: displayName,
        createdAt: new Date().toISOString(),
        results: { ...run, rows: [...run.rows] },
        ...(s.lastBatchScenarioSnapshot && { scenarioSnapshot: s.lastBatchScenarioSnapshot }),
      }
      if (batchStorage.getSavedRunSizeBytes(saved) > batchStorage.MAX_BATCH_RESULTS_BYTES) return s
      const list = [...s.savedBatchRuns, saved].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const trimmed = list.length > batchStorage.MAX_SAVED_BATCH_RUNS_LIMIT ? list.slice(-batchStorage.MAX_SAVED_BATCH_RUNS_LIMIT) : list
      return { ...s, savedBatchRuns: trimmed }
    })
  }, [])

  const loadSavedBatchRun = useCallback((id: string) => {
    setState((s) => {
      const run = s.savedBatchRuns.find((r) => r.id === id)
      if (!run) return s
      return { ...s, batchResults: run.results }
    })
  }, [])

  const deleteSavedBatchRun = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedBatchRuns: s.savedBatchRuns.filter((r) => r.id !== id),
    }))
  }, [])

  const saveBatchScenarioConfig = useCallback((config: Omit<SavedBatchScenarioConfig, 'id' | 'createdAt'>) => {
    setState((s) => {
      const saved: SavedBatchScenarioConfig = {
        ...config,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      const list = [...s.savedBatchScenarioConfigs, saved].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const trimmed = list.length > 20 ? list.slice(-20) : list
      return { ...s, savedBatchScenarioConfigs: trimmed }
    })
  }, [])

  const loadBatchScenarioConfig = useCallback((config: SavedBatchScenarioConfig) => {
    setState((s) => ({
      ...s,
      scenarioInputs: { ...config.scenarioInputs },
      appliedBatchScenarioConfig: config,
    }))
  }, [])

  const clearAppliedBatchScenarioConfig = useCallback(() => {
    setState((s) => ({ ...s, appliedBatchScenarioConfig: null }))
  }, [])

  /** Create a scenario config from optimizer recommended CF overrides and set as applied (user then opens Batch Scenario to see pre-filled overrides). */
  const applyOptimizerOverrides = useCallback((overrides: BatchOverrides) => {
    setState((s) => {
      const config: SavedBatchScenarioConfig = {
        id: crypto.randomUUID(),
        name: 'Optimizer recommended CFs',
        createdAt: new Date().toISOString(),
        scenarioInputs: { ...s.scenarioInputs },
        overrides,
        selectedSpecialties: [],
        selectedProviderIds: [],
        runBaseScenarioOnly: true,
      }
      return { ...s, appliedBatchScenarioConfig: config }
    })
  }, [])

  const deleteSavedBatchScenarioConfig = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedBatchScenarioConfigs: s.savedBatchScenarioConfigs.filter((c) => c.id !== id),
    }))
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

  const setOptimizerConfig = useCallback((snapshot: OptimizerConfigSnapshot | null) => {
    setState((s) => ({ ...s, optimizerConfig: snapshot }))
  }, [])

  const clearOptimizerConfig = useCallback(() => {
    setState((s) => ({ ...s, optimizerConfig: null }))
  }, [])

  const saveOptimizerConfig = useCallback((name: string) => {
    setState((s) => {
      if (!s.optimizerConfig) return s
      const saved: SavedOptimizerConfig = {
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        snapshot: s.optimizerConfig,
      }
      const list = [...s.savedOptimizerConfigs, saved].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const trimmed = list.length > 20 ? list.slice(-20) : list
      return { ...s, savedOptimizerConfigs: trimmed }
    })
  }, [])

  const loadOptimizerConfig = useCallback((id: string) => {
    setState((s) => {
      const found = s.savedOptimizerConfigs.find((c) => c.id === id)
      if (!found) return s
      return { ...s, optimizerConfig: found.snapshot }
    })
  }, [])

  const deleteSavedOptimizerConfig = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedOptimizerConfigs: s.savedOptimizerConfigs.filter((c) => c.id !== id),
    }))
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
    clearAllScenarios,
    duplicateScenario,
    updateCurrentScenarioProviderSnapshot,
    setBatchResults,
    saveCurrentBatchRun,
    loadSavedBatchRun,
    deleteSavedBatchRun,
    saveBatchScenarioConfig,
    loadBatchScenarioConfig,
    clearAppliedBatchScenarioConfig,
    applyOptimizerOverrides,
    deleteSavedBatchScenarioConfig,
    setBatchSynonymMap,
    updateBatchSynonymMap,
    removeBatchSynonym,
    setOptimizerConfig,
    clearOptimizerConfig,
    saveOptimizerConfig,
    loadOptimizerConfig,
    deleteSavedOptimizerConfig,
  }
}
