import { useMemo, useState } from 'react'
import { ArrowLeft, FileSpreadsheet, FileText, Lock, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { ImpactReportPage } from '@/components/impact-report-page'
import { matchMarketRow } from '@/lib/batch'
import { computeScenario } from '@/lib/compute'
import { exportSingleScenarioXLSX } from '@/lib/single-scenario-export'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { SynonymMap } from '@/types/batch'

export interface SingleProviderImpactReportProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  onBack: () => void
}

export function SingleProviderImpactReport({
  providerRows,
  marketRows,
  scenarioInputs,
  savedScenarios,
  batchSynonymMap,
  onBack,
}: SingleProviderImpactReportProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('current')

  const selectedProvider = useMemo(
    () =>
      selectedProviderId
        ? providerRows.find((p) => p.providerId === selectedProviderId || p.providerName === selectedProviderId) ?? null
        : providerRows[0] ?? null,
    [providerRows, selectedProviderId]
  )

  const effectiveScenarioInputs = useMemo((): ScenarioInputs => {
    if (selectedScenarioId === 'current') return scenarioInputs
    const saved = savedScenarios.find((s) => s.id === selectedScenarioId)
    return saved?.scenarioInputs ?? scenarioInputs
  }, [selectedScenarioId, scenarioInputs, savedScenarios])

  const { results, marketMatch } = useMemo(() => {
    if (!selectedProvider || marketRows.length === 0) {
      return { results: null, marketMatch: null as MarketRow | null }
    }
    const match = matchMarketRow(selectedProvider, marketRows, batchSynonymMap)
    if (!match.marketRow) return { results: null, marketMatch: null }
    const results = computeScenario(selectedProvider, match.marketRow, effectiveScenarioInputs)
    return { results, marketMatch: match.marketRow }
  }, [selectedProvider, marketRows, batchSynonymMap, effectiveScenarioInputs])

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    exportSingleScenarioXLSX({
      provider: selectedProvider,
      marketRow: marketMatch,
      results,
      scenarioInputs: effectiveScenarioInputs,
      mode: 'existing',
    })
  }

  if (providerRows.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Compensation impact report
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Import provider and market data to generate this report.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const providerLabel =
    selectedProvider?.providerName || selectedProvider?.providerId || 'Provider'

  return (
    <div className="space-y-6 report-print">
      {/* Consistent header: left = Back + (Title + Confidential); right = actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="shrink-0 gap-2 no-print" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div className="min-w-0">
            <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
              Compensation impact report
            </SectionTitleWithIcon>
            {results && selectedProvider && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Lock className="size-3.5 shrink-0" aria-hidden />
                Confidential — compensation planning
              </p>
            )}
          </div>
        </div>
        {results && (
          <div className="flex shrink-0 items-center gap-2 no-print">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-2"
              aria-label="Export single scenario Excel report"
            >
              <FileSpreadsheet className="size-4" />
              Export Excel Report
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2" aria-label="Print">
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 no-print">
          <Select
            value={selectedProvider ? String(selectedProvider.providerId ?? selectedProvider.providerName ?? '') : ''}
            onValueChange={(v) => setSelectedProviderId(v)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providerRows.map((p, i) => {
                const val = String(p.providerId ?? p.providerName ?? `row-${i}`)
                return (
                  <SelectItem key={val} value={val}>
                    {p.providerName || p.providerId || '—'}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Scenario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current scenario</SelectItem>
              {savedScenarios.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      {!marketMatch && selectedProvider && marketRows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No market data found for specialty &quot;{selectedProvider.specialty ?? '—'}&quot;. Add market data or use a synonym in Import data.
            </p>
          </CardContent>
        </Card>
      )}

      {results && selectedProvider && (
        <>
          <ImpactReportPage
            results={results}
            provider={selectedProvider}
            scenarioInputs={effectiveScenarioInputs}
            providerLabel={providerLabel}
            onBackToModeller={onBack}
          />
        </>
      )}

      {marketRows.length === 0 && providerRows.length > 0 && selectedProvider && (
        <p className="text-muted-foreground text-sm">Import market data to compute the impact report.</p>
      )}
    </div>
  )
}
