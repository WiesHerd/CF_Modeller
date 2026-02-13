import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ModellerStep = 'provider' | 'scenario' | 'market' | 'results'

const STEPS: { id: ModellerStep; num: number; label: string }[] = [
  { id: 'provider', num: 1, label: 'Provider' },
  { id: 'scenario', num: 2, label: 'Scenario' },
  { id: 'market', num: 3, label: 'Market data' },
  { id: 'results', num: 4, label: 'Results' },
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
      {/* Step-through: same style as batch/optimizer (numbered labels, chevrons, purple active) */}
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Modeller steps"
      >
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-1.5">
            {idx > 0 ? (
              <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
            ) : null}
            <button
              type="button"
              onClick={() => onStepChange(step.id)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                currentStep === step.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-current={currentStep === step.id ? 'step' : undefined}
            >
              {step.num}. {step.label}
            </button>
          </div>
        ))}
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
