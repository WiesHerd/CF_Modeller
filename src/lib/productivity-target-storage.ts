import type { SavedProductivityTargetConfig } from '@/types/productivity-target'

const KEY_SAVED_PRODUCTIVITY_TARGET_CONFIGS = 'cf-modeler-saved-productivity-target-configs'
const MAX_SAVED = 20

export function loadSavedProductivityTargetConfigs(): SavedProductivityTargetConfig[] {
  try {
    const s = localStorage.getItem(KEY_SAVED_PRODUCTIVITY_TARGET_CONFIGS)
    if (!s) return []
    const data = JSON.parse(s) as unknown
    if (!Array.isArray(data)) return []
    return (data as SavedProductivityTargetConfig[]).filter(
      (c) =>
        c &&
        c.id &&
        c.name &&
        c.createdAt &&
        c.snapshot &&
        typeof c.snapshot === 'object' &&
        c.snapshot.settings &&
        typeof c.snapshot.settings === 'object'
    )
  } catch {
    return []
  }
}

export function saveSavedProductivityTargetConfigs(configs: SavedProductivityTargetConfig[]): void {
  const sorted = [...configs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const trimmed = sorted.length > MAX_SAVED ? sorted.slice(-MAX_SAVED) : sorted
  localStorage.setItem(KEY_SAVED_PRODUCTIVITY_TARGET_CONFIGS, JSON.stringify(trimmed))
}
