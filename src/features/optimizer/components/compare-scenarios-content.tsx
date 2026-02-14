import { useEffect, useMemo, useState } from 'react'
import { BarChart2, Building2, DollarSign, FileText, GitCompare, Settings, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  BudgetConstraint,
} from '@/types/optimizer'
import { iconBoxClass } from '@/components/section-title-with-icon'
import { canCompareOptimizerConfig, compareOptimizerScenarios } from '@/lib/optimizer-compare'
import { formatPercentile } from '@/features/optimizer/components/optimizer-constants'

/** At-a-glance card: percentile as plain language (e.g. "Below 25th (3.3rd)"). */
function formatPercentileForCard(p: number): string {
  if (p < 25) return `Below 25th (${p.toFixed(1)}th)`
  if (p > 90) return `Above 90th (${p.toFixed(1)}th)`
  return `${p.toFixed(1)}th`
}

function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
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

function formatBudgetConstraint(b: BudgetConstraint): string {
  if (b.kind === 'none') return 'None'
  if (b.kind === 'neutral') return 'Neutral'
  if (b.kind === 'cap_pct' && b.capPct != null) return `Cap ${b.capPct}%`
  if (b.kind === 'cap_dollars' && b.capDollars != null) return `Cap ${formatCurrency(b.capDollars)}`
  return b.kind
}

export interface CompareScenariosContentProps {
  savedOptimizerConfigs: SavedOptimizerConfig[]
  initialScenarioAId?: string
  initialScenarioBId?: string
  /** Called when comparison changes (for export). */
  onComparisonChange?: (data: { comparison: import('@/types/optimizer').OptimizerScenarioComparison; nameA: string; nameB: string } | null) => void
}

