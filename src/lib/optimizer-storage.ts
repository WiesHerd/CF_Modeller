import type { SavedOptimizerConfig } from '@/types/optimizer'
import { readStorageArray, writeStorageArray } from '@/lib/storage-utils'

const KEY_SAVED_OPTIMIZER_CONFIGS = 'cf-modeler-saved-optimizer-configs'
const MAX_SAVED_OPTIMIZER_CONFIGS = 20

export function loadSavedOptimizerConfigs(): SavedOptimizerConfig[] {
  const data = readStorageArray<SavedOptimizerConfig>(KEY_SAVED_OPTIMIZER_CONFIGS)
  if (!data) return []
  return data.filter(
    (c) =>
      c &&
      c.id &&
      c.name &&
      c.createdAt &&
      c.snapshot &&
      typeof c.snapshot === 'object' &&
      Array.isArray(c.snapshot.selectedSpecialties) &&
      Array.isArray(c.snapshot.selectedDivisions) &&
      (c.snapshot.excludedProviderTypes == null || Array.isArray(c.snapshot.excludedProviderTypes))
  )
}

export function saveSavedOptimizerConfigs(configs: SavedOptimizerConfig[]): void {
  writeStorageArray(KEY_SAVED_OPTIMIZER_CONFIGS, configs, MAX_SAVED_OPTIMIZER_CONFIGS)
}
