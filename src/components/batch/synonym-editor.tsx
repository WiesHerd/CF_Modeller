import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, BookMarked } from 'lucide-react'
import type { SynonymMap } from '@/types/batch'

const OTHER_VALUE = '__other__'

interface SynonymEditorProps {
  synonymMap: SynonymMap
  onAdd: (key: string, value: string) => void
  onRemove: (key: string) => void
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
  providerSpecialties = [],
  marketSpecialties = [],
  disabled = false,
}: SynonymEditorProps) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [providerSelectValue, setProviderSelectValue] = useState<string>('')
  const [marketSelectValue, setMarketSelectValue] = useState<string>('')

  const entries = Object.entries(synonymMap)
  const hasProviderOptions = providerSpecialties.length > 0
  const hasMarketOptions = marketSpecialties.length > 0

  const effectiveKey =
    hasProviderOptions && providerSelectValue && providerSelectValue !== OTHER_VALUE
      ? providerSelectValue
      : newKey.trim()
  const effectiveValue =
    hasMarketOptions && marketSelectValue && marketSelectValue !== OTHER_VALUE
      ? marketSelectValue
      : newValue.trim()

  const handleAdd = () => {
    const k = effectiveKey
    const v = effectiveValue
    if (k && v) {
      onAdd(k, v)
      setNewKey('')
      setNewValue('')
      setProviderSelectValue('')
      setMarketSelectValue('')
    }
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookMarked className="size-4" />
          Specialty synonym map
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          Map provider file specialty values to market file specialty names when they don’t match exactly. Select from your uploaded data or type a custom value.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[200px]">
            <Label className="text-xs">Provider specialty (from file)</Label>
            {hasProviderOptions ? (
              <>
                <Select
                  value={providerSelectValue || undefined}
                  onValueChange={(v) => {
                    setProviderSelectValue(v ?? '')
                    if (v !== OTHER_VALUE) setNewKey('')
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="min-h-9 w-full">
                    <SelectValue placeholder="Select or type below…" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerSpecialties.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_VALUE}>Other (type below)</SelectItem>
                  </SelectContent>
                </Select>
                {providerSelectValue === OTHER_VALUE && (
                  <Input
                    placeholder="e.g. Cardiology"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    disabled={disabled}
                    className="min-h-9 mt-1"
                  />
                )}
              </>
            ) : (
              <Input
                placeholder="e.g. Cardiology"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                disabled={disabled}
                className="min-h-9 w-full"
              />
            )}
          </div>
          <div className="space-y-1.5 min-w-[200px]">
            <Label className="text-xs">Market specialty (exact name in market file)</Label>
            {hasMarketOptions ? (
              <>
                <Select
                  value={marketSelectValue || undefined}
                  onValueChange={(v) => {
                    setMarketSelectValue(v ?? '')
                    if (v !== OTHER_VALUE) setNewValue('')
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="min-h-9 w-full">
                    <SelectValue placeholder="Select or type below…" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketSpecialties.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_VALUE}>Other (type below)</SelectItem>
                  </SelectContent>
                </Select>
                {marketSelectValue === OTHER_VALUE && (
                  <Input
                    placeholder="e.g. Cardiovascular"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    disabled={disabled}
                    className="min-h-9 mt-1"
                  />
                )}
              </>
            ) : (
              <Input
                placeholder="e.g. Cardiovascular"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                disabled={disabled}
                className="min-h-9 w-full"
              />
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={disabled || !effectiveKey || !effectiveValue}
            className="shrink-0"
          >
            <Plus className="size-4 mr-1" />
            Add
          </Button>
        </div>
        {(!hasProviderOptions || !hasMarketOptions) && (
          <p className="text-muted-foreground text-xs">
            Upload provider and market files on the Upload step to select specialties from your data.
          </p>
        )}
        {entries.length > 0 ? (
          <ul className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
            {entries.map(([key, value]) => (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm"
              >
                <span className="font-medium">{key}</span>
                <span className="text-muted-foreground">→</span>
                <span>{value}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => onRemove(key)}
                  disabled={disabled}
                  aria-label={`Remove synonym ${key}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No synonyms. Add one if provider and market specialty names differ.</p>
        )}
      </CardContent>
    </Card>
  )
}
