import { useCallback, useMemo, useState } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
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
import type { OptimizerProviderContext, OptimizerSpecialtyResult } from '@/types/optimizer'
import type { MarketRow } from '@/types/market'
import {
  EXCLUSION_REASON_LABELS,
  formatPercentile,
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
} from '@/features/optimizer/components/optimizer-constants'
import { ExclusionChip } from '@/features/optimizer/components/constraint-chip'
import { MarketCFRuler } from '@/features/optimizer/components/market-cf-line'
import { MarketPositioningCalculationDrawer } from '@/features/optimizer/components/market-positioning-calculation-drawer'
import { matchMarketRow } from '@/lib/batch'
import { getOptimizerBaselineTCCConfig } from '@/lib/optimizer-engine'
import { getBaselineTCCBreakdown, getClinicalFTE, getTotalWRVUs } from '@/lib/normalize-compensation'
import type { OptimizerSettings } from '@/types/optimizer'
import type { ImputedVsMarketProviderDetail } from '@/lib/imputed-vs-market'

function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

const RECOMMENDATION_LABEL: Record<string, string> = {
  INCREASE: 'Increase',
  DECREASE: 'Decrease',
  HOLD: 'Hold',
  NO_RECOMMENDATION: 'No recommendation',
}

const GAP_PILL_CLASS: Record<string, string> = {
  overpaid: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  underpaid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  aligned: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
}

const DRAWER_WIDTH_MIN = 400
const DRAWER_WIDTH_MAX = 1100
const DRAWER_WIDTH_DEFAULT = 680

