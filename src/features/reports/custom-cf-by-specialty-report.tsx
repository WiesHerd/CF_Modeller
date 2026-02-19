import { useCallback, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  Eraser,
  FileDown,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Lock,
  Printer,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Command, CommandInput } from '@/components/ui/command'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import {
  Sheet,
  ResizableSheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SaveScenarioDialog } from '@/components/saved-scenarios-section'
import { TccWrvuSummaryTable } from './tcc-wrvu-summary-table'
import { MarketPositioningCalculationDrawer } from '@/features/optimizer/components/market-positioning-calculation-drawer'
import { MarketCFLine } from '@/features/optimizer/components/market-cf-line'
import type { MarketCFBenchmarks } from '@/types/optimizer'
import { downloadBatchResultsCSV, exportBatchResultsXLSX } from '@/lib/batch-export'
import { runBatch, matchMarketRow } from '@/lib/batch'
import { interpPercentile } from '@/lib/interpolation'
import {
  getImputedVsMarketProviderDetail,
  DEFAULT_IMPUTED_VS_MARKET_CONFIG,
  type ImputedVsMarketProviderDetail,
} from '@/lib/imputed-vs-market'
import { getGapInterpretation } from '@/features/optimizer/components/optimizer-constants'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/format'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs } from '@/types/scenario'
import type { BatchResults, BatchRowResult, BatchOverrides, SavedBatchScenarioConfig } from '@/types/batch'
import type { SynonymMap } from '@/types/batch'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'

export type CustomCFMode = 'dollar' | 'percentile'

export interface CustomCfBySpecialtyReportProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  batchSynonymMap: SynonymMap
  onBack: () => void
  onSaveScenarioConfig?: (config: Omit<SavedBatchScenarioConfig, 'id' | 'createdAt'>) => void
  /** Saved batch scenario configs (from Batch or saved from this report) to load and apply. */
  savedBatchScenarioConfigs?: SavedBatchScenarioConfig[]
  /** When provided, each loaded scenario in the dropdown shows a delete control. */
  onDeleteBatchScenarioConfig?: (id: string) => void
}

