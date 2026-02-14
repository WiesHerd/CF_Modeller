import { ChevronLeft, ChevronRight, Check, User, Sliders, BarChart3, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ModellerStep = 'provider' | 'scenario' | 'market' | 'results'

const STEPS: { id: ModellerStep; num: number; label: string; icon: React.ReactNode }[] = [
  { id: 'provider', num: 1, label: 'Provider', icon: <User className="size-4" /> },
  { id: 'scenario', num: 2, label: 'Scenario', icon: <Sliders className="size-4" /> },
  { id: 'market', num: 3, label: 'Market data', icon: <BarChart3 className="size-4" /> },
  { id: 'results', num: 4, label: 'Results', icon: <FileCheck className="size-4" /> },
]

interface ModellerStepperProps {
  currentStep: ModellerStep
  onStepChange: (step: ModellerStep) => void
  canAdvanceFromProvider: boolean
  canAdvanceFromScenario: boolean
  canAdvanceFromMarket: boolean
  /** When false, only step chips are shown; Back/Next are rendered elsewhere (e.g. footer). */
  showNavButtons?: boolean
}

export function ModellerStepper({
  currentStep,
  onStepChange,
  canAdvanceFromProvider,
  canAdvanceFromScenario,
  canAdvanceFromMarket,
  showNavButtons = true,
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

  const nextStepLabel =
    currentStep === 'provider'
      ? STEPS[1].label
      : currentStep === 'scenario'
        ? STEPS[2].label
        : currentStep === 'market'
          ? STEPS[3].label
          : ''

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <nav
        className="flex min-h-11 w-full min-w-0 items-center gap-0 rounded-xl border border-border/60 bg-muted/20 p-1.5 sm:w-auto"
        aria-label="Modeller steps"
      >
        {STEPS.map((step, idx) => {
          const isActive = currentStep === step.id
          const isComplete = index > idx
          const isUpcoming = index < idx
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:gap-2">
              {idx > 0 ? (
                <div
                  className={cn(
                    'h-px min-w-[12px] flex-1 sm:min-w-4 sm:flex-initial',
                    isComplete ? 'bg-primary/30' : 'bg-border'
                  )}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                className={cn(
                  'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all sm:flex-initial',
                  'border-transparent',
                  isActive &&
                    'border-border bg-background text-foreground shadow-sm ring-2 ring-primary/30',
                  isComplete &&
                    !isActive &&
                    'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                  isUpcoming && 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    isActive && 'bg-primary text-primary-foreground',
                    isComplete &&
                      !isActive &&
                      'border border-primary/50 bg-primary/10 text-primary',
                    isUpcoming && 'border border-border bg-background/80'
                  )}
                >
                  {isComplete && !isActive ? <Check className="size-4" /> : step.num}
                </span>
                <span className="hidden truncate sm:inline">{step.label}</span>
                <span className="hidden shrink-0 text-muted-foreground/70 sm:inline [&_svg]:size-4">
                  {step.icon}
                </span>
              </button>
            </div>
          )
        })}
      </nav>
      {showNavButtons ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
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
              className="gap-1.5"
              onClick={goNext}
              disabled={!canGoNext}
            >
              Next: {nextStepLabel}
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
