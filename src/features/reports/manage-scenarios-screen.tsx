import { useMemo, useState, useEffect } from 'react'
import { ArrowLeft, Copy, FolderOpen, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import type { SavedScenario, ScenarioInputs } from '@/types/scenario'
import { DEFAULT_SCENARIO_INPUTS } from '@/types/scenario'
import type { SavedBatchRun, SavedBatchScenarioConfig } from '@/types/batch'
import type { SavedOptimizerConfig } from '@/types/optimizer'
import { formatCurrency, formatDate as formatScenarioDate, formatDateTime as formatRunDate } from '@/utils/format'

/** One-line summary of scenario inputs for the table (e.g. "CF 70th · Quality pay 5%"). */
function scenarioInputsSummary(inp: ScenarioInputs): string {
  const parts: string[] = []
  if (inp.cfSource === 'override' && inp.overrideCF != null && Number.isFinite(inp.overrideCF)) {
    parts.push(`CF ${formatCurrency(inp.overrideCF)}`)
  } else {
    const pct = inp.proposedCFPercentile ?? 50
    parts.push(`CF ${Math.round(pct)}th`)
  }
  if ((inp.psqPercent ?? 0) > 0) parts.push(`Quality pay ${inp.psqPercent}%`)
  return parts.length > 0 ? parts.join(' · ') : 'Default'
}

const TAB_IDS = {
  scenarios: 'scenarios',
  batchRuns: 'batch-runs',
  configs: 'configs',
  optimizerConfigs: 'optimizer-configs',
} as const

export interface ManageScenariosScreenProps {
  savedScenarios: SavedScenario[]
  savedBatchRuns: SavedBatchRun[]
  savedBatchScenarioConfigs: SavedBatchScenarioConfig[]
  savedOptimizerConfigs: SavedOptimizerConfig[]
  onLoadScenario: (id: string) => void
  /** When provided, clicking the scenario name loads it and navigates to Single scenario. */
  onLoadScenarioAndGoToSingle?: (id: string) => void
  onDeleteScenario: (id: string) => void
  onClearAllScenarios: () => void
  onDuplicateScenario: (id: string) => void
  onAddSavedScenario?: (name: string, scenarioInputs: ScenarioInputs) => void
  onUpdateSavedScenario?: (id: string, name: string, scenarioInputs: ScenarioInputs) => void
  onLoadBatchRun: (id: string) => void
  onDeleteBatchRun: (id: string) => void
  onClearAllBatchRuns: () => void
  onLoadBatchScenarioConfig: (config: SavedBatchScenarioConfig) => void
  onDeleteBatchScenarioConfig: (id: string) => void
  onClearAllBatchScenarioConfigs: () => void
  onLoadOptimizerConfig: (id: string) => void
  onDeleteSavedOptimizerConfig: (id: string) => void
  onClearAllSavedOptimizerConfigs: () => void
  onBack: () => void
}

export function ManageScenariosScreen({
  savedScenarios,
  savedBatchRuns,
  savedBatchScenarioConfigs,
  savedOptimizerConfigs,
  onLoadScenario,
  onLoadScenarioAndGoToSingle,
  onDeleteScenario,
  onClearAllScenarios,
  onDuplicateScenario,
  onAddSavedScenario,
  onUpdateSavedScenario,
  onLoadBatchRun,
  onDeleteBatchRun,
  onClearAllBatchRuns,
  onLoadBatchScenarioConfig,
  onDeleteBatchScenarioConfig,
  onClearAllBatchScenarioConfigs,
  onLoadOptimizerConfig,
  onDeleteSavedOptimizerConfig,
  onClearAllSavedOptimizerConfigs,
  onBack,
}: ManageScenariosScreenProps) {
  const sortedScenarios = useMemo(
    () =>
      [...savedScenarios].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [savedScenarios]
  )

  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false)
  const [scenarioDialogMode, setScenarioDialogMode] = useState<'create' | 'edit'>('create')
  const [scenarioEditId, setScenarioEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formInputs, setFormInputs] = useState<ScenarioInputs>(() => ({ ...DEFAULT_SCENARIO_INPUTS }))

  const editingScenario = useMemo(
    () => (scenarioEditId ? savedScenarios.find((s) => s.id === scenarioEditId) : null),
    [scenarioEditId, savedScenarios]
  )

  useEffect(() => {
    if (scenarioDialogOpen && scenarioDialogMode === 'edit' && editingScenario) {
      setFormName(editingScenario.name)
      setFormInputs({ ...editingScenario.scenarioInputs })
    }
    if (scenarioDialogOpen && scenarioDialogMode === 'create') {
      setFormName('')
      setFormInputs({ ...DEFAULT_SCENARIO_INPUTS })
    }
  }, [scenarioDialogOpen, scenarioDialogMode, editingScenario])

  const openCreateScenarioDialog = () => {
    setScenarioDialogMode('create')
    setScenarioEditId(null)
    setFormName('')
    setFormInputs({ ...DEFAULT_SCENARIO_INPUTS })
    setScenarioDialogOpen(true)
  }

  const openEditScenarioDialog = (sc: SavedScenario) => {
    setScenarioDialogMode('edit')
    setScenarioEditId(sc.id)
    setFormName(sc.name)
    setFormInputs({ ...sc.scenarioInputs })
    setScenarioDialogOpen(true)
  }

  const handleSaveScenarioDialog = () => {
    const name = formName.trim()
    if (!name) return
    if (scenarioDialogMode === 'edit' && scenarioEditId && onUpdateSavedScenario) {
      onUpdateSavedScenario(scenarioEditId, name, formInputs)
    } else if (scenarioDialogMode === 'create' && onAddSavedScenario) {
      onAddSavedScenario(name, formInputs)
    }
    setScenarioDialogOpen(false)
  }

  const sortedBatchRuns = useMemo(
    () =>
      [...savedBatchRuns].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [savedBatchRuns]
  )

  const sortedConfigs = useMemo(
    () =>
      [...savedBatchScenarioConfigs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [savedBatchScenarioConfigs]
  )

  const sortedOptimizerConfigs = useMemo(
    () =>
      [...savedOptimizerConfigs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [savedOptimizerConfigs]
  )

  return (
    <div className="min-w-0 max-w-full space-y-8 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <SectionTitleWithIcon icon={<Settings2 className="size-5 text-muted-foreground" />}>
        Manage scenarios & runs
      </SectionTitleWithIcon>
      <p className="text-muted-foreground text-sm">
        View, load, or clear saved model scenarios, batch runs, batch scenario configs, and CF optimizer scenarios. Switch tabs to see each type. <strong>Saved scenarios</strong> are reusable input sets (CF target, value-based payment, wRVUs, etc.). Create templates here or save from Single scenario; apply to any provider in reports or Batch. <strong>Batch runs</strong> = saved results from running a batch (different list). Loaded items apply in Single scenario or Batch.
      </p>

      <Tabs defaultValue={TAB_IDS.scenarios} className="min-w-0 flex flex-col">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value={TAB_IDS.scenarios}>
            Saved scenarios{savedScenarios.length > 0 ? ` (${savedScenarios.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value={TAB_IDS.batchRuns}>
            Batch runs{savedBatchRuns.length > 0 ? ` (${savedBatchRuns.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value={TAB_IDS.configs}>
            Batch configs{savedBatchScenarioConfigs.length > 0 ? ` (${savedBatchScenarioConfigs.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value={TAB_IDS.optimizerConfigs}>
            CF Optimizer{savedOptimizerConfigs.length > 0 ? ` (${savedOptimizerConfigs.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_IDS.scenarios} className="mt-4 min-h-0 flex flex-col">
          <Card className="border border-border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[320px]">
            <CardHeader className="pb-3 px-4 sm:px-6 border-b border-border shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">Saved scenarios</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">Same list as the scenario dropdown in Batch (Scenario Studio). Click a name to open in Single scenario; use Load to apply without leaving.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onAddSavedScenario && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={openCreateScenarioDialog}
                    >
                      <Plus className="size-4" />
                      Create scenario
                    </Button>
                  )}
                  {savedScenarios.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Clear all ${savedScenarios.length} model scenario(s)? This cannot be undone.`
                          )
                        ) {
                          onClearAllScenarios()
                        }
                      }}
                    >
                      <RotateCcw className="size-4 mr-1" />
                      Clear all
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-4 pb-4 min-w-0 overflow-hidden flex-1 min-h-0">
              {sortedScenarios.length === 0 ? (
                <EmptyState message="No saved scenarios yet. Go to Single scenario and save a scenario to see it here." />
              ) : (
                <div className="min-w-0 overflow-hidden rounded-md border h-full min-h-[240px]">
                  <ScrollArea className="h-[50vh] min-h-[240px] max-h-[420px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border">
                          <TableHead className="font-semibold text-foreground">Scenario</TableHead>
                          <TableHead className="font-semibold text-foreground">Date</TableHead>
                          <TableHead className="font-semibold text-foreground">Specialty</TableHead>
                          <TableHead className="font-semibold text-foreground">Provider</TableHead>
                          <TableHead className="font-semibold text-foreground">Summary</TableHead>
                          <TableHead className="w-[1%] font-semibold text-foreground text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedScenarios.map((sc) => (
                          <TableRow key={sc.id} className="border-border hover:bg-muted/50">
                            <TableCell className="font-medium align-middle">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onLoadScenarioAndGoToSingle) {
                                    onLoadScenarioAndGoToSingle(sc.id)
                                  } else {
                                    onLoadScenario(sc.id)
                                  }
                                }}
                                className="text-left text-primary hover:underline focus:underline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-1 rounded truncate block max-w-[200px]"
                                title={onLoadScenarioAndGoToSingle ? `Open in Single scenario: ${sc.name}` : `Load scenario: ${sc.name}`}
                              >
                                {sc.name}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground align-middle whitespace-nowrap">
                              {formatScenarioDate(sc.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground align-middle">
                              <span className="truncate block max-w-[160px]" title={sc.selectedSpecialty ?? undefined}>
                                {sc.selectedSpecialty != null && sc.selectedSpecialty !== ''
                                  ? sc.selectedSpecialty
                                  : sc.providerSnapshot?.specialty != null || sc.providerSnapshot?.division != null
                                    ? [sc.providerSnapshot?.specialty, sc.providerSnapshot?.division].filter(Boolean).join(' · ')
                                    : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="align-middle">
                              <span className="truncate block max-w-[180px]" title={sc.providerSnapshot?.providerName ?? undefined}>
                                {sc.providerSnapshot?.providerName ?? '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground align-middle text-xs">
                              <span className="truncate block max-w-[140px]" title={scenarioInputsSummary(sc.scenarioInputs)}>
                                {scenarioInputsSummary(sc.scenarioInputs)}
                              </span>
                            </TableCell>
                            <TableCell className="align-middle text-right">
                              <div className="flex justify-end gap-0.5">
                                {onUpdateSavedScenario && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => openEditScenarioDialog(sc)}
                                    title="Edit scenario"
                                  >
                                    <Settings2 className="size-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => onLoadScenario(sc.id)}
                                  title="Load into app (stay here)"
                                >
                                  <FolderOpen className="size-4" />
                                  <span className="sr-only">Load</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => onDuplicateScenario(sc.id)}
                                  title="Duplicate"
                                >
                                  <Copy className="size-4" />
                                  <span className="sr-only">Duplicate</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (window.confirm(`Delete "${sc.name}"? This cannot be undone.`)) {
                                      onDeleteScenario(sc.id)
                                    }
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 className="size-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={scenarioDialogOpen} onOpenChange={setScenarioDialogOpen}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {scenarioDialogMode === 'edit' ? 'Edit scenario' : 'Create scenario template'}
                </DialogTitle>
                <DialogDescription>
                  {scenarioDialogMode === 'edit'
                    ? 'Update the scenario name and inputs.'
                    : 'Define a reusable scenario. It can be applied to any provider in Single scenario, Batch, or reports.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="scenario-template-name">Name</Label>
                  <Input
                    id="scenario-template-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. 50th %ile CF, 5% Quality pay"
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[45%] font-medium">Setting</TableHead>
                        <TableHead className="font-medium">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="align-middle text-sm text-muted-foreground">Value-based payment %</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={50}
                            step={0.5}
                            className="h-9 w-full max-w-[8rem]"
                            value={formInputs.psqPercent ?? 0}
                            onChange={(e) => {
                              const raw = Number(e.target.value) || 0
                              setFormInputs((prev) => ({ ...prev, psqPercent: Math.min(50, Math.max(0, raw)) }))
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="align-middle text-sm text-muted-foreground">Other adds to TCC ($)</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="h-9 w-full max-w-[8rem]"
                            placeholder="Optional"
                            value={formInputs.modeledNonClinicalPay ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setFormInputs((prev) => ({
                                ...prev,
                                modeledNonClinicalPay: v === '' ? undefined : Number(v),
                              }))
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="align-middle text-sm text-muted-foreground">wRVU percentile</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            className="h-9 w-full max-w-[8rem]"
                            value={formInputs.wrvuPercentile ?? 50}
                            onChange={(e) => {
                              const raw = Number(e.target.value) ?? 50
                              setFormInputs((prev) => ({ ...prev, wrvuPercentile: Math.min(100, Math.max(0, raw)) }))
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="align-middle text-sm text-muted-foreground">wRVU value (optional)</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            className="h-9 w-full max-w-[8rem]"
                            placeholder="Override wRVUs"
                            value={formInputs.modeledWRVUs ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setFormInputs((prev) => ({
                                ...prev,
                                modeledWRVUs: v === '' ? undefined : Number(v),
                              }))
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="align-middle text-sm text-muted-foreground">CF target percentile</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            className="h-9 w-full max-w-[8rem]"
                            value={formInputs.cfSource === 'override' ? '' : (formInputs.proposedCFPercentile ?? 40)}
                            disabled={formInputs.cfSource === 'override'}
                            onChange={(e) =>
                              setFormInputs((prev) => ({
                                ...prev,
                                cfSource: 'target_percentile',
                                proposedCFPercentile: Number(e.target.value) || 0,
                              }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="align-middle text-sm text-muted-foreground">Override CF ($/wRVU)</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="h-9 w-full max-w-[8rem]"
                            placeholder="Optional — else uses percentile"
                            value={formInputs.cfSource === 'override' ? (formInputs.overrideCF ?? '') : ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setFormInputs((prev) => ({
                                ...prev,
                                cfSource: v !== '' && Number.isFinite(Number(v)) ? 'override' : 'target_percentile',
                                overrideCF: v === '' ? undefined : Number(v),
                              }))
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setScenarioDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveScenarioDialog}
                  disabled={!formName.trim() || (scenarioDialogMode === 'create' ? !onAddSavedScenario : !onUpdateSavedScenario)}
                >
                  {scenarioDialogMode === 'edit' ? 'Save changes' : 'Create scenario'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value={TAB_IDS.batchRuns} className="mt-4 min-h-0 flex flex-col">
          <Card className="border border-border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[320px]">
            <CardHeader className="pb-3 px-4 sm:px-6 border-b border-border shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">Saved batch runs</h3>
                {savedBatchRuns.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Clear all ${savedBatchRuns.length} saved batch run(s)? This cannot be undone.`
                        )
                      ) {
                        onClearAllBatchRuns()
                      }
                    }}
                  >
                    <RotateCcw className="size-4 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-4 pb-4 min-w-0 overflow-hidden flex-1 min-h-0">
              {sortedBatchRuns.length === 0 ? (
                <EmptyState message="No saved batch runs yet. Run a scenario from Batch, then save the run to see it here." />
              ) : (
                <div className="min-w-0 overflow-hidden rounded-md border h-full min-h-[240px]">
                  <ScrollArea className="h-[50vh] min-h-[240px] max-h-[420px]">
                    <ul className="space-y-0.5 p-2">
                      {sortedBatchRuns.map((run) => (
                        <li
                          key={run.id}
                          className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1 overflow-hidden text-sm">
                            <p className="truncate font-medium" title={run.name}>
                              {run.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatRunDate(run.createdAt)}
                              {run.mode != null && (
                                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                  {run.mode === 'detailed' ? 'Detailed' : 'Bulk'}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => onLoadBatchRun(run.id)}
                              title="Load this run"
                            >
                              <FolderOpen className="size-4" />
                              <span className="sr-only">Load</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm(`Delete "${run.name}"? This cannot be undone.`)) {
                                  onDeleteBatchRun(run.id)
                                }
                              }}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value={TAB_IDS.configs} className="mt-4 min-h-0 flex flex-col">
          <Card className="border border-border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[320px]">
            <CardHeader className="pb-3 px-4 sm:px-6 border-b border-border shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">Saved batch scenario configs</h3>
                {savedBatchScenarioConfigs.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Clear all ${savedBatchScenarioConfigs.length} saved batch scenario config(s)? This cannot be undone.`
                        )
                      ) {
                        onClearAllBatchScenarioConfigs()
                      }
                    }}
                  >
                    <RotateCcw className="size-4 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-4 pb-4 min-w-0 overflow-hidden flex-1 min-h-0">
              {sortedConfigs.length === 0 ? (
                <EmptyState message="No saved batch configs yet. Go to Batch → Run Batch Scenario, configure a scenario, and save the config to see it here." />
              ) : (
                <div className="min-w-0 overflow-hidden rounded-md border h-full min-h-[240px]">
                  <ScrollArea className="h-[50vh] min-h-[240px] max-h-[420px]">
                    <ul className="space-y-0.5 p-2">
                      {sortedConfigs.map((config) => (
                        <li
                          key={config.id}
                          className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1 overflow-hidden text-sm">
                            <p className="truncate font-medium" title={config.name}>
                              {config.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatScenarioDate(config.createdAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => onLoadBatchScenarioConfig(config)}
                              title="Load this config (then go to Batch to run)"
                            >
                              <FolderOpen className="size-4" />
                              <span className="sr-only">Load</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm(`Delete "${config.name}"? This cannot be undone.`)) {
                                  onDeleteBatchScenarioConfig(config.id)
                                }
                              }}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value={TAB_IDS.optimizerConfigs} className="mt-4 min-h-0 flex flex-col">
          <Card className="border border-border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[320px]">
            <CardHeader className="pb-3 px-4 sm:px-6 border-b border-border shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">CF optimizer scenarios</h3>
                {savedOptimizerConfigs.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Clear all ${savedOptimizerConfigs.length} optimizer scenario(s)? This cannot be undone.`
                        )
                      ) {
                        onClearAllSavedOptimizerConfigs()
                      }
                    }}
                  >
                    <RotateCcw className="size-4 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-4 pb-4 min-w-0 overflow-hidden flex-1 min-h-0">
              {sortedOptimizerConfigs.length === 0 ? (
                <EmptyState message="No saved CF optimizer scenarios yet. Run CF Optimizer in Batch, then save the scenario to see it here." />
              ) : (
                <div className="min-w-0 overflow-hidden rounded-md border h-full min-h-[240px]">
                  <ScrollArea className="h-[50vh] min-h-[240px] max-h-[420px]">
                    <ul className="space-y-0.5 p-2">
                      {sortedOptimizerConfigs.map((config) => (
                        <li
                          key={config.id}
                          className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1 overflow-hidden text-sm">
                            <p className="truncate font-medium" title={config.name}>
                              {config.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatScenarioDate(config.createdAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => onLoadOptimizerConfig(config.id)}
                              title="Load this scenario (then go to Batch to view or run)"
                            >
                              <FolderOpen className="size-4" />
                              <span className="sr-only">Load</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm(`Delete "${config.name}"? This cannot be undone.`)) {
                                  onDeleteSavedOptimizerConfig(config.id)
                                }
                              }}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
