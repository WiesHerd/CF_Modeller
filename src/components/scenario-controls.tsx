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
import type { ScenarioInputs, ThresholdMethod } from '@/types/scenario'
import type { ProviderRow } from '@/types/provider'

interface ScenarioControlsProps {
  inputs: ScenarioInputs
  onChange: (inputs: Partial<ScenarioInputs>) => void
  selectedProvider: ProviderRow | null
  disabled?: boolean
}

export function ScenarioControls({
  inputs,
  onChange,
  selectedProvider,
  disabled = false,
}: ScenarioControlsProps) {
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
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Proposed CF percentile</Label>
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
              className="min-h-[44px] touch-manipulation"
            />
          </div>
          <div className="space-y-2">
            <Label title="1.0 = no carve-out (e.g. no PSQ carve-out)">
              CF Adjustment Factor
            </Label>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={inputs.cfAdjustmentFactor}
              onChange={(e) =>
                onChange({
                  cfAdjustmentFactor: Number(e.target.value) || 1,
                })
              }
              disabled={disabled}
              className="min-h-[44px] touch-manipulation"
            />
            <p className="text-muted-foreground text-xs">1.0 = no carve-out</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>PSQ percent (value-based payment)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={inputs.psqPercent ?? 0}
            onChange={(e) =>
              onChange({ psqPercent: Number(e.target.value) || 0 })
            }
            disabled={disabled}
            className="min-h-[44px] touch-manipulation"
          />
          <p className="text-muted-foreground text-xs">
            Percentage of base salary; PSQ dollars = base salary × this %
          </p>
        </div>

        <div className="space-y-2">
          <Label>Threshold method</Label>
          <Select
            value={inputs.thresholdMethod}
            onValueChange={(v) =>
              onChange({ thresholdMethod: v as ThresholdMethod })
            }
            disabled={disabled}
          >
            <SelectTrigger className="min-h-[44px] w-full max-w-xs touch-manipulation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Annual threshold (direct input)</SelectItem>
              <SelectItem value="wrvu_percentile">
                wRVU percentile (from market)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {inputs.thresholdMethod === 'annual' && (
          <div className="space-y-2">
            <Label>Annual threshold (wRVUs)</Label>
            <Input
              type="number"
              min={0}
              value={inputs.annualThreshold ?? 0}
              onChange={(e) =>
                onChange({ annualThreshold: Number(e.target.value) || 0 })
              }
              disabled={disabled}
              className="min-h-[44px] touch-manipulation"
            />
          </div>
        )}

        {inputs.thresholdMethod === 'wrvu_percentile' && (
          <div className="space-y-2">
            <Label>wRVU percentile for threshold</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={inputs.wrvuPercentile ?? 50}
              onChange={(e) =>
                onChange({ wrvuPercentile: Number(e.target.value) || 50 })
              }
              disabled={disabled}
              className="min-h-[44px] touch-manipulation"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
