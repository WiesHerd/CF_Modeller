import { User, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'
import { formatCurrency } from '@/utils/format'
import { CompensationFTESection, FieldRow, Section } from '@/components/compensation-fte-section'

function fmtMoney(n: number, decimals = 2): string {
  return formatCurrency(n, { decimals })
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

interface ModellerTopSectionProps {
  provider: ProviderRow | null
  marketRow: MarketRow | null
  scenarioInputs: ScenarioInputs
  specialtyLabel?: string
  onUpdateProvider?: (updates: Partial<ProviderRow>) => void
  /** Called after provider Save; use to sync current scenario in Scenario planning. */
  onSaveComplete?: (updatedProvider: ProviderRow) => void
  /** When true, productivity model is read-only (e.g. existing provider from upload). */
  readOnlyProductivityModel?: boolean
  /** When present, show TCC/wRVU percentiles and imputed TCC per wRVU after selection. */
  results?: ScenarioResults | null
  /** When true, do not render the statistics card (e.g. when it is embedded in the provider & market card). */
  embedStatisticsInProviderCard?: boolean
}

/** Market data card (TCC / wRVU / CF percentiles). Rendered at bottom of page. */
export function MarketDataCard({
  marketRow,
  specialtyLabel,
}: {
  marketRow: MarketRow | null
  specialtyLabel?: string
}) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-3 text-left">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
            <BarChart3 className="size-5" />
          </span>
          <span>
            Market data
            {specialtyLabel ? ` – ${specialtyLabel}` : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
          {marketRow == null ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Select a specialty above to see market data.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                  TCC (Total Compensation Cost)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">25th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_25)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">50th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_50)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">75th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_75)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">90th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_90)}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                  wRVUs (Work Relative Value Units)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">25th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_25, 2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">50th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_50, 2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">75th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_75, 2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">90th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_90, 2)}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                  CFs (Conversion Factors)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">25th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_25)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">50th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_50)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">75th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_75)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">90th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_90)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  )
}

/** Props for the statistics content only (no card wrapper). */
export interface ProviderStatisticsContentProps {
  provider: ProviderRow
  onUpdateProvider?: (updates: Partial<ProviderRow>) => void
  /** Called after provider Save; use to sync current scenario in Scenario planning. */
  onSaveComplete?: (updatedProvider: ProviderRow) => void
  readOnlyProductivityModel?: boolean
}


export function ProviderStatisticsContent({
  provider,
  onUpdateProvider,
  onSaveComplete,
  readOnlyProductivityModel: _readOnlyProductivityModel = false,
}: ProviderStatisticsContentProps) {
  const totalFTE = provider.totalFTE ?? 0
  const clinicalFTE = provider.clinicalFTE ?? 0
  const adminFTE = provider.adminFTE ?? 0
  const researchFTE = provider.researchFTE ?? 0
  const teachingFTE = provider.teachingFTE ?? 0
  const baseSalary = provider.baseSalary ?? 0
  const nonClinicalPay = provider.nonClinicalPay ?? 0
  const qualityPayments = provider.qualityPayments ?? 0
  const otherIncentives = provider.otherIncentives ?? 0
  const otherWRVUs = provider.outsideWRVUs ?? 0
  const totalWRVUs =
    provider.totalWRVUs ??
    (provider.workRVUs ?? 0) +
      (provider.pchWRVUs ?? 0) +
      otherWRVUs
  const cFTESalary =
    provider.clinicalFTESalary != null && provider.clinicalFTESalary > 0
      ? provider.clinicalFTESalary
      : totalFTE > 0
        ? baseSalary * (clinicalFTE / totalFTE)
        : 0
  const canEdit = !!onUpdateProvider

  return (
    <div className="space-y-4">
      <CompensationFTESection
        baseSalary={baseSalary}
        nonClinicalPay={nonClinicalPay}
        qualityPayments={qualityPayments}
        otherIncentives={otherIncentives}
        cFTESalary={cFTESalary}
        totalWRVUs={totalWRVUs}
        otherWRVUs={otherWRVUs}
        totalFTE={totalFTE}
        adminFTE={adminFTE}
        clinicalFTE={clinicalFTE}
        researchFTE={researchFTE}
        teachingFTE={teachingFTE}
        canEdit={canEdit}
        basePayComponents={provider.basePayComponents}
        provider={provider}
        onUpdateProvider={onUpdateProvider}
        onSaveComplete={onSaveComplete}
      />
    </div>
  )
}

