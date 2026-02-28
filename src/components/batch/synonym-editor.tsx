import { useState, useMemo, useEffect, useRef } from 'react'
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
import { BookMarked, CheckIcon, ChevronDownIcon, ChevronUpIcon, Sparkles, ChevronLeft, ChevronRight, Info, Link2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
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
  /** When set, enables "Show unmapped only" filter and highlights unmapped rows. */
  unmappedSpecialties?: string[]
  disabled?: boolean
}

export function SynonymEditor({
  synonymMap,
  onAdd,
  onRemove,
  onHide,
  providerSpecialties = [],
  marketSpecialties = [],
  unmappedSpecialties = [],
  disabled = false,
}: SynonymEditorProps) {
  /** Bulk: provider specialty -> selected market specialty (or '' / NO_MAP_VALUE) */
  const [bulkSelections, setBulkSelections] = useState<Record<string, string>>({})
  /** Which bulk row's market dropdown is open (provider specialty key). */
  const [openBulkKey, setOpenBulkKey] = useState<string | null>(null)
  const [bulkPage, setBulkPage] = useState(0)
  const [bulkPageSize, setBulkPageSize] = useState(25)
  const [mappingsVisible, setMappingsVisible] = useState(false)
  /** When true, table shows only provider specialties that are unmapped (no market match). */
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false)
  /** Search filter for table rows (provider or market specialty text). */
  const [searchQuery, setSearchQuery] = useState('')
  /** Brief success message after Save selections or Suggest & save; cleared after a few seconds. */
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const saveMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmappedSet = useMemo(() => new Set(unmappedSpecialties), [unmappedSpecialties])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- providerListKey/marketListKey/synonymMapKey encode the relevant deps to avoid unnecessary resyncs
  }, [providerListKey, marketListKey, synonymMapKey])

  useEffect(() => {
    return () => {
      if (saveMessageTimeoutRef.current) clearTimeout(saveMessageTimeoutRef.current)
    }
  }, [])

  const bulkAddCount = useMemo(() => {
    return Object.entries(bulkSelections).filter(
      ([, market]) => market && market !== NO_MAP_VALUE && market.trim() !== ''
    ).length
  }, [bulkSelections])

  /** True if any saved mapping is set to Don't map in the table (so Save would remove it). */
  const hasRemovalsToSync = useMemo(
    () =>
      Object.keys(synonymMap).some(
        (p) =>
          bulkSelections[p] === NO_MAP_VALUE ||
          bulkSelections[p] === '' ||
          !bulkSelections[p]?.trim()
      ),
    [synonymMap, bulkSelections]
  )
  const saveSelectionsDisabled = disabled || (bulkAddCount === 0 && !hasRemovalsToSync)

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

  /** Run suggestions and save them in one step. Saves whatever the algorithm suggests for unmapped providers. */
  const handleSuggestAndSaveMappings = () => {
    const suggested = suggestSpecialtyMappings(providerSpecialties, marketSpecialties)
    let saved = 0
    setBulkSelections((prev) => {
      const next = { ...prev }
      for (const [prov, market] of Object.entries(suggested)) {
        if (prov && market) {
          next[prov] = market
          saved++
        }
      }
      return next
    })
    for (const [prov, market] of Object.entries(suggested)) {
      if (prov && market) onAdd(prov, market)
    }
    if (saveMessageTimeoutRef.current) clearTimeout(saveMessageTimeoutRef.current)
    setSaveMessage(saved > 0 ? `Saved ${saved} mapping(s).` : null)
    if (saved > 0) {
      saveMessageTimeoutRef.current = setTimeout(() => {
        setSaveMessage(null)
        saveMessageTimeoutRef.current = null
      }, 3000)
    }
  }

  /** Sync table to saved map: add/update selected rows, remove rows set to "Don't map". */
  const handleSaveSelections = () => {
    let added = 0
    let removed = 0
    for (const [prov, market] of Object.entries(bulkSelections)) {
      const isNoMap = !market || market === NO_MAP_VALUE || market.trim() === ''
      if (isNoMap) {
        onRemove(prov)
        removed++
      } else {
        onAdd(prov, market)
        added++
      }
    }
    if (saveMessageTimeoutRef.current) clearTimeout(saveMessageTimeoutRef.current)
    const parts: string[] = []
    if (added > 0) parts.push(`Saved ${added} mapping(s)`)
    if (removed > 0) parts.push(`removed ${removed}`)
    setSaveMessage(parts.length > 0 ? parts.join('. ') + '.' : null)
    if (parts.length > 0) {
      saveMessageTimeoutRef.current = setTimeout(() => {
        setSaveMessage(null)
        saveMessageTimeoutRef.current = null
      }, 3000)
    }
  }

  const filteredProviderSpecialties = useMemo(
    () =>
      showUnmappedOnly && unmappedSet.size > 0
        ? providerSpecialties.filter((p) => unmappedSet.has(p))
        : providerSpecialties,
    [providerSpecialties, showUnmappedOnly, unmappedSet]
  )

  const searchLower = searchQuery.trim().toLowerCase()
  const filteredBySearch = useMemo(() => {
    if (!searchLower) return filteredProviderSpecialties
    return filteredProviderSpecialties.filter((prov) => {
      const provMatch = prov.toLowerCase().includes(searchLower)
      const market = bulkSelections[prov]
      const marketMatch =
        market && market !== NO_MAP_VALUE && market.toLowerCase().includes(searchLower)
      return provMatch || marketMatch
    })
  }, [filteredProviderSpecialties, searchLower, bulkSelections])

  const BULK_PAGE_SIZES = [25, 50, 75, 100] as const
  const bulkTotalPages = Math.max(1, Math.ceil(filteredBySearch.length / bulkPageSize))
  const bulkPageSafe = Math.min(bulkPage, bulkTotalPages - 1)
  const bulkStart = bulkPageSafe * bulkPageSize
  const bulkEnd = Math.min(bulkStart + bulkPageSize, filteredBySearch.length)
  const providerSpecialtiesPaginated = useMemo(
    () => filteredBySearch.slice(bulkStart, bulkEnd),
    [filteredBySearch, bulkStart, bulkEnd]
  )

  const savedCount = Object.keys(synonymMap).length
  const parentControlsVisibility = onHide != null

  if (!parentControlsVisibility && !mappingsVisible) {
    return (
      <Card className="rounded-2xl border-border/80 bg-card shadow-sm">
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
    <Card className="rounded-2xl border-border/80 bg-card shadow-sm overflow-hidden">
      <CardHeader className="space-y-2 bg-muted/30 rounded-t-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BookMarked className="size-4 text-muted-foreground" />
              Specialty synonym map{savedCount > 0 ? ` (${savedCount} saved)` : ''}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground">
                    <Info className="size-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent sideOffset={6} className="max-w-[280px]">
                  Map provider file specialties to market file specialties in the table below. Use &quot;Pre-fill for review&quot; to suggest mappings so you can edit, then &quot;Save selections&quot; to save. Or use &quot;Suggest &amp; save&quot; to save suggestions in one step (unmapped only).
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-4 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search specialties…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setBulkPage(0)
                  }}
                  className="h-8 w-[260px] pl-8 pr-2 text-sm"
                  aria-label="Search provider or market specialty"
                />
              </div>
              {unmappedSpecialties.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setShowUnmappedOnly((v) => !v)
                    setBulkPage(0)
                  }}
                >
                  {showUnmappedOnly
                    ? `Show unmapped only (${unmappedSpecialties.length})`
                    : `Show all (${filteredProviderSpecialties.length})`}
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestBySimilarity}
                    disabled={disabled || providerSpecialties.length === 0 || marketSpecialties.length === 0}
                  >
                    Pre-fill for review
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6} className="max-w-[260px]">
                  Pre-fill dropdowns with suggestions so you can review or edit in the table, then use &quot;Save selections&quot; to save.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSuggestAndSaveMappings}
                    disabled={disabled || providerSpecialties.length === 0 || marketSpecialties.length === 0 || unmappedSpecialties.length === 0}
                    className="gap-1.5"
                  >
                    <Sparkles className="size-4" />
                    Suggest & save
                    {unmappedSpecialties.length > 0 && (
                      <span className="opacity-90 font-normal">
                        ({unmappedSpecialties.length})
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6} className="max-w-[260px]">
                  Finds similar market names for unmapped provider specialties and saves them immediately. Use &quot;Pre-fill for review&quot; if you want to edit before saving.
                </TooltipContent>
              </Tooltip>
              <div className="ml-auto shrink-0 border-l border-border pl-3 flex items-center gap-2">
                {saveMessage && (
                  <span className="text-xs text-muted-foreground animate-in fade-in" role="status">
                    {saveMessage}
                  </span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant={bulkAddCount > 0 && !disabled ? 'default' : 'secondary'}
                      onClick={handleSaveSelections}
                      disabled={saveSelectionsDisabled}
                    >
                      Save selections{bulkAddCount > 0 ? ` (${bulkAddCount})` : ''}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6} className="max-w-[280px]">
                    {bulkAddCount > 0 && !disabled
                      ? 'Saves the current table: selected mappings are saved; rows set to "Don\'t map" are removed from the saved map. Used by batch runs and reports.'
                      : 'Select a market specialty in the dropdown for each row you want to save. Rows set to "Don\'t map" are removed from the saved map when you save.'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="max-h-[min(70vh,800px)] overflow-auto rounded-md border border-border">
              <table className="w-full caption-bottom text-sm border-collapse">
                <thead className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium whitespace-normal break-words">Provider specialty</th>
                    <th className="text-left px-3 py-2.5 font-medium min-w-[320px] whitespace-normal break-words">→ Market specialty</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {providerSpecialtiesPaginated.map((prov, idx) => {
                    const value = bulkSelections[prov] ?? NO_MAP_VALUE
                    const displayLabel = value === NO_MAP_VALUE ? "— Don't map" : value
                    const isUnmapped = unmappedSet.has(prov)
                    return (
                      <tr
                        key={prov}
                        className={cn(
                          idx % 2 === 1 && 'bg-muted/30',
                          'border-b border-border transition-colors hover:bg-muted/50',
                          isUnmapped && 'border-l-4 border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/20 dark:border-l-amber-500'
                        )}
                      >
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
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Showing {filteredBySearch.length === 0 ? 0 : bulkStart + 1}–{bulkEnd} of {filteredBySearch.length} row{filteredBySearch.length !== 1 ? 's' : ''}
                {showUnmappedOnly && unmappedSet.size > 0 && ' (unmapped only)'}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="bulk-rows" className="text-xs whitespace-nowrap text-muted-foreground">
                    Rows
                  </Label>
                  <Select
                    value={String(bulkPageSize)}
                    onValueChange={(v) => {
                      setBulkPageSize(Number(v))
                      setBulkPage(0)
                    }}
                  >
                    <SelectTrigger id="bulk-rows" className="h-8 w-[75px]">
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
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={bulkPageSafe <= 0}
                    onClick={() => setBulkPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>
                  <span className="px-2 text-xs text-muted-foreground tabular-nums">
                    Page {bulkPageSafe + 1} of {bulkTotalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={bulkPageSafe >= bulkTotalPages - 1}
                    onClick={() => setBulkPage((p) => Math.min(bulkTotalPages - 1, p + 1))}
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
