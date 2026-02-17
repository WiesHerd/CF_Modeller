import { Card, CardContent } from '@/components/ui/card'
import { User, Gauge, BarChart2, Target, LayoutGrid, Sliders, FileUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BatchCardId } from '@/components/batch/batch-card-picker'

const UPLOAD_CARD = {
  id: 'upload' as const,
  title: 'Import data',
  description: 'Load provider and market data from CSV files. Required for single scenario and batch workflows.',
  icon: <FileUp className="size-6" />,
}

const SINGLE_CARD = {
  id: 'single' as const,
  title: 'Single scenario',
  description: 'Model TCC for one provider. Use data from your upload or enter custom compensation and productivity data.',
  icon: <User className="size-6" />,
}

const BATCH_CARDS: { id: BatchCardId; title: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'cf-optimizer',
    title: 'Conversion Factor Optimizer',
    description: 'Recommends specialty-level CF adjustments to align productivity and pay positioning, with governance guardrails and audit-ready outputs.',
    icon: <Gauge className="size-6" />,
  },
  {
    id: 'imputed-vs-market',
    title: 'Market positioning (imputed)',
    description: 'Compare your effective $/wRVU to market 25th–90th by specialty; see your percentile and market CF targets.',
    icon: <BarChart2 className="size-6" />,
  },
  {
    id: 'productivity-target',
    title: 'Productivity Target Builder',
    description: 'Set a group wRVU target per specialty (1.0 cFTE) and scale by cFTE; compare actuals to target, plan incentive, and export.',
    icon: <Target className="size-6" />,
  },
  {
    id: 'bulk-scenario',
    title: 'Create and Run Scenario',
    description: 'Apply one set of inputs (CF, wRVU target, PSQ) to all providers and run. Use scope and guardrails to filter who’s included.',
    icon: <LayoutGrid className="size-6" />,
  },
  {
    id: 'detailed-scenario',
    title: 'Detailed scenarios',
    description: 'Overrides by specialty and by provider, then run.',
    icon: <Sliders className="size-6" />,
  },
]

const cardClass = cn(
  'cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  'h-full min-h-[200px] flex flex-col'
)

export interface HomeDataStatus {
  providerCount: number
  marketRowCount: number
}

interface HomeScreenProps {
  dataStatus?: HomeDataStatus
  onUpload: () => void
  onSingleScenario: () => void
  onBatchCard: (id: BatchCardId) => void
}

export function HomeScreen({
  dataStatus,
  onUpload,
  onSingleScenario,
  onBatchCard,
}: HomeScreenProps) {
  const hasData = (dataStatus?.providerCount ?? 0) > 0 && (dataStatus?.marketRowCount ?? 0) > 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="section-title">What do you want to do?</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Upload data, then run a single-provider scenario or a batch workflow.
        </p>
        {!hasData && (
          <p className="text-muted-foreground/80 text-xs mt-2">
            No data loaded yet — go to Import data to load provider and market files.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Get started
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 items-stretch">
          <Card
            className={cardClass}
            tabIndex={0}
            role="button"
            onClick={onUpload}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onUpload()
              }
            }}
          >
            <CardContent className="flex flex-col gap-3 pt-6 flex-1">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {UPLOAD_CARD.icon}
              </span>
              <h3 className="font-semibold text-foreground shrink-0">{UPLOAD_CARD.title}</h3>
              <p className="text-muted-foreground text-sm flex-1 min-h-[2.5rem]">{UPLOAD_CARD.description}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Single scenario
        </h3>
        <p className="text-muted-foreground text-sm -mt-1">Model TCC for one provider. Choose from uploaded data or enter custom data on the next screen.</p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 items-stretch">
          <Card
            className={cardClass}
            tabIndex={0}
            role="button"
            onClick={onSingleScenario}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSingleScenario()
              }
            }}
          >
            <CardContent className="flex flex-col gap-3 pt-6 flex-1">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {SINGLE_CARD.icon}
              </span>
              <h3 className="font-semibold text-foreground shrink-0">{SINGLE_CARD.title}</h3>
              <p className="text-muted-foreground text-sm flex-1 min-h-[2.5rem]">{SINGLE_CARD.description}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Batch
        </h3>
        <p className="text-muted-foreground text-sm -mt-1">Run scenarios across your uploaded cohort.</p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 items-stretch">
          {BATCH_CARDS.map((card) => (
            <Card
              key={card.id}
              className={cardClass}
              tabIndex={0}
              role="button"
              onClick={() => onBatchCard(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onBatchCard(card.id)
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
    </div>
  )
}
