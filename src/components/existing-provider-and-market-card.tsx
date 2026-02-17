import { useState, useMemo } from 'react'
import { Users, BarChart3, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'

interface ExistingProviderAndMarketCardProps {
  providerRows: ProviderRow[]
  selectedSpecialty: string | null
  selectedProviderId: string | null
  marketRows: MarketRow[]
  onSelectProvider: (id: string | null) => void
  onSelectSpecialty: (specialty: string | null) => void
  /** For productivity model in same row as provider/market. */
  selectedProvider?: ProviderRow | null
  onUpdateProvider?: (updates: Partial<ProviderRow>) => void
  readOnlyProductivityModel?: boolean
  /** Rendered inside the same card below the inputs (e.g. statistics). */
  children?: React.ReactNode
}

export function ExistingProviderAndMarketCard({
  providerRows,
  selectedSpecialty,
  selectedProviderId,
  marketRows,
  onSelectProvider,
  onSelectSpecialty,
  selectedProvider: selectedProviderProp,
  onUpdateProvider,
  readOnlyProductivityModel = false,
  children,
}: ExistingProviderAndMarketCardProps) {
  const [providerOpen, setProviderOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredBySpecialty = useMemo(() => {
    if (!selectedSpecialty) return providerRows
    return providerRows.filter(
      (p) =>
        (p.specialty ?? '').toLowerCase() === selectedSpecialty.toLowerCase()
    )
  }, [providerRows, selectedSpecialty])

  const filteredBySearch = useMemo(() => {
    if (!search.trim()) return filteredBySpecialty
    const q = search.toLowerCase()
    return filteredBySpecialty.filter(
      (p) =>
        (p.providerName ?? '').toLowerCase().includes(q) ||
        (p.providerId ?? '').toLowerCase().includes(q)
    )
  }, [filteredBySpecialty, search])

  const specialties = useMemo(
    () =>
      Array.from(
        new Set(marketRows.map((r) => r.specialty).filter(Boolean))
      ).sort(),
    [marketRows]
  )

  const selectedProvider =
    selectedProviderProp ??
    providerRows.find((p) => p.providerId === selectedProviderId)
  const canEditProductivity =
    !!onUpdateProvider && !readOnlyProductivityModel

  return (
    <Card className="w-full">
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-3 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
            <Users className="size-5" />
          </span>
          <span>Provider & market</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider, Market, Productivity model — strict 3-column grid, even gutters */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          <div className="flex min-h-[4.5rem] flex-col justify-end gap-2">
            <Label className="text-muted-foreground flex h-5 min-h-5 items-center gap-2 text-xs font-medium">
              <Users className="size-3.5 shrink-0" />
              <span>Provider</span>
            </Label>
            <div className="flex min-w-0 gap-2">
              <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-9 min-w-0 flex-1 justify-between touch-manipulation text-sm"
                    disabled={filteredBySpecialty.length === 0}
                  >
                    <span className="truncate">
                      {selectedProvider
                        ? selectedProvider.providerName ?? selectedProvider.providerId ?? '—'
                        : 'Select provider…'}
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-0">
                  <DialogHeader className="p-2">
                    <DialogTitle>Select provider</DialogTitle>
                  </DialogHeader>
                  <Command className="rounded-lg border-0">
                    <CommandInput
                      placeholder="Search by name or ID…"
                      value={search}
                      onValueChange={setSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No provider found.</CommandEmpty>
                      <CommandGroup>
                        {filteredBySearch.map((p) => (
                          <CommandItem
                            key={p.providerId ?? p.providerName ?? Math.random()}
                            value={`${p.providerName ?? ''} ${p.providerId ?? ''}`}
                            onSelect={() => {
                              onSelectProvider(p.providerId ?? null)
                              setProviderOpen(false)
                            }}
                          >
                            <span className="truncate">
                              {p.providerName ?? p.providerId ?? '—'} (
                              {p.specialty ?? '—'})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
              {selectedProviderId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 touch-manipulation"
                  onClick={() => onSelectProvider(null)}
                  title="Clear provider"
                  aria-label="Clear provider"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex min-h-[4.5rem] flex-col justify-end gap-2">
            <Label className="text-muted-foreground flex h-5 min-h-5 items-center gap-2 text-xs font-medium">
              <BarChart3 className="size-3.5 shrink-0" />
              <span>Market</span>
            </Label>
            <div className="flex min-w-0 gap-2">
              <Select
                value={selectedSpecialty ?? ''}
                onValueChange={(v) =>
                  onSelectSpecialty(!v || v === '__clear__' ? null : v)
                }
                disabled={specialties.length === 0}
              >
                <SelectTrigger className="min-h-[44px] w-full touch-manipulation text-sm">
                  <SelectValue placeholder="Choose market…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__">Clear market selection</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSpecialty && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 touch-manipulation"
                  onClick={() => onSelectSpecialty(null)}
                  title="Clear market"
                  aria-label="Clear market"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex min-h-[4.5rem] flex-col justify-end gap-2">
            <Label className="text-muted-foreground flex h-5 min-h-5 items-center gap-2 text-xs font-medium">
              <span className="size-3.5 shrink-0" aria-hidden />
              <span>Productivity model</span>
            </Label>
            {selectedProvider && canEditProductivity ? (
              <Select
                value={selectedProvider.productivityModel ?? 'productivity'}
                onValueChange={(v) =>
                  onUpdateProvider?.({
                    productivityModel: v as 'base' | 'productivity',
                  })
                }
              >
                <SelectTrigger className="min-h-[44px] w-full touch-manipulation text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                </SelectContent>
              </Select>
            ) : selectedProvider ? (
              <div className="text-muted-foreground flex min-h-9 items-center rounded-lg border border-border bg-muted/30 px-3 text-sm capitalize">
                {selectedProvider.productivityModel || '—'}
              </div>
            ) : (
              <div className="text-muted-foreground flex min-h-9 items-center rounded-lg border border-border bg-muted/20 px-3 text-sm">
                —
              </div>
            )}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
