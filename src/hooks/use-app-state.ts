import { useState, useEffect } from 'react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults, SavedScenario } from '@/types/scenario'
import type { ColumnMapping } from '@/types/upload'
import type {
  BatchResults,
  BatchScenarioSnapshot,
  SavedBatchRun,
  SavedBatchScenarioConfig,
  SynonymMap,
} from '@/types/batch'
import type { OptimizerConfigSnapshot, SavedOptimizerConfig } from '@/types/optimizer'
import type { ProductivityTargetConfigSnapshot, SavedProductivityTargetConfig } from '@/types/productivity-target'
import * as storage from '@/lib/storage'
import * as batchStorage from '@/lib/batch-storage'
import * as optimizerStorage from '@/lib/optimizer-storage'
import * as productivityTargetStorage from '@/lib/productivity-target-storage'
import { useProviderActions } from '@/hooks/use-provider-actions'
import { useBatchActions } from '@/hooks/use-batch-actions'
import { useOptimizerActions } from '@/hooks/use-optimizer-actions'
import { useProductivityTargetActions } from '@/hooks/use-productivity-target-actions'

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
  /** When set, provider Save on the Provider step updates this scenario's provider snapshot. */
  currentScenarioId: string | null
  batchResultsBulk: BatchResults | null
  lastBatchScenarioSnapshotBulk: BatchScenarioSnapshot | null
  batchResultsDetailed: BatchResults | null
  lastBatchScenarioSnapshotDetailed: BatchScenarioSnapshot | null
  savedBatchRuns: SavedBatchRun[]
  savedBatchScenarioConfigs: SavedBatchScenarioConfig[]
  appliedBatchScenarioConfig: SavedBatchScenarioConfig | null
  batchSynonymMap: SynonymMap
  batchFileName: string | null
  batchUploadedAt: string | null
  usedSampleDataOnLoad: boolean
  optimizerConfig: OptimizerConfigSnapshot | null
  loadedOptimizerConfigId: string | null
  savedOptimizerConfigs: SavedOptimizerConfig[]
  productivityTargetConfig: ProductivityTargetConfigSnapshot | null
  loadedProductivityTargetConfigId: string | null
  savedProductivityTargetConfigs: SavedProductivityTargetConfig[]
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
  batchResultsBulk: null,
  lastBatchScenarioSnapshotBulk: null,
  batchResultsDetailed: null,
  lastBatchScenarioSnapshotDetailed: null,
  savedBatchRuns: [],
  savedBatchScenarioConfigs: [],
  appliedBatchScenarioConfig: null,
  batchSynonymMap: {},
  batchFileName: null,
  batchUploadedAt: null,
  usedSampleDataOnLoad: false,
  optimizerConfig: null,
  loadedOptimizerConfigId: null,
  savedOptimizerConfigs: [],
  productivityTargetConfig: null,
  loadedProductivityTargetConfigId: null,
  savedProductivityTargetConfigs: [],
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    const providers = storage.loadProviders()
    const market = storage.loadMarket()
    const pm = storage.loadProviderMapping()
    const mm = storage.loadMarketMapping()
    const savedScenarios = storage.loadSavedScenarios()
    const batchResultsByMode = batchStorage.loadBatchResultsByMode()
    const savedBatchRuns = batchStorage.loadSavedBatchRuns()
    const savedBatchScenarioConfigs = batchStorage.loadSavedBatchScenarioConfigs()
    const savedOptimizerConfigs = optimizerStorage.loadSavedOptimizerConfigs()
    const savedProductivityTargetConfigs = productivityTargetStorage.loadSavedProductivityTargetConfigs()
    const batchSynonymMap = batchStorage.loadSynonymMap()
    const batchUploadMeta = batchStorage.loadBatchUploadMeta()
    return {
      ...initialState,
      providerRows: providers,
      marketRows: market,
      providerMapping: pm,
      marketMapping: mm,
      savedScenarios,
      batchResultsBulk: batchResultsByMode.bulk,
      lastBatchScenarioSnapshotBulk: null,
      batchResultsDetailed: batchResultsByMode.detailed,
      lastBatchScenarioSnapshotDetailed: null,
      savedBatchRuns,
      savedBatchScenarioConfigs,
      savedOptimizerConfigs,
      savedProductivityTargetConfigs,
      batchSynonymMap,
      batchFileName: batchUploadMeta.fileName ?? null,
      batchUploadedAt: batchUploadMeta.uploadedAt ?? null,
      usedSampleDataOnLoad: false,
    }
  })

  // Persistence side-effects
  useEffect(() => { storage.saveProviders(state.providerRows) }, [state.providerRows])
  useEffect(() => { storage.saveMarket(state.marketRows) }, [state.marketRows])
  useEffect(() => {
    if (state.providerMapping != null && Object.keys(state.providerMapping).length > 0) {
      storage.saveProviderMapping(state.providerMapping)
    } else {
      storage.clearProviderMapping()
    }
  }, [state.providerMapping])
  useEffect(() => {
    if (state.marketMapping != null && Object.keys(state.marketMapping).length > 0) {
      storage.saveMarketMapping(state.marketMapping)
    } else {
      storage.clearMarketMapping()
    }
  }, [state.marketMapping])
  useEffect(() => {
    if (state.savedScenarios.length > 0) storage.saveSavedScenarios(state.savedScenarios)
  }, [state.savedScenarios])
  useEffect(() => {
    if (state.batchResultsBulk) batchStorage.saveBatchResults(state.batchResultsBulk, 'bulk')
  }, [state.batchResultsBulk])
  useEffect(() => {
    if (state.batchResultsDetailed) batchStorage.saveBatchResults(state.batchResultsDetailed, 'detailed')
  }, [state.batchResultsDetailed])
  useEffect(() => { batchStorage.saveSavedBatchRuns(state.savedBatchRuns) }, [state.savedBatchRuns])
  useEffect(() => {
    batchStorage.saveSavedBatchScenarioConfigs(state.savedBatchScenarioConfigs)
  }, [state.savedBatchScenarioConfigs])
  useEffect(() => {
    optimizerStorage.saveSavedOptimizerConfigs(state.savedOptimizerConfigs)
  }, [state.savedOptimizerConfigs])
  useEffect(() => {
    productivityTargetStorage.saveSavedProductivityTargetConfigs(state.savedProductivityTargetConfigs)
  }, [state.savedProductivityTargetConfigs])
  useEffect(() => { batchStorage.saveSynonymMap(state.batchSynonymMap) }, [state.batchSynonymMap])
  useEffect(() => {
    if (state.batchFileName != null || state.batchUploadedAt != null) {
      batchStorage.saveBatchUploadMeta({ fileName: state.batchFileName, uploadedAt: state.batchUploadedAt })
    }
  }, [state.batchFileName, state.batchUploadedAt])

  // Compose domain-specific action sets
  const providerActions = useProviderActions(setState)
  const batchActions = useBatchActions(setState)
  const optimizerActions = useOptimizerActions(setState)
  const productivityTargetActions = useProductivityTargetActions(setState)

  return {
    state,
    ...providerActions,
    ...batchActions,
    ...optimizerActions,
    ...productivityTargetActions,
  }
}
