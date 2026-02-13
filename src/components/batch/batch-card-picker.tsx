import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, LayoutGrid, Sliders, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BatchCardId = 'cf-optimizer' | 'imputed-vs-market' | 'bulk-scenario' | 'detailed-scenario'

interface BatchCardPickerProps {
  onSelect: (card: BatchCardId) => void
  className?: string
}

const CARDS: { id: BatchCardId; title: string; description: string; icon: React.ReactNode }[] = [
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

export function BatchCardPicker({ onSelect, className }: BatchCardPickerProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-muted-foreground text-sm">
        Choose a batch workflow:
      </p>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 items-stretch">
        {CARDS.map((card) => (
          <Card
            key={card.id}
            className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 h-full min-h-[220px] flex flex-col"
            tabIndex={0}
            role="button"
            onClick={() => onSelect(card.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(card.id)
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
