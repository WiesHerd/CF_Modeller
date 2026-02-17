import { useMemo } from 'react'
import { ArrowLeft, Copy, FolderOpen, RotateCcw, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import type { SavedScenario } from '@/types/scenario'
import type { SavedBatchRun, SavedBatchScenarioConfig } from '@/types/batch'
import type { SavedOptimizerConfig } from '@/types/optimizer'

const TAB_IDS = {
  scenarios: 'scenarios',
  batchRuns: 'batch-runs',
  configs: 'configs',
  optimizerConfigs: 'optimizer-configs',
} as const

function formatScenarioDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatRunDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export interface ManageScenariosScreenProps {
  savedScenarios: SavedScenario[]
  savedBatchRuns: SavedBatchRun[]
  savedBatchScenarioConfigs: SavedBatchScenarioConfig[]
  savedOptimizerConfigs: SavedOptimizerConfig[]
  onLoadScenario: (id: string) => void
  onDeleteScenario: (id: string) => void
  onClearAllScenarios: () => void
  onDuplicateScenario: (id: string) => void
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
  onDeleteScenario,
  onClearAllScenarios,
  onDuplicateScenario,
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
        View, load, or clear saved model scenarios, batch runs, batch scenario configs, and CF optimizer scenarios. Switch tabs to see each type. Loaded items apply in Single scenario or Batch.
      </p>

      <Tabs defaultValue={TAB_IDS.scenarios} className="min-w-0 flex flex-col">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value={TAB_IDS.scenarios}>
            Model scenarios{savedScenarios.length > 0 ? ` (${savedScenarios.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value={TAB_IDS.batchRuns}>
            Batch runs{savedBatchRuns.length > 0 ? ` (${savedBatchRuns.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value={TAB_IDS.configs}>
            Batch configs{savedBatchScenarioConfigs.length > 0 ? ` (${savedBatchScenarioConfigs.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value={TAB_IDS.optimizerConfigs}>
            Optimizer{savedOptimizerConfigs.length > 0 ? ` (${savedOptimizerConfigs.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_IDS.scenarios} className="mt-4 min-h-0 flex flex-col">
          <Card className="border border-border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[320px]">
            <CardHeader className="pb-3 px-4 sm:px-6 border-b border-border shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">Model scenarios</h3>
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
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-4 pb-4 min-w-0 overflow-hidden flex-1 min-h-0">
              {sortedScenarios.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No saved model scenarios yet. Save from Single scenario or Import data to add some.
                </p>
              ) : (
                <div className="min-w-0 overflow-hidden rounded-md border h-full min-h-[240px]">
                  <ScrollArea className="h-[50vh] min-h-[240px] max-h-[420px]">
                    <ul className="space-y-0.5 p-2">
                      {sortedScenarios.map((sc) => (
                        <li
                          key={sc.id}
                          className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="truncate font-medium" title={sc.name}>
                              {sc.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatScenarioDate(sc.createdAt)}
                              {sc.selectedSpecialty != null && ` · ${sc.selectedSpecialty}`}
                              {sc.providerSnapshot?.providerName != null &&
                                ` · ${sc.providerSnapshot.providerName}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => onLoadScenario(sc.id)}
                              title="Load scenario"
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
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
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
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No saved batch runs yet. Run a scenario from Batch, then save the run to see it here.
                </p>
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
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No saved batch scenario configs yet. Save from the Batch scenario step to add some.
                </p>
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
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No saved CF optimizer scenarios yet. Run CF Optimizer in Batch, then save the scenario to see it here.
                </p>
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
