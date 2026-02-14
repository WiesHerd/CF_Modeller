import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import type { AppStep } from '@/components/layout/app-layout'
import type { BatchCardId } from '@/components/batch/batch-card-picker'
import { Sparkles } from 'lucide-react'

export interface HelpScreenProps {
  onNavigate?: (step: AppStep, batchCard?: BatchCardId) => void
}

export function HelpScreen({ onNavigate }: HelpScreenProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className="gap-2" aria-label="Take a quick tour">
              <Sparkles className="size-4" />
              Take a quick tour
            </Button>
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
      <HelpContent onNavigate={onNavigate} />
    </div>
  )
}
