import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart2, Building2, ChevronDown, ChevronRight, ChevronUp, DollarSign, FileText, GitCompare, HelpCircle, Settings, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Command, CommandInput } from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  SavedOptimizerConfig,
  OptimizationObjective,
  OptimizerComparisonSpecialtyRowN,
  OptimizerAssumptionsPerScenario,
  ScenarioInfo,
} from '@/types/optimizer'
import { MAX_COMPARE_SCENARIOS } from '@/types/optimizer'
import { formatBudgetConstraint } from '@/lib/optimizer-format'
import { iconBoxClass } from '@/components/section-title-with-icon'
import { canCompareOptimizerConfig, compareOptimizerScenariosN } from '@/lib/optimizer-compare'
import { formatPercentile } from '@/features/optimizer/components/optimizer-constants'
import { formatCurrency as _formatCurrency } from '@/utils/format'

function formatCurrency(value: number, decimals = 0): string {
  return _formatCurrency(value, { decimals })
}

/** At-a-glance card: percentile as plain language (e.g. "Below 25th (3.3rd)"). */
function formatPercentileForCard(p: number): string {
  if (p < 25) return `Below 25th (${p.toFixed(1)}th)`
  if (p > 90) return `Above 90th (${p.toFixed(1)}th)`
  return `${p.toFixed(1)}th`
}

/** Roll-up metric key for help dialog. */
type RollupMetricHelpKey =
  | 'spend'
  | 'incentive'
  | 'meanTCC'
  | 'meanTCCModeled'
  | 'meanWRVU'
  | 'alignment'
  | 'cfAbovePolicy'
  | 'effectiveRate90'

const ROLLUP_METRIC_HELP: Record<
  RollupMetricHelpKey,
  { label: string; body: string }
> = {
  spend: {
    label: 'Total spend impact',
    body: "Total compensation spend in this scenario compared to your current baseline. Use this to see how much more or less you'd pay under A vs B.",
  },
  incentive: {
    label: 'Work RVU incentive (modeled)',
    body: 'Total incentive dollars tied to productivity (work RVUs) in this scenario. Part of total comp.',
  },
  meanTCC: {
    label: 'Mean TCC percentile',
    body: 'Average pay percentile vs market across specialties (TCC = total cash compensation) at baseline (before recommended CF). Higher = paid more relative to peers. 50th = at market.',
  },
  meanTCCModeled: {
    label: 'Mean TCC percentile (modeled)',
    body: 'Average pay percentile vs market after applying each scenario’s recommended conversion factor. This differs between scenarios and is the main pay-positioning outcome of the CF optimizer.',
  },
  meanWRVU: {
    label: 'Mean wRVU percentile',
    body: 'Average productivity percentile vs market (wRVU = work RVUs). In the CF optimizer this is the same for both scenarios — productivity is input data; only conversion factor and total cash comp change.',
  },
  alignment: {
    label: 'Meeting alignment target',
    body: 'How many specialties have pay and productivity aligned (optimizer found a good fit). The number is a count: e.g. 1 = one specialty, 0 = none. More is better.',
  },
  cfAbovePolicy: {
    label: 'CF above policy',
    body: 'How many specialties have a recommended conversion factor (CF) above your policy cap. The number is a count: e.g. 1 = one specialty needs review, 0 = none. Review these for governance.',
  },
  effectiveRate90: {
    label: 'Effective rate >90',
    body: "Effective rate = pay per unit of productivity (like $ per wRVU). >90 means above the 90th percentile vs market — can be an FMV (fair market value) concern. The number is how many specialties have at least one provider in that situation: e.g. 1 = one specialty, 0 = none. Fewer is better.",
  },
}

