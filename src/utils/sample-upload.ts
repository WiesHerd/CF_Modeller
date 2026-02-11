import { PROVIDER_EXPECTED_COLUMNS } from '@/types/provider'
import { MARKET_EXPECTED_COLUMNS } from '@/types/market'

/** Provider sample: header row + 2 example rows. Columns: providerName, specialty, division, totalFTE, clinicalFTE, adminFTE, researchFTE, teachingFTE, baseSalary, qualityPayments, otherIncentives, workRVUs, outsideWRVUs, currentCF, productivityModel */
const PROVIDER_SAMPLE_HEADER = PROVIDER_EXPECTED_COLUMNS.join(',')

const PROVIDER_SAMPLE_ROWS = [
  'Jane Smith,Cardiology,Heart,1,0.9,0.1,450000,5200,200,85,productivity',
  'John Doe,Internal Medicine,Primary Care,1,0.95,0.05,320000,4100,100,78,base',
]

export const PROVIDER_SAMPLE_CSV = [PROVIDER_SAMPLE_HEADER, ...PROVIDER_SAMPLE_ROWS].join('\n')

/** Market sample: header row + 2 example rows. */
const MARKET_SAMPLE_HEADER = MARKET_EXPECTED_COLUMNS.join(',')

const MARKET_SAMPLE_ROWS = [
  'Cardiology,Physician,Midwest,380000,420000,480000,550000,4500,5200,6000,7000,75,82,88,95',
  'Internal Medicine,Physician,Midwest,280000,310000,350000,400000,3500,4100,4800,5500,72,78,84,90',
]

export const MARKET_SAMPLE_CSV = [MARKET_SAMPLE_HEADER, ...MARKET_SAMPLE_ROWS].join('\n')

const CSV_MIME = 'text/csv;charset=utf-8;'

/**
 * Trigger browser download of a CSV string as a file.
 * Use for "Download sample" so users get the exact column structure.
 */
export function downloadSampleCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: CSV_MIME })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const PROVIDER_SAMPLE_FILENAME = 'provider-upload-sample.csv'
export const MARKET_SAMPLE_FILENAME = 'market-upload-sample.csv'
