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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProviderRow } from '@/types/provider'

export interface ProviderEditFormState {
  providerName: string
  specialty: string
  division: string
  providerType: string
  totalFTE: string
  clinicalFTE: string
  adminFTE: string
  researchFTE: string
  teachingFTE: string
  baseSalary: string
  workRVUs: string
  outsideWRVUs: string
  currentCF: string
  nonClinicalPay: string
  qualityPayments: string
  otherIncentives: string
  productivityModel: string
}

const emptyForm: ProviderEditFormState = {
  providerName: '',
  specialty: '',
  division: '',
  providerType: '',
  totalFTE: '',
  clinicalFTE: '',
  adminFTE: '',
  researchFTE: '',
  teachingFTE: '',
  baseSalary: '',
  workRVUs: '',
  outsideWRVUs: '',
  currentCF: '',
  nonClinicalPay: '',
  qualityPayments: '',
  otherIncentives: '',
  productivityModel: '',
}

function toStr(v: number | string | undefined): string {
  return v != null && v !== '' ? String(v) : ''
}

function parseNum(s: string): number | undefined {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : undefined
}

export interface ProviderEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'edit' | 'add'
  initialRow: ProviderRow | null
  onSaveEdit: (providerId: string, updates: Partial<ProviderRow>) => void
  onSaveAdd: (row: ProviderRow) => void
}

