import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Users, BarChart2, FileSpreadsheet, AlertCircle, Eye, Download, Trash2, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseFile, buildDefaultMapping, buildDefaultProviderMapping, applyProviderMapping, applyMarketMapping } from '@/lib/parse-file'
import type { RawRow } from '@/types/upload'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ColumnMapping } from '@/types/upload'
import type { SynonymMap } from '@/types/batch'
import { PROVIDER_EXPECTED_COLUMNS } from '@/types/provider'
import { MARKET_EXPECTED_COLUMNS } from '@/types/market'
import { SynonymEditor } from '@/components/batch/synonym-editor'
import {
  downloadSampleCsv,
  PROVIDER_SAMPLE_CSV,
  MARKET_SAMPLE_CSV,
  PROVIDER_SAMPLE_FILENAME,
  MARKET_SAMPLE_FILENAME,
} from '@/utils/sample-upload'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Sentinel for "Skip" option; Radix Select forbids value="". */
const SKIP_VALUE = '__skip__'

type FileType = 'provider' | 'market'
type ExpandedCard = 'provider' | 'market' | null

type RawFileState = { rows: RawRow[]; headers: string[]; fileName?: string }

/** Group provider columns for Apple-style sectioned mapping UI. CART = Clinical, Admin, Research, Teaching. */
const PROVIDER_COLUMN_GROUPS: { label: string; keys: readonly string[] }[] = [
  { label: 'Identity', keys: ['providerName', 'specialty', 'division', 'providerType'] },
  { label: 'FTE (CART)', keys: ['totalFTE', 'clinicalFTE', 'adminFTE', 'researchFTE', 'teachingFTE'] },
  { label: 'Compensation & wRVUs', keys: ['baseSalary', 'qualityPayments', 'otherIncentives', 'currentTCC', 'workRVUs', 'outsideWRVUs', 'currentCF', 'nonClinicalPay'] },
  { label: 'Model', keys: ['productivityModel'] },
]

/** Group market columns for Apple-style sectioned mapping UI. */
const MARKET_COLUMN_GROUPS: { label: string; keys: readonly string[] }[] = [
  { label: 'Identity', keys: ['specialty', 'providerType', 'region'] },
  { label: 'Total cash compensation (TCC)', keys: ['TCC_25', 'TCC_50', 'TCC_75', 'TCC_90'] },
  { label: 'Work RVUs', keys: ['WRVU_25', 'WRVU_50', 'WRVU_75', 'WRVU_90'] },
  { label: 'Conversion factors', keys: ['CF_25', 'CF_50', 'CF_75', 'CF_90'] },
]

interface UploadAndMappingProps {
  onProviderData: (rows: ProviderRow[], mapping: ColumnMapping | null, fileName?: string) => void
  onMarketData: (rows: MarketRow[], mapping: ColumnMapping | null) => void
  existingProviderRows: ProviderRow[]
  existingMarketRows: MarketRow[]
  /** When provided, enables per-row Edit to adjust provider data (e.g. non-clinical) after upload. */
  onUpdateProviderRow?: (providerId: string, updates: Partial<ProviderRow>) => void
  /** When true, the current provider/market rows are built-in sample data (no saved upload). */
  usedSampleDataOnLoad?: boolean
  /** Specialty synonym map (provider → market); edited here and reused in batch. */
  batchSynonymMap: SynonymMap
  onAddSynonym: (key: string, value: string) => void
  onRemoveSynonym: (key: string) => void
  /** When provided, navigating to Data screen after Apply and Eye when data is loaded. Pass tab to open Provider or Market table. */
  onNavigateToData?: (tab?: 'providers' | 'market') => void
}

