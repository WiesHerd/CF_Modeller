/**
 * Provider, market, and single-scenario action creators.
 * Extracted from use-app-state.ts for modularity.
 */

import { useCallback } from 'react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults, SavedScenario } from '@/types/scenario'
import type { ColumnMapping } from '@/types/upload'
import type { AppState } from '@/hooks/use-app-state'

type SetState = (updater: (s: AppState) => AppState) => void

export function useProviderActions(setState: SetState) {
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
    [setState]
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
    [setState]
  )

  const setSelectedSpecialty = useCallback((specialty: string | null) => {
    setState((s) => ({ ...s, selectedSpecialty: specialty, lastResults: null }))
  }, [setState])

  const setSelectedProvider = useCallback((providerId: string | null) => {
    setState((s) => ({ ...s, selectedProviderId: providerId, lastResults: null }))
  }, [setState])

  const updateProvider = useCallback((providerId: string, updates: Partial<ProviderRow>) => {
    setState((s) => ({
      ...s,
      providerRows: s.providerRows.map((row) =>
        row.providerId === providerId ? { ...row, ...updates } : row
      ),
    }))
  }, [setState])

  const addProvider = useCallback((row: ProviderRow) => {
    const id =
      row.providerId ??
      (row.providerName && String(row.providerName).trim() !== ''
        ? String(row.providerName).trim()
        : crypto.randomUUID())
    const withId: ProviderRow = { ...row, providerId: id }
    setState((s) => ({ ...s, providerRows: [...s.providerRows, withId] }))
  }, [setState])

  const updateMarketRow = useCallback(
    (existingRow: MarketRow, updates: Partial<MarketRow>) => {
      const key = (r: MarketRow) => `${r.specialty ?? ''}|${r.providerType ?? ''}|${r.region ?? ''}`
      const existingKey = key(existingRow)
      setState((s) => ({
        ...s,
        marketRows: s.marketRows.map((r) => (key(r) === existingKey ? { ...r, ...updates } : r)),
      }))
    },
    [setState]
  )

  const addMarketRow = useCallback((row: MarketRow) => {
    setState((s) => ({ ...s, marketRows: [...s.marketRows, row] }))
  }, [setState])

  const deleteProvider = useCallback((providerId: string) => {
    setState((s) => ({
      ...s,
      providerRows: s.providerRows.filter((row) => row.providerId !== providerId),
    }))
  }, [setState])

  const deleteMarketRow = useCallback((row: MarketRow) => {
    const key = (r: MarketRow) => `${r.specialty ?? ''}|${r.providerType ?? ''}|${r.region ?? ''}`
    const targetKey = key(row)
    setState((s) => ({
      ...s,
      marketRows: s.marketRows.filter((r) => key(r) !== targetKey),
    }))
  }, [setState])

  const setScenarioInputs = useCallback((inputs: Partial<ScenarioInputs>) => {
    setState((s) => ({ ...s, scenarioInputs: { ...s.scenarioInputs, ...inputs } }))
  }, [setState])

  const setLastResults = useCallback((results: ScenarioResults | null) => {
    setState((s) => ({ ...s, lastResults: results }))
  }, [setState])

  const dismissScenarioLoadWarning = useCallback(() => {
    setState((s) => ({ ...s, lastScenarioLoadWarning: null }))
  }, [setState])

  const saveCurrentScenario = useCallback(
    (name: string, providerSnapshot?: ProviderRow | null, updateId?: string) => {
      setState((s) => {
        const isUpdate = updateId && s.savedScenarios.some((sc) => sc.id === updateId)
        if (isUpdate) {
          const next = s.savedScenarios.map((sc) =>
            sc.id === updateId
              ? {
                  ...sc,
                  name: name.trim(),
                  scenarioInputs: { ...s.scenarioInputs },
                  selectedProviderId: s.selectedProviderId,
                  selectedSpecialty: s.selectedSpecialty,
                  ...(providerSnapshot && { providerSnapshot: { ...providerSnapshot } }),
                }
              : sc
          )
          return { ...s, savedScenarios: next, lastScenarioLoadWarning: null }
        }
        const saved: SavedScenario = {
          id: crypto.randomUUID(),
          name: name.trim(),
          createdAt: new Date().toISOString(),
          scenarioInputs: { ...s.scenarioInputs },
          selectedProviderId: s.selectedProviderId,
          selectedSpecialty: s.selectedSpecialty,
          ...(providerSnapshot && { providerSnapshot: { ...providerSnapshot } }),
        }
        return {
          ...s,
          savedScenarios: [...s.savedScenarios, saved],
          lastScenarioLoadWarning: null,
          currentScenarioId: saved.id,
        }
      })
    },
    [setState]
  )

  const updateCurrentScenarioProviderSnapshot = useCallback((provider: ProviderRow) => {
    setState((s) => {
      if (!s.currentScenarioId) return s
      const next = s.savedScenarios.map((sc) =>
        sc.id === s.currentScenarioId ? { ...sc, providerSnapshot: { ...provider } } : sc
      )
      return { ...s, savedScenarios: next }
    })
  }, [setState])

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
            (r.specialty ?? '').toLowerCase() === (scenario.selectedSpecialty ?? '').toLowerCase()
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
          warning ?? 'Specialty from scenario not in market data; inputs and provider restored.'
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
  }, [setState])

  const deleteScenario = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedScenarios: s.savedScenarios.filter((sc) => sc.id !== id),
      currentScenarioId: s.currentScenarioId === id ? null : s.currentScenarioId,
    }))
  }, [setState])

  const clearAllScenarios = useCallback(() => {
    setState((s) => ({ ...s, savedScenarios: [], currentScenarioId: null }))
  }, [setState])

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
        ...(scenario.providerSnapshot && { providerSnapshot: { ...scenario.providerSnapshot } }),
      }
      return { ...s, savedScenarios: [...s.savedScenarios, copy] }
    })
  }, [setState])

  return {
    setProviderData,
    setMarketData,
    setSelectedSpecialty,
    setSelectedProvider,
    updateProvider,
    addProvider,
    updateMarketRow,
    addMarketRow,
    deleteProvider,
    deleteMarketRow,
    setScenarioInputs,
    setLastResults,
    dismissScenarioLoadWarning,
    saveCurrentScenario,
    updateCurrentScenarioProviderSnapshot,
    loadScenario,
    deleteScenario,
    clearAllScenarios,
    duplicateScenario,
  }
}
