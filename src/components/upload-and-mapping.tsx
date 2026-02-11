import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Users, BarChart2, FileSpreadsheet, AlertCircle, ChevronRight, ChevronLeft, Search, Eye, Download, Pencil, Trash2 } from 'lucide-react'
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
import { PROVIDER_EXPECTED_COLUMNS } from '@/types/provider'
import { MARKET_EXPECTED_COLUMNS } from '@/types/market'
import {
  downloadSampleCsv,
  PROVIDER_SAMPLE_CSV,
  MARKET_SAMPLE_CSV,
  PROVIDER_SAMPLE_FILENAME,
  MARKET_SAMPLE_FILENAME,
} from '@/utils/sample-upload'
import { ResizableDataTable, type ResizableColumn } from '@/components/resizable-data-table'
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
  { label: 'Identity', keys: ['providerName', 'specialty', 'division'] },
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

function fmtCurrency(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
}
function fmtComma(n: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
}

interface UploadAndMappingProps {
  onProviderData: (rows: ProviderRow[], mapping: ColumnMapping | null) => void
  onMarketData: (rows: MarketRow[], mapping: ColumnMapping | null) => void
  existingProviderRows: ProviderRow[]
  existingMarketRows: MarketRow[]
  /** When provided, enables per-row Edit to adjust provider data (e.g. non-clinical) after upload. */
  onUpdateProviderRow?: (providerId: string, updates: Partial<ProviderRow>) => void
  /** When true, the current provider/market rows are built-in sample data (no saved upload). */
  usedSampleDataOnLoad?: boolean
}

