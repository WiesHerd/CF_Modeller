/**
 * Market positioning calculation drawer: shows how TCC and wRVU percentiles
 * are computed for a single provider (normalization to 1.0 cFTE, market curve, interpolation).
 */

import { ArrowLeft } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatNumber } from '@/utils/format'
import type { ImputedVsMarketProviderDetail } from '@/lib/imputed-vs-market'

interface MarketPositioningCalculationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, a Back button is shown to return to the provider list drawer. */
  onBack?: () => void
  provider: ImputedVsMarketProviderDetail | null
  specialtyLabel?: string
}

function fmt(n: number, decimals = 0): string {
  return formatNumber(n, decimals)
}

function fmtCur(n: number): string {
  return formatCurrency(n, { decimals: 0 })
}

function formatTccPercentile(p: ImputedVsMarketProviderDetail): string {
  if (p.tccPercentileBelowRange) return `<25 (${p.tccPercentile.toFixed(1)})`
  if (p.tccPercentileAboveRange) return `>90 (${p.tccPercentile.toFixed(1)})`
  return p.tccPercentile.toFixed(1)
}

function formatWrvuPercentile(p: ImputedVsMarketProviderDetail): string {
  if (p.wrvuPercentileBelowRange) return `<25 (${p.wrvuPercentile.toFixed(1)})`
  if (p.wrvuPercentileAboveRange) return `>90 (${p.wrvuPercentile.toFixed(1)})`
  return p.wrvuPercentile.toFixed(1)
}

export function MarketPositioningCalculationDrawer({
  open,
  onOpenChange,
  onBack,
  provider,
  specialtyLabel,
}: MarketPositioningCalculationDrawerProps) {
  if (!provider) return null

  const baselineTCC_1p0 = provider.cFTE > 0 ? provider.baselineTCC / provider.cFTE : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-xl overflow-hidden p-0"
        aria-describedby="market-positioning-calculation-desc"
      >
        <SheetHeader className="px-6 pt-6 pb-2 border-b gap-2">
          <div className="flex items-start gap-2">
            {onBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 -ml-2"
                onClick={onBack}
                aria-label="Back to provider list"
              >
                <ArrowLeft className="size-5" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <SheetTitle>How we calculated TCC and wRVU percentiles</SheetTitle>
              <SheetDescription id="market-positioning-calculation-desc">
            <span className="block text-foreground/80">
              {provider.providerName || provider.providerId}
              {specialtyLabel ? ` · ${specialtyLabel}` : ''}
              {provider.providerType && provider.providerType !== '—' ? ` · ${provider.providerType}` : ''}
            </span>
            All values are normalized to 1.0 clinical FTE for comparison to market.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-sm">
          {/* TCC build-up */}
          <section>
            <h4 className="font-semibold text-foreground mb-2">TCC build-up</h4>
            <p className="text-muted-foreground mb-3">
              Baseline TCC used for market positioning = Clinical base + Quality (if enabled) + Work RVU incentive (if
              enabled) + Other incentives + Additional TCC (if any).
            </p>
            <Table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                <TableRow>
                  <TableHead className="text-muted-foreground px-3 py-2.5">Component</TableHead>
                  <TableHead className="text-right tabular-nums px-3 py-2.5">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground px-3 py-2.5">Clinical base</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.clinicalBase)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground px-3 py-2.5">Quality</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.quality)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground px-3 py-2.5">Work RVU incentive</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.workRVUIncentive)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground px-3 py-2.5">Other incentives</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.otherIncentives)}</TableCell>
                </TableRow>
                {provider.additionalTCC != null && provider.additionalTCC > 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground px-3 py-2.5">Additional TCC</TableCell>
                    <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.additionalTCC)}</TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t-2 border-border font-medium bg-primary/10">
                  <TableCell className="px-3 py-2.5">Total baseline TCC</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-primary px-3 py-2.5">{fmtCur(provider.baselineTCC)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          {/* TCC percentile */}
          <section>
            <h4 className="font-semibold text-foreground mb-2">TCC percentile</h4>
            <p className="rounded-md bg-muted/50 p-3 font-mono text-xs mb-2">
              TCC per 1.0 cFTE = Baseline TCC ÷ Clinical FTE
            </p>
            <p className="text-muted-foreground mb-2">
              <span className="tabular-nums">{fmtCur(provider.baselineTCC)}</span> ÷{' '}
              <span className="tabular-nums">{provider.cFTE.toFixed(2)}</span> ={' '}
              <strong className="tabular-nums text-primary">{fmtCur(baselineTCC_1p0)}</strong> per 1.0 cFTE
            </p>
            <Table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground px-3 py-2.5">Market percentile</TableHead>
                  <TableHead className="text-right tabular-nums px-3 py-2.5">TCC (per 1.0 cFTE)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="px-3 py-2.5">25th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.marketTCC_25)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-3 py-2.5">50th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.marketTCC_50)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-3 py-2.5">75th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.marketTCC_75)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-3 py-2.5">90th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(provider.marketTCC_90)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-muted-foreground mt-2">
              Your value is compared to this curve (linear interpolation). Result:{' '}
              <strong className="tabular-nums text-primary">{formatTccPercentile(provider)}</strong> percentile.
              {provider.tccPercentileBelowRange && ' (Below 25th — value is under market 25th.)'}
              {provider.tccPercentileAboveRange && ' (Above 90th — value is over market 90th.)'}
            </p>
          </section>

          {/* wRVU percentile */}
          <section>
            <h4 className="font-semibold text-foreground mb-2">Work (wRVU) percentile</h4>
            <p className="rounded-md bg-muted/50 p-3 font-mono text-xs mb-2">
              wRVU per 1.0 cFTE = Total wRVUs ÷ Clinical FTE
            </p>
            <p className="text-muted-foreground mb-2">
              <span className="tabular-nums">{fmt(provider.totalWRVUs, 0)}</span> ÷{' '}
              <span className="tabular-nums">{provider.cFTE.toFixed(2)}</span> ={' '}
              <strong className="tabular-nums text-primary">{fmt(provider.wRVU_1p0, 0)}</strong> wRVU per 1.0 cFTE
            </p>
            <Table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground px-3 py-2.5">Market percentile</TableHead>
                  <TableHead className="text-right tabular-nums px-3 py-2.5">wRVU (per 1.0 cFTE)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="px-3 py-2.5">25th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmt(provider.marketWRVU_25, 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-3 py-2.5">50th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmt(provider.marketWRVU_50, 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-3 py-2.5">75th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmt(provider.marketWRVU_75, 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-3 py-2.5">90th</TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">{fmt(provider.marketWRVU_90, 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-muted-foreground mt-2">
              Your value is compared to this curve (linear interpolation). Result:{' '}
              <strong className="tabular-nums text-primary">{formatWrvuPercentile(provider)}</strong> percentile.
              {provider.wrvuPercentileBelowRange && ' (Below 25th — value is under market 25th.)'}
              {provider.wrvuPercentileAboveRange && ' (Above 90th — value is over market 90th.)'}
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
