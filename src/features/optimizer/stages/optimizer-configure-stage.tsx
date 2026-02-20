import { ChevronDown, ChevronLeft, ChevronRight, Info, Play, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
  BudgetConstraintKind,
  OptimizationObjective,
  OptimizerErrorMetric,
  OptimizerSettings,
} from '@/types/optimizer'
import { DEFAULT_BUDGET_CONSTRAINT } from '@/types/optimizer'

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
  DEFAULT_TCC_COMPONENT_INCLUSION,
  type TCCComponentInclusion,
  type TCCLayerConfig,
  type TCCLayerType,
} from '@/lib/tcc-components'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  variant = 'subsection',
  className,
}: {
  title: string
  tooltip: string
  /** 'section' = larger heading for main panel sections; 'subsection' = default smaller label */
  variant?: 'section' | 'subsection'
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <h3 className={cn(
        'font-semibold',
        variant === 'section' ? 'text-base' : 'text-sm'
      )}>{title}</h3>
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
  runDisabledReasons = [],
  filteredProviderRowsCount,
  tccComponentAvailability,
  targetMode,
  selectedSpecialties,
  selectedDivisions,
  providerTypeScopeMode,
  selectedProviderTypes,
  onSetProviderTypeScopeMode,
  onSetSelectedProviderTypes,
  excludedProviderTypes,
  providerTypeFilter,
  availableSpecialties,
  availableDivisions,
  availableProviderTypes,
  availableProvidersForExclusion,
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
  /** When Run is disabled, friendly reasons to show so the user knows what to select. */
  runDisabledReasons?: string[]
  filteredProviderRowsCount: number
  /** Which TCC components have data in the current provider set; only show those in step 4. When omitted, show all. */
  tccComponentAvailability?: {
    quality: boolean
    otherIncentives: boolean
    stipend: boolean
    workRVUIncentive: boolean
  }
  targetMode: 'all' | 'custom'
  selectedSpecialties: string[]
  selectedDivisions: string[]
  providerTypeScopeMode: 'all' | 'custom'
  selectedProviderTypes: string[]
  onSetProviderTypeScopeMode: (mode: 'all' | 'custom') => void
  onSetSelectedProviderTypes: (types: string[]) => void
  excludedProviderTypes: string[]
  providerTypeFilter: 'all' | 'productivity' | 'base'
  availableSpecialties: string[]
  availableDivisions: string[]
  availableProviderTypes: string[]
  /** Providers currently in scope (for "Exclude providers" dropdown). */
  availableProvidersForExclusion: { id: string; name: string }[]
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
  const [providerTypeIncludeSearch, setProviderTypeIncludeSearch] = useState('')
  const [providerTypeSearch, setProviderTypeSearch] = useState('')
  const [providerExcludeSearch, setProviderExcludeSearch] = useState('')

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

  const filteredProviderTypesForInclude = useMemo(() => {
    if (!providerTypeIncludeSearch.trim()) return availableProviderTypes
    const q = providerTypeIncludeSearch.toLowerCase()
    return availableProviderTypes.filter((t) => t.toLowerCase().includes(q))
  }, [availableProviderTypes, providerTypeIncludeSearch])

  const filteredProviderTypes = useMemo(() => {
    if (!providerTypeSearch.trim()) return availableProviderTypes
    const q = providerTypeSearch.toLowerCase()
    return availableProviderTypes.filter((t) => t.toLowerCase().includes(q))
  }, [availableProviderTypes, providerTypeSearch])

  const filteredProvidersForExclusion = useMemo(() => {
    if (!providerExcludeSearch.trim()) return availableProvidersForExclusion
    const q = providerExcludeSearch.toLowerCase()
    return availableProvidersForExclusion.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    )
  }, [availableProvidersForExclusion, providerExcludeSearch])

  // When availability is known, turn off inclusion for components that have no data in the current set
  useEffect(() => {
    if (!tccComponentAvailability) return
    const { quality, otherIncentives, stipend, workRVUIncentive } = tccComponentAvailability
    const needQualityOff = !quality && (settings.includeQualityPaymentsInBaselineAndModeled ?? false)
    const needOtherOff = !otherIncentives && (settings.includeOtherIncentivesInBaselineAndModeled ?? false)
    const needStipendOff = !stipend && (settings.includeStipendInBaselineAndModeled ?? false)
    const needWorkRVUOff = !workRVUIncentive && (settings.includeWorkRVUIncentiveInTCC ?? false)
    if (!needQualityOff && !needOtherOff && !needStipendOff && !needWorkRVUOff) return
    onSetSettings((prev) => ({
      ...prev,
      ...(needQualityOff && { includeQualityPaymentsInBaselineAndModeled: false }),
      ...(needOtherOff && { includeOtherIncentivesInBaselineAndModeled: false }),
      ...(needStipendOff && { includeStipendInBaselineAndModeled: false }),
      ...(needWorkRVUOff && { includeWorkRVUIncentiveInTCC: false }),
    }))
  }, [
    tccComponentAvailability,
    onSetSettings,
    settings.includeQualityPaymentsInBaselineAndModeled,
    settings.includeOtherIncentivesInBaselineAndModeled,
    settings.includeStipendInBaselineAndModeled,
    settings.includeWorkRVUIncentiveInTCC,
  ])

  return (
    <Card>
      <CardContent className="space-y-6">
        <TooltipProvider delayDuration={200}>
          <nav
            className="flex items-center justify-end gap-0.5 rounded-md p-0.5 bg-muted/50 w-fit ml-auto"
            aria-label="Configuration steps"
          >
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
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
          {!hasData ? (
            <WarningBanner
              message="Upload provider and market data on the Upload screen before running optimization."
            />
          ) : null}

          {hasData ? (
            <>
              {/* Step 1: Target population */}
              {configStep === 1 ? (
                <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      variant="section"
                      title="Target scope"
                      tooltip="Choose which providers are included in this run: by compensation model (all, productivity-based only, or base salary only) and optionally by specialty and division. The specialty and division lists only show options that exist in your data for the selected model."
                      className="text-primary/90"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Configure who is included first, then apply exclusions and assumptions.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <div className="space-y-4 rounded-lg border border-border/50 bg-background/70 p-4">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Include providers
                      </Label>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-primary/90">Compensation model</Label>
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

                      <div className="space-y-2 border-t border-border/40 pt-3">
                        <Label className="text-sm font-semibold text-primary/90">Specialty scope</Label>
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
                        <div className="space-y-2 border-t border-border/40 pt-3">
                          <Label className="text-sm font-semibold text-primary/90">Provider type scope</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={providerTypeScopeMode === 'all' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onSetProviderTypeScopeMode('all')}
                            >
                              All provider types
                            </Button>
                            <Button
                              type="button"
                              variant={providerTypeScopeMode === 'custom' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onSetProviderTypeScopeMode('custom')}
                            >
                              Custom selection
                            </Button>
                          </div>
                          {providerTypeScopeMode === 'custom' ? (
                            <DropdownMenu onOpenChange={(open) => open && setProviderTypeIncludeSearch('')}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="min-w-[220px] justify-between gap-2">
                                  {selectedProviderTypes.length === 0
                                    ? 'Select provider types...'
                                    : `${selectedProviderTypes.length} type(s)`}
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
                                    value={providerTypeIncludeSearch}
                                    onValueChange={setProviderTypeIncludeSearch}
                                    className="h-9"
                                  />
                                </Command>
                                <div className="max-h-[240px] overflow-y-auto p-1">
                                  <DropdownMenuLabel>Include only these provider types (role)</DropdownMenuLabel>
                                  {filteredProviderTypesForInclude.length === 0 ? (
                                    <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                  ) : (
                                    filteredProviderTypesForInclude.map((providerType) => (
                                      <DropdownMenuCheckboxItem
                                        key={providerType}
                                        checked={selectedProviderTypes.includes(providerType)}
                                        onCheckedChange={(checked) =>
                                          onSetSelectedProviderTypes(
                                            checked
                                              ? [...selectedProviderTypes, providerType]
                                              : selectedProviderTypes.filter((item) => item !== providerType)
                                          )
                                        }
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        {providerType}
                                      </DropdownMenuCheckboxItem>
                                    ))
                                  )}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4 rounded-lg border border-border/50 bg-background/70 p-4">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Exclusions and assumptions
                      </Label>

                      <div className="space-y-2">
                        <SectionHeaderWithTooltip
                          title="Exclude provider types"
                          tooltip="Exclude providers by role or job type (e.g. Division Chief, Medical Director). Add a Provider type / Role column in your provider upload to use this."
                          className="text-primary/90"
                        />
                        {availableProviderTypes.length > 0 ? (
                          <>
                            <DropdownMenu onOpenChange={(open) => open && setProviderTypeSearch('')}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full justify-between gap-2">
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
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        {providerType}
                                      </DropdownMenuCheckboxItem>
                                    ))
                                  )}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <p className="text-xs text-muted-foreground">
                              Add a &quot;Provider type&quot; or &quot;Role&quot; column when uploading provider data to
                              see types here.
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No provider types in your data. Add a &quot;Provider type&quot; or &quot;Role&quot; column
                            when uploading provider data to exclude by type.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 border-t border-border/40 pt-3">
                        <SectionHeaderWithTooltip
                          title="Exclude providers"
                          tooltip="Exclude specific providers by name from this run. They will not be included in optimization or results."
                          className="text-primary/90"
                        />
                        {availableProvidersForExclusion.length > 0 ? (
                          <DropdownMenu onOpenChange={(open) => open && setProviderExcludeSearch('')}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full justify-between gap-2">
                                {(settings.manualExcludeProviderIds?.length ?? 0) === 0
                                  ? 'None excluded'
                                  : `${settings.manualExcludeProviderIds?.length ?? 0} provider(s) excluded`}
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
                                  placeholder="Search providers…"
                                  value={providerExcludeSearch}
                                  onValueChange={setProviderExcludeSearch}
                                  className="h-9"
                                />
                              </Command>
                              <div className="max-h-[240px] overflow-y-auto p-1">
                                <DropdownMenuLabel>Exclude these providers from the run</DropdownMenuLabel>
                                {filteredProvidersForExclusion.length === 0 ? (
                                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                ) : (
                                  filteredProvidersForExclusion.map((p) => (
                                    <DropdownMenuCheckboxItem
                                      key={p.id}
                                      checked={settings.manualExcludeProviderIds?.includes(p.id) ?? false}
                                      onCheckedChange={(checked) => {
                                        onSetSettings((prev) => {
                                          const current = prev.manualExcludeProviderIds ?? []
                                          return {
                                            ...prev,
                                            manualExcludeProviderIds: checked
                                              ? [...current, p.id]
                                              : current.filter((id) => id !== p.id),
                                          }
                                        })
                                      }}
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      {p.name}
                                    </DropdownMenuCheckboxItem>
                                  ))
                                )}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No providers in scope yet. Set target scope (compensation model, specialty, division) first.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 border-t border-border/40 pt-3">
                        <SectionHeaderWithTooltip
                          title="Assume productivity gain (%)"
                          tooltip="Scale recorded wRVUs by this amount for this run only (e.g. 5 = 5% higher). Use when budgeting for expected productivity growth—the optimizer will align pay to where productivity would be at that level."
                          className="text-primary/90"
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
                          <span className="text-sm text-muted-foreground">% higher wRVUs for this run</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Use 0 to keep recorded productivity values.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{filteredProviderRowsCount}</span> provider(s) in scope
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
                    {(settings.manualExcludeProviderIds?.length ?? 0) > 0 ? (
                      <span> ({(settings.manualExcludeProviderIds?.length ?? 0)} provider(s) excluded)</span>
                    ) : null}
                    {(settings.wRVUGrowthFactorPct ?? 0) > 0 ? (
                      <span> (wRVUs assumed {(settings.wRVUGrowthFactorPct ?? 0)}% higher for this run)</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Step 2: Objective */}
              {configStep === 2 ? (
                <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      variant="section"
                      title="A. Objective"
                      tooltip="Set how the optimizer should target pay: align TCC percentile to wRVU percentile, target a fixed percentile, or a hybrid. The error metric (MSE vs MAE) affects how outliers are weighted when minimizing misalignment."
                      className="text-primary/90"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set how the optimizer should target pay, then choose the error metric and optional budget assumption.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-primary/90">Optimization objective</Label>
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
                <Label className="text-sm font-semibold text-primary/90">Error metric</Label>
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
          <div className="space-y-3 border-t border-border/40 pt-4">
            <SectionHeaderWithTooltip
              title="Budget constraint"
              tooltip="Optional budget assumption for this scenario. None = no constraint. Neutral = assume budget-neutral. Cap by % or $ = cap total incentive spend at a percentage of baseline or a dollar amount. Stored with the scenario for comparison; the optimizer does not currently enforce caps."
              className="text-primary/90"
            />
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select
                  value={settings.budgetConstraint?.kind ?? 'none'}
                  onValueChange={(value: BudgetConstraintKind) => {
                    const kind = value as BudgetConstraintKind
                    onSetSettings((prev) => ({
                      ...prev,
                      budgetConstraint: {
                        kind,
                        ...(kind === 'cap_pct' ? { capPct: prev.budgetConstraint?.capPct ?? 0, capDollars: undefined } : {}),
                        ...(kind === 'cap_dollars' ? { capDollars: prev.budgetConstraint?.capDollars ?? 0, capPct: undefined } : {}),
                        ...(kind === 'none' || kind === 'neutral' ? { capPct: undefined, capDollars: undefined } : {}),
                      },
                    }))
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="cap_pct">Cap by %</SelectItem>
                    <SelectItem value="cap_dollars">Cap by $</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(settings.budgetConstraint?.kind ?? 'none') === 'cap_pct' ? (
                <div className="space-y-2">
                  <Label>Cap at % of baseline</Label>
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={settings.budgetConstraint?.capPct ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      const num = raw === '' ? undefined : Number(raw)
                      const val = num == null ? undefined : Math.max(0, Math.min(200, Number.isNaN(num) ? 0 : num))
                      onSetSettings((prev) => ({
                        ...prev,
                        budgetConstraint: {
                          ...(prev.budgetConstraint ?? DEFAULT_BUDGET_CONSTRAINT),
                          kind: 'cap_pct',
                          capPct: val,
                          capDollars: undefined,
                        },
                      }))
                    }}
                    placeholder="e.g. 100"
                    className="w-24"
                  />
                </div>
              ) : null}
              {(settings.budgetConstraint?.kind ?? 'none') === 'cap_dollars' ? (
                <div className="space-y-2">
                  <Label>Cap at $</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={settings.budgetConstraint?.capDollars ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      const num = raw === '' ? undefined : Number(raw)
                      const val = num == null ? undefined : Math.max(0, Number.isNaN(num) ? 0 : num)
                      onSetSettings((prev) => ({
                        ...prev,
                        budgetConstraint: {
                          ...(prev.budgetConstraint ?? DEFAULT_BUDGET_CONSTRAINT),
                          kind: 'cap_dollars',
                          capDollars: val,
                          capPct: undefined,
                        },
                      }))
                    }}
                    placeholder="e.g. 5000000"
                    className="w-32"
                  />
                </div>
              ) : null}
            </div>
          </div>
                </div>
              ) : null}

              {/* Step 3: Governance */}
              {configStep === 3 ? (
                <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      variant="section"
                      title="B. Governance guardrails"
                      tooltip="Exclusion rules: providers below min clinical FTE or min wRVU per 1.0 cFTE are excluded from optimization. CF bounds limit how much the recommended CF can change from current (± %). Max recommended CF percentile caps the suggestion at a market percentile (e.g. 50 = median) per specialty."
                      className="text-primary/90"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set exclusion rules and limits on how much the recommended conversion factor can change.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t border-border/40 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-primary/90">Min clinical FTE</Label>
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
              <Label className="text-sm font-semibold text-primary/90">Min wRVU per 1.0 cFTE</Label>
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
              <Label className="text-sm font-semibold text-primary/90">CF bounds (± % from current)</Label>
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
              <Label className="text-sm font-semibold text-primary/90">Max recommended CF percentile</Label>
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
                <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      variant="section"
                      title="C. Total cash compensation"
                      tooltip="Build your TCC by turning components on or off. Base is always included. Each component has a single data source: upload column, computed, or override. Leave optional pills off if you don't have that column."
                      className="text-primary/90"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Turn components on or off to define what counts as total cash compensation for this scenario.
                    </p>
                    {tccComponentAvailability ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Only components that have data in your current upload (for the providers in scope) are shown below.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-lg border border-border/50 bg-background/70 p-4 border-t border-border/40 pt-4">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What’s in your TCC</Label>
                    {(() => {
                      const inc = settings.tccComponentInclusion ?? {
                        quality: { included: settings.includeQualityPaymentsInBaselineAndModeled },
                        workRVUIncentive: { included: settings.includeWorkRVUIncentiveInTCC },
                        otherIncentives: { included: settings.includeOtherIncentivesInBaselineAndModeled ?? false },
                        stipend: { included: settings.includeStipendInBaselineAndModeled ?? false },
                      }
                      const toggle = (componentId: keyof TCCComponentInclusion, included: boolean) => {
                        onSetSettings((prev) => {
                          const current = prev.tccComponentInclusion ?? {
                            quality: { included: prev.includeQualityPaymentsInBaselineAndModeled },
                            workRVUIncentive: { included: prev.includeWorkRVUIncentiveInTCC },
                            otherIncentives: { included: prev.includeOtherIncentivesInBaselineAndModeled ?? false },
                            stipend: { included: prev.includeStipendInBaselineAndModeled ?? false },
                          }
                          const nextInclusion: TCCComponentInclusion = {
                            ...current,
                            [componentId]: { ...(current[componentId] ?? {}), included },
                          }
                          return {
                            ...prev,
                            tccComponentInclusion: nextInclusion,
                            includeQualityPaymentsInBaselineAndModeled: nextInclusion.quality?.included ?? false,
                            includeWorkRVUIncentiveInTCC: nextInclusion.workRVUIncentive?.included ?? false,
                            includeOtherIncentivesInBaselineAndModeled: nextInclusion.otherIncentives?.included ?? false,
                            includeStipendInBaselineAndModeled: nextInclusion.stipend?.included ?? false,
                          }
                        })
                      }
                      const allOptionalComponents: { id: keyof TCCComponentInclusion; label: string }[] = [
                        { id: 'workRVUIncentive', label: 'Productivity' },
                        { id: 'quality', label: 'Quality payment' },
                        { id: 'otherIncentives', label: 'Other incentives' },
                        { id: 'stipend', label: 'Non-clinical pay' },
                      ]
                      const optionalComponents = tccComponentAvailability
                        ? allOptionalComponents.filter(({ id }) => {
                            if (id === 'workRVUIncentive') return tccComponentAvailability.workRVUIncentive
                            if (id === 'quality') return tccComponentAvailability.quality
                            if (id === 'otherIncentives') return tccComponentAvailability.otherIncentives
                            if (id === 'stipend') return tccComponentAvailability.stipend
                            return true
                          })
                        : allOptionalComponents
                      return (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground" aria-hidden>
                              Base
                            </span>
                            {optionalComponents.map(({ id, label }) => {
                              const isOn = inc[id]?.included ?? DEFAULT_TCC_COMPONENT_INCLUSION[id]?.included ?? false
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => toggle(id, !isOn)}
                                  aria-pressed={isOn}
                                  aria-label={`${isOn ? 'Remove' : 'Add'} ${label}`}
                                  className={cn(
                                    'rounded-full px-3 py-1.5 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    isOn
                                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                                      : 'border border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground'
                                  )}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                              Included: Base
                              {optionalComponents
                                .filter(({ id }) => inc[id]?.included ?? false)
                                .map(({ label }) => ` + ${label}`)
                                .join('')}
                            </p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-label="Data sources"
                                >
                                  <Info className="size-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                                Base = Base salary (upload). Productivity = computed from Work RVUs + CF. Quality = column Quality payment (value-based) or override %. Other incentives = column Other incentives plus Other incentive 1/2/3 if mapped. Non-clinical pay = column from provider upload (admin, teaching, carve-out). Leave off if not in your upload. Stipend is separate (over and above); not sourced from the upload file.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="space-y-3 rounded-lg border border-border/50 bg-background/70 p-4">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Options</Label>
                    {(() => {
                      const inc = settings.tccComponentInclusion ?? {
                        quality: { included: settings.includeQualityPaymentsInBaselineAndModeled },
                        otherIncentives: { included: settings.includeOtherIncentivesInBaselineAndModeled ?? false },
                        stipend: { included: settings.includeStipendInBaselineAndModeled ?? false },
                      }
                      const qualityIncluded = inc.quality?.included ?? settings.includeQualityPaymentsInBaselineAndModeled
                      const overridePct = settings.qualityPaymentsSource === 'override_pct_of_base' ? (settings.qualityPaymentsOverridePct ?? 0) : 0
                      const baseScenarioPct = settings.includePsqInBaselineAndModeled ? (settings.baseScenarioInputs?.psqPercent ?? 0) : 0
                      const addingQualityTwice = qualityIncluded && overridePct > 0 && baseScenarioPct > 0
                      return (
                    <>
                    {qualityIncluded && (
                      <p className="text-xs text-muted-foreground">
                        Quality %: use <strong>one</strong> source — either &quot;Quality from&quot; override below or &quot;Add base scenario quality %&quot; — not both, or you add it twice.
                      </p>
                    )}
                    {addingQualityTwice && (
                      <div className="rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        You&apos;re adding quality twice: {overridePct}% from Override + {baseScenarioPct}% from base scenario = {overridePct + baseScenarioPct}% of base total. Turn off one or set one to 0%.
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSetSettings((prev) => ({
                          ...prev,
                          includePsqInBaselineAndModeled: !prev.includePsqInBaselineAndModeled,
                        }))
                      }
                      aria-pressed={settings.includePsqInBaselineAndModeled ?? false}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        settings.includePsqInBaselineAndModeled
                          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                          : 'border border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      Add base scenario quality %
                    </button>
                    <span className="text-sm text-muted-foreground">at</span>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={settings.baseScenarioInputs?.psqPercent ?? 0}
                      onChange={(e) => {
                        const raw = Number(e.target.value)
                        const val = Number.isNaN(raw) ? 0 : Math.min(50, Math.max(0, raw))
                        onSetSettings((prev) => ({
                          ...prev,
                          baseScenarioInputs: {
                            ...prev.baseScenarioInputs,
                            psqPercent: val,
                          },
                        }))
                      }}
                      className="h-8 w-20"
                      aria-label="Base scenario quality percent"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="About this option">
                          <Info className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                        Adds this % of base to TCC when Quality is included. Use this <strong>or</strong> &quot;Quality from → Override % of base&quot; below, not both (or you add quality twice).
                      </TooltipContent>
                    </Tooltip>
                    </div>
                    {(() => {
                      const setNormalizeForFTE = (componentId: 'quality' | 'otherIncentives' | 'stipend', normalizeForFTE: boolean) => {
                        onSetSettings((prev) => {
                          const current = prev.tccComponentInclusion ?? {
                            quality: { included: prev.includeQualityPaymentsInBaselineAndModeled },
                            workRVUIncentive: { included: prev.includeWorkRVUIncentiveInTCC },
                            otherIncentives: { included: prev.includeOtherIncentivesInBaselineAndModeled ?? false },
                            stipend: { included: prev.includeStipendInBaselineAndModeled ?? false },
                          }
                          const nextInclusion: TCCComponentInclusion = {
                            ...current,
                            [componentId]: { ...(current[componentId] ?? {}), normalizeForFTE },
                          }
                          return { ...prev, tccComponentInclusion: nextInclusion }
                        })
                      }
                      return (
                        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
                          {qualityIncluded && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Label className="text-xs text-muted-foreground">Quality from</Label>
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
                                <SelectTrigger className="h-8 w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="from_file">From upload (provider file)</SelectItem>
                                  <SelectItem value="override_pct_of_base">Override: % of base salary</SelectItem>
                                </SelectContent>
                              </Select>
                              {settings.qualityPaymentsSource === 'override_pct_of_base' && (
                                <>
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
                                    className="h-8 w-16"
                                  />
                                  <span className="text-xs text-muted-foreground">% of base</span>
                                </>
                              )}
                            </div>
                          )}
                          {(qualityIncluded || inc.otherIncentives?.included || inc.stipend?.included) && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Label className="text-xs text-muted-foreground">Per 1.0 FTE</Label>
                              {qualityIncluded && (
                                <button
                                  type="button"
                                  onClick={() => setNormalizeForFTE('quality', !(inc.quality?.normalizeForFTE ?? false))}
                                  aria-pressed={inc.quality?.normalizeForFTE ?? false}
                                  className={cn(
                                    'rounded-full px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    inc.quality?.normalizeForFTE
                                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                      : 'border border-border bg-background text-muted-foreground hover:bg-muted/50'
                                  )}
                                >
                                  Quality payment
                                </button>
                              )}
                              {inc.otherIncentives?.included && (
                                <button
                                  type="button"
                                  onClick={() => setNormalizeForFTE('otherIncentives', !(inc.otherIncentives?.normalizeForFTE ?? false))}
                                  aria-pressed={inc.otherIncentives?.normalizeForFTE ?? false}
                                  className={cn(
                                    'rounded-full px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    inc.otherIncentives?.normalizeForFTE
                                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                      : 'border border-border bg-background text-muted-foreground hover:bg-muted/50'
                                  )}
                                >
                                  Other incentives
                                </button>
                              )}
                              {inc.stipend?.included && (
                                <button
                                  type="button"
                                  onClick={() => setNormalizeForFTE('stipend', !(inc.stipend?.normalizeForFTE ?? false))}
                                  aria-pressed={inc.stipend?.normalizeForFTE ?? false}
                                  className={cn(
                                    'rounded-full px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    inc.stipend?.normalizeForFTE
                                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                      : 'border border-border bg-background text-muted-foreground hover:bg-muted/50'
                                  )}
                                >
                                  Non-clinical pay
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    </>
                      )
                    })()}
                  </div>

          <div className="mt-5 space-y-3 rounded-lg border border-border/50 bg-background/70 p-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional TCC (layered)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="About additional TCC layers">
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                  Add named layers on top of the selected components. Each layer can be percent of base, dollar per 1.0 FTE, flat dollar, or From provider file (e.g. otherIncentives or nonClinicalPay for admin/teaching/non-clinical).
                </TooltipContent>
              </Tooltip>
            </div>
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
                            <SelectItem value="otherIncentives">otherIncentives (retention, sign-on, etc.)</SelectItem>
                            <SelectItem value="otherIncentive1">otherIncentive1</SelectItem>
                            <SelectItem value="otherIncentive2">otherIncentive2</SelectItem>
                            <SelectItem value="otherIncentive3">otherIncentive3</SelectItem>
                            <SelectItem value="nonClinicalPay">nonClinicalPay (admin / teaching / non-clinical)</SelectItem>
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
          <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
            {configStep === 4 && runDisabled && runDisabledReasons.length > 0 ? (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100 dark:border-amber-400/40 dark:bg-amber-500/15">
                <AlertDescription>
                  <p className="font-medium mb-1">To run the optimizer:</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {runDisabledReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
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
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
