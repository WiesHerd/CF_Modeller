import type { SavedOptimizerConfig } from '@/types/optimizer'

const KEY_SAVED_OPTIMIZER_CONFIGS = 'cf-modeler-saved-optimizer-configs'
const MAX_SAVED_OPTIMIZER_CONFIGS = 20

export function loadSavedOptimizerConfigs(): SavedOptimizerConfig[] {
  try {
    const s = localStorage.getItem(KEY_SAVED_OPTIMIZER_CONFIGS)
    if (!s) return []
    const data = JSON.parse(s) as unknown
    if (!Array.isArray(data)) return []
    return (data as SavedOptimizerConfig[]).filter(
      (c) =>
        c &&
        c.id &&
        c.name &&
        c.createdAt &&
        c.snapshot &&
        typeof c.snapshot === 'object' &&
        Array.isArray(c.snapshot.selectedSpecialties) &&
        Array.isArray(c.snapshot.selectedDivisions)
    )
  } catch {
    return []
  }
}

export function saveSavedOptimizerConfigs(configs: SavedOptimizerConfig[]): void {
  const sorted = [...configs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const trimmed =
    sorted.length > MAX_SAVED_OPTIMIZER_CONFIGS
      ? sorted.slice(-MAX_SAVED_OPTIMIZER_CONFIGS)
      : sorted
  localStorage.setItem(KEY_SAVED_OPTIMIZER_CONFIGS, JSON.stringify(trimmed))
}
