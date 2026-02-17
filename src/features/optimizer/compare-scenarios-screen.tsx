import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileSpreadsheet, GitCompare, Lock, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompareScenariosContent } from '@/features/optimizer/components/compare-scenarios-content'
import { CompareTargetScenariosContent } from '@/features/optimizer/components/compare-target-scenarios-content'
import { exportComparisonToExcel } from '@/lib/compare-scenarios-export'
import { exportTargetComparisonToExcel } from '@/lib/compare-target-scenarios-export'
import type { OptimizerScenarioComparisonN, SavedOptimizerConfig } from '@/types/optimizer'
import type {
  ProductivityTargetScenarioComparisonN,
  SavedProductivityTargetConfig,
} from '@/types/productivity-target'

export type CompareTool = 'cf-optimizer' | 'productivity-target'

export interface CompareScenariosScreenProps {
  savedOptimizerConfigs: SavedOptimizerConfig[]
  savedProductivityTargetConfigs?: SavedProductivityTargetConfig[]
  /** When provided, preselect this tool tab (e.g. when navigating from Target Optimizer). */
  compareSource?: CompareTool
  onBack: () => void
}

export function CompareScenariosScreen({
  savedOptimizerConfigs,
  savedProductivityTargetConfigs = [],
  compareSource,
  onBack,
}: CompareScenariosScreenProps) {
  const [compareTool, setCompareTool] = useState<CompareTool>(compareSource ?? 'cf-optimizer')

  useEffect(() => {
    if (compareSource != null) {
      setCompareTool(compareSource)
    }
  }, [compareSource])

  const [cfComparisonData, setCfComparisonData] = useState<{
    comparison: OptimizerScenarioComparisonN
    scenarioNames: string[]
  } | null>(null)

  const [targetComparisonData, setTargetComparisonData] = useState<{
    comparison: ProductivityTargetScenarioComparisonN
    scenarioNames: string[]
  } | null>(null)

  const handleCfComparisonChange = useCallback(
    (data: { comparison: OptimizerScenarioComparisonN; scenarioNames: string[] } | null) => {
      setCfComparisonData(data)
    },
    []
  )

  const handleTargetComparisonChange = useCallback(
    (data: {
      comparison: ProductivityTargetScenarioComparisonN
      scenarioNames: string[]
    } | null) => {
      setTargetComparisonData(data)
    },
    []
  )

  const currentComparisonData =
    compareTool === 'cf-optimizer' ? cfComparisonData : targetComparisonData

  const handleExportExcel = useCallback(() => {
    if (compareTool === 'cf-optimizer' && cfComparisonData) {
      exportComparisonToExcel(cfComparisonData.comparison, cfComparisonData.scenarioNames)
    } else if (compareTool === 'productivity-target' && targetComparisonData) {
      exportTargetComparisonToExcel(
        targetComparisonData.comparison,
        targetComparisonData.scenarioNames
      )
    }
  }, [compareTool, cfComparisonData, targetComparisonData])

  const reportDate = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Title row — match CF Optimizer / Productivity Target */}
      <SectionTitleWithIcon icon={<GitCompare className="size-5 text-muted-foreground" />}>
        Compare scenarios
      </SectionTitleWithIcon>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground -mt-4">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Confidential
        <span className="tabular-nums"> · {reportDate}</span>
      </p>
      {/* Action row: Back left, Export right — match other optimizer screens */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          disabled={!currentComparisonData}
          className="gap-2"
          aria-label="Export to Excel"
        >
          <FileSpreadsheet className="size-4" />
          Export to Excel
        </Button>
      </div>

      {/* Optimizer tabs */}
      <Tabs
        value={compareTool}
        onValueChange={(v) => setCompareTool(v as CompareTool)}
        className="w-full"
      >
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-border/60 pb-2">
          <TabsList className="h-9 w-full sm:w-auto">
            <TabsTrigger value="cf-optimizer" className="gap-1.5 text-sm">
              <span className="hidden sm:inline">CF Optimizer</span>
              <span className="sm:hidden">CF</span>
            </TabsTrigger>
            <TabsTrigger value="productivity-target" className="gap-1.5 text-sm">
              <Target className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Target Optimizer</span>
              <span className="sm:hidden">Target</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="cf-optimizer" className="mt-2">
          <CompareScenariosContent
            savedOptimizerConfigs={savedOptimizerConfigs}
            onComparisonChange={handleCfComparisonChange}
          />
        </TabsContent>
        <TabsContent value="productivity-target" className="mt-2">
          <CompareTargetScenariosContent
            savedProductivityTargetConfigs={savedProductivityTargetConfigs}
            onComparisonChange={handleTargetComparisonChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
