import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImpactComparisonTable } from '@/components/impact-comparison-table'
import { PercentilePositionChart } from '@/components/charts/percentile-position-chart'
import { TCCWaterfallChart } from '@/components/charts/tcc-waterfall-chart'
import { PercentileComparisonChart } from '@/components/charts/percentile-comparison-chart'
import { CFComparisonTable } from '@/components/cf-comparison-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  buildWaterfallSegments,
  buildImpactSummary,
  getWaterfallCallout,
  getWaterfallChartTitle,
} from '@/components/modeling-impact-section'
import { cn } from '@/lib/utils'
import { formatCurrency, formatOrdinal } from '@/utils/format'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'

/** SullivanCotter-style opportunity/risk takeaway from results. */
function getImpactTakeaway(
  results: ScenarioResults
): { type: 'opportunity' | 'risk' | 'neutral'; message: string } | undefined {
  if (results.modeledTCCPercentile > 75) {
    return { type: 'risk', message: 'Modeled TCC above 75th percentile; FMV review may be warranted.' }
  }
  if (results.alignmentGapModeled > 0) {
    return {
      type: 'opportunity',
      message: 'Modeled plan aligns TCC with productivity (TCC %ile now above wRVU %ile).',
    }
  }
  if (results.governanceFlags?.modeledInPolicyBand) {
    return { type: 'opportunity', message: 'Modeled TCC is within the 25th–75th policy band.' }
  }
  if (results.alignmentGapModeled < 0 && results.alignmentGapModeled < -5) {
    return {
      type: 'neutral',
      message: 'TCC %ile remains below wRVU %ile; consider productivity alignment.',
    }
  }
  return undefined
}

interface ImpactReportPageProps {
  results: ScenarioResults
  provider: ProviderRow | null
  scenarioInputs: ScenarioInputs
  providerLabel?: string
  onBackToModeller?: () => void
  /** When set, rendered on the same line as provider name (e.g. Back + Export). */
  headerActions?: React.ReactNode
}

