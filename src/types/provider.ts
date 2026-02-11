/** Single line item that rolls up into total base (TCC). */
export interface BasePayComponent {
  id: string
  label: string
  amount: number
  /** Optional FTE for this component (e.g. 0.75 clinical, 0.25 admin). */
  fte?: number
}

/**
 * One row per provider from the provider-level dataset.
 * All fields optional at parse time; required fields validated before compute.
 * providerId is set from providerName at load time for selection; not required in file.
 */
export interface ProviderRow {
  /** Set from providerName at load if not in file; used for selection. */
  providerId?: string
  providerName?: string
  specialty?: string
  division?: string
  totalFTE?: number
  clinicalFTE?: number
  adminFTE?: number
  /** CART: research FTE. */
  researchFTE?: number
  /** CART: teaching FTE. */
  teachingFTE?: number
  baseSalary?: number
  /** When set, total of amounts rolls up to TCC (overrides baseSalary for compute). */
  basePayComponents?: BasePayComponent[]
  /** Optional; when present overrides calculated clinical FTE salary. */
  clinicalFTESalary?: number
  currentTCC?: number
  /** Quality / value-based payments (e.g. quality bonuses). */
  qualityPayments?: number
  /** Other incentives (e.g. retention, sign-on). */
  otherIncentives?: number
  /** Work RVUs (main); totalWRVUs = workRVUs + outsideWRVUs when not provided. */
  workRVUs?: number
  /** Legacy; prefer workRVUs. */
  pchWRVUs?: number
  outsideWRVUs?: number
  /** Computed as workRVUs + outsideWRVUs when not in file. */
  totalWRVUs?: number
  currentCF?: number
  currentThreshold?: number
  /** Stipends / admin carveouts; part of total base salary (not added on top of base for TCC). */
  nonClinicalPay?: number
  /** "base" | "productivity" */
  productivityModel?: string
}

/** Expected column names for provider file (for mapping UI). CART = Clinical, Admin, Research, Teaching FTE. */
export const PROVIDER_EXPECTED_COLUMNS = [
  'providerName',
  'specialty',
  'division',
  'totalFTE',
  'clinicalFTE',
  'adminFTE',
  'researchFTE',
  'teachingFTE',
  'baseSalary',
  'workRVUs',
  'outsideWRVUs',
  'currentCF',
  'nonClinicalPay',
  'qualityPayments',
  'otherIncentives',
  'currentTCC',
  'productivityModel',
] as const

export type ProviderColumnKey = (typeof PROVIDER_EXPECTED_COLUMNS)[number]
