import { useState, useMemo } from 'react'
import { Users, Building2 } from 'lucide-react'
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

interface ProviderDivisionSelectProps {
  providerRows: ProviderRow[]
  selectedSpecialty: string | null
  selectedProviderId: string | null
  selectedDivision: string | null
  onSelectProvider: (id: string | null) => void
  onSelectDivision: (division: string | null) => void
}

export function ProviderDivisionSelect({
  providerRows,
  selectedSpecialty,
  selectedProviderId,
  selectedDivision,
  onSelectProvider,
  onSelectDivision,
}: ProviderDivisionSelectProps) {
  const [providerOpen, setProviderOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredBySpecialty = useMemo(() => {
    if (!selectedSpecialty) return providerRows
    return providerRows.filter(
      (p) => (p.specialty ?? '').toLowerCase() === selectedSpecialty.toLowerCase()
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

  const divisions = useMemo(
    () =>
      Array.from(
        new Set(
          filteredBySpecialty.map((r) => r.division).filter((d): d is string => !!d)
        )
      ).sort(),
    [filteredBySpecialty]
  )

  const selectedProvider = providerRows.find((p) => p.providerId === selectedProviderId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-left">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
            <Users className="size-5" />
          </span>
          <span>Select provider or division</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Users className="size-3.5" />
            Single provider
          </Label>
          <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="min-h-[44px] w-full max-w-md justify-between touch-manipulation" disabled={filteredBySpecialty.length === 0}>
                <span className="truncate">
                  {selectedProvider
                    ? `${selectedProvider.providerName ?? selectedProvider.providerId} (${selectedProvider.specialty ?? '—'})`
                    : 'Search provider…'}
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
                          onSelectDivision(null)
                          setProviderOpen(false)
                        }}
                      >
                        <span className="truncate">
                          {p.providerName ?? p.providerId ?? '—'} ({p.specialty ?? '—'})
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Building2 className="size-3.5" />
            Division (table view)
          </Label>
          <Select
            value={selectedDivision ?? ''}
            onValueChange={(v) => {
              onSelectDivision(v || null)
              onSelectProvider(null)
            }}
            disabled={divisions.length === 0}
          >
            <SelectTrigger className="min-h-[44px] w-full max-w-xs touch-manipulation">
              <SelectValue placeholder="Choose division…" />
            </SelectTrigger>
            <SelectContent>
              {divisions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
