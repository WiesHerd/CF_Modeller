import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Command, CommandInput } from '@/components/ui/command'
import { ChevronDown, Eraser, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProductivityTargetSettings, TargetApproach, PlanningCFSource } from '@/types/productivity-target'
import { WarningBanner } from '@/features/optimizer/components/warning-banner'

const CONFIG_STEPS = [
  { id: 1, label: 'Target scope' },
  { id: 2, label: 'Target method & planning' },
  { id: 3, label: 'Review & run' },
] as const

function LabelWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-4 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="More information"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

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

export function ProductivityTargetConfigureStage({
  hasData,
  settings,
  runDisabled,
  filteredProviderRowsCount,
  targetMode,
  selectedSpecialties,
  availableSpecialties,
  modelScopeMode,
  selectedModels,
  availableModels,
  onSetModelScopeMode,
  onSetSelectedModels,
  providerTypeScopeMode,
  selectedProviderTypes,
  excludedProviderTypes,
  availableProviderTypes,
  onSetProviderTypeScopeMode,
  onSetSelectedProviderTypes,
  onSetExcludedProviderTypes,
  excludedDivisions,
  availableDivisions,
  onSetExcludedDivisions,
  providerScopeMode,
  selectedProviderIds,
  excludedProviderIds,
  availableProviders,
  onSetProviderScopeMode,
  onSetSelectedProviderIds,
  onSetExcludedProviderIds,
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
  modelScopeMode: 'all' | 'custom'
  selectedModels: string[]
  availableModels: string[]
  onSetModelScopeMode: (mode: 'all' | 'custom') => void
  onSetSelectedModels: (models: string[]) => void
  providerTypeScopeMode: 'all' | 'custom'
  selectedProviderTypes: string[]
  excludedProviderTypes: string[]
  availableProviderTypes: string[]
  onSetProviderTypeScopeMode: (mode: 'all' | 'custom') => void
  onSetSelectedProviderTypes: (types: string[]) => void
  onSetExcludedProviderTypes: (types: string[]) => void
  excludedDivisions: string[]
  availableDivisions: string[]
  onSetExcludedDivisions: (divisions: string[]) => void
  providerScopeMode: 'all' | 'custom'
  selectedProviderIds: string[]
  excludedProviderIds: string[]
  availableProviders: { id: string; name: string }[]
  onSetProviderScopeMode: (mode: 'all' | 'custom') => void
  onSetSelectedProviderIds: (ids: string[]) => void
  onSetExcludedProviderIds: (ids: string[]) => void
  onRun: () => void
  onSetTargetMode: (mode: 'all' | 'custom') => void
  onSetSelectedSpecialties: (specialties: string[]) => void
  onSetSettings: React.Dispatch<React.SetStateAction<ProductivityTargetSettings>>
  configStep: number
  onSetConfigStep: (step: number) => void
}) {
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [providerTypeIncludeSearch, setProviderTypeIncludeSearch] = useState('')
  const [providerSearch, setProviderSearch] = useState('')
  const [providerTypeExcludeSearch, setProviderTypeExcludeSearch] = useState('')
  const [divisionExcludeSearch, setDivisionExcludeSearch] = useState('')
  const [providerExcludeSearch, setProviderExcludeSearch] = useState('')
  const [addOverrideMenuOpen, setAddOverrideMenuOpen] = useState(false)
  const [addOverrideSearch, setAddOverrideSearch] = useState('')
  const [overrideSpecialtySearch, setOverrideSpecialtySearch] = useState('')
  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return availableSpecialties
    const q = specialtySearch.toLowerCase()
    return availableSpecialties.filter((s) => s.toLowerCase().includes(q))
  }, [availableSpecialties, specialtySearch])
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return availableModels
    const q = modelSearch.toLowerCase()
    return availableModels.filter((m) => m.toLowerCase().includes(q))
  }, [availableModels, modelSearch])
  const filteredProviderTypes = useMemo(() => {
    if (!providerTypeIncludeSearch.trim()) return availableProviderTypes
    const q = providerTypeIncludeSearch.toLowerCase()
    return availableProviderTypes.filter((t) => t.toLowerCase().includes(q))
  }, [availableProviderTypes, providerTypeIncludeSearch])
  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return availableProviders
    const q = providerSearch.toLowerCase()
    return availableProviders.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [availableProviders, providerSearch])

  const filteredProviderTypesForExclusion = useMemo(() => {
    if (!providerTypeExcludeSearch.trim()) return availableProviderTypes
    const q = providerTypeExcludeSearch.toLowerCase()
    return availableProviderTypes.filter((t) => t.toLowerCase().includes(q))
  }, [availableProviderTypes, providerTypeExcludeSearch])

  const filteredDivisionsForExclusion = useMemo(() => {
    if (!divisionExcludeSearch.trim()) return availableDivisions
    const q = divisionExcludeSearch.toLowerCase()
    return availableDivisions.filter((d) => d.toLowerCase().includes(q))
  }, [availableDivisions, divisionExcludeSearch])

  const filteredProvidersForExclusion = useMemo(() => {
    if (!providerExcludeSearch.trim()) return availableProviders
    const q = providerExcludeSearch.toLowerCase()
    return availableProviders.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [availableProviders, providerExcludeSearch])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-end gap-3">
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
                <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      variant="section"
                      title="Target scope"
                      tooltip="Choose which providers are included. Specialty, Model, Provider type (role), and Provider scope: all or custom selection."
                      className="text-primary/90"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Configure who is included first, then apply exclusions.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <div className="space-y-4 min-w-0 rounded-lg border border-border/50 bg-background/70 p-4">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Include providers
                      </Label>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-primary/90">Specialty scope</Label>
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
                          <DropdownMenu onOpenChange={(open) => open && setSpecialtySearch('')}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
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
                                      onSelect={(e) => e.preventDefault()}
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
                      </div>

                      {availableModels.length > 0 ? (
                        <div className="space-y-2 border-t border-border/40 pt-3">
                          <Label className="text-sm font-semibold text-primary/90">Model scope</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={modelScopeMode === 'all' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onSetModelScopeMode('all')}
                            >
                              All models
                            </Button>
                            <Button
                              type="button"
                              variant={modelScopeMode === 'custom' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onSetModelScopeMode('custom')}
                            >
                              Custom selection
                            </Button>
                          </div>
                          {modelScopeMode === 'custom' ? (
                            <DropdownMenu onOpenChange={(open) => open && setModelSearch('')}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
                                  {selectedModels.length === 0
                                    ? 'Select models...'
                                    : `${selectedModels.length} model(s)`}
                                  <ChevronDown className="size-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="max-h-[320px] overflow-hidden p-0">
                                <Command shouldFilter={false} className="rounded-none border-0">
                                  <CommandInput
                                    placeholder="Search models…"
                                    value={modelSearch}
                                    onValueChange={setModelSearch}
                                    className="h-9"
                                  />
                                </Command>
                                <div className="max-h-[240px] overflow-y-auto p-1">
                                  <DropdownMenuLabel>Model (compensation type)</DropdownMenuLabel>
                                  {filteredModels.length === 0 ? (
                                    <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                  ) : (
                                    filteredModels.map((model) => (
                                      <DropdownMenuCheckboxItem
                                        key={model}
                                        checked={selectedModels.includes(model)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={(checked) =>
                                          onSetSelectedModels(
                                            checked ? [...selectedModels, model] : selectedModels.filter((m) => m !== model)
                                          )
                                        }
                                      >
                                        {model}
                                      </DropdownMenuCheckboxItem>
                                    ))
                                  )}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      ) : null}

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
                                <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
                                  {selectedProviderTypes.length === 0
                                    ? 'Select provider types...'
                                    : `${selectedProviderTypes.length} type(s)`}
                                  <ChevronDown className="size-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="max-h-[320px] overflow-hidden p-0">
                                <Command shouldFilter={false} className="rounded-none border-0">
                                  <CommandInput
                                    placeholder="Search provider types…"
                                    value={providerTypeIncludeSearch}
                                    onValueChange={setProviderTypeIncludeSearch}
                                    className="h-9"
                                  />
                                </Command>
                                <div className="max-h-[240px] overflow-y-auto p-1">
                                  <DropdownMenuLabel>Provider type (role)</DropdownMenuLabel>
                                  {filteredProviderTypes.length === 0 ? (
                                    <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                  ) : (
                                    filteredProviderTypes.map((providerType) => (
                                      <DropdownMenuCheckboxItem
                                        key={providerType}
                                        checked={selectedProviderTypes.includes(providerType)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={(checked) =>
                                          onSetSelectedProviderTypes(
                                            checked ? [...selectedProviderTypes, providerType] : selectedProviderTypes.filter((t) => t !== providerType)
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
                          ) : null}
                        </div>
                      ) : null}

                      {availableProviders.length > 0 ? (
                        <div className="space-y-2 border-t border-border/40 pt-3">
                          <Label className="text-sm font-semibold text-primary/90">Provider scope</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={providerScopeMode === 'all' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onSetProviderScopeMode('all')}
                            >
                              All providers in scope
                            </Button>
                            <Button
                              type="button"
                              variant={providerScopeMode === 'custom' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onSetProviderScopeMode('custom')}
                            >
                              Custom selection
                            </Button>
                          </div>
                          {providerScopeMode === 'custom' ? (
                            <DropdownMenu onOpenChange={(open) => open && setProviderSearch('')}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
                                  {selectedProviderIds.length === 0
                                    ? 'Select providers...'
                                    : `${selectedProviderIds.length} provider(s)`}
                                  <ChevronDown className="size-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="max-h-[320px] overflow-hidden p-0">
                                <Command shouldFilter={false} className="rounded-none border-0">
                                  <CommandInput
                                    placeholder="Search providers…"
                                    value={providerSearch}
                                    onValueChange={setProviderSearch}
                                    className="h-9"
                                  />
                                </Command>
                                <div className="max-h-[240px] overflow-y-auto p-1">
                                  <DropdownMenuLabel>Provider</DropdownMenuLabel>
                                  {filteredProviders.length === 0 ? (
                                    <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                  ) : (
                                    filteredProviders.map((p) => (
                                      <DropdownMenuCheckboxItem
                                        key={p.id}
                                        checked={selectedProviderIds.includes(p.id)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={(checked) =>
                                          onSetSelectedProviderIds(
                                            checked ? [...selectedProviderIds, p.id] : selectedProviderIds.filter((id) => id !== p.id)
                                          )
                                        }
                                      >
                                        {p.name}
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
                        Exclusions
                      </Label>

                      <div className="space-y-2">
                        <SectionHeaderWithTooltip
                          title="Exclude provider types"
                          tooltip="Optionally exclude providers by role or provider type after applying inclusion filters."
                          className="text-primary/90"
                        />
                        {availableProviderTypes.length > 0 ? (
                          <DropdownMenu onOpenChange={(open) => open && setProviderTypeExcludeSearch('')}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
                                {excludedProviderTypes.length === 0
                                  ? 'None excluded'
                                  : `${excludedProviderTypes.length} type(s) excluded`}
                                <ChevronDown className="size-4 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-[320px] overflow-hidden p-0">
                              <Command shouldFilter={false} className="rounded-none border-0">
                                <CommandInput
                                  placeholder="Search provider types…"
                                  value={providerTypeExcludeSearch}
                                  onValueChange={setProviderTypeExcludeSearch}
                                  className="h-9"
                                />
                              </Command>
                              <div className="max-h-[240px] overflow-y-auto p-1">
                                <DropdownMenuLabel>Exclude provider types (role)</DropdownMenuLabel>
                                {filteredProviderTypesForExclusion.length === 0 ? (
                                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                ) : (
                                  filteredProviderTypesForExclusion.map((providerType) => (
                                    <DropdownMenuCheckboxItem
                                      key={providerType}
                                      checked={excludedProviderTypes.includes(providerType)}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(checked) =>
                                        onSetExcludedProviderTypes(
                                          checked
                                            ? [...excludedProviderTypes, providerType]
                                            : excludedProviderTypes.filter((t) => t !== providerType)
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
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No provider types in your data yet.
                          </p>
                        )}
                      </div>

                      {availableDivisions.length > 0 ? (
                        <div className="space-y-2 border-t border-border/40 pt-3">
                          <SectionHeaderWithTooltip
                            title="Exclude divisions / departments"
                            tooltip="Optionally exclude providers by division or department after applying inclusion filters."
                            className="text-primary/90"
                          />
                          <DropdownMenu onOpenChange={(open) => !open && setDivisionExcludeSearch('')}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
                                {excludedDivisions.length === 0
                                  ? 'None excluded'
                                  : `${excludedDivisions.length} division(s) excluded`}
                                <ChevronDown className="size-4 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-[320px] overflow-hidden p-0">
                              <Command shouldFilter={false} className="rounded-none border-0">
                                <CommandInput
                                  placeholder="Search divisions…"
                                  value={divisionExcludeSearch}
                                  onValueChange={setDivisionExcludeSearch}
                                  className="h-9"
                                />
                              </Command>
                              <div className="max-h-[240px] overflow-y-auto p-1">
                                <DropdownMenuLabel>Exclude divisions / departments</DropdownMenuLabel>
                                {filteredDivisionsForExclusion.length === 0 ? (
                                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                ) : (
                                  filteredDivisionsForExclusion.map((division) => (
                                    <DropdownMenuCheckboxItem
                                      key={division}
                                      checked={excludedDivisions.includes(division)}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(checked) =>
                                        onSetExcludedDivisions(
                                          checked
                                            ? [...excludedDivisions, division]
                                            : excludedDivisions.filter((d) => d !== division)
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
                        </div>
                      ) : null}

                      <div className="space-y-2 border-t border-border/40 pt-3">
                        <SectionHeaderWithTooltip
                          title="Exclude providers"
                          tooltip="Optionally exclude specific providers by name after applying inclusion filters."
                          className="text-primary/90"
                        />
                        {availableProviders.length > 0 ? (
                          <DropdownMenu onOpenChange={(open) => open && setProviderExcludeSearch('')}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
                                {excludedProviderIds.length === 0
                                  ? 'None excluded'
                                  : `${excludedProviderIds.length} provider(s) excluded`}
                                <ChevronDown className="size-4 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-[320px] overflow-hidden p-0">
                              <Command shouldFilter={false} className="rounded-none border-0">
                                <CommandInput
                                  placeholder="Search providers…"
                                  value={providerExcludeSearch}
                                  onValueChange={setProviderExcludeSearch}
                                  className="h-9"
                                />
                              </Command>
                              <div className="max-h-[240px] overflow-y-auto p-1">
                                <DropdownMenuLabel>Exclude providers</DropdownMenuLabel>
                                {filteredProvidersForExclusion.length === 0 ? (
                                  <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                ) : (
                                  filteredProvidersForExclusion.map((p) => (
                                    <DropdownMenuCheckboxItem
                                      key={p.id}
                                      checked={excludedProviderIds.includes(p.id)}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(checked) =>
                                        onSetExcludedProviderIds(
                                          checked
                                            ? [...excludedProviderIds, p.id]
                                            : excludedProviderIds.filter((id) => id !== p.id)
                                        )
                                      }
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
                            No providers available in scope yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{filteredProviderRowsCount}</span> provider(s) in scope
                    {targetMode === 'custom' && selectedSpecialties.length > 0
                      ? ` across ${selectedSpecialties.length} specialty(ies)`
                      : ''}
                    {modelScopeMode === 'custom' && selectedModels.length > 0
                      ? ` · ${selectedModels.length} model(s)`
                      : ''}
                    {providerTypeScopeMode === 'custom' && selectedProviderTypes.length > 0
                      ? ` · ${selectedProviderTypes.length} provider type(s)`
                      : ''}
                    {providerScopeMode === 'custom' && selectedProviderIds.length > 0
                      ? ` · ${selectedProviderIds.length} provider(s) selected`
                      : ''}
                    {excludedProviderTypes.length > 0
                      ? ` · ${excludedProviderTypes.length} provider type(s) excluded`
                      : ''}
                    {excludedDivisions.length > 0
                      ? ` · ${excludedDivisions.length} division(s) excluded`
                      : ''}
                    {excludedProviderIds.length > 0
                      ? ` · ${excludedProviderIds.length} provider(s) excluded`
                      : ''}
                  </div>
                </div>
              ) : null}

              {configStep === 2 ? (
                <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      variant="section"
                      title="Target method"
                      tooltip="Target is expressed at 1.0 cFTE; provider-level targets are prorated by each provider's cFTE. A = market wRVU at a percentile. B = you enter a gross target wRVU (at 1.0 cFTE); we prorate for calculations."
                      className="text-primary/90"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose how the productivity target is defined, then set the values used for alignment and planning payout estimates.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/70 p-4">
                    <Label className="text-sm font-semibold text-primary/90">Choose target approach & set inputs</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Use market wRVU percentile (A) or enter a gross target wRVU at 1.0 cFTE (B). Set the target value and alignment tolerance.
                    </p>
                    <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <LabelWithTooltip
                          label="Approach"
                          tooltip={settings.targetApproach === 'wrvu_percentile'
                            ? 'Target = market work RVU at your chosen percentile from your loaded market (survey) data. Same productivity benchmark for everyone in the specialty (e.g. 50th = median wRVU).'
                            : 'You enter the gross target wRVU at 1.0 cFTE. Provider targets are prorated by cFTE (e.g. 0.8 cFTE gets 0.8 × this target). No survey math—you set the number.'}
                        />
                        <Select
                          value={settings.targetApproach}
                          onValueChange={(v: TargetApproach) => onSetSettings((s) => ({ ...s, targetApproach: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="wrvu_percentile">A: Target = market wRVU at a percentile</SelectItem>
                            <SelectItem value="pay_per_wrvu">B: Enter gross target wRVU (at 1.0 cFTE, prorated)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {settings.targetApproach === 'wrvu_percentile'
                            ? 'Approach A uses your loaded market survey percentile.'
                            : 'Approach B lets you enter one gross target; provider targets are prorated by cFTE.'}
                        </p>
                      </div>
                      <div className="space-y-4 border-t border-border/40 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                        {settings.targetApproach === 'wrvu_percentile' ? (
                          <div className="space-y-2">
                            <LabelWithTooltip
                              label="Target percentile (wRVU)"
                              tooltip="Which percentile of market wRVU to use as the target (e.g. 50 = median productivity)."
                            />
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
                        ) : (
                          <div className="space-y-2">
                            <LabelWithTooltip
                              label="Target wRVU (at 1.0 cFTE)"
                              tooltip="Gross target wRVU at 1.0 cFTE. Each provider's target = this value × their cFTE (e.g. 0.8 cFTE → 0.8 × this number). You enter the amount; we prorate for calculations."
                            />
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={
                                settings.manualTargetWRVU != null && Number.isFinite(settings.manualTargetWRVU)
                                  ? String(settings.manualTargetWRVU)
                                  : ''
                              }
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '').trim()
                                const n = raw === '' ? undefined : parseFloat(raw)
                                onSetSettings((s) => ({
                                  ...s,
                                  manualTargetWRVU:
                                    n != null && !Number.isNaN(n) && n >= 0 ? n : undefined,
                                }))
                              }}
                              placeholder="wRVU"
                              className="w-32 bg-white placeholder:text-muted-foreground/50"
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <LabelWithTooltip
                            label="Alignment tolerance (± percentile pts)"
                            tooltip="Providers within ± this many percentile points of the target count as aligned. Larger = more providers considered on target."
                          />
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
                    </div>
                  </div>

                  {(() => {
                    const inScopeSpecialtyCount = targetMode === 'custom' ? selectedSpecialties.length : availableSpecialties.length
                    if (inScopeSpecialtyCount <= 1) return null
                    return (
                  <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <SectionHeaderWithTooltip
                          variant="subsection"
                          title="Override by specialty"
                          tooltip="Only specialties that need a different target need an override. All others use the default above."
                          className="text-primary/90"
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Add only where you need a different target.
                        </p>
                      </div>
                      {(() => {
                        const inScopeSpecialties = targetMode === 'custom' ? selectedSpecialties : availableSpecialties
                        const overrides = settings.specialtyTargetOverrides ?? {}
                        const overriddenSpecialties = Object.keys(overrides)
                        const specialtiesAvailableToAdd = inScopeSpecialties.filter((s) => !overrides[s])
                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            <DropdownMenu
                              open={addOverrideMenuOpen}
                              onOpenChange={(open) => {
                                setAddOverrideMenuOpen(open)
                                if (!open) setAddOverrideSearch('')
                              }}
                            >
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 font-normal"
                                  disabled={inScopeSpecialties.length === 0}
                                >
                                  <Plus className="size-3.5" />
                                  Add overrides
                                  {overriddenSpecialties.length > 0 ? (
                                    <span className="tabular-nums">({overriddenSpecialties.length})</span>
                                  ) : null}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="max-h-[320px] overflow-hidden p-0">
                                <Command shouldFilter={false} className="rounded-none border-0">
                                  <CommandInput
                                    placeholder="Search specialties…"
                                    value={addOverrideSearch}
                                    onValueChange={setAddOverrideSearch}
                                    className="h-9"
                                  />
                                </Command>
                                <div className="max-h-[240px] overflow-y-auto p-1">
                                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                                    Click a specialty to add an override
                                  </DropdownMenuLabel>
                                  {inScopeSpecialties.length === 0 ? (
                                    <div className="px-2 py-2 text-sm text-muted-foreground">No specialties in scope.</div>
                                  ) : (() => {
                                    const filtered =
                                      addOverrideSearch.trim() === ''
                                        ? specialtiesAvailableToAdd
                                        : specialtiesAvailableToAdd.filter((s) =>
                                            s.toLowerCase().includes(addOverrideSearch.toLowerCase().trim())
                                          )
                                    return filtered.length === 0 ? (
                                      <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                                    ) : (
                                      filtered.map((specialty) => (
                                        <DropdownMenuItem
                                          key={specialty}
                                          onSelect={() => {
                                            onSetSettings((s) => ({
                                              ...s,
                                              specialtyTargetOverrides: {
                                                ...(s.specialtyTargetOverrides ?? {}),
                                                [specialty]: {
                                                  targetApproach: s.targetApproach,
                                                  targetPercentile: s.targetPercentile,
                                                  manualTargetWRVU: s.manualTargetWRVU,
                                                },
                                              },
                                            }))
                                            setAddOverrideMenuOpen(false)
                                          }}
                                        >
                                          {specialty}
                                        </DropdownMenuItem>
                                      ))
                                    )
                                  })()}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {overriddenSpecialties.length > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label="Clear all overrides"
                                    onClick={() => onSetSettings((s) => ({ ...s, specialtyTargetOverrides: undefined }))}
                                  >
                                    <Eraser className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  Clear all overrides
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        )
                      })()}
                    </div>
                    {(() => {
                      const inScopeSpecialties = targetMode === 'custom' ? selectedSpecialties : availableSpecialties
                      const overrides = settings.specialtyTargetOverrides ?? {}
                      const listSpecialties =
                        overrideSpecialtySearch.trim() === ''
                          ? inScopeSpecialties
                          : inScopeSpecialties.filter((s) =>
                              s.toLowerCase().includes(overrideSpecialtySearch.toLowerCase().trim())
                            )

                      function OverrideRow({ specialty }: { specialty: string }) {
                        const override = overrides[specialty]
                        const hasOverride = override != null
                        const approach = override?.targetApproach ?? settings.targetApproach
                        const percentile = override?.targetPercentile ?? settings.targetPercentile
                        const manualWRVU = override?.manualTargetWRVU ?? settings.manualTargetWRVU
                        return (
                          <div className="flex items-center gap-3 py-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{specialty}</span>
                            <div className="flex items-center gap-4">
                              <div
                                role="group"
                                aria-label="Target type"
                                className="inline-flex rounded-lg border border-border/50 bg-muted/20 p-0.5"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetSettings((s) => ({
                                      ...s,
                                      specialtyTargetOverrides: {
                                        ...(s.specialtyTargetOverrides ?? {}),
                                        [specialty]: {
                                          targetApproach: 'wrvu_percentile',
                                          targetPercentile: s.specialtyTargetOverrides?.[specialty]?.targetPercentile ?? s.targetPercentile,
                                        },
                                      },
                                    }))
                                  }
                                  className={cn(
                                    'min-w-[5.5rem] w-[5.5rem] rounded-md py-1.5 text-center text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                    approach === 'wrvu_percentile'
                                      ? 'bg-primary/15 text-primary ring-1 ring-primary/25 shadow-sm'
                                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                  )}
                                >
                                  Percentile
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetSettings((s) => ({
                                      ...s,
                                      specialtyTargetOverrides: {
                                        ...(s.specialtyTargetOverrides ?? {}),
                                        [specialty]: {
                                          targetApproach: 'pay_per_wrvu',
                                          manualTargetWRVU: s.specialtyTargetOverrides?.[specialty]?.manualTargetWRVU ?? s.manualTargetWRVU,
                                        },
                                      },
                                    }))
                                  }
                                  className={cn(
                                    'min-w-[5.5rem] w-[5.5rem] rounded-md py-1.5 text-center text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                    approach === 'pay_per_wrvu'
                                      ? 'bg-primary/15 text-primary ring-1 ring-primary/25 shadow-sm'
                                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                  )}
                                >
                                  Fixed wRVU
                                </button>
                              </div>
                              {approach === 'wrvu_percentile' ? (
                                <Input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={percentile}
                                  className="h-8 w-28 rounded-lg border border-border/60 bg-white text-center text-sm tabular-nums shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
                                  onChange={(e) => {
                                    const n = Math.min(99, Math.max(1, Number(e.target.value) || 50))
                                    onSetSettings((s) => ({
                                      ...s,
                                      specialtyTargetOverrides: {
                                        ...(s.specialtyTargetOverrides ?? {}),
                                        [specialty]: {
                                          ...(s.specialtyTargetOverrides?.[specialty] ?? { targetApproach: 'wrvu_percentile' }),
                                          targetPercentile: n,
                                        },
                                      },
                                    }))
                                  }}
                                />
                              ) : (
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="wRVU"
                                  value={
                                    manualWRVU != null && Number.isFinite(manualWRVU)
                                      ? String(manualWRVU)
                                      : ''
                                  }
                                  className="h-8 w-28 rounded-lg border border-border/60 bg-white text-right text-sm tabular-nums shadow-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring/20"
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/,/g, '').trim()
                                    const n = raw === '' ? undefined : parseFloat(raw)
                                    const valid =
                                      n != null && !Number.isNaN(n) && n >= 0 ? n : undefined
                                    onSetSettings((s) => ({
                                      ...s,
                                      specialtyTargetOverrides: {
                                        ...(s.specialtyTargetOverrides ?? {}),
                                        [specialty]: {
                                          ...(s.specialtyTargetOverrides?.[specialty] ?? { targetApproach: 'pay_per_wrvu' }),
                                          manualTargetWRVU: valid,
                                        },
                                      },
                                    }))
                                  }}
                                />
                              )}
                            </div>
                            {hasOverride ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label={`Remove override for ${specialty}`}
                                    onClick={() => {
                                      onSetSettings((s) => {
                                        const next = { ...(s.specialtyTargetOverrides ?? {}) }
                                        delete next[specialty]
                                        return {
                                          ...s,
                                          specialtyTargetOverrides: Object.keys(next).length > 0 ? next : undefined,
                                        }
                                      })
                                    }}
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                  Remove override
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="w-6 shrink-0" aria-hidden />
                            )}
                          </div>
                        )
                      }

                      return (
                        <div className="space-y-3">
                          {inScopeSpecialties.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No specialties in scope. Adjust Target scope (step 1).</p>
                          ) : (
                            <>
                              <Input
                                type="text"
                                placeholder="Search specialties…"
                                value={overrideSpecialtySearch}
                                onChange={(e) => setOverrideSpecialtySearch(e.target.value)}
                                className="h-8 w-full max-w-xs rounded-lg border border-border/60 bg-white text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring/20"
                              />
                              {listSpecialties.length === 0 ? (
                                <p className="py-2 text-xs text-muted-foreground">No match. Try a different search.</p>
                              ) : (
                                <div className="flex max-h-[320px] flex-col divide-y divide-border/40 overflow-y-auto">
                                  {listSpecialties.map((specialty) => (
                                    <OverrideRow key={specialty} specialty={specialty} />
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                    )
                  })()}

                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/70 p-4">
                    <SectionHeaderWithTooltip
                      variant="subsection"
                      title="Planning incentive (CF for potential payout)"
                      tooltip="The conversion factor (CF) used to estimate how much providers get paid when they hit the productivity target—i.e. the $/wRVU payout rate. Use current rate from your upload, market at a percentile, or enter a manual $/wRVU. For planning only; does not change the CF Optimizer."
                      className="text-primary/90"
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose the payout CF source used for planning-only incentive estimates.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <LabelWithTooltip
                          label="CF for planning"
                          tooltip={
                            settings.planningCFSource === 'current_rate'
                              ? 'Uses each provider’s current conversion factor from your uploaded data to estimate incentive payout when they hit the target.'
                              : settings.planningCFSource === 'market_percentile'
                                ? 'Uses market CF at your chosen percentile to estimate incentive payout when they hit the target (e.g. 50th = median).'
                                : 'Enter the dollar amount per wRVU paid when they hit the incentive (e.g. 52 = $52/wRVU). This is the payout rate for planning.'
                          }
                        />
                        <Select
                          value={settings.planningCFSource}
                          onValueChange={(v: PlanningCFSource) => onSetSettings((s) => ({ ...s, planningCFSource: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="current_rate">Current rate (from upload)</SelectItem>
                            <SelectItem value="market_percentile">Market at percentile</SelectItem>
                            <SelectItem value="manual">Manual $/wRVU (enter payout rate)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {settings.planningCFSource === 'market_percentile' ? (
                        <div className="space-y-2">
                          <LabelWithTooltip
                            label="Planning CF percentile"
                            tooltip="Market CF at this percentile (e.g. 50 = median) used to estimate potential incentive payout."
                          />
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
                      ) : settings.planningCFSource === 'manual' ? (
                        <div className="space-y-2">
                          <LabelWithTooltip
                            label="Manual $/wRVU"
                            tooltip="The dollar amount per wRVU paid when they hit the incentive (e.g. 52 = $52/wRVU). This is the payout rate used for planning estimates."
                          />
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
                            placeholder="e.g. 52"
                            className="w-24"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {configStep === 3 ? (
                <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <SectionHeaderWithTooltip
                      variant="section"
                      title="Summary"
                      tooltip="Review scope, target method, and planning incentive before running. Group target is the same wRVU (at 1.0 cFTE) for everyone in the specialty; scaled by cFTE per provider."
                      className="text-primary/90"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review your choices below, then run to see productivity target results by specialty.
                    </p>
                  </div>
                  <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground border-t border-border/40 pt-4">
                    <li>
                      <span className="text-foreground font-medium">Scope:</span>{' '}
                      {targetMode === 'all' ? (
                        <span className="text-foreground font-medium">All specialties</span>
                      ) : (
                        <span className="text-primary font-medium tabular-nums">{selectedSpecialties.length} specialty(ies)</span>
                      )}
                      {availableModels.length > 0
                        ? modelScopeMode === 'all'
                          ? ' · All models'
                          : ` · ${selectedModels.length} model(s)`
                        : ''}
                      {availableProviderTypes.length > 0
                        ? providerTypeScopeMode === 'all'
                          ? ' · All provider types'
                          : ` · ${selectedProviderTypes.length} provider type(s)`
                        : ''}
                      {availableProviders.length > 0
                        ? providerScopeMode === 'all'
                          ? ' · All providers in scope'
                          : ` · ${selectedProviderIds.length} provider(s)`
                        : ''}{' '}
                      · <span className="text-primary font-medium tabular-nums">{filteredProviderRowsCount} providers</span>
                    </li>
                    <li>
                      <span className="text-foreground font-medium">Target:</span>{' '}
                      <span className="text-primary font-medium">Approach {settings.targetApproach === 'wrvu_percentile' ? 'A' : 'B'}</span>
                      {settings.targetApproach === 'wrvu_percentile' ? (
                        <>
                          {' at '}
                          <span className="text-primary font-medium tabular-nums">{settings.targetPercentile}th percentile</span>
                        </>
                      ) : (
                        <>
                          {' · '}
                          <span className="text-primary font-medium tabular-nums">{settings.manualTargetWRVU ?? '—'} wRVU</span>
                          <span className="text-muted-foreground"> (at 1.0 cFTE, prorated by cFTE)</span>
                        </>
                      )}
                      {Object.keys(settings.specialtyTargetOverrides ?? {}).length > 0 ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · <span className="text-primary font-medium tabular-nums">{Object.keys(settings.specialtyTargetOverrides ?? {}).length} specialty overrides</span>
                        </span>
                      ) : null}
                    </li>
                    <li>
                      <span className="text-foreground font-medium">Planning incentive:</span>{' '}
                      {settings.planningCFSource === 'current_rate' ? (
                        <span className="text-primary font-medium">Current rate (from upload)</span>
                      ) : settings.planningCFSource === 'market_percentile' ? (
                        <span className="text-primary font-medium tabular-nums">Market at {settings.planningCFPercentile}th</span>
                      ) : (
                        <span className="text-primary font-medium tabular-nums">Manual ${settings.planningCFManual ?? '—'}/wRVU</span>
                      )}
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Group target</span> is the same{' '}
                    <span className="font-medium text-foreground">wRVU</span> (at{' '}
                    <span className="font-medium text-foreground tabular-nums">1.0 cFTE</span>) for everyone in the specialty; scaled by{' '}
                    <span className="font-medium text-foreground">cFTE</span> per provider. This sets the productivity expectation only—it does not change the conversion factor from the CF Optimizer.
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
