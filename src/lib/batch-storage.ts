import type { BatchResults, SynonymMap } from '@/types/batch'

const KEY_BATCH_RESULTS = 'cf-modeler-batch-results'
const KEY_SYNONYM_MAP = 'cf-modeler-synonym-map'
const MAX_BATCH_RESULTS_BYTES = 4 * 1024 * 1024 // 4 MB; skip save if larger

export function loadBatchResults(): BatchResults | null {
  try {
    const s = localStorage.getItem(KEY_BATCH_RESULTS)
    if (!s) return null
    const data = JSON.parse(s) as unknown
    if (!data || typeof data !== 'object' || !Array.isArray((data as BatchResults).rows))
      return null
    return data as BatchResults
  } catch {
    return null
  }
}

export function saveBatchResults(results: BatchResults): boolean {
  try {
    const s = JSON.stringify(results)
    if (new Blob([s]).size > MAX_BATCH_RESULTS_BYTES) {
      return false
    }
    localStorage.setItem(KEY_BATCH_RESULTS, s)
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

export function saveSynonymMap(map: SynonymMap): void {
  localStorage.setItem(KEY_SYNONYM_MAP, JSON.stringify(map))
}
