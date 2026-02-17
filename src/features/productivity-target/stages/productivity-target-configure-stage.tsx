import { useMemo, useState } from 'react'
import { Target, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Command, CommandInput } from '@/components/ui/command'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProductivityTargetSettings, TargetApproach, PlanningCFSource } from '@/types/productivity-target'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'

const CONFIG_STEPS = [
  { id: 1, label: 'Target scope' },
  { id: 2, label: 'Target method & planning' },
  { id: 3, label: 'Review & run' },
] as const

function SectionHeaderWithTooltip({
  title,
  tooltip,
  className,
}: {
  title: string
  tooltip: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="More information"
          >
            <Info className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[320px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function ProductivityTargetConfigureStage({
  hasData,
  settings,
  runDisabled,
  filteredProviderRowsCount,
  targetMode,
  selectedSpecialties,
  availableSpecialties,
  onRun,
  onSetTargetMode,
  onSetSelectedSpecialties,
  onSetSettings,
  configStep,
  onSetConfigStep,
}: {
  hasData: boolean
  settings: ProductivityTargetSettings
  runDisabled: boolean
  filteredProviderRowsCount: number
  targetMode: 'all' | 'custom'
  selectedSpecialties: string[]
  availableSpecialties: string[]
  onRun: () => void
  onSetTargetMode: (mode: 'all' | 'custom') => void
  onSetSelectedSpecialties: (specialties: string[]) => void
  onSetSettings: React.Dispatch<React.SetStateAction<ProductivityTargetSettings>>
  configStep: number
  onSetConfigStep: (step: number) => void
}) {
  const [specialtySearch, setSpecialtySearch] = useState('')
  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return availableSpecialties
    const q = specialtySearch.toLowerCase()
    return availableSpecialties.filter((s) => s.toLowerCase().includes(q))
  }, [availableSpecialties, specialtySearch])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Target className="size-6" aria-hidden />
            </div>
            <div>
              <CardTitle className="leading-tight">Productivity Target Builder</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Set a group wRVU target per specialty (1.0 cFTE) and scale by cFTE; compare actuals to target.
              </p>
            </div>
          </div>
          <TooltipProvider delayDuration={200}>
            <nav className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5" aria-label="Configuration steps">
              {CONFIG_STEPS.map((step) => {
                const isActive = configStep === step.id
                return (
                  <Tooltip key={step.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSetConfigStep(step.id)}
                        aria-current={isActive ? 'step' : undefined}
                        aria-label={`${step.label}${isActive ? ' (current)' : ''}`}
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded text-xs font-medium transition-colors',
                          isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {step.id}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {step.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </nav>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider delayDuration={200}>
          {!hasData ? (
            <WarningBanner message="Upload provider and market data on the Upload screen before running." />
          ) : null}

          {hasData ? (
            <>
              {configStep === 1 ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <SectionHeaderWithTooltip
                    title="Target scope"
                    tooltip="Choose which providers are included. All specialties uses everyone with a market match; custom lets you select specific specialties."
                  />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Specialty scope</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={targetMode === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onSetTargetMode('all')}
                      >
                        All specialties
                      </Button>
                      <Button
                        type="button"
                        variant={targetMode === 'custom' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onSetTargetMode('custom')}
                      >
                        Custom selection
                      </Button>
                    </div>
                  </div>
                  {targetMode === 'custom' ? (
                    <DropdownMenu onOpenChange={(open) => open && setSpecialtySearch('')}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="min-w-[220px] justify-between gap-2">
                          {selectedSpecialties.length === 0
                            ? 'Select specialties...'
                            : `${selectedSpecialties.length} specialty(ies)`}
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-[320px] overflow-hidden p-0">
                        <Command shouldFilter={false} className="rounded-none border-0">
                          <CommandInput
                            placeholder="Search specialties…"
                            value={specialtySearch}
                            onValueChange={setSpecialtySearch}
                            className="h-9"
                          />
                        </Command>
                        <div className="max-h-[240px] overflow-y-auto p-1">
                          <DropdownMenuLabel>Specialty</DropdownMenuLabel>
                          {filteredSpecialties.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                          ) : (
                            filteredSpecialties.map((specialty) => (
                              <DropdownMenuCheckboxItem
                                key={specialty}
                                checked={selectedSpecialties.includes(specialty)}
                                onCheckedChange={(checked) =>
                                  onSetSelectedSpecialties(
                                    checked ? [...selectedSpecialties, specialty] : selectedSpecialties.filter((s) => s !== specialty)
                                  )
                                }
                              >
                                {specialty}
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    {filteredProviderRowsCount} provider(s) in scope
                    {targetMode === 'custom' && selectedSpecialties.length > 0
                      ? ` across ${selectedSpecialties.length} specialty(ies)`
                      : ''}
                  </p>
                </div>
              ) : null}

              {configStep === 2 ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <SectionHeaderWithTooltip
                    title="Target method"
                    tooltip="Approach A: group target = market wRVU at chosen percentile. Approach B: group target = market pay at percentile ÷ market $/wRVU at CF percentile. Same 1.0 cFTE target for everyone in the specialty; scaled by cFTE per provider."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Approach</Label>
                      <Select
                        value={settings.targetApproach}
                        onValueChange={(v: TargetApproach) => onSetSettings((s) => ({ ...s, targetApproach: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wrvu_percentile">A: Market wRVU at percentile</SelectItem>
                          <SelectItem value="pay_per_wrvu">B: Market pay ÷ $/wRVU</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Target percentile (wRVU or pay)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={settings.targetPercentile}
                        onChange={(e) => {
                          const n = Math.min(99, Math.max(1, Number(e.target.value) || 50))
                          onSetSettings((s) => ({ ...s, targetPercentile: n }))
                        }}
                        className="w-24"
                      />
                    </div>
                    {settings.targetApproach === 'pay_per_wrvu' ? (
                      <div className="space-y-2">
                        <Label>CF percentile (for $/wRVU)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={settings.cfPercentile}
                          onChange={(e) => {
                            const n = Math.min(99, Math.max(1, Number(e.target.value) || 50))
                            onSetSettings((s) => ({ ...s, cfPercentile: n }))
                          }}
                          className="w-24"
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Alignment tolerance (± percentile pts)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={settings.alignmentTolerance}
                        onChange={(e) => {
                          const n = Math.min(30, Math.max(0, Number(e.target.value) || 10))
                          onSetSettings((s) => ({ ...s, alignmentTolerance: n }))
                        }}
                        className="w-24"
                      />
                    </div>
                  </div>

                  <SectionHeaderWithTooltip
                    title="Planning incentive (CF for potential payout)"
                    tooltip="Estimated incentive if threshold = group target and CF = chosen value; based on loaded wRVUs. For planning only. Does not alter the CF Optimizer."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>CF for planning</Label>
                      <Select
                        value={settings.planningCFSource}
                        onValueChange={(v: PlanningCFSource) => onSetSettings((s) => ({ ...s, planningCFSource: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="market_percentile">Market at percentile</SelectItem>
                          <SelectItem value="manual">Manual $/wRVU</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {settings.planningCFSource === 'market_percentile' ? (
                      <div className="space-y-2">
                        <Label>Planning CF percentile</Label>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={settings.planningCFPercentile}
                          onChange={(e) => {
                            const n = Math.min(99, Math.max(1, Number(e.target.value) || 50))
                            onSetSettings((s) => ({ ...s, planningCFPercentile: n }))
                          }}
                          className="w-24"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Manual $/wRVU</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={settings.planningCFManual ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            const n = raw === '' ? undefined : Number(raw)
                            onSetSettings((s) => ({ ...s, planningCFManual: n }))
                          }}
                          placeholder="e.g. 50"
                          className="w-24"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {configStep === 3 ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Summary</h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    <li>
                      Scope: {targetMode === 'all' ? 'All specialties' : `${selectedSpecialties.length} specialty(ies)`} ·{' '}
                      {filteredProviderRowsCount} providers
                    </li>
                    <li>
                      Target: Approach {settings.targetApproach === 'wrvu_percentile' ? 'A' : 'B'} at{' '}
                      {settings.targetPercentile}th percentile
                      {settings.targetApproach === 'pay_per_wrvu' ? `; CF at ${settings.cfPercentile}th` : ''}
                    </li>
                    <li>
                      Planning incentive: {settings.planningCFSource === 'market_percentile' ? `Market at ${settings.planningCFPercentile}th` : `Manual $${settings.planningCFManual ?? '—'}/wRVU`}
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Group target is the same wRVU (at 1.0 cFTE) for everyone in the specialty; scaled by cFTE per
                    provider. This sets the productivity expectation only—it does not change the conversion factor from
                    the CF Optimizer.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
                {configStep > 1 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => onSetConfigStep(configStep - 1)}>
                    Back
                  </Button>
                ) : (
                  <div />
                )}
                {configStep < 3 ? (
                  <Button type="button" size="sm" onClick={() => onSetConfigStep(configStep + 1)}>
                    Next: {CONFIG_STEPS[configStep]?.label ?? ''}
                  </Button>
                ) : (
                  <Button size="sm" onClick={onRun} disabled={runDisabled} className="gap-2">
                    Run
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
