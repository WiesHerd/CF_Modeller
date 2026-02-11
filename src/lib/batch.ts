import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'
import type {
  BatchRowResult,
  BatchResults,
  BatchRiskLevel,
  MatchMarketResult,
  MarketMatchStatus,
  RunBatchOptions,
  SynonymMap,
} from '@/types/batch'
import { computeScenario } from '@/lib/compute'

const PERCENTILE_KEYS = [
  'TCC_25', 'TCC_50', 'TCC_75', 'TCC_90',
  'WRVU_25', 'WRVU_50', 'WRVU_75', 'WRVU_90',
  'CF_25', 'CF_50', 'CF_75', 'CF_90',
] as const

/**
 * Normalize specialty for matching: trim, lowerCase, collapse whitespace, remove punctuation.
 */
export function normalizeSpecialtyKey(s: string): string {
  if (typeof s !== 'string') return ''
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Validate that a market row has all required percentile columns as finite numbers.
 */
function isMarketRowValid(m: MarketRow): boolean {
  for (const key of PERCENTILE_KEYS) {
    const v = (m as unknown as Record<string, number>)[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) return false
  }
  return true
}

/**
 * Match a provider to a market row by specialty.
 * 1. Exact (normalized key match)
 * 2. Normalized (same normalization on market specialties)
 * 3. Synonym map lookup
 * 4. Missing
 */
export function matchMarketRow(
  provider: ProviderRow,
  marketRows: MarketRow[],
  synonymMap: SynonymMap = {}
): MatchMarketResult {
  const rawSpecialty = (provider.specialty ?? '').trim()
  if (!rawSpecialty) {
    return { marketRow: null, status: 'Missing' }
  }

  const normalizedProvider = normalizeSpecialtyKey(rawSpecialty)
  const validMarkets = marketRows.filter(isMarketRowValid)

  // 1. Exact match (normalized)
  for (const m of validMarkets) {
    const key = normalizeSpecialtyKey(m.specialty ?? '')
    if (key && key === normalizedProvider) {
      return { marketRow: m, status: 'Exact', matchedKey: m.specialty }
    }
  }

  // 2. Normalized map (same comparison; we already did it above, so "Normalized" here means we matched via prebuilt map with same keys — we can treat first pass as Exact; for true "Normalized" we could match with alternate normalization). Per plan: "normalized" = same comparison with normalized keys. So Exact and Normalized are the same logic; we use Exact for direct match. For "Normalized" we could consider matching when provider specialty has different casing/punctuation but same normalized form — that's already Exact. So we only need Synonym and Missing left.

  // 3. Synonym map: provider specialty (raw or normalized) -> market specialty key
  const synonymTarget =
    synonymMap[normalizedProvider] ??
    synonymMap[rawSpecialty] ??
    synonymMap[rawSpecialty.toLowerCase()]
  if (synonymTarget) {
    const targetNorm = normalizeSpecialtyKey(synonymTarget)
    for (const m of validMarkets) {
      const key = normalizeSpecialtyKey(m.specialty ?? '')
      if (key === targetNorm) {
        return { marketRow: m, status: 'Synonym', matchedKey: m.specialty }
      }
    }
  }

  return { marketRow: null, status: 'Missing' }
}

/**
 * Derive a single risk level from scenario results for filtering/display.
 */
export function deriveRiskLevel(results: ScenarioResults): BatchRiskLevel {
  const { risk, governanceFlags } = results
  if (
    risk.highRisk.length > 0 ||
    governanceFlags.underpayRisk ||
    governanceFlags.fmvCheckSuggested
  ) {
    return 'high'
  }
  if (risk.warnings.length > 0 || results.warnings.length > 0) {
    return 'medium'
  }
  return 'low'
}

const DEFAULT_CHUNK_SIZE = 200

/**
 * Run batch: for each provider × scenario, match market, then computeScenario (or emit Missing row).
 * Calls onProgress after each chunk. Returns BatchResults.
 */
export function runBatch(
  providers: ProviderRow[],
  marketRows: MarketRow[],
  scenarios: { id: string; name: string; scenarioInputs: ScenarioInputs }[],
  options: RunBatchOptions = {}
): BatchResults {
  const {
    synonymMap = {},
    onProgress,
    chunkSize = DEFAULT_CHUNK_SIZE,
  } = options

  const scenarioList =
    scenarios.length > 0
      ? scenarios
      : [{ id: 'default', name: 'Current', scenarioInputs: {} as ScenarioInputs }]
  const numScenarios = scenarioList.length
  const total = providers.length * numScenarios
  const start = performance.now()
  const rows: BatchRowResult[] = []

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const providerId = (provider.providerId ?? provider.providerName ?? `provider-${i}`).toString()
    const providerName = (provider.providerName ?? '').toString()
    const specialty = (provider.specialty ?? '').toString()
    const division = (provider.division ?? '').toString()

    const match = matchMarketRow(provider, marketRows, synonymMap)
    const warnings: string[] = []
    if (!specialty.trim()) {
      warnings.push('Missing specialty')
    }
    const clinicalFTE = Number(provider.clinicalFTE) || Number(provider.totalFTE) || 1
    if (clinicalFTE <= 0) {
      warnings.push('Clinical FTE = 0; ratios may be unstable')
    }

    if (!match.marketRow || match.status === 'Missing') {
      const status: MarketMatchStatus = !specialty.trim() ? 'Missing' : match.status
      const missingWarn = specialty.trim()
        ? `Market missing for specialty: ${specialty}`
        : 'Market missing (no specialty)'
      if (!warnings.includes(missingWarn)) warnings.push(missingWarn)

      for (const sc of scenarioList) {
        rows.push({
          providerId,
          providerName,
          specialty,
          division,
          scenarioId: sc.id,
          scenarioName: sc.name,
          scenarioInputsSnapshot: sc.scenarioInputs,
          results: null,
          matchStatus: status,
          warnings: [...warnings],
          riskLevel: 'high',
        })
      }
    } else {
      for (const sc of scenarioList) {
        const results = computeScenario(provider, match.marketRow, sc.scenarioInputs)
        const allWarnings = [...warnings, ...results.warnings, ...results.risk.warnings]
        if (results.risk.highRisk.length) {
          allWarnings.push(...results.risk.highRisk.map((r) => `High risk: ${r}`))
        }
        rows.push({
          providerId,
          providerName,
          specialty,
          division,
          scenarioId: sc.id,
          scenarioName: sc.name,
          scenarioInputsSnapshot: sc.scenarioInputs,
          results,
          matchStatus: match.status,
          matchedMarketSpecialty: match.matchedKey,
          warnings: allWarnings,
          riskLevel: deriveRiskLevel(results),
        })
      }
    }

    const processed = (i + 1) * numScenarios
    if (onProgress && (processed % chunkSize < numScenarios)) {
      const elapsed = Math.round(performance.now() - start)
      onProgress(Math.min(processed, total), total, elapsed)
    }
  }

  if (onProgress) {
    onProgress(total, total, Math.round(performance.now() - start))
  }

  const runAt = new Date().toISOString()
  const scenarioCount = numScenarios
  const providerCount = providers.length

  return {
    rows,
    runAt,
    scenarioCount,
    providerCount,
  }
}
