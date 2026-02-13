/**
 * Dynamic TCC (Total Cash Compensation) component registry.
 * Built-in components drive the optimizer/batch "include in TCC" UI; custom
 * components can be added from the provider file (e.g. extra columns mapped in Upload).
 */

export type TCCComponentType = 'from_file' | 'computed' | 'percent_of_base'

export interface TCCComponentDefinition {
  id: string
  label: string
  description: string
  type: TCCComponentType
  /** Optional: when true, value in file is per 1.0 FTE; multiply by clinical FTE for raw TCC. */
  supportsNormalizeForFTE?: boolean
}

/** Built-in TCC components shown in optimizer and batch configure. Value-based and other incentives are now named layers. */
export const TCC_BUILTIN_COMPONENTS: TCCComponentDefinition[] = [
  {
    id: 'quality',
    label: 'Quality payments',
    description: 'From provider file (e.g. quality bonuses).',
    type: 'from_file',
    supportsNormalizeForFTE: true,
  },
  {
    id: 'workRVUIncentive',
    label: 'Work RVU incentive',
    description: 'Target = clinical $ ÷ CF; incentive if wRVUs exceed target.',
    type: 'computed',
  },
]

/** All built-in component IDs. */
export const TCC_BUILTIN_IDS = TCC_BUILTIN_COMPONENTS.map((c) => c.id) as readonly string[]
export type TCCBuiltinId = (typeof TCC_BUILTIN_IDS)[number]

/** Per-component options (e.g. normalize for FTE). */
export interface TCCComponentOptions {
  /** When true, value is treated as per 1.0 FTE; multiply by clinical FTE when computing raw TCC. */
  normalizeForFTE?: boolean
}

/** Which components are included in baseline/modeled TCC and their options. */
export type TCCComponentInclusion = Record<string, { included: boolean; normalizeForFTE?: boolean }>

export const DEFAULT_TCC_COMPONENT_INCLUSION: TCCComponentInclusion = {
  quality: { included: true },
  workRVUIncentive: { included: true },
}

/** Custom TCC column from upload: user maps a file column to a TCC component. */
export interface CustomTCCColumnDefinition {
  id: string
  label: string
  /** Header name in the uploaded file (source column). */
  sourceColumn: string
}

/** Layered additional TCC on top of component-based TCC (applies to both baseline and modeled). */
export interface AdditionalTCCConfig {
  /** Percent of clinical base (at provider FTE); 0 = off. */
  percentOfBase?: number
  /** Dollar amount per 1.0 clinical FTE; raw = this × cFTE. */
  dollarPer1p0FTE?: number
  /** Flat dollar add per provider. */
  flatDollar?: number
}

/** Type of a single named TCC layer. */
export type TCCLayerType = 'percent_of_base' | 'dollar_per_1p0_FTE' | 'flat_dollar' | 'from_file'

/** One named layer in the additional TCC list (optimizer). */
export interface TCCLayerConfig {
  id: string
  name: string
  type: TCCLayerType
  /** For percent_of_base, dollar_per_1p0_FTE, flat_dollar. */
  value?: number
  /** For from_file: provider field key (e.g. 'otherIncentives'). */
  sourceColumn?: string
  /** For from_file: when true, treat file value as per 1.0 FTE (multiply by cFTE). */
  normalizeForFTE?: boolean
}
