import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'

/**
 * One example provider for testing the app without uploading.
 * Matches specialty "Cardiology" so it pairs with SAMPLE_MARKET_ROWS.
 */
export const SAMPLE_PROVIDER_ROWS: ProviderRow[] = [
  {
    providerId: 'P001',
    providerName: 'Jane Smith',
    specialty: 'Cardiology',
    division: 'Heart',
    totalFTE: 1,
    clinicalFTE: 0.9,
    adminFTE: 0.1,
    baseSalary: 450_000,
    currentTCC: 475_000,
    pchWRVUs: 5200,
    outsideWRVUs: 200,
    totalWRVUs: 5400,
    currentCF: 85,
    currentThreshold: 80,
  },
]

/**
 * One example market row (Cardiology) for testing. Used so the user can
 * select specialty and see results without uploading a market file.
 */
export const SAMPLE_MARKET_ROWS: MarketRow[] = [
  {
    specialty: 'Cardiology',
    providerType: 'Physician',
    region: 'Midwest',
    TCC_25: 380_000,
    TCC_50: 420_000,
    TCC_75: 480_000,
    TCC_90: 550_000,
    WRVU_25: 4500,
    WRVU_50: 5200,
    WRVU_75: 6000,
    WRVU_90: 7000,
    CF_25: 75,
    CF_50: 82,
    CF_75: 88,
    CF_90: 95,
  },
]
