import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'

/** How the provider's specialty was matched to a market row. */
export type MarketMatchStatus = 'Exact' | 'Normalized' | 'Synonym' | 'Missing'

/** Derived risk level for filtering and display. */
export type BatchRiskLevel = 'high' | 'medium' | 'low'

/** User-editable map: provider/source specialty key → market specialty key. */
export type SynonymMap = Record<string, string>

/** Preset for batch: name + scenario inputs (reused for batch run). */
export interface BatchScenarioPreset {
  id: string
  name: string
  scenarioInputs: ScenarioInputs
}

/** One row in batch results: one provider × one scenario. */
export interface BatchRowResult {
  providerId: string
  providerName: string
  specialty: string
  division: string
  scenarioId: string
  scenarioName: string
  scenarioInputsSnapshot: ScenarioInputs
  /** Null when market is missing (no compute). */
  results: ScenarioResults | null
  matchStatus: MarketMatchStatus
  matchedMarketSpecialty?: string
  warnings: string[]
  riskLevel: BatchRiskLevel
}

/** Full output of a batch run. */
export interface BatchResults {
  rows: BatchRowResult[]
  runAt: string
  scenarioCount: number
  providerCount: number
}

/** A saved batch run the user can revisit or delete. */
export interface SavedBatchRun {
  id: string
  name: string
  createdAt: string
  results: BatchResults
}

/** Optional overrides per specialty and/or provider; merged over base scenario inputs (provider overrides beat specialty). */
export interface BatchOverrides {
  bySpecialty?: Record<string, Partial<ScenarioInputs>>
  byProviderId?: Record<string, Partial<ScenarioInputs>>
}

/** Options for runBatch. */
export interface RunBatchOptions {
  synonymMap?: SynonymMap
  onProgress?: (processed: number, total: number, elapsedMs: number) => void
  chunkSize?: number
  overrides?: BatchOverrides
}

/** Result of matchMarketRow. */
export interface MatchMarketResult {
  marketRow: MarketRow | null
  status: MarketMatchStatus
  matchedKey?: string
}
