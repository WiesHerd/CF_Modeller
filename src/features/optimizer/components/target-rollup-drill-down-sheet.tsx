import React, { useCallback, Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  ProductivityTargetComparisonSpecialtyRowN,
} from '@/types/productivity-target'
export type TargetDrillDownMetric = 'incentive' | 'percentToTarget' | 'bands'

export function TargetRollupDrillDownSheet({
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

export interface CompareTargetScenariosContentProps {
  savedProductivityTargetConfigs: SavedProductivityTargetConfig[]
  initialScenarioIds?: string[]
  /** Called when comparison changes (for export). */
  onComparisonChange?: (data: {
    comparison: ProductivityTargetScenarioComparisonN
    scenarioNames: string[]
  } | null) => void
}
