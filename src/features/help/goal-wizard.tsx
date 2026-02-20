import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FileUp,
  Table2,
  User,
  Gauge,
  BarChart2,
  Target,
  LayoutGrid,
  Sliders,
  Layers,
  GitCompare,
  FileText,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import type { AppStep } from '@/components/layout/app-layout'
import type { BatchCardId } from '@/components/batch/batch-card-picker'
import { cn } from '@/lib/utils'

const iconBoxClass =
  'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5'

export interface GoalWizardProps {
  /** When provided, "Take me there" navigates to the given step (and optional batch card). */
  onNavigate?: (step: AppStep, batchCard?: BatchCardId) => void
  /** Optional: called when user closes or finishes so the host can close a dialog. */
  onClose?: () => void
}

type GoalId =
  | 'import-data'
  | 'data-browser'
  | 'single-scenario'
  | 'cf-optimizer'
  | 'target-optimizer'
  | 'market-positioning'
  | 'bulk-scenario'
  | 'detailed-scenario'
  | 'batch-results'
  | 'compare-scenarios'
  | 'reports'

interface GoalConfig {
  id: GoalId
  label: string
  shortDescription: string
  icon: React.ReactNode
  step: AppStep
  batchCard?: BatchCardId
  body: React.ReactNode
}

const GOAL_SECTIONS = [
  {
    sectionLabel: 'Get started',
    goals: ['import-data', 'data-browser'] as GoalId[],
  },
  {
    sectionLabel: 'Model & analyze',
    goals: [
      'single-scenario',
      'cf-optimizer',
      'target-optimizer',
      'market-positioning',
      'bulk-scenario',
      'detailed-scenario',
      'batch-results',
    ] as GoalId[],
  },
  {
    sectionLabel: 'Compare & report',
    goals: ['compare-scenarios', 'reports'] as GoalId[],
  },
]

function makeGoals(): GoalConfig[] {
  return [
    {
      id: 'import-data',
      label: 'Load my data first',
      shortDescription: 'Upload provider and market CSVs, map columns',
      icon: <FileUp className="size-5" />,
      step: 'upload',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Load provider and market data from CSV files. Map columns to the expected fields and, for batch workflows, set up specialty synonym mapping so provider specialties align with market data.
          </p>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What to do:</strong> Upload your provider and market CSVs, map each column to the required fields, and configure specialty synonyms if you plan to run batch scenarios. You can save and load scenarios or reset and start over.
          </p>
        </>
      ),
    },
    {
      id: 'data-browser',
      label: 'Check my uploaded data',
      shortDescription: 'View and filter provider and market tables',
      icon: <Table2 className="size-5" />,
      step: 'data',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Browse and filter your uploaded provider and market data in tabular form. Switch between Provider and Market tabs to inspect rows, sort, and verify data before modeling.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> After importing, use the Data browser to verify uploads, inspect values, and confirm specialty names and counts before running single or batch scenarios.
          </p>
        </>
      ),
    },
    {
      id: 'single-scenario',
      label: 'Model one physician',
      shortDescription: 'Single provider: set CF, wRVU, PSQ, see impact',
      icon: <User className="size-5" />,
      step: 'modeller',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Model total cash compensation for one provider. Choose from your uploaded data or enter custom compensation and productivity data (hypothetical provider). Flow: Provider → Scenario → Market data → Results.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Select a provider (or enter custom data), set conversion factor, wRVU target, and PSQ, then view market data and the impact report with governance flags.
          </p>
        </>
      ),
    },
    {
      id: 'cf-optimizer',
      label: 'CF or target recommendations for my cohort',
      shortDescription: 'Specialty-level CF or wRVU target recommendations',
      icon: <Gauge className="size-5" />,
      step: 'batch-scenario',
      batchCard: 'cf-optimizer',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> CF Optimizer recommends specialty-level conversion factor adjustments to align productivity and pay positioning. Includes governance guardrails and audit-ready outputs. Save and compare optimizer scenarios.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Configure by specialty (and constraints), run the optimizer, then save your config. Use Compare scenarios later to view two saved configs side-by-side.
          </p>
        </>
      ),
    },
    {
      id: 'target-optimizer',
      label: 'Set productivity targets by specialty',
      shortDescription: 'wRVU targets per specialty, scale by cFTE',
      icon: <Target className="size-5" />,
      step: 'batch-scenario',
      batchCard: 'productivity-target',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Set a group wRVU target per specialty (1.0 cFTE) and scale by cFTE; compare actuals to target, plan incentive payout, and export.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Configure targets by specialty, run, then view results and export. Use when setting productivity expectations or planning incentive without individualized salary-based targets.
          </p>
        </>
      ),
    },
    {
      id: 'market-positioning',
      label: 'See how we compare to market',
      shortDescription: 'Your $/wRVU vs market percentiles by specialty',
      icon: <BarChart2 className="size-5" />,
      step: 'batch-scenario',
      batchCard: 'imputed-vs-market',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Compare your effective $/wRVU to market 25th–90th percentiles by specialty. See your percentile and market CF targets.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Open Market positioning, then filter or export as needed. Use for benchmarking and understanding where you sit vs. market by specialty.
          </p>
        </>
      ),
    },
    {
      id: 'bulk-scenario',
      label: 'Run one scenario for everyone',
      shortDescription: 'One set of CF, wRVU, PSQ for all providers',
      icon: <LayoutGrid className="size-5" />,
      step: 'batch-scenario',
      batchCard: 'bulk-scenario',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Apply one set of inputs (CF, wRVU target, PSQ) to all providers and run. Use scope and guardrails to filter who’s included.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Configure the single scenario (CF, wRVU target, PSQ), set scope and guardrails, then run. You’ll land on Scenario results to view and export.
          </p>
        </>
      ),
    },
    {
      id: 'detailed-scenario',
      label: 'Different assumptions by specialty or provider',
      shortDescription: 'Override CF or targets by specialty and provider',
      icon: <Sliders className="size-5" />,
      step: 'batch-scenario',
      batchCard: 'detailed-scenario',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Overrides by specialty and by provider, then run. More control than the bulk scenario when you need different assumptions for different groups or individuals.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Set overrides by specialty and optionally by provider, then run. Use for targeted what-ifs with different CF or targets by group or person.
          </p>
        </>
      ),
    },
    {
      id: 'batch-results',
      label: 'View or export batch run results',
      shortDescription: 'Dashboard and table after a batch run',
      icon: <Layers className="size-5" />,
      step: 'batch-results',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> The screen you land on after running a bulk or detailed batch scenario. View and export results; save runs; switch between saved runs.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Review the dashboard and table, save or load batch runs, and export or drill into row-level calculations as needed.
          </p>
        </>
      ),
    },
    {
      id: 'compare-scenarios',
      label: 'Compare two saved plans side-by-side',
      shortDescription: 'Two CF Optimizer or target configs, diff and export',
      icon: <GitCompare className="size-5" />,
      step: 'compare-scenarios',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Compare two saved optimizer scenarios side-by-side. View differences and export the comparison.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> After you’ve saved at least two CF Optimizer (or target) configs, open Compare scenarios, select the two configs, then view the side-by-side comparison and export.
          </p>
        </>
      ),
    },
    {
      id: 'reports',
      label: 'Export reports or run quick analysis',
      shortDescription: 'Quick Run CF, TCC & wRVU, Impact, Saved Run, more',
      icon: <FileText className="size-5" />,
      step: 'reports',
      body: (
        <>
          <p className="text-muted-foreground text-sm mb-2">
            <strong className="text-foreground">What it does:</strong> Report library with Quick Run CF (recommended $/wRVU by specialty), TCC & wRVU percentiles, single-provider Impact report, Saved Batch Run, Custom CF by specialty, and Manage scenarios. Filter and export to CSV or Excel.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">What to do:</strong> Open Reports, pick the report you need from the library, apply filters (e.g. specialty, provider), then export. Some cards navigate to Batch or Compare instead of opening a report.
          </p>
        </>
      ),
    },
  ]
}

