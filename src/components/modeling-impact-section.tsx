import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImpactHeadline } from '@/components/impact-headline'
import { PercentilePositionChart } from '@/components/charts/percentile-position-chart'
import { TCCWaterfallChart, type WaterfallSegment } from '@/components/charts/tcc-waterfall-chart'
import { PercentileComparisonChart } from '@/components/charts/percentile-comparison-chart'
import { CFComparisonTable } from '@/components/cf-comparison-table'
import { formatCurrency, formatOrdinal } from '@/utils/format'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'

/** One-sentence waterfall card title (Zelazny-style): net outcome + drivers. */
export function getWaterfallChartTitle(results: ScenarioResults, summary: string | undefined): string {
  const change = results.changeInTCC
  const endTCC = formatCurrency(results.modeledTCC, { decimals: 0 })
  if (change === 0) return `TCC unchanged at ${endTCC}.`
  const amt = formatCurrency(Math.abs(change), { decimals: 0 })
  const direction = change > 0 ? 'increases' : 'decreases'
  const driverText = summary
    ? summary.replace(/\s+drive the (increase|decrease)\.?$/i, '').trim()
    : ''
  const drivenBy = driverText ? `, driven by ${driverText}` : ''
  return `TCC ${direction} by ${amt} to ${endTCC}${drivenBy}.`
}

/** One-sentence takeaway for waterfall card (Zelazny-style): net outcome + drivers. */
export function getWaterfallCallout(results: ScenarioResults, summary: string | undefined): string {
  const change = results.changeInTCC
  const endTCC = formatCurrency(results.modeledTCC, { decimals: 0 })
  if (change === 0) return `TCC unchanged at ${endTCC}.`
  const driverText = summary
    ? summary.replace(/\s+drive the (increase|decrease)\.?$/i, '').trim()
    : ''
  const drivenBy = driverText ? `, driven by ${driverText}` : ''
  return `Net change: ${change > 0 ? '+' : ''}${formatCurrency(change, { decimals: 0 })} to ${endTCC}${drivenBy}.`
}

function num(x: unknown): number {
  if (typeof x === 'number' && !Number.isNaN(x)) return x
  const n = Number(x)
  return Number.isNaN(n) ? 0 : n
}

export function buildWaterfallSegments(
  results: ScenarioResults,
  provider: ProviderRow | null,
  scenarioInputs: ScenarioInputs
): WaterfallSegment[] {
  const modeledTCC = results.modeledTCC
  const baseSalary = num(provider?.baseSalary)
  const modeledBase =
    scenarioInputs.modeledBasePay != null && Number.isFinite(scenarioInputs.modeledBasePay)
      ? scenarioInputs.modeledBasePay
      : baseSalary
  const currentIncentiveForTCC = results.currentIncentive > 0 ? results.currentIncentive : 0
  const annualIncentiveForTCC = results.annualIncentive > 0 ? results.annualIncentive : 0
  const currentPsqDollars = results.currentPsqDollars ?? results.psqDollars ?? 0
  const psqDollars = results.psqDollars
  const qualityPayments = num(provider?.qualityPayments) || num(provider?.currentTCC) || 0
  const otherIncentives = num(provider?.otherIncentives) || 0

  const deltaBase = modeledBase - baseSalary
  const deltaIncentive = annualIncentiveForTCC - currentIncentiveForTCC
  const deltaPsq = psqDollars - currentPsqDollars

  // Story: Total base comp → + PSQ → + wRVU incentives → + Quality/Other (if any) [= Current TCC] → Δ Base → Δ Incentive → Δ PSQ → Modeled TCC
  const segments: WaterfallSegment[] = [
    { name: 'Total base comp', value: baseSalary, type: 'start' },
    { name: '+ PSQ', value: currentPsqDollars, type: 'delta' },
    { name: '+ wRVU incentives', value: currentIncentiveForTCC, type: 'delta' },
    ...(qualityPayments > 0 ? [{ name: '+ Quality payments', value: qualityPayments, type: 'delta' as const }] : []),
    ...(otherIncentives > 0 ? [{ name: '+ Other incentives', value: otherIncentives, type: 'delta' as const }] : []),
    { name: 'Δ Base pay', value: deltaBase, type: 'delta' },
    { name: 'Δ Incentive', value: deltaIncentive, type: 'delta' },
    { name: 'Δ PSQ', value: deltaPsq, type: 'delta' },
    { name: 'Modeled TCC', value: modeledTCC, type: 'end' },
  ]
  return segments
}

