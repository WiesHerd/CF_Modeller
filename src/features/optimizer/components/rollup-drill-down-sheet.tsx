import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import type {
  SavedOptimizerConfig,
  OptimizerScenarioComparisonN,
  ScenarioInfo,
} from '@/types/optimizer'

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
export function RollupDrillDownSheet({
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

