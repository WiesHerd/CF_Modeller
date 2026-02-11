/**
 * Proximity matching for provider → market specialty names.
 * Uses normalized text, token overlap, containment, and Levenshtein for short strings.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
}

function tokenSet(s: string): Set<string> {
  const tokens = normalize(s)
    .split(/\s*[-_,/]\s*|\s+/)
    .filter((t) => t.length > 0)
  return new Set(tokens)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  const inter = [...a].filter((x) => b.has(x)).length
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

function levenshtein(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an
  let prev = Array.from({ length: bn + 1 }, (_, i) => i)
  for (let i = 1; i <= an; i++) {
    const curr: number[] = [i]
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
    }
    prev = curr
  }
  return prev[bn]
}

/** Similarity score in [0, 1]. Higher = better match. */
export function specialtySimilarity(provider: string, market: string): number {
  const p = normalize(provider)
  const m = normalize(market)
  if (p === m) return 1
  if (p.length === 0 || m.length === 0) return 0
  if (m.includes(p) || p.includes(m)) return 0.92
  const j = jaccard(tokenSet(provider), tokenSet(market))
  const maxLen = Math.max(p.length, m.length)
  const levRatio =
    maxLen <= 40
      ? 1 - levenshtein(p, m) / Math.max(p.length, m.length, 1)
      : 0
  return Math.max(j, levRatio * 0.85)
}

/** Minimum score to suggest a mapping (tune to avoid bad matches). */
const SUGGEST_THRESHOLD = 0.45

/**
 * For each provider specialty, find the best-matching market specialty by proximity.
 * Returns a record provider → market only when score >= SUGGEST_THRESHOLD.
 * Each market is suggested for at most one provider (best score wins).
 */
export function suggestSpecialtyMappings(
  providerSpecialties: string[],
  marketSpecialties: string[]
): Record<string, string> {
  if (marketSpecialties.length === 0) return {}
  const result: Record<string, string> = {}
  const usedMarkets = new Set<string>()

  const candidates = providerSpecialties.map((prov) => {
    let bestMarket = ''
    let bestScore = 0
    for (const market of marketSpecialties) {
      if (usedMarkets.has(market)) continue
      const score = specialtySimilarity(prov, market)
      if (score > bestScore && score >= SUGGEST_THRESHOLD) {
        bestScore = score
        bestMarket = market
      }
    }
    return { prov, bestMarket, bestScore }
  })

  // Sort by score descending so stronger matches claim their market first
  candidates.sort((a, b) => b.bestScore - a.bestScore)
  for (const { prov, bestMarket } of candidates) {
    if (bestMarket && !usedMarkets.has(bestMarket)) {
      result[prov] = bestMarket
      usedMarkets.add(bestMarket)
    }
  }
  return result
}
