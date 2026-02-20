import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { HelpContent } from '@/features/help/help-content'
import { HelpWizard } from '@/features/help/help-wizard'
import { GoalWizard } from '@/features/help/goal-wizard'
import type { AppStep } from '@/components/layout/app-layout'
import type { BatchCardId } from '@/components/batch/batch-card-picker'
import { Sparkles, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface HelpScreenProps {
  onNavigate?: (step: AppStep, batchCard?: BatchCardId) => void
}

export function HelpScreen({ onNavigate }: HelpScreenProps) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [goalWizardOpen, setGoalWizardOpen] = useState(false)

  return (
    <div className="space-y-10">
      {/* Hero + primary CTAs — product-style help center */}
      <div
        className={cn(
          'rounded-2xl border border-border/80 bg-gradient-to-br from-muted/40 via-muted/20 to-background',
          'px-6 py-8 sm:px-8 sm:py-10',
          'shadow-sm'
        )}
      >
        <div className="max-w-2xl mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            How to use TCC Modeler
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Get started with guided flows or explore the full docs below.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Dialog open={goalWizardOpen} onOpenChange={setGoalWizardOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  'group flex items-start gap-4 rounded-xl border border-border/80 bg-card p-5 text-left',
                  'transition-colors hover:border-primary/30 hover:bg-muted/30',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                )}
                aria-label="Find what I need"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Compass className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">Find what I need</span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Answer a quick question and we’ll point you to the right place with clear next steps.
                  </p>
                </div>
                <span className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </button>
            </DialogTrigger>
            <DialogContent
              className="max-w-[420px] rounded-xl border-border/80 shadow-xl gap-0 overflow-hidden flex flex-col max-h-[85vh]"
              aria-describedby="goal-wizard-description"
            >
              <DialogHeader className="pb-4">
                <DialogTitle>What do you want to do?</DialogTitle>
                <DialogDescription id="goal-wizard-description">
                  Choose what you want to do to see where to go and what to do there.
                </DialogDescription>
              </DialogHeader>
              <GoalWizard
                onNavigate={(step, batchCard) => {
                  onNavigate?.(step, batchCard)
                  setGoalWizardOpen(false)
                }}
                onClose={() => setGoalWizardOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  'group flex items-start gap-4 rounded-xl border border-border/80 bg-card p-5 text-left',
                  'transition-colors hover:border-primary/30 hover:bg-muted/30',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                )}
                aria-label="Take a quick tour"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">Take a quick tour</span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A short walkthrough of each part of the app. Use “Try it” to jump to any screen.
                  </p>
                </div>
                <span className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[480px] max-h-[85vh] overflow-y-auto" aria-describedby="wizard-description">
              <DialogHeader>
                <DialogTitle>Quick tour</DialogTitle>
                <DialogDescription id="wizard-description">
                  A short walkthrough of each part of the app. Use “Try it” to jump to that screen.
                </DialogDescription>
              </DialogHeader>
              <HelpWizard
                onNavigate={(step, batchCard) => {
                  onNavigate?.(step, batchCard)
                  setWizardOpen(false)
                }}
                onClose={() => setWizardOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <HelpContent onNavigate={onNavigate} />
    </div>
  )
}
