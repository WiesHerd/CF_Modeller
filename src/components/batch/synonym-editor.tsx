import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, BookMarked, CheckIcon, ChevronDownIcon, ChevronUpIcon, Sparkles, ChevronLeft, ChevronRight, Info, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { suggestSpecialtyMappings } from '@/lib/specialty-match'
import type { SynonymMap } from '@/types/batch'

const NO_MAP_VALUE = '__no_map__'

interface SynonymEditorProps {
  synonymMap: SynonymMap
  onAdd: (key: string, value: string) => void
  onRemove: (key: string) => void
  /** When set, parent controls visibility: always render expanded and call this on Hide. No standalone collapsed card. */
  onHide?: () => void
  /** Unique specialties from uploaded provider file (enables dropdown). */
  providerSpecialties?: string[]
  /** Unique specialties from uploaded market file (enables dropdown). */
  marketSpecialties?: string[]
  disabled?: boolean
}

export function SynonymEditor({
  synonymMap,
  onAdd,
  onRemove,
  onHide,
  providerSpecialties = [],
  marketSpecialties = [],
  disabled = false,
}: SynonymEditorProps) {
  /** Bulk: provider specialty -> selected market specialty (or '' / NO_MAP_VALUE) */
  const [bulkSelections, setBulkSelections] = useState<Record<string, string>>({})
  /** Which bulk row's market dropdown is open (provider specialty key). */
  const [openBulkKey, setOpenBulkKey] = useState<string | null>(null)
  const [bulkPage, setBulkPage] = useState(0)
  const [bulkPageSize, setBulkPageSize] = useState(25)
  const [mappingsVisible, setMappingsVisible] = useState(false)

  const hasProviderOptions = providerSpecialties.length > 0
  const hasMarketOptions = marketSpecialties.length > 0

  // Pre-fill bulk selections from synonym map, then proximity suggestions for unmapped rows
  const synonymMapKey = Object.keys(synonymMap).sort().join('\0')
  const providerListKey = providerSpecialties.join('\0')
  const marketListKey = marketSpecialties.join('\0')
  useEffect(() => {
    if (providerSpecialties.length === 0) return
    setBulkSelections((prev) => {
      const next = { ...prev }
      let changed = false
      for (const p of providerSpecialties) {
        const existing = synonymMap[p] ?? synonymMap[p.trim()] ?? synonymMap[p.toLowerCase()]
        const value = existing !== undefined ? existing : NO_MAP_VALUE
        if (next[p] !== value) {
          next[p] = value
          changed = true
        }
      }
      if (marketSpecialties.length > 0) {
        const suggested = suggestSpecialtyMappings(providerSpecialties, marketSpecialties)
        for (const [prov, market] of Object.entries(suggested)) {
          const current = next[prov] ?? NO_MAP_VALUE
          if (current === NO_MAP_VALUE || current === '') {
            next[prov] = market
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [providerListKey, marketListKey, synonymMapKey])

  const bulkAddCount = useMemo(() => {
    return Object.entries(bulkSelections).filter(
      ([, market]) => market && market !== NO_MAP_VALUE && market.trim() !== ''
    ).length
  }, [bulkSelections])

  const handleSuggestBySimilarity = () => {
    const suggested = suggestSpecialtyMappings(providerSpecialties, marketSpecialties)
    setBulkSelections((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [prov, market] of Object.entries(suggested)) {
        const current = prev[prov] ?? NO_MAP_VALUE
        if (current === NO_MAP_VALUE || current === '') {
          next[prov] = market
          changed = true
        }
      }
      return changed ? next : prev
    })
  }

  const suggestCount = useMemo(() => {
    const suggested = suggestSpecialtyMappings(providerSpecialties, marketSpecialties)
    return providerSpecialties.filter(
      (p) => (bulkSelections[p] ?? NO_MAP_VALUE) === NO_MAP_VALUE && suggested[p]
    ).length
  }, [providerSpecialties, marketSpecialties, bulkSelections])

  const BULK_PAGE_SIZES = [25, 50, 75, 100] as const
  const bulkTotalPages = Math.max(1, Math.ceil(providerSpecialties.length / bulkPageSize))
  const bulkPageSafe = Math.min(bulkPage, bulkTotalPages - 1)
  const bulkStart = bulkPageSafe * bulkPageSize
  const bulkEnd = Math.min(bulkStart + bulkPageSize, providerSpecialties.length)
  const providerSpecialtiesPaginated = useMemo(
    () => providerSpecialties.slice(bulkStart, bulkEnd),
    [providerSpecialties, bulkStart, bulkEnd]
  )

  const savedCount = Object.keys(synonymMap).length
  const parentControlsVisibility = onHide != null

  if (!parentControlsVisibility && !mappingsVisible) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="py-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                onClick={() => setMappingsVisible(true)}
                aria-label="Show specialty mapping"
              >
                <Link2 className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              Manage specialty mapping{savedCount > 0 ? ` (${savedCount} saved)` : ''}
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="size-4" />
              Specialty synonym map
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground">
                    <Info className="size-4" />
                  </span>
                </TooltipTrigger>
              <TooltipContent sideOffset={6} className="max-w-[280px]">
                Map provider file specialties to market file specialties in the table below. Use “Suggest by similarity” to pre-fill, then “Add all mappings” to save. Choosing “Don’t map” removes that mapping.
              </TooltipContent>
              </Tooltip>
            </CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => (onHide ? onHide() : setMappingsVisible(false))}
                aria-label="Hide specialty mapping"
              >
                <ChevronUpIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              Hide mapping
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(!hasProviderOptions || !hasMarketOptions) && (
          <p className="text-muted-foreground text-xs">
            Upload provider and market files on the Upload screen to select specialties from your data.
          </p>
        )}
        {hasProviderOptions && hasMarketOptions && providerSpecialties.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestBySimilarity}
                    disabled={disabled || providerSpecialties.length === 0 || marketSpecialties.length === 0}
                    className="gap-1.5"
                  >
                    <Sparkles className="size-4" />
                    Suggest by similarity
                    {suggestCount > 0 && (
                      <span className="text-muted-foreground font-normal">
                        ({suggestCount} unmapped)
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Fills only unmapped rows using name proximity (exact, contains, token overlap, edit distance).
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="bulk-rows" className="text-xs text-muted-foreground whitespace-nowrap">
                  Rows per page
                </Label>
                <Select
                  value={String(bulkPageSize)}
                  onValueChange={(v) => {
                    setBulkPageSize(Number(v))
                    setBulkPage(0)
                  }}
                >
                  <SelectTrigger id="bulk-rows" className="h-8 w-[72px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BULK_PAGE_SIZES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground text-xs">
                Showing {providerSpecialties.length === 0 ? 0 : bulkStart + 1}–{bulkEnd} of {providerSpecialties.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={bulkPageSafe <= 0}
                  onClick={() => setBulkPage((p) => Math.max(0, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={bulkPageSafe >= bulkTotalPages - 1}
                  onClick={() => setBulkPage((p) => Math.min(bulkTotalPages - 1, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="max-h-[min(70vh,800px)] overflow-auto rounded-md border border-border">
              <table className="w-full caption-bottom text-sm border-collapse">
                <thead className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium">Provider specialty</th>
                    <th className="text-left px-3 py-2.5 font-medium min-w-[320px]">→ Market specialty</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {providerSpecialtiesPaginated.map((prov, idx) => {
                    const value = bulkSelections[prov] ?? NO_MAP_VALUE
                    const displayLabel = value === NO_MAP_VALUE ? "— Don't map" : value
                    return (
                      <tr key={prov} className={cn(idx % 2 === 1 && 'bg-muted/30', 'border-b border-border transition-colors hover:bg-muted/50')}>
                        <td className="px-3 py-2.5 font-medium">{prov}</td>
                        <td className="px-3 py-2.5 min-w-[320px]">
                          <DropdownMenu
                            open={openBulkKey === prov}
                            onOpenChange={(open) => setOpenBulkKey(open ? prov : null)}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={openBulkKey === prov}
                                disabled={disabled}
                                className="min-h-8 min-w-[320px] max-w-[420px] w-full justify-between font-normal"
                              >
                                <span className="truncate">{displayLabel}</span>
                                <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[320px] max-w-[420px] p-0"
                              align="start"
                              onCloseAutoFocus={(e) => e.preventDefault()}
                              {...({
                                onOpenAutoFocus(e: Event) {
                                  e.preventDefault()
                                  const input = (e.currentTarget as HTMLElement).querySelector('input')
                                  if (input) requestAnimationFrame(() => input.focus())
                                },
                              } as { onOpenAutoFocus?: (e: Event) => void })}
                            >
                              <Command
                                shouldFilter={true}
                                filter={(q, search) => {
                                  if (!search.trim()) return 1
                                  return q.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                                }}
                              >
                                <CommandInput placeholder="Search market specialty…" className="h-9" />
                                <CommandList>
                                  <CommandEmpty>No match.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="— Don't map"
                                      onSelect={() => {
                                        setBulkSelections((s) => ({ ...s, [prov]: NO_MAP_VALUE }))
                                        onRemove(prov)
                                        setOpenBulkKey(null)
                                      }}
                                    >
                                      <span
                                        className={cn(
                                          'mr-2 flex size-4 items-center justify-center',
                                          value === NO_MAP_VALUE ? 'opacity-100' : 'opacity-0'
                                        )}
                                      >
                                        <CheckIcon className="size-4" />
                                      </span>
                                      — Don't map
                                    </CommandItem>
                                    {marketSpecialties.map((m) => (
                                      <CommandItem
                                        key={m}
                                        value={m}
                                        onSelect={() => {
                                          setBulkSelections((s) => ({ ...s, [prov]: m }))
                                          setOpenBulkKey(null)
                                        }}
                                      >
                                        <span
                                          className={cn(
                                            'mr-2 flex size-4 items-center justify-center',
                                            value === m ? 'opacity-100' : 'opacity-0'
                                          )}
                                        >
                                          <CheckIcon className="size-4" />
                                        </span>
                                        {m}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                for (const [prov, market] of Object.entries(bulkSelections)) {
                  if (market && market !== NO_MAP_VALUE && market.trim() !== '') {
                    onAdd(prov, market)
                  }
                }
              }}
              disabled={disabled || bulkAddCount === 0}
            >
              <Plus className="size-4 mr-1" />
              Add all {bulkAddCount > 0 ? `(${bulkAddCount})` : ''} mappings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
