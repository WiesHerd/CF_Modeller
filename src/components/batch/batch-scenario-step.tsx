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
import { Play, Loader2, AlertCircle, Users, Target } from 'lucide-react'
import { ScenarioControls } from '@/components/scenario-controls'
import { SynonymEditor } from '@/components/batch/synonym-editor'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { SynonymMap } from '@/types/batch'
import type { BatchWorkerRunPayload, BatchWorkerOutMessage } from '@/workers/batch-worker'

interface BatchScenarioStepProps {
  providerRows: ProviderRow[]
  marketRows: import('@/types/market').MarketRow[]
  scenarioInputs: ScenarioInputs
  setScenarioInputs: (inputs: Partial<ScenarioInputs>) => void
  savedScenarios: SavedScenario[]
  batchSynonymMap: SynonymMap
  updateBatchSynonymMap: (key: string, value: string) => void
  removeBatchSynonym: (key: string) => void
  onRunComplete: (results: import('@/types/batch').BatchResults) => void
}

export function BatchScenarioStep({
  providerRows,
  marketRows,
  scenarioInputs,
  setScenarioInputs,
  savedScenarios,
  batchSynonymMap,
  updateBatchSynonymMap,
  removeBatchSynonym,
  onRunComplete,
}: BatchScenarioStepProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState({ processed: 0, total: 1, elapsedMs: 0 })
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const providerSpecialties = useMemo(() => {
    const set = new Set(providerRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [providerRows])
  const marketSpecialties = useMemo(() => {
    const set = new Set(marketRows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [marketRows])

  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)

  const providersAfterSpecialtyFilter = useMemo(() => {
    if (!selectedSpecialty) return providerRows
    return providerRows.filter(
      (p) => (p.specialty ?? '').trim() === selectedSpecialty
    )
  }, [providerRows, selectedSpecialty])

  const providersToRun = useMemo(() => {
    if (!selectedProviderId) return providersAfterSpecialtyFilter
    return providersAfterSpecialtyFilter.filter(
      (p) => (p.providerId ?? p.providerName ?? '').toString() === selectedProviderId
    )
  }, [providersAfterSpecialtyFilter, selectedProviderId])

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
    onRunComplete,
  ])

  const total = Math.max(1, progress.total)
  const pct = Math.min(100, Math.round((100 * progress.processed) / total))

  return (
    <div className="space-y-8">
      <ScenarioControls
        inputs={scenarioInputs}
        onChange={setScenarioInputs}
        selectedProvider={null}
        disabled={isRunning}
      />

      <SynonymEditor
        synonymMap={batchSynonymMap}
        onAdd={updateBatchSynonymMap}
        onRemove={removeBatchSynonym}
        providerSpecialties={providerSpecialties}
        marketSpecialties={marketSpecialties}
        disabled={isRunning}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Run for</CardTitle>
          <p className="text-muted-foreground text-sm">
            Optionally limit the run to one specialty and/or one provider. Use &quot;All&quot; to run for everyone.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Target className="size-4" />
              Specialty (from provider file)
            </Label>
            <Select
              value={selectedSpecialty ?? '__all__'}
              onValueChange={(v) => {
                setSelectedSpecialty(v === '__all__' ? null : v)
                setSelectedProviderId(null)
              }}
              disabled={isRunning || providerSpecialties.length === 0}
            >
              <SelectTrigger className="min-h-9 w-full max-w-md">
                <SelectValue placeholder="All specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All specialties</SelectItem>
                {providerSpecialties.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Users className="size-4" />
              Provider
            </Label>
            <Select
              value={selectedProviderId ?? '__all__'}
              onValueChange={(v) =>
                setSelectedProviderId(v === '__all__' ? null : v)
              }
              disabled={isRunning || providersAfterSpecialtyFilter.length === 0}
            >
              <SelectTrigger className="min-h-9 w-full max-w-md">
                <SelectValue placeholder="All providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All providers</SelectItem>
                {providersAfterSpecialtyFilter.map((p) => {
                  const id = (p.providerId ?? p.providerName ?? '').toString()
                  const name = (p.providerName ?? id) || id
                  const sub = (p.specialty ?? '').trim()
                  return (
                    <SelectItem key={id} value={id}>
                      {name}
                      {sub ? ` · ${sub}` : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
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
