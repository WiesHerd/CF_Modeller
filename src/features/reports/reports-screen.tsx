import { useState, useEffect } from 'react'
import { ArrowLeft, FileText, FolderOpen, User, BarChart2, GitCompare, Gauge, Settings2, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { TccWrvuPercentilesReport } from './tcc-wrvu-percentiles-report'
import { SavedBatchRunReport } from './saved-batch-run-report'
import { SingleProviderImpactReport } from './single-provider-impact-report'
import { QuickRunCFReport } from './quick-run-cf-report'
import { CustomCfBySpecialtyReport } from './custom-cf-by-specialty-report'
import { ManageScenariosScreen } from './manage-scenarios-screen'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { SavedBatchRun, SavedBatchScenarioConfig } from '@/types/batch'
import type { SynonymMap } from '@/types/batch'
import type { SavedOptimizerConfig } from '@/types/optimizer'
import { cn } from '@/lib/utils'

export type ReportViewId = 'list' | 'tcc-wrvu' | 'saved-run' | 'impact' | 'quick-run-cf' | 'custom-cf-by-specialty' | 'compare-scenarios' | 'manage-scenarios'

export type ReportLibraryCardId = ReportViewId | 'market-positioning' | 'cf-optimizer' | 'productivity-target'

const REPORT_SECTION_ORDER = ['quick-run', 'reports', 'batch-compare', 'manage'] as const
type ReportSectionId = (typeof REPORT_SECTION_ORDER)[number]

interface ReportCardConfig {
  id: ReportLibraryCardId
  section: ReportSectionId
  title: string
  description: string
  icon: React.ReactNode
  navigateOnly?: boolean
}

const REPORT_CARDS: ReportCardConfig[] = [
  {
    id: 'quick-run-cf',
    section: 'quick-run',
    title: 'Recommended conversion factors',
    description: 'One-click analysis: recommended $/wRVU by specialty from your data. No configuration required.',
    icon: <Gauge className="size-6" />,
  },
  {
    id: 'tcc-wrvu',
    section: 'reports',
    title: 'TCC & wRVU percentiles',
    description: 'Total cash compensation and work RVU percentiles for all loaded providers under one scenario.',
    icon: <BarChart2 className="size-6" />,
  },
  {
    id: 'custom-cf-by-specialty',
    section: 'reports',
    title: 'Custom CF by specialty',
    description: 'Set $/wRVU or market percentile per specialty and run TCC & wRVU results.',
    icon: <Gauge className="size-6" />,
  },
  {
    id: 'saved-run',
    section: 'reports',
    title: 'Saved batch run',
    description: 'View and export a saved batch run: TCC and wRVU summary and metrics.',
    icon: <FolderOpen className="size-6" />,
  },
  {
    id: 'impact',
    section: 'reports',
    title: 'Compensation impact report',
    description: 'Single-provider compensation impact: TCC waterfall, market percentiles, and summary.',
    icon: <User className="size-6" />,
  },
  {
    id: 'market-positioning',
    section: 'batch-compare',
    title: 'Market positioning',
    description: 'Effective $/wRVU by specialty vs market 25th–90th; export for research.',
    icon: <TrendingUp className="size-6" />,
    navigateOnly: true,
  },
  {
    id: 'cf-optimizer',
    section: 'batch-compare',
    title: 'CF Optimizer',
    description: 'Specialty-level CF recommendations and policy guardrails; export to Excel.',
    icon: <Gauge className="size-6" />,
    navigateOnly: true,
  },
  {
    id: 'productivity-target',
    section: 'batch-compare',
    title: 'Target Optimizer',
    description: 'wRVU targets by specialty from market percentiles; group target, provider table, and planning incentive.',
    icon: <Target className="size-6" />,
    navigateOnly: true,
  },
  {
    id: 'compare-scenarios',
    section: 'batch-compare',
    title: 'Scenario comparison',
    description: 'Compare two saved optimizer scenarios side-by-side and export to Excel.',
    icon: <GitCompare className="size-6" />,
    navigateOnly: true,
  },
  {
    id: 'manage-scenarios',
    section: 'manage',
    title: 'Manage scenarios & runs',
    description: 'View, load, or clear saved model scenarios, batch runs, batch configs, and CF optimizer scenarios.',
    icon: <Settings2 className="size-6" />,
  },
]

const REPORT_SECTION_LABELS: Record<ReportSectionId, string> = {
  'quick-run': 'Quick run',
  reports: 'Reports',
  'batch-compare': 'Batch & compare',
  manage: 'Manage',
}

const cardClass = cn(
  'cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  'h-full min-h-[160px] flex flex-col'
)

export interface ReportsScreenProps {
  /** When this value changes, the view resets to the report library list (e.g. when user clicks Reports in sidebar). */
  reportLibraryFocusKey?: number
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  savedScenarios: SavedScenario[]
  savedBatchRuns: SavedBatchRun[]
  savedBatchScenarioConfigs: SavedBatchScenarioConfig[]
  batchSynonymMap: SynonymMap
  onBack: () => void
  /** When provided, the Scenario comparison card navigates to Compare scenarios. */
  onNavigateToCompareScenarios?: () => void
  /** When provided, Market positioning, CF Optimizer, and Target Optimizer cards navigate to Batch. */
  onNavigateToBatchCard?: (id: 'imputed-vs-market' | 'cf-optimizer' | 'productivity-target') => void
  /** Manage scenarios screen callbacks. */
  onLoadScenario?: (id: string) => void
  onDeleteScenario?: (id: string) => void
  onClearAllScenarios?: () => void
  onDuplicateScenario?: (id: string) => void
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
  reportLibraryFocusKey = 0,
  providerRows,
  marketRows,
  scenarioInputs,
  savedScenarios,
  savedBatchRuns,
  savedBatchScenarioConfigs,
  batchSynonymMap,
  onBack,
  onNavigateToCompareScenarios,
  onNavigateToBatchCard,
  onLoadScenario,
  onDeleteScenario,
  onClearAllScenarios,
  onDuplicateScenario,
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
  const [reportView, setReportView] = useState<ReportViewId>('list')
  const [selectedSavedRunId, setSelectedSavedRunId] = useState<string | null>(null)

  useEffect(() => {
    setReportView('list')
    setSelectedSavedRunId(null)
  }, [reportLibraryFocusKey])

  if (reportView === 'manage-scenarios') {
    return (
      <ManageScenariosScreen
        savedScenarios={savedScenarios}
        savedBatchRuns={savedBatchRuns}
        savedBatchScenarioConfigs={savedBatchScenarioConfigs}
        savedOptimizerConfigs={savedOptimizerConfigs}
        onLoadScenario={onLoadScenario ?? (() => {})}
        onDeleteScenario={onDeleteScenario ?? (() => {})}
        onClearAllScenarios={onClearAllScenarios ?? (() => {})}
        onDuplicateScenario={onDuplicateScenario ?? (() => {})}
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
      <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
        Report library
      </SectionTitleWithIcon>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      {REPORT_SECTION_ORDER.map((sectionId) => {
        const sectionCards = REPORT_CARDS.filter((c) => c.section === sectionId)
        if (sectionCards.length === 0) return null
        const sectionLabel = REPORT_SECTION_LABELS[sectionId]
        return (
          <section key={sectionId} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {sectionLabel}
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {sectionCards.map((card) => (
                <Card
                  key={card.id}
                  className={cardClass}
                  tabIndex={0}
                  role="button"
                  onClick={() => {
                    if (card.navigateOnly && card.id === 'compare-scenarios' && onNavigateToCompareScenarios) {
                      onNavigateToCompareScenarios()
                    } else if (card.navigateOnly && card.id === 'market-positioning' && onNavigateToBatchCard) {
                      onNavigateToBatchCard('imputed-vs-market')
                    } else if (card.navigateOnly && card.id === 'cf-optimizer' && onNavigateToBatchCard) {
                      onNavigateToBatchCard('cf-optimizer')
                    } else if (card.navigateOnly && card.id === 'productivity-target' && onNavigateToBatchCard) {
                      onNavigateToBatchCard('productivity-target')
                    } else if (!card.navigateOnly) {
                      setReportView(card.id as ReportViewId)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (card.navigateOnly && card.id === 'compare-scenarios' && onNavigateToCompareScenarios) {
                        onNavigateToCompareScenarios()
                      } else if (card.navigateOnly && card.id === 'market-positioning' && onNavigateToBatchCard) {
                        onNavigateToBatchCard('imputed-vs-market')
                      } else if (card.navigateOnly && card.id === 'cf-optimizer' && onNavigateToBatchCard) {
                        onNavigateToBatchCard('cf-optimizer')
                      } else if (card.navigateOnly && card.id === 'productivity-target' && onNavigateToBatchCard) {
                        onNavigateToBatchCard('productivity-target')
                      } else if (!card.navigateOnly) {
                        setReportView(card.id as ReportViewId)
                      }
                    }
                  }}
                >
                  <CardContent className="flex flex-col gap-3 pt-6 flex-1">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {card.icon}
                    </span>
                    <h3 className="font-semibold text-foreground shrink-0">{card.title}</h3>
                    <p className="text-muted-foreground text-sm flex-1 min-h-[2.5rem]">{card.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
