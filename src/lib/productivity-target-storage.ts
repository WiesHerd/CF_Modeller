import type { SavedProductivityTargetConfig } from '@/types/productivity-target'
import { readStorageArray, writeStorageArray } from '@/lib/storage-utils'

const KEY_SAVED_PRODUCTIVITY_TARGET_CONFIGS = 'cf-modeler-saved-productivity-target-configs'
const MAX_SAVED = 20

export function loadSavedProductivityTargetConfigs(): SavedProductivityTargetConfig[] {
  const data = readStorageArray<SavedProductivityTargetConfig>(KEY_SAVED_PRODUCTIVITY_TARGET_CONFIGS)
  if (!data) return []
  return data.filter(
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
}

export function saveSavedProductivityTargetConfigs(configs: SavedProductivityTargetConfig[]): void {
  writeStorageArray(KEY_SAVED_PRODUCTIVITY_TARGET_CONFIGS, configs, MAX_SAVED)
}
