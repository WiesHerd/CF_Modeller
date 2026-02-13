import { Card, CardContent } from '@/components/ui/card'
import { Upload, PenLine, TrendingUp, LayoutGrid, Sliders, BarChart2, FileUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BatchCardId } from '@/components/batch/batch-card-picker'

const UPLOAD_CARD = {
  id: 'upload' as const,
  title: 'Upload',
  description: 'Load provider and market data from CSV files. Required for single model from upload and batch workflows.',
  icon: <FileUp className="size-6" />,
}

const SINGLE_CARDS: { id: 'from-upload' | 'custom'; title: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'from-upload',
    title: 'Single model from upload',
    description: 'Use a provider from your uploaded file. Select provider and specialty, then run your scenario.',
    icon: <Upload className="size-6" />,
  },
  {
    id: 'custom',
    title: 'Custom single scenario',
    description: 'Enter your own compensation and productivity data — no upload required for this provider.',
    icon: <PenLine className="size-6" />,
  },
]

const BATCH_CARDS: { id: BatchCardId; title: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'cf-optimizer',
    title: 'Conversion Factor Optimizer',
    description: 'Recommends specialty-level CF adjustments to align productivity and pay positioning, with governance guardrails and audit-ready outputs.',
    icon: <TrendingUp className="size-6" />,
  },
  {
    id: 'imputed-vs-market',
    title: 'Market positioning (imputed)',
    description: 'Compare your effective $/wRVU to market 25th–90th by specialty; see your percentile and market CF targets.',
    icon: <BarChart2 className="size-6" />,
  },
  {
    id: 'bulk-scenario',
    title: 'Bulk scenario planning',
    description: 'Global base scenario settings and run for the entire batch.',
    icon: <LayoutGrid className="size-6" />,
  },
  {
    id: 'detailed-scenario',
    title: 'Detailed scenario planning',
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
  onSingleFromUpload: () => void
  onCustomSingleScenario: () => void
  onBatchCard: (id: BatchCardId) => void
}

export function HomeScreen({
  dataStatus,
  onUpload,
  onSingleFromUpload,
  onCustomSingleScenario,
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
            No data loaded yet — go to Upload to load provider and market files.
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
          Single provider
        </h3>
        <p className="text-muted-foreground text-sm -mt-1">Model TCC for one provider.</p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 items-stretch">
          <Card
            className={cardClass}
            tabIndex={0}
            role="button"
            onClick={onSingleFromUpload}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSingleFromUpload()
              }
            }}
          >
            <CardContent className="flex flex-col gap-3 pt-6 flex-1">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {SINGLE_CARDS[0].icon}
              </span>
              <h3 className="font-semibold text-foreground shrink-0">{SINGLE_CARDS[0].title}</h3>
              <p className="text-muted-foreground text-sm flex-1 min-h-[2.5rem]">{SINGLE_CARDS[0].description}</p>
            </CardContent>
          </Card>
          <Card
            className={cardClass}
            tabIndex={0}
            role="button"
            onClick={onCustomSingleScenario}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onCustomSingleScenario()
              }
            }}
          >
            <CardContent className="flex flex-col gap-3 pt-6 flex-1">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {SINGLE_CARDS[1].icon}
              </span>
              <h3 className="font-semibold text-foreground shrink-0">{SINGLE_CARDS[1].title}</h3>
              <p className="text-muted-foreground text-sm flex-1 min-h-[2.5rem]">{SINGLE_CARDS[1].description}</p>
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
