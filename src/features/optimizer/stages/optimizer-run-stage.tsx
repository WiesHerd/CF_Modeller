import { useState } from 'react'
import { FileSpreadsheet, Gauge, Info, LineChart, Play, RotateCcw } from 'lucide-react'
import { formatDateTime } from '@/utils/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ExclusionReason, OptimizerRunResult } from '@/types/optimizer'

/** Total work RVU incentive $ at recommended CF; uses summary when present, else computes from result (backward compat). */
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
import { WarningBanner } from '@/features/optimizer/components/warning-banner'
import { EXCLUSION_REASON_LABELS } from '@/features/optimizer/components/optimizer-constants'
import { formatObjective } from '@/features/optimizer/components/optimizer-target-explanation'
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
  settings,
  marketRows = [],
  synonymMap = {},
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
  settings?: import('@/types/optimizer').OptimizerSettings | null
  marketRows?: import('@/types/market').MarketRow[]
  synonymMap?: Record<string, string>
}) {
  const [exclusionDrilldownReason, setExclusionDrilldownReason] = useState<ExclusionReason | null>(null)

  return (
    <TooltipProvider delayDuration={300}>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
            <Gauge />
          </div>
          <div className="flex items-center gap-2">
            <CardTitle className="leading-tight">Run and review</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="About Run and review"
                >
                  <Info className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                Run optimization, then review recommendations with policy and outlier context.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
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
                      Total work RVU incentive dollars at the recommended CF across all included providers. This is the amount of productivity (CF) incentive pay at the new conversion factor, not a change from baseline.
                    </TooltipContent>
                  </Tooltip>
                </p>

                {settings?.budgetConstraint?.kind === 'cap_dollars' &&
                settings.budgetConstraint.capDollars != null ? (
                  <BudgetVsActual
                    totalIncentive={getTotalIncentiveDollars(result)}
                    capDollars={settings.budgetConstraint.capDollars}
                  />
                ) : null}

                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Objective: </span>
                  {settings?.optimizationObjective
                    ? formatObjective(settings.optimizationObjective)
                    : 'Align pay (TCC) percentile to productivity (wRVU) percentile.'}
                  {' '}
                  Open any specialty row for methodology and market CF chart.
                </p>

                <OptimizerReviewWorkspace
                  rows={result.bySpecialty}
                  settings={settings}
                  marketRows={marketRows}
                  synonymMap={synonymMap}
                />

                <details className="group rounded-lg border border-border/70 bg-card text-sm">
                  <summary className="cursor-pointer list-none p-3 font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                    Run details
                  </summary>
                  <div className="border-t border-border/70 p-3 pt-3">
                    <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
                      <li>Meeting alignment target: {result.summary.countMeetingAlignmentTarget}</li>
                      <li>CF above policy: {result.summary.countCFAbovePolicy}</li>
                      <li>Effective rate &gt;90: {result.summary.countEffectiveRateAbove90}</li>
                      <li>Timestamp: {formatDateTime(result.summary.timestamp)}</li>
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
                        <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          {result.summary.topExclusionReasons.map(({ reason, count }, i) => (
                            <span key={reason}>
                              {i > 0 ? ', ' : null}
                              <button
                                type="button"
                                onClick={() => setExclusionDrilldownReason(reason)}
                                className="cursor-pointer text-primary underline hover:text-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
                              >
                                {EXCLUSION_REASON_LABELS[reason] ?? reason} ({count})
                              </button>
                            </span>
                          ))}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">Click a reason to see who was excluded.</p>
                      </div>
                    ) : null}
                  </div>
                </details>

                {result.audit?.excludedProviders ? (
                  <Dialog open={exclusionDrilldownReason != null} onOpenChange={(open) => !open && setExclusionDrilldownReason(null)}>
                    <DialogContent className="max-h-[80vh] flex max-w-lg flex-col overflow-hidden">
                      <DialogHeader>
                        <DialogTitle>
                          {exclusionDrilldownReason != null
                            ? `Excluded for: ${EXCLUSION_REASON_LABELS[exclusionDrilldownReason] ?? exclusionDrilldownReason}`
                            : 'Excluded providers'}
                        </DialogTitle>
                      </DialogHeader>
                      {exclusionDrilldownReason != null ? (
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2">
                          <ul className="space-y-1 text-sm">
                            {result.audit.excludedProviders
                              .filter((p) => p.reasons.includes(exclusionDrilldownReason))
                              .map((p) => (
                                <li key={p.providerId} className="flex flex-wrap items-baseline gap-2 border-b border-border/40 py-1 last:border-0">
                                  <span className="font-medium">{p.providerName || p.providerId}</span>
                                  <span className="text-xs text-muted-foreground">{p.specialty}</span>
                                  {p.reasons.length > 1 ? (
                                    <span className="text-xs text-muted-foreground">
                                      (also: {p.reasons.filter((r) => r !== exclusionDrilldownReason).map((r) => EXCLUSION_REASON_LABELS[r] ?? r).join(', ')})
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            ) : null}

          </>
        ) : null}
      </CardContent>
    </Card>
    </TooltipProvider>
  )
}

function BudgetVsActual({ totalIncentive, capDollars }: { totalIncentive: number; capDollars: number }) {
  const over = totalIncentive - capDollars
  const isOver = over > 0
  const isUnder = over < 0
  const formattedCap = capDollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const formattedDelta = Math.abs(over).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Budget (cap): </span>
      <span className="font-medium tabular-nums">${formattedCap}</span>
      {' · '}
      {isOver ? (
        <span className="font-medium value-warning">
          Over by ${formattedDelta}
        </span>
      ) : isUnder ? (
        <span className="font-medium value-positive">
          Under by ${formattedDelta}
        </span>
      ) : (
        <span className="font-medium value-positive">Within budget</span>
      )}
    </div>
  )
}
