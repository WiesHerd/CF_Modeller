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

const DRAWER_WIDTH_MIN = 400
const DRAWER_WIDTH_MAX = 1000
const DRAWER_WIDTH_DEFAULT = 640

function formatNum(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function statusColorClass(status: ProviderTargetStatus): string {
  switch (status) {
    case 'Above Target':
      return 'text-emerald-600 dark:text-emerald-400 font-medium'
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
}: {
  row: ProductivityTargetSpecialtyResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
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
        <SheetHeader className="px-6 pt-6 pb-2 border-b border-border gap-2">
          <SheetTitle className="pr-8 text-xl font-semibold tracking-tight text-foreground">
            {row?.specialty ?? 'Specialty detail'}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {row ? (
            <>
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
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
              </div>

              <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-1.5 mb-2">
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

              <div className="rounded-md border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">cFTE</TableHead>
                      <TableHead className="text-right">Actual wRVUs</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">% to target</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Potential incentive</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.providers.map((p) => (
                      <TableRow key={p.providerId}>
                        <TableCell className="font-medium">
                          {p.providerName || p.providerId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(p.cFTE, 2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(p.actualWRVUs, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(p.rampedTargetWRVU, 0)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${statusColorClass(p.status)}`}>
                          {formatNum(p.percentToTarget, 1)}%
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${statusColorClass(p.status)}`}>
                          {formatNum(p.varianceWRVU, 0)}
                        </TableCell>
                        <TableCell className={statusColorClass(p.status)}>{p.status}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.planningIncentiveDollars != null ? formatCurrency(p.planningIncentiveDollars) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a specialty to view details.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
