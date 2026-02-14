import { useCallback, useState } from 'react'
import { ArrowLeft, FileSpreadsheet, GitCompare, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { CompareScenariosContent } from '@/features/optimizer/components/compare-scenarios-content'
import { exportComparisonToExcel } from '@/lib/compare-scenarios-export'
import type { OptimizerScenarioComparison, SavedOptimizerConfig } from '@/types/optimizer'

export interface CompareScenariosScreenProps {
  savedOptimizerConfigs: SavedOptimizerConfig[]
  onBack: () => void
}

export function CompareScenariosScreen({
  savedOptimizerConfigs,
  onBack,
}: CompareScenariosScreenProps) {
  const [comparisonData, setComparisonData] = useState<{
    comparison: OptimizerScenarioComparison
    nameA: string
    nameB: string
  } | null>(null)

  const handleComparisonChange = useCallback(
    (data: { comparison: OptimizerScenarioComparison; nameA: string; nameB: string } | null) => {
      setComparisonData(data)
    },
    []
  )

  const handleExportExcel = useCallback(() => {
    if (!comparisonData) return
    exportComparisonToExcel(comparisonData.comparison, comparisonData.nameA, comparisonData.nameB)
  }, [comparisonData])

  const reportDate = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-2"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <SectionTitleWithIcon icon={<GitCompare className="size-5 text-muted-foreground" />}>
            Compare scenarios
          </SectionTitleWithIcon>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          disabled={!comparisonData}
          className="gap-2"
          aria-label="Export to Excel"
        >
          <FileSpreadsheet className="size-4" />
          Export to Excel
        </Button>
      </div>

      <div className="compare-scenarios-report">
        <header className="border-b border-border/60 pb-4 mb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Scenario comparison report
            </h1>
            <span className="text-xs text-muted-foreground tabular-nums">
              Generated {reportDate}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Confidential — compensation planning
          </p>
        </header>

        <CompareScenariosContent
          savedOptimizerConfigs={savedOptimizerConfigs}
          onComparisonChange={handleComparisonChange}
        />
      </div>
    </div>
  )
}
