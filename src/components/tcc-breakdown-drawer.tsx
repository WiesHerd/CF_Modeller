import React, { useCallback, useState } from 'react'
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
import { Info } from 'lucide-react'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'

type TCCComponentId = 'base' | 'incentive' | 'vbp' | null

const TCC_DRAWER_WIDTH_MIN = 380
const TCC_DRAWER_WIDTH_MAX = 960
const TCC_DRAWER_WIDTH_DEFAULT = 520

/** Side drawer that shows how TCC (Total Cash Compensation) is calculated from its components. */
export function TCCBreakdownDrawer({
  open,
  onOpenChange,
  provider,
  results,
  scenarioInputs,
  fmtMoney,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: ProviderRow | null
  results: ScenarioResults | null
  scenarioInputs: ScenarioInputs
  fmtMoney: (n: number) => string
}) {
  const [detailComponent, setDetailComponent] = useState<TCCComponentId>(null)
  const [drawerWidth, setDrawerWidth] = useState(TCC_DRAWER_WIDTH_DEFAULT)

  const handleDrawerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = drawerWidth
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setDrawerWidth(Math.min(TCC_DRAWER_WIDTH_MAX, Math.max(TCC_DRAWER_WIDTH_MIN, startW + delta)))
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

  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0) as number
  const baseSalaryFromComponents =
    provider?.basePayComponents?.length &&
    provider.basePayComponents.some((c) => Number(c?.amount) > 0)
      ? provider.basePayComponents.reduce(
          (sum, c) => sum + (typeof c?.amount === 'number' && Number.isFinite(c.amount) ? c.amount : 0),
          0
        )
      : 0
  const baseSalary = baseSalaryFromComponents > 0 ? baseSalaryFromComponents : n(provider?.baseSalary)
  const nonClinicalPay = n(provider?.nonClinicalPay) || 0
  const totalBasePay = baseSalaryFromComponents > 0 ? baseSalaryFromComponents : baseSalary + nonClinicalPay
  const currentIncentiveForTCC = Math.max(0, results?.currentIncentive ?? 0)
  const annualIncentiveForTCC = Math.max(0, results?.annualIncentive ?? 0)
  const currentPsq = results?.currentPsqDollars ?? results?.psqDollars ?? 0
  const modeledPsq = results?.psqDollars ?? 0
  const qualityPayments = n(provider?.qualityPayments) || 0
  const otherIncentives = n(provider?.otherIncentives) || 0
  const modeledBase =
    scenarioInputs.modeledBasePay != null && Number.isFinite(scenarioInputs.modeledBasePay)
      ? scenarioInputs.modeledBasePay
      : baseSalary

  const currentTCC = results?.currentTCC ?? 0
  const modeledTCC = results?.modeledTCC ?? 0
  const fromFile = results?.currentTCCFromFile === true
  const sumOfComponents =
    totalBasePay + currentIncentiveForTCC + currentPsq + qualityPayments + otherIncentives
  const componentsMatchTotal = Math.abs(sumOfComponents - currentTCC) < 0.02

  const totalWRVUs = results?.totalWRVUs ?? 0
  const modeledWRVUs = scenarioInputs.modeledWRVUs != null && Number.isFinite(scenarioInputs.modeledWRVUs)
    ? scenarioInputs.modeledWRVUs
    : totalWRVUs
  const annualThreshold = results?.annualThreshold ?? 0
  const wRVUsAboveThreshold = results?.wRVUsAboveThreshold ?? 0
  const currentCF = results?.currentCF ?? 0
  const modeledCF = results?.modeledCF ?? 0
  const psqPercent = scenarioInputs.psqPercent ?? 0
  const currentPsqPercent = scenarioInputs.currentPsqPercent ?? 0
  const psqBasis = scenarioInputs.psqBasis ?? 'base_salary'

  const rows: { id: TCCComponentId; label: string; current: number; modeled: number }[] = [
    { id: 'base', label: 'Base pay (total)', current: totalBasePay, modeled: modeledBase },
    { id: 'incentive', label: 'Incentive (wRVU)', current: currentIncentiveForTCC, modeled: annualIncentiveForTCC },
    { id: 'vbp', label: 'Quality payments (VBP)', current: currentPsq, modeled: modeledPsq },
    ...(qualityPayments > 0 ? [{ id: null as TCCComponentId, label: 'Quality payments', current: qualityPayments, modeled: 0 as number }] : []),
    ...(otherIncentives > 0 ? [{ id: null as TCCComponentId, label: 'Other incentives', current: otherIncentives, modeled: 0 as number }] : []),
    { id: null, label: 'Total (TCC)', current: currentTCC, modeled: modeledTCC },
  ]

  const fmtNum = (v: number, decimals = 0) => n(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const Num = ({ children, negative }: { children: React.ReactNode; negative?: boolean }) => (
    <span className={cn('tabular-nums font-semibold', negative ? 'text-destructive' : 'text-primary')}>
      {children}
    </span>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden p-0 sm:max-w-[none] border-border"
        contentStyle={{ width: drawerWidth, maxWidth: 'none' }}
        aria-describedby="tcc-breakdown-desc"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize drawer"
          className="absolute left-0 top-0 bottom-0 z-50 w-2 cursor-col-resize touch-none border-l border-transparent hover:border-primary/30 hover:bg-primary/10"
          onMouseDown={handleDrawerResize}
        />
        <SheetHeader className="px-6 pt-6 pb-2 border-b border-border gap-2">
          <SheetTitle className="flex items-center gap-2">
            <Info className="size-5 text-muted-foreground shrink-0" aria-hidden />
            How TCC is calculated
          </SheetTitle>
          <SheetDescription id="tcc-breakdown-desc" className="text-xs">
            Total Cash Compensation (TCC) is the sum of the components below. Base pay (total) = base salary + non-clinical. Non-clinical is calculated from FTE (base × (total FTE − clinical FTE) / total FTE) when not in your file. Only positive wRVU incentive is included; negative incentive is not. Click a component to see how it is calculated.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {fromFile && !componentsMatchTotal ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-500/15 px-3 py-2.5 text-sm mb-4">
              <strong>Current TCC ({fmtMoney(currentTCC)}) is from your file.</strong> Your provider upload has a &quot;Current TCC&quot; column, so we use that value as the baseline total. It is not computed from the components in the table below — those components are for reference. Your file total may have been calculated differently (e.g. different base or incentive rules).
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              Current TCC = base pay (total) + wRVU incentive (if positive) + PSQ/VBP + quality payments (from file) + other incentives (Other incentives + Other incentive 1/2/3 from your upload). Base pay includes non-clinical, which is derived from FTE when not in your file. The table below shows each component.
            </p>
          )}
          <Table className="w-full caption-bottom text-sm table-auto border border-border rounded-md">
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground font-medium px-3 py-2.5">Component</TableHead>
                <TableHead className="text-right tabular-nums font-medium px-3 py-2.5">Current (Baseline)</TableHead>
                <TableHead className="text-right tabular-nums font-medium px-3 py-2.5">Modeled (Scenario)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ id, label, current, modeled }, idx) => {
                const isClickable = id != null
                const isSelected = detailComponent === id
                return (
                  <TableRow
                    key={label}
                    className={cn(
                      idx % 2 === 1 && 'bg-muted/30',
                      label.startsWith('Total') && 'border-t-2 border-border font-semibold',
                      isClickable && 'cursor-pointer hover:bg-muted/50 transition-colors',
                      isSelected && 'bg-primary/10'
                    )}
                    onClick={isClickable ? () => setDetailComponent((c) => (c === id ? null : id)) : undefined}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setDetailComponent((c) => (c === id ? null : id))
                            }
                          }
                        : undefined
                    }
                  >
                    <TableCell className={cn('text-sm px-3 py-2.5', isClickable && 'text-primary underline underline-offset-2 decoration-primary/70')}>
                      {label}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5">{current > 0 ? fmtMoney(current) : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-sm px-3 py-2.5">{modeled > 0 ? fmtMoney(modeled) : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {detailComponent === 'base' && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
              <h4 className="font-semibold text-foreground mb-2">How Base pay (total) is calculated</h4>
              <p className="text-muted-foreground text-xs mb-3">
                Current = base salary + non-clinical from file. Modeled = slider value or current base; non-clinical is not added unless you change it.
              </p>
              <Table className="w-full text-sm border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground font-medium py-1.5 pr-2">Source</TableHead>
                    <TableHead className="text-right tabular-nums font-medium py-1.5">Current (Baseline)</TableHead>
                    <TableHead className="text-right tabular-nums font-medium py-1.5">Modeled (Scenario)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">Base salary</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(baseSalary)}</Num></TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(modeledBase)}</Num></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">Non-clinical (stipend)</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(nonClinicalPay)}</Num></TableCell>
                    <TableCell className="text-muted-foreground text-right py-1.5">—</TableCell>
                  </TableRow>
                  <TableRow className="border-t border-border font-semibold">
                    <TableCell className="text-foreground py-1.5 pr-2">Base pay (total)</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(totalBasePay)}</Num></TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(modeledBase)}</Num></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {detailComponent === 'incentive' && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
              <h4 className="font-semibold text-foreground mb-2">How Incentive (wRVU) is calculated</h4>
              <p className="text-muted-foreground text-xs mb-3">
                Formula: (wRVUs above threshold) × CF. Only positive amounts are included in TCC.
              </p>
              <Table className="w-full text-sm border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground font-medium py-1.5 pr-2">Input</TableHead>
                    <TableHead className="text-right tabular-nums font-medium py-1.5">Current (Baseline)</TableHead>
                    <TableHead className="text-right tabular-nums font-medium py-1.5">Modeled (Scenario)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">Total / Modeled wRVUs</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtNum(totalWRVUs)}</Num></TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtNum(modeledWRVUs)}</Num></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">Threshold (wRVU)</TableCell>
                    <TableCell className="text-muted-foreground text-right py-1.5">from file or derived</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtNum(annualThreshold)}</Num></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">wRVUs above threshold</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5">—</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num negative={wRVUsAboveThreshold < 0}>{fmtNum(wRVUsAboveThreshold)}</Num></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">CF ($/wRVU)</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(currentCF)}</Num></TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(modeledCF)}</Num></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">Incentive (raw)</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5">—</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num negative={wRVUsAboveThreshold * modeledCF < 0}>{fmtMoney(wRVUsAboveThreshold * modeledCF)}</Num></TableCell>
                  </TableRow>
                  <TableRow className="border-t border-border font-semibold">
                    <TableCell className="text-foreground py-1.5 pr-2">Used in TCC</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(currentIncentiveForTCC)}</Num></TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{fmtMoney(annualIncentiveForTCC)}</Num></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {detailComponent === 'vbp' && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
              <h4 className="font-semibold text-foreground mb-2">How Quality payments (VBP) is calculated</h4>
              <p className="text-muted-foreground text-xs mb-3">
                VBP / PSQ is a percentage of a basis (base salary or total pay). Set via &quot;Quality payments $ (VBP %)&quot; on the main table.
              </p>
              <Table className="w-full text-sm border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground font-medium py-1.5 pr-2">Input</TableHead>
                    <TableHead className="text-right tabular-nums font-medium py-1.5">Current (Baseline)</TableHead>
                    <TableHead className="text-right tabular-nums font-medium py-1.5">Modeled (Scenario)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">Basis</TableCell>
                    <TableCell className="text-muted-foreground text-right py-1.5 text-xs">{psqBasis === 'total_pay' ? 'total pay' : 'base salary'}</TableCell>
                    <TableCell className="text-muted-foreground text-right py-1.5 text-xs">{psqBasis === 'total_pay' ? 'modeled base + incentive' : 'modeled base'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground py-1.5 pr-2">VBP %</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{currentPsqPercent}%</Num></TableCell>
                    <TableCell className="text-right tabular-nums py-1.5"><Num>{psqPercent}%</Num></TableCell>
                  </TableRow>
                  <TableRow className="border-t border-border font-semibold">
                    <TableCell className="text-foreground py-1.5 pr-2">Amount</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5">{currentPsq > 0 ? <Num>{fmtMoney(currentPsq)}</Num> : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums py-1.5">{modeledPsq > 0 ? <Num>{fmtMoney(modeledPsq)}</Num> : '—'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
