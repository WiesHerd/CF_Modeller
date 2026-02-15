import { useState, useRef, useEffect } from 'react'
import { User, BarChart3, ChevronDown, ChevronUp, Calculator, Plus, Trash2, LayoutList, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProviderRow, BasePayComponent } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, ScenarioResults } from '@/types/scenario'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/format'

function fmtMoney(n: number, decimals = 2): string {
  return formatCurrency(n, { decimals })
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Parse input that may include $ and commas into a number. */
function parseCurrencyInput(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Currency input that doesn't reformat on every keystroke, so typing "5000" or "5,000" works.
 * Shows formatted value when blurred; while focused keeps raw string so digits aren't lost.
 */
function CurrencyField({
  value,
  onChange,
  placeholder = '$0.00',
  className,
  id,
}: {
  value: number
  onChange: (n: number) => void
  placeholder?: string
  className?: string
  id?: string
}) {
  const [focused, setFocused] = useState(false)
  const [localStr, setLocalStr] = useState('')

  const displayValue = focused
    ? localStr
    : value != null && value > 0
      ? fmtMoney(value)
      : ''

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      value={displayValue}
      onFocus={() => {
        setFocused(true)
        setLocalStr(value > 0 ? String(value) : '')
      }}
      onChange={(e) => {
        if (!focused) return
        setLocalStr(e.target.value)
      }}
      onBlur={() => {
        const parsed = parseCurrencyInput(localStr)
        onChange(Number.isFinite(parsed) ? parsed : 0)
        setFocused(false)
        setLocalStr('')
      }}
    />
  )
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

function generateId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const COMPONENT_PRESET_LABELS = [
  'Clinical',
  'Teaching',
  'Division chief',
  'Medical directorship',
  'Center director',
  'Program Director',
  'Stipends',
  'Non-clinical',
  'Other',
] as const

const COMPONENT_CUSTOM_VALUE = '__custom__' as const

interface ModellerTopSectionProps {
  provider: ProviderRow | null
  marketRow: MarketRow | null
  scenarioInputs: ScenarioInputs
  specialtyLabel?: string
  onUpdateProvider?: (updates: Partial<ProviderRow>) => void
  /** Called after provider Save; use to sync current scenario in Scenario planning. */
  onSaveComplete?: (updatedProvider: ProviderRow) => void
  /** When true, productivity model is read-only (e.g. existing provider from upload). */
  readOnlyProductivityModel?: boolean
  /** When present, show TCC/wRVU percentiles and imputed TCC per wRVU after selection. */
  results?: ScenarioResults | null
  /** When true, do not render the statistics card (e.g. when it is embedded in the provider & market card). */
  embedStatisticsInProviderCard?: boolean
}

/** Market data card (TCC / wRVU / CF percentiles). Rendered at bottom of page. */
export function MarketDataCard({
  marketRow,
  specialtyLabel,
}: {
  marketRow: MarketRow | null
  specialtyLabel?: string
}) {
  const [marketDataVisible, setMarketDataVisible] = useState(true)
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
              <BarChart3 className="size-5" />
            </span>
            <span>
              Market data
              {specialtyLabel ? ` – ${specialtyLabel}` : ''}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setMarketDataVisible((v) => !v)}
            aria-expanded={marketDataVisible}
          >
            {marketDataVisible ? (
              <>
                <span className="hidden sm:inline">Hide</span>
                <ChevronUp className="size-4 sm:ml-1" />
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Show</span>
                <ChevronDown className="size-4 sm:ml-1" />
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      {marketDataVisible && (
        <CardContent>
          {marketRow == null ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Select a specialty above to see market data.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                  TCC (Total Compensation Cost)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">25th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_25)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">50th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_50)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">75th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_75)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">90th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.TCC_90)}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                  wRVUs (Work Relative Value Units)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">25th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_25, 2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">50th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_50, 2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">75th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_75, 2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">90th</div>
                    <div className="tabular-nums">{fmtNum(marketRow.WRVU_90, 2)}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                  CFs (Conversion Factors)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">25th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_25)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">50th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_50)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">75th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_75)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">90th</div>
                    <div className="tabular-nums">{fmtMoney(marketRow.CF_90)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

/** Props for the statistics content only (no card wrapper). */
export interface ProviderStatisticsContentProps {
  provider: ProviderRow
  onUpdateProvider?: (updates: Partial<ProviderRow>) => void
  /** Called after provider Save; use to sync current scenario in Scenario planning. */
  onSaveComplete?: (updatedProvider: ProviderRow) => void
  readOnlyProductivityModel?: boolean
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Label className="text-muted-foreground shrink-0 text-sm font-medium">
        {label}
      </Label>
      <div className="min-w-0 flex-1 sm:max-w-[200px]">{children}</div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
        {title}
      </h3>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  )
}

/** One field in a compact row: label + value. Fixed label height for baseline alignment across row. */
function InlineField({
  label,
  labelHint,
  labelIcon,
  children,
  className,
}: {
  label: string
  labelHint?: string
  /** Optional icon (e.g. Calculator) to show calculated/derived field. */
  labelIcon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 grid-rows-[1.25rem_2rem] gap-1', className)}>
      <div className="text-muted-foreground flex min-h-5 items-center gap-1.5 text-xs font-medium line-clamp-2">
        {label}
        {labelHint != null && labelHint !== '' && (
          <span className="text-muted-foreground/80 font-normal">{labelHint}</span>
        )}
        {labelIcon != null && <span className="shrink-0 text-muted-foreground/70">{labelIcon}</span>}
      </div>
      <div className="min-h-8 [&_input]:h-8 [&_input]:w-full [&_input]:text-right">
        {children}
      </div>
    </div>
  )
}

interface CompensationFTESectionProps {
  baseSalary: number
  nonClinicalPay: number
  qualityPayments: number
  otherIncentives: number
  cFTESalary: number
  totalWRVUs: number
  otherWRVUs: number
  totalFTE: number
  adminFTE: number
  clinicalFTE: number
  researchFTE: number
  teachingFTE: number
  canEdit: boolean
  /** When set, these components roll up to TCC (total base). */
  basePayComponents?: BasePayComponent[]
  /** Current provider (for building updated snapshot when saving). */
  provider?: ProviderRow | null
  onUpdateProvider?: (updates: Partial<ProviderRow>) => void
  /** Called after provider is saved; use to sync current scenario in Scenario planning. */
  onSaveComplete?: (updatedProvider: ProviderRow) => void
}

/** Compensation & FTE section with a single grid for aligned labels and values. */
function CompensationFTESection({
  baseSalary,
  nonClinicalPay,
  qualityPayments,
  otherIncentives,
  cFTESalary,
  totalWRVUs,
  otherWRVUs,
  totalFTE,
  adminFTE,
  clinicalFTE,
  researchFTE,
  teachingFTE,
  canEdit,
  basePayComponents,
  provider: _provider,
  onUpdateProvider,
  onSaveComplete: _onSaveComplete,
}: CompensationFTESectionProps) {
  const inputClass =
    'h-8 w-full touch-manipulation rounded-md border border-border bg-muted/40 px-2 tabular-nums text-right text-sm shadow-sm focus-visible:bg-card'

  const totalFTEValid = (totalFTE ?? 0) >= 1.0
  const calculatedNonClinical = totalFTEValid ? (adminFTE ?? 0) * (baseSalary ?? 0) : null

  const components = basePayComponents?.length ? basePayComponents : []
  const totalFromComponents = components.reduce((s, c) => s + (Number(c?.amount) || 0), 0)
  const useComponents = canEdit && components.length > 0

  type OriginalCompensation = {
    baseSalary: number
    nonClinicalPay: number
    clinicalFTESalary: number | undefined
    qualityPayments: number
    otherIncentives: number
  }
  const originalCompensationRef = useRef<OriginalCompensation | null>(null)
  const prevProviderIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const id = _provider?.providerId?.toString()
    if (id != null && id !== prevProviderIdRef.current) {
      prevProviderIdRef.current = id
      const p = _provider
      const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0) as number
      originalCompensationRef.current = {
        baseSalary: num(p?.baseSalary),
        nonClinicalPay: num(p?.nonClinicalPay),
        clinicalFTESalary:
          typeof p?.clinicalFTESalary === 'number' && Number.isFinite(p.clinicalFTESalary)
            ? p.clinicalFTESalary
            : undefined,
        qualityPayments: num(p?.qualityPayments),
        otherIncentives: num(p?.otherIncentives),
      }
    }
  }, [_provider?.providerId])

  const handleCalculateNonClinical = () => {
    if (!totalFTEValid || calculatedNonClinical == null || !onUpdateProvider) return
    onUpdateProvider({ nonClinicalPay: round2(calculatedNonClinical) })
  }

  const handleResetSection = () => {
    if (!onUpdateProvider || !originalCompensationRef.current) return
    const orig = originalCompensationRef.current
    onUpdateProvider({
      baseSalary: orig.baseSalary,
      nonClinicalPay: orig.nonClinicalPay,
      clinicalFTESalary: orig.clinicalFTESalary,
      qualityPayments: orig.qualityPayments,
      otherIncentives: orig.otherIncentives,
      basePayComponents: undefined,
    })
  }

  const addComponents = () => {
    if (!onUpdateProvider) return
    const clinical = Math.max(0, (baseSalary ?? 0) - (nonClinicalPay ?? 0))
    const nonClinical = nonClinicalPay ?? 0
    onUpdateProvider({
      basePayComponents: [
        { id: generateId(), label: 'Clinical', amount: round2(clinical) },
        { id: generateId(), label: 'Non-clinical', amount: round2(nonClinical) },
      ],
    })
  }

  const updateComponent = (id: string, updates: Partial<BasePayComponent>) => {
    if (!onUpdateProvider || !components.length) return
    const next = components.map((c) => (c.id === id ? { ...c, ...updates } : c))
    onUpdateProvider({ basePayComponents: next })
  }

  const addComponent = () => {
    if (!onUpdateProvider) return
    onUpdateProvider({
      basePayComponents: [
        ...components,
        { id: generateId(), label: 'Teaching', amount: 0 },
      ],
    })
  }

  const removeComponent = (id: string) => {
    if (!onUpdateProvider || components.length <= 1) return
    onUpdateProvider({ basePayComponents: components.filter((c) => c.id !== id) })
  }

  const clearComponents = () => {
    if (!onUpdateProvider) return
    const total = (totalFromComponents || baseSalary) ?? 0
    onUpdateProvider({
      basePayComponents: undefined,
      baseSalary: round2(total),
      nonClinicalPay: nonClinicalPay ?? 0,
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Panel 1: Compensation */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Compensation
            </h4>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={handleResetSection}
                title="Reset all compensation fields to original values"
                aria-label="Reset compensation section to original"
              >
                <RotateCcw className="size-3.5" />
                Reset to original
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mb-3 text-xs">
            Base salary is total salary (includes non-clinical). Non-Clinical is a breakout only; it does not change TCC.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
        {useComponents ? (
          <>
            <div className="col-span-full space-y-3">
              <div className="grid gap-x-4 items-center text-muted-foreground text-xs font-medium" style={{ gridTemplateColumns: 'minmax(0, 11rem) 8rem 2.25rem' }}>
                <span>Component</span>
                <span className="text-right">Amount</span>
                <span />
              </div>
              <div className="grid gap-x-4 gap-y-2 items-center" style={{ gridTemplateColumns: 'minmax(0, 11rem) 8rem 2.25rem' }}>
                {components.map((c) => {
                  const isCustom =
                    !(COMPONENT_PRESET_LABELS as readonly string[]).includes(c.label)
                  const selectValue = isCustom ? COMPONENT_CUSTOM_VALUE : c.label
                  return (
                  <div key={c.id} className="contents">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="rounded-md border border-border/80 bg-background px-2 py-1.5 shadow-sm">
                        <Select
                          value={selectValue}
                          onValueChange={(v) =>
                            updateComponent(c.id, {
                              label: v === COMPONENT_CUSTOM_VALUE ? '' : v,
                            })
                          }
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="h-8 min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0">
                            {selectValue === COMPONENT_CUSTOM_VALUE ? (
                              <span className="text-muted-foreground truncate">
                                {c.label || 'Custom...'}
                              </span>
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {COMPONENT_PRESET_LABELS.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                            <SelectItem value={COMPONENT_CUSTOM_VALUE}>
                              Custom...
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {isCustom && (
                        <Input
                          placeholder="Enter component name"
                          value={c.label}
                          onChange={(e) =>
                            updateComponent(c.id, { label: e.target.value })
                          }
                          className="h-7 border-border/80 bg-background text-xs shadow-sm"
                          disabled={!canEdit}
                        />
                      )}
                    </div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={c.amount > 0 ? fmtMoney(c.amount) : ''}
                      onChange={(e) => {
                        const v = parseCurrencyInput(e.target.value)
                        updateComponent(c.id, { amount: Number.isFinite(v) ? v : 0 })
                      }}
                      placeholder="$0"
                      className={`${inputClass} h-8 w-full text-right`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeComponent(c.id)}
                      disabled={components.length <= 1}
                      aria-label="Remove component"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addComponent}
                  disabled={!canEdit}
                >
                  <Plus className="size-4 mr-1.5" />
                  Add component
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-8 shrink-0"
                  onClick={clearComponents}
                  disabled={!canEdit}
                  title="Switch to simple view (Base + Non-Clinical)"
                  aria-label="Switch to simple view (Base + Non-Clinical)"
                >
                  <LayoutList className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="grid gap-x-4 items-baseline pt-2 border-t border-border/60" style={{ gridTemplateColumns: 'minmax(0, 11rem) 8rem 2.25rem' }}>
                <span className="text-muted-foreground text-xs font-medium">Total base (TCC)</span>
                <span className="tabular-nums font-medium text-sm text-right">
                  {totalFromComponents > 0 ? fmtMoney(totalFromComponents) : '—'}
                </span>
                <span />
              </div>
            </div>
          </>
        ) : (
          <>
            <InlineField label="Base salary">
              {canEdit ? (
                <CurrencyField
                  value={baseSalary ?? 0}
                  onChange={(v) => {
                    const newBase = Number.isFinite(v) ? v : 0
                    if (totalFTE > 0 && newBase >= 0) {
                      const derivedCFTE = round2(newBase * (clinicalFTE / totalFTE))
                      const derivedNonClinical = round2(newBase - derivedCFTE)
                      onUpdateProvider?.({
                        baseSalary: newBase,
                        clinicalFTESalary: undefined,
                        nonClinicalPay: derivedNonClinical,
                      })
                    } else {
                      onUpdateProvider?.({ baseSalary: newBase })
                    }
                  }}
                  placeholder="$0.00"
                  className={`${inputClass} text-right`}
                />
              ) : (
                <span className="tabular-nums text-sm text-right">
                  {baseSalary != null ? fmtMoney(baseSalary) : '—'}
                </span>
              )}
            </InlineField>
            <InlineField label="Non-Clinical" labelHint="(breakout)">
              {canEdit ? (
                <div className="flex items-center gap-1.5">
                  <CurrencyField
                    value={nonClinicalPay ?? 0}
                    onChange={(v) => {
                      const val = Number.isFinite(v) ? v : 0
                      const newBase = round2((cFTESalary ?? 0) + val)
                      onUpdateProvider?.({
                        nonClinicalPay: val,
                        baseSalary: newBase,
                        clinicalFTESalary: cFTESalary,
                      })
                    }}
                    placeholder="$0.00"
                    className={`${inputClass} text-right flex-1 min-w-0`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleCalculateNonClinical}
                    disabled={!totalFTEValid}
                    title={
                      totalFTEValid
                        ? 'Set Non-Clinical to Admin FTE × Base salary'
                        : 'Total FTE must be ≥ 1.0 for this calculation'
                    }
                    aria-label="Calculate non-clinical from admin FTE × base salary"
                  >
                    <Calculator className="size-4" />
                  </Button>
                </div>
              ) : (
                <span className="tabular-nums text-sm text-right">
                  {nonClinicalPay != null && nonClinicalPay > 0
                    ? fmtMoney(nonClinicalPay)
                    : '—'}
                </span>
              )}
            </InlineField>
            <InlineField label="cFTE Salary">
              {canEdit ? (
                <CurrencyField
                  value={cFTESalary ?? 0}
                  onChange={(v) => {
                    const val = Number.isFinite(v) ? v : 0
                    const newBase = round2(val + (nonClinicalPay ?? 0))
                    onUpdateProvider?.({ clinicalFTESalary: val, baseSalary: newBase })
                  }}
                  placeholder="$0.00"
                  className={`${inputClass} text-right`}
                />
              ) : (
                <span className="tabular-nums text-sm text-right">
                  {cFTESalary > 0 ? fmtMoney(cFTESalary) : '—'}
                </span>
              )}
            </InlineField>
            <InlineField label="Quality payments">
              {canEdit ? (
                <CurrencyField
                  value={qualityPayments ?? 0}
                  onChange={(v) => onUpdateProvider?.({ qualityPayments: Number.isFinite(v) ? v : 0 })}
                  placeholder="$0.00"
                  className={`${inputClass} text-right`}
                />
              ) : (
                <span className="tabular-nums text-sm text-right">
                  {qualityPayments != null && qualityPayments > 0 ? fmtMoney(qualityPayments) : '—'}
                </span>
              )}
            </InlineField>
            <InlineField label="Other incentives">
              {canEdit ? (
                <CurrencyField
                  value={otherIncentives ?? 0}
                  onChange={(v) =>
                    onUpdateProvider?.({ otherIncentives: Number.isFinite(v) ? v : 0 })
                  }
                  placeholder="$0.00"
                  className={`${inputClass} text-right`}
                />
              ) : (
                <span className="tabular-nums text-sm text-right">
                  {otherIncentives != null && otherIncentives > 0 ? fmtMoney(otherIncentives) : '—'}
                </span>
              )}
            </InlineField>
            <InlineField label="TCC" labelIcon={<Calculator className="size-3.5" />}>
              <Input
                readOnly
                title="Base salary (total) + quality payments + other incentives. Non-Clinical is not added—it is part of base. Full TCC also includes wRVU incentive and PSQ from the Scenario step."
                value={
                  (baseSalary ?? 0) + (qualityPayments ?? 0) + (otherIncentives ?? 0) > 0
                    ? fmtMoney((baseSalary ?? 0) + (qualityPayments ?? 0) + (otherIncentives ?? 0))
                    : '—'
                }
                className={`${inputClass} bg-muted/40 cursor-default font-medium`}
              />
            </InlineField>
            {canEdit && (
              <div className="col-span-full space-y-1">
                <p className="text-muted-foreground text-xs">
                  Add line items (e.g. Medical directorship, Stipends, Teaching) that roll up to Total Cash Compensation.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addComponents}
                  className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Plus className="size-4 mr-1.5" />
                  Add components (roll up to TCC)
                </Button>
              </div>
            )}
          </>
        )}

        {canEdit && !totalFTEValid && !useComponents && (
          <div className="col-span-full pt-1">
            <span className="text-muted-foreground text-xs">
              Total FTE ≥ 1.0 required to calculate non-clinical (use calculator icon next to Non-Clinical).
            </span>
          </div>
        )}
          </div>
        </div>

        {/* Panel 2: wRVUs */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
            wRVUs
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <InlineField label="Total wRVUs">
          {canEdit ? (
            <Input
              type="text"
              inputMode="decimal"
              value={
                totalWRVUs != null && totalWRVUs > 0
                  ? fmtNum(round2(totalWRVUs), 2)
                  : ''
              }
              onChange={(e) => {
                const v = round2(parseFloat(e.target.value.replace(/,/g, '')) || 0)
                onUpdateProvider?.({
                  totalWRVUs: v,
                  workRVUs: v,
                })
              }}
              placeholder="0.00"
              className={`${inputClass} text-right`}
            />
          ) : (
            <span className="tabular-nums text-sm text-right">
              {totalWRVUs != null ? fmtNum(round2(totalWRVUs), 2) : '—'}
            </span>
          )}
        </InlineField>
        <InlineField label="Other wRVUs">
          {canEdit ? (
            <Input
              type="text"
              inputMode="decimal"
              value={
                otherWRVUs != null && otherWRVUs > 0
                  ? fmtNum(round2(otherWRVUs), 2)
                  : ''
              }
              onChange={(e) => {
                const v = round2(parseFloat(e.target.value.replace(/,/g, '')) || 0)
                onUpdateProvider?.({
                  outsideWRVUs: v,
                })
              }}
              placeholder="0.00"
              className={`${inputClass} text-right`}
            />
          ) : (
            <span className="tabular-nums text-sm text-right">
              {otherWRVUs != null ? fmtNum(round2(otherWRVUs), 2) : '—'}
            </span>
          )}
        </InlineField>
          </div>
        </div>

        {/* Panel 3: FTE (CART) — CART order then Total last */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
            FTE (CART)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-4">
        <InlineField label="Clinical FTE">
          {canEdit ? (
            <Input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={
                clinicalFTE != null && clinicalFTE > 0
                  ? Number(clinicalFTE).toFixed(2)
                  : ''
              }
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                onUpdateProvider?.({
                  clinicalFTE: Number.isFinite(v) ? v : 0,
                })
              }}
              className={inputClass}
            />
          ) : (
            <span className="tabular-nums text-sm text-right">
              {clinicalFTE != null ? fmtNum(clinicalFTE, 2) : '—'}
            </span>
          )}
        </InlineField>
        <InlineField label="Admin FTE">
          {canEdit ? (
            <Input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={
                adminFTE > 0 ? Number(adminFTE).toFixed(2) : ''
              }
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                onUpdateProvider?.({
                  adminFTE: Number.isFinite(v) ? v : 0,
                })
              }}
              placeholder="0"
              className={inputClass}
            />
          ) : (
            <span className="tabular-nums text-sm text-right">
              {adminFTE != null && adminFTE > 0
                ? fmtNum(adminFTE, 2)
                : '—'}
            </span>
          )}
        </InlineField>
        <InlineField label="Research FTE">
          {canEdit ? (
            <Input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={
                researchFTE != null && researchFTE > 0
                  ? Number(researchFTE).toFixed(2)
                  : ''
              }
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                onUpdateProvider?.({ researchFTE: Number.isFinite(v) ? v : 0 })
              }}
              placeholder="0"
              className={inputClass}
            />
          ) : (
            <span className="tabular-nums text-sm text-right">
              {researchFTE != null && researchFTE > 0 ? fmtNum(researchFTE, 2) : '—'}
            </span>
          )}
        </InlineField>
        <InlineField label="Teaching FTE">
          {canEdit ? (
            <Input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={
                teachingFTE != null && teachingFTE > 0
                  ? Number(teachingFTE).toFixed(2)
                  : ''
              }
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                onUpdateProvider?.({ teachingFTE: Number.isFinite(v) ? v : 0 })
              }}
              placeholder="0"
              className={inputClass}
            />
          ) : (
            <span className="tabular-nums text-sm text-right">
              {teachingFTE != null && teachingFTE > 0 ? fmtNum(teachingFTE, 2) : '—'}
            </span>
          )}
        </InlineField>
        <InlineField label="Total FTE">
          {canEdit ? (
            <Input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={
                totalFTE != null && totalFTE > 0
                  ? Number(totalFTE).toFixed(2)
                  : ''
              }
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                onUpdateProvider?.({
                  totalFTE: Number.isFinite(v) ? v : 0,
                })
              }}
              className={inputClass}
            />
          ) : (
            <span className="tabular-nums text-sm text-right">
              {totalFTE != null ? fmtNum(totalFTE, 2) : '—'}
            </span>
          )}
        </InlineField>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Renders only the provider statistics sections (no card). For embedding in the provider & market card. */
export function ProviderStatisticsContent({
  provider,
  onUpdateProvider,
  onSaveComplete,
  readOnlyProductivityModel: _readOnlyProductivityModel = false,
}: ProviderStatisticsContentProps) {
  const totalFTE = provider.totalFTE ?? 0
  const clinicalFTE = provider.clinicalFTE ?? 0
  const adminFTE = provider.adminFTE ?? 0
  const researchFTE = provider.researchFTE ?? 0
  const teachingFTE = provider.teachingFTE ?? 0
  const baseSalary = provider.baseSalary ?? 0
  const nonClinicalPay = provider.nonClinicalPay ?? 0
  const qualityPayments = provider.qualityPayments ?? 0
  const otherIncentives = provider.otherIncentives ?? 0
  const otherWRVUs = provider.outsideWRVUs ?? 0
  const totalWRVUs =
    provider.totalWRVUs ??
    (provider.workRVUs ?? 0) +
      (provider.pchWRVUs ?? 0) +
      otherWRVUs
  const cFTESalary =
    provider.clinicalFTESalary != null && provider.clinicalFTESalary > 0
      ? provider.clinicalFTESalary
      : totalFTE > 0
        ? baseSalary * (clinicalFTE / totalFTE)
        : 0
  const canEdit = !!onUpdateProvider

  return (
    <div className="space-y-4">
      <CompensationFTESection
        baseSalary={baseSalary}
        nonClinicalPay={nonClinicalPay}
        qualityPayments={qualityPayments}
        otherIncentives={otherIncentives}
        cFTESalary={cFTESalary}
        totalWRVUs={totalWRVUs}
        otherWRVUs={otherWRVUs}
        totalFTE={totalFTE}
        adminFTE={adminFTE}
        clinicalFTE={clinicalFTE}
        researchFTE={researchFTE}
        teachingFTE={teachingFTE}
        canEdit={canEdit}
        basePayComponents={provider.basePayComponents}
        provider={provider}
        onUpdateProvider={onUpdateProvider}
        onSaveComplete={onSaveComplete}
      />
    </div>
  )
}

export function ModellerTopSection({
  provider,
  marketRow: _marketRow,
  scenarioInputs: _scenarioInputs,
  specialtyLabel: _specialtyLabel,
  onUpdateProvider,
  onSaveComplete,
  readOnlyProductivityModel: _readOnlyProductivityModel = false,
  results = null,
  embedStatisticsInProviderCard = false,
}: ModellerTopSectionProps) {
  const totalFTE = provider?.totalFTE ?? 0
  const clinicalFTE = provider?.clinicalFTE ?? 0
  const adminFTE = provider?.adminFTE ?? 0
  const researchFTE = provider?.researchFTE ?? 0
  const teachingFTE = provider?.teachingFTE ?? 0
  const baseSalary = provider?.baseSalary ?? 0
  const nonClinicalPay = provider?.nonClinicalPay ?? 0
  const qualityPayments = provider?.qualityPayments ?? 0
  const otherIncentives = provider?.otherIncentives ?? 0
  const otherWRVUs = provider?.outsideWRVUs ?? 0
  const totalWRVUs =
    provider?.totalWRVUs ??
    (() => {
      const w = provider?.workRVUs ?? 0
      const p = provider?.pchWRVUs ?? 0
      const o = otherWRVUs
      return w + p + o
    })()
  const cFTESalary =
    provider?.clinicalFTESalary != null && provider.clinicalFTESalary > 0
      ? provider.clinicalFTESalary
      : totalFTE > 0
        ? baseSalary * (clinicalFTE / totalFTE)
        : 0

  const canEdit = !!onUpdateProvider

  const statisticsCard = !embedStatisticsInProviderCard && (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-left">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted/80 text-accent-icon">
            <User className="size-5" />
          </span>
          <span>
            {provider != null && provider.providerName
              ? `${provider.providerName} – Statistics`
              : 'Provider statistics'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {provider == null ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Select a provider above to see statistics.
          </p>
        ) : (
          <>
              <CompensationFTESection
                baseSalary={baseSalary}
                nonClinicalPay={nonClinicalPay}
                qualityPayments={qualityPayments}
                otherIncentives={otherIncentives}
                cFTESalary={cFTESalary}
                totalWRVUs={totalWRVUs}
                otherWRVUs={otherWRVUs}
                totalFTE={totalFTE}
                adminFTE={adminFTE}
                clinicalFTE={clinicalFTE}
                researchFTE={researchFTE}
                teachingFTE={teachingFTE}
                canEdit={canEdit}
                basePayComponents={provider?.basePayComponents}
                provider={provider ?? undefined}
                onUpdateProvider={onUpdateProvider}
                onSaveComplete={onSaveComplete}
              />

              {results != null && (
                <Section title="Calculated (after selection)">
                  <FieldRow label="TCC percentile">
                    <span className="tabular-nums">
                      {results.tccPercentile != null
                        ? fmtNum(results.tccPercentile, 2)
                        : '—'}
                      {results.tccPercentileBelowRange && ' (below range)'}
                      {results.tccPercentileAboveRange && ' (above range)'}
                    </span>
                  </FieldRow>
                  <FieldRow label="wRVU percentile">
                    <span className="tabular-nums">
                      {results.wrvuPercentile != null
                        ? fmtNum(results.wrvuPercentile, 2)
                        : '—'}
                      {results.wrvuPercentileBelowRange && ' (below range)'}
                      {results.wrvuPercentileAboveRange && ' (above range)'}
                    </span>
                  </FieldRow>
                  <FieldRow label="CF percentile (current / modeled)">
                    <span className="tabular-nums">
                      {results.cfPercentileCurrent != null
                        ? fmtNum(results.cfPercentileCurrent, 2)
                        : '—'}
                      {' / '}
                      {results.cfPercentileModeled != null
                        ? fmtNum(results.cfPercentileModeled, 2)
                        : '—'}
                    </span>
                  </FieldRow>
                  <FieldRow label="Imputed TCC per wRVU (current)">
                    <span className="tabular-nums text-muted-foreground">
                      {results.imputedTCCPerWRVURatioCurrent > 0
                        ? fmtMoney(results.imputedTCCPerWRVURatioCurrent)
                        : '—'}
                    </span>
                  </FieldRow>
                  <FieldRow label="Imputed TCC per wRVU (modeled)">
                    <span className="tabular-nums text-muted-foreground">
                      {results.imputedTCCPerWRVURatioModeled > 0
                        ? fmtMoney(results.imputedTCCPerWRVURatioModeled)
                        : '—'}
                    </span>
                  </FieldRow>
                </Section>
              )}
            </>
          )}
        </CardContent>
      </Card>
  )

  return (
    <div className="flex flex-col gap-6">
      {statisticsCard}
    </div>
  )
}
