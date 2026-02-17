import { Target, Play, RotateCcw, FileDown, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ProductivityTargetRunResult } from '@/types/productivity-target'
import { ProductivityTargetReviewWorkspace } from '@/features/productivity-target/productivity-target-review-workspace'

export function ProductivityTargetRunStage({
  hasData,
  result,
  runDisabled,
  onRun,
  onStartOver,
  onExport,
}: {
  hasData: boolean
  result: ProductivityTargetRunResult | null
  runDisabled: boolean
  onRun: () => void
  onStartOver: () => void
  onExport: () => void
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
              <Target />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="leading-tight">Run and review</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="About Run and review"
                  >
                    <Info className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                  Run again recalculates with current data; Start over returns to configuration. Click a specialty row to open the detail drawer with group target, “how target is set,” and the provider table.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!result && hasData ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onRun} disabled={runDisabled} className="gap-2">
                <Play className="size-4" />
                Run
              </Button>
            </div>
          ) : null}

          {result ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onRun} disabled={runDisabled} className="gap-2">
                  <Play className="size-4" />
                  Run again
                </Button>
                <Button type="button" variant="outline" onClick={onStartOver} className="gap-2">
                  <RotateCcw className="size-4" />
                  Start over
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onExport} className="gap-2">
                  <FileDown className="size-4" />
                  Export CSV
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                <span className="font-medium tabular-nums">{result.bySpecialty.length}</span> specialties
                {' · '}
                <span className="font-medium tabular-nums">
                  {result.bySpecialty.reduce((sum, s) => sum + s.providers.length, 0)}
                </span>{' '}
                providers
              </p>

              <ProductivityTargetReviewWorkspace result={result} />
            </>
          ) : null}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
