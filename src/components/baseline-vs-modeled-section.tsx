import React, { useCallback, useState } from 'react'
import { DeltaIndicator, fmtMoney } from '@/components/delta-indicator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Info, RotateCcw } from 'lucide-react'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, ScenarioResults, CFSource } from '@/types/scenario'

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Parse input that may contain commas (e.g. "2,072" or "2,072.50") to a number; round to 2 decimals. */
function parseDecimalInput(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** Parse input that may contain $ and commas (e.g. "$1,234.56") to a number. */
function parseCurrencyInput(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : NaN
}

/** Fixed width for numeric value cells so columns align vertically. */
const VALUE_CELL_WIDTH = '7.5rem' // ~120px for $XXX,XXX.XX

/** When valueRight is this shape, Modeled cell uses two zones: controls (flex) + value (fixed width). */
type ModeledWithControls = { controls: React.ReactNode; value: React.ReactNode }

function isModeledWithControls(
  v: React.ReactNode | ModeledWithControls
): v is ModeledWithControls {
  return (
    typeof v === 'object' &&
    v !== null &&
    !React.isValidElement(v) &&
    'controls' in v &&
    'value' in v
  )
}

function ComparisonRow({
  labelLeft,
  valueLeft,
  labelRight,
  valueRight,
  isChanged,
  delta,
  deltaFormat,
  title,
  onRowClick,
  className,
}: {
  labelLeft: React.ReactNode
  valueLeft: React.ReactNode
  labelRight: React.ReactNode
  valueRight: React.ReactNode | ModeledWithControls
  /** When true, apply subtle row background so changed rows scan quickly. */
  isChanged?: boolean
  /** When set, show in Variance column (zero shown as —). */
  delta?: number
  deltaFormat?: 'number' | 'currency' | 'integer'
  /** Optional tooltip for the row (e.g. formula). */
  title?: string
  /** When set, row is clickable (e.g. to show breakdown). */
  onRowClick?: () => void
  /** Optional extra class for the row (e.g. pt-2 for first row of a section). */
  className?: string
}) {
  const showDelta = delta !== undefined && delta !== 0
  const withControls = isModeledWithControls(valueRight)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onRowClick()
    }
  }
  return (
    <TableRow
      title={title}
      role={onRowClick ? 'button' : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={onRowClick}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
      className={cn(
        'border-border hover:bg-transparent',
        isChanged && 'bg-muted/25',
        onRowClick && 'cursor-pointer hover:bg-muted/40 transition-colors',
        className
      )}
    >
      {/* Baseline: label left, value right */}
      <TableCell className="border-border/80 bg-muted/20 px-3 py-2.5 align-middle md:border-r">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Label className="text-muted-foreground flex shrink-0 items-center text-sm font-medium">
            {labelLeft}
          </Label>
          <div
            className="tabular-nums sm:text-right"
            style={{ minWidth: VALUE_CELL_WIDTH, width: VALUE_CELL_WIDTH }}
          >
            {valueLeft}
          </div>
        </div>
      </TableCell>
      {/* Modeled: label left, then controls + value (value aligns in column). Responsive: controls flex to fill space. */}
      <TableCell className="border-border/80 px-3 py-2.5 align-middle md:border-r">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 md:gap-4">
          <Label className="text-muted-foreground flex shrink-0 items-center text-sm font-medium sm:min-w-0">
            {labelRight}
          </Label>
          <div
            className={cn(
              'flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3',
              !withControls && 'sm:justify-end'
            )}
          >
            {withControls ? (
              <>
                <div className="flex min-w-[7rem] flex-1 items-center gap-2">
                  {valueRight.controls}
                </div>
                <div
                  className="shrink-0 tabular-nums text-right"
                  style={{ width: VALUE_CELL_WIDTH }}
                >
                  {valueRight.value}
                </div>
              </>
            ) : (
              <div
                className="shrink-0 tabular-nums text-right"
                style={{ width: VALUE_CELL_WIDTH }}
              >
                {valueRight}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      {/* Variance: right-aligned */}
      <TableCell className="border-border/60 px-3 py-2.5 text-right tabular-nums" style={{ width: VALUE_CELL_WIDTH }}>
        {showDelta ? (
          <DeltaIndicator
            delta={delta!}
            format={deltaFormat ?? 'currency'}
            className="shrink-0"
          />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

type TCCComponentId = 'base' | 'incentive' | 'vbp' | null

const TCC_DRAWER_WIDTH_MIN = 380
const TCC_DRAWER_WIDTH_MAX = 960
const TCC_DRAWER_WIDTH_DEFAULT = 520

/** Side drawer that shows how TCC (Total Cash Compensation) is calculated from its components. */
function TCCBreakdownDrawer({
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
  // Modeled base = override or clinical base only (matches compute: we do not add non-clinical to modeled base unless overridden).
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
  /** Wrap important numbers so they stand out with a distinct color. */
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
            Total Cash Compensation (TCC) is the sum of the components below. Base pay (total) = base salary + non-clinical (stipend). Only positive wRVU incentive is included; negative incentive is not. Click a component to see how it is calculated.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {fromFile && !componentsMatchTotal ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-500/15 px-3 py-2.5 text-sm mb-4">
              <strong>Current TCC ({fmtMoney(currentTCC)}) is from your file.</strong> Your provider upload has a &quot;Current TCC&quot; column, so we use that value as the baseline total. It is not computed from the components in the table below — those components are for reference. Your file total may have been calculated differently (e.g. different base or incentive rules).
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              Current TCC = base pay (total) + wRVU incentive (if positive) + PSQ/VBP + quality payments (from file) + other incentives. The table below shows each component.
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

interface BaselineVsModeledSectionProps {
  provider: ProviderRow | null
  results: ScenarioResults | null
  scenarioInputs: ScenarioInputs
  onScenarioChange: (inputs: Partial<ScenarioInputs>) => void
  disabled?: boolean
}

export function BaselineVsModeledSection({
  provider,
  results,
  scenarioInputs,
  onScenarioChange,
  disabled = false,
}: BaselineVsModeledSectionProps) {
  const currentCF = results?.currentCF ?? 0
  const currentIncentive = results?.currentIncentive ?? 0
  const currentTCC = results?.currentTCC ?? 0
  const annualThreshold = results?.annualThreshold ?? 0
  const imputedCurrent = results?.imputedTCCPerWRVURatioCurrent ?? 0

  const modeledCF = results?.modeledCF ?? 0
  const annualIncentive = results?.annualIncentive ?? 0
  const modeledTCC = results?.modeledTCC ?? 0
  const imputedModeled = results?.imputedTCCPerWRVURatioModeled ?? 0
  const psqDollars = results?.psqDollars ?? 0
  const currentPsqDollars = results?.currentPsqDollars ?? results?.psqDollars ?? 0
  const changeInTCC = results?.changeInTCC ?? 0

  // Current column: show quality payments from provider (Upload/edit) when set, else computed VBP amount
  const qualityPaymentsFromProvider =
    typeof provider?.qualityPayments === 'number' && Number.isFinite(provider.qualityPayments)
      ? provider.qualityPayments
      : 0
  const currentQualityPaymentsDisplay =
    qualityPaymentsFromProvider > 0 ? qualityPaymentsFromProvider : currentPsqDollars

  const deltaCF = modeledCF - currentCF
  const deltaIncentiveDollars = annualIncentive - currentIncentive
  const deltaImputed = imputedModeled - imputedCurrent
  const deltaPsq = psqDollars - currentQualityPaymentsDisplay

  const pct = scenarioInputs.proposedCFPercentile ?? 50
  const vbpPercent = scenarioInputs.psqPercent ?? 0

  const handlePercentileChange = (value: number[]) => {
    const v = value[0]
    if (v === undefined || !Number.isFinite(v)) return
    const clamped = Math.min(100, Math.max(0, Math.round(v)))
    onScenarioChange({
      proposedCFPercentile: clamped,
      cfSource: 'target_haircut' as CFSource,
      overrideCF: undefined,
    })
  }

  const [editCF, setEditCF] = useState<string | null>(null)
  const [editWork, setEditWork] = useState<string | null>(null)
  const [editOther, setEditOther] = useState<string | null>(null)
  const [editBasePay, setEditBasePay] = useState<string | null>(null)
  const [editNonClinical, setEditNonClinical] = useState<string | null>(null)
  const [tccBreakdownOpen, setTccBreakdownOpen] = useState(false)

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
  const modeledBase =
    scenarioInputs.modeledBasePay != null && Number.isFinite(scenarioInputs.modeledBasePay)
      ? scenarioInputs.modeledBasePay
      : baseSalary
  const deltaBase = modeledBase - baseSalary

  const components = provider?.basePayComponents ?? []
  const clinicalFromComponents =
    components.find((c) => c.label === 'Clinical')?.amount ??
    components[0]?.amount ??
    0
  const currentNonClinical =
    baseSalaryFromComponents > 0
      ? Math.max(0, baseSalaryFromComponents - clinicalFromComponents)
      : n(provider?.nonClinicalPay)
  const modeledNonClinical =
    scenarioInputs.modeledNonClinicalPay != null &&
    Number.isFinite(scenarioInputs.modeledNonClinicalPay)
      ? scenarioInputs.modeledNonClinicalPay
      : currentNonClinical
  const deltaNonClinical = modeledNonClinical - currentNonClinical

  const handleBasePayChange = (value: number) => {
    if (!Number.isFinite(value) || value < 0) {
      onScenarioChange({ modeledBasePay: undefined })
      return
    }
    onScenarioChange({ modeledBasePay: Math.round(value * 100) / 100 })
  }

  const handleBasePayReset = () => {
    onScenarioChange({ modeledBasePay: undefined })
  }

  const basePaySliderMax = Math.max(500_000, (baseSalary || 0) * 2)

  const handleBasePaySliderChange = (value: number[]) => {
    const v = value[0]
    if (v === undefined || !Number.isFinite(v)) return
    const clamped = Math.min(basePaySliderMax, Math.max(0, Math.round(v / 1000) * 1000))
    onScenarioChange({ modeledBasePay: clamped })
  }

  const isBasePayReset = scenarioInputs.modeledBasePay == null || !Number.isFinite(scenarioInputs.modeledBasePay)

  const nonClinicalSliderMax = Math.max(300_000, (currentNonClinical || 0) * 2)
  const handleNonClinicalChange = (value: number) => {
    if (!Number.isFinite(value) || value < 0) {
      onScenarioChange({ modeledNonClinicalPay: undefined })
      return
    }
    onScenarioChange({ modeledNonClinicalPay: Math.round(value * 100) / 100 })
  }
  const handleNonClinicalReset = () => onScenarioChange({ modeledNonClinicalPay: undefined })
  const handleNonClinicalSliderChange = (value: number[]) => {
    const v = value[0]
    if (v === undefined || !Number.isFinite(v)) return
    const clamped = Math.min(nonClinicalSliderMax, Math.max(0, Math.round(v / 1000) * 1000))
    onScenarioChange({ modeledNonClinicalPay: clamped })
  }
  const isNonClinicalReset =
    scenarioInputs.modeledNonClinicalPay == null ||
    !Number.isFinite(scenarioInputs.modeledNonClinicalPay)

  const totalWRVUs = results?.totalWRVUs ?? 0
  const outsideWRVUs = Number(provider?.outsideWRVUs) || 0
  const currentWorkWRVUs = Math.max(0, totalWRVUs - outsideWRVUs)
  const currentOtherWRVUs = outsideWRVUs

  const round2 = (x: number) => Math.round(x * 100) / 100
  const modeledWRVUsStored = scenarioInputs.modeledWRVUs ?? totalWRVUs
  const modeledOtherWRVUsRaw = scenarioInputs.modeledOtherWRVUs ?? currentOtherWRVUs
  const modeledOtherWRVUs = Math.min(round2(modeledOtherWRVUsRaw), modeledWRVUsStored)
  const modeledWorkWRVUsDerived = Math.max(0, modeledWRVUsStored - modeledOtherWRVUs)
  const modeledWorkWRVUs =
    scenarioInputs.modeledWorkWRVUs != null && Number.isFinite(scenarioInputs.modeledWorkWRVUs)
      ? Math.max(0, round2(scenarioInputs.modeledWorkWRVUs))
      : round2(modeledWorkWRVUsDerived)
  const modeledWRVUs = modeledWorkWRVUs + modeledOtherWRVUs

  const wrvuSliderMax = 20_000
  const otherWrvuSliderMax = Math.max(modeledWRVUs, wrvuSliderMax)
  const workWrvuSliderMax = wrvuSliderMax

  const handleWorkWRVUsChange = (value: number[]) => {
    const v = value[0]
    if (v === undefined || !Number.isFinite(v)) return
    const clamped = Math.min(workWrvuSliderMax, Math.max(0, round2(v)))
    onScenarioChange({
      modeledWorkWRVUs: clamped,
      modeledWRVUs: clamped + modeledOtherWRVUs,
    })
  }

  const handleWorkWRVUsReset = () => {
    onScenarioChange({
      modeledWorkWRVUs: currentWorkWRVUs,
      modeledWRVUs: currentWorkWRVUs + modeledOtherWRVUs,
    })
  }

  const handleOtherWRVUsChange = (value: number[]) => {
    const v = value[0]
    if (v === undefined || !Number.isFinite(v)) return
    const clamped = Math.min(otherWrvuSliderMax, Math.max(0, round2(v)))
    onScenarioChange({
      modeledOtherWRVUs: clamped,
      modeledWRVUs: modeledWorkWRVUs + clamped,
    })
  }

  const handleOtherWRVUsReset = () => {
    onScenarioChange({ modeledOtherWRVUs: currentOtherWRVUs })
  }

  const isWorkWRVUsReset = modeledWorkWRVUs === currentWorkWRVUs
  const isOtherWRVUsReset = modeledOtherWRVUs === currentOtherWRVUs

  const handleVBPPercentChange = (value: number[]) => {
    const v = value[0]
    if (v === undefined || !Number.isFinite(v)) return
    const clamped = Math.min(50, Math.max(0, v))
    onScenarioChange({ psqPercent: clamped })
  }

  return (
    <>
    <Card className="overflow-hidden rounded-2xl border-2 border-border shadow-sm">
      <CardHeader className="pb-0 pt-6">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">
          CURRENT (Baseline) vs MODELED (Scenario)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-6 md:px-6 space-y-8">
        {/* Section 1: Compensation */}
        <section aria-labelledby="section-compensation">
          <h3 id="section-compensation" className="mb-3 text-xs font-medium text-primary">
            Compensation
          </h3>
          <Table className="table-fixed border-collapse border border-border">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
              <col style={{ width: VALUE_CELL_WIDTH }} />
            </colgroup>
            <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 font-semibold md:border-r">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    CURRENT (Baseline)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 font-semibold md:border-r">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    MODELED (Scenario)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 text-right font-semibold" style={{ width: VALUE_CELL_WIDTH }}>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Variance
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
          <ComparisonRow
            labelLeft="Base pay (total)"
            valueLeft={baseSalary > 0 ? fmtMoney(baseSalary) : '—'}
            labelRight="Base pay (total)"
            valueRight={{
              controls: (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Slider
                    min={0}
                    max={basePaySliderMax}
                    step={1000}
                    value={[Math.min(basePaySliderMax, Math.max(0, modeledBase))]}
                    onValueChange={handleBasePaySliderChange}
                    disabled={disabled}
                    className="min-w-0 flex-1 py-1"
                    aria-label="Modeled base pay (total); slider adjusts base for modeled scenario"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleBasePayReset}
                    disabled={disabled || isBasePayReset}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Reset modeled base pay to baseline"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </div>
              ),
              value: (
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={editBasePay !== null ? editBasePay : (modeledBase > 0 ? fmtMoney(modeledBase) : '')}
                  onFocus={(e) => {
                    setEditBasePay(modeledBase > 0 ? fmtMoney(modeledBase) : '')
                    setTimeout(() => (e.target as HTMLInputElement).select(), 0)
                  }}
                  onChange={(e) => setEditBasePay(e.target.value)}
                  onBlur={() => {
                    if (editBasePay === null) return
                    const v = parseCurrencyInput(editBasePay)
                    if (Number.isFinite(v) && v >= 0) {
                      handleBasePayChange(Math.min(basePaySliderMax, v))
                    } else if (editBasePay.replace(/[^0-9.]/g, '') === '') {
                      handleBasePayReset()
                    }
                    setEditBasePay(null)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="Same as baseline"
                  disabled={disabled}
                  className="h-8 w-full min-w-0 tabular-nums text-right text-sm"
                  style={{ maxWidth: VALUE_CELL_WIDTH }}
                  aria-label="Modeled base pay (total); type dollar amount"
                />
              ),
            }}
            isChanged={deltaBase !== 0}
            delta={deltaBase}
            deltaFormat="currency"
            title="Total guaranteed base (clinical + non-clinical). Override to model a base pay change; TCC = base + incentive + quality payments."
          />
          <ComparisonRow
            labelLeft="Non-clinical"
            valueLeft={currentNonClinical > 0 ? fmtMoney(currentNonClinical) : '—'}
            labelRight="Non-clinical"
            valueRight={{
              controls: (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Slider
                    min={0}
                    max={nonClinicalSliderMax}
                    step={1000}
                    value={[Math.min(nonClinicalSliderMax, Math.max(0, modeledNonClinical))]}
                    onValueChange={handleNonClinicalSliderChange}
                    disabled={disabled}
                    className="min-w-0 flex-1 py-1"
                    aria-label="Modeled non-clinical pay (slider)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleNonClinicalReset}
                    disabled={disabled || isNonClinicalReset}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Reset modeled non-clinical to baseline"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </div>
              ),
              value: (
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={editNonClinical !== null ? editNonClinical : (modeledNonClinical > 0 ? fmtMoney(modeledNonClinical) : '')}
                  onFocus={(e) => {
                    setEditNonClinical(modeledNonClinical > 0 ? fmtMoney(modeledNonClinical) : '')
                    setTimeout(() => (e.target as HTMLInputElement).select(), 0)
                  }}
                  onChange={(e) => setEditNonClinical(e.target.value)}
                  onBlur={() => {
                    if (editNonClinical === null) return
                    const v = parseCurrencyInput(editNonClinical)
                    if (Number.isFinite(v) && v >= 0) {
                      handleNonClinicalChange(Math.min(nonClinicalSliderMax, v))
                    } else if (editNonClinical.replace(/[^0-9.]/g, '') === '') {
                      handleNonClinicalReset()
                    }
                    setEditNonClinical(null)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="Same as baseline"
                  disabled={disabled}
                  className="h-8 w-full min-w-0 tabular-nums text-right text-sm"
                  style={{ maxWidth: VALUE_CELL_WIDTH }}
                  aria-label="Modeled non-clinical pay; type dollar amount"
                />
              ),
            }}
            isChanged={deltaNonClinical !== 0}
            delta={deltaNonClinical}
            deltaFormat="currency"
            title="Stipends / admin carve-outs; part of total base. Override to model a change."
          />
          <ComparisonRow
            labelLeft="Incentive $"
            valueLeft={
              results ? (
                <span className={currentIncentive < 0 ? 'text-destructive font-medium' : undefined}>
                  {fmtMoney(currentIncentive)}
                </span>
              ) : (
                '—'
              )
            }
            labelRight="Incentive $"
            valueRight={
              results ? (
                <span className={annualIncentive < 0 ? 'text-destructive font-medium' : undefined}>
                  {fmtMoney(annualIncentive)}
                </span>
              ) : (
                '—'
              )
            }
            isChanged={deltaIncentiveDollars !== 0}
            delta={deltaIncentiveDollars}
            deltaFormat="currency"
          />
          <ComparisonRow
            labelLeft="Quality payments $"
            valueLeft={currentQualityPaymentsDisplay > 0 ? fmtMoney(currentQualityPaymentsDisplay) : '—'}
            labelRight="Quality payments $ (VBP %)"
            valueRight={{
              controls: (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Slider
                    min={0}
                    max={50}
                    step={1}
                    value={[Math.min(50, vbpPercent)]}
                    onValueChange={handleVBPPercentChange}
                    disabled={disabled}
                    className="min-w-0 flex-1 py-1"
                    aria-label="Value-based payment percentage (VBP / Quality payment), 0–50%. Quality payments $ = this % of base or total pay depending on scenario quality payments basis."
                  />
                  <span className="shrink-0 text-muted-foreground tabular-nums text-xs" aria-hidden="true">
                    {vbpPercent}%
                  </span>
                </div>
              ),
              value: psqDollars > 0 ? fmtMoney(psqDollars) : '—',
            }}
            isChanged={deltaPsq !== 0}
            delta={deltaPsq}
            deltaFormat="currency"
            title={qualityPaymentsFromProvider > 0 ? 'Current value from provider file (Upload/edit). Modeled value is from VBP % slider.' : undefined}
          />
          <ComparisonRow
            labelLeft={
              <span className="text-primary underline underline-offset-2 decoration-primary/80 hover:decoration-primary">
                TCC
              </span>
            }
            valueLeft={
              <span className="text-primary underline underline-offset-2 decoration-primary/80 hover:decoration-primary tabular-nums">
                {currentTCC > 0 ? fmtMoney(currentTCC) : '—'}
              </span>
            }
            labelRight={
              <span className="text-primary underline underline-offset-2 decoration-primary/80 hover:decoration-primary">
                TCC
              </span>
            }
            valueRight={
              <span className="text-primary underline underline-offset-2 decoration-primary/80 hover:decoration-primary tabular-nums">
                {modeledTCC > 0 ? fmtMoney(modeledTCC) : '—'}
              </span>
            }
            isChanged={changeInTCC !== 0}
            delta={changeInTCC}
            deltaFormat="currency"
            title="Click to see how TCC is calculated"
            onRowClick={() => setTccBreakdownOpen(true)}
          />
            </TableBody>
          </Table>
        </section>

        {/* Section 2: Conversion factor */}
        <section aria-labelledby="section-conversion-factor">
          <h3 id="section-conversion-factor" className="mb-3 text-xs font-medium text-primary">
            Conversion factor
          </h3>
          <Table className="table-fixed border-collapse border border-border">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
              <col style={{ width: VALUE_CELL_WIDTH }} />
            </colgroup>
            <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 font-semibold md:border-r">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    CURRENT (Baseline)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 font-semibold md:border-r">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    MODELED (Scenario)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 text-right font-semibold" style={{ width: VALUE_CELL_WIDTH }}>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Variance
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
          <ComparisonRow
            labelLeft="Current CF"
            valueLeft={currentCF > 0 ? fmtMoney(currentCF) : '—'}
            labelRight="Modeled CF"
            valueRight={{
              controls: (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[pct]}
                    onValueChange={handlePercentileChange}
                    disabled={disabled}
                    className="min-w-0 flex-1 py-1"
                    aria-label="Market percentile for modeled CF (0-100). Uses linear interpolation from market data."
                  />
                  <span className="shrink-0 text-muted-foreground tabular-nums text-xs" aria-hidden="true">
                    P{pct}
                  </span>
                </div>
              ),
              value: (
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={editCF !== null ? editCF : (modeledCF > 0 ? fmtMoney(modeledCF) : '')}
                  onFocus={(e) => {
                    setEditCF(modeledCF > 0 ? fmtMoney(modeledCF) : '')
                    setTimeout(() => (e.target as HTMLInputElement).select(), 0)
                  }}
                  onChange={(e) => setEditCF(e.target.value)}
                  onBlur={() => {
                    if (editCF === null) return
                    const v = parseCurrencyInput(editCF)
                    if (Number.isFinite(v) && v >= 0) {
                      onScenarioChange({ overrideCF: v, cfSource: 'override' as CFSource })
                    } else if (editCF.replace(/[^0-9.]/g, '') === '') {
                      onScenarioChange({ overrideCF: undefined, cfSource: 'target_haircut' as CFSource })
                    }
                    setEditCF(null)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="$0.00"
                  disabled={disabled}
                  className="h-8 w-full min-w-0 tabular-nums text-right text-sm"
                  style={{ maxWidth: VALUE_CELL_WIDTH }}
                  aria-label="Modeled CF (type dollar amount)"
                />
              ),
            }}
            isChanged={deltaCF !== 0}
            delta={deltaCF}
            deltaFormat="currency"
          />
          <ComparisonRow
            labelLeft="Imputed TCC/wRVU"
            valueLeft={imputedCurrent > 0 ? fmtMoney(imputedCurrent) : '—'}
            labelRight="Imputed TCC/wRVU"
            valueRight={imputedModeled > 0 ? fmtMoney(imputedModeled) : '—'}
            isChanged={deltaImputed !== 0}
            delta={deltaImputed}
            deltaFormat="currency"
          />
            </TableBody>
          </Table>
        </section>

        {/* Section 3: Workload (wRVUs) */}
        <section aria-labelledby="section-workload">
          <h3 id="section-workload" className="mb-3 text-xs font-medium text-primary">
            Workload (wRVUs)
          </h3>
          <Table className="table-fixed border-collapse border border-border">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
              <col style={{ width: VALUE_CELL_WIDTH }} />
            </colgroup>
            <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 font-semibold md:border-r">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    CURRENT (Baseline)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 font-semibold md:border-r">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    MODELED (Scenario)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-2.5 text-right font-semibold" style={{ width: VALUE_CELL_WIDTH }}>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Variance
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
          <ComparisonRow
            labelLeft="Work wRVUs"
            valueLeft={currentWorkWRVUs > 0 ? fmtNum(currentWorkWRVUs, 2) : '—'}
            labelRight="Work wRVUs"
            valueRight={{
              controls: (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Slider
                    min={0}
                    max={workWrvuSliderMax}
                    step={50}
                    value={[Math.min(workWrvuSliderMax, Math.max(0, modeledWorkWRVUs))]}
                    onValueChange={handleWorkWRVUsChange}
                    disabled={disabled}
                    className="min-w-0 flex-1 py-1"
                    aria-label="Modeled work wRVUs (slider adjusts work wRVUs for modeled scenario)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleWorkWRVUsReset}
                    disabled={disabled || isWorkWRVUsReset}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Reset modeled work wRVUs to baseline"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </div>
              ),
              value: (
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={editWork !== null ? editWork : fmtNum(modeledWorkWRVUs, 2)}
                  onFocus={(e) => {
                    setEditWork(fmtNum(modeledWorkWRVUs, 2))
                    setTimeout(() => (e.target as HTMLInputElement).select(), 0)
                  }}
                  onChange={(e) => setEditWork(e.target.value)}
                  onBlur={() => {
                    if (editWork === null) return
                    const v = Math.min(workWrvuSliderMax, Math.max(0, parseDecimalInput(editWork)))
                    handleWorkWRVUsChange([v])
                    setEditWork(null)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="0.00"
                  disabled={disabled}
                  className="h-8 w-full min-w-0 tabular-nums text-right text-sm"
                  style={{ maxWidth: VALUE_CELL_WIDTH }}
                  aria-label="Modeled work wRVUs (type value)"
                />
              ),
            }}
            isChanged={modeledWorkWRVUs !== currentWorkWRVUs}
            delta={modeledWorkWRVUs - currentWorkWRVUs}
            deltaFormat="integer"
          />
          <ComparisonRow
            labelLeft="Other wRVUs"
            valueLeft={currentOtherWRVUs > 0 ? fmtNum(currentOtherWRVUs, 2) : '—'}
            labelRight="Other wRVUs"
            valueRight={{
              controls: (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Slider
                    min={0}
                    max={otherWrvuSliderMax}
                    step={50}
                    value={[Math.min(otherWrvuSliderMax, Math.max(0, modeledOtherWRVUs))]}
                    onValueChange={handleOtherWRVUsChange}
                    disabled={disabled}
                    className="min-w-0 flex-1 py-1"
                    aria-label="Modeled other wRVUs (slider adjusts other wRVUs for modeled scenario)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleOtherWRVUsReset}
                    disabled={disabled || isOtherWRVUsReset}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Reset modeled other wRVUs to baseline"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </div>
              ),
              value: (
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={editOther !== null ? editOther : fmtNum(modeledOtherWRVUs, 2)}
                  onFocus={(e) => {
                    const el = e.target as HTMLInputElement
                    setEditOther(fmtNum(modeledOtherWRVUs, 2))
                    setTimeout(() => el.select(), 0)
                  }}
                  onChange={(e) => setEditOther(e.target.value)}
                  onBlur={() => {
                    if (editOther === null) return
                    const v = Math.min(otherWrvuSliderMax, Math.max(0, parseDecimalInput(editOther)))
                    handleOtherWRVUsChange([v])
                    setEditOther(null)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="0.00"
                  disabled={disabled}
                  className="h-8 w-full min-w-0 tabular-nums text-right text-sm"
                  style={{ maxWidth: VALUE_CELL_WIDTH }}
                  aria-label="Modeled other wRVUs (type value)"
                />
              ),
            }}
            isChanged={modeledOtherWRVUs !== currentOtherWRVUs}
            delta={modeledOtherWRVUs - currentOtherWRVUs}
            deltaFormat="integer"
          />
          <ComparisonRow
            labelLeft="Total wRVUs"
            valueLeft={totalWRVUs > 0 ? fmtNum(totalWRVUs, 2) : '—'}
            labelRight="Total wRVUs"
            valueRight={fmtNum(modeledWRVUs, 2)}
            isChanged={modeledWRVUs !== totalWRVUs}
            delta={modeledWRVUs - totalWRVUs}
            deltaFormat="integer"
          />
          <ComparisonRow
            labelLeft="Threshold (wRVUs)"
            valueLeft={annualThreshold > 0 ? fmtNum(annualThreshold, 2) : '—'}
            labelRight="Threshold (wRVUs)"
            valueRight={annualThreshold > 0 ? fmtNum(annualThreshold, 2) : '—'}
            title="Calculated as Clinical Salary ÷ Modeled CF"
          />
            </TableBody>
          </Table>
        </section>
      </CardContent>
    </Card>
    <TCCBreakdownDrawer
      open={tccBreakdownOpen}
      onOpenChange={setTccBreakdownOpen}
      provider={provider}
      results={results}
      scenarioInputs={scenarioInputs}
      fmtMoney={fmtMoney}
    />
    </>
  )
}
