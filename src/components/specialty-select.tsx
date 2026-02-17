import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Target } from 'lucide-react'
import type { MarketRow } from '@/types/market'

interface SpecialtySelectProps {
  marketRows: MarketRow[]
  selectedSpecialty: string | null
  onSelect: (specialty: string | null) => void
}

export function SpecialtySelect({
  marketRows,
  selectedSpecialty,
  onSelect,
}: SpecialtySelectProps) {
  const specialties = Array.from(
    new Set(marketRows.map((r) => r.specialty).filter(Boolean))
  ).sort()

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-left">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
            <Target className="size-5" />
          </span>
          <span>Select Survey Data. Market (optional override)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Label className="text-muted-foreground mb-2 block text-xs">
          Choose a market from your survey report. Override the provider’s specialty to model a different market (e.g. a provider not in the upload).
        </Label>
        <Select
          value={selectedSpecialty ?? ''}
          onValueChange={(v) => onSelect(!v || v === '__clear__' ? null : v)}
          disabled={specialties.length === 0}
        >
          <SelectTrigger className="min-h-[44px] w-full max-w-xs touch-manipulation">
            <SelectValue placeholder="Choose market from survey…" />
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
      </CardContent>
    </Card>
  )
}
