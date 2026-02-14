import type { BatchResults, BatchRunMode, SavedBatchRun, SavedBatchScenarioConfig, SynonymMap } from '@/types/batch'

const KEY_BATCH_RESULTS = 'cf-modeler-batch-results'
const KEY_BATCH_RESULTS_BULK = 'cf-modeler-batch-results-bulk'
const KEY_BATCH_RESULTS_DETAILED = 'cf-modeler-batch-results-detailed'
const KEY_SAVED_BATCH_RUNS = 'cf-modeler-saved-batch-runs'
const KEY_SAVED_BATCH_SCENARIO_CONFIGS = 'cf-modeler-saved-batch-scenario-configs'
const KEY_SYNONYM_MAP = 'cf-modeler-synonym-map'
const KEY_BATCH_UPLOAD_META = 'cf-modeler-batch-upload-meta'
const MAX_SAVED_BATCH_SCENARIO_CONFIGS = 20
export const MAX_BATCH_RESULTS_BYTES = 4 * 1024 * 1024 // 4 MB; skip save if larger
const MAX_SAVED_BATCH_RUNS = 20

export interface BatchResultsByMode {
  bulk: BatchResults | null
  detailed: BatchResults | null
}

function loadOneBatchResults(key: string): BatchResults | null {
  try {
    const s = localStorage.getItem(key)
    if (!s) return null
    const data = JSON.parse(s) as unknown
    if (!data || typeof data !== 'object' || !Array.isArray((data as BatchResults).rows))
      return null
    return data as BatchResults
  } catch {
    return null
  }
}

export function loadBatchResultsByMode(): BatchResultsByMode {
  let bulk = loadOneBatchResults(KEY_BATCH_RESULTS_BULK)
  const detailed = loadOneBatchResults(KEY_BATCH_RESULTS_DETAILED)
  const legacy = loadOneBatchResults(KEY_BATCH_RESULTS)
  if (legacy != null && bulk == null) {
    bulk = legacy
    try {
      localStorage.setItem(KEY_BATCH_RESULTS_BULK, JSON.stringify(legacy))
      localStorage.removeItem(KEY_BATCH_RESULTS)
    } catch {
      // ignore
    }
  }
  return { bulk, detailed }
}

/** Save results for a given mode. Returns false if payload too large. */
export function saveBatchResults(results: BatchResults, mode: BatchRunMode): boolean {
  try {
    const s = JSON.stringify(results)
    if (new Blob([s]).size > MAX_BATCH_RESULTS_BYTES) {
      return false
    }
    const key = mode === 'bulk' ? KEY_BATCH_RESULTS_BULK : KEY_BATCH_RESULTS_DETAILED
    localStorage.setItem(key, s)
    return true
  } catch {
    return false
  }
}

export function loadSynonymMap(): SynonymMap {
  try {
    const s = localStorage.getItem(KEY_SYNONYM_MAP)
    if (!s) return {}
    const data = JSON.parse(s) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return data as SynonymMap
  } catch {
    return {}
  }
}

export function loadSavedBatchRuns(): SavedBatchRun[] {
  try {
    const s = localStorage.getItem(KEY_SAVED_BATCH_RUNS)
    if (!s) return []
    const data = JSON.parse(s) as unknown
    if (!Array.isArray(data)) return []
    return (data as SavedBatchRun[]).filter((r) => {
      if (!r || !r.id || !r.name || !r.createdAt || !r.results || !Array.isArray(r.results?.rows))
        return false
      const mode = r.mode
      if (mode !== undefined && mode !== 'bulk' && mode !== 'detailed') return false
      return true
    })
  } catch {
    return []
  }
}

function savedRunBytes(run: SavedBatchRun): number {
  return new Blob([JSON.stringify(run)]).size
}

export function saveSavedBatchRuns(runs: SavedBatchRun[]): void {
  const sorted = [...runs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const trimmed = sorted.length > MAX_SAVED_BATCH_RUNS ? sorted.slice(-MAX_SAVED_BATCH_RUNS) : sorted
  localStorage.setItem(KEY_SAVED_BATCH_RUNS, JSON.stringify(trimmed))
}

/** Returns approximate size in bytes; used to reject runs over MAX_BATCH_RESULTS_BYTES. */
export function getSavedRunSizeBytes(run: SavedBatchRun): number {
  return savedRunBytes(run)
}

export const MAX_SAVED_BATCH_RUNS_LIMIT = MAX_SAVED_BATCH_RUNS

export function saveSynonymMap(map: SynonymMap): void {
  localStorage.setItem(KEY_SYNONYM_MAP, JSON.stringify(map))
}

export function loadSavedBatchScenarioConfigs(): SavedBatchScenarioConfig[] {
  try {
    const s = localStorage.getItem(KEY_SAVED_BATCH_SCENARIO_CONFIGS)
    if (!s) return []
    const data = JSON.parse(s) as unknown
    if (!Array.isArray(data)) return []
    return (data as SavedBatchScenarioConfig[]).filter(
      (c) => c && c.id && c.name && c.createdAt && c.scenarioInputs && Array.isArray(c.selectedSpecialties) && Array.isArray(c.selectedProviderIds)
    )
  } catch {
    return []
  }
}

export function saveSavedBatchScenarioConfigs(configs: SavedBatchScenarioConfig[]): void {
  const sorted = [...configs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const trimmed = sorted.length > MAX_SAVED_BATCH_SCENARIO_CONFIGS ? sorted.slice(-MAX_SAVED_BATCH_SCENARIO_CONFIGS) : sorted
  localStorage.setItem(KEY_SAVED_BATCH_SCENARIO_CONFIGS, JSON.stringify(trimmed))
}

export interface BatchUploadMeta {
  fileName?: string | null
  uploadedAt?: string | null
}

export function loadBatchUploadMeta(): BatchUploadMeta {
  try {
    const s = localStorage.getItem(KEY_BATCH_UPLOAD_META)
    if (!s) return {}
    const data = JSON.parse(s) as unknown
    if (!data || typeof data !== 'object') return {}
    const o = data as Record<string, unknown>
    return {
      fileName: typeof o.fileName === 'string' ? o.fileName : undefined,
      uploadedAt: typeof o.uploadedAt === 'string' ? o.uploadedAt : undefined,
    }
  } catch {
    return {}
  }
}

export function saveBatchUploadMeta(meta: BatchUploadMeta): void {
  localStorage.setItem(KEY_BATCH_UPLOAD_META, JSON.stringify(meta))
}