export function ImpactReportPage({
  results,
  provider,
  scenarioInputs,
  providerLabel,
  onBackToModeller,
  headerActions,
}: ImpactReportPageProps) {
  const segments = buildWaterfallSegments(results, provider, scenarioInputs)
  const summary = buildImpactSummary(results, provider, scenarioInputs)
  const takeaway = getImpactTakeaway(results)
  const [providerNameFromLabel, specialtyFromLabel] = (providerLabel ?? '').split(' · ')
  const normalizedProviderNameFromLabel = providerNameFromLabel?.trim() || undefined
  const normalizedSpecialtyFromLabel = specialtyFromLabel?.trim() || undefined
  const reportProviderName = provider?.providerName ?? provider?.providerId ?? normalizedProviderNameFromLabel
  const reportSpecialty = provider?.specialty ?? normalizedSpecialtyFromLabel

  return (
    <div className="impact-report w-full max-w-full space-y-6 pb-6">
      <header className="space-y-6">
        {/* Provider and specialty on left; optional Back/Export on right */}
        {(reportProviderName || reportSpecialty || headerActions) && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-base font-medium tracking-tight text-foreground sm:text-lg min-w-0">
              {reportProviderName ? (
                <span className="text-primary font-semibold">{reportProviderName}</span>
              ) : null}
              {reportProviderName && reportSpecialty ? (
                <span className="text-muted-foreground px-2 font-normal">·</span>
              ) : null}
              {reportSpecialty ? (
                <span className="text-muted-foreground">{reportSpecialty}</span>
              ) : null}
            </p>
            {headerActions && <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">{headerActions}</div>}
          </div>
        )}
        {/* Summary: SV dashboard style — clear card, dense labels, scannable values */}
        <div className="rounded-lg border border-border bg-card px-4 py-3.5 mt-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Current TCC</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(results.currentTCC, { decimals: 0 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Modeled TCC</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(results.modeledTCC, { decimals: 0 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">TCC %ile</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{formatOrdinal(results.tccPercentile)} → {formatOrdinal(results.modeledTCCPercentile)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Change in TCC</p>
              <p className={cn('text-sm font-semibold tabular-nums', results.changeInTCC >= 0 ? 'value-positive' : 'value-negative')}>
                {results.changeInTCC >= 0 ? '+' : ''}{formatCurrency(results.changeInTCC, { decimals: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">CF ($/wRVU)</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(results.currentCF, { decimals: 2 })} → {formatCurrency(results.modeledCF, { decimals: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Modeled incentive</p>
              <p className={cn('text-sm font-semibold tabular-nums', results.annualIncentive >= 0 ? 'text-foreground' : 'value-negative')}>
                {formatCurrency(results.annualIncentive, { decimals: 0 })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {takeaway && (
        takeaway.type === 'risk' ? (
          <p className="text-[0.9rem] font-medium value-negative">
            ⚠ Risk: {takeaway.message}
          </p>
        ) : (
          <div
            className={cn(
              'rounded-lg border px-3 py-2.5 text-sm',
              takeaway.type === 'opportunity' &&
                'border-emerald-500/40 bg-emerald-500/10 dark:border-emerald-400/30 dark:bg-emerald-500/15',
              takeaway.type === 'neutral' &&
                'border-border/60 bg-muted/30'
            )}
          >
            <span className="font-medium">
              {takeaway.type === 'opportunity' ? 'Opportunity: ' : 'Note: '}
            </span>
            <span className="text-muted-foreground">{takeaway.message}</span>
          </div>
        )
      )}

      {/* Position + waterfall side-by-side on md+ for a compact “results” block */}
      <section
        className="grid gap-4 sm:grid-cols-2"
        style={{ gridTemplateRows: '1fr 1fr', minHeight: '620px' }}
      >
        <div className="flex min-h-0 flex-col gap-2">
          <h2 className="text-foreground shrink-0 text-sm font-semibold leading-snug tracking-tight">
            {results.tccPercentile === results.modeledTCCPercentile
              ? `Modeled plan keeps TCC at ${formatOrdinal(results.modeledTCCPercentile)} percentile (within 25th–75th band).`
              : `Modeled plan moves TCC from ${formatOrdinal(results.tccPercentile)} to ${formatOrdinal(results.modeledTCCPercentile)} percentile (within 25th–75th band).`}
          </h2>
          <div className="flex min-h-[280px] flex-1 flex-col rounded-xl border border-border/80 bg-card px-3 py-4 shadow-sm">
            <div className="h-full min-h-[260px] w-full">
              <PercentilePositionChart
                tccPercentile={results.tccPercentile}
                modeledTCCPercentile={results.modeledTCCPercentile}
                wrvuPercentile={results.wrvuPercentile}
                height={260}
              />
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <h2 className="text-foreground shrink-0 text-sm font-semibold leading-snug tracking-tight">
            {getWaterfallChartTitle(results, summary)}
          </h2>
          <div className="flex min-h-[280px] flex-1 flex-col rounded-xl border border-border/80 bg-card px-3 py-4 shadow-sm">
            <div className="h-full min-h-[260px] w-full">
              <TCCWaterfallChart
                segments={segments}
                height={260}
                calloutText={getWaterfallCallout(results, summary)}
              />
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <h2 className="text-foreground shrink-0 text-sm font-semibold leading-snug tracking-tight">
            TCC percentile improves with modeling; wRVU percentile unchanged.
          </h2>
          <div className="flex min-h-[280px] flex-1 flex-col rounded-xl border border-border/80 bg-card px-3 py-4 shadow-sm">
            <div className="h-full min-h-[260px] w-full">
              <PercentileComparisonChart
                wrvuCurrent={results.wrvuPercentile}
                wrvuModeled={results.wrvuPercentile}
                tccCurrent={results.tccPercentile}
                tccModeled={results.modeledTCCPercentile}
                height={260}
              />
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <h2 className="text-foreground shrink-0 text-sm font-semibold leading-snug tracking-tight">
            Conversion factor {results.modeledCF >= results.currentCF ? 'rises' : 'falls'} to {formatCurrency(results.modeledCF)}/wRVU ({formatOrdinal(results.cfPercentileModeled)} percentile).
          </h2>
          <div className="flex min-h-[280px] flex-1 flex-col rounded-xl border border-border/80 bg-card px-3 py-4 shadow-sm">
            <div className="flex h-full min-h-[260px] items-center">
              <CFComparisonTable
                cfPercentileCurrent={results.cfPercentileCurrent}
                cfPercentileModeled={results.cfPercentileModeled}
                currentCF={results.currentCF}
                modeledCF={results.modeledCF}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-0 pt-6">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Benchmark comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <ImpactComparisonTable results={results} />
        </CardContent>
      </Card>

      {onBackToModeller && (
        <footer className="border-border/60 border-t pt-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={onBackToModeller}
          >
            <ArrowLeft className="size-4" />
            Back to Modeller
          </Button>
        </footer>
      )}
    </div>
  )
}
