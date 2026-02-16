import { ChevronDown, ChevronLeft, ChevronRight, Gauge, Info, Play, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Command, CommandInput } from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  OptimizationObjective,
  OptimizerErrorMetric,
  OptimizerSettings,
} from '@/types/optimizer'

/** Minimum provider count above which we recommend MSE (avoid a few large misalignments). */
const ERROR_METRIC_LARGE_COHORT_THRESHOLD = 30

function getRecommendedErrorMetric(
  objective: OptimizationObjective,
  providerCount: number
): { metric: OptimizerErrorMetric; reason: string } {
  const isTargetFixed = objective.kind === 'target_fixed_percentile'
  const isSmallCohort = providerCount < ERROR_METRIC_LARGE_COHORT_THRESHOLD

  if (isTargetFixed) {
    return {
      metric: 'absolute',
      reason: "You're targeting a single percentile; absolute (MAE) spreads adjustments more evenly across providers.",
    }
  }
  if (isSmallCohort) {
    return {
      metric: 'absolute',
      reason: 'With a small group, absolute (MAE) avoids one or two providers dominating the solution.',
    }
  }
  return {
    metric: 'squared',
    reason: 'With this many providers, squared (MSE) helps avoid a few being badly out of line.',
  }
}
import {
  TCC_BUILTIN_COMPONENTS,
  DEFAULT_TCC_COMPONENT_INCLUSION,
  type TCCComponentInclusion,
  type TCCLayerConfig,
  type TCCLayerType,
} from '@/lib/tcc-components'
import { cn } from '@/lib/utils'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'