export function ModellerTopSection({
  provider,
  marketRow: _marketRow,
  scenarioInputs: _scenarioInputs,
  specialtyLabel: _specialtyLabel,
  onUpdateProvider,
  onSaveComplete,
  readOnlyProductivityModel: _readOnlyProductivityModel = false,
  results = null,
  embedStatisticsInProviderCard = false,
}: ModellerTopSectionProps) {
  const totalFTE = provider?.totalFTE ?? 0
  const clinicalFTE = provider?.clinicalFTE ?? 0
  const adminFTE = provider?.adminFTE ?? 0
  const researchFTE = provider?.researchFTE ?? 0
  const teachingFTE = provider?.teachingFTE ?? 0
  const baseSalary = provider?.baseSalary ?? 0
  const nonClinicalPay = provider?.nonClinicalPay ?? 0
  const qualityPayments = provider?.qualityPayments ?? 0
  const otherIncentives = provider?.otherIncentives ?? 0
  const otherWRVUs = provider?.outsideWRVUs ?? 0
  const totalWRVUs =
    provider?.totalWRVUs ??
    (() => {
      const w = provider?.workRVUs ?? 0
      const p = provider?.pchWRVUs ?? 0
      const o = otherWRVUs
      return w + p + o
    })()
  const cFTESalary =
    provider?.clinicalFTESalary != null && provider.clinicalFTESalary > 0
      ? provider.clinicalFTESalary
      : totalFTE > 0
        ? baseSalary * (clinicalFTE / totalFTE)
        : 0

  const canEdit = !!onUpdateProvider

  const statisticsCard = !embedStatisticsInProviderCard && (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-left">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted/80 text-accent-icon">
            <User className="size-5" />
          </span>
          <span>
            {provider != null && provider.providerName
              ? `${provider.providerName} – Statistics`
              : 'Provider statistics'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {provider == null ? (
          <EmptyState message="Select a provider above to see statistics." />
        ) : (
          <>
              <CompensationFTESection
                baseSalary={baseSalary}
                nonClinicalPay={nonClinicalPay}
                qualityPayments={qualityPayments}
                otherIncentives={otherIncentives}
                cFTESalary={cFTESalary}
                totalWRVUs={totalWRVUs}
                otherWRVUs={otherWRVUs}
                totalFTE={totalFTE}
                adminFTE={adminFTE}
                clinicalFTE={clinicalFTE}
                researchFTE={researchFTE}
                teachingFTE={teachingFTE}
                canEdit={canEdit}
                basePayComponents={provider?.basePayComponents}
                provider={provider ?? undefined}
                onUpdateProvider={onUpdateProvider}
                onSaveComplete={onSaveComplete}
              />

              {results != null && (
                <Section title="Calculated (after selection)">
                  <FieldRow label="TCC percentile">
                    <span className="tabular-nums">
                      {results.tccPercentile != null
                        ? fmtNum(results.tccPercentile, 2)
                        : '—'}
                      {results.tccPercentileBelowRange && ' (below range)'}
                      {results.tccPercentileAboveRange && ' (above range)'}
                    </span>
                  </FieldRow>
                  <FieldRow label="wRVU percentile">
                    <span className="tabular-nums">
                      {results.wrvuPercentile != null
                        ? fmtNum(results.wrvuPercentile, 2)
                        : '—'}
                      {results.wrvuPercentileBelowRange && ' (below range)'}
                      {results.wrvuPercentileAboveRange && ' (above range)'}
                    </span>
                  </FieldRow>
                  <FieldRow label="CF percentile (current / modeled)">
                    <span className="tabular-nums">
                      {results.cfPercentileCurrent != null
                        ? fmtNum(results.cfPercentileCurrent, 2)
                        : '—'}
                      {' / '}
                      {results.cfPercentileModeled != null
                        ? fmtNum(results.cfPercentileModeled, 2)
                        : '—'}
                    </span>
                  </FieldRow>
                  <FieldRow label="Imputed TCC per wRVU (current)">
                    <span className="tabular-nums text-muted-foreground">
                      {results.imputedTCCPerWRVURatioCurrent > 0
                        ? fmtMoney(results.imputedTCCPerWRVURatioCurrent)
                        : '—'}
                    </span>
                  </FieldRow>
                  <FieldRow label="Imputed TCC per wRVU (modeled)">
                    <span className="tabular-nums text-muted-foreground">
                      {results.imputedTCCPerWRVURatioModeled > 0
                        ? fmtMoney(results.imputedTCCPerWRVURatioModeled)
                        : '—'}
                    </span>
                  </FieldRow>
                </Section>
              )}
            </>
          )}
        </CardContent>
      </Card>
  )

  return (
    <div className="flex flex-col gap-6">
      {statisticsCard}
    </div>
  )
}
