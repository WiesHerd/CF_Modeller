import { useState, useEffect, useCallback } from 'react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'
import type { ColumnMapping } from '@/types/upload'
import * as storage from '@/lib/storage'
import { SAMPLE_PROVIDER_ROWS, SAMPLE_MARKET_ROWS } from '@/utils/fake-test-data'

export interface AppState {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  providerMapping: ColumnMapping | null
  marketMapping: ColumnMapping | null
  selectedSpecialty: string | null
  selectedProviderId: string | null
  selectedDivision: string | null
  scenarioInputs: ScenarioInputs
  lastResults: ScenarioResults | null
  divisionResults: ScenarioResults[] | null
}

const defaultScenarioInputs: ScenarioInputs = {
  proposedCFPercentile: 40,
  cfAdjustmentFactor: 0.95,
  psqPercent: 0,
  thresholdMethod: 'annual',
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
  selectedDivision: null,
  scenarioInputs: defaultScenarioInputs,
  lastResults: null,
  divisionResults: null,
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    const providers = storage.loadProviders()
    const market = storage.loadMarket()
    const pm = storage.loadProviderMapping()
    const mm = storage.loadMarketMapping()
    // When no data has been uploaded yet, seed with one example provider + market for testing
    const hasStoredData = providers.length > 0 && market.length > 0
    return {
      ...initialState,
      providerRows: hasStoredData ? providers : SAMPLE_PROVIDER_ROWS,
      marketRows: hasStoredData ? market : SAMPLE_MARKET_ROWS,
      providerMapping: hasStoredData ? pm : null,
      marketMapping: hasStoredData ? mm : null,
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

  const setProviderData = useCallback(
    (rows: ProviderRow[], mapping: ColumnMapping | null) => {
      setState((s) => ({
        ...s,
        providerRows: rows,
        providerMapping: mapping,
        selectedProviderId: null,
        selectedDivision: null,
        lastResults: null,
        divisionResults: null,
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
        divisionResults: null,
      }))
    },
    []
  )

  const setSelectedSpecialty = useCallback((specialty: string | null) => {
    setState((s) => ({
      ...s,
      selectedSpecialty: specialty,
      lastResults: null,
      divisionResults: null,
    }))
  }, [])

  const setSelectedProvider = useCallback((providerId: string | null) => {
    setState((s) => ({
      ...s,
      selectedProviderId: providerId,
      selectedDivision: null,
      divisionResults: null,
    }))
  }, [])

  const setSelectedDivision = useCallback((division: string | null) => {
    setState((s) => ({
      ...s,
      selectedDivision: division,
      selectedProviderId: null,
      lastResults: null,
    }))
  }, [])

  const setScenarioInputs = useCallback((inputs: Partial<ScenarioInputs>) => {
    setState((s) => ({
      ...s,
      scenarioInputs: { ...s.scenarioInputs, ...inputs },
    }))
  }, [])

  const setLastResults = useCallback((results: ScenarioResults | null) => {
    setState((s) => ({ ...s, lastResults: results, divisionResults: null }))
  }, [])

  const setDivisionResults = useCallback((results: ScenarioResults[] | null) => {
    setState((s) => ({ ...s, divisionResults: results, lastResults: null }))
  }, [])

  return {
    state,
    setProviderData,
    setMarketData,
    setSelectedSpecialty,
    setSelectedProvider,
    setSelectedDivision,
    setScenarioInputs,
    setLastResults,
    setDivisionResults,
  }
}
