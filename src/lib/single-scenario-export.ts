import * as XLSX from 'xlsx'
import type { MarketRow } from '@/types/market'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'

interface ExportSingleScenarioInput {
  provider: ProviderRow | null
  marketRow: MarketRow | null
  scenarioInputs: ScenarioInputs
  results: ScenarioResults | null
  mode: 'existing' | 'new'
}

type CellValue = string | number | boolean

interface ReportSection {
  title: string
  rows: Array<[string, CellValue]>
}

const EMPTY = '-'

function safe(value: unknown): string | number {
  if (value == null) return EMPTY
  return typeof value === 'number' && !Number.isFinite(value) ? EMPTY : (value as string | number)
}

function formatNumber(value: number | undefined, decimals = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatCurrency(value: number | undefined, decimals = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function formatPercent(value: number | undefined, decimals = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return `${value.toFixed(decimals)}%`
}

function formatPercentile(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return `${value.toFixed(1)}th`
}

function formatBooleanFlag(value: boolean | undefined): string {
  if (value == null) return EMPTY
  return value ? 'Y' : 'N'
}

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function getFreezeTopRow() {
  return {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  }
}

function buildMetricRows(sections: ReportSection[]): CellValue[][] {
  const aoa: CellValue[][] = [['Metric', 'Value']]
  for (const section of sections) {
    aoa.push([section.title.toUpperCase(), ''])
    for (const [metric, value] of section.rows) {
      aoa.push([metric, value])
    }
    aoa.push(['', ''])
  }
  return aoa
}

function createReportSheet(sections: ReportSection[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(buildMetricRows(sections))
  ws['!cols'] = [{ wch: 44 }, { wch: 30 }]
  ;(ws as unknown as Record<string, unknown>)['!freeze'] = getFreezeTopRow()
  ws['!autofilter'] = { ref: 'A1:B1' }
  return ws
}

function createRawSheet(
  data: Record<string, string | number>[],
  widths?: { wch: number }[]
): XLSX.WorkSheet {
  const rows = data.length > 0 ? data : [{}]
  const ws = XLSX.utils.json_to_sheet(rows)
  const keys = Object.keys(rows[0] ?? {})
  ws['!cols'] = widths ?? keys.map((k) => ({ wch: Math.min(Math.max(k.length + 2, 12), 26) }))
  ;(ws as unknown as Record<string, unknown>)['!freeze'] = getFreezeTopRow()
  if (keys.length > 0) {
    const lastColIndex = Math.max(0, keys.length - 1)
    const lastCol = XLSX.utils.encode_col(lastColIndex)
    ws['!autofilter'] = { ref: `A1:${lastCol}1` }
  }
  return ws
}

export function exportSingleScenarioXLSX(input: ExportSingleScenarioInput): void {
  const { provider, marketRow, scenarioInputs, results, mode } = input
  const generatedOn = new Date().toLocaleString()

  const summarySections: ReportSection[] = [
    {
      title: 'Report Metadata',
      rows: [
        ['Generated On', generatedOn],
        ['Model Mode', mode === 'existing' ? 'Uploaded provider' : 'Custom provider'],
        ['Provider', provider?.providerName ?? provider?.providerId ?? EMPTY],
        ['Specialty', provider?.specialty ?? marketRow?.specialty ?? EMPTY],
        ['Has Results', results ? 'Yes' : 'No'],
      ],
    },
  ]

  const providerReportSections: ReportSection[] = [
    {
      title: 'Provider Identification',
      rows: [
        ['Provider ID', provider?.providerId ?? EMPTY],
        ['Provider Name', provider?.providerName ?? EMPTY],
        ['Specialty', provider?.specialty ?? EMPTY],
        ['Provider Type', provider?.providerType ?? EMPTY],
        ['Division', provider?.division ?? EMPTY],
      ],
    },
    {
      title: 'FTE Allocation',
      rows: [
        ['Total FTE', formatNumber(provider?.totalFTE, 2)],
        ['Clinical FTE', formatNumber(provider?.clinicalFTE, 2)],
        ['Admin FTE', formatNumber(provider?.adminFTE, 2)],
        ['Research FTE', formatNumber(provider?.researchFTE, 2)],
        ['Teaching FTE', formatNumber(provider?.teachingFTE, 2)],
      ],
    },
    {
      title: 'Compensation',
      rows: [
        ['Base Salary', formatCurrency(provider?.baseSalary)],
        ['Non-Clinical Pay', formatCurrency(provider?.nonClinicalPay)],
        ['Quality Payments', formatCurrency(provider?.qualityPayments)],
        ['Other Incentives', formatCurrency(provider?.otherIncentives)],
        ['Current TCC', formatCurrency(provider?.currentTCC)],
      ],
    },
    {
      title: 'Productivity Metrics',
      rows: [
        ['Total wRVUs', formatNumber(provider?.totalWRVUs)],
        ['Work wRVUs', formatNumber(provider?.workRVUs)],
        ['Current CF', formatCurrency(provider?.currentCF, 2)],
        ['Current Threshold', formatNumber(provider?.currentThreshold)],
      ],
    },
  ]

  const scenarioReportSections: ReportSection[] = [
    {
      title: 'Conversion Factor Settings',
      rows: [
        ['CF Source', scenarioInputs.cfSource],
        ['Proposed CF Percentile', formatPercentile(scenarioInputs.proposedCFPercentile)],
        ['Haircut %', formatPercent(scenarioInputs.haircutPct)],
        ['Override CF', formatCurrency(scenarioInputs.overrideCF, 2)],
      ],
    },
    {
      title: 'PSQ / Value-Based Payment',
      rows: [
        ['PSQ %', formatPercent(scenarioInputs.psqPercent)],
        ['Current PSQ %', formatPercent(scenarioInputs.currentPsqPercent)],
        ['PSQ Basis', scenarioInputs.psqBasis ?? EMPTY],
      ],
    },
    {
      title: 'Threshold Settings',
      rows: [
        ['Threshold Method', scenarioInputs.thresholdMethod],
        ['Annual Threshold', formatNumber(scenarioInputs.annualThreshold)],
        ['wRVU Percentile Target', formatPercentile(scenarioInputs.wrvuPercentile)],
      ],
    },
    {
      title: 'Modeled Overrides',
      rows: [
        ['Modeled Base Pay', formatCurrency(scenarioInputs.modeledBasePay)],
        ['Modeled Non-Clinical Pay', formatCurrency(scenarioInputs.modeledNonClinicalPay)],
        ['Modeled Total wRVUs', formatNumber(scenarioInputs.modeledWRVUs)],
        ['Modeled Work wRVUs', formatNumber(scenarioInputs.modeledWorkWRVUs)],
        ['Modeled Other wRVUs', formatNumber(scenarioInputs.modeledOtherWRVUs)],
      ],
    },
  ]

  const marketReportSections: ReportSection[] = [
    {
      title: 'Market Context',
      rows: [
        ['Specialty', marketRow?.specialty ?? EMPTY],
        ['Provider Type', marketRow?.providerType ?? EMPTY],
        ['Region', marketRow?.region ?? EMPTY],
      ],
    },
    {
      title: 'TCC Percentiles',
      rows: [
        ['25th Percentile', formatCurrency(marketRow?.TCC_25)],
        ['50th Percentile', formatCurrency(marketRow?.TCC_50)],
        ['75th Percentile', formatCurrency(marketRow?.TCC_75)],
        ['90th Percentile', formatCurrency(marketRow?.TCC_90)],
      ],
    },
    {
      title: 'wRVU Percentiles',
      rows: [
        ['25th Percentile', formatNumber(marketRow?.WRVU_25)],
        ['50th Percentile', formatNumber(marketRow?.WRVU_50)],
        ['75th Percentile', formatNumber(marketRow?.WRVU_75)],
        ['90th Percentile', formatNumber(marketRow?.WRVU_90)],
      ],
    },
    {
      title: 'CF Percentiles',
      rows: [
        ['25th Percentile', formatCurrency(marketRow?.CF_25, 2)],
        ['50th Percentile', formatCurrency(marketRow?.CF_50, 2)],
        ['75th Percentile', formatCurrency(marketRow?.CF_75, 2)],
        ['90th Percentile', formatCurrency(marketRow?.CF_90, 2)],
      ],
    },
  ]

  const resultsReportSections: ReportSection[] = [
    {
      title: 'Total Cash Compensation',
      rows: [
        ['Current TCC', formatCurrency(results?.currentTCC)],
        ['Modeled TCC', formatCurrency(results?.modeledTCC)],
        ['Change in TCC', formatCurrency(results?.changeInTCC)],
      ],
    },
    {
      title: 'Percentiles',
      rows: [
        ['Current TCC Percentile', formatPercentile(results?.tccPercentile)],
        ['Modeled TCC Percentile', formatPercentile(results?.modeledTCCPercentile)],
        ['wRVU Percentile', formatPercentile(results?.wrvuPercentile)],
      ],
    },
    {
      title: 'Conversion Factor',
      rows: [
        ['Current CF', formatCurrency(results?.currentCF, 2)],
        ['Modeled CF', formatCurrency(results?.modeledCF, 2)],
        ['Current CF Percentile', formatPercentile(results?.cfPercentileCurrent)],
        ['Modeled CF Percentile', formatPercentile(results?.cfPercentileModeled)],
      ],
    },
    {
      title: 'Incentive and Productivity',
      rows: [
        ['Annual Threshold', formatNumber(results?.annualThreshold)],
        ['Total wRVUs', formatNumber(results?.totalWRVUs)],
        ['wRVUs Above Threshold', formatNumber(results?.wRVUsAboveThreshold)],
        ['Current Incentive', formatCurrency(results?.currentIncentive)],
        ['Modeled Annual Incentive', formatCurrency(results?.annualIncentive)],
        ['PSQ Dollars', formatCurrency(results?.psqDollars)],
      ],
    },
    {
      title: 'Alignment',
      rows: [
        ['Alignment Gap (Baseline)', formatNumber(results?.alignmentGapBaseline, 2)],
        ['Alignment Gap (Modeled)', formatNumber(results?.alignmentGapModeled, 2)],
        ['Imputed TCC/wRVU (Current)', formatCurrency(results?.imputedTCCPerWRVURatioCurrent, 2)],
        ['Imputed TCC/wRVU (Modeled)', formatCurrency(results?.imputedTCCPerWRVURatioModeled, 2)],
      ],
    },
  ]

  const governanceReportSections: ReportSection[] = [
    {
      title: 'Governance Flags',
      rows: [
        ['Underpay Risk', formatBooleanFlag(results?.governanceFlags?.underpayRisk)],
        ['CF Below 25th Percentile', formatBooleanFlag(results?.governanceFlags?.cfBelow25)],
        ['Modeled in Policy Band', formatBooleanFlag(results?.governanceFlags?.modeledInPolicyBand)],
        ['FMV Check Suggested', formatBooleanFlag(results?.governanceFlags?.fmvCheckSuggested)],
      ],
    },
    {
      title: 'Warnings',
      rows: [
        ['Warnings', results?.warnings?.length ? results.warnings.join('; ') : EMPTY],
      ],
    },
  ]

  const providerRawRows: Record<string, string | number>[] = provider
    ? [{
        providerId: safe(provider.providerId),
        providerName: safe(provider.providerName),
        specialty: safe(provider.specialty),
        providerType: safe(provider.providerType),
        division: safe(provider.division),
        totalFTE: safe(provider.totalFTE),
        clinicalFTE: safe(provider.clinicalFTE),
        adminFTE: safe(provider.adminFTE),
        researchFTE: safe(provider.researchFTE),
        teachingFTE: safe(provider.teachingFTE),
        baseSalary: safe(provider.baseSalary),
        nonClinicalPay: safe(provider.nonClinicalPay),
        qualityPayments: safe(provider.qualityPayments),
        otherIncentives: safe(provider.otherIncentives),
        totalWRVUs: safe(provider.totalWRVUs),
        workRVUs: safe(provider.workRVUs),
        currentCF: safe(provider.currentCF),
        currentThreshold: safe(provider.currentThreshold),
        currentTCC: safe(provider.currentTCC),
      }]
    : [{}]

  const scenarioRawRows: Record<string, string | number>[] = [{
    cfSource: safe(scenarioInputs.cfSource),
    proposedCFPercentile: safe(scenarioInputs.proposedCFPercentile),
    haircutPct: formatPercent(scenarioInputs.haircutPct),
    overrideCF: safe(scenarioInputs.overrideCF),
    psqPercent: formatPercent(scenarioInputs.psqPercent),
    currentPsqPercent: formatPercent(scenarioInputs.currentPsqPercent),
    psqBasis: safe(scenarioInputs.psqBasis),
    thresholdMethod: safe(scenarioInputs.thresholdMethod),
    annualThreshold: safe(scenarioInputs.annualThreshold),
    wrvuPercentile: safe(scenarioInputs.wrvuPercentile),
    modeledBasePay: safe(scenarioInputs.modeledBasePay),
    modeledNonClinicalPay: safe(scenarioInputs.modeledNonClinicalPay),
    modeledWRVUs: safe(scenarioInputs.modeledWRVUs),
    modeledWorkWRVUs: safe(scenarioInputs.modeledWorkWRVUs),
    modeledOtherWRVUs: safe(scenarioInputs.modeledOtherWRVUs),
  }]

  const marketRawRows: Record<string, string | number>[] = marketRow
    ? [{
        specialty: safe(marketRow.specialty),
        providerType: safe(marketRow.providerType),
        region: safe(marketRow.region),
        TCC_25: safe(marketRow.TCC_25),
        TCC_50: safe(marketRow.TCC_50),
        TCC_75: safe(marketRow.TCC_75),
        TCC_90: safe(marketRow.TCC_90),
        WRVU_25: safe(marketRow.WRVU_25),
        WRVU_50: safe(marketRow.WRVU_50),
        WRVU_75: safe(marketRow.WRVU_75),
        WRVU_90: safe(marketRow.WRVU_90),
        CF_25: safe(marketRow.CF_25),
        CF_50: safe(marketRow.CF_50),
        CF_75: safe(marketRow.CF_75),
        CF_90: safe(marketRow.CF_90),
      }]
    : [{}]

  const resultsRawRows: Record<string, string | number>[] = results
    ? [{
        currentTCC: safe(results.currentTCC),
        modeledTCC: safe(results.modeledTCC),
        changeInTCC: safe(results.changeInTCC),
        currentCF: safe(results.currentCF),
        modeledCF: safe(results.modeledCF),
        annualThreshold: safe(results.annualThreshold),
        totalWRVUs: safe(results.totalWRVUs),
        wRVUsAboveThreshold: safe(results.wRVUsAboveThreshold),
        currentIncentive: safe(results.currentIncentive),
        annualIncentive: safe(results.annualIncentive),
        psqDollars: safe(results.psqDollars),
        tccPercentile: safe(results.tccPercentile),
        modeledTCCPercentile: safe(results.modeledTCCPercentile),
        wrvuPercentile: safe(results.wrvuPercentile),
        cfPercentileCurrent: safe(results.cfPercentileCurrent),
        cfPercentileModeled: safe(results.cfPercentileModeled),
        alignmentGapBaseline: safe(results.alignmentGapBaseline),
        alignmentGapModeled: safe(results.alignmentGapModeled),
        imputedTCCPerWRVURatioCurrent: safe(results.imputedTCCPerWRVURatioCurrent),
        imputedTCCPerWRVURatioModeled: safe(results.imputedTCCPerWRVURatioModeled),
      }]
    : [{}]

  const governanceRawRows: Record<string, string | number>[] = results
    ? [{
        underpayRisk: formatBooleanFlag(results.governanceFlags.underpayRisk),
        cfBelow25: formatBooleanFlag(results.governanceFlags.cfBelow25),
        modeledInPolicyBand: formatBooleanFlag(results.governanceFlags.modeledInPolicyBand),
        fmvCheckSuggested: formatBooleanFlag(results.governanceFlags.fmvCheckSuggested),
        warnings: results.warnings.join('; ') || EMPTY,
      }]
    : [{}]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, createReportSheet(summarySections), 'Summary')
  XLSX.utils.book_append_sheet(wb, createReportSheet(providerReportSections), 'Provider Report')
  XLSX.utils.book_append_sheet(wb, createReportSheet(scenarioReportSections), 'Scenario Report')
  XLSX.utils.book_append_sheet(wb, createReportSheet(marketReportSections), 'Market Report')
  XLSX.utils.book_append_sheet(wb, createReportSheet(resultsReportSections), 'Results Report')
  XLSX.utils.book_append_sheet(wb, createReportSheet(governanceReportSections), 'Governance Report')

  XLSX.utils.book_append_sheet(wb, createRawSheet(providerRawRows), 'Provider Raw')
  XLSX.utils.book_append_sheet(wb, createRawSheet(scenarioRawRows), 'Scenario Inputs Raw')
  XLSX.utils.book_append_sheet(wb, createRawSheet(marketRawRows), 'Market Benchmarks Raw')
  XLSX.utils.book_append_sheet(wb, createRawSheet(resultsRawRows), 'Results Raw')
  XLSX.utils.book_append_sheet(wb, createRawSheet(governanceRawRows), 'Governance Raw')

  const providerToken = (provider?.providerName ?? provider?.providerId ?? 'provider')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  XLSX.writeFile(wb, `single-scenario-${providerToken || 'provider'}-${getDateStamp()}.xlsx`)
}
