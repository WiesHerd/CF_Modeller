/**
 * Column mapping: expected field name -> uploaded column name (or empty to skip).
 */
export type ColumnMapping = Record<string, string>

/**
 * Result of parsing a file with optional mapping applied.
 */
export interface ParsedUpload<T> {
  rows: T[]
  headers: string[]
  mapping: ColumnMapping
  errors?: string[]
}

/**
 * Raw parsed row before mapping (all string values).
 */
export type RawRow = Record<string, string>
