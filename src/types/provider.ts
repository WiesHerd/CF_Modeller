/**
 * One row per provider from the provider-level dataset.
 * All fields optional at parse time; required fields validated before compute.
 */
export interface ProviderRow {
  providerId?: string
  providerName?: string
  specialty?: string
  division?: string
  totalFTE?: number
  clinicalFTE?: number
  adminFTE?: number
  baseSalary?: number
  currentTCC?: number
  pchWRVUs?: number
  outsideWRVUs?: number
  totalWRVUs?: number
  currentCF?: number
  currentThreshold?: number
}

/** Expected column names for provider file (for mapping UI). */
export const PROVIDER_EXPECTED_COLUMNS = [
  'providerId',
  'providerName',
  'specialty',
  'division',
  'totalFTE',
  'clinicalFTE',
  'adminFTE',
  'baseSalary',
  'currentTCC',
  'pchWRVUs',
  'outsideWRVUs',
  'totalWRVUs',
  'currentCF',
  'currentThreshold',
] as const

export type ProviderColumnKey = (typeof PROVIDER_EXPECTED_COLUMNS)[number]
