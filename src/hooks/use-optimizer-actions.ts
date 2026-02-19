/**
 * CF Optimizer action creators.
 * Extracted from use-app-state.ts for modularity.
 */

import { useCallback } from 'react'
import type { OptimizerConfigSnapshot, SavedOptimizerConfig } from '@/types/optimizer'
import type { AppState } from '@/hooks/use-app-state'

type SetState = (updater: (s: AppState) => AppState) => void

export function useOptimizerActions(setState: SetState) {
  const setOptimizerConfig = useCallback((snapshot: OptimizerConfigSnapshot | null) => {
    setState((s) => ({ ...s, optimizerConfig: snapshot }))
  }, [setState])

  const clearOptimizerConfig = useCallback(() => {
    setState((s) => ({ ...s, optimizerConfig: null, loadedOptimizerConfigId: null }))
  }, [setState])

  const saveOptimizerConfig = useCallback((name: string, updateId?: string) => {
    setState((s) => {
      if (!s.optimizerConfig) return s
      const existing = updateId
        ? s.savedOptimizerConfigs.find((c) => c.id === updateId)
        : null
      if (existing) {
        const updated: SavedOptimizerConfig = {
          ...existing,
          name: name.trim(),
          snapshot: s.optimizerConfig,
        }
        const list = s.savedOptimizerConfigs
          .map((c) => (c.id === updateId ? updated : c))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return { ...s, savedOptimizerConfigs: list }
      }
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
  }, [setState])

  const loadOptimizerConfig = useCallback((id: string) => {
    setState((s) => {
      const found = s.savedOptimizerConfigs.find((c) => c.id === id)
      if (!found) return s
      return { ...s, optimizerConfig: found.snapshot, loadedOptimizerConfigId: id }
    })
  }, [setState])

  const deleteSavedOptimizerConfig = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedOptimizerConfigs: s.savedOptimizerConfigs.filter((c) => c.id !== id),
    }))
  }, [setState])

  const clearAllSavedOptimizerConfigs = useCallback(() => {
    setState((s) => ({ ...s, savedOptimizerConfigs: [] }))
  }, [setState])

  return {
    setOptimizerConfig,
    clearOptimizerConfig,
    saveOptimizerConfig,
    loadOptimizerConfig,
    deleteSavedOptimizerConfig,
    clearAllSavedOptimizerConfigs,
  }
}
