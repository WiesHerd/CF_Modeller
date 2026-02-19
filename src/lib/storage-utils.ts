/**
 * Shared localStorage helpers used across all storage modules.
 * Centralises the JSON parse/stringify + error handling pattern so each
 * module only needs to supply its key, validator, and max-count policy.
 */

/**
 * Read a JSON array from localStorage.
 * Returns `null` if the key is missing or the value is not a valid array.
 * Any parse errors are swallowed and return `null`.
 */
export function readStorageArray<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as T[]
  } catch {
    return null
  }
}

/**
 * Write an array to localStorage, sorted ascending by `createdAt` and trimmed
 * to `maxCount` most-recent items. Silently ignores write errors.
 */
export function writeStorageArray<T extends { createdAt: string }>(
  key: string,
  items: T[],
  maxCount: number
): void {
  try {
    const sorted = [...items].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    const trimmed = sorted.length > maxCount ? sorted.slice(-maxCount) : sorted
    localStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // localStorage may be unavailable (private mode quota, etc.)
  }
}

/**
 * Read a single JSON value from localStorage.
 * Returns `null` if the key is missing or the value cannot be parsed.
 */
export function readStorageItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Write a single value to localStorage as JSON. Silently ignores errors. */
export function writeStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage may be unavailable
  }
}

/** Remove a key from localStorage. Silently ignores errors. */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // localStorage may be unavailable
  }
}
