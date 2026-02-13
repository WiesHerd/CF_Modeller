import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sliders } from 'lucide-react'
import type { ScenarioInputs, ThresholdMethod, CFSource, PSQBasis } from '@/types/scenario'
import type { ProviderRow } from '@/types/provider'

interface ScenarioControlsProps {
  inputs: ScenarioInputs
  onChange: (inputs: Partial<ScenarioInputs>) => void
  selectedProvider: ProviderRow | null
  disabled?: boolean
  /** When 'sharedOnly', only render the Shared (PSQ basis, threshold, etc.) section. Used with inline base scenario on batch. */
  variant?: 'full' | 'sharedOnly'
}

export function ScenarioControls({
  inputs,
  onChange,
  selectedProvider: _selectedProvider,
  disabled = false,
  variant = 'full',
}: ScenarioControlsProps) {
  const sharedSection = (
    <div className="space-y-5">
      <h3 className="border-border/60 border-b pb-2 text-sm font-semibold text-foreground">
        Shared (both current and modeled)
      </h3>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="field-block space-y-1.5">
          <Label className="text-sm font-medium text-foreground">PSQ basis</Label>
          <Select
            value={inputs.psqBasis ?? 'base_salary'}
            onValueChange={(v) => onChange({ psqBasis: v as PSQBasis })}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full touch-manipulation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base_salary">% of base salary</SelectItem>
              <SelectItem value="total_guaranteed">% of total guaranteed</SelectItem>
              <SelectItem value="total_pay">% of total pay (TCC)</SelectItem>
            </SelectContent>
          </Select>
          <p className="min-h-[2.5rem] text-muted-foreground text-xs leading-relaxed">
            {inputs.psqBasis === 'total_guaranteed'
              ? 'PSQ dollars = (base + non-clinical) × this %'
              : inputs.psqBasis === 'total_pay'
                ? 'PSQ is this % of total compensation (base + incentive + non-clinical + PSQ)'
                : 'PSQ dollars = base salary × this %'}
          </p>
        </div>
        <div className="field-block space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Threshold method</Label>
          <Select
            value={inputs.thresholdMethod}
            onValueChange={(v) =>
              onChange({ thresholdMethod: v as ThresholdMethod })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full touch-manipulation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="derived">
                Derived (clinical base ÷ CF)
              </SelectItem>
              <SelectItem value="annual">Annual threshold (direct input)</SelectItem>
              <SelectItem value="wrvu_percentile">
                wRVU percentile (from market)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="min-h-[2.5rem] text-muted-foreground text-xs leading-relaxed">
            Threshold = clinical base pay ÷ CF. Incentive is paid only on wRVUs above the threshold.
          </p>
        </div>
      </div>

      {inputs.thresholdMethod === 'annual' && (
        <div className="field-block border-border/40 border-t pt-4 space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Annual threshold (wRVUs)</Label>
          <Input
            type="number"
            min={0}
            value={inputs.annualThreshold ?? 0}
            onChange={(e) =>
              onChange({ annualThreshold: Number(e.target.value) || 0 })
            }
            disabled={disabled}
            className="h-10 max-w-[8rem] touch-manipulation"
          />
        </div>
      )}
      {inputs.thresholdMethod === 'wrvu_percentile' && (
        <div className="field-block border-border/40 border-t pt-4 space-y-1.5">
          <Label className="text-sm font-medium text-foreground">wRVU percentile for threshold</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={inputs.wrvuPercentile ?? 50}
            onChange={(e) =>
              onChange({ wrvuPercentile: Number(e.target.value) || 50 })
            }
            disabled={disabled}
            className="h-10 max-w-[8rem] touch-manipulation"
          />
        </div>
      )}
    </div>
  )

  if (variant === 'sharedOnly') {
    return (
      <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
        <CardContent className="pt-5">
          {sharedSection}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-left">
          <span className="flex size-10 items-center justify-center rounded-lg bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <Sliders className="size-5" />
          </span>
          <span>Scenario controls</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Current (baseline) */}
        <div className="space-y-5 rounded-xl border border-border/60 bg-muted/20 p-5">
          <h3 className="border-border/60 border-b pb-2 text-sm font-semibold text-foreground">
            Current (baseline)
          </h3>
          <div className="field-block space-y-1.5">
            <Label className="text-sm font-medium text-foreground">PSQ percent (current)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={inputs.currentPsqPercent ?? 0}
              onChange={(e) => {
                const raw = Number(e.target.value) || 0
                onChange({ currentPsqPercent: Math.min(50, Math.max(0, raw)) })
              }}
              disabled={disabled}
              className="h-10 max-w-[8rem] touch-manipulation"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Value-based payment % applied to current/actual compensation. Current TCC includes this PSQ.
            </p>
          </div>
        </div>

        {/* Modeled (scenario) */}
        <div className="space-y-5 rounded-xl border border-border/60 bg-muted/20 p-5">
          <h3 className="border-border/60 border-b pb-2 text-sm font-semibold text-foreground">
            Modeled (scenario)
          </h3>

          <div className="field-block space-y-1.5">
            <Label className="text-sm font-medium text-foreground">CF modeling method</Label>
            <Select
              value={inputs.cfSource}
              onValueChange={(v) => onChange({ cfSource: v as CFSource })}
              disabled={disabled}
            >
              <SelectTrigger className="h-10 w-full max-w-sm touch-manipulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="target_percentile">Target percentile</SelectItem>
                <SelectItem value="target_haircut">
                  Target percentile + CF adjustment
                </SelectItem>
                <SelectItem value="override">Override CF ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(inputs.cfSource === 'target_haircut' || inputs.cfSource === 'target_percentile') && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="field-block space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Target CF percentile</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={inputs.proposedCFPercentile}
                  onChange={(e) =>
                    onChange({
                      proposedCFPercentile: Number(e.target.value) || 0,
                    })
                  }
                  disabled={disabled}
                  className="h-10 touch-manipulation"
                />
                <p className="min-h-[2.5rem] text-muted-foreground text-xs leading-relaxed">
                  Market CF at this percentile (interpolated from market data)
                </p>
              </div>
              {inputs.cfSource === 'target_haircut' && (
                <div className="field-block space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">Conversion factor adjustment %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={inputs.haircutPct ?? 5}
                    onChange={(e) =>
                      onChange({
                        haircutPct: Number(e.target.value) ?? 5,
                      })
                    }
                    disabled={disabled}
                    className="h-10 touch-manipulation"
                  />
                  <p className="min-h-[2.5rem] text-muted-foreground text-xs leading-relaxed">
                    Reduces the CF so compensation can cover value-based payment or other carve-outs (e.g. 5%). Modeled CF = market CF at target percentile × (1 − adjustment %).
                  </p>
                </div>
              )}
            </div>
          )}

          {inputs.cfSource === 'override' && (
            <div className="field-block space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Override CF ($/wRVU)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={inputs.overrideCF ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  onChange({
                    overrideCF: v === '' ? undefined : Number(v),
                  })
                }
                }
                disabled={disabled}
                placeholder="e.g. 44.00"
                className="h-10 touch-manipulation"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Direct conversion factor for modeled scenario
              </p>
            </div>
          )}

          <div className="field-block border-border/40 border-t pt-4 space-y-1.5">
            <Label className="text-sm font-medium text-foreground">PSQ percent (modeled)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={inputs.psqPercent ?? 0}
              onChange={(e) => {
                const raw = Number(e.target.value) || 0
                onChange({ psqPercent: Math.min(50, Math.max(0, raw)) })
              }}
              disabled={disabled}
              className="h-10 max-w-[8rem] touch-manipulation"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Value-based payment % for the modeled scenario. Can differ from current (e.g. 0% modeled vs 5% current).
              In Batch mode, set this in CF Optimizer → step 4 (Total cash compensation) when Value-based payment is
              included.
            </p>
          </div>
        </div>

        {/* Shared (both current and modeled) */}
        {sharedSection}
      </CardContent>
    </Card>
  )
}
