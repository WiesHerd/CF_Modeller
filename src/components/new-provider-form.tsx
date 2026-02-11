import { UserPlus, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PSQBasis } from '@/types/scenario'
import { formatCurrency } from '@/utils/format'

export interface BasePayComponent {
  id: string
  label: string
  amount: number
}

export const BASE_PAY_PRESET_LABELS = [
  'Clinical',
  'Teaching',
  'Division chief',
  'Medical directorship',
  'Center director',
  'Program Director',
  'Other',
] as const

export interface NewProviderFormValues {
  providerName: string
  /** Guaranteed pay components; first "Clinical" (or first) = baseSalary, rest sum = nonClinicalPay. */
  basePayComponents: BasePayComponent[]
  clinicalFTE: number
  totalWRVUs: number
  productivityModel: 'base' | 'productivity'
}

function generateId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const DEFAULT_NEW_PROVIDER: NewProviderFormValues = {
  providerName: '',
  basePayComponents: [{ id: generateId(), label: 'Clinical', amount: 0 }],
  clinicalFTE: 1,
  totalWRVUs: 0,
  productivityModel: 'productivity',
}

interface NewProviderFormProps {
  values: NewProviderFormValues
  onChange: (values: Partial<NewProviderFormValues>) => void
  disabled?: boolean
  /** For read-only PSQ display: scenario PSQ % and basis. */
  psqPercent?: number
  psqBasis?: PSQBasis
}

function totalGuaranteedFromComponents(components: BasePayComponent[]): number {
  return components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
}

function clinicalAmountFromComponents(components: BasePayComponent[]): number {
  const clinical = components.find((c) => c.label === 'Clinical')
  if (clinical) return Number(clinical.amount) || 0
  return components.length > 0 ? (Number(components[0].amount) || 0) : 0
}

/** Derive baseSalary (Clinical or first) and nonClinicalPay (sum of rest) for compute/synthetic provider. */
export function deriveBasePayFromComponents(
  components: BasePayComponent[]
): { baseSalary: number; nonClinicalPay: number; totalGuaranteed: number } {
  const list = components?.length ? components : [{ id: 'default', label: 'Clinical', amount: 0 }]
  const clinical = clinicalAmountFromComponents(list)
  const total = totalGuaranteedFromComponents(list)
  return {
    baseSalary: clinical,
    nonClinicalPay: Math.max(0, total - clinical),
    totalGuaranteed: total,
  }
}

export function NewProviderForm({
  values,
  onChange,
  disabled = false,
  psqPercent = 0,
  psqBasis = 'base_salary',
}: NewProviderFormProps) {
  const components = values.basePayComponents?.length
    ? values.basePayComponents
    : [{ id: generateId(), label: 'Clinical', amount: 0 }]
  const totalGuaranteed = totalGuaranteedFromComponents(components)
  const clinicalAmount = clinicalAmountFromComponents(components)
  const psqBase = psqBasis === 'total_guaranteed' ? totalGuaranteed : clinicalAmount
  const psqDollarsPreview = psqBase * ((psqPercent ?? 0) / 100)

  const updateComponent = (id: string, updates: Partial<BasePayComponent>) => {
    const next = components.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    )
    onChange({ basePayComponents: next })
  }

  const addComponent = () => {
    onChange({
      basePayComponents: [
        ...components,
        { id: generateId(), label: 'Teaching', amount: 0 },
      ],
    })
  }

  const removeComponent = (id: string) => {
    if (components.length <= 1) return
    onChange({
      basePayComponents: components.filter((c) => c.id !== id),
    })
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-left">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
            <UserPlus className="size-5" />
          </span>
          <span>Hypothetical provider inputs</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-muted-foreground text-sm">
          Enter the key inputs for the provider you want to model. Market is set above.
        </p>

        <div className="space-y-2">
          <Label>Name (optional)</Label>
          <Input
            placeholder="e.g. New hire"
            value={values.providerName}
            onChange={(e) => onChange({ providerName: e.target.value })}
            disabled={disabled}
            className="min-h-[44px] touch-manipulation"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Guaranteed compensation
          </Label>
          <p className="text-muted-foreground text-xs">
            Add components (e.g. Clinical, Teaching, Division chief). Total rolls up to base for TCC.
          </p>
          <div className="space-y-2">
            {components.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 sm:flex-nowrap"
              >
                <Select
                  value={c.label}
                  onValueChange={(v) => updateComponent(c.id, { label: v })}
                  disabled={disabled}
                >
                  <SelectTrigger className="min-h-[40px] w-full flex-1 touch-manipulation sm:max-w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_PAY_PRESET_LABELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={c.amount || ''}
                  onChange={(e) =>
                    updateComponent(c.id, {
                      amount: Number(e.target.value) || 0,
                    })
                  }
                  disabled={disabled}
                  placeholder="0"
                  className="min-h-[40px] w-28 shrink-0 touch-manipulation tabular-nums"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeComponent(c.id)}
                  disabled={disabled || components.length <= 1}
                  aria-label="Remove component"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={addComponent}
              disabled={disabled}
            >
              <Plus className="size-4 mr-1.5" />
              Add component
            </Button>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <span className="text-muted-foreground text-sm font-medium">
              Total guaranteed
            </span>
            <span className="tabular-nums font-medium">
              {formatCurrency(totalGuaranteed, { decimals: 0 })}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Value-based / PSQ
          </Label>
          <p className="text-muted-foreground rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs">
            PSQ is set in Scenario controls below. At {psqPercent}% of{' '}
            {psqBasis === 'total_guaranteed' ? 'total guaranteed' : 'base salary'} →{' '}
            <span className="tabular-nums font-medium">
              {formatCurrency(psqDollarsPreview, { decimals: 0 })}
            </span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Clinical FTE</Label>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={values.clinicalFTE}
              onChange={(e) =>
                onChange({ clinicalFTE: Number(e.target.value) || 0 })
              }
              disabled={disabled}
              className="min-h-[44px] touch-manipulation"
            />
          </div>
          <div className="space-y-2">
            <Label>Total wRVUs</Label>
            <Input
              type="number"
              min={0}
              step={100}
              value={values.totalWRVUs || ''}
              onChange={(e) =>
                onChange({ totalWRVUs: Number(e.target.value) || 0 })
              }
              disabled={disabled}
              className="min-h-[44px] touch-manipulation"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Productivity model</Label>
          <Select
            value={values.productivityModel}
            onValueChange={(v: 'base' | 'productivity') =>
              onChange({ productivityModel: v })
            }
            disabled={disabled}
          >
            <SelectTrigger className="min-h-[44px] w-full touch-manipulation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="productivity">Productivity</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