export function OptimizerDetailDrawer({
  row,
  open,
  onOpenChange,
  settings,
  marketRows = [],
  synonymMap = {},
}: {
  row: OptimizerSpecialtyResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
  settings?: OptimizerSettings | null
  marketRows?: MarketRow[]
  synonymMap?: Record<string, string>
}) {
  const [drawerWidth, setDrawerWidth] = useState(DRAWER_WIDTH_DEFAULT)
  const [selectedProviderContext, setSelectedProviderContext] = useState<OptimizerProviderContext | null>(null)

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

  const providerDetailForDrawer = useMemo((): ImputedVsMarketProviderDetail | null => {
    if (!selectedProviderContext || !row || !settings || marketRows.length === 0) return null
    const ctx = selectedProviderContext
    const provider = ctx.provider
    const match = matchMarketRow(provider, marketRows, synonymMap)
    const market = match.marketRow
    if (!market) return null
    const config = getOptimizerBaselineTCCConfig(settings, provider, row.currentCF)
    const breakdown = getBaselineTCCBreakdown(provider, config)
    const cFTE = getClinicalFTE(provider)
    const totalWRVUs = getTotalWRVUs(provider)
    const imputed =
      totalWRVUs > 0 && cFTE > 0 ? ctx.currentTCCBaseline / (totalWRVUs / cFTE) : 0
    return {
      providerId: ctx.providerId,
      providerName: (provider.providerName ?? ctx.providerId).toString(),
      division: (provider.division ?? '').toString().trim() || '—',
      providerType: (provider.providerType ?? '').toString().trim() || '—',
      cFTE,
      totalWRVUs,
      wRVU_1p0: ctx.wRVU_1p0,
      baselineTCC: ctx.currentTCCBaseline,
      currentCFUsed: row.currentCF,
      imputedDollarPerWRVU: imputed,
      clinicalBase: breakdown.clinicalBase,
      psq: breakdown.psq,
      quality: breakdown.quality,
      workRVUIncentive: breakdown.workRVUIncentive,
      otherIncentives: breakdown.otherIncentives,
      stipend: breakdown.stipend,
      additionalTCC: breakdown.additionalTCC,
      tccPercentile: ctx.currentTCC_pctile,
      tccPercentileBelowRange: ctx.currentTCC_pctile < 25,
      tccPercentileAboveRange: ctx.currentTCC_pctile > 90,
      wrvuPercentile: ctx.wrvuPercentile,
      wrvuPercentileBelowRange: ctx.wrvuPercentile < 25,
      wrvuPercentileAboveRange: ctx.wrvuPercentile > 90,
      marketTCC_25: market.TCC_25,
      marketTCC_50: market.TCC_50,
      marketTCC_75: market.TCC_75,
      marketTCC_90: market.TCC_90,
      marketWRVU_25: market.WRVU_25,
      marketWRVU_50: market.WRVU_50,
      marketWRVU_75: market.WRVU_75,
      marketWRVU_90: market.WRVU_90,
    }
  }, [selectedProviderContext, row, settings, marketRows, synonymMap])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setSelectedProviderContext(null)
      onOpenChange(next)
    },
    [onOpenChange]
  )

  if (!row) return null

  const divisions = [
    ...new Set(
      row.providerContexts.map((c) => (c.provider.division ?? '').trim()).filter(Boolean)
    ),
  ].join(', ')
  const gapInterpretation = getGapInterpretation(row.keyMetrics.gap)
  const included = row.providerContexts.filter((c) => c.included)
  const nIncluded = included.length
  const modeledCompPercentile =
    nIncluded > 0
      ? included.reduce((s, c) => s + (c.modeledTCC_pctile ?? 0), 0) / nIncluded
      : row.keyMetrics.prodPercentile + row.postGap
  const postGapInterpretation = getGapInterpretation(row.postGap)
  const recLabel = RECOMMENDATION_LABEL[row.recommendedAction] ?? row.recommendedAction
  const RecIcon =
    row.recommendedAction === 'INCREASE'
      ? TrendingUp
      : row.recommendedAction === 'DECREASE'
        ? TrendingDown
        : Minus

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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
        <SheetHeader className="px-6 pt-6 pb-2 border-b border-border gap-2">
          <SheetTitle className="pr-8 text-xl font-semibold tracking-tight text-foreground">
            {row.specialty}
          </SheetTitle>
          {divisions ? (
            <SheetDescription className="text-sm text-muted-foreground leading-relaxed">
              {divisions}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className={`rounded-xl border px-4 py-3 ${GAP_PILL_CLASS[gapInterpretation] ?? GAP_PILL_CLASS.aligned}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                Pay vs productivity
              </p>
              <p className="mt-1 font-semibold">{GAP_INTERPRETATION_LABEL[gapInterpretation]}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                TCC {formatPercentile(row.keyMetrics.compPercentile)} · wRVU{' '}
                {formatPercentile(row.keyMetrics.prodPercentile)}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recommendation
              </p>
              <p className="mt-1 flex items-center gap-2 font-semibold">
                <RecIcon className="size-4 shrink-0" />
                {recLabel}
                {row.cfChangePct !== 0 && (
                  <span
                    className={
                      row.cfChangePct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    ({row.cfChangePct >= 0 ? '+' : ''}{row.cfChangePct.toFixed(1)}%)
                  </span>
                )}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                ${row.currentCF.toFixed(2)} → ${row.recommendedCF.toFixed(2)}
              </p>
            </div>
          </div>

          {/* After adjustment: post-CF TCC vs wRVU so user can verify alignment */}
          {(row.recommendedAction === 'INCREASE' || row.recommendedAction === 'DECREASE') &&
            nIncluded > 0 && (
              <div
                className={`rounded-xl border px-4 py-3 ${GAP_PILL_CLASS[postGapInterpretation] ?? GAP_PILL_CLASS.aligned}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                  After adjustment
                </p>
                <p className="mt-1 font-semibold">
                  {GAP_INTERPRETATION_LABEL[postGapInterpretation]} vs productivity
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  TCC {formatPercentile(modeledCompPercentile)} · wRVU{' '}
                  {formatPercentile(row.keyMetrics.prodPercentile)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/90">
                  If you apply the recommended CF, group TCC percentile moves to align with wRVU
                  percentile. Review provider drilldown for outliers before finalizing.
                </p>
              </div>
            )}

          {/* Why / evidence */}
          {(row.explanation.why.length > 0 || row.explanation.whatToDoNext.length > 0) ? (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                Why & next steps
              </h3>
              <div className="border-l-4 border-primary/60 pl-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Why
                </h4>
                {row.explanation.why.length > 0 ? (
                  <ul className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/90">
                    {row.explanation.why.map((bullet, idx) => (
                      <li key={idx} className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:size-1 before:rounded-full before:bg-primary/60">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {row.explanation.whatToDoNext.length > 0 ? (
                  <>
                    <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Next steps
                    </h4>
                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                      {row.explanation.whatToDoNext.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="shrink-0 text-primary/70">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Market CF */}
          {row.marketCF ? (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                Market CF position
              </h3>
              <div className="mt-3">
                <MarketCFRuler
                  currentCF={row.currentCF}
                  recommendedCF={row.recommendedCF}
                  marketCF={row.marketCF}
                  cfPercentile={row.cfPolicyPercentile}
                />
              </div>
            </section>
          ) : null}

          {/* Work RVU incentive (what we're calculating) */}
          {row.providerContexts.some(
            (c) => c.included && (c.baselineIncentiveDollars != null || c.modeledIncentiveDollars != null)
          ) ? (
            <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                Work RVU incentive (what we're calculating)
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                At <strong>current CF</strong> ({formatCurrency(row.currentCF)}): total incentive across included
                providers. At <strong>recommended CF</strong> ({formatCurrency(row.recommendedCF)}): incentive if you
                apply the recommendation. See provider table for per-provider amounts.
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span>
                  Current CF incentive:{' '}
                  <strong className="tabular-nums">
                    {formatCurrency(
                      row.providerContexts
                        .filter((c) => c.included)
                        .reduce((s, c) => s + (c.baselineIncentiveDollars ?? 0), 0),
                      0
                    )}
                  </strong>
                </span>
                <span>
                  Modeled (recommended) incentive:{' '}
                  <strong className="tabular-nums">
                    {formatCurrency(
                      row.providerContexts
                        .filter((c) => c.included)
                        .reduce((s, c) => s + (c.modeledIncentiveDollars ?? 0), 0),
                      0
                    )}
                  </strong>
                </span>
              </div>
            </section>
          ) : null}

          {/* Providers — sticky header so column headers stay visible when scrolling */}
          <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
              Providers ({row.providerContexts.length})
            </h3>
            <div className="min-h-[240px] max-h-[420px] overflow-auto rounded-lg border border-border/60">
              <ProviderDrilldownTable
                row={row}
                onSelectProvider={settings && marketRows ? setSelectedProviderContext : undefined}
              />
            </div>
          </section>
        </div>
      </SheetContent>

      {providerDetailForDrawer ? (
        <MarketPositioningCalculationDrawer
          open={!!selectedProviderContext}
          onOpenChange={(next) => !next && setSelectedProviderContext(null)}
          onBack={() => setSelectedProviderContext(null)}
          provider={providerDetailForDrawer}
          specialtyLabel={row.specialty}
        />
      ) : null}
    </Sheet>
  )
}

function ProviderDrilldownTable({
  row,
  onSelectProvider,
}: {
  row: OptimizerSpecialtyResult
  onSelectProvider?: (ctx: OptimizerProviderContext) => void
}) {
  return (
    <Table className="w-full caption-bottom text-sm">
      <TableHeader className="border-b border-border/60 [&_th]:text-foreground">
        <TableRow className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-muted [&_th]:shadow-[0_1px_0_0_hsl(var(--border))]">
          <TableHead className="min-w-[140px] px-3 py-2.5 font-medium">Provider</TableHead>
          <TableHead className="min-w-[100px] px-3 py-2.5 font-medium">Division</TableHead>
          <TableHead className="min-w-[100px] px-3 py-2.5 font-medium">Type / Role</TableHead>
          <TableHead className="min-w-[88px] text-right px-3 py-2.5 font-medium">wRVU %</TableHead>
          <TableHead className="min-w-[100px] text-right px-3 py-2.5 font-medium">TCC %</TableHead>
          <TableHead className="min-w-[72px] text-right px-3 py-2.5 font-medium">Gap</TableHead>
          <TableHead className="min-w-[80px] text-right px-3 py-2.5 font-medium">Incentive (current)</TableHead>
          <TableHead className="min-w-[80px] text-right px-3 py-2.5 font-medium">Incentive (modeled)</TableHead>
          <TableHead className="min-w-[72px] px-3 py-2.5 font-medium">Included</TableHead>
          <TableHead className="min-w-[140px] px-3 py-2.5 font-medium">Reasons</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {row.providerContexts.map((ctx, i) => (
          <TableRow
            key={ctx.providerId}
            className={`${i % 2 === 1 ? 'bg-muted/30' : ''} ${onSelectProvider ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
            onClick={onSelectProvider ? () => onSelectProvider(ctx) : undefined}
          >
            <TableCell className="min-w-[140px] font-medium px-3 py-2.5">
              <span
                className={
                  onSelectProvider
                    ? 'text-primary cursor-pointer hover:underline hover:text-primary/90'
                    : ''
                }
              >
                {ctx.provider.providerName ?? ctx.providerId}
              </span>
            </TableCell>
            <TableCell className="min-w-[100px] text-muted-foreground px-3 py-2.5">
              {ctx.provider.division ?? '—'}
            </TableCell>
            <TableCell className="min-w-[100px] text-muted-foreground px-3 py-2.5">
              {ctx.provider.providerType ?? '—'}
            </TableCell>
            <TableCell className="min-w-[88px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5">
              {formatPercentile(ctx.wrvuPercentile)}
            </TableCell>
            <TableCell className="min-w-[100px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5">
              {formatPercentile(ctx.currentTCC_pctile)}
            </TableCell>
            <TableCell className="min-w-[72px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5">
              {formatPercentile(ctx.baselineGap)}
            </TableCell>
            <TableCell className="min-w-[80px] whitespace-nowrap text-right tabular-nums text-sm text-muted-foreground px-3 py-2.5">
              {ctx.baselineIncentiveDollars != null ? formatCurrency(ctx.baselineIncentiveDollars, 0) : '—'}
            </TableCell>
            <TableCell className="min-w-[80px] whitespace-nowrap text-right tabular-nums text-sm text-muted-foreground px-3 py-2.5">
              {ctx.modeledIncentiveDollars != null ? formatCurrency(ctx.modeledIncentiveDollars, 0) : '—'}
            </TableCell>
            <TableCell className="min-w-[72px] text-sm px-3 py-2.5">
              {ctx.included ? 'Yes' : 'No'}
            </TableCell>
            <TableCell className="min-w-[140px] px-3 py-2.5">
              <div className="flex flex-wrap gap-1">
                {ctx.exclusionReasons.map((reason) => (
                  <ExclusionChip
                    key={reason}
                    label={EXCLUSION_REASON_LABELS[reason] ?? reason}
                  />
                ))}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
