import { ChevronLeft, ChevronRight, User, Sliders, Database, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ModellerStep = 'provider' | 'scenario' | 'market' | 'results'

const STEPS: { id: ModellerStep; label: string; icon: React.ReactNode }[] = [
  { id: 'provider', label: 'Provider', icon: <User className="size-4" /> },
  { id: 'scenario', label: 'Scenario', icon: <Sliders className="size-4" /> },
  { id: 'market', label: 'Market data', icon: <Database className="size-4" /> },
  { id: 'results', label: 'Results', icon: <BarChart3 className="size-4" /> },
]

interface ModellerStepperProps {
  currentStep: ModellerStep
  onStepChange: (step: ModellerStep) => void
  canAdvanceFromProvider: boolean
  canAdvanceFromScenario: boolean
  canAdvanceFromMarket: boolean
}

export function ModellerStepper({
  currentStep,
  onStepChange,
  canAdvanceFromProvider,
  canAdvanceFromScenario,
  canAdvanceFromMarket,
}: ModellerStepperProps) {
  const index = STEPS.findIndex((s) => s.id === currentStep)
  const canGoNext =
    (currentStep === 'provider' && canAdvanceFromProvider) ||
    (currentStep === 'scenario' && canAdvanceFromScenario) ||
    (currentStep === 'market' && canAdvanceFromMarket)
  const canGoPrev = index > 0
  const showNextButton = currentStep !== 'results'

  const goNext = () => {
    if (currentStep === 'provider' && canAdvanceFromProvider) onStepChange('scenario')
    else if (currentStep === 'scenario' && canAdvanceFromScenario) onStepChange('market')
    else if (currentStep === 'market' && canAdvanceFromMarket) onStepChange('results')
  }

  const goPrev = () => {
    if (currentStep === 'scenario') onStepChange('provider')
    else if (currentStep === 'market') onStepChange('scenario')
    else if (currentStep === 'results') onStepChange('market')
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <nav
        className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"
        aria-label="Modeller steps"
      >
        {STEPS.map((s, i) => {
          const isActive = s.id === currentStep
          const isPast = STEPS.findIndex((x) => x.id === currentStep) > i
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStepChange(s.id)}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                'border-transparent',
                isActive &&
                  'border-border bg-background text-foreground shadow-sm ring-1 ring-primary/20',
                !isActive &&
                  'bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground',
                isPast && !isActive && 'text-muted-foreground'
              )}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  isActive && 'border-2 border-primary bg-primary text-primary-foreground',
                  isPast && !isActive && 'border border-border bg-muted/50 text-muted-foreground',
                  !isActive && !isPast && 'border border-border bg-background/80'
                )}
              >
                {isPast ? '✓' : i + 1}
              </span>
              <span className="hidden truncate sm:inline">{s.label}</span>
              {s.icon}
            </button>
          )
        })}
      </nav>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={goPrev}
          disabled={!canGoPrev}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        {showNextButton && (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1"
            onClick={goNext}
            disabled={!canGoNext}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
