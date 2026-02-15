'use client'

import { useEffect, useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MarketRow } from '@/types/market'

const PERCENTILES = [25, 50, 75, 90] as const

export interface MarketEditFormState {
  specialty: string
  providerType: string
  region: string
  TCC_25: string
  TCC_50: string
  TCC_75: string
  TCC_90: string
  WRVU_25: string
  WRVU_50: string
  WRVU_75: string
  WRVU_90: string
  CF_25: string
  CF_50: string
  CF_75: string
  CF_90: string
}

const emptyForm: MarketEditFormState = {
  specialty: '',
  providerType: '',
  region: '',
  TCC_25: '',
  TCC_50: '',
  TCC_75: '',
  TCC_90: '',
  WRVU_25: '',
  WRVU_50: '',
  WRVU_75: '',
  WRVU_90: '',
  CF_25: '',
  CF_50: '',
  CF_75: '',
  CF_90: '',
}

function toStr(v: number | string | undefined): string {
  return v != null && v !== '' ? String(v) : ''
}

function parseNum(s: string): number | undefined {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : undefined
}

export interface MarketEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'edit' | 'add'
  initialRow: MarketRow | null
  onSaveEdit: (existingRow: MarketRow, updates: Partial<MarketRow>) => void
  onSaveAdd: (row: MarketRow) => void
}