export function UploadAndMapping({
  onProviderData,
  onMarketData,
  existingProviderRows,
  existingMarketRows,
  onUpdateProviderRow,
  usedSampleDataOnLoad = false,
}: UploadAndMappingProps) {
  const [providerRaw, setProviderRaw] = useState<RawFileState | null>(null)
  const [marketRaw, setMarketRaw] = useState<RawFileState | null>(null)
  const [providerMapping, setProviderMapping] = useState<ColumnMapping>({})
  const [marketMapping, setMarketMapping] = useState<ColumnMapping>({})
  const [appliedProviderRows, setAppliedProviderRows] = useState<ProviderRow[] | null>(null)
  const [appliedMarketRows, setAppliedMarketRows] = useState<MarketRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<FileType | null>(null)
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null)
  const [providerSearch, setProviderSearch] = useState('')
  const [providerPage, setProviderPage] = useState(0)
  const [providerPageSize, setProviderPageSize] = useState(50)
  const [marketSearch, setMarketSearch] = useState('')
  const [marketPage, setMarketPage] = useState(0)
  const [marketPageSize, setMarketPageSize] = useState(50)
  const [editingProvider, setEditingProvider] = useState<ProviderRow | null>(null)
  type EditFormState = {
    providerName: string
    specialty: string
    division: string
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
        qualityPayments: toStr(editingProvider.qualityPayments ?? editingProvider.currentTCC),
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
    onProviderData(rows, { ...providerMapping })
    setProviderRaw(null)
    setAppliedProviderRows(rows)
  }, [providerRaw, providerMapping, onProviderData])

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
  }, [marketRaw, marketMapping, onMarketData])

  const providerHeaders = providerRaw ? providerRaw.headers : []
  const marketHeaders = marketRaw ? marketRaw.headers : []

  const providerTableColumnsBase: ResizableColumn<ProviderRow>[] = [
    { key: 'providerName', label: 'Name', defaultWidth: 160, minWidth: 100 },
    { key: 'specialty', label: 'Specialty', defaultWidth: 120, minWidth: 80 },
    { key: 'division', label: 'Division', defaultWidth: 100, minWidth: 70 },
    { key: 'baseSalary', label: 'Base salary', align: 'right', defaultWidth: 120, minWidth: 90, render: (v) => (v != null ? fmtCurrency(Number(v)) : '—') },
    { key: 'nonClinicalPay', label: 'Non-clinical', align: 'right', defaultWidth: 110, minWidth: 80, render: (v) => (v != null ? fmtCurrency(Number(v)) : '—') },
    { key: 'totalWRVUs', label: 'Total wRVUs', align: 'right', defaultWidth: 110, minWidth: 80, render: (v) => (v != null ? fmtComma(Number(v), 0) : '—') },
    { key: 'currentCF', label: 'Current CF', align: 'right', defaultWidth: 100, minWidth: 80, render: (v) => (v != null ? fmtCurrency(Number(v), 2) : '—') },
    { key: 'productivityModel', label: 'Model', defaultWidth: 100, minWidth: 70 },
  ]

  const providerTableColumns: ResizableColumn<ProviderRow>[] =
    onUpdateProviderRow
      ? [
          ...providerTableColumnsBase,
          {
            key: '_edit',
            label: '',
            defaultWidth: 48,
            minWidth: 40,
            align: 'center' as const,
            render: (_: unknown, row: ProviderRow) => (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setEditingProvider(row)}
                title="Edit"
                aria-label="Edit"
              >
                <Pencil className="size-4" />
              </Button>
            ),
          },
        ]
      : providerTableColumnsBase

  const marketTableColumns: ResizableColumn<MarketRow>[] = [
    { key: 'specialty', label: 'Specialty', defaultWidth: 140, minWidth: 90 },
    { key: 'providerType', label: 'Type', defaultWidth: 90, minWidth: 60 },
    { key: 'region', label: 'Region', defaultWidth: 90, minWidth: 60 },
    ...(['TCC_25', 'TCC_50', 'TCC_75', 'TCC_90'] as const).map((k) => ({
      key: k,
      label: k,
      align: 'right' as const,
      defaultWidth: 100,
      minWidth: 80,
      render: (v: unknown) => (v != null ? fmtCurrency(Number(v)) : '—'),
    })),
    ...(['WRVU_25', 'WRVU_50', 'WRVU_75', 'WRVU_90'] as const).map((k) => ({
      key: k,
      label: k,
      align: 'right' as const,
      defaultWidth: 95,
      minWidth: 75,
      render: (v: unknown) => (v != null ? fmtComma(Number(v)) : '—'),
    })),
    ...(['CF_25', 'CF_50', 'CF_75', 'CF_90'] as const).map((k) => ({
      key: k,
      label: k,
      align: 'right' as const,
      defaultWidth: 95,
      minWidth: 75,
      render: (v: unknown) => (v != null ? fmtCurrency(Number(v), 2) : '—'),
    })),
  ]

  const providerHasData = !!providerRaw || existingProviderRows.length > 0
  const marketHasData = !!marketRaw || existingMarketRows.length > 0
  const providerDisplayRows = appliedProviderRows ?? existingProviderRows
  const marketDisplayRows = appliedMarketRows ?? existingMarketRows

  const providerFiltered = useMemo(() => {
    if (!providerSearch.trim()) return providerDisplayRows
    const q = providerSearch.trim().toLowerCase()
    return providerDisplayRows.filter((row) => {
      const name = String(row.providerName ?? '').toLowerCase()
      const specialty = String(row.specialty ?? '').toLowerCase()
      const division = String(row.division ?? '').toLowerCase()
      return name.includes(q) || specialty.includes(q) || division.includes(q)
    })
  }, [providerDisplayRows, providerSearch])

  const providerPaginated = useMemo(() => {
    const start = providerPage * providerPageSize
    return providerFiltered.slice(start, start + providerPageSize)
  }, [providerFiltered, providerPage, providerPageSize])

  const providerTotalPages = Math.max(1, Math.ceil(providerFiltered.length / providerPageSize))
  const providerStart = providerFiltered.length === 0 ? 0 : providerPage * providerPageSize + 1
  const providerEnd = Math.min((providerPage + 1) * providerPageSize, providerFiltered.length)

  const marketFiltered = useMemo(() => {
    if (!marketSearch.trim()) return marketDisplayRows
    const q = marketSearch.trim().toLowerCase()
    return marketDisplayRows.filter((row) => {
      const specialty = String(row.specialty ?? '').toLowerCase()
      const type = String(row.providerType ?? '').toLowerCase()
      const region = String(row.region ?? '').toLowerCase()
      return specialty.includes(q) || type.includes(q) || region.includes(q)
    })
  }, [marketDisplayRows, marketSearch])

  const marketPaginated = useMemo(() => {
    const start = marketPage * marketPageSize
    return marketFiltered.slice(start, start + marketPageSize)
  }, [marketFiltered, marketPage, marketPageSize])

  const marketTotalPages = Math.max(1, Math.ceil(marketFiltered.length / marketPageSize))
  const marketStart = marketFiltered.length === 0 ? 0 : marketPage * marketPageSize + 1
  const marketEnd = Math.min((marketPage + 1) * marketPageSize, marketFiltered.length)

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
        <Card
          className={`overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md ${providerHasData ? 'cursor-pointer' : ''}`}
          onClick={() => providerHasData && setExpandedCard((c) => (c === 'provider' ? null : 'provider'))}
        >
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
                className="shrink-0"
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
                  className="size-9 shrink-0"
                  onClick={() => downloadSampleCsv(PROVIDER_SAMPLE_FILENAME, PROVIDER_SAMPLE_CSV)}
                  title="Download sample"
                  aria-label="Download sample"
                >
                  <Download className="size-4" />
                </Button>
                {providerHasData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedCard((c) => (c === 'provider' ? null : 'provider'))
                    }}
                    title={providerRaw ? 'Map columns' : `View ${existingProviderRows.length} rows`}
                    aria-label={providerRaw ? 'Map columns' : 'View data'}
                  >
                    <Eye className="size-4" />
                  </Button>
                )}
                {providerHasData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
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

        <Card
          className={`overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md ${marketHasData ? 'cursor-pointer' : ''}`}
          onClick={() => marketHasData && setExpandedCard((c) => (c === 'market' ? null : 'market'))}
        >
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
                className="shrink-0"
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
                  className="size-9 shrink-0"
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
                    className="size-9 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedCard((c) => (c === 'market' ? null : 'market'))
                    }}
                    title={marketRaw ? 'Map columns' : `View ${existingMarketRows.length} rows`}
                    aria-label={marketRaw ? 'Map columns' : 'View data'}
                  >
                    <Eye className="size-4" />
                  </Button>
                )}
                {marketHasData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
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

      {expandedCard === 'provider' && providerDisplayRows.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">
              Provider data loaded
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {providerDisplayRows.length} row{providerDisplayRows.length !== 1 ? 's' : ''} loaded. Go to Modeller to run scenarios.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search by name, specialty, division…"
                  value={providerSearch}
                  onChange={(e) => {
                    setProviderSearch(e.target.value)
                    setProviderPage(0)
                  }}
                  className="pl-8 h-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Label htmlFor="provider-page-size" className="text-xs whitespace-nowrap">Rows per page</Label>
                <Select
                  value={String(providerPageSize)}
                  onValueChange={(v) => {
                    setProviderPageSize(Number(v))
                    setProviderPage(0)
                  }}
                >
                  <SelectTrigger id="provider-page-size" className="h-9 w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ResizableDataTable<ProviderRow>
              keyField="providerName"
              maxHeight="min(880px, 65vh)"
              rows={providerPaginated}
              columns={providerTableColumns}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {providerFiltered.length === providerDisplayRows.length
                  ? `Showing ${providerStart}–${providerEnd} of ${providerFiltered.length} rows.`
                  : `Showing ${providerStart}–${providerEnd} of ${providerFiltered.length} (filtered from ${providerDisplayRows.length}).`}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={providerPage === 0}
                  onClick={() => setProviderPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  Page {providerPage + 1} of {providerTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={providerPage >= providerTotalPages - 1}
                  onClick={() => setProviderPage((p) => Math.min(providerTotalPages - 1, p + 1))}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
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

      {expandedCard === 'market' && marketDisplayRows.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">
              Market data loaded
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {marketDisplayRows.length} row{marketDisplayRows.length !== 1 ? 's' : ''} loaded. TCC and CF as currency; wRVUs with commas.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search by specialty, type, region…"
                  value={marketSearch}
                  onChange={(e) => {
                    setMarketSearch(e.target.value)
                    setMarketPage(0)
                  }}
                  className="pl-8 h-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Label htmlFor="market-page-size" className="text-xs whitespace-nowrap">Rows per page</Label>
                <Select
                  value={String(marketPageSize)}
                  onValueChange={(v) => {
                    setMarketPageSize(Number(v))
                    setMarketPage(0)
                  }}
                >
                  <SelectTrigger id="market-page-size" className="h-9 w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ResizableDataTable<MarketRow>
              keyField="specialty"
              maxHeight="min(880px, 65vh)"
              rows={marketPaginated}
              columns={marketTableColumns}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {marketFiltered.length === marketDisplayRows.length
                  ? `Showing ${marketStart}–${marketEnd} of ${marketFiltered.length} rows.`
                  : `Showing ${marketStart}–${marketEnd} of ${marketFiltered.length} (filtered from ${marketDisplayRows.length}).`}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={marketPage === 0}
                  onClick={() => setMarketPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  Page {marketPage + 1} of {marketTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={marketPage >= marketTotalPages - 1}
                  onClick={() => setMarketPage((p) => Math.min(marketTotalPages - 1, p + 1))}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
