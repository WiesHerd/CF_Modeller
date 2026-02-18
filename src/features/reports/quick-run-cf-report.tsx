import { useCallback, useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, FileSpreadsheet, Gauge, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'
import { OptimizerReviewWorkspace } from '@/features/optimizer/components/optimizer-review-workspace'
import { getDefaultOptimizerSettings } from '@/types/optimizer'
import type { OptimizerRunResult, OptimizerSettings } from '@/types/optimizer'
import type { OptimizerWorkerOutMessage, OptimizerWorkerRunPayload } from '@/workers/optimizer-worker'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs } from '@/types/scenario'
import type { SynonymMap } from '@/types/batch'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'

function getTotalIncentiveDollars(result: OptimizerRunResult): number {
  if (result.summary.totalIncentiveDollars != null) return result.summary.totalIncentiveDollars
  let sum = 0
  for (const row of result.bySpecialty) {
    for (const ctx of row.providerContexts) {
      if (ctx.included && ctx.modeledIncentiveDollars != null) sum += ctx.modeledIncentiveDollars
    }
  }
  return sum
}

function exportOptimizerResultsToExcel(result: OptimizerRunResult): void {
  const specialtyRows = result.bySpecialty.map((row) => ({
    Specialty: row.specialty,
    Included: row.includedCount,
    Excluded: row.excludedCount,
    CurrentCF: row.currentCF.toFixed(4),
    RecommendedCF: row.recommendedCF.toFixed(4),
    CFChangePct: row.cfChangePct.toFixed(2),
    MeanBaselineGap: row.meanBaselineGap.toFixed(2),
    MeanModeledGap: row.meanModeledGap.toFixed(2),
    MAEBefore: row.maeBefore.toFixed(2),
    MAEAfter: row.maeAfter.toFixed(2),
    SpendImpact: row.spendImpactRaw.toFixed(2),
    HighRiskCount: row.highRiskCount,
    MediumRiskCount: row.mediumRiskCount,
    PolicyCheck: row.policyCheck,
    Flags: row.flags.join('; '),
  }))
  const exclusionRows = result.audit.excludedProviders.map((provider) => ({
    ProviderID: provider.providerId,
    ProviderName: provider.providerName,
    Specialty: provider.specialty,
    Reasons: provider.reasons.join('; '),
  }))
  const specialtySheet = XLSX.utils.json_to_sheet(specialtyRows.length > 0 ? specialtyRows : [{}])
  const exclusionSheet = XLSX.utils.json_to_sheet(exclusionRows.length > 0 ? exclusionRows : [{}])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, specialtySheet, 'Specialty results')
  XLSX.utils.book_append_sheet(workbook, exclusionSheet, 'Exclusions')
  XLSX.writeFile(workbook, `optimizer-results-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export interface QuickRunCFReportProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  batchSynonymMap: SynonymMap
  onBack: () => void
}

export function QuickRunCFReport({
  providerRows,
  marketRows,
  scenarioInputs,
  batchSynonymMap,
  onBack,
}: QuickRunCFReportProps) {
  const [result, setResult] = useState<OptimizerRunResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState<{
    specialtyIndex: number
    totalSpecialties: number
    specialtyName: string
  } | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const hasData = providerRows.length > 0 && marketRows.length > 0
  const productivityProviders = providerRows.filter(
    (p) => (p.productivityModel ?? '').toLowerCase() === 'productivity'
  )
  const hasProductivityProviders = productivityProviders.length > 0

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const handleRun = useCallback(() => {
    if (!hasData || !hasProductivityProviders || workerRef.current) return
    setIsRunning(true)
    setResult(null)
    setRunError(null)
    setRunProgress(null)
    const worker = new Worker(new URL('../../workers/optimizer-worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<OptimizerWorkerOutMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        setRunProgress({
          specialtyIndex: message.specialtyIndex,
          totalSpecialties: message.totalSpecialties,
          specialtyName: message.specialtyName,
        })
        return
      }

      workerRef.current = null
      worker.terminate()
      setIsRunning(false)
      setRunProgress(null)
      if (message.type === 'done') {
        setResult(message.result)
      } else {
        setRunError(message.message)
      }
    }

    worker.onerror = () => {
      workerRef.current = null
      worker.terminate()
      setIsRunning(false)
      setRunProgress(null)
      setRunError('Optimizer worker failed.')
    }

    const baseScenarioInputs = scenarioInputs ?? DEFAULT_SCENARIO_INPUTS
    const settings: OptimizerSettings = getDefaultOptimizerSettings(baseScenarioInputs)
    const synonymMap = batchSynonymMap ?? {}
    const payload: OptimizerWorkerRunPayload = {
      type: 'run',
      providerRows: productivityProviders,
      marketRows,
      settings,
      scenarioId: crypto.randomUUID(),
      scenarioName: 'Quick run',
      synonymMap,
    }
    worker.postMessage(payload)
  }, [hasData, hasProductivityProviders, productivityProviders, marketRows, scenarioInputs, batchSynonymMap])

  const handleExport = useCallback(() => {
    if (result) exportOptimizerResultsToExcel(result)
  }, [result])

  if (!hasData) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<Gauge className="size-5 text-muted-foreground" />}>
          Recommended CF
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
              Import provider and market data on the Upload screen to run this report.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasProductivityProviders) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<Gauge className="size-5 text-muted-foreground" />}>
          Recommended CF
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <WarningBanner
          message="No productivity providers found in your data. This report analyzes conversion factors for providers on a productivity model. Use CF Optimizer in Batch to include other models or customize the run."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitleWithIcon icon={<Gauge className="size-5 text-muted-foreground" />}>
        Recommended CF
      </SectionTitleWithIcon>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {runError ? (
            <WarningBanner title="Optimizer run failed" message={runError} tone="error" />
          ) : null}

          {!result && !isRunning && !runError ? (
            <>
              <p className="text-sm text-muted-foreground">
                We&apos;ll analyze your data with default settings and recommend conversion factors by specialty.
                No configuration needed.
              </p>
              <Button onClick={handleRun} className="gap-2">
                <Play className="size-4" />
                Run
              </Button>
            </>
          ) : null}

          {(isRunning || result) ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="gap-2"
                >
                  {isRunning ? (
                    <span className="animate-pulse">
                      {runProgress
                        ? `Analyzing specialty ${runProgress.specialtyIndex + 1} of ${runProgress.totalSpecialties} (${runProgress.specialtyName || '...'})...`
                        : 'Running...'}
                    </span>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Run again
                    </>
                  )}
                </Button>
                {result ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleExport} className="gap-2">
                    <FileSpreadsheet className="size-4" />
                    Export to Excel
                  </Button>
                ) : null}
              </div>

              {result ? (
                <div className="flex flex-col gap-4">
                  {result.summary.specialtiesAnalyzed === 0 ? (
                    <WarningBanner
                      message="No specialties had matching market data. Check specialty names and synonym mappings on the Upload screen."
                    />
                  ) : null}

                  <TooltipProvider delayDuration={300}>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium tabular-nums">{result.summary.specialtiesAnalyzed}</span> specialties
                      {' · '}
                      <span className="font-medium tabular-nums">{result.summary.providersIncluded}</span> in scope
                      {' · '}
                      <span className="font-medium tabular-nums">{result.summary.providersExcluded}</span> excluded
                    </p>

                    <p className="text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help font-medium tabular-nums text-primary underline decoration-dotted decoration-primary/50 underline-offset-2">
                            ${result.summary.totalSpendImpactRaw.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs">
                          Change in total TCC (Total Cash Compensation) when moving from current/baseline to the recommended CF. Positive = total pay goes up under the recommendation; negative = total pay goes down.
                        </TooltipContent>
                      </Tooltip>
                      {' '}
                      total impact
                      {' · '}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted decoration-primary/50 underline-offset-2">
                            <span>Total incentive (CF) spend: </span>
                            <span className="font-medium tabular-nums text-primary">
                              ${getTotalIncentiveDollars(result).toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs">
                          Total work RVU incentive dollars at the recommended CF across all included providers.
                        </TooltipContent>
                      </Tooltip>
                    </p>
                  </TooltipProvider>

                  <OptimizerReviewWorkspace
                    rows={result.bySpecialty}
                    settings={getDefaultOptimizerSettings(scenarioInputs ?? DEFAULT_SCENARIO_INPUTS)}
                    marketRows={marketRows}
                    synonymMap={batchSynonymMap ?? {}}
                  />

                  <p className="text-xs text-muted-foreground">
                    Want to customize target population or objectives? Use <strong>CF Optimizer</strong> in Batch.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