function formatObjective(obj: OptimizationObjective): string {
  switch (obj.kind) {
    case 'align_percentile':
      return 'Align TCC to wRVU percentile'
    case 'target_fixed_percentile':
      return `Target fixed ${obj.targetPercentile}th percentile`
    case 'hybrid':
      return `Hybrid (align ${(obj.alignWeight * 100).toFixed(0)}% / target ${(obj.targetWeight * 100).toFixed(0)}% @ ${obj.targetPercentile}th)`
    default:
      return String((obj as { kind: string }).kind)
  }
}
import { RollupDrillDownSheet, type CompareScenariosContentProps } from '@/features/optimizer/components/rollup-drill-down-sheet'

export function CompareScenariosContent({
  savedOptimizerConfigs,
  initialScenarioAId = '',
  initialScenarioBId = '',
  onComparisonChange,
}: CompareScenariosContentProps) {
  const comparableConfigs = useMemo(
    () => savedOptimizerConfigs.filter((c: SavedOptimizerConfig) => canCompareOptimizerConfig(c)),
    [savedOptimizerConfigs]
  )

  const initialIds = useMemo(() => {
    const a = initialScenarioAId && comparableConfigs.some((c: SavedOptimizerConfig) => c.id === initialScenarioAId) ? initialScenarioAId : ''
    const b = initialScenarioBId && comparableConfigs.some((c: SavedOptimizerConfig) => c.id === initialScenarioBId) ? initialScenarioBId : ''
    if (a && b && a !== b) return [a, b]
    return []
  }, [initialScenarioAId, initialScenarioBId, comparableConfigs])

  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>(() => initialIds)

  useEffect(() => {
    if (initialIds.length >= 2 && selectedScenarioIds.length === 0) {
      setSelectedScenarioIds(initialIds)
    }
  }, [initialIds])

  const toggleScenarioSelection = useCallback((id: string) => {
    setSelectedScenarioIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id)
        return next.length >= 2 ? next : prev
      }
      const next = [...prev, id]
      return next.length <= MAX_COMPARE_SCENARIOS ? next : prev
    })
  }, [])

  const selectedConfigs = useMemo(
    () => selectedScenarioIds
      .map((id: string) => comparableConfigs.find((c: SavedOptimizerConfig) => c.id === id))
      .filter((c): c is SavedOptimizerConfig => c != null),
    [comparableConfigs, selectedScenarioIds]
  )

  const comparison = useMemo(() => {
    if (selectedConfigs.length < 2) return null
    return compareOptimizerScenariosN(selectedConfigs)
  }, [selectedConfigs])

  const [scenarioSearch, setScenarioSearch] = useState('')
  const filteredComparableConfigs = useMemo(() => {
    const q = scenarioSearch.trim().toLowerCase()
    if (!q) return comparableConfigs
    return comparableConfigs.filter((c: SavedOptimizerConfig) => c.name.toLowerCase().includes(q))
  }, [comparableConfigs, scenarioSearch])

  type DrillDownMetric = 'spend' | 'incentive' | 'alignment' | 'percentile'
  const [drillDownMetric, setDrillDownMetric] = useState<DrillDownMetric | null>(null)
  const [expandedSpecialty, setExpandedSpecialty] = useState<string | null>(null)
  const [showMetricsHelpExpand, setShowMetricsHelpExpand] = useState(false)
  const [metricHelpDialogKey, setMetricHelpDialogKey] = useState<RollupMetricHelpKey | null>(null)

  const canCompare = comparableConfigs.length >= 2
  const hasSelection = selectedScenarioIds.length >= 2
  const totalSaved = savedOptimizerConfigs.length
  const withRunResults = comparableConfigs.length

  useEffect(() => {
    onComparisonChange?.(comparison && hasSelection
      ? {
          comparison,
          scenarioNames: comparison.scenarios.map((s: ScenarioInfo) => s.name),
        }
      : null)
  }, [comparison, hasSelection, onComparisonChange])

  const emptyStateMessage =
    totalSaved === 0
      ? 'No saved scenarios. Run CF Optimizer, then Save scenario to compare.'
      : totalSaved >= 2 && withRunResults < 2
        ? `Save scenarios after running. ${withRunResults} of ${totalSaved} ready to compare.`
        : 'Run optimizer, save 2+ scenarios, then compare here.'

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {!canCompare ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
          <span className={cn(iconBoxClass, 'size-12 [&_svg]:size-8')} aria-hidden>
            <GitCompare />
          </span>
          <p className="text-sm text-muted-foreground">
            {emptyStateMessage}
          </p>
        </div>
      ) : (
        <>
          {/* Scenario selection — same dropdown multi-select as Target Optimizer */}
          <section className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
                <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                  <GitCompare />
                </span>
                Scenarios
                <span className="text-xs font-normal normal-case text-muted-foreground">
                  2–{MAX_COMPARE_SCENARIOS} to compare
                </span>
              </h3>
              <DropdownMenu onOpenChange={(open) => !open && setScenarioSearch('')}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[200px] justify-between gap-2">
                    {selectedConfigs.length === 0
                      ? 'Select scenarios…'
                      : selectedConfigs.length === 1
                        ? selectedConfigs[0].name
                        : `${selectedConfigs.length} selected`}
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[320px] overflow-hidden p-0 w-[min(100vw-2rem,320px)]">
                  <Command shouldFilter={false} className="rounded-none border-0">
                    <CommandInput
                      placeholder="Search…"
                      value={scenarioSearch}
                      onValueChange={setScenarioSearch}
                      className="h-9"
                    />
                  </Command>
                  <div className="max-h-[240px] overflow-y-auto p-1">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {scenarioSearch.trim() ? `${filteredComparableConfigs.length} of ${comparableConfigs.length}` : 'Scenarios'}
                    </DropdownMenuLabel>
                    {filteredComparableConfigs.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-muted-foreground">No matches</p>
                    ) : (
                      filteredComparableConfigs.map((c: SavedOptimizerConfig) => (
                        <DropdownMenuCheckboxItem
                          key={c.id}
                          checked={selectedScenarioIds.includes(c.id)}
                          onCheckedChange={() => toggleScenarioSelection(c.id)}
                        >
                          {c.name}
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>

          {!hasSelection ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
              <span className={cn(iconBoxClass, 'size-10 [&_svg]:size-6')} aria-hidden>
                <GitCompare />
              </span>
              <p className="text-sm text-muted-foreground">
                Pick 2+ scenarios above.
              </p>
            </div>
          ) : comparison ? (() => {
              const ids = comparison.scenarios.map((s: ScenarioInfo) => s.id)
              const n = ids.length
              const isTwo = n === 2
              const id0 = ids[0]
              const id1 = ids[1]
              const spend0 = comparison.rollup.totalSpendImpactByScenario[id0] ?? 0
              const spend1 = comparison.rollup.totalSpendImpactByScenario[id1] ?? 0
              const deltaSpend = isTwo ? spend1 - spend0 : 0
              const deltaSpendPct = isTwo && spend0 !== 0 ? (deltaSpend / Math.abs(spend0)) * 100 : null
              const inc0 = comparison.rollup.totalIncentiveByScenario[id0] ?? 0
              const inc1 = comparison.rollup.totalIncentiveByScenario[id1] ?? 0
              const deltaIncentive = isTwo ? inc1 - inc0 : 0
              const scenarioLabels = isTwo ? ['A', 'B'] : comparison.scenarios.map((_, i) => String(i + 1))
              return (
            <>
              {/* Legend: which scenario is A vs B (order = selection order in dropdown) */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                <span className="font-medium text-muted-foreground uppercase tracking-wider">In this view:</span>
                {comparison.scenarios.map((s: ScenarioInfo, i: number) => (
                  <span key={s.id} className="text-foreground shrink-0" title={s.name}>
                    <strong className="tabular-nums text-foreground">{scenarioLabels[i]}</strong>
                    <span className="text-muted-foreground"> = </span>
                    <span className="break-words">{s.name}</span>
                  </span>
                ))}
              </div>

              {/* Rollup cards — same structure as Target Optimizer */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('spend')}
                  className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm text-left hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer group"
                  aria-label="View spend change breakdown by specialty and provider"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground', 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <DollarSign />
                    </span>
                    {isTwo ? 'Spend (B vs A)' : 'Spend impact'}
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Total comp spend Δ
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 text-sm font-semibold tabular-nums',
                      deltaSpend > 0 && 'value-negative',
                      deltaSpend < 0 && 'value-positive',
                      deltaSpend === 0 && 'text-foreground'
                    )}
                  >
                    {isTwo && deltaSpend !== 0 ? formatCurrency(deltaSpend) : isTwo ? 'No change' : `${n} scenarios`}
                  </p>
                  {isTwo && deltaSpendPct != null && deltaSpend !== 0 && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums" title={comparison.scenarios[0].name}>
                      {deltaSpendPct > 0 ? '+' : ''}{deltaSpendPct.toFixed(1)}% vs {scenarioLabels[0]}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">Breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">By specialty →</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('alignment')}
                  className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm text-left hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer group"
                  aria-label="View specialties aligned breakdown"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground', 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <Target />
                    </span>
                    Aligned
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Pay & productivity aligned
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground space-y-0.5">
                    {comparison.scenarios.map((s: ScenarioInfo, i: number) => (
                      <span key={s.id} className="block" title={s.name}>
                        {scenarioLabels[i]}: {comparison.rollup.countMeetingAlignmentTargetByScenario[s.id] ?? 0}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">Breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">By specialty →</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('alignment')}
                  className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm text-left hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer group"
                  aria-label="View mean TCC percentile (modeled) breakdown by specialty"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground', 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <BarChart2 />
                    </span>
                    TCC % (modeled)
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Pay position after CF (by scenario)
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground space-y-0.5">
                    {comparison.scenarios.map((s: ScenarioInfo, i: number) => (
                      <span key={s.id} className="block" title={s.name}>
                        {scenarioLabels[i]}: {formatPercentileForCard(comparison.rollup.meanModeledTCCPercentileByScenario[s.id] ?? 0)}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">Breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">By specialty →</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('incentive')}
                  className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm text-left hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer group"
                  aria-label="View incentive change breakdown by specialty and provider"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground', 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <DollarSign />
                    </span>
                    {isTwo ? 'Incentive (B vs A)' : 'Incentive'}
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    wRVU incentive Δ
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 text-sm font-semibold tabular-nums',
                      deltaIncentive > 0 && 'value-negative',
                      deltaIncentive < 0 && 'value-positive',
                      deltaIncentive === 0 && 'text-foreground'
                    )}
                  >
                    {isTwo && deltaIncentive !== 0 ? formatCurrency(deltaIncentive) : isTwo ? 'No change' : `${n} scenarios`}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">Breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">By specialty & provider →</span>
                  </p>
                </button>
              </div>

              {/* Summary — section card with left border accent; bullets when array */}
              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                  <span className={cn(iconBoxClass, 'size-8 [&_svg]:size-4')} aria-hidden>
                    <FileText />
                  </span>
                  Summary
                </h3>
                <div className="border-l-4 border-primary/60 pl-3">
                  <ul className="space-y-2 text-sm leading-relaxed text-foreground/90">
                    {comparison.narrativeSummary.map((bullet: string, idx: number) => (
                      <li
                        key={idx}
                        className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:size-1 before:rounded-full before:bg-primary/60"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Roll-up metrics — click a row to see breakdown by specialty and provider */}
              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                  <span className={cn(iconBoxClass, 'size-8 [&_svg]:size-4')} aria-hidden>
                    <BarChart2 />
                  </span>
                  Roll-up metrics
                </h3>
                <div className="mb-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto gap-1.5 px-0 text-xs font-medium text-primary hover:text-primary/90 hover:underline"
                    onClick={() => setShowMetricsHelpExpand((v) => !v)}
                    aria-expanded={showMetricsHelpExpand}
                  >
                    {showMetricsHelpExpand ? (
                      <>
                        <ChevronUp className="size-3.5" aria-hidden />
                        Hide what these metrics mean
                      </>
                    ) : (
                      <>
                        <HelpCircle className="size-3.5" aria-hidden />
                        What do these metrics mean?
                      </>
                    )}
                  </Button>
                  {showMetricsHelpExpand && (
                    <div className="mt-2 rounded-lg border border-border/60 bg-muted/5 px-3 py-2.5 text-xs text-muted-foreground space-y-2">
                      <p>Click a row to see each scenario&apos;s details by specialty and provider.</p>
                      <p>These metrics summarize budget impact (spend, incentive), how pay and productivity line up with market (TCC and wRVU percentiles), and governance (how many specialties meet alignment, exceed CF policy, or have FMV risk). Use them to compare scenarios at a glance.</p>
                      <p>For the last three rows (Meeting alignment target, CF above policy, Effective rate &gt;90), the numbers show how many specialties — e.g. 1 = one specialty, 0 = none.</p>
                      <ul className="list-none space-y-2 pt-1 border-t border-border/60 mt-2">
                        {(Object.keys(ROLLUP_METRIC_HELP) as RollupMetricHelpKey[]).map((key) => (
                          <li key={key}>
                            <span className="font-medium text-foreground">{ROLLUP_METRIC_HELP[key].label}</span>
                            {' — '}
                            {ROLLUP_METRIC_HELP[key].body}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <Dialog open={metricHelpDialogKey != null} onOpenChange={(open) => !open && setMetricHelpDialogKey(null)}>
                  <DialogContent className="sm:max-w-md">
                    {metricHelpDialogKey != null && (
                      <>
                        <DialogHeader>
                          <DialogTitle>{ROLLUP_METRIC_HELP[metricHelpDialogKey].label}</DialogTitle>
                          <DialogDescription asChild>
                            <p className="text-sm leading-relaxed">{ROLLUP_METRIC_HELP[metricHelpDialogKey].body}</p>
                          </DialogDescription>
                        </DialogHeader>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                      <TableRow>
                        <TableHead className="w-[200px] px-3 py-2.5 font-medium">Metric</TableHead>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableHead key={s.id} className="min-w-[110px] text-right px-3 py-2.5 font-medium" title={s.name}>
                            <span className="font-normal text-muted-foreground truncate max-w-[85px] inline-block align-bottom" title={s.name}>{s.name}</span>
                          </TableHead>
                        ))}
                        {isTwo && (
                          <TableHead className="min-w-[100px] border-l border-border/60 text-right px-3 py-2.5 font-medium">Δ</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('spend')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('spend') } }}
                        aria-label="View spend impact breakdown by specialty and provider"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.spend.body}>Total spend impact</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain Total spend impact" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('spend') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {formatCurrency(comparison.rollup.totalSpendImpactByScenario[s.id] ?? 0)}
                          </TableCell>
                        ))}
                        {isTwo && (
                        <TableCell
                          className={cn(
                            'text-right tabular-nums px-3 py-2.5 font-semibold',
                            deltaSpend > 0 && 'value-negative',
                            deltaSpend < 0 && 'value-positive'
                          )}
                        >
                          {deltaSpend !== 0 ? (
                            <span className="inline-flex items-center gap-1">
                              {deltaSpend > 0 ? (
                                <TrendingUp className="size-3.5 shrink-0" aria-hidden />
                              ) : (
                                <TrendingDown className="size-3.5 shrink-0" aria-hidden />
                              )}
                              {formatCurrency(deltaSpend)}
                              {deltaSpendPct != null &&
                                ` (${deltaSpendPct > 0 ? '+' : ''}${deltaSpendPct.toFixed(1)}%)`}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        )}
                      </TableRow>
                      <TableRow
                        className="bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('incentive')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('incentive') } }}
                        aria-label="View work RVU incentive breakdown by specialty and provider"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.incentive.body}>Work RVU incentive (modeled)</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain Work RVU incentive" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('incentive') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {formatCurrency(comparison.rollup.totalIncentiveByScenario[s.id] ?? 0)}
                          </TableCell>
                        ))}
                        {isTwo && (
                        <TableCell
                          className={cn(
                            'text-right tabular-nums px-3 py-2.5 font-semibold',
                            deltaIncentive > 0 && 'value-negative',
                            deltaIncentive < 0 && 'value-positive'
                          )}
                        >
                          {deltaIncentive !== 0 ? (
                            <span className="inline-flex items-center gap-1">
                              {deltaIncentive > 0 ? (
                                <TrendingUp className="size-3.5 shrink-0" aria-hidden />
                              ) : (
                                <TrendingDown className="size-3.5 shrink-0" aria-hidden />
                              )}
                              {formatCurrency(deltaIncentive)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        )}
                      </TableRow>
                      <TableRow className="bg-muted/20">
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          Budget (cap)
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => {
                          const a = comparison.assumptionsPerScenario.find((ap) => ap.scenarioId === s.id)
                          const cap = a?.budgetConstraint?.kind === 'cap_dollars' && a.budgetConstraint.capDollars != null ? a.budgetConstraint.capDollars : null
                          return (
                            <TableCell key={s.id} className="text-right text-sm px-3 py-2.5">
                              {cap != null ? formatCurrency(cap) : '—'}
                            </TableCell>
                          )
                        })}
                        {isTwo && <TableCell className="text-right px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                      <TableRow className="bg-muted/20">
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          Incentive vs budget
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => {
                          const a = comparison.assumptionsPerScenario.find((ap) => ap.scenarioId === s.id)
                          const cap = a?.budgetConstraint?.kind === 'cap_dollars' && a.budgetConstraint.capDollars != null ? a.budgetConstraint.capDollars : null
                          const incentive = comparison.rollup.totalIncentiveByScenario[s.id] ?? 0
                          if (cap == null) {
                            return <TableCell key={s.id} className="text-right text-sm px-3 py-2.5 text-muted-foreground">—</TableCell>
                          }
                          const over = incentive - cap
                          const isOver = over > 0
                          const isUnder = over < 0
                          const text = isOver ? `Over by ${formatCurrency(over)}` : isUnder ? `Under by ${formatCurrency(Math.abs(over))}` : 'Within budget'
                          return (
                            <TableCell
                              key={s.id}
                              className={cn(
                                'text-right text-sm px-3 py-2.5 font-medium',
                                isOver && 'value-warning',
                                isUnder && 'value-positive',
                                over === 0 && 'value-positive'
                              )}
                            >
                              {text}
                            </TableCell>
                          )
                        })}
                        {isTwo && <TableCell className="text-right px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('alignment')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('alignment') } }}
                        aria-label="View TCC percentile breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.meanTCC.body}>Mean TCC percentile</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain Mean TCC percentile" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('meanTCC') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {formatPercentile(comparison.rollup.meanTCCPercentileByScenario[s.id] ?? 0)}
                          </TableCell>
                        ))}
                        {isTwo && <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                      <TableRow
                        className="bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('alignment')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('alignment') } }}
                        aria-label="View mean TCC percentile (modeled) breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.meanTCCModeled.body}>Mean TCC percentile (modeled)</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain Mean TCC percentile (modeled)" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('meanTCCModeled') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {formatPercentile(comparison.rollup.meanModeledTCCPercentileByScenario[s.id] ?? 0)}
                          </TableCell>
                        ))}
                        {isTwo && <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('percentile')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('percentile') } }}
                        aria-label="View wRVU percentile breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.meanWRVU.body}>Mean wRVU percentile</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain Mean wRVU percentile" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('meanWRVU') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {formatPercentile(comparison.rollup.meanWRVUPercentileByScenario[s.id] ?? 0)}
                          </TableCell>
                        ))}
                        {isTwo && <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('alignment')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('alignment') } }}
                        aria-label="View alignment breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.alignment.body}>Meeting alignment target</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain Meeting alignment target" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('alignment') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {comparison.rollup.countMeetingAlignmentTargetByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                        {isTwo && <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                      <TableRow
                        className="bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('alignment')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('alignment') } }}
                        aria-label="View CF above policy breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.cfAbovePolicy.body}>CF above policy</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain CF above policy" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('cfAbovePolicy') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {comparison.rollup.countCFAbovePolicyByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                        {isTwo && <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('alignment')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDownMetric('alignment') } }}
                        aria-label="View effective rate breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5">
                          <span className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90" title={ROLLUP_METRIC_HELP.effectiveRate90.body}>Effective rate &gt;90</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-1.5 size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Explain Effective rate >90" onClick={(e) => { e.stopPropagation(); setMetricHelpDialogKey('effectiveRate90') }}><HelpCircle className="size-3.5" /></Button>
                        </TableCell>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {comparison.rollup.countEffectiveRateAbove90ByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                        {isTwo && <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </section>

              {/* Assumptions */}
              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                  <span className={cn(iconBoxClass, 'size-8 [&_svg]:size-4')} aria-hidden>
                    <Settings />
                  </span>
                  Assumptions
                </h3>
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                      <TableRow>
                        <TableHead className="w-[180px] px-3 py-2.5 font-medium">Setting</TableHead>
                        {comparison.assumptionsPerScenario.map((a: OptimizerAssumptionsPerScenario) => (
                          <TableHead key={a.scenarioId} className="text-right px-3 py-2.5 font-medium" title={a.scenarioName}>
                            <span className="truncate max-w-[100px] inline-block align-bottom">{a.scenarioName}</span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">
                          Productivity gain (wRVU growth %)
                        </TableCell>
                        {comparison.assumptionsPerScenario.map((a: OptimizerAssumptionsPerScenario) => (
                          <TableCell key={a.scenarioId} className="text-right tabular-nums px-3 py-2.5">
                            {a.wRVUGrowthFactorPct != null ? `${a.wRVUGrowthFactorPct}%` : '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Objective</TableCell>
                        {comparison.assumptionsPerScenario.map((a: OptimizerAssumptionsPerScenario) => (
                          <TableCell key={a.scenarioId} className="text-right text-sm px-3 py-2.5">
                            {formatObjective(a.optimizationObjective)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Budget constraint</TableCell>
                        {comparison.assumptionsPerScenario.map((a: OptimizerAssumptionsPerScenario) => (
                          <TableCell key={a.scenarioId} className="text-right text-sm px-3 py-2.5">
                            {formatBudgetConstraint(a.budgetConstraint)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Providers included</TableCell>
                        {comparison.assumptionsPerScenario.map((a: OptimizerAssumptionsPerScenario) => (
                          <TableCell key={a.scenarioId} className="text-right tabular-nums px-3 py-2.5">
                            {a.providersIncluded}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Providers excluded</TableCell>
                        {comparison.assumptionsPerScenario.map((a: OptimizerAssumptionsPerScenario) => (
                          <TableCell key={a.scenarioId} className="text-right tabular-nums px-3 py-2.5">
                            {a.providersExcluded}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Hard cap (TCC %ile)</TableCell>
                        {comparison.assumptionsPerScenario.map((a: OptimizerAssumptionsPerScenario) => (
                          <TableCell key={a.scenarioId} className="text-right tabular-nums px-3 py-2.5">
                            {a.governanceConfig.hardCapPercentile}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </section>

              {/* By specialty */}
              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                  <span className={cn(iconBoxClass, 'size-8 [&_svg]:size-4')} aria-hidden>
                    <Building2 />
                  </span>
                  By specialty
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  TCC %ile <strong>current</strong> = baseline (before recommended CF); often the same for A and B. TCC %ile <strong>modeled</strong> = after each scenario&apos;s recommended CF; differs when spend differs.
                </p>
                <div className="overflow-auto rounded-lg border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                      <TableRow>
                        <TableHead className="min-w-[100px] px-3 py-2.5 font-medium">Specialty</TableHead>
                        <TableHead className="min-w-[70px] text-right px-3 py-2.5 font-medium">Presence</TableHead>
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableHead key={s.id} className="min-w-[70px] text-right px-3 py-2.5 font-medium" title={s.name}>CF ({s.name})</TableHead>
                        ))}
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableHead key={`spend-${s.id}`} className="min-w-[90px] text-right px-3 py-2.5 font-medium" title={s.name}>Spend ({s.name})</TableHead>
                        ))}
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableHead key={`tcc-${s.id}`} className="min-w-[72px] text-right px-3 py-2.5 font-medium" title={`Baseline TCC %ile: ${s.name}`}>TCC %ile current</TableHead>
                        ))}
                        {comparison.scenarios.map((s: ScenarioInfo) => (
                          <TableHead key={`modeled-${s.id}`} className="min-w-[72px] text-right px-3 py-2.5 font-medium" title={`Modeled TCC %ile: ${s.name}`}>TCC %ile modeled</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      {comparison.bySpecialty.map((row: OptimizerComparisonSpecialtyRowN, index: number) => {
                        const presenceLabel = row.scenarioIds.length === comparison.scenarios.length
                          ? 'All'
                          : comparison.scenarios.filter((s) => row.scenarioIds.includes(s.id)).map((s) => s.name).join(', ')
                        return (
                          <TableRow
                            key={row.specialty}
                            className={cn(index % 2 === 1 && 'bg-muted/30')}
                          >
                            <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                            <TableCell className="text-right text-muted-foreground px-3 py-2.5" title={row.scenarioIds.length < comparison.scenarios.length ? `Present in: ${presenceLabel}` : undefined}>
                              {presenceLabel}
                            </TableCell>
                            {comparison.scenarios.map((s: ScenarioInfo) => (
                              <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                                {row.recommendedCFByScenario[s.id] != null ? row.recommendedCFByScenario[s.id]!.toFixed(2) : '—'}
                              </TableCell>
                            ))}
                            {comparison.scenarios.map((s: ScenarioInfo) => (
                              <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                                {row.spendImpactByScenario[s.id] != null ? formatCurrency(row.spendImpactByScenario[s.id]!) : '—'}
                              </TableCell>
                            ))}
                            {comparison.scenarios.map((s: ScenarioInfo) => (
                              <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">
                                {row.meanTCCPercentileByScenario[s.id] != null ? formatPercentile(row.meanTCCPercentileByScenario[s.id]!) : '—'}
                              </TableCell>
                            ))}
                            {comparison.scenarios.map((s: ScenarioInfo) => (
                              <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5 font-medium">
                                {row.meanModeledTCCPercentileByScenario[s.id] != null ? formatPercentile(row.meanModeledTCCPercentileByScenario[s.id]!) : '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>

              {/* Drill-down sheet: how roll-up metrics break down by specialty and provider */}
              {comparison && drillDownMetric && (
                <RollupDrillDownSheet
                  comparison={comparison}
                  selectedConfigs={selectedConfigs}
                  metric={drillDownMetric}
                  onClose={() => {
                    setDrillDownMetric(null)
                    setExpandedSpecialty(null)
                  }}
                  expandedSpecialty={expandedSpecialty}
                  onToggleSpecialty={(s) => setExpandedSpecialty((prev) => (prev === s ? null : s))}
                  formatCurrency={formatCurrency}
                  formatPercentile={formatPercentile}
                  formatPercentileForCard={formatPercentileForCard}
                />
              )}
            </>
          ); })() : null}
        </>
      )}
    </div>
  )
}
