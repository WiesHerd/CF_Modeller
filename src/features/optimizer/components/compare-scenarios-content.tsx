import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart2, Building2, ChevronDown, ChevronRight, ChevronUp, DollarSign, FileText, GitCompare, HelpCircle, Search, Settings, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
  OptimizerScenarioComparisonN,
  OptimizerComparisonSpecialtyRowN,
  OptimizerAssumptionsPerScenario,
  ScenarioInfo,
} from '@/types/optimizer'
import { MAX_COMPARE_SCENARIOS } from '@/types/optimizer'
import { formatBudgetConstraint } from '@/lib/optimizer-format'
import { iconBoxClass } from '@/components/section-title-with-icon'
import { canCompareOptimizerConfig, compareOptimizerScenariosN } from '@/lib/optimizer-compare'
import { formatPercentile } from '@/features/optimizer/components/optimizer-constants'

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

/** Merge incentive by specialty for scenario A and B. */
/** Build incentive-by-specialty for N configs (one column per scenario). */
function mergeIncentiveBySpecialtyN(
  configs: SavedOptimizerConfig[]
): { specialty: string; incentiveByScenario: Record<string, number> }[] {
  const bySpecByScenario = new Map<string, Record<string, number>>()
  for (const config of configs) {
    const result = config.snapshot?.lastRunResult
    if (!result) continue
    const scenarioId = config.id
    for (const row of result.bySpecialty) {
      const total = row.providerContexts.reduce(
        (sum, ctx) => sum + (ctx.modeledIncentiveDollars ?? 0),
        0
      )
      let rec = bySpecByScenario.get(row.specialty)
      if (!rec) {
        rec = {}
        bySpecByScenario.set(row.specialty, rec)
      }
      rec[scenarioId] = total
    }
  }
  return [...bySpecByScenario.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([specialty, incentiveByScenario]) => ({ specialty, incentiveByScenario }))
}