const GOALS = makeGoals()
const GOALS_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g])) as Record<GoalId, GoalConfig>

export function GoalWizard({ onNavigate, onClose }: GoalWizardProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<GoalId | null>(null)
  const takeMeThereRef = useRef<HTMLButtonElement>(null)

  const selectedGoal = selectedGoalId ? GOALS_BY_ID[selectedGoalId] : null

  useEffect(() => {
    if (selectedGoalId && takeMeThereRef.current) {
      takeMeThereRef.current.focus()
    }
  }, [selectedGoalId])

  const handleTakeMeThere = () => {
    if (!selectedGoal) return
    onNavigate?.(selectedGoal.step, selectedGoal.batchCard)
    onClose?.()
  }

  const handleBack = () => {
    setSelectedGoalId(null)
  }

  if (selectedGoal) {
    return (
      <div className="flex flex-col gap-5" role="region" aria-label="Goal explanation">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-1.5 -ml-2 w-fit text-muted-foreground hover:text-foreground"
          aria-label="Back to choices"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="flex items-start gap-3">
          <span className={iconBoxClass}>{selectedGoal.icon}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">{selectedGoal.label}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{selectedGoal.shortDescription}</p>
          </div>
        </div>
        <ScrollArea className="max-h-[220px] rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <div className="pr-2 text-sm">{selectedGoal.body}</div>
        </ScrollArea>
        {onNavigate && (
          <Button
            ref={takeMeThereRef}
            type="button"
            size="sm"
            onClick={handleTakeMeThere}
            className="w-full gap-1.5 sm:w-auto"
            aria-label={`Take me to ${selectedGoal.label}`}
          >
            Take me there
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4" role="region" aria-label="What do you want to do?">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Choose what you want to do. We’ll show you where to go and what to do there.
      </p>
      <div
        className="min-h-0 h-[min(60vh,420px)] overflow-y-scroll -mx-1 pr-2 border border-border/60 rounded-lg bg-muted/20"
        tabIndex={0}
      >
        <div className="space-y-5 py-1 pb-2">
          {GOAL_SECTIONS.map(({ sectionLabel, goals }) => (
            <div key={sectionLabel}>
              <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {sectionLabel}
              </h3>
              <div className="space-y-1.5">
                {goals.map((id) => {
                  const goal = GOALS_BY_ID[id]
                  if (!goal) return null
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSelectedGoalId(goal.id)}
                      className={cn(
                        'w-full text-left flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5',
                        'transition-colors hover:border-border/80 hover:bg-muted/40',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                      )}
                      aria-label={`${goal.label}: ${goal.shortDescription}`}
                    >
                      <span className={iconBoxClass}>{goal.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-foreground block text-sm">{goal.label}</span>
                        <span className="text-xs text-muted-foreground block mt-0.5">
                          {goal.shortDescription}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2" role="status">
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        Scroll to see all options
      </p>
      {onClose && (
        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Skip">
            Skip
          </Button>
        </div>
      )}
    </div>
  )
}
