import { useCallback, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type {
  ProductivityTargetSpecialtyResult,
  ProviderTargetStatus,
} from '@/types/productivity-target'
import type { SpecialtyPercentiles } from '@/features/productivity-target/productivity-target-percentiles'
import { formatCurrency, formatNumber as formatNum } from '@/utils/format'

const DRAWER_WIDTH_MIN = 400
const DRAWER_WIDTH_MAX = 1000
const DRAWER_WIDTH_DEFAULT = 640

// Same header row pattern as CF Optimizer drawer (ProviderDrilldownTable) so sticky works with native table
const PROVIDERS_TABLE_HEADER_ROW_CLASS =
  'border-b border-border/60 bg-muted [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-muted [&_th]:shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:text-foreground'

function statusColorClass(status: ProviderTargetStatus): string {
  switch (status) {
    case 'Above Target':
      return 'value-positive font-medium'
    case 'Below Target':
      return 'text-destructive font-medium'
    case 'At Target':
    default:
      return 'text-muted-foreground'
  }
}

export function ProductivityTargetDetailDrawer({
  row,
  open,
  onOpenChange,
  specialtyPercentiles,
}: {
  row: ProductivityTargetSpecialtyResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
  specialtyPercentiles?: Record<string, SpecialtyPercentiles>
}) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
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
            {row?.specialty ?? 'Specialty detail'}
          </SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          {row ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
                <p className="font-medium">
                  Group target (1.0 cFTE):{' '}
                  <span className="text-primary font-semibold tabular-nums">
                    {row.groupTargetWRVU_1cFTE != null ? formatNum(row.groupTargetWRVU_1cFTE, 0) : '—'}
                  </span>{' '}
                  wRVUs
                </p>
                <p className="mt-1 text-muted-foreground">
                  Approach {row.targetApproach === 'wrvu_percentile' ? 'A' : 'B'}
                  {row.targetApproach === 'wrvu_percentile'
                    ? ` at ${row.targetPercentile}th percentile`
                    : row.groupTargetWRVU_1cFTE != null
                      ? `: ${row.groupTargetWRVU_1cFTE.toLocaleString()} wRVU (at 1.0 cFTE, prorated)`
                      : ''}
                  . Target is scaled by each provider’s cFTE.
                </p>
                {specialtyPercentiles?.[row.specialty] ? (
                  <p className="mt-2 text-muted-foreground border-t border-border/60 pt-2">
                    Mean TCC %ile:{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatNum(specialtyPercentiles[row.specialty].meanTCCPercentile, 1)}
                    </span>
                    {' · '}
                    Mean wRVU %ile:{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatNum(specialtyPercentiles[row.specialty].meanWRVUPercentile, 1)}
                    </span>
                  </p>
                ) : null}
              </div>

              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                  How target is set
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Same wRVU target (at 1.0 cFTE) for everyone in the specialty; scaled by clinical FTE so part-time
                  effort is held to a fair proportion. This sets the productivity expectation only—it does not change
                  the conversion factor from the CF Optimizer.
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground/90">
                  Planning incentive = max(0, actual wRVUs − ramped target) × CF. Based on loaded wRVUs; for planning
                  only.
                </p>
              </section>

              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                  Providers ({row.providers.length})
                </h3>
                <div className="min-h-[240px] max-h-[420px] overflow-auto rounded-lg border border-border/60">
                  <table className="w-full caption-bottom text-sm border-collapse">
                    <thead>
                      <tr className={PROVIDERS_TABLE_HEADER_ROW_CLASS}>
                        <th className="min-w-[140px] px-3 py-2.5 text-left font-medium">Provider</th>
                        <th className="min-w-[72px] px-3 py-2.5 text-right font-medium">cFTE</th>
                        <th className="min-w-[80px] px-3 py-2.5 text-right font-medium">Actual wRVUs</th>
                        <th className="min-w-[80px] px-3 py-2.5 text-right font-medium">Target</th>
                        <th className="min-w-[80px] px-3 py-2.5 text-right font-medium">% to target</th>
                        <th className="min-w-[72px] px-3 py-2.5 text-right font-medium">Variance</th>
                        <th className="min-w-[100px] px-3 py-2.5 text-left font-medium">Status</th>
                        <th className="min-w-[100px] px-3 py-2.5 text-right font-medium">Potential incentive</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {row.providers.map((p, i) => {
                        const isOdd = i % 2 === 1
                        return (
                          <tr
                            key={p.providerId}
                            className={`border-b transition-colors ${isOdd ? 'bg-muted/30' : ''}`}
                          >
                            <td className="min-w-[140px] font-medium px-3 py-2.5 align-middle whitespace-nowrap">
                              {p.providerName || p.providerId}
                            </td>
                            <td className="min-w-[72px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5 align-middle">
                              {formatNum(p.cFTE, 2)}
                            </td>
                            <td className="min-w-[80px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5 align-middle">
                              {formatNum(p.actualWRVUs, 0)}
                            </td>
                            <td className="min-w-[80px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5 align-middle">
                              {formatNum(p.rampedTargetWRVU, 0)}
                            </td>
                            <td className={`min-w-[80px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5 align-middle ${statusColorClass(p.status)}`}>
                              {formatNum(p.percentToTarget, 1)}%
                            </td>
                            <td className={`min-w-[72px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5 align-middle ${statusColorClass(p.status)}`}>
                              {formatNum(p.varianceWRVU, 0)}
                            </td>
                            <td className={`min-w-[100px] px-3 py-2.5 align-middle whitespace-nowrap text-sm ${statusColorClass(p.status)}`}>
                              {p.status}
                            </td>
                            <td className="min-w-[100px] whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5 align-middle">
                              {p.planningIncentiveDollars != null ? formatCurrency(p.planningIncentiveDollars, { decimals: 0 }) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a specialty to view details.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