function RollupDrillDownSheet({
  comparison,
  selectedConfigs,
  metric,
  onClose,
  expandedSpecialty,
  onToggleSpecialty,
  formatCurrency,
  formatPercentile,
  formatPercentileForCard,
}: {
  comparison: OptimizerScenarioComparisonN
  selectedConfigs: SavedOptimizerConfig[]
  metric: 'spend' | 'incentive' | 'alignment' | 'percentile'
  onClose: () => void
  expandedSpecialty: string | null
  onToggleSpecialty: (specialty: string) => void
  formatCurrency: (value: number, decimals?: number) => string
  formatPercentile: (p: number) => string
  formatPercentileForCard: (p: number) => string
}) {
  const scenarios = comparison.scenarios
  const isTwo = scenarios.length === 2

  const incentiveRows = useMemo(() => mergeIncentiveBySpecialtyN(selectedConfigs), [selectedConfigs])

  const title =
    metric === 'spend'
      ? isTwo ? 'Spend change — by specialty and provider' : 'Spend by scenario — by specialty and provider'
      : metric === 'incentive'
        ? isTwo ? 'Incentive change — by specialty and provider' : 'Incentive by scenario — by specialty and provider'
        : metric === 'alignment'
          ? 'Specialties aligned — by specialty'
          : 'Avg productivity percentile — by specialty'

  const DRAWER_WIDTH_MIN = 400
  const DRAWER_WIDTH_MAX = 1100
  const DRAWER_WIDTH_DEFAULT = 640
  const [drawerWidth, setDrawerWidth] = useState(DRAWER_WIDTH_DEFAULT)

  const handleDrawerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = drawerWidth
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setDrawerWidth(
        Math.min(DRAWER_WIDTH_MAX, Math.max(DRAWER_WIDTH_MIN, startW + delta))
      )
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [drawerWidth])

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-6 overflow-hidden px-6 py-5 sm:max-w-[none] border-border"
        contentStyle={{ width: drawerWidth, maxWidth: 'none' }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize drawer"
          className="absolute left-0 top-0 bottom-0 z-50 w-2 cursor-col-resize touch-none border-l border-transparent hover:border-primary/30 hover:bg-primary/10"
          onMouseDown={handleDrawerResize}
        />
        <SheetHeader className="shrink-0 px-6 pt-6 pb-2 border-b border-border gap-2">
          <SheetTitle className="pr-8 text-xl font-semibold tracking-tight text-foreground">
            {title}
          </SheetTitle>
          {metric === 'spend' && (
            <SheetDescription className="text-sm text-muted-foreground leading-relaxed">
              Expand a specialty to see provider-level spend impact.
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {metric === 'spend' && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/5 px-3 py-2">
              <strong className="text-foreground">What you&apos;re seeing:</strong> This table shows how total compensation spend changes by specialty (and by provider when you expand a row). Each column is one scenario&apos;s modeled spend; when comparing two scenarios, Δ is the difference. Expand a specialty to see each provider&apos;s spend impact (modeled minus current).
            </p>
          )}
          {metric === 'incentive' && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/5 px-3 py-2">
              <strong className="text-foreground">What you&apos;re seeing:</strong> Work RVU incentive dollars by specialty and, when expanded, by provider. Each column is one scenario. This is the productivity-based part of comp.
            </p>
          )}
          {metric === 'alignment' && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/5 px-3 py-2">
              <strong className="text-foreground">What you&apos;re seeing:</strong> TCC percentile = pay vs market; wRVU percentile = productivity vs market. Use this to see how each specialty compares to market on pay and productivity, and whether they&apos;re aligned (similar percentiles).
            </p>
          )}
          {metric === 'percentile' && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/5 px-3 py-2">
              <strong className="text-foreground">What you&apos;re seeing:</strong> Average productivity (wRVU) percentile by specialty for scenario A and B. Higher = more productive relative to market. Use this to compare how productivity stacks up across scenarios.
            </p>
          )}
          {metric === 'spend' && (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="w-[200px] px-3 py-2.5 font-medium">Specialty</TableHead>
                      {scenarios.map((s: ScenarioInfo) => (
                        <TableHead key={s.id} className="text-right px-3 py-2.5 font-medium" title={s.name}>Spend ({s.name})</TableHead>
                      ))}
                      {isTwo && <TableHead className="text-right px-3 py-2.5 font-medium">Δ</TableHead>}
                      <TableHead className="w-8 px-3 py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {comparison.bySpecialty.map((row: OptimizerComparisonSpecialtyRowN) => (
                      <React.Fragment key={row.specialty}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          role="button"
                          tabIndex={0}
                          onClick={() => onToggleSpecialty(row.specialty)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSpecialty(row.specialty) } }}
                          aria-label={expandedSpecialty === row.specialty ? `Collapse ${row.specialty}` : `Expand ${row.specialty} to see provider-level spend impact`}
                        >
                          <TableCell className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90 px-3 py-2.5">{row.specialty}</TableCell>
                          {scenarios.map((s: ScenarioInfo) => (
                            <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                              {row.spendImpactByScenario[s.id] != null ? formatCurrency(row.spendImpactByScenario[s.id]!) : '—'}
                            </TableCell>
                          ))}
                          {isTwo && (
                            <TableCell className="text-right tabular-nums px-3 py-2.5">
                              {row.spendImpactByScenario[scenarios[1].id] != null && row.spendImpactByScenario[scenarios[0].id] != null
                                ? formatCurrency(row.spendImpactByScenario[scenarios[1].id]! - row.spendImpactByScenario[scenarios[0].id]!)
                                : '—'}
                            </TableCell>
                          )}
                          <TableCell className="px-3 py-2.5">
                            {expandedSpecialty === row.specialty ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedSpecialty === row.specialty && (() => {
                          const results = selectedConfigs.map((c) => c.snapshot?.lastRunResult).filter(Boolean) as import('@/types/optimizer').OptimizerRunResult[]
                          if (results.length === 0) return null
                          const byConfig = results.map((r) => r.bySpecialty.find((s) => s.specialty === row.specialty))
                          const spendByConfig = byConfig.map((spec) => {
                            const m = new Map<string, number>()
                            for (const ctx of spec?.providerContexts ?? []) {
                              if (ctx.included) m.set(ctx.providerId, (ctx.modeledTCCRaw ?? 0) - (ctx.currentTCCBaseline ?? 0))
                            }
                            return m
                          })
                          const nameMaps = byConfig.map((spec) =>
                            new Map((spec?.providerContexts ?? []).map((c) => [c.providerId, (c.provider?.providerName ?? c.providerId).toString()]))
                          )
                          const allIds = new Set(spendByConfig.flatMap((m) => [...m.keys()]))
                          return [...allIds].map((id) => (
                            <TableRow key={id} className="bg-muted/20">
                              <TableCell className="pl-6 text-xs text-primary px-3 py-2.5">
                                {nameMaps.map((nm) => nm.get(id)).find(Boolean) ?? id}
                              </TableCell>
                              {scenarios.map((s, i) => (
                                <TableCell key={s.id} className="text-right tabular-nums text-xs px-3 py-2.5">
                                  {formatCurrency(spendByConfig[i]?.get(id) ?? 0)}
                                </TableCell>
                              ))}
                              {isTwo && scenarios.length === 2 && (
                                <TableCell className="text-right tabular-nums text-xs px-3 py-2.5">
                                  {formatCurrency((spendByConfig[1]?.get(id) ?? 0) - (spendByConfig[0]?.get(id) ?? 0))}
                                </TableCell>
                              )}
                              <TableCell className="px-3 py-2.5" />
                            </TableRow>
                          ))
                        })()}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
          {metric === 'incentive' && (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="w-[200px] px-3 py-2.5 font-medium">Specialty</TableHead>
                      {scenarios.map((s: ScenarioInfo) => (
                        <TableHead key={s.id} className="text-right px-3 py-2.5 font-medium" title={s.name}>Incentive ({s.name})</TableHead>
                      ))}
                      {isTwo && <TableHead className="text-right px-3 py-2.5 font-medium">Δ</TableHead>}
                      <TableHead className="w-8 px-3 py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {incentiveRows.map((row: { specialty: string; incentiveByScenario: Record<string, number> }) => (
                      <React.Fragment key={row.specialty}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onToggleSpecialty(row.specialty)}
                        >
                          <TableCell className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90 px-3 py-2.5">{row.specialty}</TableCell>
                          {scenarios.map((s: ScenarioInfo) => (
                            <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                              {formatCurrency(row.incentiveByScenario[s.id] ?? 0)}
                            </TableCell>
                          ))}
                          {isTwo && scenarios.length === 2 && (
                            <TableCell className="text-right tabular-nums px-3 py-2.5">
                              {formatCurrency((row.incentiveByScenario[scenarios[1].id] ?? 0) - (row.incentiveByScenario[scenarios[0].id] ?? 0))}
                            </TableCell>
                          )}
                          <TableCell className="px-3 py-2.5">
                            {expandedSpecialty === row.specialty ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedSpecialty === row.specialty && (() => {
                          const results = selectedConfigs.map((c) => c.snapshot?.lastRunResult).filter(Boolean) as import('@/types/optimizer').OptimizerRunResult[]
                          if (results.length === 0) return null
                          const byConfig = results.map((r) => r.bySpecialty.find((s) => s.specialty === row.specialty))
                          const incentiveByConfig = byConfig.map((spec) =>
                            new Map((spec?.providerContexts ?? []).map((c) => [c.providerId, c.modeledIncentiveDollars ?? 0]))
                          )
                          const nameMaps = byConfig.map((spec) =>
                            new Map((spec?.providerContexts ?? []).map((c) => [c.providerId, (c.provider?.providerName ?? c.providerId).toString()]))
                          )
                          const allIds = new Set(incentiveByConfig.flatMap((m) => [...m.keys()]))
                          return [...allIds].map((id) => (
                            <TableRow key={id} className="bg-muted/20">
                              <TableCell className="pl-6 text-xs text-primary px-3 py-2.5">
                                {nameMaps.map((nm) => nm.get(id)).find(Boolean) ?? id}
                              </TableCell>
                              {scenarios.map((s, i) => (
                                <TableCell key={s.id} className="text-right tabular-nums text-xs px-3 py-2.5">
                                  {formatCurrency(incentiveByConfig[i]?.get(id) ?? 0)}
                                </TableCell>
                              ))}
                              {isTwo && scenarios.length === 2 && (
                                <TableCell className="text-right tabular-nums text-xs px-3 py-2.5">
                                  {formatCurrency((incentiveByConfig[1]?.get(id) ?? 0) - (incentiveByConfig[0]?.get(id) ?? 0))}
                                </TableCell>
                              )}
                              <TableCell className="px-3 py-2.5" />
                            </TableRow>
                          ))
                        })()}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
          {metric === 'alignment' && (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="px-3 py-2.5 font-medium">Specialty</TableHead>
                      {scenarios.map((s: ScenarioInfo) => (
                        <TableHead key={s.id} className="text-right px-3 py-2.5 font-medium" title={`TCC baseline: ${s.name}`}>TCC %ile baseline</TableHead>
                      ))}
                      {scenarios.map((s: ScenarioInfo) => (
                        <TableHead key={`modeled-${s.id}`} className="text-right px-3 py-2.5 font-medium" title={`TCC modeled: ${s.name}`}>TCC %ile modeled</TableHead>
                      ))}
                      {scenarios.map((s: ScenarioInfo) => (
                        <TableHead key={`wrvu-${s.id}`} className="text-right px-3 py-2.5 font-medium" title={`wRVU: ${s.name}`}>wRVU %ile</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {comparison.bySpecialty.map((row: OptimizerComparisonSpecialtyRowN) => (
                      <TableRow key={row.specialty}>
                        <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                        {scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {row.meanTCCPercentileByScenario[s.id] != null ? formatPercentile(row.meanTCCPercentileByScenario[s.id]!) : '—'}
                          </TableCell>
                        ))}
                        {scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5 font-medium">
                            {row.meanModeledTCCPercentileByScenario[s.id] != null ? formatPercentile(row.meanModeledTCCPercentileByScenario[s.id]!) : '—'}
                          </TableCell>
                        ))}
                        {scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">
                            {row.meanWRVUPercentileByScenario[s.id] != null ? formatPercentile(row.meanWRVUPercentileByScenario[s.id]!) : '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
          {metric === 'percentile' && (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="px-3 py-2.5 font-medium">Specialty</TableHead>
                      {scenarios.map((s: ScenarioInfo) => (
                        <TableHead key={s.id} className="text-right px-3 py-2.5 font-medium" title={s.name}>wRVU %ile ({s.name})</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {comparison.bySpecialty.map((row: OptimizerComparisonSpecialtyRowN) => (
                      <TableRow key={row.specialty}>
                        <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                        {scenarios.map((s: ScenarioInfo) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {row.meanWRVUPercentileByScenario[s.id] != null ? formatPercentileForCard(row.meanWRVUPercentileByScenario[s.id]!) : '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export interface CompareScenariosContentProps {
  savedOptimizerConfigs: SavedOptimizerConfig[]
  initialScenarioAId?: string
  initialScenarioBId?: string
  /** Called when comparison changes (for export). */
  onComparisonChange?: (data: { comparison: OptimizerScenarioComparisonN; scenarioNames: string[] } | null) => void
}

export function CompareScenariosContent({
  savedOptimizerConfigs,
  initialScenarioAId = '',
  initialScenarioBId = '',
  onComparisonChange,
}: CompareScenariosContentProps) {
  const comparableConfigs = useMemo(
    () => savedOptimizerConfigs.filter(canCompareOptimizerConfig),
    [savedOptimizerConfigs]
  )

  const initialIds = useMemo(() => {
    const a = initialScenarioAId && comparableConfigs.some((c) => c.id === initialScenarioAId) ? initialScenarioAId : ''
    const b = initialScenarioBId && comparableConfigs.some((c) => c.id === initialScenarioBId) ? initialScenarioBId : ''
    if (a && b && a !== b) return [a, b]
    if (comparableConfigs.length >= 2) return comparableConfigs.slice(0, 2).map((c) => c.id)
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
      .map((id) => comparableConfigs.find((c) => c.id === id))
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
    return comparableConfigs.filter((c) => c.name.toLowerCase().includes(q))
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
      ? 'No saved optimizer scenarios yet. Run the CF Optimizer, then use Save scenario for each run you want to compare.'
      : totalSaved >= 2 && withRunResults < 2
        ? `You have ${totalSaved} saved scenario(s). Only scenarios saved after running the optimizer can be compared. Run the optimizer for each scenario you want, then Save scenario; return here to compare.${withRunResults > 0 ? ` (${withRunResults} of ${totalSaved} have run results.)` : ''}`
        : 'Save at least two scenarios after running the optimizer to compare them. Run the optimizer, then use "Save scenario" for each run you want to compare.'

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
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
          {/* Scenario selection — select 2 to 4 scenarios */}
          <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
              <span className={cn(iconBoxClass, 'size-8 [&_svg]:size-4')} aria-hidden>
                <GitCompare />
              </span>
              Scenarios
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Select 2 to {MAX_COMPARE_SCENARIOS} scenarios to compare ({selectedScenarioIds.length} selected).
            </p>
            <div className="relative mt-2 max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                placeholder="Search scenarios by name…"
                value={scenarioSearch}
                onChange={(e) => setScenarioSearch(e.target.value)}
                className="h-9 pl-8"
                aria-label="Search scenarios by name"
              />
            </div>
            {scenarioSearch.trim() && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Showing {filteredComparableConfigs.length} of {comparableConfigs.length} scenarios
              </p>
            )}
            <div className="mt-2 max-h-[280px] overflow-y-auto rounded-md border border-border/40 bg-background/50 p-1">
              {filteredComparableConfigs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {scenarioSearch.trim() ? 'No scenarios match your search. Try a different term.' : 'No scenarios available.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {filteredComparableConfigs.map((c) => (
                    <label
                      key={c.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors shrink-0',
                        selectedScenarioIds.includes(c.id)
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/60 bg-background hover:bg-muted/30'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScenarioIds.includes(c.id)}
                        onChange={() => toggleScenarioSelection(c.id)}
                        className="size-4 rounded border-border"
                        aria-label={`Toggle ${c.name}`}
                      />
                      <span className="font-medium">{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>

          {!hasSelection ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
              <span className={cn(iconBoxClass, 'size-10 [&_svg]:size-6')} aria-hidden>
                <GitCompare />
              </span>
              <p className="text-sm text-muted-foreground">
                Select 2 to {MAX_COMPARE_SCENARIOS} scenarios above to see the comparison.
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
              return (
            <>
              {/* At a glance — key numbers for exec review; cards are clickable to view breakdown */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('spend')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View spend change breakdown by specialty and provider"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <DollarSign />
                    </span>
                    {isTwo ? 'Spend change (B vs A)' : 'Total spend impact'}
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Change in total compensation spend
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 text-lg font-semibold tabular-nums',
                      deltaSpend > 0 && 'text-red-600 dark:text-red-400',
                      deltaSpend < 0 && 'text-emerald-600 dark:text-emerald-400',
                      deltaSpend === 0 && 'text-foreground'
                    )}
                  >
                    {isTwo && deltaSpend !== 0 ? formatCurrency(deltaSpend) : isTwo ? 'No change' : `${n} scenarios`}
                  </p>
                  {isTwo && deltaSpendPct != null && deltaSpend !== 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {deltaSpendPct > 0 ? '+' : ''}
                      {deltaSpendPct.toFixed(1)}% vs {comparison.scenarios[0].name}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">View breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">View by specialty →</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('alignment')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View specialties aligned breakdown"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <Target />
                    </span>
                    Specialties aligned
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Specialties where pay and productivity are aligned
                  </p>
                  <p className="mt-1.5 text-lg font-semibold tabular-nums text-foreground">
                    {comparison.scenarios.map((s: ScenarioInfo) => `${s.name}: ${comparison.rollup.countMeetingAlignmentTargetByScenario[s.id] ?? 0}`).join(' · ')}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">View breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">View by specialty →</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('alignment')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View mean TCC percentile (modeled) breakdown by specialty"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <BarChart2 />
                    </span>
                    Mean TCC percentile (modeled)
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Pay positioning after recommended CF — differs by scenario
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
                    {comparison.scenarios.map((s: ScenarioInfo) => `${s.name}: ${formatPercentileForCard(comparison.rollup.meanModeledTCCPercentileByScenario[s.id] ?? 0)}`).join(' · ')}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">View breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">View by specialty →</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('incentive')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View incentive change breakdown by specialty and provider"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <DollarSign />
                    </span>
                    {isTwo ? 'Incentive change (B vs A)' : 'Incentive (modeled)'}
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Change in work RVU incentive dollars
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 text-lg font-semibold tabular-nums',
                      deltaIncentive > 0 && 'text-red-600 dark:text-red-400',
                      deltaIncentive < 0 && 'text-emerald-600 dark:text-emerald-400',
                      deltaIncentive === 0 && 'text-foreground'
                    )}
                  >
                    {isTwo && deltaIncentive !== 0 ? formatCurrency(deltaIncentive) : isTwo ? 'No change' : `${n} scenarios`}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">View breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">View by specialty and provider →</span>
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
                            deltaSpend > 0 && 'text-red-600 dark:text-red-400',
                            deltaSpend < 0 && 'text-emerald-600 dark:text-emerald-400'
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
                            deltaIncentive > 0 && 'text-red-600 dark:text-red-400',
                            deltaIncentive < 0 && 'text-emerald-600 dark:text-emerald-400'
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
                                isOver && 'text-amber-600 dark:text-amber-400',
                                isUnder && 'text-emerald-600 dark:text-emerald-400',
                                over === 0 && 'text-emerald-600 dark:text-emerald-400'
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
