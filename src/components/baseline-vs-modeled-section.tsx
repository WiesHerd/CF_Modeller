import React, { useState } from 'react'
import { DeltaIndicator, fmtMoney } from '@/components/delta-indicator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
      <TableCell className="border-border/80 bg-muted/20 px-4 py-3 align-middle md:border-r md:px-6">
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
      <TableCell className="border-border/80 px-4 py-3 align-middle md:border-r md:px-6">
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
      <TableCell className="border-border/60 px-3 py-3 text-right tabular-nums md:px-4" style={{ width: VALUE_CELL_WIDTH }}>
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

/** Dialog that shows how TCC (Total Compensation Cost) is aggregated from its components. */
function TCCBreakdownDialog({
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
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0) as number
  const baseSalary = n(provider?.baseSalary)
  const currentIncentiveForTCC = Math.max(0, results?.currentIncentive ?? 0)
  const annualIncentiveForTCC = Math.max(0, results?.annualIncentive ?? 0)
  const currentPsq = results?.currentPsqDollars ?? results?.psqDollars ?? 0
  const modeledPsq = results?.psqDollars ?? 0
  const qualityPayments = n(provider?.qualityPayments) || n(provider?.currentTCC) || 0
  const otherIncentives = n(provider?.otherIncentives) || 0
  const modeledBase =
    scenarioInputs.modeledBasePay != null && Number.isFinite(scenarioInputs.modeledBasePay)
      ? scenarioInputs.modeledBasePay
      : baseSalary

  const currentTCC = results?.currentTCC ?? 0
  const modeledTCC = results?.modeledTCC ?? 0

  const rows: { label: string; current: number; modeled: number }[] = [
    { label: 'Base salary (total)', current: baseSalary, modeled: modeledBase },
    { label: 'Incentive (wRVU)', current: currentIncentiveForTCC, modeled: annualIncentiveForTCC },
    { label: 'PSQ (Quality / VBP)', current: currentPsq, modeled: modeledPsq },
    ...(qualityPayments > 0 ? [{ label: 'Quality payments', current: qualityPayments, modeled: 0 as number }] : []),
    ...(otherIncentives > 0 ? [{ label: 'Other incentives', current: otherIncentives, modeled: 0 as number }] : []),
    { label: 'Total (TCC)', current: currentTCC, modeled: modeledTCC },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:min-w-[28rem] sm:max-w-2xl" aria-describedby="tcc-breakdown-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="size-5 text-muted-foreground" aria-hidden />
            How TCC is calculated
          </DialogTitle>
          <DialogDescription id="tcc-breakdown-desc">
            TCC = base salary (total) + incentive (wRVU) + PSQ + quality payments + other incentives. Base salary is total salary (non-clinical is part of it, not added separately). Click the TCC row anytime to see this breakdown.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border max-sm:min-w-0 max-sm:overflow-x-auto">
          <Table className="w-full table-auto">
            <colgroup>
              <col className="w-auto" />
              <col className="min-w-[7.5rem]" />
              <col className="min-w-[7.5rem]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Component</TableHead>
                <TableHead className="text-right tabular-nums font-medium">Current (Baseline)</TableHead>
                <TableHead className="text-right tabular-nums font-medium">Modeled (Scenario)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ label, current, modeled }) => (
                <TableRow key={label} className={cn(label.startsWith('Total') && 'border-t-2 border-border font-semibold')}>
                  <TableCell className="text-muted-foreground text-sm">{label}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-sm">{current > 0 ? fmtMoney(current) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-sm">{modeled > 0 ? fmtMoney(modeled) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
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

  const deltaCF = modeledCF - currentCF
  const deltaIncentiveDollars = annualIncentive - currentIncentive
  const deltaImputed = imputedModeled - imputedCurrent
  const deltaPsq = psqDollars - currentPsqDollars

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
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    CURRENT (Baseline)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    MODELED (Scenario)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-3 text-right font-semibold md:px-4" style={{ width: VALUE_CELL_WIDTH }}>
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
            title="Total guaranteed base (clinical + non-clinical). Override to model a base pay change; TCC = base + incentive + PSQ."
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
            labelLeft="PSQ $"
            valueLeft={currentPsqDollars > 0 ? fmtMoney(currentPsqDollars) : '—'}
            labelRight="PSQ $ (VBP %)"
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
                    aria-label="Value-based payment percentage (VBP / Quality payment), 0–50%. PSQ $ = this % of base or total pay depending on scenario PSQ basis."
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
          />
          <ComparisonRow
            labelLeft={
              <>
                <span>TCC</span>
                <Info className="ml-1 inline-block size-3.5 text-muted-foreground" aria-hidden />
              </>
            }
            valueLeft={currentTCC > 0 ? fmtMoney(currentTCC) : '—'}
            labelRight="TCC"
            valueRight={modeledTCC > 0 ? fmtMoney(modeledTCC) : '—'}
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
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    CURRENT (Baseline)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    MODELED (Scenario)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-3 text-right font-semibold md:px-4" style={{ width: VALUE_CELL_WIDTH }}>
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
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    CURRENT (Baseline)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-4 py-3 font-semibold md:border-r md:px-6">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    MODELED (Scenario)
                  </span>
                </TableHead>
                <TableHead className="border-border/80 bg-muted/20 px-3 py-3 text-right font-semibold md:px-4" style={{ width: VALUE_CELL_WIDTH }}>
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
    <TCCBreakdownDialog
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
