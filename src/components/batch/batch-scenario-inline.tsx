import { Card, CardContent } from '@/components/ui/card'
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
import type { ScenarioInputs, CFSource, ThresholdMethod, ThresholdProration, PSQBasis } from '@/types/scenario'

interface BatchScenarioInlineProps {
  inputs: ScenarioInputs
  onChange: (inputs: Partial<ScenarioInputs>) => void
  disabled?: boolean
  /** When "panel", render without outer Card and amber styling for embedding in Scenario Studio step 1. */
  variant?: 'default' | 'panel'
}

const inputClass = 'h-9 w-full text-center tabular-nums min-w-0'

export function BatchScenarioInline({
  inputs,
  onChange,
  disabled = false,
  variant = 'default',
}: BatchScenarioInlineProps) {
  const isTargetHaircut = inputs.cfSource === 'target_haircut'
  const isTargetPercentileOnly = inputs.cfSource === 'target_percentile'
  const showTargetPercentile = isTargetHaircut || isTargetPercentileOnly
  const isPanel = variant === 'panel'

  const content = (
    <>
      {!isPanel && (
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-lg bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <Sliders className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold text-foreground">Base scenario</h3>
              <p className="text-muted-foreground text-xs">
                Global settings for the entire batch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Option A: single block, two rows, one divider, no section headers */}
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Quality pay current (%)</Label>
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
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Quality pay modeled (%)</Label>
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
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Quality pay basis</Label>
            <Select
              value={inputs.psqBasis ?? 'base_salary'}
              onValueChange={(v) => onChange({ psqBasis: v as PSQBasis })}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base_salary">% of base salary</SelectItem>
                <SelectItem value="total_guaranteed">% of total guaranteed</SelectItem>
                <SelectItem value="total_pay">% of total pay (TCC)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label className="text-sm font-medium text-foreground">CF method</Label>
            <Select
              value={inputs.cfSource}
              onValueChange={(v) => onChange({ cfSource: v as CFSource })}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="target_percentile">Target percentile</SelectItem>
                <SelectItem value="target_haircut">Target percentile + CF adjustment</SelectItem>
                <SelectItem value="override">Fixed CF ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showTargetPercentile && (
            <div className="flex-1 min-w-[10rem] space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Target %ile</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={inputs.proposedCFPercentile}
                onChange={(e) =>
                  onChange({ proposedCFPercentile: Number(e.target.value) || 0 })
                }
                disabled={disabled}
                className={inputClass}
              />
            </div>
          )}
          {isTargetHaircut && (
            <div className="flex-1 min-w-[10rem] space-y-1.5">
              <Label className="text-sm font-medium text-foreground">CF adjustment (%)</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm shrink-0">−</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={inputs.haircutPct ?? 5}
                  onChange={(e) =>
                    onChange({ haircutPct: Number(e.target.value) || 5 })
                  }
                  disabled={disabled}
                  className={inputClass}
                />
              </div>
            </div>
          )}
          {inputs.cfSource === 'override' && (
            <div className="flex-1 min-w-[10rem] space-y-1.5">
              <Label className="text-sm font-medium text-foreground">CF ($/wRVU)</Label>
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
                }}
                disabled={disabled}
                placeholder="44.00"
                className={inputClass}
              />
            </div>
          )}
        </div>

        {/* Row 2: Threshold — one divider only */}
        <div className="border-t border-border/60 pt-5 mt-5 flex flex-wrap gap-x-6 gap-y-4 items-end">
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Threshold method</Label>
            <Select
              value={inputs.thresholdMethod}
              onValueChange={(v) => onChange({ thresholdMethod: v as ThresholdMethod })}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="derived">Clinical $ ÷ CF</SelectItem>
                <SelectItem value="annual">Annual threshold (direct input)</SelectItem>
                <SelectItem value="wrvu_percentile">wRVU percentile (from market)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs mt-1">Clinical $ ÷ CF = clinical pay ÷ CF (standard). Incentive only on wRVUs above threshold.</p>
          </div>
          {inputs.thresholdMethod === 'annual' && (
            <>
              <div className="flex-1 min-w-[10rem] space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Annual threshold (wRVUs)</Label>
                <Input
                  type="number"
                  min={0}
                  value={inputs.annualThreshold ?? 0}
                  onChange={(e) => onChange({ annualThreshold: Number(e.target.value) || 0 })}
                  disabled={disabled}
                  className={inputClass}
                />
              </div>
              <div className="flex-1 min-w-[10rem] space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Prorate by</Label>
                <Select
                  value={inputs.thresholdProration ?? 'none'}
                  onValueChange={(v) => onChange({ thresholdProration: v as ThresholdProration })}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 w-full min-w-0">
                    <SelectValue placeholder="Use as entered" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (use as entered)</SelectItem>
                    <SelectItem value="cFTE">Clinical FTE (cFTE)</SelectItem>
                    <SelectItem value="totalFTE">Total FTE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {inputs.thresholdMethod === 'wrvu_percentile' && (
            <div className="flex-1 min-w-[10rem] space-y-1.5">
              <Label className="text-sm font-medium text-foreground">wRVU %ile for threshold</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={inputs.wrvuPercentile ?? 50}
                onChange={(e) => onChange({ wrvuPercentile: Number(e.target.value) || 50 })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
          )}
        </div>
    </>
  )

  if (isPanel) {
    return <div className="space-y-4">{content}</div>
  }

  return (
    <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
      <CardContent className="py-5">
        {content}
      </CardContent>
    </Card>
  )
}