export function buildImpactSummary(
  results: ScenarioResults,
  provider: ProviderRow | null,
  scenarioInputs: ScenarioInputs
): string | undefined {
  const baseSalary = num(provider?.baseSalary)
  const modeledBase =
    scenarioInputs.modeledBasePay != null && Number.isFinite(scenarioInputs.modeledBasePay)
      ? scenarioInputs.modeledBasePay
      : baseSalary
  const currentIncentiveForTCC = results.currentIncentive > 0 ? results.currentIncentive : 0
  const annualIncentiveForTCC = results.annualIncentive > 0 ? results.annualIncentive : 0
  const currentPsqDollars = results.currentPsqDollars ?? results.psqDollars ?? 0

  const deltaBase = modeledBase - baseSalary
  const deltaIncentive = annualIncentiveForTCC - currentIncentiveForTCC
  const deltaPsq = results.psqDollars - currentPsqDollars

  const drivers: string[] = []
  if (deltaBase !== 0) drivers.push('base pay')
  if (deltaIncentive !== 0) drivers.push('incentive')
  if (deltaPsq !== 0) drivers.push('PSQ')
  if (drivers.length === 0) return undefined
  const change = results.changeInTCC > 0 ? 'increase' : results.changeInTCC < 0 ? 'decrease' : null
  if (!change) return undefined
  return `${drivers.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(' and ')} ${change === 'increase' ? 'drive the increase' : 'drive the decrease'}.`
}

interface ModelingImpactSectionProps {
  results: ScenarioResults
  provider: ProviderRow | null
  scenarioInputs: ScenarioInputs
}

export function ModelingImpactSection({
  results,
  provider,
  scenarioInputs,
}: ModelingImpactSectionProps) {
  const segments = buildWaterfallSegments(results, provider, scenarioInputs)
  const summary = buildImpactSummary(results, provider, scenarioInputs)

  return (
    <section className="space-y-6">
      <h2 className="section-title">Impact at a glance</h2>
      <ImpactHeadline results={results} summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-border shadow-sm">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base font-semibold leading-snug tracking-tight">
              {results.tccPercentile === results.modeledTCCPercentile
                ? `Modeled plan keeps TCC at ${formatOrdinal(results.modeledTCCPercentile)} percentile (within 25th–75th band).`
                : `Modeled plan moves TCC from ${formatOrdinal(results.tccPercentile)} to ${formatOrdinal(results.modeledTCCPercentile)} percentile (within 25th–75th band).`}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <PercentilePositionChart
              tccPercentile={results.tccPercentile}
              modeledTCCPercentile={results.modeledTCCPercentile}
              wrvuPercentile={results.wrvuPercentile}
            />
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-border shadow-sm">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base font-semibold leading-snug tracking-tight">
              {getWaterfallChartTitle(results, summary)}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <TCCWaterfallChart
              segments={segments}
              calloutText={getWaterfallCallout(results, summary)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border shadow-sm">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-sm font-semibold leading-snug tracking-tight">
              TCC percentile improves with modeling; wRVU percentile unchanged.
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <PercentileComparisonChart
              wrvuCurrent={results.wrvuPercentile}
              wrvuModeled={results.wrvuPercentile}
              tccCurrent={results.tccPercentile}
              tccModeled={results.modeledTCCPercentile}
            />
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border shadow-sm">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-sm font-semibold leading-snug tracking-tight">
              Conversion factor {results.modeledCF >= results.currentCF ? 'rises' : 'falls'} to {formatCurrency(results.modeledCF)}/wRVU ({formatOrdinal(results.cfPercentileModeled)} percentile).
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <CFComparisonTable
              cfPercentileCurrent={results.cfPercentileCurrent}
              cfPercentileModeled={results.cfPercentileModeled}
              currentCF={results.currentCF}
              modeledCF={results.modeledCF}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
