/**
 * Productivity Target action creators.
 * Extracted from use-app-state.ts for modularity.
 */

import { useCallback } from 'react'
import type { ProductivityTargetConfigSnapshot, SavedProductivityTargetConfig } from '@/types/productivity-target'
import type { AppState } from '@/hooks/use-app-state'

type SetState = (updater: (s: AppState) => AppState) => void

export function useProductivityTargetActions(setState: SetState) {
  const setProductivityTargetConfig = useCallback(
    (snapshot: ProductivityTargetConfigSnapshot | null) => {
      setState((s) => ({ ...s, productivityTargetConfig: snapshot }))
    },
    [setState]
  )

  const clearProductivityTargetConfig = useCallback(() => {
    setState((s) => ({
      ...s,
      productivityTargetConfig: null,
      loadedProductivityTargetConfigId: null,
    }))
  }, [setState])

  const saveProductivityTargetConfig = useCallback((name: string, updateId?: string) => {
    setState((s) => {
      if (!s.productivityTargetConfig) return s
      const existing = updateId
        ? s.savedProductivityTargetConfigs.find((c) => c.id === updateId)
        : null
      if (existing) {
        const updated: SavedProductivityTargetConfig = {
          ...existing,
          name: name.trim(),
          snapshot: s.productivityTargetConfig,
        }
        const list = s.savedProductivityTargetConfigs
          .map((c) => (c.id === updateId ? updated : c))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return { ...s, savedProductivityTargetConfigs: list }
      }
      const saved: SavedProductivityTargetConfig = {
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        snapshot: s.productivityTargetConfig,
      }
      const list = [...s.savedProductivityTargetConfigs, saved].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const trimmed = list.length > 20 ? list.slice(-20) : list
      return { ...s, savedProductivityTargetConfigs: trimmed }
    })
  }, [setState])

  const loadProductivityTargetConfig = useCallback((id: string) => {
    setState((s) => {
      const found = s.savedProductivityTargetConfigs.find((c) => c.id === id)
      if (!found) return s
      return { ...s, productivityTargetConfig: found.snapshot, loadedProductivityTargetConfigId: id }
    })
  }, [setState])

  const deleteSavedProductivityTargetConfig = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      savedProductivityTargetConfigs: s.savedProductivityTargetConfigs.filter((c) => c.id !== id),
      loadedProductivityTargetConfigId:
        s.loadedProductivityTargetConfigId === id
          ? null
          : s.loadedProductivityTargetConfigId,
    }))
  }, [setState])

  return {
    setProductivityTargetConfig,
    clearProductivityTargetConfig,
    saveProductivityTargetConfig,
    loadProductivityTargetConfig,
    deleteSavedProductivityTargetConfig,
  }
}