/** Specialties that have a market match (used for the CF table). */
function getSpecialtiesWithMarket(
  providerRows: ProviderRow[],
  marketRows: MarketRow[],
  synonymMap: SynonymMap
): string[] {
  const set = new Set<string>()
  for (const p of providerRows) {
    const specialty = (p.specialty ?? '').trim()
    if (!specialty) continue
    const match = matchMarketRow(p, marketRows, synonymMap)
    if (match.marketRow) set.add(specialty)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function CustomCfBySpecialtyReport({
  providerRows,
  marketRows,
  scenarioInputs,
  batchSynonymMap,
  onBack,
  onSaveScenarioConfig,
  savedBatchScenarioConfigs = [],
  onDeleteBatchScenarioConfig,
}: CustomCfBySpecialtyReportProps) {
  const [mode, setMode] = useState<CustomCFMode>('percentile')
  /** One value applied to all specialties when set; table overrides apply per specialty. */
  const [defaultForAll, setDefaultForAll] = useState<string>('')
  const [specialtyValues, setSpecialtyValues] = useState<Record<string, string>>({})
  const [providerTypeScope, setProviderTypeScope] = useState<string[]>([])
  const [providerTypeScopeSearch, setProviderTypeScopeSearch] = useState<string>('')
  const [compTypeScope, setCompTypeScope] = useState<string[]>([])
  const [compTypeScopeSearch, setCompTypeScopeSearch] = useState<string>('')
  const [specialtyScope, setSpecialtyScope] = useState<string[]>([])
  const [specialtyScopeSearch, setSpecialtyScopeSearch] = useState<string>('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [specialtySearch, setSpecialtySearch] = useState<string>('')
  const [providerSearch, setProviderSearch] = useState<string>('')
  const [payVsProdFilter, setPayVsProdFilter] = useState<string>('all')
  const [drawerProvider, setDrawerProvider] = useState<ImputedVsMarketProviderDetail | null>(null)
  const [drawerSpecialtyLabel, setDrawerSpecialtyLabel] = useState<string | undefined>(undefined)
  const [summaryBySpecialtyDrawerOpen, setSummaryBySpecialtyDrawerOpen] = useState(false)
  const [saveScenarioDialogOpen, setSaveScenarioDialogOpen] = useState(false)

  /** Rows filtered by the other two scope filters (for cascading dropdown options). */
  const rowsForSpecialtyOptions = useMemo(() => {
    let out = providerRows
    if (providerTypeScope.length > 0) {
      const set = new Set(providerTypeScope)
      out = out.filter((p) => set.has((p.providerType ?? '').trim()))
    }
    if (compTypeScope.length > 0) {
      const selectedCompTypes = new Set(compTypeScope)
      out = out.filter((p) => {
        const model = (p.productivityModel ?? '').trim().toLowerCase()
        if (selectedCompTypes.has(model)) return true
        if (selectedCompTypes.has('productivity') && model.includes('prod')) return true
        if (selectedCompTypes.has('base') && model.includes('base')) return true
        return false
      })
    }
    return out
  }, [providerRows, providerTypeScope, compTypeScope])

  const rowsForProviderTypeOptions = useMemo(() => {
    let out = providerRows
    if (specialtyScope.length > 0) {
      const set = new Set(specialtyScope)
      out = out.filter((p) => set.has((p.specialty ?? '').trim()))
    }
    if (compTypeScope.length > 0) {
      const selectedCompTypes = new Set(compTypeScope)
      out = out.filter((p) => {
        const model = (p.productivityModel ?? '').trim().toLowerCase()
        if (selectedCompTypes.has(model)) return true
        if (selectedCompTypes.has('productivity') && model.includes('prod')) return true
        if (selectedCompTypes.has('base') && model.includes('base')) return true
        return false
      })
    }
    return out
  }, [providerRows, specialtyScope, compTypeScope])

  const rowsForCompTypeOptions = useMemo(() => {
    let out = providerRows
    if (specialtyScope.length > 0) {
      const set = new Set(specialtyScope)
      out = out.filter((p) => set.has((p.specialty ?? '').trim()))
    }
    if (providerTypeScope.length > 0) {
      const set = new Set(providerTypeScope)
      out = out.filter((p) => set.has((p.providerType ?? '').trim()))
    }
    return out
  }, [providerRows, specialtyScope, providerTypeScope])

  const specialtyScopeOptions = useMemo(() => {
    const set = new Set(
      rowsForSpecialtyOptions
        .map((p) => (p.specialty ?? '').trim())
        .filter((v) => v.length > 0)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rowsForSpecialtyOptions])

  const providerTypeOptions = useMemo(() => {
    const set = new Set(
      rowsForProviderTypeOptions
        .map((p) => (p.providerType ?? '').trim())
        .filter((v) => v.length > 0)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rowsForProviderTypeOptions])

  const compTypeOptions = useMemo(() => {
    const set = new Set<string>(['productivity', 'base'])
    for (const model of rowsForCompTypeOptions
      .map((p) => (p.productivityModel ?? '').trim().toLowerCase())
      .filter((v) => v.length > 0)) {
      set.add(model)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rowsForCompTypeOptions])

  const filteredProviderTypeScopeOptions = useMemo(() => {
    const q = providerTypeScopeSearch.trim().toLowerCase()
    if (!q) return providerTypeOptions
    return providerTypeOptions.filter((opt) => opt.toLowerCase().includes(q))
  }, [providerTypeOptions, providerTypeScopeSearch])

  const filteredCompTypeScopeOptions = useMemo(() => {
    const q = compTypeScopeSearch.trim().toLowerCase()
    if (!q) return compTypeOptions
    return compTypeOptions.filter((opt) => opt.toLowerCase().includes(q))
  }, [compTypeOptions, compTypeScopeSearch])

  const filteredSpecialtyScopeOptions = useMemo(() => {
    const q = specialtyScopeSearch.trim().toLowerCase()
    if (!q) return specialtyScopeOptions
    return specialtyScopeOptions.filter((opt) => opt.toLowerCase().includes(q))
  }, [specialtyScopeOptions, specialtyScopeSearch])

  const toggleProviderTypeScope = useCallback((value: string) => {
    setProviderTypeScope((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }, [])

  const toggleCompTypeScope = useCallback((value: string) => {
    setCompTypeScope((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }, [])

  const toggleSpecialtyScope = useCallback((value: string) => {
    setSpecialtyScope((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }, [])

  const scopedProviderRows = useMemo(() => {
    let out = providerRows
    if (specialtyScope.length > 0) {
      const selectedSpecialties = new Set(specialtyScope)
      out = out.filter((p) => selectedSpecialties.has((p.specialty ?? '').trim()))
    }
    if (providerTypeScope.length > 0) {
      const selectedProviderTypes = new Set(providerTypeScope)
      out = out.filter((p) => selectedProviderTypes.has((p.providerType ?? '').trim()))
    }
    if (compTypeScope.length > 0) {
      const selectedCompTypes = new Set(compTypeScope)
      out = out.filter((p) => {
        const model = (p.productivityModel ?? '').trim().toLowerCase()
        if (selectedCompTypes.has(model)) return true
        if (selectedCompTypes.has('productivity') && model.includes('prod')) return true
        if (selectedCompTypes.has('base') && model.includes('base')) return true
        return false
      })
    }
    return out
  }, [providerRows, specialtyScope, providerTypeScope, compTypeScope])

  const providerTypeScopeLabel = useMemo(() => {
    if (providerTypeScope.length === 0) return 'All provider types'
    if (providerTypeScope.length === 1) return providerTypeScope[0]
    return `${providerTypeScope.length} provider types selected`
  }, [providerTypeScope])

  const compTypeScopeLabel = useMemo(() => {
    if (compTypeScope.length === 0) return 'All compensation types'
    if (compTypeScope.length === 1) return compTypeScope[0]
    return `${compTypeScope.length} compensation types selected`
  }, [compTypeScope])

  const specialtyScopeLabel = useMemo(() => {
    if (specialtyScope.length === 0) return 'All specialties'
    if (specialtyScope.length === 1) return specialtyScope[0]
    return `${specialtyScope.length} specialties selected`
  }, [specialtyScope])

  const specialties = useMemo(
    () => getSpecialtiesWithMarket(scopedProviderRows, marketRows, batchSynonymMap),
    [scopedProviderRows, marketRows, batchSynonymMap]
  )

  /** Percentile used for "use for all" in percentile mode (for market CF column label). */
  const effectivePercentileForDisplay = useMemo(() => {
    const raw = defaultForAll.trim()
    const n = raw === '' ? NaN : Number(raw)
    if (mode !== 'percentile' || !Number.isFinite(n)) return 40
    return Math.max(0, Math.min(100, n))
  }, [mode, defaultForAll])

  /** Percentile used for the market CF column: selected %ile in percentile mode, 50 in dollar mode. */
  const marketCFColumnPercentile = mode === 'percentile' ? effectivePercentileForDisplay : 50

  /** Market CF ($/wRVU) at the selected percentile per specialty (from market data). */
  const marketCFAtPercentileBySpecialty = useMemo((): Record<string, number> => {
    const out: Record<string, number> = {}
    const pct = marketCFColumnPercentile
    for (const s of specialties) {
      const match = matchMarketRow(
        { specialty: s } as ProviderRow,
        marketRows,
        batchSynonymMap
      )
      const m = match.marketRow
      if (m)
        out[s] = interpPercentile(pct, m.CF_25, m.CF_50, m.CF_75, m.CF_90)
    }
    return out
  }, [specialties, marketRows, batchSynonymMap, marketCFColumnPercentile])

  /** Current CF ($/wRVU) by specialty from scoped provider rows (mean of available values). */
  const currentCFBySpecialty = useMemo((): Record<string, number> => {
    const sumBySpecialty = new Map<string, number>()
    const countBySpecialty = new Map<string, number>()
    for (const p of scopedProviderRows) {
      const specialty = (p.specialty ?? '').trim()
      const currentCF = p.currentCF
      if (!specialty || currentCF == null || !Number.isFinite(currentCF)) continue
      sumBySpecialty.set(specialty, (sumBySpecialty.get(specialty) ?? 0) + Math.max(0, currentCF))
      countBySpecialty.set(specialty, (countBySpecialty.get(specialty) ?? 0) + 1)
    }
    const out: Record<string, number> = {}
    for (const [specialty, sum] of sumBySpecialty.entries()) {
      const count = countBySpecialty.get(specialty) ?? 0
      if (count > 0) out[specialty] = sum / count
    }
    return out
  }, [scopedProviderRows])

  /** Modeled CF ($/wRVU) by specialty, based on table override or "use for all". */
  const modeledCFBySpecialty = useMemo((): Record<string, number> => {
    const out: Record<string, number> = {}
    const defaultRaw = defaultForAll.trim()
    const defaultNum = defaultRaw === '' ? NaN : Number(defaultRaw)
    if (mode === 'dollar') {
      const defaultCF =
        defaultRaw !== '' && Number.isFinite(defaultNum) && defaultNum >= 0 ? defaultNum : 0
      for (const s of specialties) {
        const raw = specialtyValues[s]?.trim() ?? ''
        const num = raw === '' ? NaN : Number(raw)
        out[s] = raw !== '' && Number.isFinite(num) && num >= 0 ? num : defaultCF
      }
      return out
    }

    const defaultPct =
      defaultRaw !== '' && Number.isFinite(defaultNum) ? Math.max(0, Math.min(100, defaultNum)) : 40
    for (const s of specialties) {
      const raw = specialtyValues[s]?.trim() ?? ''
      const num = raw === '' ? NaN : Number(raw)
      const pct =
        raw !== '' && Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : defaultPct
      const sample = scopedProviderRows.find((p) => (p.specialty ?? '').trim() === s)
      if (!sample) continue
      const match = matchMarketRow(sample, marketRows, batchSynonymMap)
      const m = match.marketRow
      if (!m) continue
      out[s] = interpPercentile(pct, m.CF_25, m.CF_50, m.CF_75, m.CF_90)
    }
    return out
  }, [
    defaultForAll,
    mode,
    specialties,
    specialtyValues,
    scopedProviderRows,
    marketRows,
    batchSynonymMap,
  ])

  type CFChartItem = {
    specialty: string
    currentCF: number
    modeledCF: number
    marketCF: MarketCFBenchmarks
    cfPercentile: number
  }

  /** Chart data for every specialty in scope (current vs modeled on market scale). */
  const specialtyCFCharts = useMemo((): CFChartItem[] => {
    const out: CFChartItem[] = []
    const pct = mode === 'percentile' ? effectivePercentileForDisplay : 50
    for (const s of specialties) {
      const currentCF = currentCFBySpecialty[s]
      const modeledCF = modeledCFBySpecialty[s]
      if (currentCF == null || !Number.isFinite(currentCF) || modeledCF == null || !Number.isFinite(modeledCF))
        continue
      const sample = scopedProviderRows.find((p) => (p.specialty ?? '').trim() === s)
      if (!sample) continue
      const match = matchMarketRow(sample, marketRows, batchSynonymMap)
      const m = match.marketRow
      if (!m || m.CF_25 == null || m.CF_50 == null || m.CF_75 == null || m.CF_90 == null) continue
      out.push({
        specialty: s,
        currentCF,
        modeledCF,
        marketCF: { cf25: m.CF_25, cf50: m.CF_50, cf75: m.CF_75, cf90: m.CF_90 },
        cfPercentile: pct,
      })
    }
    return out
  }, [
    specialties,
    currentCFBySpecialty,
    modeledCFBySpecialty,
    scopedProviderRows,
    marketRows,
    batchSynonymMap,
    mode,
    effectivePercentileForDisplay,
  ])

  /** Lookup for market line per specialty (for table column). */
  const specialtyCFChartBySpecialty = useMemo(
    () => new Map(specialtyCFCharts.map((c) => [c.specialty, c])),
    [specialtyCFCharts]
  )

  const baseScenarioInputs = useMemo((): ScenarioInputs => {
    const base = { ...DEFAULT_SCENARIO_INPUTS, ...scenarioInputs }
    const defaultRaw = defaultForAll.trim()
    const defaultNum = defaultRaw === '' ? NaN : Number(defaultRaw)
    if (mode === 'dollar') {
      const overrideCF = defaultRaw !== '' && Number.isFinite(defaultNum) && defaultNum >= 0 ? defaultNum : 0
      return { ...base, cfSource: 'override' as const, overrideCF }
    }
    const proposedCFPercentile =
      defaultRaw !== '' && Number.isFinite(defaultNum) ? Math.max(0, Math.min(100, defaultNum)) : 40
    return { ...base, cfSource: 'target_percentile' as const, proposedCFPercentile }
  }, [mode, scenarioInputs, defaultForAll])

  const overrides = useMemo((): BatchOverrides | undefined => {
    const bySpecialty: Record<string, Partial<ScenarioInputs>> = {}
    for (const s of specialties) {
      const raw = specialtyValues[s]?.trim() ?? ''
      if (!raw) continue
      const num = Number(raw)
      if (!Number.isFinite(num)) continue
      if (mode === 'dollar') {
        if (num >= 0) bySpecialty[s] = { overrideCF: num }
      } else {
        const pct = Math.max(0, Math.min(100, num))
        bySpecialty[s] = { proposedCFPercentile: pct }
      }
    }
    if (Object.keys(bySpecialty).length === 0) return undefined
    return { bySpecialty }
  }, [specialties, specialtyValues, mode])

  const results = useMemo((): BatchResults | null => {
    if (scopedProviderRows.length === 0 || marketRows.length === 0) return null
    return runBatch(
      scopedProviderRows,
      marketRows,
      [{ id: 'custom-cf', name: 'Custom CF by specialty', scenarioInputs: baseScenarioInputs }],
      { synonymMap: batchSynonymMap, overrides }
    )
  }, [scopedProviderRows, marketRows, baseScenarioInputs, batchSynonymMap, overrides])

  const specialtyOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => r.specialty?.trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => (a ?? '').localeCompare(b ?? ''))
  }, [results?.rows])

  const filteredSpecialtyOptions = useMemo(() => {
    if (!specialtySearch.trim()) return specialtyOptions
    const q = specialtySearch.trim().toLowerCase()
    return specialtyOptions.filter((s) => (s ?? '').toLowerCase().includes(q))
  }, [specialtyOptions, specialtySearch])

  const filteredRows = useMemo((): BatchRowResult[] => {
    if (!results?.rows?.length) return []
    let out = results.rows
    if (specialtyFilter !== 'all') {
      out = out.filter((r) => (r.specialty?.trim() ?? '') === specialtyFilter)
    }
    if (providerSearch.trim()) {
      const q = providerSearch.trim().toLowerCase()
      out = out.filter(
        (r) =>
          (r.providerName ?? '').toLowerCase().includes(q) ||
          (r.providerId ?? '').toString().toLowerCase().includes(q)
      )
    }
    if (payVsProdFilter !== 'all') {
      out = out.filter((r) => {
        const gap = r.results?.alignmentGapModeled
        if (gap == null || !Number.isFinite(gap)) return false
        const interp = getGapInterpretation(gap)
        return interp === payVsProdFilter
      })
    }
    return out
  }, [results?.rows, specialtyFilter, providerSearch, payVsProdFilter])

  const setSpecialtyValue = useCallback((specialty: string, value: string) => {
    setSpecialtyValues((prev) => ({ ...prev, [specialty]: value }))
  }, [])

  const applySavedScenarioConfig = useCallback((config: SavedBatchScenarioConfig) => {
    const inputs = config.scenarioInputs
    const nextMode: CustomCFMode = inputs.cfSource === 'override' ? 'dollar' : 'percentile'
    setMode(nextMode)
    if (nextMode === 'dollar' && inputs.overrideCF != null && Number.isFinite(inputs.overrideCF)) {
      setDefaultForAll(String(inputs.overrideCF))
    } else if (nextMode === 'percentile' && inputs.proposedCFPercentile != null && Number.isFinite(inputs.proposedCFPercentile)) {
      setDefaultForAll(String(inputs.proposedCFPercentile))
    } else {
      setDefaultForAll('')
    }
    const bySpec = config.overrides?.bySpecialty ?? {}
    const nextValues: Record<string, string> = {}
    for (const [spec, partial] of Object.entries(bySpec)) {
      if (partial.overrideCF != null && Number.isFinite(partial.overrideCF)) {
        nextValues[spec] = String(partial.overrideCF)
      } else if (partial.proposedCFPercentile != null && Number.isFinite(partial.proposedCFPercentile)) {
        nextValues[spec] = String(partial.proposedCFPercentile)
      }
    }
    setSpecialtyValues(nextValues)
    setSpecialtyScope(config.selectedSpecialties ?? [])
  }, [])

  /** Roll-up by specialty for the summary drawer (uses filtered rows so it respects filters). */
  const summaryBySpecialty = useMemo(() => {
    const rows = filteredRows
    if (!rows.length) return []
    const bySpec = new Map<
      string,
      {
        providerCount: number
        sumCurrentTCC: number
        sumModeledTCC: number
        sumChangeTCC: number
        sumIncentive: number
        sumTccPercentile: number
        countTccPercentile: number
        sumModeledTCCPercentile: number
        countModeledTCCPercentile: number
        sumWrvuPercentile: number
        countWrvuPercentile: number
      }
    >()
    for (const r of rows) {
      const spec = (r.specialty ?? '').trim() || '—'
      const res = r.results
      let entry = bySpec.get(spec)
      if (!entry) {
        entry = {
          providerCount: 0,
          sumCurrentTCC: 0,
          sumModeledTCC: 0,
          sumChangeTCC: 0,
          sumIncentive: 0,
          sumTccPercentile: 0,
          countTccPercentile: 0,
          sumModeledTCCPercentile: 0,
          countModeledTCCPercentile: 0,
          sumWrvuPercentile: 0,
          countWrvuPercentile: 0,
        }
        bySpec.set(spec, entry)
      }
      entry.providerCount += 1
      if (res) {
        if (res.currentTCC != null && Number.isFinite(res.currentTCC))
          entry.sumCurrentTCC += Math.max(0, res.currentTCC)
        if (res.modeledTCC != null && Number.isFinite(res.modeledTCC))
          entry.sumModeledTCC += Math.max(0, res.modeledTCC)
        if (res.changeInTCC != null && Number.isFinite(res.changeInTCC))
          entry.sumChangeTCC += res.changeInTCC
        if (res.annualIncentive != null && Number.isFinite(res.annualIncentive))
          entry.sumIncentive += res.annualIncentive
        if (res.tccPercentile != null && Number.isFinite(res.tccPercentile)) {
          entry.sumTccPercentile += res.tccPercentile
          entry.countTccPercentile += 1
        }
        if (res.modeledTCCPercentile != null && Number.isFinite(res.modeledTCCPercentile)) {
          entry.sumModeledTCCPercentile += res.modeledTCCPercentile
          entry.countModeledTCCPercentile += 1
        }
        if (res.wrvuPercentile != null && Number.isFinite(res.wrvuPercentile)) {
          entry.sumWrvuPercentile += res.wrvuPercentile
          entry.countWrvuPercentile += 1
        }
      }
    }
    return Array.from(bySpec.entries())
      .map(([specialty, e]) => ({
        specialty,
        providerCount: e.providerCount,
        sumCurrentTCC: e.sumCurrentTCC,
        sumModeledTCC: e.sumModeledTCC,
        sumChangeTCC: e.sumChangeTCC,
        sumIncentive: e.sumIncentive,
        avgTccPercentile:
          e.countTccPercentile > 0 ? e.sumTccPercentile / e.countTccPercentile : undefined,
        avgModeledTCCPercentile:
          e.countModeledTCCPercentile > 0
            ? e.sumModeledTCCPercentile / e.countModeledTCCPercentile
            : undefined,
        avgWrvuPercentile:
          e.countWrvuPercentile > 0 ? e.sumWrvuPercentile / e.countWrvuPercentile : undefined,
      }))
      .sort((a, b) => a.specialty.localeCompare(b.specialty))
  }, [filteredRows])

  const summaryTotals = useMemo(() => {
    const specialtyCount = summaryBySpecialty.length
    const providerCount = filteredRows.length
    let totalCurrentTCC = 0
    let totalModeledTCC = 0
    let totalDeltaTCC = 0
    let totalIncentive = 0
    for (const row of summaryBySpecialty) {
      totalCurrentTCC += row.sumCurrentTCC
      totalModeledTCC += row.sumModeledTCC
      totalDeltaTCC += row.sumChangeTCC
      totalIncentive += row.sumIncentive
    }
    return {
      specialtyCount,
      providerCount,
      totalCurrentTCC,
      totalModeledTCC,
      totalDeltaTCC,
      totalIncentive,
    }
  }, [summaryBySpecialty, filteredRows.length])

  const reportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const handlePrint = () => {
    window.print()
  }

  const handleProviderClick = useCallback(
    (row: BatchRowResult) => {
      const specialty = (row.specialty ?? '').trim()
      if (!specialty || !providerRows.length || !marketRows.length) return
      const details = getImputedVsMarketProviderDetail(
        specialty,
        providerRows,
        marketRows,
        batchSynonymMap,
        DEFAULT_IMPUTED_VS_MARKET_CONFIG
      )
      const match = details.find(
        (p) =>
          String(p.providerId) === String(row.providerId) ||
          (p.providerName && row.providerName && p.providerName === row.providerName)
      )
      setDrawerProvider(match ?? null)
      setDrawerSpecialtyLabel(match ? specialty : undefined)
    },
    [providerRows, marketRows, batchSynonymMap]
  )

  const handleSaveScenario = useCallback(
    (name: string) => {
      if (!onSaveScenarioConfig) return
      onSaveScenarioConfig({
        name,
        scenarioInputs: baseScenarioInputs,
        overrides,
        selectedSpecialties: [...specialtyScope],
        selectedProviderIds: scopedProviderRows
          .map((p) => String(p.providerId ?? p.providerName ?? '').trim())
          .filter(Boolean),
        runBaseScenarioOnly: true,
      })
    },
    [onSaveScenarioConfig, baseScenarioInputs, overrides, specialtyScope, scopedProviderRows]
  )

  if (providerRows.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Custom CF by specialty
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Import provider and market data to use this report.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const exportResults: BatchResults | null = results
    ? { ...results, rows: filteredRows }
    : null

  return (
    <div className="space-y-4 report-print">
      {/* Title row then action row — match CF Optimizer / Compare scenarios */}
      <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
        Custom CF by specialty
      </SectionTitleWithIcon>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground -mt-4">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Confidential — compensation planning
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-2 no-print"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {results && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSummaryBySpecialtyDrawerOpen(true)}
              className="gap-2 no-print text-primary hover:text-primary hover:bg-primary/10"
              aria-label="Open summary by specialty"
            >
              <BarChart2 className="size-4" />
              Summary by specialty
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider>
            {savedBatchScenarioConfigs.length > 0 && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="no-print"
                        aria-label={`Saved scenarios (${savedBatchScenarioConfigs.length})`}
                      >
                        <FolderOpen className="size-4" />
                        <ChevronDown className="size-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Saved scenarios ({savedBatchScenarioConfigs.length})
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
                  {[...savedBatchScenarioConfigs]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((config) => (
                      <DropdownMenuItem
                        key={config.id}
                        onSelect={(e) => {
                          e.preventDefault()
                          applySavedScenarioConfig(config)
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{config.name}</span>
                        {onDeleteBatchScenarioConfig && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onDeleteBatchScenarioConfig(config.id)
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                            aria-label={`Delete ${config.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onSaveScenarioConfig && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveScenarioDialogOpen(true)}
                    className="no-print"
                    aria-label="Save scenario"
                  >
                    <Save className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Save scenario</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
          {exportResults && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 no-print" aria-label="Export data">
                  <FileDown className="size-4" />
                  Export
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Export / print</DropdownMenuLabel>
                <DropdownMenuItem onClick={handlePrint} className="gap-2">
                  <Printer className="size-4" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadBatchResultsCSV(exportResults)} className="gap-2">
                  <FileDown className="size-4" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportBatchResultsXLSX(exportResults)} className="gap-2">
                  <FileSpreadsheet className="size-4" />
                  Export XLSX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Input: mode + default for all + per-specialty overrides (collapsible) */}
      <Card className="no-print mt-8">
        <details className="group [&::-webkit-details-marker]:hidden" open>
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <CardHeader className="[&_.summary-highlight]:flex [&_.summary-highlight]:items-center [&_.summary-highlight]:gap-2">
              <p className="text-sm font-medium text-foreground summary-highlight flex items-center gap-2">
                Set conversion factor by specialty
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </p>
            </CardHeader>
          </summary>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 flex-1 min-w-0">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">Specialty</Label>
                <DropdownMenu onOpenChange={(open) => !open && setSpecialtyScopeSearch('')}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
                    >
                      <span className="truncate">{specialtyScopeLabel}</span>
                      <ChevronDown className="size-4 opacity-50 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
                    onCloseAutoFocus={(e: Event) => e.preventDefault()}
                  >
                    <Command shouldFilter={false} className="rounded-none border-0">
                      <CommandInput
                        placeholder="Search specialties…"
                        value={specialtyScopeSearch}
                        onValueChange={setSpecialtyScopeSearch}
                        className="h-9"
                      />
                    </Command>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      <DropdownMenuLabel>Specialty</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={specialtyScope.length === 0}
                        onSelect={(e) => {
                          e.preventDefault()
                        }}
                        onCheckedChange={(checked) => {
                          if (checked) setSpecialtyScope([])
                        }}
                      >
                        All specialties
                      </DropdownMenuCheckboxItem>
                      {filteredSpecialtyScopeOptions.length === 0 ? (
                        <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                      ) : (
                        filteredSpecialtyScopeOptions.map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt}
                            checked={specialtyScope.includes(opt)}
                            onSelect={(e) => {
                              e.preventDefault()
                            }}
                            onCheckedChange={() => toggleSpecialtyScope(opt)}
                          >
                            {opt}
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">Provider type</Label>
                <DropdownMenu onOpenChange={(open) => !open && setProviderTypeScopeSearch('')}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
                    >
                      <span className="truncate">{providerTypeScopeLabel}</span>
                      <ChevronDown className="size-4 opacity-50 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
                    onCloseAutoFocus={(e: Event) => e.preventDefault()}
                  >
                    <Command shouldFilter={false} className="rounded-none border-0">
                      <CommandInput
                        placeholder="Search provider types…"
                        value={providerTypeScopeSearch}
                        onValueChange={setProviderTypeScopeSearch}
                        className="h-9"
                      />
                    </Command>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      <DropdownMenuLabel>Provider type</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={providerTypeScope.length === 0}
                        onSelect={(e) => {
                          e.preventDefault()
                        }}
                        onCheckedChange={(checked) => {
                          if (checked) setProviderTypeScope([])
                        }}
                      >
                        All provider types
                      </DropdownMenuCheckboxItem>
                      {filteredProviderTypeScopeOptions.length === 0 ? (
                        <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                      ) : (
                        filteredProviderTypeScopeOptions.map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt}
                            checked={providerTypeScope.includes(opt)}
                            onSelect={(e) => {
                              e.preventDefault()
                            }}
                            onCheckedChange={() => toggleProviderTypeScope(opt)}
                          >
                            {opt}
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">Compensation type</Label>
                <DropdownMenu onOpenChange={(open) => !open && setCompTypeScopeSearch('')}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
                    >
                      <span className="truncate">{compTypeScopeLabel}</span>
                      <ChevronDown className="size-4 opacity-50 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
                    onCloseAutoFocus={(e: Event) => e.preventDefault()}
                  >
                    <Command shouldFilter={false} className="rounded-none border-0">
                      <CommandInput
                        placeholder="Search compensation types…"
                        value={compTypeScopeSearch}
                        onValueChange={setCompTypeScopeSearch}
                        className="h-9"
                      />
                    </Command>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      <DropdownMenuLabel>Compensation type</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={compTypeScope.length === 0}
                        onSelect={(e) => {
                          e.preventDefault()
                        }}
                        onCheckedChange={(checked) => {
                          if (checked) setCompTypeScope([])
                        }}
                      >
                        All compensation types
                      </DropdownMenuCheckboxItem>
                      {filteredCompTypeScopeOptions.length === 0 ? (
                        <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                      ) : (
                        filteredCompTypeScopeOptions.map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt}
                            checked={compTypeScope.includes(opt)}
                            onSelect={(e) => {
                              e.preventDefault()
                            }}
                            onCheckedChange={() => toggleCompTypeScope(opt)}
                          >
                            {opt}
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">CF input mode</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as CustomCFMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentile">Market percentile</SelectItem>
                    <SelectItem value="dollar">Dollar ($/wRVU)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">Use for all specialties</Label>
                <Input
                  type="number"
                  min={mode === 'dollar' ? 0 : 0}
                  max={mode === 'percentile' ? 100 : undefined}
                  step={mode === 'dollar' ? 0.01 : 1}
                  placeholder={mode === 'percentile' ? 'Percentile (default: 40th)' : 'e.g. 44.00 (default: $0)'}
                  value={defaultForAll}
                  onChange={(e) => setDefaultForAll(e.target.value)}
                  className="h-9 w-full"
                  aria-label="Value applied to all specialties when set"
                />
              </div>
            </div>
            {(specialtyScope.length > 0 || providerTypeScope.length > 0 || compTypeScope.length > 0) && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSpecialtyScope([])
                        setProviderTypeScope([])
                        setCompTypeScope([])
                        setSpecialtyScopeSearch('')
                        setProviderTypeScopeSearch('')
                        setCompTypeScopeSearch('')
                      }}
                      aria-label="Clear filters"
                    >
                      <Eraser className="size-4" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear filters</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            </div>
            <p className="text-xs text-muted-foreground">
              Scoped providers for run: {scopedProviderRows.length.toLocaleString()}
            </p>
            {scopedProviderRows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No providers match the selected provider type / compensation type scope.
              </p>
            )}
          </div>
          {specialties.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No specialties with market data. Load market data that matches your provider specialties.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Override per specialty (optional)</p>
              <div className="w-full overflow-auto rounded-md border border-border min-h-0 max-h-[50vh]">
                <Table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground">
                    <TableRow>
                      <TableHead className="min-w-[180px] px-3 py-2.5">Specialty</TableHead>
                      <TableHead className="min-w-[100px] px-3 py-2.5 text-muted-foreground">
                        Market CF at {marketCFColumnPercentile}th ($)
                      </TableHead>
                      <TableHead className="min-w-[100px] px-3 py-2.5 text-muted-foreground">
                        Current CF ($)
                      </TableHead>
                      <TableHead className="min-w-[120px] px-3 py-2.5">
                        {mode === 'dollar' ? 'CF ($/wRVU)' : 'CF (%ile)'}
                      </TableHead>
                      <TableHead className="min-w-[100px] px-3 py-2.5 text-muted-foreground">
                        Δ CF ($)
                      </TableHead>
                      <TableHead className="min-w-[140px] px-3 py-2.5 text-muted-foreground">
                        Market line
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specialties.map((s, idx) => (
                      <TableRow key={s} className={cn(idx % 2 === 1 && 'bg-muted/30')}>
                        <TableCell className="font-medium px-3 py-2.5">{s}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums text-sm px-3 py-2.5">
                          {marketCFAtPercentileBySpecialty[s] != null
                            ? formatCurrency(Number(marketCFAtPercentileBySpecialty[s]), { decimals: 2 })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums text-sm px-3 py-2.5">
                          {currentCFBySpecialty[s] != null
                            ? formatCurrency(Number(currentCFBySpecialty[s]), { decimals: 2 })
                            : '—'}
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <Input
                            type="number"
                            min={mode === 'dollar' ? 0 : 0}
                            max={mode === 'percentile' ? 100 : undefined}
                            step={mode === 'dollar' ? 0.01 : 1}
                            placeholder={
                              (() => {
                                const n = Number(defaultForAll.trim())
                                const valid = defaultForAll.trim() !== '' && Number.isFinite(n)
                                if (valid)
                                  return `uses ${mode === 'percentile' ? Math.max(0, Math.min(100, n)) : (n >= 0 ? n : 0)}`
                                return mode === 'dollar' ? 'e.g. 44' : 'e.g. 50'
                              })()
                            }
                            value={specialtyValues[s] ?? ''}
                            onChange={(e) => setSpecialtyValue(s, e.target.value)}
                            className="h-9 w-full max-w-[140px]"
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            'tabular-nums text-sm px-3 py-2.5',
                            currentCFBySpecialty[s] == null || modeledCFBySpecialty[s] == null
                              ? 'text-muted-foreground'
                              : modeledCFBySpecialty[s] - currentCFBySpecialty[s] > 0
                                ? 'value-positive'
                                : modeledCFBySpecialty[s] - currentCFBySpecialty[s] < 0
                                  ? 'value-negative'
                                  : 'text-muted-foreground'
                          )}
                        >
                          {currentCFBySpecialty[s] != null && modeledCFBySpecialty[s] != null
                            ? (() => {
                                const delta = modeledCFBySpecialty[s] - currentCFBySpecialty[s]
                                const sign = delta > 0 ? '+' : ''
                                return `${sign}${formatCurrency(delta, { decimals: 2 })}`
                              })()
                            : '—'}
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          {(() => {
                            const chart = specialtyCFChartBySpecialty.get(s)
                            return chart ? (
                              <MarketCFLine
                                currentCF={chart.currentCF}
                                recommendedCF={chart.modeledCF}
                                marketCF={chart.marketCF}
                              />
                            ) : (
                              <span className="text-muted-foreground text-xs">No market</span>
                            )
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
        </details>
      </Card>

      <SaveScenarioDialog
        open={saveScenarioDialogOpen}
        onOpenChange={setSaveScenarioDialogOpen}
        onSave={handleSaveScenario}
      />

      {results ? (
        <>
          <Card>
          <CardHeader className="space-y-2">
            <p className="text-sm font-medium text-foreground">TCC & wRVU results</p>
            <p className="text-xs text-muted-foreground">
              Mode: {mode === 'dollar' ? '$/wRVU' : 'Percentile'}. Generated {reportDate}.{' '}
              {filteredRows.length} row(s)
              {filteredRows.length !== results.rows.length ? ` of ${results.rows.length}` : ''}.
            </p>
            <p className="text-xs text-muted-foreground">
              {specialties.length} specialties, {results.rows.length} providers in scope. Modeled scenario uses “use
              for all” when set, with table overrides per specialty where entered.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {results.rows.length > 0 && (
              <div className="sticky top-0 z-20 rounded-lg border border-border/70 bg-background/95 p-3 backdrop-blur-sm">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search
                      className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      aria-hidden
                    />
                    <Label className="sr-only">Search provider name or ID</Label>
                    <Input
                      placeholder="Search specialty or provider..."
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      className="bg-white pl-8 dark:bg-background h-9 w-full"
                    />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground">Specialty</Label>
                    <DropdownMenu onOpenChange={(open) => !open && setSpecialtySearch('')}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full min-w-0 justify-between bg-white dark:bg-background h-9 font-normal"
                        >
                          <span className="truncate">
                            {specialtyFilter === 'all' ? 'All specialties' : specialtyFilter || '—'}
                          </span>
                          <ChevronDown className="size-4 opacity-50 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-[280px] overflow-hidden p-0 w-[var(--radix-dropdown-menu-trigger-width)]"
                        onCloseAutoFocus={(e: Event) => e.preventDefault()}
                      >
                        <Command shouldFilter={false} className="rounded-none border-0">
                          <CommandInput
                            placeholder="Search specialties…"
                            value={specialtySearch}
                            onValueChange={setSpecialtySearch}
                            className="h-9"
                          />
                        </Command>
                        <div className="max-h-[200px] overflow-y-auto p-1">
                          <DropdownMenuLabel>Specialty</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setSpecialtyFilter('all')}>
                            All specialties
                          </DropdownMenuItem>
                          {filteredSpecialtyOptions.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">No match.</div>
                          ) : (
                            filteredSpecialtyOptions.map((s) => (
                              <DropdownMenuItem
                                key={s ?? ''}
                                onSelect={() => setSpecialtyFilter(s ?? '')}
                              >
                                {s ?? '—'}
                              </DropdownMenuItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-[180px]">
                    <Label className="text-xs text-muted-foreground">Pay vs productivity</Label>
                    <Select value={payVsProdFilter} onValueChange={setPayVsProdFilter}>
                      <SelectTrigger className="w-full min-w-0 bg-white dark:bg-background h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="aligned">Aligned</SelectItem>
                        <SelectItem value="overpaid">Pay above productivity</SelectItem>
                        <SelectItem value="underpaid">Underpaid vs productivity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(specialtyFilter !== 'all' || providerSearch.trim() || payVsProdFilter !== 'all') && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSpecialtyFilter('all')
                              setProviderSearch('')
                              setPayVsProdFilter('all')
                            }}
                            aria-label="Clear filters"
                          >
                            <Eraser className="size-4" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Clear filters</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            )}
            {(specialtyFilter !== 'all' || providerSearch.trim() || payVsProdFilter !== 'all') &&
              filteredRows.length > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Showing {filteredRows.length} of {results.rows.length} providers.
                </p>
              )}
            {(specialtyFilter !== 'all' || providerSearch.trim() || payVsProdFilter !== 'all') &&
            filteredRows.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No providers match your search or filters. Try changing the filters.
              </p>
            ) : (
              <TccWrvuSummaryTable
                key={`results-${reportDate}-${results.rows.length}`}
                rows={filteredRows}
                showScenarioName={true}
                onProviderClick={handleProviderClick}
              />
            )}
          </CardContent>
        </Card>

          <Sheet open={summaryBySpecialtyDrawerOpen} onOpenChange={setSummaryBySpecialtyDrawerOpen}>
            <ResizableSheetContent
              side="right"
              defaultWidth={820}
              minWidth={560}
              maxWidth={1280}
              className="flex w-full flex-col gap-6 overflow-hidden px-6 py-5 border-border"
            >
              <SheetHeader className="shrink-0 px-0 pt-0 pb-2 border-b border-border gap-2">
                <SheetTitle className="text-xl font-semibold tracking-tight text-foreground">
                  Summary by specialty
                </SheetTitle>
                <SheetDescription>
                  Roll-up of TCC and modeled TCC by specialty for this run.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 min-h-0 flex-col gap-6 overflow-y-auto">
                <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                  <p className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                    Roll-up metrics
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border border-border/60 bg-background p-3">
                      <p className="text-xs text-muted-foreground">Specialties</p>
                      <p className="text-lg font-semibold tabular-nums text-primary">
                        {summaryTotals.specialtyCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {summaryTotals.providerCount} included provider(s)
                      </p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background p-3">
                      <p className="text-xs text-muted-foreground">Total modeled TCC</p>
                      <p className="text-lg font-semibold tabular-nums text-primary">
                        {formatCurrency(summaryTotals.totalModeledTCC, { decimals: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current: {formatCurrency(summaryTotals.totalCurrentTCC, { decimals: 2 })}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background p-3">
                      <p className="text-xs text-muted-foreground">Total TCC change</p>
                      <p className={cn(
                        'text-lg font-semibold tabular-nums',
                        summaryTotals.totalDeltaTCC >= 0 ? 'value-positive' : 'value-negative'
                      )}>
                        {summaryTotals.totalDeltaTCC >= 0 ? '+' : ''}
                        {formatCurrency(summaryTotals.totalDeltaTCC, { decimals: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Modeled − current. Negative = scenario pays less (e.g. lower CF or below wRVU threshold, so incentive is $0).
                      </p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background p-3 border-primary/30">
                      <p className="text-xs text-muted-foreground">Total wRVU incentive</p>
                      <p className="text-lg font-semibold tabular-nums text-primary">
                        {formatCurrency(summaryTotals.totalIncentive, { decimals: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sum of productivity incentive at modeled CF across all specialties.
                      </p>
                    </div>
                  </div>
                </section>

                {filteredRows.length !== results.rows.length && results && (
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Based on current filters: {filteredRows.length} of {results.rows.length} providers.
                    </p>
                  </div>
                )}
                {summaryBySpecialty.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data to summarize.</p>
                ) : (
                  <section className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                    <p className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/60 pb-2 mb-3">
                      Specialty detail
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Numbers in <span className="font-medium text-primary">purple</span> are key metrics (e.g. incentive totals).
                    </p>
                    <div className="flex-1 min-h-[240px] max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-background">
                      <Table className="w-full min-w-[980px] caption-bottom text-sm border-collapse">
                        <TableHeader className="sticky top-0 z-20 border-b border-border/60 bg-muted [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-muted [&_th]:shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:text-foreground">
                        <TableRow>
                          <TableHead className="min-w-[140px] px-3 py-2.5">Specialty</TableHead>
                          <TableHead className="w-[72px] px-3 py-2.5 text-right">Providers</TableHead>
                          <TableHead className="min-w-[90px] px-3 py-2.5 text-right">Current TCC</TableHead>
                          <TableHead className="min-w-[90px] px-3 py-2.5 text-right">Modeled TCC</TableHead>
                          <TableHead className="min-w-[72px] px-3 py-2.5 text-right">Δ TCC</TableHead>
                          <TableHead className="min-w-[90px] px-3 py-2.5 text-right" title="Sum of productivity (wRVU) incentive dollars at modeled CF for providers in this specialty">Incentive</TableHead>
                          <TableHead className="min-w-[72px] px-3 py-2.5 text-right" title="Average current TCC percentile vs market for providers in this specialty">Avg TCC %ile</TableHead>
                          <TableHead className="min-w-[80px] px-3 py-2.5 text-right" title="Average modeled TCC percentile vs market—where this scenario places the group’s pay vs market, on average">Avg Modeled %ile</TableHead>
                          <TableHead className="min-w-[72px] px-3 py-2.5 text-right" title="Average wRVU productivity percentile vs market for providers in this specialty">Avg wRVU %ile</TableHead>
                        </TableRow>
                      </TableHeader>
                        <TableBody>
                          {summaryBySpecialty.map((row, idx) => (
                            <TableRow
                              key={row.specialty}
                              className={cn(idx % 2 === 1 && 'bg-muted/30', 'hover:bg-muted/40')}
                            >
                            <TableCell className="font-medium px-3 py-2.5">{row.specialty}</TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5">
                              {row.providerCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5">
                              {formatCurrency(row.sumCurrentTCC, { decimals: 2 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5">
                              {formatCurrency(row.sumModeledTCC, { decimals: 2 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5">
                              {row.sumChangeTCC >= 0 ? '+' : ''}
                              {formatCurrency(row.sumChangeTCC, { decimals: 2 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5 font-medium text-primary">
                              {formatCurrency(row.sumIncentive, { decimals: 2 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">
                              {row.avgTccPercentile != null ? row.avgTccPercentile.toFixed(1) : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">
                              {row.avgModeledTCCPercentile != null
                                ? row.avgModeledTCCPercentile.toFixed(1)
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2.5 text-muted-foreground">
                              {row.avgWrvuPercentile != null ? row.avgWrvuPercentile.toFixed(1) : '—'}
                            </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        How to read this summary
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The table rolls up TCC & wRVU results from your current run by specialty. Current TCC and Modeled TCC are summed totals per specialty; Δ TCC is modeled minus current (negative = scenario pays less, e.g. lower CF or below wRVU threshold). Incentive is the sum of productivity (wRVU) incentive dollars at the modeled CF for providers in that specialty.
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground leading-relaxed list-none pl-0">
                        <li><strong className="text-foreground/90">Avg TCC %ile:</strong> Average, across providers in that specialty, of where each provider’s <em>current</em> total compensation (per FTE) falls in the market distribution (e.g. 56 = 56th percentile vs market).</li>
                        <li><strong className="text-foreground/90">Avg Modeled %ile:</strong> Average, across providers in that specialty, of where each provider’s <em>modeled</em> total compensation (per FTE) would fall in the market. So it’s “where does this scenario put the group’s pay vs market, on average?”—higher means the scenario pays more relative to market.</li>
                        <li><strong className="text-foreground/90">Avg wRVU %ile:</strong> Average wRVU productivity percentile vs market for providers in that specialty (volume, not pay).</li>
                      </ul>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        Use this to compare impact by specialty before exporting or saving the scenario.
                      </p>
                    </div>
                  </section>
                )}
              </div>
            </ResizableSheetContent>
          </Sheet>
        </>
      ) : null}

      <MarketPositioningCalculationDrawer
        open={drawerProvider != null}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerProvider(null)
            setDrawerSpecialtyLabel(undefined)
          }
        }}
        provider={drawerProvider}
        specialtyLabel={drawerSpecialtyLabel}
      />

      {marketRows.length === 0 && providerRows.length > 0 && (
        <p className="text-muted-foreground text-sm">Import market data to compute percentiles.</p>
      )}
    </div>
  )
}
