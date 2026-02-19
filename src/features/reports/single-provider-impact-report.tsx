import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, FileDown, FileSpreadsheet, FileText, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { ImpactReportPage } from '@/components/impact-report-page'
import { matchMarketRow } from '@/lib/batch'
import { computeScenario } from '@/lib/compute'
import { downloadSingleScenarioCSV, exportSingleScenarioXLSX } from '@/lib/single-scenario-export'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { SynonymMap } from '@/types/batch'

export interface SingleProviderImpactReportProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  onBack: () => void
}

export function SingleProviderImpactReport({
  providerRows,
  marketRows,
  scenarioInputs,
  savedScenarios,
  batchSynonymMap,
  onBack,
}: SingleProviderImpactReportProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('current')
  const [providerSearch, setProviderSearch] = useState('')

  const filteredProviderRows = useMemo(() => {
    if (!providerSearch.trim()) return providerRows
    const q = providerSearch.trim().toLowerCase()
    return providerRows.filter(
      (p) =>
        (p.providerName ?? '').toLowerCase().includes(q) ||
        (p.providerId ?? '').toString().toLowerCase().includes(q) ||
        (p.specialty ?? '').toLowerCase().includes(q)
    )
  }, [providerRows, providerSearch])

  const selectedProvider = useMemo(
    () =>
      selectedProviderId
        ? providerRows.find((p) => p.providerId === selectedProviderId || p.providerName === selectedProviderId) ?? null
        : providerRows[0] ?? null,
    [providerRows, selectedProviderId]
  )

  const effectiveScenarioInputs = useMemo((): ScenarioInputs => {
    if (selectedScenarioId === 'current') return scenarioInputs
    const saved = savedScenarios.find((s) => s.id === selectedScenarioId)
    return saved?.scenarioInputs ?? scenarioInputs
  }, [selectedScenarioId, scenarioInputs, savedScenarios])

  const { results, marketMatch } = useMemo(() => {
    if (!selectedProvider || marketRows.length === 0) {
      return { results: null, marketMatch: null as MarketRow | null }
    }
    const match = matchMarketRow(selectedProvider, marketRows, batchSynonymMap)
    if (!match.marketRow) return { results: null, marketMatch: null }
    const results = computeScenario(selectedProvider, match.marketRow, effectiveScenarioInputs)
    return { results, marketMatch: match.marketRow }
  }, [selectedProvider, marketRows, batchSynonymMap, effectiveScenarioInputs])

  const exportInput = useMemo(
    () =>
      selectedProvider && marketMatch
        ? {
            provider: selectedProvider,
            marketRow: marketMatch,
            results,
            scenarioInputs: effectiveScenarioInputs,
            mode: 'existing' as const,
          }
        : null,
    [selectedProvider, marketMatch, results, effectiveScenarioInputs]
  )

  const handleExportCSV = () => {
    if (exportInput) downloadSingleScenarioCSV(exportInput)
  }

  const handleExportXLSX = () => {
    if (exportInput) exportSingleScenarioXLSX(exportInput)
  }

  if (providerRows.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Compensation impact report
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Import provider and market data to generate this report.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const providerLabel =
    selectedProvider?.providerName || selectedProvider?.providerId || 'Provider'

  return (
    <div className="space-y-6 report-print">
      {/* Row 1: Title + confidential (left), actions (right) — matches TCC percentiles & Batch results */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
            Compensation impact report
          </SectionTitleWithIcon>
          {results && selectedProvider && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              Confidential — compensation planning
            </p>
          )}
        </div>
        {results && exportInput && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 no-print" aria-label="Export data">
                <FileDown className="size-4" />
                Export
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Export</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                <FileDown className="size-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLSX} className="gap-2">
                <FileSpreadsheet className="size-4" />
                Export XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {/* Row 2: Back button — standard location used in Report library, TCC percentiles, and Batch results */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 no-print">
          <DropdownMenu onOpenChange={(open) => !open && setProviderSearch('')}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-[280px] min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
              >
                <span className="truncate">
                  {selectedProvider
                    ? selectedProvider.providerName || selectedProvider.providerId || '—'
                    : 'Select provider'}
                </span>
                <ChevronDown className="size-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
              onCloseAutoFocus={(e: Event) => e.preventDefault()}
            >
              <Command shouldFilter={false} className="rounded-none border-0">
                <CommandInput
                  placeholder="Search providers…"
                  value={providerSearch}
                  onValueChange={setProviderSearch}
                  className="h-9"
                />
                <CommandList>
                  <CommandEmpty>No provider found.</CommandEmpty>
                  <CommandGroup>
                    {filteredProviderRows.map((p, i) => {
                      const val = String(p.providerId ?? p.providerName ?? `row-${i}`)
                      const label = p.providerName || p.providerId || '—'
                      const subtitle = [p.specialty, p.division].filter(Boolean).join(' · ')
                      return (
                        <CommandItem
                          key={val}
                          value={val}
                          onSelect={() => {
                            setSelectedProviderId(val)
                          }}
                        >
                          <span className="truncate">
                            {label}
                            {subtitle ? ` — ${subtitle}` : ''}
                          </span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Scenario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current scenario</SelectItem>
              {savedScenarios.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      {!marketMatch && selectedProvider && marketRows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No market data found for specialty &quot;{selectedProvider.specialty ?? '—'}&quot;. Add market data or use a synonym in Import data.
            </p>
          </CardContent>
        </Card>
      )}

      {results && selectedProvider && (
        <>
          <ImpactReportPage
            results={results}
            provider={selectedProvider}
            scenarioInputs={effectiveScenarioInputs}
            providerLabel={providerLabel}
            onBackToModeller={onBack}
          />
        </>
      )}

      {marketRows.length === 0 && providerRows.length > 0 && selectedProvider && (
        <p className="text-muted-foreground text-sm">Import market data to compute the impact report.</p>
      )}
    </div>
  )
}
