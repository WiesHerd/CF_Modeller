/**
 * Batch run and batch scenario config action creators.
 * Extracted from use-app-state.ts for modularity.
 */

import { useCallback } from 'react'
import { formatDateTime } from '@/utils/format'
import type { BatchResults, BatchOverrides, BatchRunMode, BatchScenarioSnapshot, SavedBatchRun, SavedBatchScenarioConfig, SynonymMap } from '@/types/batch'
import * as batchStorage from '@/lib/batch-storage'
import type { AppState } from '@/hooks/use-app-state'

type SetState = (updater: (s: AppState) => AppState) => void

export function useBatchActions(setState: SetState) {
  const setBatchResults = useCallback(
    (mode: BatchRunMode, results: BatchResults | null, scenarioSnapshot?: BatchScenarioSnapshot | null) => {
      setState((s) => {
        const snapshot =
          scenarioSnapshot ??
          (results
            ? mode === 'bulk'
              ? s.lastBatchScenarioSnapshotBulk
              : s.lastBatchScenarioSnapshotDetailed
            : null)
        if (mode === 'bulk') {
          return { ...s, batchResultsBulk: results, lastBatchScenarioSnapshotBulk: snapshot }
        }
        return { ...s, batchResultsDetailed: results, lastBatchScenarioSnapshotDetailed: snapshot }
      })
    },
    [setState]
  )

  const saveCurrentBatchRun = useCallback((mode: BatchRunMode, name?: string) => {
    setState((s) => {
      const results = mode === 'bulk' ? s.batchResultsBulk : s.batchResultsDetailed
      const snapshot =
        mode === 'bulk' ? s.lastBatchScenarioSnapshotBulk : s.lastBatchScenarioSnapshotDetailed
      if (!results) return s
      const displayName =
        name?.trim() ||
        `${results.providerCount} providers × ${results.scenarioCount} scenario(s) – ${formatDateTime(results.runAt)}`
      const saved: SavedBatchRun = {
        id: crypto.randomUUID(),
        name: displayName,
        createdAt: new Date().toISOString(),
        results: { ...results, rows: [...results.rows] },
        ...(snapshot && { scenarioSnapshot: { ...snapshot, mode } }),
        mode,
      }
      if (batchStorage.getSavedRunSizeBytes(saved) > batchStorage.MAX_BATCH_RESULTS_BYTES) return s
      const list = [...s.savedBatchRuns, saved].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const trimmed =
        list.length > batchStorage.MAX_SAVED_BATCH_RUNS_LIMIT
          ? list.slice(-batchStorage.MAX_SAVED_BATCH_RUNS_LIMIT)
          : list
      return { ...s, savedBatchRuns: trimmed }
    })
  }, [setState])

  const loadSavedBatchRun = useCallback((id: string, onLoaded?: (mode: BatchRunMode) => void) => {
    setState((s) => {
      const run = s.savedBatchRuns.find((r) => r.id === id)
      if (!run) return s
      const mode: BatchRunMode = run.mode === 'detailed' ? 'detailed' : 'bulk'
      const snapshot = run.scenarioSnapshot ? { ...run.scenarioSnapshot, mode } : undefined
      if (mode === 'bulk') {
        queueMicrotask(() => onLoaded?.('bulk'))
        return {
          ...s,
          batchResultsBulk: run.results,
          lastBatchScenarioSnapshotBulk: snapshot ?? null,
        }
      }
      queueMicrotask(() => onLoaded?.('detailed'))
      return {
        ...s,
        batchResultsDetailed: run.results,
        lastBatchScenarioSnapshotDetailed: snapshot ?? null,
      }
    })
  }, [setState])

  const deleteSavedBatchRun = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedBatchRuns: s.savedBatchRuns.filter((r) => r.id !== id),
    }))
  }, [setState])

  const clearAllSavedBatchRuns = useCallback(() => {
    setState((s) => ({ ...s, savedBatchRuns: [] }))
  }, [setState])

  const saveBatchScenarioConfig = useCallback(
    (config: Omit<SavedBatchScenarioConfig, 'id' | 'createdAt'>, updateId?: string) => {
      setState((s) => {
        const existing = updateId
          ? s.savedBatchScenarioConfigs.find((c) => c.id === updateId)
          : null
        if (existing) {
          const updated: SavedBatchScenarioConfig = { ...config, id: existing.id, createdAt: existing.createdAt }
          const list = s.savedBatchScenarioConfigs
            .map((c) => (c.id === updateId ? updated : c))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          return { ...s, savedBatchScenarioConfigs: list }
        }
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
    },
    [setState]
  )

  const loadBatchScenarioConfig = useCallback((config: SavedBatchScenarioConfig) => {
    setState((s) => ({
      ...s,
      scenarioInputs: { ...config.scenarioInputs },
      appliedBatchScenarioConfig: config,
    }))
  }, [setState])

  const clearAppliedBatchScenarioConfig = useCallback(() => {
    setState((s) => ({ ...s, appliedBatchScenarioConfig: null }))
  }, [setState])

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
  }, [setState])

  const deleteSavedBatchScenarioConfig = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedBatchScenarioConfigs: s.savedBatchScenarioConfigs.filter((c) => c.id !== id),
    }))
  }, [setState])

  const clearAllSavedBatchScenarioConfigs = useCallback(() => {
    setState((s) => ({ ...s, savedBatchScenarioConfigs: [] }))
  }, [setState])

  const setBatchSynonymMap = useCallback((map: SynonymMap) => {
    setState((s) => ({ ...s, batchSynonymMap: map }))
  }, [setState])

  const updateBatchSynonymMap = useCallback((key: string, value: string) => {
    setState((s) => ({ ...s, batchSynonymMap: { ...s.batchSynonymMap, [key]: value } }))
  }, [setState])

  const removeBatchSynonym = useCallback((key: string) => {
    setState((s) => {
      const next = { ...s.batchSynonymMap }
      delete next[key]
      return { ...s, batchSynonymMap: next }
    })
  }, [setState])

  return {
    setBatchResults,
    saveCurrentBatchRun,
    loadSavedBatchRun,
    deleteSavedBatchRun,
    clearAllSavedBatchRuns,
    saveBatchScenarioConfig,
    loadBatchScenarioConfig,
    clearAppliedBatchScenarioConfig,
    applyOptimizerOverrides,
    deleteSavedBatchScenarioConfig,
    clearAllSavedBatchScenarioConfigs,
    setBatchSynonymMap,
    updateBatchSynonymMap,
    removeBatchSynonym,
  }
}
