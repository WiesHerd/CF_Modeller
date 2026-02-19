/**
 * Shared math guard helpers used across computation engines.
 * Centralised here to avoid duplication in compute, optimizer-engine,
 * and normalize-compensation.
 */

/** Coerce any value to a finite number; returns 0 for NaN or non-numeric input. */
export function num(x: unknown): number {
  if (typeof x === 'number' && !Number.isNaN(x)) return x
  const n = Number(x)
  return Number.isNaN(n) ? 0 : n
}

/** Safe division that returns `fallback` when the denominator is zero, null, or NaN. */
export function safeDiv(a: number, b: number, fallback: number): number {
  if (b == null || b === 0 || Number.isNaN(b)) return fallback
  const q = a / b
  return Number.isNaN(q) ? fallback : q
}