export function ProviderEditModal({
  open,
  onOpenChange,
  mode,
  initialRow,
  onSaveEdit,
  onSaveAdd,
}: ProviderEditModalProps) {
  const [form, setForm] = useState<ProviderEditFormState>(emptyForm)

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialRow) {
        setForm({
          providerName: toStr(initialRow.providerName),
          specialty: toStr(initialRow.specialty),
          division: toStr(initialRow.division),
          providerType: toStr(initialRow.providerType),
          totalFTE: toStr(initialRow.totalFTE),
          clinicalFTE: toStr(initialRow.clinicalFTE),
          adminFTE: toStr(initialRow.adminFTE),
          researchFTE: toStr(initialRow.researchFTE),
          teachingFTE: toStr(initialRow.teachingFTE),
          baseSalary: toStr(initialRow.baseSalary),
          workRVUs: toStr(initialRow.workRVUs ?? initialRow.pchWRVUs),
          outsideWRVUs: toStr(initialRow.outsideWRVUs),
          currentCF: toStr(initialRow.currentCF),
          nonClinicalPay: toStr(initialRow.nonClinicalPay),
          qualityPayments: toStr(initialRow.qualityPayments ?? initialRow.currentTCC),
          otherIncentives: toStr(initialRow.otherIncentives),
          productivityModel: toStr(initialRow.productivityModel),
        })
      } else {
        setForm(emptyForm)
      }
    }
  }, [open, mode, initialRow])

  const buildUpdatesFromForm = useCallback(
    (): Partial<ProviderRow> => {
      const updates: Partial<ProviderRow> = {}
      if (form.providerName.trim() !== '') updates.providerName = form.providerName.trim()
      if (form.specialty.trim() !== '') updates.specialty = form.specialty.trim()
      if (form.division.trim() !== '') updates.division = form.division.trim()
      if (form.providerType.trim() !== '') updates.providerType = form.providerType.trim()
      const totalFTE = parseNum(form.totalFTE)
      if (totalFTE !== undefined) updates.totalFTE = totalFTE
      const clinicalFTE = parseNum(form.clinicalFTE)
      if (clinicalFTE !== undefined) updates.clinicalFTE = clinicalFTE
      const adminFTE = parseNum(form.adminFTE)
      if (adminFTE !== undefined) updates.adminFTE = adminFTE
      const researchFTE = parseNum(form.researchFTE)
      if (researchFTE !== undefined) updates.researchFTE = researchFTE
      const teachingFTE = parseNum(form.teachingFTE)
      if (teachingFTE !== undefined) updates.teachingFTE = teachingFTE
      const baseSalary = parseNum(form.baseSalary)
      if (baseSalary !== undefined) updates.baseSalary = baseSalary
      const workRVUs = parseNum(form.workRVUs)
      if (workRVUs !== undefined) updates.workRVUs = workRVUs
      const outsideWRVUs = parseNum(form.outsideWRVUs)
      if (outsideWRVUs !== undefined) updates.outsideWRVUs = outsideWRVUs
      const currentCF = parseNum(form.currentCF)
      if (currentCF !== undefined) updates.currentCF = currentCF
      const nonClinicalPay = parseNum(form.nonClinicalPay)
      if (nonClinicalPay !== undefined) updates.nonClinicalPay = nonClinicalPay
      const qualityPayments = parseNum(form.qualityPayments)
      if (qualityPayments !== undefined) updates.qualityPayments = qualityPayments
      const otherIncentives = parseNum(form.otherIncentives)
      if (otherIncentives !== undefined) updates.otherIncentives = otherIncentives
      if (form.productivityModel.trim() !== '') updates.productivityModel = form.productivityModel.trim()
      return updates
    },
    [form]
  )

  const isValidForAdd = form.providerName.trim() !== '' && parseNum(form.baseSalary) !== undefined && (parseNum(form.baseSalary) ?? 0) >= 0

  const handleSubmit = useCallback(() => {
    if (mode === 'edit' && initialRow) {
      const providerId = initialRow.providerId ?? initialRow.providerName ?? ''
      const updates = buildUpdatesFromForm()
      onSaveEdit(providerId, updates)
      onOpenChange(false)
    } else if (mode === 'add') {
      const updates = buildUpdatesFromForm()
      const baseSalary = parseNum(form.baseSalary)
      if (form.providerName.trim() === '' || baseSalary === undefined) return
      const row: ProviderRow = {
        providerName: form.providerName.trim(),
        baseSalary,
        ...updates,
      }
      onSaveAdd(row)
      onOpenChange(false)
    }
  }, [mode, initialRow, form.providerName, form.baseSalary, buildUpdatesFromForm, onSaveEdit, onSaveAdd, onOpenChange])

  const isEdit = mode === 'edit'
  const canSave = isEdit || isValidForAdd

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-y-auto max-h-[90vh] p-0 sm:max-w-[720px]">
        <div className="border-b border-border/80 bg-muted/30 px-6 py-5 pr-12 shrink-0">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {isEdit ? 'Edit provider' : 'Add provider'}
            </DialogTitle>
            <DialogDescription asChild>
              <p className="text-sm text-muted-foreground">
                {isEdit
                  ? `${initialRow?.providerName ?? 'Unknown'}. Changes save to the loaded dataset and appear in the Modeller.`
                  : 'New providers appear in the Data table and Modeller. Name and base salary are required.'}
              </p>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Identity
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prov-edit-name">Provider name</Label>
                <Input
                  id="prov-edit-name"
                  value={form.providerName}
                  onChange={(e) => setForm((f) => ({ ...f, providerName: e.target.value }))}
                  placeholder="Name"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-edit-specialty">Specialty</Label>
                <Input
                  id="prov-edit-specialty"
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                  placeholder="Specialty"
                  className="h-10"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prov-edit-division">Division</Label>
                <Input
                  id="prov-edit-division"
                  value={form.division}
                  onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))}
                  placeholder="Division"
                  className="h-10"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prov-edit-type">Provider type / Role</Label>
                <Input
                  id="prov-edit-type"
                  value={form.providerType}
                  onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value }))}
                  placeholder="e.g. Clinical, Division Chief"
                  className="h-10"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              FTE
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {(['totalFTE', 'clinicalFTE', 'adminFTE', 'researchFTE', 'teachingFTE'] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`prov-edit-${key}`}>
                    {key === 'totalFTE' ? 'Total FTE' : key === 'clinicalFTE' ? 'Clinical FTE' : key === 'adminFTE' ? 'Admin FTE' : key === 'researchFTE' ? 'Research FTE' : 'Teaching FTE'}
                  </Label>
                  <Input
                    id={`prov-edit-${key}`}
                    type="number"
                    min={0}
                    max={2}
                    step={0.01}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Compensation & wRVUs
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prov-edit-baseSalary">Base salary</Label>
                <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                  <Input
                    id="prov-edit-baseSalary"
                    type="number"
                    min={0}
                    step={100}
                    value={form.baseSalary}
                    onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))}
                    placeholder="0"
                    className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-edit-nonClinicalPay">Non-clinical pay</Label>
                <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                  <Input
                    id="prov-edit-nonClinicalPay"
                    type="number"
                    min={0}
                    step={100}
                    value={form.nonClinicalPay}
                    onChange={(e) => setForm((f) => ({ ...f, nonClinicalPay: e.target.value }))}
                    placeholder="0"
                    className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-edit-qualityPayments">Quality payments</Label>
                <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                  <Input
                    id="prov-edit-qualityPayments"
                    type="number"
                    min={0}
                    step={100}
                    value={form.qualityPayments}
                    onChange={(e) => setForm((f) => ({ ...f, qualityPayments: e.target.value }))}
                    placeholder="0"
                    className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-edit-otherIncentives">Other incentives</Label>
                <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                  <Input
                    id="prov-edit-otherIncentives"
                    type="number"
                    min={0}
                    step={100}
                    value={form.otherIncentives}
                    onChange={(e) => setForm((f) => ({ ...f, otherIncentives: e.target.value }))}
                    placeholder="0"
                    className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-edit-workRVUs">Work RVUs</Label>
                <Input
                  id="prov-edit-workRVUs"
                  type="number"
                  min={0}
                  step={1}
                  value={form.workRVUs}
                  onChange={(e) => setForm((f) => ({ ...f, workRVUs: e.target.value }))}
                  placeholder="0"
                  className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-edit-outsideWRVUs">Outside wRVUs</Label>
                <Input
                  id="prov-edit-outsideWRVUs"
                  type="number"
                  min={0}
                  step={1}
                  value={form.outsideWRVUs}
                  onChange={(e) => setForm((f) => ({ ...f, outsideWRVUs: e.target.value }))}
                  placeholder="0"
                  className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-edit-currentCF">Current CF</Label>
                <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                  <Input
                    id="prov-edit-currentCF"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.currentCF}
                    onChange={(e) => setForm((f) => ({ ...f, currentCF: e.target.value }))}
                    placeholder="0"
                    className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Model
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prov-edit-productivityModel">Productivity model</Label>
                <Select
                  value={form.productivityModel || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, productivityModel: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger id="prov-edit-productivityModel" className="h-10">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="productivity">Productivity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border/80 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:min-w-[88px]">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave} className="sm:min-w-[88px]">
            {isEdit ? 'Save changes' : 'Add provider'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
