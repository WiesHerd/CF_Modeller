import { FileSpreadsheet, Gauge, LineChart, Play, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ExclusionReason, OptimizerRunResult } from '@/types/optimizer'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'
import { EXCLUSION_REASON_LABELS } from '@/features/optimizer/components/optimizer-constants'
import { OptimizerReviewWorkspace } from '@/features/optimizer/components/optimizer-review-workspace'

export function OptimizerRunStage({
  hasData,
  result,
  isRunning,
  runError,
  runDisabled,
  runProgress,
  onRun,
  onStartOver,
  onExport,
  onOpenCFSweep,
}: {
  hasData: boolean
  result: OptimizerRunResult | null
  isRunning: boolean
  runError: string | null
  runDisabled: boolean
  runProgress: { specialtyIndex: number; totalSpecialties: number; specialtyName: string } | null
  onRun: () => void
  onStartOver: () => void
  onExport: () => void
  onOpenCFSweep?: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
            <Gauge />
          </div>
          <CardTitle className="leading-tight">Run and review</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Run optimization, then review recommendations with policy and outlier context.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {runError ? (
          <WarningBanner title="Optimizer run failed" message={runError} tone="error" />
        ) : null}

        {!result && !isRunning && !runError && hasData ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onRun} disabled={runDisabled} className="gap-2">
              <Play className="size-4" />
              Run optimizer
            </Button>
          </div>
        ) : null}

        {isRunning || result ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onRun} disabled={runDisabled} className="gap-2">
                {isRunning ? (
                  <span className="animate-pulse">
                    {runProgress
                      ? `Analyzing specialty ${runProgress.specialtyIndex + 1} of ${runProgress.totalSpecialties} (${runProgress.specialtyName || '...'})...`
                      : 'Running...'}
                  </span>
                ) : (
                  <>
                    <Play className="size-4" />
                    Run optimizer
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onStartOver} disabled={isRunning} className="gap-2">
                <RotateCcw className="size-4" />
                Start over
              </Button>
              {result ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={onOpenCFSweep} className="gap-2">
                    <LineChart className="size-4" />
                    Model at CF percentiles
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onExport} className="gap-2">
                    <FileSpreadsheet className="size-4" />
                    Export to Excel
                  </Button>
                </>
              ) : null}
            </div>

            {result ? (
              <div className="flex flex-col gap-4">
                {result.summary.specialtiesAnalyzed === 0 ? (
                  <WarningBanner
                    message="No specialties had matching market data. Check specialty names and synonym mappings on the Upload screen."
                  />
                ) : null}

                <p className="text-sm text-muted-foreground">
                  <span className="font-medium tabular-nums">{result.summary.specialtiesAnalyzed}</span> specialties
                  {' · '}
                  <span className="font-medium tabular-nums">{result.summary.providersIncluded}</span> in scope
                  {' · '}
                  <span className="font-medium tabular-nums">{result.summary.providersExcluded}</span> excluded
                  {' · '}
                  <span className="font-medium tabular-nums">
                    ${result.summary.totalSpendImpactRaw.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>{' '}
                  total impact
                </p>

                <p className="text-xs text-muted-foreground">
                  Pay vs productivity: when TCC percentile is higher than wRVU percentile, pay is generally above productivity; when wRVU percentile is higher, underpaid. The optimizer adjusts CF toward alignment.
                </p>

                <OptimizerReviewWorkspace rows={result.bySpecialty} />

                <details className="group rounded-lg border border-border/70 bg-card text-sm">
                  <summary className="cursor-pointer list-none p-3 font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                    Run details
                  </summary>
                  <div className="border-t border-border/70 p-3 pt-3">
                    <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
                      <li>Meeting alignment target: {result.summary.countMeetingAlignmentTarget}</li>
                      <li>CF above policy: {result.summary.countCFAbovePolicy}</li>
                      <li>Effective rate &gt;90: {result.summary.countEffectiveRateAbove90}</li>
                      <li>Timestamp: {new Date(result.summary.timestamp).toLocaleString()}</li>
                    </ul>
                    {result.summary.keyMessages.length > 0 ? (
                      <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Key messages ({result.summary.keyMessages.length})
                        </p>
                        <div className="mt-2 space-y-1">
                          {result.summary.keyMessages.map((message, index) => (
                            <p key={index} className="text-muted-foreground">
                              - {message}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {result.summary.topExclusionReasons.length > 0 ? (
                      <div className="mt-2">
                        <span className="text-muted-foreground">Top exclusion reasons: </span>
                        {formatTopExclusionReasons(result.summary.topExclusionReasons)}
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>
            ) : null}

          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function formatTopExclusionReasons(reasons: { reason: ExclusionReason; count: number }[]) {
  return reasons
    .map(({ reason, count }) => `${EXCLUSION_REASON_LABELS[reason] ?? reason} (${count})`)
    .join(', ')
}
