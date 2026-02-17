import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart2, Building2, ChevronDown, ChevronRight, DollarSign, GitCompare, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  SavedProductivityTargetConfig,
  ProductivityTargetScenarioComparisonN,
  ProductivityTargetScenarioInfo,
  ProductivityTargetComparisonSpecialtyRowN,
} from '@/types/productivity-target'
import { MAX_COMPARE_TARGET_SCENARIOS } from '@/types/productivity-target'
import { iconBoxClass } from '@/components/section-title-with-icon'
import {
  canCompareProductivityTargetConfig,
  compareProductivityTargetScenariosN,
} from '@/lib/productivity-target-compare'

type TargetDrillDownMetric = 'incentive' | 'percentToTarget' | 'bands'

function TargetRollupDrillDownSheet({
  comparison,
  selectedConfigs,
  metric,
  onClose,
  expandedSpecialty,
  onToggleSpecialty,
  formatCurrency,
}: {
  comparison: ProductivityTargetScenarioComparisonN
  selectedConfigs: SavedProductivityTargetConfig[]
  metric: TargetDrillDownMetric
  onClose: () => void
  expandedSpecialty: string | null
  onToggleSpecialty: (specialty: string) => void
  formatCurrency: (value: number, decimals?: number) => string
}) {
  const scenarios = comparison.scenarios
  const isTwo = scenarios.length === 2

  const title =
    metric === 'incentive'
      ? isTwo
        ? 'Planning incentive — by specialty and provider'
        : 'Planning incentive by scenario — by specialty and provider'
      : metric === 'percentToTarget'
        ? 'Mean % to target — by specialty'
        : 'Provider bands (% to target) — by specialty'

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
      setDrawerWidth(Math.min(DRAWER_WIDTH_MAX, Math.max(DRAWER_WIDTH_MIN, startW + delta)))
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
          {metric === 'incentive' && (
            <SheetDescription className="text-sm text-muted-foreground leading-relaxed">
              Expand a specialty to see provider-level planning incentive.
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {metric === 'incentive' && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/5 px-3 py-2">
              <strong className="text-foreground">What you&apos;re seeing:</strong> Planning incentive (potential payout) by specialty. Each column is one scenario&apos;s total for that specialty. Expand a row to see each provider&apos;s planning incentive.
            </p>
          )}
          {metric === 'percentToTarget' && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/5 px-3 py-2">
              <strong className="text-foreground">What you&apos;re seeing:</strong> Average percent to target by specialty. 100% = at target; below 100% = under target; above 100% = over target.
            </p>
          )}
          {metric === 'bands' && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/5 px-3 py-2">
              <strong className="text-foreground">What you&apos;re seeing:</strong> Count of providers in each band: below 80%, 80–99%, 100–119%, at or above 120% of their target. Use this to compare how many providers fall in each performance band across scenarios.
            </p>
          )}
          {metric === 'incentive' && (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="w-[200px] px-3 py-2.5 font-medium">Specialty</TableHead>
                      {scenarios.map((s) => (
                        <TableHead key={s.id} className="min-w-[90px] max-w-[180px] text-right px-3 py-2.5 font-medium" title={s.name}>
                          <span className="break-words whitespace-normal inline-block text-right">Incentive ({s.name})</span>
                        </TableHead>
                      ))}
                      {isTwo && <TableHead className="text-right px-3 py-2.5 font-medium">Δ</TableHead>}
                      <TableHead className="w-8 px-3 py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {comparison.bySpecialty.map((row: ProductivityTargetComparisonSpecialtyRowN) => (
                      <Fragment key={row.specialty}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          role="button"
                          tabIndex={0}
                          onClick={() => onToggleSpecialty(row.specialty)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onToggleSpecialty(row.specialty)
                            }
                          }}
                          aria-label={
                            expandedSpecialty === row.specialty
                              ? `Collapse ${row.specialty}`
                              : `Expand ${row.specialty} to see provider-level planning incentive`
                          }
                        >
                          <TableCell className="font-medium text-primary cursor-pointer hover:underline hover:text-primary/90 px-3 py-2.5">
                            {row.specialty}
                          </TableCell>
                          {scenarios.map((s) => (
                            <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                              {row.planningIncentiveByScenario[s.id] != null
                                ? formatCurrency(row.planningIncentiveByScenario[s.id]!)
                                : '—'}
                            </TableCell>
                          ))}
                          {isTwo && (
                            <TableCell className="text-right tabular-nums px-3 py-2.5">
                              {row.planningIncentiveByScenario[scenarios[1].id] != null &&
                              row.planningIncentiveByScenario[scenarios[0].id] != null
                                ? formatCurrency(
                                    row.planningIncentiveByScenario[scenarios[1].id]! -
                                      row.planningIncentiveByScenario[scenarios[0].id]!
                                  )
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
                        {expandedSpecialty === row.specialty &&
                          (() => {
                            const results = selectedConfigs
                              .map((c) => c.snapshot?.lastRunResult)
                              .filter(Boolean)
                            if (results.length === 0) return null
                            const byConfig = results.map((r) =>
                              r!.bySpecialty.find((s) => s.specialty === row.specialty)
                            )
                            const incentiveByConfig = byConfig.map((spec) =>
                              new Map(
                                (spec?.providers ?? []).map((p) => [p.providerId, p.planningIncentiveDollars ?? 0])
                              )
                            )
                            const nameMaps = byConfig.map((spec) =>
                              new Map(
                                (spec?.providers ?? []).map((p) => [p.providerId, p.providerName ?? p.providerId])
                              )
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
                                {isTwo && (
                                  <TableCell className="text-right tabular-nums text-xs px-3 py-2.5">
                                    {formatCurrency(
                                      (incentiveByConfig[1]?.get(id) ?? 0) - (incentiveByConfig[0]?.get(id) ?? 0)
                                    )}
                                  </TableCell>
                                )}
                                <TableCell className="px-3 py-2.5" />
                              </TableRow>
                            ))
                          })()}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
          {metric === 'percentToTarget' && (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="w-[200px] px-3 py-2.5 font-medium">Specialty</TableHead>
                      {scenarios.map((s) => (
                        <TableHead key={s.id} className="min-w-[90px] max-w-[180px] text-right px-3 py-2.5 font-medium" title={s.name}>
                          <span className="break-words whitespace-normal inline-block text-right">Mean % to target ({s.name})</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {comparison.bySpecialty.map((row: ProductivityTargetComparisonSpecialtyRowN) => (
                      <TableRow key={row.specialty}>
                        <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                        {scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {row.meanPercentToTargetByScenario[s.id] != null
                              ? `${row.meanPercentToTargetByScenario[s.id]!.toFixed(1)}%`
                              : '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
          {metric === 'bands' && (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="w-[200px] px-3 py-2.5 font-medium">Specialty</TableHead>
                      {scenarios.map((s) => (
                        <TableHead key={s.id} className="min-w-[80px] max-w-[160px] text-right px-3 py-2.5 font-medium" title={s.name}>
                          <span className="break-words whitespace-normal inline-block text-right">Below 80% ({s.name})</span>
                        </TableHead>
                      ))}
                      {scenarios.map((s) => (
                        <TableHead key={`80-${s.id}`} className="min-w-[80px] max-w-[160px] text-right px-3 py-2.5 font-medium" title={s.name}>
                          <span className="break-words whitespace-normal inline-block text-right">80–99% ({s.name})</span>
                        </TableHead>
                      ))}
                      {scenarios.map((s) => (
                        <TableHead key={`100-${s.id}`} className="min-w-[80px] max-w-[160px] text-right px-3 py-2.5 font-medium" title={s.name}>
                          <span className="break-words whitespace-normal inline-block text-right">100–119% ({s.name})</span>
                        </TableHead>
                      ))}
                      {scenarios.map((s) => (
                        <TableHead key={`120-${s.id}`} className="min-w-[80px] max-w-[160px] text-right px-3 py-2.5 font-medium" title={s.name}>
                          <span className="break-words whitespace-normal inline-block text-right">120%+ ({s.name})</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {comparison.bySpecialty.map((row: ProductivityTargetComparisonSpecialtyRowN) => (
                      <TableRow key={row.specialty}>
                        <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                        {scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {row.below80ByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                        {scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {row.eightyTo99ByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                        {scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {row.hundredTo119ByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                        {scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {row.atOrAbove120ByScenario[s.id] ?? 0}
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

function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export interface CompareTargetScenariosContentProps {
  savedProductivityTargetConfigs: SavedProductivityTargetConfig[]
  initialScenarioIds?: string[]
  /** Called when comparison changes (for export). */
  onComparisonChange?: (data: {
    comparison: ProductivityTargetScenarioComparisonN
    scenarioNames: string[]
  } | null) => void
}

export function CompareTargetScenariosContent({
  savedProductivityTargetConfigs,
  initialScenarioIds = [],
  onComparisonChange,
}: CompareTargetScenariosContentProps) {
  const comparableConfigs = useMemo(
    () => savedProductivityTargetConfigs.filter(canCompareProductivityTargetConfig),
    [savedProductivityTargetConfigs]
  )

  const initialIds = useMemo(() => {
    if (initialScenarioIds.length >= 2) {
      const valid = initialScenarioIds.filter((id) =>
        comparableConfigs.some((c) => c.id === id)
      )
      if (valid.length >= 2) return valid.slice(0, MAX_COMPARE_TARGET_SCENARIOS)
    }
    if (comparableConfigs.length >= 2) {
      return comparableConfigs.slice(0, 2).map((c) => c.id)
    }
    return []
  }, [initialScenarioIds, comparableConfigs])

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
      return next.length <= MAX_COMPARE_TARGET_SCENARIOS ? next : prev
    })
  }, [])

  const selectedConfigs = useMemo(
    () =>
      selectedScenarioIds
        .map((id) => comparableConfigs.find((c) => c.id === id))
        .filter((c): c is SavedProductivityTargetConfig => c != null),
    [comparableConfigs, selectedScenarioIds]
  )

  const comparison = useMemo(() => {
    if (selectedConfigs.length < 2) return null
    return compareProductivityTargetScenariosN(selectedConfigs)
  }, [selectedConfigs])

  const [drillDownMetric, setDrillDownMetric] = useState<TargetDrillDownMetric | null>(null)
  const [expandedSpecialty, setExpandedSpecialty] = useState<string | null>(null)

  const [scenarioSearch, setScenarioSearch] = useState('')
  const filteredComparableConfigs = useMemo(() => {
    const q = scenarioSearch.trim().toLowerCase()
    if (!q) return comparableConfigs
    return comparableConfigs.filter((c) => c.name.toLowerCase().includes(q))
  }, [comparableConfigs, scenarioSearch])

  const canCompare = comparableConfigs.length >= 2
  const hasSelection = selectedScenarioIds.length >= 2
  const totalSaved = savedProductivityTargetConfigs.length
  const withRunResults = comparableConfigs.length

  useEffect(() => {
    onComparisonChange?.(
      comparison && hasSelection
        ? {
            comparison,
            scenarioNames: comparison.scenarios.map((s: ProductivityTargetScenarioInfo) => s.name),
          }
        : null
    )
  }, [comparison, hasSelection, onComparisonChange])

  const emptyStateMessage =
    totalSaved === 0
      ? 'No saved scenarios. Run Target Optimizer, then Save scenario to compare.'
      : totalSaved >= 2 && withRunResults < 2
        ? `Save scenarios after running. ${withRunResults} of ${totalSaved} ready to compare.`
        : 'Run Target Optimizer, save 2+ scenarios, then compare here.'

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      <>
        {!canCompare ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <span className={cn(iconBoxClass, 'size-12 [&_svg]:size-8')} aria-hidden>
              <GitCompare />
            </span>
            <p className="text-sm text-muted-foreground">{emptyStateMessage}</p>
          </div>
        ) : (
          <>
          {/* Scenario selection — single dropdown multi-select with search */}
          <section className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
                <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                  <GitCompare />
                </span>
                Scenarios
                <span className="text-xs font-normal normal-case text-muted-foreground">
                  2–{MAX_COMPARE_TARGET_SCENARIOS} to compare
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
                      filteredComparableConfigs.map((c) => (
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
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4 text-center">
              <span className={cn(iconBoxClass, 'size-9 [&_svg]:size-5')} aria-hidden>
                <GitCompare />
              </span>
              <p className="text-sm text-muted-foreground">
                Pick 2+ scenarios above.
              </p>
            </div>
          ) : comparison ? (() => {
              const scenarioLabels =
                comparison.scenarios.length === 2
                  ? ['A', 'B']
                  : comparison.scenarios.map((_, i) => String(i + 1))
              return (
            <>
              {/* Legend: which scenario is A vs B (order = selection order in dropdown) */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                <span className="font-medium text-muted-foreground uppercase tracking-wider">In this view:</span>
                {comparison.scenarios.map((s, i) => (
                  <span key={s.id} className="text-foreground shrink-0" title={s.name}>
                    <strong className="tabular-nums text-foreground">{scenarioLabels[i]}</strong>
                    <span className="text-muted-foreground"> = </span>
                    <span className="break-words">{s.name}</span>
                  </span>
                ))}
              </div>

              {/* At a glance — rollup cards; short labels (A/B) to condense scenario names */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('incentive')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View planning incentive breakdown by specialty and provider"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <DollarSign />
                    </span>
                    Total planning incentive
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Sum by specialty
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground space-y-0.5">
                    {comparison.scenarios.map((s, i) => (
                      <span key={s.id} className="block" title={s.name}>
                        {scenarioLabels[i]}: {formatCurrency(comparison.rollup.totalPlanningIncentiveByScenario[s.id] ?? 0)}
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
                  onClick={() => setDrillDownMetric('percentToTarget')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View mean % to target breakdown by specialty"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <Target />
                    </span>
                    Mean % to target
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Avg % to target
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground space-y-0.5">
                    {comparison.scenarios.map((s, i) => (
                      <span key={s.id} className="block" title={s.name}>
                        {scenarioLabels[i]}: {(comparison.rollup.meanPercentToTargetByScenario[s.id] ?? 0).toFixed(1)}%
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
                  onClick={() => setDrillDownMetric('bands')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View provider bands breakdown by specialty"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <BarChart2 />
                    </span>
                    Below 80%
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    Under 80%
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground space-y-0.5">
                    {comparison.scenarios.map((s, i) => (
                      <span key={s.id} className="block" title={s.name}>
                        {scenarioLabels[i]}: {comparison.rollup.below80ByScenario[s.id] ?? 0}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">Breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">Bands by specialty →</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDownMetric('bands')}
                  className="rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm text-left hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group"
                  aria-label="View provider bands breakdown by specialty"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span className={cn(iconBoxClass, 'size-7 [&_svg]:size-3.5')} aria-hidden>
                      <BarChart2 />
                    </span>
                    At/above 120%
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-70 ml-auto shrink-0" aria-hidden />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground normal-case">
                    At/above 120%
                  </p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground space-y-0.5">
                    {comparison.scenarios.map((s, i) => (
                      <span key={s.id} className="block" title={s.name}>
                        {scenarioLabels[i]}: {comparison.rollup.atOrAbove120ByScenario[s.id] ?? 0}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="group-hover:hidden">Breakdown</span>
                    <span className="hidden group-hover:inline group-hover:text-primary group-hover:underline">Bands by specialty →</span>
                  </p>
                </button>
              </div>

              {/* Roll-up metrics table */}
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
                        {comparison.scenarios.map((s) => (
                          <TableHead
                            key={s.id}
                            className="min-w-[100px] max-w-[200px] text-right px-3 py-2.5 font-medium"
                            title={s.name}
                          >
                            <span
                              className="font-normal text-muted-foreground break-words whitespace-normal inline-block align-bottom text-right"
                              title={s.name}
                            >
                              {s.name}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      <TableRow className="bg-muted/20">
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          Target percentile
                        </TableCell>
                        {comparison.scenarios.map((s) => {
                          const pct = comparison.rollup.targetPercentileByScenario[s.id]
                          return (
                            <TableCell
                              key={s.id}
                              className="text-right tabular-nums px-3 py-2.5"
                              title="Percentile used to set group wRVU target per specialty"
                            >
                              {pct != null ? `${pct}th` : '—'}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow className="bg-muted/20">
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          Target approach
                        </TableCell>
                        {comparison.scenarios.map((s) => (
                          <TableCell
                            key={s.id}
                            className="text-right text-muted-foreground px-3 py-2.5"
                          >
                            {comparison.rollup.targetApproachByScenario[s.id] ?? '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('incentive')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDrillDownMetric('incentive')
                          }
                        }}
                        aria-label="View planning incentive breakdown by specialty and provider"
                      >
                        <TableCell className="px-3 py-2.5 font-medium text-primary cursor-pointer hover:underline hover:text-primary/90">
                          Total planning incentive
                        </TableCell>
                        {comparison.scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {formatCurrency(
                              comparison.rollup.totalPlanningIncentiveByScenario[s.id] ?? 0
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow
                        className="bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('percentToTarget')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDrillDownMetric('percentToTarget')
                          }
                        }}
                        aria-label="View mean % to target breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5 font-medium text-primary cursor-pointer hover:underline hover:text-primary/90">
                          Mean % to target
                        </TableCell>
                        {comparison.scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {(comparison.rollup.meanPercentToTargetByScenario[s.id] ?? 0).toFixed(
                              1
                            )}
                            %
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('bands')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDrillDownMetric('bands')
                          }
                        }}
                        aria-label="View provider bands breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          Below 80%
                        </TableCell>
                        {comparison.scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {comparison.rollup.below80ByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow
                        className="bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('bands')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDrillDownMetric('bands')
                          }
                        }}
                        aria-label="View provider bands breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          80–99%
                        </TableCell>
                        {comparison.scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {comparison.rollup.eightyTo99ByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('bands')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDrillDownMetric('bands')
                          }
                        }}
                        aria-label="View provider bands breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          100–119%
                        </TableCell>
                        {comparison.scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {comparison.rollup.hundredTo119ByScenario[s.id] ?? 0}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow
                        className="bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrillDownMetric('bands')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDrillDownMetric('bands')
                          }
                        }}
                        aria-label="View provider bands breakdown by specialty"
                      >
                        <TableCell className="px-3 py-2.5 font-medium text-muted-foreground">
                          At or above 120%
                        </TableCell>
                        {comparison.scenarios.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                            {comparison.rollup.atOrAbove120ByScenario[s.id] ?? 0}
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
                <div className="overflow-auto rounded-lg border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border/60 [&_th]:text-foreground">
                      <TableRow>
                        <TableHead className="min-w-[100px] px-3 py-2.5 font-medium">
                          Specialty
                        </TableHead>
                        <TableHead className="min-w-[70px] text-right px-3 py-2.5 font-medium">
                          Presence
                        </TableHead>
                        {comparison.scenarios.map((s) => (
                          <TableHead
                            key={s.id}
                            className="min-w-[70px] text-right px-3 py-2.5 font-medium"
                            title={s.name}
                          >
                            Group target ({s.name})
                          </TableHead>
                        ))}
                        {comparison.scenarios.map((s) => (
                          <TableHead
                            key={`inc-${s.id}`}
                            className="min-w-[90px] text-right px-3 py-2.5 font-medium"
                            title={s.name}
                          >
                            Incentive ({s.name})
                          </TableHead>
                        ))}
                        {comparison.scenarios.map((s) => (
                          <TableHead
                            key={`pct-${s.id}`}
                            className="min-w-[72px] text-right px-3 py-2.5 font-medium"
                            title={s.name}
                          >
                            Mean % to target ({s.name})
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      {comparison.bySpecialty.map((row, index) => {
                        const presenceLabel =
                          row.scenarioIds.length === comparison.scenarios.length
                            ? 'All'
                            : comparison.scenarios
                                .filter((s) => row.scenarioIds.includes(s.id))
                                .map((s) => s.name)
                                .join(', ')
                        return (
                          <TableRow
                            key={row.specialty}
                            className={cn(index % 2 === 1 && 'bg-muted/30')}
                          >
                            <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                            <TableCell
                              className="text-right text-muted-foreground px-3 py-2.5"
                              title={
                                row.scenarioIds.length < comparison.scenarios.length
                                  ? `Present in: ${presenceLabel}`
                                  : undefined
                              }
                            >
                              {presenceLabel}
                            </TableCell>
                            {comparison.scenarios.map((s) => (
                              <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                                {row.groupTargetWRVUByScenario[s.id] != null
                                  ? row.groupTargetWRVUByScenario[s.id]!.toFixed(0)
                                  : '—'}
                              </TableCell>
                            ))}
                            {comparison.scenarios.map((s) => (
                              <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                                {row.planningIncentiveByScenario[s.id] != null
                                  ? formatCurrency(row.planningIncentiveByScenario[s.id]!)
                                  : '—'}
                              </TableCell>
                            ))}
                            {comparison.scenarios.map((s) => (
                              <TableCell key={s.id} className="text-right tabular-nums px-3 py-2.5">
                                {row.meanPercentToTargetByScenario[s.id] != null
                                  ? `${row.meanPercentToTargetByScenario[s.id]!.toFixed(1)}%`
                                  : '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>

              {/* Drill-down sidebar: rollup metrics breakdown by specialty (and by provider for incentive) */}
              {drillDownMetric && comparison && (
                <TargetRollupDrillDownSheet
                  comparison={comparison}
                  selectedConfigs={selectedConfigs}
                  metric={drillDownMetric}
                  onClose={() => {
                    setDrillDownMetric(null)
                    setExpandedSpecialty(null)
                  }}
                  expandedSpecialty={expandedSpecialty}
                  onToggleSpecialty={(s) =>
                    setExpandedSpecialty((prev) => (prev === s ? null : s))
                  }
                  formatCurrency={formatCurrency}
                />
              )}
            </>
        ) })() : null}
        </>
      )}
    </>
    </div>
  )
}
