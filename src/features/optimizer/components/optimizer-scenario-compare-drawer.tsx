import { GitCompare } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CompareScenariosContent } from '@/features/optimizer/components/compare-scenarios-content'
import type { SavedOptimizerConfig } from '@/types/optimizer'

export interface OptimizerScenarioCompareDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  savedOptimizerConfigs: SavedOptimizerConfig[]
}

export function OptimizerScenarioCompareDrawer({
  open,
  onOpenChange,
  savedOptimizerConfigs,
}: OptimizerScenarioCompareDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-6 overflow-hidden px-6 py-5 sm:max-w-[720px] md:max-w-[840px] border-border"
      >
        <SheetHeader className="space-y-1.5 border-b border-border/60 pb-5">
          <SheetTitle className="flex items-center gap-2 pr-8 text-xl font-semibold tracking-tight text-foreground">
            <GitCompare className="size-5 text-muted-foreground" />
            Compare scenarios
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground leading-relaxed">
            Select two saved optimizer runs to see how they differ in total cash comp, productivity
            alignment, budget impact, and governance.
          </SheetDescription>
        </SheetHeader>

        <CompareScenariosContent savedOptimizerConfigs={savedOptimizerConfigs} />
      </SheetContent>
    </Sheet>
  )
}
