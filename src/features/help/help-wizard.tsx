import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileUp, Table2, User, LayoutGrid, GitCompare, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import type { AppStep } from '@/components/layout/app-layout'
import type { BatchCardId } from '@/components/batch/batch-card-picker'
import { iconBoxClass } from '@/components/section-title-with-icon'
import { cn } from '@/lib/utils'

export interface HelpWizardProps {
  /** When provided, "Try it" buttons navigate to the given step (and optional batch card). */
  onNavigate?: (step: AppStep, batchCard?: BatchCardId) => void
  /** Optional: called when user clicks "Try it" so the host can close a dialog or switch view. */
  onClose?: () => void
}

const WIZARD_STEPS: {
  id: number
  title: string
  body: React.ReactNode
  icon: React.ReactNode
  tryItStep?: AppStep
  tryItBatchCard?: BatchCardId
  tryItLabel?: string
}[] = [
  {
    id: 1,
    title: 'Overview',
    icon: <Sparkles className="size-5" />,
    body: (
      <>
        <p className="text-muted-foreground text-sm mb-2">
          TCC Modeler helps you model total cash compensation for physicians. You can work on a single provider or run batch scenarios across your entire cohort.
        </p>
        <p className="text-muted-foreground text-sm">
          Flow: <strong className="text-foreground">Import data</strong> → optionally <strong className="text-foreground">browse data</strong> → run a <strong className="text-foreground">single scenario</strong> or <strong className="text-foreground">batch</strong> workflows → <strong className="text-foreground">review and compare</strong> results.
        </p>
      </>
    ),
  },
  {
    id: 2,
    title: 'Import data',
    icon: <FileUp className="size-5" />,
    body: (
      <>
        <p className="text-muted-foreground text-sm mb-2">
          Start here. Upload provider and market CSV files, map columns, and set up specialty synonyms for batch. Everything else depends on having data loaded.
        </p>
        <p className="text-muted-foreground text-sm">
          You can save and load scenarios, or reset and start over.
        </p>
      </>
    ),
    tryItStep: 'upload',
    tryItLabel: 'Go to Import data',
  },
  {
    id: 3,
    title: 'Data browser',
    icon: <Table2 className="size-5" />,
    body: (
      <>
        <p className="text-muted-foreground text-sm">
          After importing, use the Data browser to view and filter your provider and market tables. Verify uploads and inspect values before running scenarios.
        </p>
      </>
    ),
    tryItStep: 'data',
    tryItLabel: 'Go to Data browser',
  },
  {
    id: 4,
    title: 'Single scenario',
    icon: <User className="size-5" />,
    body: (
      <>
        <p className="text-muted-foreground text-sm mb-2">
          Model one provider: choose from your upload or enter custom data. Then set scenario levers (CF, wRVU target, PSQ), view market data, and see the impact report and governance flags.
        </p>
        <p className="text-muted-foreground text-sm">
          Steps: Provider → Scenario → Market data → Results.
        </p>
      </>
    ),
    tryItStep: 'modeller',
    tryItLabel: 'Go to Single scenario',
  },
  {
    id: 5,
    title: 'Batch',
    icon: <LayoutGrid className="size-5" />,
    body: (
      <>
        <p className="text-muted-foreground text-sm mb-2">
          Four batch options:
        </p>
        <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-1 mb-2">
          <li><strong className="text-foreground">CF Optimizer</strong> — specialty-level CF recommendations and guardrails</li>
          <li><strong className="text-foreground">Market positioning</strong> — your $/wRVU vs market percentiles by specialty</li>
          <li><strong className="text-foreground">Create and Run Scenario</strong> — one scenario for all providers</li>
          <li><strong className="text-foreground">Detailed scenarios</strong> — overrides by specialty and provider</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          After a run, you land on Scenario results to view and export.
        </p>
      </>
    ),
    tryItStep: 'batch-scenario',
    tryItBatchCard: 'bulk-scenario',
    tryItLabel: 'Go to Batch',
  },
  {
    id: 6,
    title: 'Compare scenarios',
    icon: <GitCompare className="size-5" />,
    body: (
      <>
        <p className="text-muted-foreground text-sm">
          After saving at least two CF Optimizer scenarios, use Compare scenarios to view them side-by-side and export the comparison.
        </p>
      </>
    ),
    tryItStep: 'compare-scenarios',
    tryItLabel: 'Go to Compare scenarios',
  },
  {
    id: 7,
    title: "You're ready",
    icon: <Sparkles className="size-5" />,
    body: (
      <>
        <p className="text-muted-foreground text-sm mb-2">
          You now know where each screen lives and when to use it. Start with Import data if you haven’t loaded data yet, or jump to any screen from the sidebar.
        </p>
        <p className="text-muted-foreground text-sm">
          For more detail on any screen, use the full “How to use” content on this page.
        </p>
      </>
    ),
    tryItStep: 'upload',
    tryItLabel: 'Start — Import data',
  },
]

export function HelpWizard({ onNavigate, onClose }: HelpWizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = WIZARD_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === WIZARD_STEPS.length - 1

  const handleTryIt = () => {
    if (step.tryItStep) {
      onNavigate?.(step.tryItStep, step.tryItBatchCard)
      onClose?.()
    }
  }

  const progressPercent = ((stepIndex + 1) / WIZARD_STEPS.length) * 100

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step.id} of {WIZARD_STEPS.length}</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={WIZARD_STEPS.length}
          aria-label={`Step ${step.id} of ${WIZARD_STEPS.length}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className={cn(iconBoxClass, 'size-10 [&_svg]:size-5')}>
          {step.icon}
        </div>
        <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
      </div>
      <div className="min-h-[100px] text-sm">
        {step.body}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            className="gap-1.5"
            aria-label="Previous step"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          {!isLast ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStepIndex((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))}
              className="gap-1.5"
              aria-label="Next step"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          ) : null}
        </div>
        {step.tryItStep && onNavigate && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTryIt}
            className="gap-1.5"
            aria-label={step.tryItLabel ?? 'Try it'}
          >
            {step.tryItLabel ?? 'Try it'}
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
