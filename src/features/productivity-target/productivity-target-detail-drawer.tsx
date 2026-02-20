import { useCallback, useState } from 'react'
import {
  Sheet,
  SheetContent,
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
  ProductivityTargetSpecialtyResult,
  ProviderTargetStatus,
} from '@/types/productivity-target'
import type { SpecialtyPercentiles } from '@/features/productivity-target/productivity-target-percentiles'
import { formatCurrency, formatNumber as formatNum } from '@/utils/format'

const DRAWER_WIDTH_MIN = 400
const DRAWER_WIDTH_MAX = 1000
const DRAWER_WIDTH_DEFAULT = 640

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
                <div className="min-h-[200px] max-h-[420px] overflow-auto rounded-lg border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                      <TableRow>
                        <TableHead className="px-3 py-2.5">Provider</TableHead>
                        <TableHead className="text-right px-3 py-2.5">cFTE</TableHead>
                        <TableHead className="text-right px-3 py-2.5">Actual wRVUs</TableHead>
                        <TableHead className="text-right px-3 py-2.5">Target</TableHead>
                        <TableHead className="text-right px-3 py-2.5">% to target</TableHead>
                        <TableHead className="text-right px-3 py-2.5">Variance</TableHead>
                        <TableHead className="px-3 py-2.5">Status</TableHead>
                        <TableHead className="text-right px-3 py-2.5">Potential incentive</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {row.providers.map((p) => (
                        <TableRow key={p.providerId}>
                          <TableCell className="font-medium px-3 py-2.5">
                            {p.providerName || p.providerId}
                          </TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">{formatNum(p.cFTE, 2)}</TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">{formatNum(p.actualWRVUs, 0)}</TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">{formatNum(p.rampedTargetWRVU, 0)}</TableCell>
                          <TableCell className={`text-right tabular-nums px-3 py-2.5 ${statusColorClass(p.status)}`}>
                            {formatNum(p.percentToTarget, 1)}%
                          </TableCell>
                          <TableCell className={`text-right tabular-nums px-3 py-2.5 ${statusColorClass(p.status)}`}>
                            {formatNum(p.varianceWRVU, 0)}
                          </TableCell>
                          <TableCell className={`px-3 py-2.5 ${statusColorClass(p.status)}`}>{p.status}</TableCell>
                          <TableCell className="text-right tabular-nums px-3 py-2.5">
                            {p.planningIncentiveDollars != null ? formatCurrency(p.planningIncentiveDollars, { decimals: 0 }) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
