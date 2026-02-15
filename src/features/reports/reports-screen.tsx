import { useState } from 'react'
import { ArrowLeft, FileText, FolderOpen, User, BarChart2, GitCompare, Gauge, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { TccWrvuPercentilesReport } from './tcc-wrvu-percentiles-report'
import { SavedBatchRunReport } from './saved-batch-run-report'
import { SingleProviderImpactReport } from './single-provider-impact-report'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs, SavedScenario } from '@/types/scenario'
import type { SavedBatchRun } from '@/types/batch'
import type { SynonymMap } from '@/types/batch'
import { cn } from '@/lib/utils'

export type ReportViewId = 'list' | 'tcc-wrvu' | 'saved-run' | 'impact' | 'compare-scenarios'

export type ReportLibraryCardId = ReportViewId | 'market-positioning' | 'cf-optimizer'

const REPORT_CARDS: { id: ReportLibraryCardId; title: string; description: string; icon: React.ReactNode; navigateOnly?: boolean }[] = [
  {
    id: 'tcc-wrvu',
    title: 'TCC & wRVU percentiles',
    description: 'Total cash compensation and work RVU percentiles for all loaded providers under one scenario.',
    icon: <BarChart2 className="size-6" />,
  },
  {
    id: 'saved-run',
    title: 'Saved batch run',
    description: 'View and export a saved batch run: TCC and wRVU summary and metrics.',
    icon: <FolderOpen className="size-6" />,
  },
  {
    id: 'impact',
    title: 'Compensation impact report',
    description: 'Single-provider compensation impact: TCC waterfall, market percentiles, and summary.',
    icon: <User className="size-6" />,
  },
  {
    id: 'compare-scenarios',
    title: 'Scenario comparison',
    description: 'Compare two saved optimizer scenarios side-by-side and export to Excel.',
    icon: <GitCompare className="size-6" />,
    navigateOnly: true,
  },
  {
    id: 'market-positioning',
    title: 'Market positioning',
    description: 'Effective $/wRVU by specialty vs market 25th–90th; export for research.',
    icon: <TrendingUp className="size-6" />,
    navigateOnly: true,
  },
  {
    id: 'cf-optimizer',
    title: 'Conversion factor analysis',
    description: 'Specialty-level CF recommendations and policy guardrails; export to Excel.',
    icon: <Gauge className="size-6" />,
    navigateOnly: true,
  },
]

const cardClass = cn(
  'cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  'h-full min-h-[160px] flex flex-col'
)

export interface ReportsScreenProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  scenarioInputs: ScenarioInputs
  savedScenarios: SavedScenario[]
  savedBatchRuns: SavedBatchRun[]
  batchSynonymMap: SynonymMap
  onBack: () => void
  /** When provided, the Scenario comparison card navigates to Compare scenarios. */
  onNavigateToCompareScenarios?: () => void
  /** When provided, Market positioning and Conversion factor analysis cards navigate to Batch. */
  onNavigateToBatchCard?: (id: 'imputed-vs-market' | 'cf-optimizer') => void
}

export function ReportsScreen({
  providerRows,
  marketRows,
  scenarioInputs,
  savedScenarios,
  savedBatchRuns,
  batchSynonymMap,
  onBack,
  onNavigateToCompareScenarios,
  onNavigateToBatchCard,
}: ReportsScreenProps) {
  const [reportView, setReportView] = useState<ReportViewId>('list')
  const [selectedSavedRunId, setSelectedSavedRunId] = useState<string | null>(null)

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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {REPORT_CARDS.map((card) => (
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
    </div>
  )
}
