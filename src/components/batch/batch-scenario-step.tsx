import { useRef, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Play, Loader2, AlertCircle, Users, Target, Plus, Trash2, Sliders, ChevronDown, Link2, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BatchScenarioInline } from '@/components/batch/batch-scenario-inline'
import { ScenarioControls } from '@/components/scenario-controls'
import { Input } from '@/components/ui/input'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { BatchOverrides, SynonymMap } from '@/types/batch'
import type { BatchWorkerRunPayload, BatchWorkerOutMessage } from '@/workers/batch-worker'

interface BatchScenarioStepProps {
  providerRows: ProviderRow[]
  marketRows: import('@/types/market').MarketRow[]
  scenarioInputs: ScenarioInputs
  setScenarioInputs: (inputs: Partial<ScenarioInputs>) => void
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  onRunComplete: (results: import('@/types/batch').BatchResults) => void
  /** When provided, show a link to edit synonyms on the Upload step. */
  onNavigateToUpload?: () => void
}

export function BatchScenarioStep({
  providerRows,
  marketRows,
  scenarioInputs,
  setScenarioInputs,
  savedScenarios,
  batchSynonymMap,
  onRunComplete,
  onNavigateToUpload,
}: BatchScenarioStepProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState({ processed: 0, total: 1, elapsedMs: 0 })
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const providerSpecialties = useMemo(() => {
    const set = new Set(providerRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [providerRows])

  /** Empty = all specialties. */
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  /** Empty = all providers (after specialty filter). */
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([])

  /** Override rows: keyed by specialty (raw string, matches provider.specialty). */
  const [specialtyOverrides, setSpecialtyOverrides] = useState<
    { specialty: string; proposedCFPercentile: string; overrideCF: string; psqPercent: string }[]
  >([])
  /** Override rows: keyed by providerId (same as runBatch). */
  const [providerOverrides, setProviderOverrides] = useState<
    { providerId: string; providerLabel: string; proposedCFPercentile: string; overrideCF: string; psqPercent: string }[]
  >([])

  const providersAfterSpecialtyFilter = useMemo(() => {
    if (selectedSpecialties.length === 0) return providerRows
    const set = new Set(selectedSpecialties)
    return providerRows.filter((p) => set.has((p.specialty ?? '').trim()))
  }, [providerRows, selectedSpecialties])

  const providersToRun = useMemo(() => {
    if (selectedProviderIds.length === 0) return providersAfterSpecialtyFilter
    const set = new Set(selectedProviderIds)
    return providersAfterSpecialtyFilter.filter((p) =>
      set.has((p.providerId ?? p.providerName ?? '').toString())
    )
  }, [providersAfterSpecialtyFilter, selectedProviderIds])

  const batchOverrides = useMemo((): BatchOverrides | undefined => {
    const bySpecialty: Record<string, Partial<ScenarioInputs>> = {}
    for (const row of specialtyOverrides) {
      const pct = row.proposedCFPercentile.trim() === '' ? undefined : Number(row.proposedCFPercentile)
      const cf = row.overrideCF.trim() === '' ? undefined : Number(row.overrideCF)
      const psq = row.psqPercent.trim() === '' ? undefined : Number(row.psqPercent)
      if (pct === undefined && cf === undefined && psq === undefined) continue
      if (!row.specialty.trim()) continue
      bySpecialty[row.specialty] = {}
      if (pct !== undefined && !Number.isNaN(pct)) bySpecialty[row.specialty].proposedCFPercentile = pct
      if (cf !== undefined && !Number.isNaN(cf)) bySpecialty[row.specialty].overrideCF = cf
      if (psq !== undefined && !Number.isNaN(psq)) bySpecialty[row.specialty].psqPercent = psq
    }
    const byProviderId: Record<string, Partial<ScenarioInputs>> = {}
    for (const row of providerOverrides) {
      const pct = row.proposedCFPercentile.trim() === '' ? undefined : Number(row.proposedCFPercentile)
      const cf = row.overrideCF.trim() === '' ? undefined : Number(row.overrideCF)
      const psq = row.psqPercent.trim() === '' ? undefined : Number(row.psqPercent)
      if (pct === undefined && cf === undefined && psq === undefined) continue
      if (!row.providerId.trim()) continue
      byProviderId[row.providerId] = {}
      if (pct !== undefined && !Number.isNaN(pct)) byProviderId[row.providerId].proposedCFPercentile = pct
      if (cf !== undefined && !Number.isNaN(cf)) byProviderId[row.providerId].overrideCF = cf
      if (psq !== undefined && !Number.isNaN(psq)) byProviderId[row.providerId].psqPercent = psq
    }
    if (Object.keys(bySpecialty).length === 0 && Object.keys(byProviderId).length === 0) return undefined
    return { bySpecialty: Object.keys(bySpecialty).length ? bySpecialty : undefined, byProviderId: Object.keys(byProviderId).length ? byProviderId : undefined }
  }, [specialtyOverrides, providerOverrides])

  const runBatch = useCallback(() => {
    if (providerRows.length === 0 || marketRows.length === 0) {
      setError('Upload provider and market data first.')
      return
    }
    if (providersToRun.length === 0) {
      setError('No providers match the selected specialties and/or providers. Clear filters or change selection.')
      return
    }
    setError(null)
    setIsRunning(true)
    setProgress({ processed: 0, total: providersToRun.length, elapsedMs: 0 })

    const scenarios = [
      { id: 'current', name: 'Current', scenarioInputs: { ...scenarioInputs } },
      ...savedScenarios.map((s) => ({
        id: s.id,
        name: s.name,
        scenarioInputs: s.scenarioInputs,
      })),
    ]
    const payload: BatchWorkerRunPayload = {
      type: 'run',
      providers: providersToRun,
      marketRows,
      scenarios,
      synonymMap: batchSynonymMap,
      chunkSize: 200,
      overrides: batchOverrides,
    }

    const worker = new Worker(
      new URL('../../workers/batch-worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<BatchWorkerOutMessage>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setProgress({
          processed: msg.processed,
          total: msg.total,
          elapsedMs: msg.elapsedMs,
        })
      } else if (msg.type === 'done') {
        worker.terminate()
        workerRef.current = null
        setIsRunning(false)
        onRunComplete(msg.results)
      }
    }
    worker.onerror = () => {
      setError('Batch worker failed.')
      worker.terminate()
      workerRef.current = null
      setIsRunning(false)
    }
    worker.postMessage(payload)
  }, [
    providersToRun,
    marketRows,
    scenarioInputs,
    savedScenarios,
    batchSynonymMap,
    batchOverrides,
    onRunComplete,
    providerRows.length,
  ])

  const total = Math.max(1, progress.total)
  const pct = Math.min(100, Math.round((100 * progress.processed) / total))
  const overrideCount = specialtyOverrides.length + providerOverrides.length

  const [activeStep, setActiveStep] = useState<'scenario' | 'overrides' | 'run'>('scenario')

  const scrollToSection = (id: 'batch-scenario' | 'batch-overrides' | 'batch-run') => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveStep(id === 'batch-scenario' ? 'scenario' : id === 'batch-overrides' ? 'overrides' : 'run')
  }

  const steps = [
    { id: 'scenario' as const, num: 1, label: 'Scenario', icon: <Sliders className="size-4" />, sectionId: 'batch-scenario' },
    { id: 'overrides' as const, num: 2, label: `Overrides${overrideCount > 0 ? ` (${overrideCount})` : ''}`, icon: <Layers className="size-4" />, sectionId: 'batch-overrides' },
    { id: 'run' as const, num: 3, label: 'Run', icon: <Play className="size-4" />, sectionId: 'batch-run' },
  ]

  return (
    <div className="space-y-6">
      {/* Progress summary – stepper style (clickable) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"
          aria-label="Batch steps"
        >
          {steps.map((step) => {
            const isActive = activeStep === step.id
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => scrollToSection(step.sectionId)}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                  'border-transparent',
                  isActive
                    ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-primary/20'
                    : 'bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    isActive && 'border-2 border-primary bg-primary text-primary-foreground',
                    !isActive && 'border border-border bg-background/80'
                  )}
                >
                  {step.num}
                </span>
                <span className="hidden truncate sm:inline">{step.label}</span>
                {step.icon}
              </button>
            )
          })}
        </nav>
        {onNavigateToUpload && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            onClick={onNavigateToUpload}
            title="Edit synonyms (Upload step)"
            aria-label="Edit synonyms (Upload step)"
          >
            <Link2 className="size-4" />
          </Button>
        )}
      </div>

      <div id="batch-scenario" className="scroll-mt-6">
        <BatchScenarioInline
          inputs={scenarioInputs}
          onChange={setScenarioInputs}
          disabled={isRunning}
        />
        <ScenarioControls
          inputs={scenarioInputs}
          onChange={setScenarioInputs}
          selectedProvider={null}
          disabled={isRunning}
          variant="sharedOnly"
        />
      </div>

      <Card id="batch-overrides" className="scroll-mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="size-4" />
            Overrides (optional)
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Override scenario inputs by specialty and/or by provider. Base scenario is from the controls above. Provider overrides beat specialty overrides.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Level</TableHead>
                <TableHead className="min-w-[160px]">Name</TableHead>
                <TableHead className="w-[90px]">CF %ile</TableHead>
                <TableHead className="w-[100px]">Override CF ($)</TableHead>
                <TableHead className="w-[80px]">PSQ %</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialtyOverrides.map((row, idx) => (
                <TableRow key={`spec-${idx}`}>
                  <TableCell className="font-medium text-muted-foreground">Specialty</TableCell>
                  <TableCell>
                    <Select
                      value={row.specialty || '__none__'}
                      onValueChange={(v) => {
                        const next = v === '__none__' ? '' : v
                        setSpecialtyOverrides((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, specialty: next } : r))
                        )
                      }}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select specialty…</SelectItem>
                        {providerSpecialties
                          .filter((s) => !specialtyOverrides.some((r, i) => i !== idx && r.specialty === s))
                          .map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="—"
                      value={row.proposedCFPercentile}
                      onChange={(e) =>
                        setSpecialtyOverrides((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, proposedCFPercentile: e.target.value } : r))
                        )
                      }
                      disabled={isRunning}
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="—"
                      value={row.overrideCF}
                      onChange={(e) =>
                        setSpecialtyOverrides((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, overrideCF: e.target.value } : r))
                        )
                      }
                      disabled={isRunning}
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      placeholder="—"
                      value={row.psqPercent}
                      onChange={(e) =>
                        setSpecialtyOverrides((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, psqPercent: e.target.value } : r))
                        )
                      }
                      disabled={isRunning}
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setSpecialtyOverrides((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={isRunning}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {providerOverrides.map((row, idx) => (
                <TableRow key={`prov-${idx}`}>
                  <TableCell className="font-medium text-muted-foreground">Provider</TableCell>
                  <TableCell>
                    <Select
                      value={row.providerId || '__none__'}
                      onValueChange={(v) => {
                        if (v === '__none__') return
                        const p = providersToRun.find((r) => (r.providerId ?? r.providerName ?? '').toString() === v)
                        setProviderOverrides((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  providerId: v,
                                  providerLabel: p ? (p.providerName ?? v).toString() : v,
                                }
                              : r
                          )
                        )
                      }}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select provider…</SelectItem>
                        {providersToRun
                          .filter((p) => {
                            const id = (p.providerId ?? p.providerName ?? '').toString()
                            return !providerOverrides.some((r, i) => i !== idx && r.providerId === id)
                          })
                          .map((p) => {
                            const id = (p.providerId ?? p.providerName ?? '').toString()
                            const name = (p.providerName ?? id).toString()
                            const spec = (p.specialty ?? '').trim()
                            return (
                              <SelectItem key={id} value={id}>
                                {name}
                                {spec ? ` · ${spec}` : ''}
                              </SelectItem>
                            )
                          })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="—"
                      value={row.proposedCFPercentile}
                      onChange={(e) =>
                        setProviderOverrides((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, proposedCFPercentile: e.target.value } : r))
                        )
                      }
                      disabled={isRunning}
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="—"
                      value={row.overrideCF}
                      onChange={(e) =>
                        setProviderOverrides((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, overrideCF: e.target.value } : r))
                        )
                      }
                      disabled={isRunning}
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      placeholder="—"
                      value={row.psqPercent}
                      onChange={(e) =>
                        setProviderOverrides((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, psqPercent: e.target.value } : r))
                        )
                      }
                      disabled={isRunning}
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setProviderOverrides((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={isRunning}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {specialtyOverrides.length === 0 && providerOverrides.length === 0 && (
            <p className="text-muted-foreground text-sm py-2">No overrides. Add by specialty or provider below.</p>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isRunning || (providerSpecialties.length === 0 && providersToRun.length === 0)}>
                <Plus className="size-4 mr-2" />
                Add override
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() =>
                  setSpecialtyOverrides((prev) => [
                    ...prev,
                    { specialty: '', proposedCFPercentile: '', overrideCF: '', psqPercent: '' },
                  ])
                }
                disabled={providerSpecialties.length === 0}
              >
                By specialty
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setProviderOverrides((prev) => [
                    ...prev,
                    { providerId: '', providerLabel: '', proposedCFPercentile: '', overrideCF: '', psqPercent: '' },
                  ])
                }
                disabled={providersToRun.length === 0}
              >
                By provider
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Run for</CardTitle>
          <p className="text-muted-foreground text-sm">
            Optionally limit the run to one or more specialties and/or providers. Leave all selected to run for everyone.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Target className="size-4" />
                Specialty (from provider file)
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-9 w-full justify-between font-normal"
                    disabled={isRunning || providerSpecialties.length === 0}
                  >
                    <span className="truncate">
                      {selectedSpecialties.length === 0
                        ? 'All specialties'
                        : `${selectedSpecialties.length} specialty${selectedSpecialties.length !== 1 ? 'ies' : ''} selected`}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[300px] overflow-y-auto" align="start">
                  <DropdownMenuCheckboxItem
                    checked={selectedSpecialties.length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedSpecialties([])
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    All specialties
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {providerSpecialties.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={selectedSpecialties.length > 0 && selectedSpecialties.includes(s)}
                      onCheckedChange={(checked) => {
                        setSelectedSpecialties((prev) =>
                          checked ? [...prev, s] : prev.filter((x) => x !== s)
                        )
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {s}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Users className="size-4" />
                Provider
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-9 w-full justify-between font-normal"
                    disabled={isRunning || providersAfterSpecialtyFilter.length === 0}
                  >
                    <span className="truncate">
                      {selectedProviderIds.length === 0
                        ? 'All providers'
                        : `${selectedProviderIds.length} provider${selectedProviderIds.length !== 1 ? 's' : ''} selected`}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[300px] overflow-y-auto" align="start">
                  <DropdownMenuCheckboxItem
                    checked={selectedProviderIds.length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedProviderIds([])
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    All providers
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {providersAfterSpecialtyFilter.map((p) => {
                    const id = (p.providerId ?? p.providerName ?? '').toString()
                    const name = (p.providerName ?? id) || id
                    const sub = (p.specialty ?? '').trim()
                    return (
                      <DropdownMenuCheckboxItem
                        key={id}
                        checked={selectedProviderIds.includes(id)}
                        onCheckedChange={(checked) => {
                          setSelectedProviderIds((prev) =>
                            checked ? [...prev, id] : prev.filter((x) => x !== id)
                          )
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {name}
                        {sub ? ` · ${sub}` : ''}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="batch-run" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>Run model</CardTitle>
          <p className="text-muted-foreground text-sm">
            Run scenario for {providersToRun.length} provider{providersToRun.length !== 1 ? 's' : ''}
            {savedScenarios.length > 0
              ? ` × ${1 + savedScenarios.length} scenarios (Current + ${savedScenarios.length} saved)`
              : ' (Current scenario only)'}
            . Matching uses exact specialty, then normalized name, then synonym map.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {progress.processed} / {total} rows
                </span>
                <span>{Math.round(progress.elapsedMs / 1000)}s</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          )}
          <Button
            onClick={runBatch}
            disabled={isRunning || providersToRun.length === 0 || marketRows.length === 0}
          >
            {isRunning ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="size-4 mr-2" />
                Run model
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
