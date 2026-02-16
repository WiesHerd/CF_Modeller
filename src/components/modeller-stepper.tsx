import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  /** When false, Back/Next are rendered elsewhere (e.g. footer); this component renders nothing. */
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
  const canGoNext =
    (currentStep === 'provider' && canAdvanceFromProvider) ||
    (currentStep === 'scenario' && canAdvanceFromScenario) ||
    (currentStep === 'market' && canAdvanceFromMarket)
  const index = STEPS.findIndex((s) => s.id === currentStep)
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

  if (!showNavButtons) return null

  return (
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
  )
}