export function UploadAndMapping({
  onProviderData,
  onMarketData,
  existingProviderRows,
  existingMarketRows,
  onUpdateProviderRow,
  usedSampleDataOnLoad = false,
  batchSynonymMap,
  onAddSynonym,
  onRemoveSynonym,
  onNavigateToData,
}: UploadAndMappingProps) {
  const [providerRaw, setProviderRaw] = useState<RawFileState | null>(null)
  const [marketRaw, setMarketRaw] = useState<RawFileState | null>(null)
  const [providerMapping, setProviderMapping] = useState<ColumnMapping>({})
  const [marketMapping, setMarketMapping] = useState<ColumnMapping>({})
  const [, setAppliedProviderRows] = useState<ProviderRow[] | null>(null)
  const [, setAppliedMarketRows] = useState<MarketRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<FileType | null>(null)
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null)
  const [editingProvider, setEditingProvider] = useState<ProviderRow | null>(null)
  type EditFormState = {
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
  const emptyEditForm: EditFormState = {
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
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm)
  const [showMappings, setShowMappings] = useState(false)
  const providerFileInputRef = useRef<HTMLInputElement>(null)
  const marketFileInputRef = useRef<HTMLInputElement>(null)

  const toStr = (v: number | string | undefined): string =>
    v != null && v !== '' ? String(v) : ''

  useEffect(() => {
    if (editingProvider) {
      setEditForm({
        providerName: toStr(editingProvider.providerName),
        specialty: toStr(editingProvider.specialty),
        division: toStr(editingProvider.division),
        providerType: toStr(editingProvider.providerType),
        totalFTE: toStr(editingProvider.totalFTE),
        clinicalFTE: toStr(editingProvider.clinicalFTE),
        adminFTE: toStr(editingProvider.adminFTE),
        researchFTE: toStr(editingProvider.researchFTE),
        teachingFTE: toStr(editingProvider.teachingFTE),
        baseSalary: toStr(editingProvider.baseSalary),
        workRVUs: toStr(editingProvider.workRVUs ?? editingProvider.pchWRVUs),
        outsideWRVUs: toStr(editingProvider.outsideWRVUs),
        currentCF: toStr(editingProvider.currentCF),
        nonClinicalPay: toStr(editingProvider.nonClinicalPay),
        qualityPayments: toStr(editingProvider.qualityPayments),
        otherIncentives: toStr(editingProvider.otherIncentives),
        productivityModel: toStr(editingProvider.productivityModel),
      })
    }
  }, [editingProvider])

  const handleFile = useCallback(
    async (file: File | null, type: FileType) => {
      if (!file) return
      setError(null)
      setLoading(type)
      try {
        const { rows, headers } = await parseFile(file)
        if (rows.length === 0) {
          setError(`${type === 'provider' ? 'Provider' : 'Market'} file has no data rows.`)
          setLoading(null)
          return
        }
        if (type === 'provider') {
          setProviderRaw({ rows, headers, fileName: file.name })
          setProviderMapping(buildDefaultProviderMapping(headers, [...PROVIDER_EXPECTED_COLUMNS]))
          setAppliedProviderRows(null)
          setExpandedCard('provider')
        } else {
          setMarketRaw({ rows, headers, fileName: file.name })
          setMarketMapping(buildDefaultMapping(headers, [...MARKET_EXPECTED_COLUMNS]))
          setAppliedMarketRows(null)
          setExpandedCard('market')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse file')
      } finally {
        setLoading(null)
      }
    },
    []
  )

  const applyProvider = useCallback(() => {
    if (!providerRaw) return
    const { rows, errors } = applyProviderMapping(
      providerRaw.rows,
      providerRaw.headers,
      providerMapping
    )
    if (rows.length === 0) {
      setError(`Provider: ${errors.length ? errors.slice(0, 5).join('; ') + (errors.length > 5 ? '...' : '') : 'No valid rows (each row needs provider name and base salary).'}`)
      return
    }
    if (errors.length) {
      setError(`Provider: ${rows.length} rows applied. Skipped: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? ` ... and ${errors.length - 5} more` : ''}`)
    } else {
      setError(null)
    }
    onProviderData(rows, { ...providerMapping }, providerRaw?.fileName)
    setProviderRaw(null)
    setAppliedProviderRows(rows)
    setExpandedCard(null)
    onNavigateToData?.()
  }, [providerRaw, providerMapping, onProviderData, onNavigateToData])

  const applyMarket = useCallback(() => {
    if (!marketRaw) return
    const { rows, errors } = applyMarketMapping(
      marketRaw.rows,
      marketRaw.headers,
      marketMapping
    )
    if (errors.length) {
      setError(`Market: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '...' : ''}`)
      return
    }
    setError(null)
    onMarketData(rows, { ...marketMapping })
    setMarketRaw(null)
    setAppliedMarketRows(rows)
    setExpandedCard(null)
    onNavigateToData?.()
  }, [marketRaw, marketMapping, onMarketData, onNavigateToData])

  const providerHeaders = providerRaw ? providerRaw.headers : []
  const marketHeaders = marketRaw ? marketRaw.headers : []

  const providerHasData = !!providerRaw || existingProviderRows.length > 0
  const marketHasData = !!marketRaw || existingMarketRows.length > 0
  const providerSpecialties = useMemo(() => {
    const set = new Set(existingProviderRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [existingProviderRows])
  const marketSpecialties = useMemo(() => {
    const set = new Set(existingMarketRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [existingMarketRows])

  const parseNum = (s: string): number | undefined => {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : undefined
  }

  const handleSaveEdit = useCallback(() => {
    if (!editingProvider || !onUpdateProviderRow) return
    const providerId = editingProvider.providerId ?? editingProvider.providerName ?? ''
    const updates: Partial<ProviderRow> = {}
    if (editForm.providerName.trim() !== '') updates.providerName = editForm.providerName.trim()
    if (editForm.specialty.trim() !== '') updates.specialty = editForm.specialty.trim()
    if (editForm.division.trim() !== '') updates.division = editForm.division.trim()
    if (editForm.providerType.trim() !== '') updates.providerType = editForm.providerType.trim()
    const totalFTE = parseNum(editForm.totalFTE)
    if (totalFTE !== undefined) updates.totalFTE = totalFTE
    const clinicalFTE = parseNum(editForm.clinicalFTE)
    if (clinicalFTE !== undefined) updates.clinicalFTE = clinicalFTE
    const adminFTE = parseNum(editForm.adminFTE)
    if (adminFTE !== undefined) updates.adminFTE = adminFTE
    const researchFTE = parseNum(editForm.researchFTE)
    if (researchFTE !== undefined) updates.researchFTE = researchFTE
    const teachingFTE = parseNum(editForm.teachingFTE)
    if (teachingFTE !== undefined) updates.teachingFTE = teachingFTE
    const baseSalary = parseNum(editForm.baseSalary)
    if (baseSalary !== undefined) updates.baseSalary = baseSalary
    const workRVUs = parseNum(editForm.workRVUs)
    if (workRVUs !== undefined) updates.workRVUs = workRVUs
    const outsideWRVUs = parseNum(editForm.outsideWRVUs)
    if (outsideWRVUs !== undefined) updates.outsideWRVUs = outsideWRVUs
    const currentCF = parseNum(editForm.currentCF)
    if (currentCF !== undefined) updates.currentCF = currentCF
    const nonClinicalPay = parseNum(editForm.nonClinicalPay)
    updates.nonClinicalPay = nonClinicalPay !== undefined && Number.isFinite(nonClinicalPay) ? nonClinicalPay : (editingProvider.nonClinicalPay ?? 0)
    const qualityPayments = parseNum(editForm.qualityPayments)
    if (qualityPayments !== undefined) updates.qualityPayments = qualityPayments
    const otherIncentives = parseNum(editForm.otherIncentives)
    if (otherIncentives !== undefined) updates.otherIncentives = otherIncentives
    if (editForm.productivityModel.trim() !== '') updates.productivityModel = editForm.productivityModel.trim()
    onUpdateProviderRow(providerId, updates)
    setEditingProvider(null)
  }, [editingProvider, editForm, onUpdateProviderRow])

  return (
    <div className="space-y-6">
      <Dialog open={!!editingProvider} onOpenChange={(open) => !open && setEditingProvider(null)}>
        <DialogContent className="gap-0 overflow-y-auto max-h-[90vh] p-0 sm:max-w-[720px]">
          {/* Header — clean title + description */}
          <div className="border-b border-border/80 bg-muted/30 px-6 py-5 pr-12 shrink-0">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Edit provider
              </DialogTitle>
              <DialogDescription asChild>
                <p className="text-sm text-muted-foreground">
                  {editingProvider?.providerName ?? 'Unknown'}. Changes save to the loaded dataset and appear in the Modeller.
                </p>
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body — all fields in sectioned 2-column layout */}
          <div className="px-6 py-5 space-y-6">
            {/* Identity */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Identity
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-providerName">Provider name</Label>
                  <Input
                    id="edit-providerName"
                    value={editForm.providerName}
                    onChange={(e) => setEditForm((f) => ({ ...f, providerName: e.target.value }))}
                    placeholder="Name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-specialty">Specialty</Label>
                  <Input
                    id="edit-specialty"
                    value={editForm.specialty}
                    onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                    placeholder="Specialty"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-division">Division</Label>
                  <Input
                    id="edit-division"
                    value={editForm.division}
                    onChange={(e) => setEditForm((f) => ({ ...f, division: e.target.value }))}
                    placeholder="Division"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-providerType">Provider type / Role</Label>
                  <Input
                    id="edit-providerType"
                    value={editForm.providerType}
                    onChange={(e) => setEditForm((f) => ({ ...f, providerType: e.target.value }))}
                    placeholder="e.g. Clinical, Division Chief, Medical Director"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in the Conversion Factor Optimizer to exclude certain roles (e.g. division chiefs, medical directors) from the run.
                  </p>
                </div>
              </div>
            </fieldset>

            {/* FTE */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                FTE
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-totalFTE">Total FTE</Label>
                  <Input
                    id="edit-totalFTE"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={editForm.totalFTE}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalFTE: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-clinicalFTE">Clinical FTE</Label>
                  <Input
                    id="edit-clinicalFTE"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={editForm.clinicalFTE}
                    onChange={(e) => setEditForm((f) => ({ ...f, clinicalFTE: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-adminFTE">Admin FTE</Label>
                  <Input
                    id="edit-adminFTE"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={editForm.adminFTE}
                    onChange={(e) => setEditForm((f) => ({ ...f, adminFTE: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-researchFTE">Research FTE</Label>
                  <Input
                    id="edit-researchFTE"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={editForm.researchFTE}
                    onChange={(e) => setEditForm((f) => ({ ...f, researchFTE: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-teachingFTE">Teaching FTE</Label>
                  <Input
                    id="edit-teachingFTE"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={editForm.teachingFTE}
                    onChange={(e) => setEditForm((f) => ({ ...f, teachingFTE: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </fieldset>

            {/* Compensation & wRVUs */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Compensation & wRVUs
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-baseSalary">Base salary</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                    <Input
                      id="edit-baseSalary"
                      type="number"
                      min={0}
                      step={100}
                      value={editForm.baseSalary}
                      onChange={(e) => setEditForm((f) => ({ ...f, baseSalary: e.target.value }))}
                      placeholder="0"
                      className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-nonClinicalPay">Non-clinical pay</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                    <Input
                      id="edit-nonClinicalPay"
                      type="number"
                      min={0}
                      step={100}
                      value={editForm.nonClinicalPay}
                      onChange={(e) => setEditForm((f) => ({ ...f, nonClinicalPay: e.target.value }))}
                      placeholder="0"
                      className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-qualityPayments">Quality payments</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                    <Input
                      id="edit-qualityPayments"
                      type="number"
                      min={0}
                      step={100}
                      value={editForm.qualityPayments}
                      onChange={(e) => setEditForm((f) => ({ ...f, qualityPayments: e.target.value }))}
                      placeholder="0"
                      className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-otherIncentives">Other incentives</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                    <Input
                      id="edit-otherIncentives"
                      type="number"
                      min={0}
                      step={100}
                      value={editForm.otherIncentives}
                      onChange={(e) => setEditForm((f) => ({ ...f, otherIncentives: e.target.value }))}
                      placeholder="0"
                      className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-workRVUs">Work RVUs</Label>
                  <Input
                    id="edit-workRVUs"
                    type="number"
                    min={0}
                    step={1}
                    value={editForm.workRVUs}
                    onChange={(e) => setEditForm((f) => ({ ...f, workRVUs: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-outsideWRVUs">Outside wRVUs</Label>
                  <Input
                    id="edit-outsideWRVUs"
                    type="number"
                    min={0}
                    step={1}
                    value={editForm.outsideWRVUs}
                    onChange={(e) => setEditForm((f) => ({ ...f, outsideWRVUs: e.target.value }))}
                    placeholder="0"
                    className="h-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-currentCF">Current CF</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center border-r border-input bg-muted/50 px-3 text-muted-foreground tabular-nums text-sm">$</span>
                    <Input
                      id="edit-currentCF"
                      type="number"
                      min={0}
                      step={0.01}
                      value={editForm.currentCF}
                      onChange={(e) => setEditForm((f) => ({ ...f, currentCF: e.target.value }))}
                      placeholder="0"
                      className="h-10 border-0 bg-transparent py-2 pl-3 pr-4 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Model */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Model
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-productivityModel">Productivity model</Label>
                  <Select
                    value={editForm.productivityModel || '__none__'}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, productivityModel: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger id="edit-productivityModel" className="h-10">
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

          {/* Footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-border/80 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end shrink-0">
            <Button variant="outline" onClick={() => setEditingProvider(null)} className="sm:min-w-[88px]">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="sm:min-w-[88px]">
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CompLens-style tool cards: icon, title (tooltip), file input. Click card to open mapping / view table. */}
      <TooltipProvider>
      {usedSampleDataOnLoad && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Sample data</strong> is showing — no saved data was found for this browser (e.g. different port or after an update). Upload your provider and market files to replace it with your data.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="cursor-default overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col p-6">
            <div className="mb-4 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Users className="size-6" />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="text-lg font-semibold leading-tight text-foreground cursor-default">
                      Provider file
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent>
                    CSV or XLSX, one row per provider.
                  </TooltipContent>
                </Tooltip>
              </div>
              <input
                ref={providerFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'provider')}
                disabled={!!loading}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                className="shrink-0 cursor-pointer"
                onClick={() => providerFileInputRef.current?.click()}
                disabled={!!loading}
              >
                Choose File
              </Button>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-muted-foreground text-xs min-w-0">
                {providerRaw
                  ? (providerRaw.fileName ?? 'File') + ' selected — map columns below and click Apply to load.'
                  : existingProviderRows.length > 0
                    ? `${existingProviderRows.length} rows loaded`
                    : ''}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 cursor-pointer"
                  onClick={() => downloadSampleCsv(PROVIDER_SAMPLE_FILENAME, PROVIDER_SAMPLE_CSV)}
                  title="Download sample"
                  aria-label="Download sample"
                >
                  <Download className="size-4" />
                </Button>
                {providerHasData && existingMarketRows.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMappings((prev) => !prev)
                        }}
                        aria-label={showMappings ? 'Hide specialty mapping' : 'Manage specialty mapping'}
                      >
                        <Link2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>
                      Specialty mapping{Object.keys(batchSynonymMap).length > 0 ? ` (${Object.keys(batchSynonymMap).length} saved)` : ''}
                    </TooltipContent>
                  </Tooltip>
                )}
                {providerHasData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (providerRaw) {
                        setExpandedCard((c) => (c === 'provider' ? null : 'provider'))
                      } else if (onNavigateToData) {
                        onNavigateToData('providers')
                      } else {
                        setExpandedCard((c) => (c === 'provider' ? null : 'provider'))
                      }
                    }}
                    title={providerRaw ? 'Map columns' : onNavigateToData ? 'View data' : `View ${existingProviderRows.length} rows`}
                    aria-label={providerRaw ? 'Map columns' : onNavigateToData ? 'View data' : 'View data'}
                  >
                    <Eye className="size-4" />
                  </Button>
                )}
                {providerHasData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm('Clear all provider data and start over? This cannot be undone.')) {
                        onProviderData([], null)
                        setProviderRaw(null)
                        setAppliedProviderRows(null)
                        setProviderMapping({})
                        setExpandedCard((c) => (c === 'provider' ? null : c))
                        setError(null)
                        if (providerFileInputRef.current) providerFileInputRef.current.value = ''
                      }
                    }}
                    title="Clear provider data"
                    aria-label="Clear provider data"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-default overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col p-6">
            <div className="mb-4 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <BarChart2 className="size-6" />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="text-lg font-semibold leading-tight text-foreground cursor-default">
                      Market file
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent>
                    TCC, wRVU, CF by specialty.
                  </TooltipContent>
                </Tooltip>
              </div>
              <input
                ref={marketFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'market')}
                disabled={!!loading}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                className="shrink-0 cursor-pointer"
                onClick={() => marketFileInputRef.current?.click()}
                disabled={!!loading}
              >
                Choose File
              </Button>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-muted-foreground text-xs min-w-0">
                {marketRaw
                  ? (marketRaw.fileName ?? 'File') + ' selected — map columns below and click Apply to load.'
                  : existingMarketRows.length > 0
                    ? `${existingMarketRows.length} rows loaded`
                    : ''}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 cursor-pointer"
                  onClick={() => downloadSampleCsv(MARKET_SAMPLE_FILENAME, MARKET_SAMPLE_CSV)}
                  title="Download sample"
                  aria-label="Download sample"
                >
                  <Download className="size-4" />
                </Button>
                {marketHasData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (marketRaw) {
                        setExpandedCard((c) => (c === 'market' ? null : 'market'))
                      } else if (onNavigateToData) {
                        onNavigateToData('market')
                      } else {
                        setExpandedCard((c) => (c === 'market' ? null : 'market'))
                      }
                    }}
                    title={marketRaw ? 'Map columns' : onNavigateToData ? 'View data' : `View ${existingMarketRows.length} rows`}
                    aria-label={marketRaw ? 'Map columns' : onNavigateToData ? 'View data' : 'View data'}
                  >
                    <Eye className="size-4" />
                  </Button>
                )}
                {marketHasData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm('Clear all market data and start over? This cannot be undone.')) {
                        onMarketData([], null)
                        setMarketRaw(null)
                        setAppliedMarketRows(null)
                        setMarketMapping({})
                        setExpandedCard((c) => (c === 'market' ? null : c))
                        setError(null)
                        if (marketFileInputRef.current) marketFileInputRef.current.value = ''
                      }
                    }}
                    title="Clear market data"
                    aria-label="Clear market data"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {existingProviderRows.length > 0 && existingMarketRows.length > 0 && showMappings && (
        <SynonymEditor
          synonymMap={batchSynonymMap}
          onAdd={onAddSynonym}
          onRemove={onRemoveSynonym}
          onHide={() => setShowMappings(false)}
          providerSpecialties={providerSpecialties}
          marketSpecialties={marketSpecialties}
        />
      )}
      </TooltipProvider>

      {loading && (
        <p className="text-muted-foreground text-sm">Parsing file…</p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {expandedCard === 'provider' && providerRaw && (
        <Card className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-sm ring-1 ring-primary/10">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center gap-3 text-left text-[17px] font-semibold tracking-tight text-foreground">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="size-5" />
              </span>
              Map provider columns
            </CardTitle>
            <p className="text-[13px] text-muted-foreground pl-[52px]">
              Match your file columns to the required fields below, then click <strong>Apply mapping & load provider data</strong> to finish.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {PROVIDER_COLUMN_GROUPS.map((group) => (
              <div key={group.label} className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {group.keys.map((key) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <Label className="text-[13px] font-medium text-foreground">
                        {key === 'workRVUs' ? 'Work RVUs (or wRVUs)' : key === 'productivityModel' ? 'Productivity model' : key === 'researchFTE' ? 'Research FTE' : key === 'teachingFTE' ? 'Teaching FTE' : key === 'qualityPayments' ? 'Quality payments' : key === 'otherIncentives' ? 'Other incentives' : key === 'currentTCC' ? 'Current TCC (legacy)' : key}
                      </Label>
                      <Select
                        value={providerMapping[key] || SKIP_VALUE}
                        onValueChange={(v) =>
                          setProviderMapping((m) => ({
                            ...m,
                            [key]: v === SKIP_VALUE || v === '__blank' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 w-full rounded-lg border border-border/80 bg-muted/30 text-sm focus:ring-2 focus:ring-primary/20">
                          <SelectValue placeholder="Skip" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-border/60 shadow-lg">
                          <SelectItem value={SKIP_VALUE} className="text-sm">Skip</SelectItem>
                          {providerHeaders.map((h) => (
                            <SelectItem key={h || '__blank'} value={h || '__blank'} className="text-sm">
                              {h || '(blank column)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={applyProvider}
                className="h-11 rounded-xl bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Apply mapping & load provider data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {expandedCard === 'market' && marketRaw && (
        <Card className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-sm ring-1 ring-primary/10">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center gap-3 text-left text-[17px] font-semibold tracking-tight text-foreground">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="size-5" />
              </span>
              Map market columns
            </CardTitle>
            <p className="text-[13px] text-muted-foreground pl-[52px]">
              Match your file columns to the required fields below, then click <strong>Apply mapping & load market data</strong> to finish.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {MARKET_COLUMN_GROUPS.map((group) => (
              <div key={group.label} className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {group.keys.map((key) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <Label className="text-[13px] font-medium text-foreground">{key}</Label>
                      <Select
                        value={marketMapping[key] || SKIP_VALUE}
                        onValueChange={(v) =>
                          setMarketMapping((m) => ({
                            ...m,
                            [key]: v === SKIP_VALUE || v === '__blank' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 w-full rounded-lg border border-border/80 bg-muted/30 text-sm focus:ring-2 focus:ring-primary/20">
                          <SelectValue placeholder="Skip" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-border/60 shadow-lg">
                          <SelectItem value={SKIP_VALUE} className="text-sm">Skip</SelectItem>
                          {marketHeaders.map((h) => (
                            <SelectItem key={h || '__blank'} value={h || '__blank'} className="text-sm">
                              {h || '(blank column)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={applyMarket}
                className="h-11 rounded-xl bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Apply mapping & load market data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
