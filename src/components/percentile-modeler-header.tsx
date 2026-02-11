import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'

interface PercentileModelerHeaderProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  selectedSpecialty: string | null
  selectedProviderId: string | null
  onSelectSpecialty: (specialty: string | null) => void
  onSelectProvider: (providerId: string | null) => void
  /** When true, only specialty/market selectors are shown (e.g. new provider mode). */
  providerSelectionOnly?: boolean
}

export function PercentileModelerHeader({
  providerRows,
  marketRows,
  selectedSpecialty,
  selectedProviderId,
  onSelectSpecialty,
  onSelectProvider,
  providerSelectionOnly = false,
}: PercentileModelerHeaderProps) {
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

  // Market options: only markets for the selected specialty (one option per specialty for unique values)
  const marketOptionsForSpecialty = useMemo(() => {
    const filtered =
      !selectedSpecialty
        ? marketRows
        : marketRows.filter(
            (r) =>
              (r.specialty ?? '').toLowerCase() ===
              selectedSpecialty.toLowerCase()
          )
    return filtered.filter(
      (r, i, arr) =>
        arr.findIndex(
          (x) =>
            (x.specialty ?? '').toLowerCase() === (r.specialty ?? '').toLowerCase()
        ) === i
    )
  }, [marketRows, selectedSpecialty])

  const selectedProvider = providerRows.find(
    (p) => p.providerId === selectedProviderId
  )

  return (
    <header className="border-border bg-card rounded-2xl border px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="modeler-page-title mr-2 sm:mr-4">
          Percentile Modeler
        </h1>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          {!providerSelectionOnly && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-xs sm:inline">
                Provider
              </span>
              <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 min-w-0 max-w-[180px] justify-between gap-1"
                    disabled={filteredBySpecialty.length === 0}
                  >
                    <span className="truncate">
                      {selectedProvider
                        ? selectedProvider.providerName ??
                          selectedProvider.providerId ??
                          '—'
                        : 'Provider…'}
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-0">
                  <DialogHeader className="p-2">
                    <DialogTitle>Select provider</DialogTitle>
                  </DialogHeader>
                  <Command className="rounded-lg border-0">
                    <CommandInput
                      placeholder="Search by name…"
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
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => onSelectProvider(null)}
                  title="Clear provider"
                  aria-label="Clear provider"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Market
            </span>
            <Select
              value={selectedSpecialty ?? ''}
              onValueChange={(v) => {
                const next = v || null
                onSelectSpecialty(next)
                if (next !== selectedSpecialty && !providerSelectionOnly)
                  onSelectProvider(null)
              }}
              disabled={marketOptionsForSpecialty.length === 0}
            >
              <SelectTrigger className="h-9 min-w-[120px] flex-1 sm:min-w-[140px] sm:max-w-[200px]">
                <SelectValue placeholder="Market…" />
              </SelectTrigger>
              <SelectContent>
                {marketOptionsForSpecialty.map((r) => {
                  const label =
                    r.region || r.providerType
                      ? `${r.specialty}${r.region ? ` - ${r.region}` : ''}${r.providerType ? ` (${r.providerType})` : ''}`.trim()
                      : r.specialty
                  return (
                    <SelectItem key={r.specialty} value={r.specialty}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </header>
  )
}