export function MarketEditModal({
  open,
  onOpenChange,
  mode,
  initialRow,
  onSaveEdit,
  onSaveAdd,
}: MarketEditModalProps) {
  const [form, setForm] = useState<MarketEditFormState>(emptyForm)

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialRow) {
        setForm({
          specialty: toStr(initialRow.specialty),
          providerType: toStr(initialRow.providerType),
          region: toStr(initialRow.region),
          TCC_25: toStr(initialRow.TCC_25),
          TCC_50: toStr(initialRow.TCC_50),
          TCC_75: toStr(initialRow.TCC_75),
          TCC_90: toStr(initialRow.TCC_90),
          WRVU_25: toStr(initialRow.WRVU_25),
          WRVU_50: toStr(initialRow.WRVU_50),
          WRVU_75: toStr(initialRow.WRVU_75),
          WRVU_90: toStr(initialRow.WRVU_90),
          CF_25: toStr(initialRow.CF_25),
          CF_50: toStr(initialRow.CF_50),
          CF_75: toStr(initialRow.CF_75),
          CF_90: toStr(initialRow.CF_90),
        })
      } else {
        setForm(emptyForm)
      }
    }
  }, [open, mode, initialRow])

  const buildRowFromForm = useCallback((): MarketRow | null => {
    const specialty = form.specialty.trim()
    if (specialty === '') return null
    const nums: Record<string, number> = {}
    for (const p of PERCENTILES) {
      const tcc = parseNum(form[`TCC_${p}` as keyof MarketEditFormState])
      const wrvu = parseNum(form[`WRVU_${p}` as keyof MarketEditFormState])
      const cf = parseNum(form[`CF_${p}` as keyof MarketEditFormState])
      if (tcc === undefined || wrvu === undefined || cf === undefined) return null
      nums[`TCC_${p}`] = tcc
      nums[`WRVU_${p}`] = wrvu
      nums[`CF_${p}`] = cf
    }
    return {
      specialty,
      providerType: form.providerType.trim() || undefined,
      region: form.region.trim() || undefined,
      TCC_25: nums.TCC_25,
      TCC_50: nums.TCC_50,
      TCC_75: nums.TCC_75,
      TCC_90: nums.TCC_90,
      WRVU_25: nums.WRVU_25,
      WRVU_50: nums.WRVU_50,
      WRVU_75: nums.WRVU_75,
      WRVU_90: nums.WRVU_90,
      CF_25: nums.CF_25,
      CF_50: nums.CF_50,
      CF_75: nums.CF_75,
      CF_90: nums.CF_90,
    }
  }, [form])

  const isValid = useCallback((): boolean => {
    if (form.specialty.trim() === '') return false
    for (const p of PERCENTILES) {
      const tcc = parseNum(form[`TCC_${p}` as keyof MarketEditFormState])
      const wrvu = parseNum(form[`WRVU_${p}` as keyof MarketEditFormState])
      const cf = parseNum(form[`CF_${p}` as keyof MarketEditFormState])
      if (tcc === undefined || wrvu === undefined || cf === undefined) return false
    }
    return true
  }, [form])

  const handleSubmit = useCallback(() => {
    if (mode === 'edit' && initialRow) {
      const row = buildRowFromForm()
      if (!row) return
      const updates: Partial<MarketRow> = {
        specialty: row.specialty,
        providerType: row.providerType,
        region: row.region,
        TCC_25: row.TCC_25,
        TCC_50: row.TCC_50,
        TCC_75: row.TCC_75,
        TCC_90: row.TCC_90,
        WRVU_25: row.WRVU_25,
        WRVU_50: row.WRVU_50,
        WRVU_75: row.WRVU_75,
        WRVU_90: row.WRVU_90,
        CF_25: row.CF_25,
        CF_50: row.CF_50,
        CF_75: row.CF_75,
        CF_90: row.CF_90,
      }
      onSaveEdit(initialRow, updates)
      onOpenChange(false)
    } else if (mode === 'add') {
      const row = buildRowFromForm()
      if (!row) return
      onSaveAdd(row)
      onOpenChange(false)
    }
  }, [mode, initialRow, buildRowFromForm, onSaveEdit, onSaveAdd, onOpenChange])

  const isEdit = mode === 'edit'
  const canSave = isValid()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-y-auto max-h-[90vh] p-0 sm:max-w-[640px]">
        <div className="border-b border-border/80 bg-muted/30 px-6 py-5 pr-12 shrink-0">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {isEdit ? 'Edit market line' : 'Add market line'}
            </DialogTitle>
            <DialogDescription asChild>
              <p className="text-sm text-muted-foreground">
                {isEdit
                  ? `Update specialty "${initialRow?.specialty ?? ''}". Changes save to the loaded market dataset.`
                  : 'Specialty and all percentile values (TCC, WRVU, CF) are required.'}
              </p>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Identity
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="mkt-edit-specialty">Specialty</Label>
                <Input
                  id="mkt-edit-specialty"
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                  placeholder="Specialty"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mkt-edit-providerType">Provider type</Label>
                <Input
                  id="mkt-edit-providerType"
                  value={form.providerType}
                  onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value }))}
                  placeholder="Optional"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mkt-edit-region">Region</Label>
                <Input
                  id="mkt-edit-region"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="Optional"
                  className="h-10"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              TCC percentiles ($)
            </legend>
            <div className="grid grid-cols-4 gap-3">
              {PERCENTILES.map((p) => (
                <div key={p} className="space-y-2">
                  <Label htmlFor={`mkt-edit-TCC_${p}`}>P{p}</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center border-r border-input bg-muted/50 px-2 text-muted-foreground text-xs">$</span>
                    <Input
                      id={`mkt-edit-TCC_${p}`}
                      type="number"
                      min={0}
                      step={1000}
                      value={form[`TCC_${p}` as keyof MarketEditFormState]}
                      onChange={(e) => setForm((f) => ({ ...f, [`TCC_${p}`]: e.target.value }))}
                      placeholder="0"
                      className="h-10 border-0 bg-transparent py-2 pl-2 pr-3 tabular-nums text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              WRVU percentiles
            </legend>
            <div className="grid grid-cols-4 gap-3">
              {PERCENTILES.map((p) => (
                <div key={p} className="space-y-2">
                  <Label htmlFor={`mkt-edit-WRVU_${p}`}>P{p}</Label>
                  <Input
                    id={`mkt-edit-WRVU_${p}`}
                    type="number"
                    min={0}
                    step={1}
                    value={form[`WRVU_${p}` as keyof MarketEditFormState]}
                    onChange={(e) => setForm((f) => ({ ...f, [`WRVU_${p}`]: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              CF percentiles ($)
            </legend>
            <div className="grid grid-cols-4 gap-3">
              {PERCENTILES.map((p) => (
                <div key={p} className="space-y-2">
                  <Label htmlFor={`mkt-edit-CF_${p}`}>P{p}</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center border-r border-input bg-muted/50 px-2 text-muted-foreground text-xs">$</span>
                    <Input
                      id={`mkt-edit-CF_${p}`}
                      type="number"
                      min={0}
                      step={0.01}
                      value={form[`CF_${p}` as keyof MarketEditFormState]}
                      onChange={(e) => setForm((f) => ({ ...f, [`CF_${p}`]: e.target.value }))}
                      placeholder="0"
                      className="h-10 border-0 bg-transparent py-2 pl-2 pr-3 tabular-nums text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border/80 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:min-w-[88px]">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave} className="sm:min-w-[88px]">
            {isEdit ? 'Save changes' : 'Add market line'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
