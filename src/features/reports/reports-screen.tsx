import React from 'react'
import { ArrowLeft, FileText, FolderOpen, User, Gauge, Percent, Settings2, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { TccWrvuPercentilesReport } from './tcc-wrvu-percentiles-report'
import { SavedBatchRunReport } from './saved-batch-run-report'
import { SingleProviderImpactReport } from './single-provider-impact-report'
import { QuickRunCFReport } from './quick-run-cf-report'
import { CustomCfBySpecialtyReport } from './custom-cf-by-specialty-report'
import { ManageScenariosScreen } from './manage-scenarios-screen'
import { ImputedVsMarketScreen } from '@/features/optimizer/imputed-vs-market-screen'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { SavedBatchRun, SavedBatchScenarioConfig } from '@/types/batch'
import type { SynonymMap } from '@/types/batch'
import type { SavedOptimizerConfig } from '@/types/optimizer'
import type { BatchCardId } from '@/components/batch/batch-card-picker'
import { cn } from '@/lib/utils'

export type ReportViewId = 'list' | 'tcc-wrvu' | 'saved-run' | 'impact' | 'quick-run-cf' | 'custom-cf-by-specialty' | 'market-positioning' | 'manage-scenarios'

interface ReportCardConfig {
  id: ReportViewId
  title: string
  description: string
  icon: React.ReactNode
}

const REPORT_CARDS: ReportCardConfig[] = [
  {
    id: 'quick-run-cf',
    title: 'Recommended Conversion Factors',
    description: 'One-click analysis: recommended $/wRVU by specialty from your data. No configuration required.',
    icon: <Gauge className="size-6" />,
  },
  {
    id: 'tcc-wrvu',
    title: 'TCC & wRVU Percentiles',
    description: 'Total cash compensation and work RVU percentiles for all loaded providers under one scenario.',
    icon: <Percent className="size-6" />,
  },
  {
    id: 'custom-cf-by-specialty',
    title: 'Custom CF By Specialty',
    description: 'Set $/wRVU or market percentile per specialty and run TCC & wRVU results.',
    icon: <Gauge className="size-6" />,
  },
  {
    id: 'impact',
    title: 'Compensation Impact Report',
    description: 'Single-provider compensation impact: TCC waterfall, market percentiles, and summary.',
    icon: <User className="size-6" />,
  },
  {
    id: 'saved-run',
    title: 'Saved Batch Run Report',
    description: 'View and export a saved batch run: TCC and wRVU summary and metrics.',
    icon: <FolderOpen className="size-6" />,
  },
  {
    id: 'market-positioning',
    title: 'Market positioning (imputed)',
    description: 'Compare your effective $/wRVU to market 25th–90th by specialty; see your percentile and market CF targets.',
    icon: <BarChart2 className="size-6" />,
  },
]

const cardClass = cn(
  'cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  'h-full min-h-[160px] flex flex-col'
)

export interface ReportsScreenProps {
  /** When this value changes, the view resets to the report library list (e.g. when user clicks Reports in sidebar). */
  reportLibraryFocusKey?: number
  /** Lifted state: which report view is shown (persisted in sessionStorage when step is reports). */
  reportView: ReportViewId
  onReportViewChange: (view: ReportViewId) => void
  /** Lifted state: selected saved batch run id when view is saved-run. */
  selectedSavedRunId: string | null
  onSelectedSavedRunIdChange: (id: string | null) => void
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  savedScenarios: SavedScenario[]
  savedBatchRuns: SavedBatchRun[]
  savedBatchScenarioConfigs: SavedBatchScenarioConfig[]
  batchSynonymMap: SynonymMap
  onBack: () => void
  /** When provided, Quick Run CF report can link to CF Optimizer batch workflow. */
  onNavigateToBatchCard?: (id: BatchCardId) => void
  /** Manage scenarios screen callbacks. */
  onLoadScenario?: (id: string) => void
  /** Load scenario and navigate to Single scenario (used when opening from Report library). */
  onLoadScenarioAndGoToSingle?: (id: string) => void
  onDeleteScenario?: (id: string) => void
  onClearAllScenarios?: () => void
  onDuplicateScenario?: (id: string) => void
  onAddSavedScenario?: (name: string, scenarioInputs: ScenarioInputs) => void
  onUpdateSavedScenario?: (id: string, name: string, scenarioInputs: ScenarioInputs) => void
  onLoadBatchRun?: (id: string) => void
  onDeleteBatchRun?: (id: string) => void
  onClearAllBatchRuns?: () => void
  onLoadBatchScenarioConfig?: (config: SavedBatchScenarioConfig) => void
  onSaveBatchScenarioConfig?: (config: Omit<SavedBatchScenarioConfig, 'id' | 'createdAt'>) => void
  onDeleteBatchScenarioConfig?: (id: string) => void
  onClearAllBatchScenarioConfigs?: () => void
  savedOptimizerConfigs?: SavedOptimizerConfig[]
  onLoadOptimizerConfig?: (id: string) => void
  onDeleteSavedOptimizerConfig?: (id: string) => void
  onClearAllSavedOptimizerConfigs?: () => void
}

export function ReportsScreen({
  reportLibraryFocusKey: _reportLibraryFocusKey = 0,
  reportView,
  onReportViewChange: setReportView,
  selectedSavedRunId,
  onSelectedSavedRunIdChange: setSelectedSavedRunId,
  providerRows,
  marketRows,
  scenarioInputs,
  savedScenarios,
  savedBatchRuns,
  savedBatchScenarioConfigs,
  batchSynonymMap,
  onBack,
  onNavigateToBatchCard,
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
  onSaveBatchScenarioConfig,
  onDeleteBatchScenarioConfig,
  onClearAllBatchScenarioConfigs,
  savedOptimizerConfigs = [],
  onLoadOptimizerConfig,
  onDeleteSavedOptimizerConfig,
  onClearAllSavedOptimizerConfigs,
}: ReportsScreenProps) {
  // When reportLibraryFocusKey changes (e.g. user clicks Reports in sidebar), parent resets reportView to 'list' and selectedSavedRunId to null.

  if (reportView === 'market-positioning') {
    return (
      <ImputedVsMarketScreen
        providerRows={providerRows}
        marketRows={marketRows}
        synonymMap={batchSynonymMap}
        onBack={() => setReportView('list')}
      />
    )
  }

  if (reportView === 'manage-scenarios') {
    return (
      <ManageScenariosScreen
        savedScenarios={savedScenarios}
        savedBatchRuns={savedBatchRuns}
        savedBatchScenarioConfigs={savedBatchScenarioConfigs}
        savedOptimizerConfigs={savedOptimizerConfigs}
        onLoadScenario={onLoadScenario ?? (() => {})}
        onLoadScenarioAndGoToSingle={onLoadScenarioAndGoToSingle}
        onDeleteScenario={onDeleteScenario ?? (() => {})}
        onClearAllScenarios={onClearAllScenarios ?? (() => {})}
        onDuplicateScenario={onDuplicateScenario ?? (() => {})}
        onAddSavedScenario={onAddSavedScenario}
        onUpdateSavedScenario={onUpdateSavedScenario}
        onLoadBatchRun={onLoadBatchRun ?? (() => {})}
        onDeleteBatchRun={onDeleteBatchRun ?? (() => {})}
        onClearAllBatchRuns={onClearAllBatchRuns ?? (() => {})}
        onLoadBatchScenarioConfig={onLoadBatchScenarioConfig ?? (() => {})}
        onDeleteBatchScenarioConfig={onDeleteBatchScenarioConfig ?? (() => {})}
        onClearAllBatchScenarioConfigs={onClearAllBatchScenarioConfigs ?? (() => {})}
        onLoadOptimizerConfig={onLoadOptimizerConfig ?? (() => {})}
        onDeleteSavedOptimizerConfig={onDeleteSavedOptimizerConfig ?? (() => {})}
        onClearAllSavedOptimizerConfigs={onClearAllSavedOptimizerConfigs ?? (() => {})}
        onBack={() => setReportView('list')}
      />
    )
  }

  if (reportView === 'tcc-wrvu') {
    return (
      <TccWrvuPercentilesReport
        providerRows={providerRows}
        marketRows={marketRows}
        scenarioInputs={scenarioInputs}
        savedScenarios={savedScenarios}
        batchSynonymMap={batchSynonymMap}
        onBack={() => setReportView('list')}
      />
    )
  }

  if (reportView === 'saved-run') {
    return (
      <SavedBatchRunReport
        savedBatchRuns={savedBatchRuns}
        selectedRunId={selectedSavedRunId}
        onSelectRunId={setSelectedSavedRunId}
        onBack={() => {
          setReportView('list')
          setSelectedSavedRunId(null)
        }}
        onManageRuns={() => setReportView('manage-scenarios')}
      />
    )
  }

  if (reportView === 'impact') {
    return (
      <SingleProviderImpactReport
        providerRows={providerRows}
        marketRows={marketRows}
        scenarioInputs={scenarioInputs}
        savedScenarios={savedScenarios}
        batchSynonymMap={batchSynonymMap}
        onBack={() => setReportView('list')}
      />
    )
  }

  if (reportView === 'quick-run-cf') {
    return (
      <QuickRunCFReport
        providerRows={providerRows}
        marketRows={marketRows}
        scenarioInputs={scenarioInputs}
        batchSynonymMap={batchSynonymMap}
        onBack={() => setReportView('list')}
        onNavigateToCfOptimizer={
          onNavigateToBatchCard ? () => onNavigateToBatchCard('cf-optimizer') : undefined
        }
      />
    )
  }

  if (reportView === 'custom-cf-by-specialty') {
    return (
      <CustomCfBySpecialtyReport
        providerRows={providerRows}
        marketRows={marketRows}
        scenarioInputs={scenarioInputs}
        batchSynonymMap={batchSynonymMap}
        onSaveScenarioConfig={onSaveBatchScenarioConfig}
        savedBatchScenarioConfigs={savedBatchScenarioConfigs}
        onDeleteBatchScenarioConfig={onDeleteBatchScenarioConfig}
        onBack={() => setReportView('list')}
      />
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
            Report library
          </SectionTitleWithIcon>
          <button
            type="button"
            onClick={() => setReportView('manage-scenarios')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="size-4" />
            Manage scenarios & runs
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2 shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        {REPORT_CARDS.map((card) => (
          <Card
            key={card.id}
            className={cardClass}
            tabIndex={0}
            role="button"
            onClick={() => setReportView(card.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setReportView(card.id)
              }
            }}
          >
            <CardContent className="flex flex-col gap-3 pt-6 flex-1">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {card.icon}
              </span>
              <h3 className="font-semibold text-foreground shrink-0">{card.title}</h3>
              <p className="text-muted-foreground text-xs flex-1 min-h-[2.5rem]">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
