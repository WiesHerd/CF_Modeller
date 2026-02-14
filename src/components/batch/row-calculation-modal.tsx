import { useEffect, useRef } from 'react'
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
import { formatCurrency, formatNumber } from '@/utils/format'
import type { BatchRowResult } from '@/types/batch'
import type { MarketRow } from '@/types/market'

export type CalculationSection = 'incentive' | 'wrvu' | 'tcc'

interface RowCalculationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: BatchRowResult | null
  marketRow: MarketRow | null
  /** When set, scroll this section into view when the drawer opens. */
  scrollToSection?: CalculationSection
}

function fmt(n: number, decimals = 0): string {
  return formatNumber(n, decimals)
}

function fmtCur(n: number): string {
  return formatCurrency(n, { decimals: 0 })
}

export function RowCalculationModal({
  open,
  onOpenChange,
  row,
  marketRow,
  scrollToSection,
}: RowCalculationModalProps) {
  const incentiveRef = useRef<HTMLElement>(null)
  const wrvuRef = useRef<HTMLElement>(null)
  const tccRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open || !scrollToSection) return
    const ref = scrollToSection === 'incentive' ? incentiveRef : scrollToSection === 'wrvu' ? wrvuRef : tccRef
    const el = ref.current
    if (el) {
      const t = requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return () => cancelAnimationFrame(t)
    }
  }, [open, scrollToSection])

  if (!row) return null

  const results = row.results
  const inputs = row.scenarioInputsSnapshot
  const noMarket = !marketRow
  const noResults = !results

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-xl overflow-hidden p-0"
        aria-describedby="row-calculation-desc"
      >
        <SheetHeader className="px-6 pt-6 pb-2 border-b">
          <SheetTitle>How we calculated this row</SheetTitle>
          <SheetDescription id="row-calculation-desc">
            {row.providerName && (
              <span className="block text-foreground/80">
                {row.providerName}
                {row.specialty ? ` · ${row.specialty}` : ''}
                {row.providerType ? ` · ${row.providerType}` : ''}
                {row.scenarioName ? ` · ${row.scenarioName}` : ''}
              </span>
            )}
            Table stays in view — click another value or close to continue.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-sm">
          {noResults ? (
            <p className="text-muted-foreground">
              No calculation available — no market benchmark was matched for this specialty.
            </p>
          ) : (
            <>
              {/* Incentive */}
              <section ref={incentiveRef}>
                <h4 className="font-semibold text-foreground mb-2">Incentive</h4>
                <p className="rounded-md bg-muted/50 p-3 font-mono text-xs mb-2">
                  Incentive = (Modeled wRVUs − Threshold) × Modeled CF
                </p>
                <p className="text-muted-foreground mb-3">
                  Only wRVUs above the threshold are paid at the modeled conversion factor.
                </p>
                <Table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="text-muted-foreground px-3 py-2.5">Input</TableHead>
                      <TableHead className="text-right tabular-nums px-3 py-2.5">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground px-3 py-2.5">Modeled wRVUs</TableCell>
                      <TableCell className="text-right tabular-nums px-3 py-2.5">
                        {fmt(
                          inputs.modeledWRVUs != null && Number.isFinite(inputs.modeledWRVUs)
                            ? inputs.modeledWRVUs
                            : results.totalWRVUs,
                          2
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground px-3 py-2.5">Threshold (wRVUs)</TableCell>
                      <TableCell className="text-right tabular-nums px-3 py-2.5">{fmt(results.annualThreshold, 2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground px-3 py-2.5">Threshold method</TableCell>
                      <TableCell className="text-right px-3 py-2.5">
                        {(inputs.thresholdMethod ?? 'derived') === 'derived'
                          ? 'Derived (modeled clinical salary ÷ CF)'
                          : (inputs.thresholdMethod ?? '') === 'annual'
                            ? 'Annual (manual or override)'
                            : `wRVU percentile (market at ${inputs.wrvuPercentile ?? 50}% × clinical FTE)`}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground px-3 py-2.5">wRVUs above threshold</TableCell>
                      <TableCell className="text-right tabular-nums px-3 py-2.5">{fmt(results.wRVUsAboveThreshold, 2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground px-3 py-2.5">Modeled CF</TableCell>
                      <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(results.modeledCF)}/wRVU</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-border font-medium">
                      <TableCell className="px-3 py-2.5">Incentive</TableCell>
                      <TableCell className="text-right tabular-nums px-3 py-2.5">{fmtCur(results.annualIncentive)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </section>

              {/* wRVU (work) percentile */}
              <section ref={wrvuRef}>
                <h4 className="font-semibold text-foreground mb-2">Work (wRVU) percentile</h4>
                <p className="rounded-md bg-muted/50 p-3 font-mono text-xs mb-2">
                  wRVU_normalized = Total wRVUs ÷ Clinical FTE
                </p>
                <p className="text-muted-foreground mb-2">
                  Your normalized wRVU: <strong className="tabular-nums">{fmt(results.wrvuNormalized, 2)}</strong>
                </p>
                {noMarket ? (
                  <p className="text-muted-foreground">No market benchmark for this specialty.</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Market percentile</TableHead>
                          <TableHead className="text-right tabular-nums">wRVU (per FTE)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>25th</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(marketRow.WRVU_25, 2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>50th</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(marketRow.WRVU_50, 2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>75th</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(marketRow.WRVU_75, 2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>90th</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(marketRow.WRVU_90, 2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <p className="text-muted-foreground mt-2">
                      Your value is compared to this curve (linear interpolation). Result: <strong>{fmt(results.wrvuPercentile, 0)}th</strong> percentile.
                    </p>
                  </>
                )}
              </section>

              {/* TCC percentiles */}
              <section ref={tccRef}>
                <h4 className="font-semibold text-foreground mb-2">Total cash comp (TCC) percentiles</h4>
                <p className="rounded-md bg-muted/50 p-3 font-mono text-xs mb-2">
                  TCC_normalized = TCC ÷ Total FTE
                </p>
                <p className="text-muted-foreground mb-3">
                  Current: <strong className="tabular-nums">{fmtCur(results.tccNormalized)}</strong> per FTE →{' '}
                  <strong>{fmt(results.tccPercentile, 0)}th</strong> percentile.
                  <br />
                  Modeled: <strong className="tabular-nums">{fmtCur(results.modeledTccNormalized)}</strong> per FTE →{' '}
                  <strong>{fmt(results.modeledTCCPercentile, 0)}th</strong> percentile.
                </p>
                {noMarket ? (
                  <p className="text-muted-foreground">No market benchmark for this specialty.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Market percentile</TableHead>
                        <TableHead className="text-right tabular-nums">TCC (per FTE)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>25th</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCur(marketRow.TCC_25)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>50th</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCur(marketRow.TCC_50)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>75th</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCur(marketRow.TCC_75)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>90th</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCur(marketRow.TCC_90)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
