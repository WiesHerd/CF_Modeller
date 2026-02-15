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
import type { ScenarioInputs, CFSource } from '@/types/scenario'

interface BatchScenarioInlineProps {
  inputs: ScenarioInputs
  onChange: (inputs: Partial<ScenarioInputs>) => void
  disabled?: boolean
}

const inputClass = 'h-9 w-full text-center tabular-nums min-w-0'

export function BatchScenarioInline({
  inputs,
  onChange,
  disabled = false,
}: BatchScenarioInlineProps) {
  const isTargetHaircut = inputs.cfSource === 'target_haircut'
  const isTargetPercentileOnly = inputs.cfSource === 'target_percentile'
  const showTargetPercentile = isTargetHaircut || isTargetPercentileOnly

  return (
    <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
      <CardContent className="py-5">
        {/* Top left: logo + title + global settings note */}
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

        {/* Fields: flex row, even spacing, fill horizontal space */}
        <div className="flex flex-wrap w-full gap-x-6 gap-y-4">
          <div className="flex-1 min-w-[9rem] space-y-1.5">
            <Label className="text-sm font-medium text-foreground">PSQ current (%)</Label>
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

          <div className="flex-1 min-w-[9rem] space-y-1.5">
            <Label className="text-sm font-medium text-foreground">PSQ modeled (%)</Label>
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

          <div className="flex-1 min-w-[9rem] space-y-1.5">
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
            <>
              <div className="flex-1 min-w-[9rem] space-y-1.5">
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
              {isTargetHaircut && (
                <div className="flex-1 min-w-[9rem] space-y-1.5">
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
            </>
          )}

          {inputs.cfSource === 'override' && (
            <div className="flex-1 min-w-[9rem] space-y-1.5">
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
                }
                }
                disabled={disabled}
                placeholder="44.00"
                className={inputClass}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
