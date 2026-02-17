import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
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
  const [providerExcludeSearch, setProviderExcludeSearch] = useState('')
  const [showAdvancedExclusions, setShowAdvancedExclusions] = useState(false)
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
                <div className="space-y-8 rounded-lg border border-border/60 bg-muted/20 p-4 [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-border/40">
                  <SectionHeaderWithTooltip
                    variant="section"
                    title="Target scope"
                    tooltip="Choose which providers are included. Specialty, Model, Provider type (role), and Provider scope: all or custom selection."
                    className="text-primary/90"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Specialty scope */}
                    <div className="space-y-2 min-w-0 rounded-lg border border-border/50 bg-background/60 p-3">
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
                    {/* Model scope */}
                    {availableModels.length > 0 ? (
                      <div className="space-y-2 min-w-0 rounded-lg border border-border/50 bg-background/60 p-3">
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
                    {/* Provider type scope */}
                    {availableProviderTypes.length > 0 ? (
                      <div className="space-y-2 min-w-0 rounded-lg border border-border/50 bg-background/60 p-3">
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
                    {/* Provider scope */}
                    {availableProviders.length > 0 ? (
                      <div className="space-y-2 min-w-0 rounded-lg border border-border/50 bg-background/60 p-3">
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
                  <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold text-primary/90">Advanced exclusions</Label>
                        <p className="text-xs text-muted-foreground">
                          Optional: remove specific roles or providers after inclusion filters.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdvancedExclusions((prev) => !prev)}
                        className="gap-1.5"
                      >
                        {showAdvancedExclusions ? 'Hide' : 'Show'}
                        <ChevronDown className={cn('size-4 transition-transform', showAdvancedExclusions ? 'rotate-180' : '')} />
                      </Button>
                    </div>

                    {showAdvancedExclusions ? (
                      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2 min-w-0">
                          <Label className="text-xs font-medium text-muted-foreground">Exclude provider types</Label>
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
                        </div>

                        <div className="space-y-2 min-w-0">
                          <Label className="text-xs font-medium text-muted-foreground">Exclude providers</Label>
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
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    {filteredProviderRowsCount} provider(s) in scope
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
                    {excludedProviderIds.length > 0
                      ? ` · ${excludedProviderIds.length} provider(s) excluded`
                      : ''}
                  </p>
                </div>
              ) : null}

              {configStep === 2 ? (
                <div className="space-y-8 rounded-lg border border-border/60 bg-muted/20 p-4 [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-border/40">
                  <SectionHeaderWithTooltip
                    variant="section"
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
                <div className="space-y-8 rounded-lg border border-border/60 bg-muted/20 p-4 [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-border/40">
                  <h3 className="text-base font-semibold">Summary</h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    <li>
                      Scope: {targetMode === 'all' ? 'All specialties' : `${selectedSpecialties.length} specialty(ies)`}
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
                      · {filteredProviderRowsCount} providers
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