export function CompareScenariosContent({
  savedOptimizerConfigs,
  initialScenarioAId = '',
  initialScenarioBId = '',
  onComparisonChange,
}: CompareScenariosContentProps) {
  const [scenarioAId, setScenarioAId] = useState<string>(initialScenarioAId)
  const [scenarioBId, setScenarioBId] = useState<string>(initialScenarioBId)

  const comparableConfigs = useMemo(
    () => savedOptimizerConfigs.filter(canCompareOptimizerConfig),
    [savedOptimizerConfigs]
  )

  const comparison = useMemo(() => {
    if (!scenarioAId || !scenarioBId || scenarioAId === scenarioBId) return null
    const configA = comparableConfigs.find((c) => c.id === scenarioAId)
    const configB = comparableConfigs.find((c) => c.id === scenarioBId)
    if (!configA || !configB) return null
    return compareOptimizerScenarios(configA, configB)
  }, [comparableConfigs, scenarioAId, scenarioBId])

  const canCompare = comparableConfigs.length >= 2
  const hasSelection = scenarioAId && scenarioBId && scenarioAId !== scenarioBId

  useEffect(() => {
    onComparisonChange?.(comparison && hasSelection
      ? {
          comparison,
          nameA: comparison.scenarioAName,
          nameB: comparison.scenarioBName,
        }
      : null)
  }, [comparison, hasSelection, onComparisonChange])

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      {!canCompare ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
          <span className={cn(iconBoxClass, 'size-12 [&_svg]:size-8')} aria-hidden>
            <GitCompare />
          </span>
          <p className="text-sm text-muted-foreground">
            Save at least two scenarios after running the optimizer to compare them. Run the
            optimizer, then use &quot;Save scenario&quot; for each run you want to compare.
          </p>
        </div>
      ) : (
        <>
          {/* Scenario selection — single section card, symmetric layout */}
          <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
              <span className={cn(iconBoxClass, 'size-8 [&_svg]:size-4')} aria-hidden>
                <GitCompare />
              </span>
              Scenarios
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Select value={scenarioAId} onValueChange={setScenarioAId}>
                  <SelectTrigger aria-label="Scenario A">
                    <SelectValue placeholder="Select first scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {comparableConfigs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={scenarioBId} onValueChange={setScenarioBId}>
                  <SelectTrigger aria-label="Scenario B">
                    <SelectValue placeholder="Select second scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {comparableConfigs.map((c) => (
                      <SelectItem key={c.id} value={c.id} disabled={c.id === scenarioAId}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {!hasSelection ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
              <span className={cn(iconBoxClass, 'size-10 [&_svg]:size-6')} aria-hidden>
                <GitCompare />
              </span>
              <p className="text-sm text-muted-foreground">
                Choose two different scenarios above to see the comparison.
              </p>
            </div>
          ) : comparison ? (
            <>
              {/* At a glance — key numbers for exec review */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <DollarSign />
                    </span>
                    Spend change (B vs A)
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Change in total compensation spend
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 text-lg font-semibold tabular-nums',
                      comparison.rollup.deltaSpendImpact > 0 && 'text-red-600 dark:text-red-400',
                      comparison.rollup.deltaSpendImpact < 0 && 'text-emerald-600 dark:text-emerald-400',
                      comparison.rollup.deltaSpendImpact === 0 && 'text-foreground'
                    )}
                  >
                    {comparison.rollup.deltaSpendImpact !== 0
                      ? formatCurrency(comparison.rollup.deltaSpendImpact)
                      : 'No change'}
                  </p>
                  {comparison.rollup.deltaSpendImpactPct != null && comparison.rollup.deltaSpendImpact !== 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {comparison.rollup.deltaSpendImpactPct > 0 ? '+' : ''}
                      {comparison.rollup.deltaSpendImpactPct.toFixed(1)}% vs A
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <Target />
                    </span>
                    Specialties aligned
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Specialties where pay and productivity are aligned
                  </p>
                  <p className="mt-1.5 text-lg font-semibold tabular-nums text-foreground">
                    A: {comparison.rollup.countMeetingAlignmentTargetA} · B: {comparison.rollup.countMeetingAlignmentTargetB}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <BarChart2 />
                    </span>
                    Avg productivity percentile
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Higher = more productive vs market
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
                    A: {formatPercentileForCard(comparison.rollup.meanWRVUPercentileA)} · B: {formatPercentileForCard(comparison.rollup.meanWRVUPercentileB)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <DollarSign />
                    </span>
                    Incentive change (B vs A)
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Change in work RVU incentive dollars
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 text-lg font-semibold tabular-nums',
                      comparison.rollup.deltaIncentive > 0 && 'text-red-600 dark:text-red-400',
                      comparison.rollup.deltaIncentive < 0 && 'text-emerald-600 dark:text-emerald-400',
                      comparison.rollup.deltaIncentive === 0 && 'text-foreground'
                    )}
                  >
                    {comparison.rollup.deltaIncentive !== 0
                      ? formatCurrency(comparison.rollup.deltaIncentive)
                      : 'No change'}
                  </p>
                </div>
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
                  {Array.isArray(comparison.narrativeSummary) ? (
                    <ul className="space-y-2 text-sm leading-relaxed text-foreground/90">
                      {comparison.narrativeSummary.map((bullet, idx) => (
                        <li
                          key={idx}
                          className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:size-1 before:rounded-full before:bg-primary/60"
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {comparison.narrativeSummary}
                    </p>
                  )}
                </div>
              </section>

              {/* Roll-up metrics */}
              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                  <span className={cn(iconBoxClass, 'size-8 [&_svg]:size-4')} aria-hidden>
                    <BarChart2 />
                  </span>
                  Roll-up metrics
                </h3>
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                      <TableRow>
                        <TableHead className="w-[200px] px-3 py-2.5 font-medium">Metric</TableHead>
                        <TableHead className="min-w-[90px] text-right px-3 py-2.5 font-medium">A</TableHead>
                        <TableHead className="min-w-[90px] text-right px-3 py-2.5 font-medium">B</TableHead>
                        <TableHead className="min-w-[100px] border-l border-border/60 text-right px-3 py-2.5 font-medium">Δ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Total spend impact</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatCurrency(comparison.rollup.totalSpendImpactA)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatCurrency(comparison.rollup.totalSpendImpactB)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums px-3 py-2.5 font-semibold',
                            comparison.rollup.deltaSpendImpact > 0 && 'text-red-600 dark:text-red-400',
                            comparison.rollup.deltaSpendImpact < 0 && 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {comparison.rollup.deltaSpendImpact !== 0 ? (
                            <span className="inline-flex items-center gap-1">
                              {comparison.rollup.deltaSpendImpact > 0 ? (
                                <TrendingUp className="size-3.5 shrink-0" aria-hidden />
                              ) : (
                                <TrendingDown className="size-3.5 shrink-0" aria-hidden />
                              )}
                              {formatCurrency(comparison.rollup.deltaSpendImpact)}
                              {comparison.rollup.deltaSpendImpactPct != null &&
                                ` (${comparison.rollup.deltaSpendImpactPct > 0 ? '+' : ''}${comparison.rollup.deltaSpendImpactPct.toFixed(1)}%)`}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Work RVU incentive (modeled)</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatCurrency(comparison.rollup.totalIncentiveA)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatCurrency(comparison.rollup.totalIncentiveB)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums px-3 py-2.5 font-semibold',
                            comparison.rollup.deltaIncentive > 0 && 'text-red-600 dark:text-red-400',
                            comparison.rollup.deltaIncentive < 0 && 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {comparison.rollup.deltaIncentive !== 0 ? (
                            <span className="inline-flex items-center gap-1">
                              {comparison.rollup.deltaIncentive > 0 ? (
                                <TrendingUp className="size-3.5 shrink-0" aria-hidden />
                              ) : (
                                <TrendingDown className="size-3.5 shrink-0" aria-hidden />
                              )}
                              {formatCurrency(comparison.rollup.deltaIncentive)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Mean TCC percentile</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatPercentile(comparison.rollup.meanTCCPercentileA)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatPercentile(comparison.rollup.meanTCCPercentileB)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Mean wRVU percentile</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatPercentile(comparison.rollup.meanWRVUPercentileA)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {formatPercentile(comparison.rollup.meanWRVUPercentileB)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Meeting alignment target</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.rollup.countMeetingAlignmentTargetA}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.rollup.countMeetingAlignmentTargetB}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">CF above policy</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.rollup.countCFAbovePolicyA}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.rollup.countCFAbovePolicyB}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Effective rate &gt;90</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.rollup.countEffectiveRateAbove90A}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.rollup.countEffectiveRateAbove90B}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">—</TableCell>
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
                            <TableHead className="text-right px-3 py-2.5 font-medium">A</TableHead>
                            <TableHead className="text-right px-3 py-2.5 font-medium">B</TableHead>
                          </TableRow>
                        </TableHeader>
                    <TableBody className="text-sm">
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">
                          Productivity gain (wRVU growth %)
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.wRVUGrowthFactorPctA != null
                            ? `${comparison.assumptions.wRVUGrowthFactorPctA}%`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.wRVUGrowthFactorPctB != null
                            ? `${comparison.assumptions.wRVUGrowthFactorPctB}%`
                            : '—'}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Objective</TableCell>
                        <TableCell className="text-right text-sm px-3 py-2.5">
                          {formatObjective(comparison.assumptions.objectiveA)}
                        </TableCell>
                        <TableCell className="text-right text-sm px-3 py-2.5">
                          {formatObjective(comparison.assumptions.objectiveB)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Budget constraint</TableCell>
                        <TableCell className="text-right text-sm px-3 py-2.5">
                          {formatBudgetConstraint(comparison.assumptions.budgetConstraintA)}
                        </TableCell>
                        <TableCell className="text-right text-sm px-3 py-2.5">
                          {formatBudgetConstraint(comparison.assumptions.budgetConstraintB)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Providers included</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.providersIncludedA}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.providersIncludedB}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Providers excluded</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.providersExcludedA}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.providersExcludedB}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground px-3 py-2.5">Hard cap (TCC %ile)</TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.governanceA.hardCapPercentile}
                        </TableCell>
                        <TableCell className="text-right tabular-nums px-3 py-2.5">
                          {comparison.assumptions.governanceB.hardCapPercentile}
                        </TableCell>
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
                <div className="overflow-auto rounded-lg border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                          <TableRow>
                            <TableHead className="min-w-[100px] px-3 py-2.5 font-medium">Specialty</TableHead>
                            <TableHead className="min-w-[70px] text-right px-3 py-2.5 font-medium">Presence</TableHead>
                            <TableHead className="min-w-[70px] text-right px-3 py-2.5 font-medium">CF (A)</TableHead>
                            <TableHead className="min-w-[70px] text-right px-3 py-2.5 font-medium">CF (B)</TableHead>
                            <TableHead className="min-w-[80px] border-l border-border/60 text-right px-3 py-2.5 font-medium">Δ CF %</TableHead>
                            <TableHead className="min-w-[90px] text-right px-3 py-2.5 font-medium">Spend (A)</TableHead>
                            <TableHead className="min-w-[90px] text-right px-3 py-2.5 font-medium">Spend (B)</TableHead>
                            <TableHead className="min-w-[80px] border-l border-border/60 text-right px-3 py-2.5 font-medium">Δ Spend</TableHead>
                            <TableHead className="min-w-[70px] text-right px-3 py-2.5 font-medium">TCC %ile (A)</TableHead>
                            <TableHead className="min-w-[70px] text-right px-3 py-2.5 font-medium">TCC %ile (B)</TableHead>
                          </TableRow>
                        </TableHeader>
                    <TableBody className="text-sm">
                      {comparison.bySpecialty.map((row, index) => (
                        <TableRow
                          key={row.specialty}
                          className={cn(index % 2 === 1 && 'bg-muted/30')}
                        >
                          <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                          <TableCell className="text-right text-muted-foreground px-3 py-2.5">
                            {row.presence === 'both' ? 'Both' : row.presence === 'a_only' ? 'A only' : 'B only'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.recommendedCFA != null ? row.recommendedCFA.toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.recommendedCFB != null ? row.recommendedCFB.toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.deltaCFPct != null
                              ? `${row.deltaCFPct >= 0 ? '+' : ''}${row.deltaCFPct.toFixed(1)}%`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.spendImpactA != null ? formatCurrency(row.spendImpactA) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.spendImpactB != null ? formatCurrency(row.spendImpactB) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.deltaSpendImpact != null ? formatCurrency(row.deltaSpendImpact) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.meanTCCPercentileA != null
                              ? formatPercentile(row.meanTCCPercentileA)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {row.meanTCCPercentileB != null
                              ? formatPercentile(row.meanTCCPercentileB)
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