const CONFIG_STEPS = [
  { id: 1, label: 'Target population' },
  { id: 2, label: 'Objective' },
  { id: 3, label: 'Governance' },
  { id: 4, label: 'Total cash compensation' },
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

export function OptimizerConfigureStage({
  hasData,
  settings,
  runDisabled,
  filteredProviderRowsCount,
  targetMode,
  selectedSpecialties,
  selectedDivisions,
  excludedProviderTypes,
  providerTypeFilter,
  availableSpecialties,
  availableDivisions,
  availableProviderTypes,
  onRun,
  onSetOptimizationObjective,
  onSetErrorMetric,
  onSetTargetMode,
  onSetProviderTypeFilter,
  onSetSelectedSpecialties,
  onSetSelectedDivisions,
  onSetExcludedProviderTypes,
  onSetSettings,
  configStep,
  onSetConfigStep,
}: {
  hasData: boolean
  settings: OptimizerSettings
  runDisabled: boolean
  filteredProviderRowsCount: number
  targetMode: 'all' | 'custom'
  selectedSpecialties: string[]
  selectedDivisions: string[]
  excludedProviderTypes: string[]
  providerTypeFilter: 'all' | 'productivity' | 'base'
  availableSpecialties: string[]
  availableDivisions: string[]
  availableProviderTypes: string[]
  onRun: () => void
  onSetOptimizationObjective: (objective: OptimizationObjective) => void
  onSetErrorMetric: (metric: OptimizerErrorMetric) => void
  onSetTargetMode: (mode: 'all' | 'custom') => void
  onSetProviderTypeFilter: (filter: 'all' | 'productivity' | 'base') => void
  onSetSelectedSpecialties: (specialties: string[]) => void
  onSetSelectedDivisions: (divisions: string[]) => void
  onSetExcludedProviderTypes: (types: string[]) => void
  onSetSettings: Dispatch<SetStateAction<OptimizerSettings>>
  configStep: number
  onSetConfigStep: (step: number) => void
}) {
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [divisionSearch, setDivisionSearch] = useState('')
  const [providerTypeSearch, setProviderTypeSearch] = useState('')

  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return availableSpecialties
    const q = specialtySearch.toLowerCase()
    return availableSpecialties.filter((s) => s.toLowerCase().includes(q))
  }, [availableSpecialties, specialtySearch])

  const filteredDivisions = useMemo(() => {
    if (!divisionSearch.trim()) return availableDivisions
    const q = divisionSearch.toLowerCase()
    return availableDivisions.filter((d) => d.toLowerCase().includes(q))
  }, [availableDivisions, divisionSearch])

  const filteredProviderTypes = useMemo(() => {
    if (!providerTypeSearch.trim()) return availableProviderTypes
    const q = providerTypeSearch.toLowerCase()
    return availableProviderTypes.filter((t) => t.toLowerCase().includes(q))
  }, [availableProviderTypes, providerTypeSearch])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="size-6" aria-hidden />
          </div>
          <div>
            <CardTitle className="leading-tight">Conversion Factor Optimizer</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Configure target scope and guardrails, then run optimization.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider delayDuration={200}>
          {!hasData ? (
            <WarningBanner
              message="Upload provider and market data on the Upload screen before running optimization."
            />
          ) : null}

          {hasData ? (
            <>
              {/* Step 1: Target population */}
              {configStep === 1 ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      title="Target scope"
                      tooltip="Choose which providers are included in this run: by compensation model (all, productivity-based only, or base salary only) and optionally by specialty and division. The specialty and division lists only show options that exist in your data for the selected model."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose which provider set should be included in this run.
                    </p>
                  </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Compensation model</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={providerTypeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSetProviderTypeFilter('all')}
                >
                  All providers
                </Button>
                <Button
                  type="button"
                  variant={providerTypeFilter === 'productivity' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSetProviderTypeFilter('productivity')}
                >
                  Productivity-based only
                </Button>
                <Button
                  type="button"
                  variant={providerTypeFilter === 'base' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSetProviderTypeFilter('base')}
                >
                  Base salary only
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Specialty scope</Label>
              <div className="flex flex-wrap items-center gap-3">
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

                {targetMode === 'custom' ? (
                  <>
                    <DropdownMenu onOpenChange={(open) => open && setSpecialtySearch('')}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="min-w-[220px] justify-between gap-2">
                          {selectedSpecialties.length === 0
                            ? 'Specialties...'
                            : `${selectedSpecialties.length} specialty(ies)`}
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-[320px] overflow-hidden p-0"
                        onCloseAutoFocus={(e: Event) => e.preventDefault()}
                      >
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
                                    checked
                                      ? [...selectedSpecialties, specialty]
                                      : selectedSpecialties.filter((item) => item !== specialty)
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

                    <DropdownMenu onOpenChange={(open) => open && setDivisionSearch('')}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="min-w-[180px] justify-between gap-2">
                          {selectedDivisions.length === 0
                            ? 'All divisions'
                            : `${selectedDivisions.length} division(s)`}
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-[320px] overflow-hidden p-0"
                        onCloseAutoFocus={(e: Event) => e.preventDefault()}
                      >
                        <Command shouldFilter={false} className="rounded-none border-0">
                          <CommandInput
                            placeholder="Search divisions…"
                            value={divisionSearch}
                            onValueChange={setDivisionSearch}
                            className="h-9"
                          />
                        </Command>
                        <div className="max-h-[240px] overflow-y-auto p-1">
                          <DropdownMenuLabel>Division / Department</DropdownMenuLabel>
                          {availableDivisions.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No divisions in data
                            </div>
                          ) : filteredDivisions.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                          ) : (
                            filteredDivisions.map((division) => (
                              <DropdownMenuCheckboxItem
                                key={division}
                                checked={selectedDivisions.includes(division)}
                                onCheckedChange={(checked) =>
                                  onSetSelectedDivisions(
                                    checked
                                      ? [...selectedDivisions, division]
                                      : selectedDivisions.filter((item) => item !== division)
                                  )
                                }
                              >
                                {division}
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : null}
              </div>
            </div>

            {availableProviderTypes.length > 0 ? (
              <div className="space-y-2">
                <SectionHeaderWithTooltip
                  title="Exclude provider types"
                  tooltip="Exclude providers by role or job type (e.g. Division Chief, Medical Director). Add a Provider type / Role column in your provider upload to use this."
                />
                <DropdownMenu onOpenChange={(open) => open && setProviderTypeSearch('')}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[220px] justify-between gap-2">
                      {excludedProviderTypes.length === 0
                        ? 'None excluded'
                        : `${excludedProviderTypes.length} type(s) excluded`}
                      <ChevronDown className="size-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-h-[320px] overflow-hidden p-0"
                    onCloseAutoFocus={(e: Event) => e.preventDefault()}
                  >
                    <Command shouldFilter={false} className="rounded-none border-0">
                      <CommandInput
                        placeholder="Search provider types…"
                        value={providerTypeSearch}
                        onValueChange={setProviderTypeSearch}
                        className="h-9"
                      />
                    </Command>
                    <div className="max-h-[240px] overflow-y-auto p-1">
                      <DropdownMenuLabel>Exclude these provider types from the run</DropdownMenuLabel>
                      {filteredProviderTypes.length === 0 ? (
                        <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                      ) : (
                        filteredProviderTypes.map((providerType) => (
                          <DropdownMenuCheckboxItem
                            key={providerType}
                            checked={excludedProviderTypes.includes(providerType)}
                            onCheckedChange={(checked) =>
                              onSetExcludedProviderTypes(
                                checked
                                  ? [...excludedProviderTypes, providerType]
                                  : excludedProviderTypes.filter((item) => item !== providerType)
                              )
                            }
                          >
                            {providerType}
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground">
                  Add a &quot;Provider type&quot; or &quot;Role&quot; column when uploading provider data to see types here.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <SectionHeaderWithTooltip
                title="Assume productivity gain (%)"
                tooltip="Scale recorded wRVUs by this amount for this run only (e.g. 5 = 5% higher). Use when budgeting for expected productivity growth—the optimizer will align pay to where productivity would be at that level."
              />
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={settings.wRVUGrowthFactorPct ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    const num = raw === '' ? undefined : Number(raw)
                    const val = num === undefined ? undefined : Math.max(0, Math.min(50, Number.isNaN(num) ? 0 : num))
                    onSetSettings((prev) => ({ ...prev, wRVUGrowthFactorPct: val }))
                  }}
                  placeholder="0"
                  className="h-9 w-20"
                />
                <span className="text-sm text-muted-foreground">
                  % higher wRVUs for this run (0 = use recorded values)
                </span>
              </div>
            </div>

            <div className="border-t border-border/40 pt-1 text-xs text-muted-foreground">
              {filteredProviderRowsCount} provider(s) in scope
              {providerTypeFilter !== 'all' ? (
                <span>
                  {' '}
                  ({providerTypeFilter === 'productivity' ? 'productivity-based' : 'base salary'} only)
                </span>
              ) : null}
              {targetMode === 'custom' && selectedSpecialties.length > 0 ? (
                <span> across {selectedSpecialties.length} specialty(ies)</span>
              ) : null}
              {excludedProviderTypes.length > 0 ? (
                <span> ({excludedProviderTypes.length} provider type(s) excluded)</span>
              ) : null}
              {(settings.wRVUGrowthFactorPct ?? 0) > 0 ? (
                <span> (wRVUs assumed {(settings.wRVUGrowthFactorPct ?? 0)}% higher for this run)</span>
              ) : null}
            </div>
                </div>
              ) : null}

              {/* Step 2: Objective */}
              {configStep === 2 ? (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <SectionHeaderWithTooltip
                    title="A. Objective"
                    tooltip="Set how the optimizer should target pay: align TCC percentile to wRVU percentile, target a fixed percentile, or a hybrid. The error metric (MSE vs MAE) affects how outliers are weighted when minimizing misalignment."
                  />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Optimization objective</Label>
              <Select
                value={settings.optimizationObjective.kind}
                onValueChange={(value) => {
                  if (value === 'align_percentile') {
                    onSetOptimizationObjective({ kind: 'align_percentile' })
                  } else if (value === 'target_fixed_percentile') {
                    onSetOptimizationObjective({ kind: 'target_fixed_percentile', targetPercentile: 40 })
                  } else {
                    onSetOptimizationObjective({
                      kind: 'hybrid',
                      alignWeight: 0.7,
                      targetWeight: 0.3,
                      targetPercentile: 40,
                    })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="align_percentile">Align TCC percentile to wRVU percentile</SelectItem>
                  <SelectItem value="target_fixed_percentile">Target fixed TCC percentile</SelectItem>
                  <SelectItem value="hybrid">Hybrid (alignment + fixed target)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {settings.optimizationObjective.kind === 'align_percentile'
                  ? 'Match pay rank to productivity rank: higher wRVU percentile → higher TCC percentile.'
                  : settings.optimizationObjective.kind === 'target_fixed_percentile'
                    ? 'Move everyone toward one target percentile (e.g. median); good for standardizing to a market level.'
                    : 'Combine alignment with a target: partly match productivity rank, partly pull toward a chosen percentile.'}
              </p>
              {settings.optimizationObjective.kind === 'target_fixed_percentile' ? (
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground">Target percentile</Label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={settings.optimizationObjective.targetPercentile}
                    onChange={(e) =>
                      onSetOptimizationObjective({
                        kind: 'target_fixed_percentile',
                        targetPercentile: Number(e.target.value) || 40,
                      })
                    }
                    className="w-20"
                  />
                </div>
              ) : null}
              {settings.optimizationObjective.kind === 'hybrid' ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round((settings.optimizationObjective.alignWeight ?? 0.7) * 100)}
                      onChange={(e) => {
                        const align = (Number(e.target.value) || 70) / 100
                        onSetOptimizationObjective({
                          kind: 'hybrid',
                          alignWeight: align,
                          targetWeight: 1 - align,
                          targetPercentile:
                            (settings.optimizationObjective as { targetPercentile?: number }).targetPercentile ??
                            40,
                        })
                      }}
                      className="w-16"
                    />
                    <span className="text-muted-foreground">% productivity alignment</span>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={(settings.optimizationObjective as { targetPercentile?: number }).targetPercentile ?? 40}
                      onChange={(e) => {
                        const objective = settings.optimizationObjective
                        const targetPercentile = Number(e.target.value) || 40
                        onSetOptimizationObjective(
                          objective.kind === 'hybrid'
                            ? { ...objective, targetPercentile }
                            : {
                                kind: 'hybrid',
                                alignWeight: 0.7,
                                targetWeight: 0.3,
                                targetPercentile,
                              }
                        )
                      }}
                      className="w-16"
                    />
                    <span className="text-muted-foreground">target %ile</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {Math.round((settings.optimizationObjective.alignWeight ?? 0.7) * 100)}% is the weight for “match pay to productivity”; the rest pulls pay toward the target percentile. Higher % = more “pay follows productivity”; lower % = more “move everyone toward the target.”
                  </p>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Error metric</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="What is error metric?"
                    >
                      <Info className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[320px] text-xs">
                    <p className="font-medium mb-1">How we measure “how far off” pay is from the goal</p>
                    <p className="mb-2">The optimizer tries to match total cash compensation (TCC) to productivity (wRVU). The error metric decides how we count those mismatches.</p>
                    <p className="mb-1"><strong>Squared (MSE):</strong> Big misses count much more than small ones. Use when you want to avoid a few providers being badly out of line, even if that means more small tweaks overall.</p>
                    <p><strong>Absolute (MAE):</strong> Every unit of “off by” counts the same. Use when you want adjustments spread more evenly and are less concerned about a few large outliers.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {(() => {
                const recommendation = getRecommendedErrorMetric(settings.optimizationObjective, filteredProviderRowsCount)
                const matchesRecommendation = settings.errorMetric === recommendation.metric
                return (
                  <>
                    <Select value={settings.errorMetric} onValueChange={(value) => onSetErrorMetric(value as OptimizerErrorMetric)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="squared">Squared (MSE)</SelectItem>
                        <SelectItem value="absolute">Absolute (MAE)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {matchesRecommendation ? (
                        <span className="text-muted-foreground">
                          ✓ Recommended for your setup ({filteredProviderRowsCount} provider{filteredProviderRowsCount !== 1 ? 's' : ''}, {settings.optimizationObjective.kind === 'target_fixed_percentile' ? 'fixed target' : settings.optimizationObjective.kind === 'hybrid' ? 'hybrid' : 'alignment'}).
                        </span>
                      ) : (
                        <>
                          <span className="text-muted-foreground">
                            Recommended: {recommendation.metric === 'squared' ? 'Squared (MSE)' : 'Absolute (MAE)'} — {recommendation.reason}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onSetErrorMetric(recommendation.metric)}
                          >
                            Use recommended
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
                </div>
              ) : null}

              {/* Step 3: Governance */}
              {configStep === 3 ? (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <SectionHeaderWithTooltip
                    title="B. Governance guardrails"
                    tooltip="Exclusion rules: providers below min clinical FTE or min wRVU per 1.0 cFTE are excluded from optimization. CF bounds limit how much the recommended CF can change from current (± %). Max recommended CF percentile caps the suggestion at a market percentile (e.g. 50 = median) per specialty."
                  />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Min clinical FTE</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={settings.defaultExclusionRules.minBasisFTE}
                onChange={(e) =>
                  onSetSettings((prev) => ({
                    ...prev,
                    defaultExclusionRules: {
                      ...prev.defaultExclusionRules,
                      minBasisFTE: Number(e.target.value) || 0.5,
                    },
                  }))
                }
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label>Min wRVU per 1.0 cFTE</Label>
              <Input
                type="number"
                min={0}
                value={settings.defaultExclusionRules.minWRVUPer1p0CFTE}
                onChange={(e) =>
                  onSetSettings((prev) => ({
                    ...prev,
                    defaultExclusionRules: {
                      ...prev.defaultExclusionRules,
                      minWRVUPer1p0CFTE: Number(e.target.value) || 1000,
                    },
                  }))
                }
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label>CF bounds (± % from current)</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  value={settings.cfBounds.minChangePct}
                  onChange={(e) =>
                    onSetSettings((prev) => ({
                      ...prev,
                      cfBounds: { ...prev.cfBounds, minChangePct: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-16"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Max change ± this % from current CF</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm">Max recommended CF percentile</Label>
              <span className="tabular-nums text-sm font-medium text-muted-foreground">
                {settings.maxRecommendedCFPercentile ?? 50}th
              </span>
            </div>
            <Slider
              min={25}
              max={90}
              step={5}
              value={[settings.maxRecommendedCFPercentile ?? 50]}
              onValueChange={([v]) =>
                onSetSettings((prev) => ({
                  ...prev,
                  maxRecommendedCFPercentile: v,
                }))
              }
              className="w-full max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              Recommended CF will not exceed this market percentile for any specialty (e.g. 50 = median).
            </p>
          </div>
                </div>
              ) : null}

              {/* Step 4: Total cash compensation */}
              {configStep === 4 ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      title="C. Total cash compensation"
                      tooltip="Select which pay components count toward baseline and modeled TCC when aligning to productivity. Only checked components are included. Add more components in Upload by mapping columns; they appear here when available. Optional layered amounts (percent of base, dollar per FTE, flat) are added on top for both baseline and modeled."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose which components to include in baseline and modeled TCC for alignment. Add more
                      components in Upload by mapping columns; they will appear here when available.
                    </p>
                  </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TCC_BUILTIN_COMPONENTS.map((def) => {
              const inclusion = settings.tccComponentInclusion ?? {
                quality: { included: settings.includeQualityPaymentsInBaselineAndModeled },
                workRVUIncentive: { included: settings.includeWorkRVUIncentiveInTCC },
              }
              const entry = inclusion[def.id] ?? DEFAULT_TCC_COMPONENT_INCLUSION[def.id] ?? { included: false }
              const checked = entry.included
              const setIncluded = (included: boolean) => {
                onSetSettings((prev) => {
                  const nextInclusion: TCCComponentInclusion = {
                    ...(prev.tccComponentInclusion ?? {
                      quality: { included: prev.includeQualityPaymentsInBaselineAndModeled },
                      workRVUIncentive: { included: prev.includeWorkRVUIncentiveInTCC },
                    }),
                    [def.id]: { ...entry, included },
                  }
                  return {
                    ...prev,
                    tccComponentInclusion: nextInclusion,
                    includeQualityPaymentsInBaselineAndModeled: nextInclusion.quality?.included ?? prev.includeQualityPaymentsInBaselineAndModeled,
                    includeWorkRVUIncentiveInTCC: nextInclusion.workRVUIncentive?.included ?? prev.includeWorkRVUIncentiveInTCC,
                  }
                })
              }
              const setNormalizeForFTE = (normalizeForFTE: boolean) => {
                onSetSettings((prev) => {
                  const current = prev.tccComponentInclusion ?? {
                    quality: { included: prev.includeQualityPaymentsInBaselineAndModeled },
                    workRVUIncentive: { included: prev.includeWorkRVUIncentiveInTCC },
                  }
                  const nextInclusion: TCCComponentInclusion = {
                    ...current,
                    [def.id]: { ...(current[def.id] ?? { included: false }), normalizeForFTE },
                  }
                  return { ...prev, tccComponentInclusion: nextInclusion }
                })
              }
              return (
                <div
                  key={def.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-white p-3 dark:bg-background"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`tcc-${def.id}`}
                      checked={checked}
                      onChange={(e) => setIncluded(e.target.checked)}
                      className="mt-1 size-4 rounded border-input"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Label htmlFor={`tcc-${def.id}`} className="cursor-pointer font-medium">
                        {def.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{def.description}</p>
                    </div>
                  </div>
                  {def.id === 'quality' && checked && (
                    <div className="space-y-2 border-t border-border/40 pt-3">
                      <Label className="text-xs font-medium">Quality payments source</Label>
                      <Select
                        value={settings.qualityPaymentsSource ?? 'from_file'}
                        onValueChange={(value: 'from_file' | 'override_pct_of_base') =>
                          onSetSettings((prev) => ({
                            ...prev,
                            qualityPaymentsSource: value,
                            qualityPaymentsOverridePct:
                              value === 'override_pct_of_base'
                                ? prev.qualityPaymentsOverridePct ?? 5
                                : undefined,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full max-w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="from_file">From upload (provider file)</SelectItem>
                          <SelectItem value="override_pct_of_base">Override: % of base salary</SelectItem>
                        </SelectContent>
                      </Select>
                      {settings.qualityPaymentsSource === 'override_pct_of_base' && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={30}
                            step={0.5}
                            value={settings.qualityPaymentsOverridePct ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              const num = raw === '' ? 0 : Number(raw)
                              const val = Number.isNaN(num) ? 0 : Math.max(0, Math.min(30, num))
                              onSetSettings((prev) => ({ ...prev, qualityPaymentsOverridePct: val }))
                            }}
                            placeholder="5"
                            className="h-9 w-20"
                          />
                          <span className="text-xs text-muted-foreground">% of clinical base</span>
                        </div>
                      )}
                    </div>
                  )}
                  {def.supportsNormalizeForFTE && checked && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!!entry.normalizeForFTE}
                        onChange={(e) => setNormalizeForFTE(e.target.checked)}
                        className="size-3.5 rounded border-input"
                      />
                      <span>Value is per 1.0 FTE (multiply by clinical FTE for raw TCC)</span>
                    </label>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 space-y-3 rounded-lg border border-border bg-white p-3 dark:bg-background">
            <h4 className="text-sm font-medium">Additional TCC (layered)</h4>
            <p className="text-xs text-muted-foreground">
              Add named layers on top of the selected components for both baseline and modeled (e.g.
              value-based payment, retention bonus, stipend). Each layer can be percent of base, dollar per 1.0 FTE,
              flat dollar, or from a provider file column.
            </p>
            <div className="space-y-3">
              {(settings.additionalTCCLayers ?? []).map((layer) => (
                <div
                  key={layer.id}
                  className="flex flex-wrap items-end gap-3 rounded border border-border/50 bg-background p-3"
                >
                  <div className="min-w-[140px] space-y-1">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input
                      value={layer.name}
                      onChange={(e) =>
                        onSetSettings((prev) => ({
                          ...prev,
                          additionalTCCLayers: (prev.additionalTCCLayers ?? []).map((l) =>
                            l.id === layer.id ? { ...l, name: e.target.value } : l
                          ),
                        }))
                      }
                      placeholder="e.g. Value-based payment"
                      className="h-9 bg-white dark:bg-white"
                    />
                  </div>
                  <div className="min-w-[160px] space-y-1">
                    <Label className="text-xs font-medium">Type</Label>
                    <Select
                      value={layer.type}
                      onValueChange={(value: TCCLayerType) =>
                        onSetSettings((prev) => ({
                          ...prev,
                          additionalTCCLayers: (prev.additionalTCCLayers ?? []).map((l) =>
                            l.id === layer.id
                              ? { ...l, type: value, value: value === 'from_file' ? undefined : l.value ?? 0, sourceColumn: value === 'from_file' ? 'otherIncentives' : undefined }
                              : l
                          ),
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 bg-white dark:bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent_of_base">Percent of base</SelectItem>
                        <SelectItem value="dollar_per_1p0_FTE">Dollar per 1.0 FTE</SelectItem>
                        <SelectItem value="flat_dollar">Flat dollar</SelectItem>
                        <SelectItem value="from_file">From provider file</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {layer.type !== 'from_file' ? (
                    <div className="min-w-[100px] space-y-1">
                      <Label className="text-xs font-medium">Value</Label>
                      <Input
                        type="number"
                        min={0}
                        step={layer.type === 'percent_of_base' ? 0.5 : 1000}
                        value={layer.value ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          const num = raw === '' ? 0 : Number(raw)
                          const val = Number.isNaN(num) ? 0 : Math.max(0, num)
                          onSetSettings((prev) => ({
                            ...prev,
                            additionalTCCLayers: (prev.additionalTCCLayers ?? []).map((l) =>
                              l.id === layer.id ? { ...l, value: val } : l
                            ),
                          }))
                        }}
                        placeholder="0"
                        className="h-9 w-24 bg-white dark:bg-white"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="min-w-[140px] space-y-1">
                        <Label className="text-xs font-medium">Source column</Label>
                        <Select
                          value={layer.sourceColumn ?? 'otherIncentives'}
                          onValueChange={(value) =>
                            onSetSettings((prev) => ({
                              ...prev,
                              additionalTCCLayers: (prev.additionalTCCLayers ?? []).map((l) =>
                                l.id === layer.id ? { ...l, sourceColumn: value } : l
                              ),
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 bg-white dark:bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="otherIncentives">otherIncentives</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!!layer.normalizeForFTE}
                          onChange={(e) =>
                            onSetSettings((prev) => ({
                              ...prev,
                              additionalTCCLayers: (prev.additionalTCCLayers ?? []).map((l) =>
                                l.id === layer.id ? { ...l, normalizeForFTE: e.target.checked } : l
                              ),
                            }))
                          }
                          className="size-3.5 rounded border-input"
                        />
                        <span>Per 1.0 FTE</span>
                      </label>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                    aria-label="Remove layer"
                    onClick={() =>
                      onSetSettings((prev) => ({
                        ...prev,
                        additionalTCCLayers: (prev.additionalTCCLayers ?? []).filter((l) => l.id !== layer.id),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newLayer: TCCLayerConfig = {
                    id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    name: 'New layer',
                    type: 'percent_of_base',
                    value: 0,
                  }
                  onSetSettings((prev) => ({
                    ...prev,
                    additionalTCCLayers: [...(prev.additionalTCCLayers ?? []), newLayer],
                  }))
                }}
              >
                Add layer
              </Button>
            </div>
          </div>
                </div>
              ) : null}
            </>
          ) : null}

          {/* Step navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
            <div>
              {configStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSetConfigStep(configStep - 1)}
                  className="gap-1.5"
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              {configStep < 4 ? (
                <Button
                  type="button"
                  onClick={() => onSetConfigStep(configStep + 1)}
                  className="gap-1.5"
                >
                  Next: {CONFIG_STEPS[configStep]?.label ?? ''}
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={onRun} disabled={runDisabled} className="gap-2">
                  <Play className="size-4" />
                  Run
                </Button>
              )}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
