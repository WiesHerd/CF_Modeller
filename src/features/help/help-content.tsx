import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  HelpCircle,
  ChevronRight,
} from 'lucide-react'
import type { AppStep } from '@/components/layout/app-layout'
import type { BatchCardId } from '@/components/batch/batch-card-picker'

export interface HelpContentProps {
  /** When provided, "Go to" buttons navigate to the given step (and optional batch card). */
  onNavigate?: (step: AppStep, batchCard?: BatchCardId) => void
}

const SECTION_IDS = {
  overview: 'overview',
  importData: 'import-data',
  dataBrowser: 'data-browser',
  singleScenario: 'single-scenario',
  batch: 'batch',
  batchResults: 'batch-results',
  compareScenarios: 'compare-scenarios',
} as const

const SECTION_TABS: { value: string; label: string }[] = [
  { value: SECTION_IDS.overview, label: 'Overview' },
  { value: SECTION_IDS.importData, label: 'Import data' },
  { value: SECTION_IDS.dataBrowser, label: 'Data browser' },
  { value: SECTION_IDS.singleScenario, label: 'Single scenario' },
  { value: SECTION_IDS.batch, label: 'Batch' },
  { value: SECTION_IDS.batchResults, label: 'Scenario results' },
  { value: SECTION_IDS.compareScenarios, label: 'Compare scenarios' },
]

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function GoToButton({
  label,
  step,
  batchCard,
  onNavigate,
}: {
  label: string
  step: AppStep
  batchCard?: BatchCardId
  onNavigate?: (step: AppStep, batchCard?: BatchCardId) => void
}) {
  if (!onNavigate) return null
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 mt-2"
      onClick={() => onNavigate(step, batchCard)}
      aria-label={`Go to ${label}`}
    >
      Go to {label}
      <ChevronRight className="size-4" />
    </Button>
  )
}

export function HelpContent({ onNavigate }: HelpContentProps) {
  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS.overview)

  const handleTabChange = (value: string) => {
    setActiveSection(value)
    scrollToSection(value)
  }

  useEffect(() => {
    const sectionElements = SECTION_TABS.map(({ value }) => document.getElementById(value)).filter(Boolean) as HTMLElement[]
    if (sectionElements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.id
          if (SECTION_TABS.some((t) => t.value === id)) setActiveSection(id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    sectionElements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionTitleWithIcon icon={<HelpCircle className="size-5" />}>
          How to use TCC Modeler
        </SectionTitleWithIcon>
        <Tabs value={activeSection} onValueChange={handleTabChange}>
          <TabsList className="h-9 w-full flex-wrap justify-start gap-0.5 bg-muted/60 p-1 sm:w-auto" variant="default">
            {SECTION_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 min-w-0 shrink-0 text-xs sm:text-sm sm:flex-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Overview */}
      <section id={SECTION_IDS.overview}>
        <h2 className="text-lg font-semibold text-foreground mb-2">Overview</h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">TCC Modeler</strong> is a total cash compensation modeling tool for physicians. You can model pay for a single provider or run batch scenarios across your uploaded cohort, with market data and governance guardrails.
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Typical flow:</strong> Import provider and market data → optionally browse or verify data → run a single-provider scenario and/or a batch workflow (CF Optimizer, market positioning, bulk or detailed scenarios) → review and compare results.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Get started: Import data */}
      <section id={SECTION_IDS.importData}>
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileUp className="size-4" />
          </span>
          Import data
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">What:</strong> Load provider and market data from CSV files. Map columns to the expected fields and, for batch workflows, set up specialty synonym mapping so provider specialties align with market data.
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">When to use:</strong> Start here for any workflow. Single scenario and all batch tools require provider and market data to be loaded first.
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Total Cash Compensation (TCC)</strong> is built from: base pay (base salary + non-clinical) + wRVU incentive (if positive) + PSQ + quality payments + other incentives. Non-clinical pay can come from <strong className="text-foreground">Admin pay</strong> + <strong className="text-foreground">Teaching pay</strong> + <strong className="text-foreground">Research pay</strong> when you map those columns, or is calculated from FTE (base × (total FTE − clinical FTE) / total FTE) when they are not provided. &quot;Other incentives&quot; is the sum of the columns <strong className="text-foreground">Other incentives</strong> and <strong className="text-foreground">Other incentive 1, 2, 3</strong> when you map them on upload.
            </p>
            <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-1">
              <li>Upload provider and market CSVs</li>
              <li>Column mapping for required fields</li>
              <li>Synonym mapping for batch (match provider specialty names to market)</li>
              <li>Save and load scenarios; reset data when starting over</li>
            </ul>
            <GoToButton label="Import data" step="upload" onNavigate={onNavigate} />
          </CardContent>
        </Card>
      </section>

      {/* Data browser */}
      <section id={SECTION_IDS.dataBrowser}>
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Table2 className="size-4" />
          </span>
          Data browser
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">What:</strong> Browse and filter your uploaded provider and market data in tabular form. Switch between Provider and Market tabs to inspect rows, sort, and verify data before modeling.
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">When to use:</strong> After importing, when you want to verify uploads, inspect values, or confirm specialty names and counts before running single or batch scenarios.
            </p>
            <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-1">
              <li>Provider and market tables with sorting and filtering</li>
              <li>Pagination and column visibility</li>
            </ul>
            <GoToButton label="Data browser" step="data" onNavigate={onNavigate} />
          </CardContent>
        </Card>
      </section>

      {/* Single scenario */}
      <section id={SECTION_IDS.singleScenario}>
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="size-4" />
          </span>
          Single scenario
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">What:</strong> Model total cash compensation for one provider. You can choose a provider from your uploaded data or enter custom compensation and productivity data (hypothetical provider). The flow has four steps: Provider → Scenario → Market data → Results.
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">When to use:</strong> When you need a deep dive on one person, want to model a hypothetical provider, or explain a single scenario with an impact report and market position.
            </p>
            <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Provider:</strong> Select from upload or enter custom data; set specialty</li>
              <li><strong className="text-foreground">Scenario:</strong> Set conversion factor, wRVU target, PSQ, and other levers</li>
              <li><strong className="text-foreground">Market data:</strong> View TCC, wRVU, and CF percentiles for the specialty</li>
              <li><strong className="text-foreground">Results:</strong> Impact report, market position table, governance flags</li>
            </ul>
            <GoToButton label="Single scenario" step="modeller" onNavigate={onNavigate} />
          </CardContent>
        </Card>
      </section>

      {/* Batch */}
      <section id={SECTION_IDS.batch}>
        <h2 className="text-lg font-semibold text-foreground mb-2">Batch</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Run scenarios across your uploaded cohort. Choose one of four batch workflows:
        </p>
        <div className="grid gap-4 sm:grid-cols-1">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Gauge className="size-4 text-primary" />
                Conversion Factor Optimizer
              </h3>
              <p className="text-muted-foreground text-sm">
                Recommends specialty-level conversion factor adjustments to align productivity and pay positioning. Includes governance guardrails and audit-ready outputs. Save and compare optimizer scenarios.
              </p>
              <p className="text-muted-foreground text-xs">
                <strong className="text-foreground">When:</strong> Align pay and productivity across specialties; compare before/after optimization.
              </p>
              <GoToButton label="CF Optimizer" step="batch-scenario" batchCard="cf-optimizer" onNavigate={onNavigate} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <BarChart2 className="size-4 text-primary" />
                Market positioning (imputed)
              </h3>
              <p className="text-muted-foreground text-sm">
                Compare your effective $/wRVU to market 25th–90th percentiles by specialty. See your percentile and market CF targets.
              </p>
              <p className="text-muted-foreground text-xs">
                <strong className="text-foreground">When:</strong> Benchmarking; understanding where you sit vs. market by specialty.
              </p>
              <GoToButton label="Market positioning" step="batch-scenario" batchCard="imputed-vs-market" onNavigate={onNavigate} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Target className="size-4 text-primary" />
                Target Optimizer
              </h3>
              <p className="text-muted-foreground text-sm">
                Set a group wRVU target per specialty (1.0 cFTE) and scale by cFTE; compare actuals to target, plan incentive payout, and export.
              </p>
              <p className="text-muted-foreground text-xs">
                <strong className="text-foreground">When:</strong> Setting productivity expectations by specialty; planning incentive without individualized salary-based targets.
              </p>
              <GoToButton label="Target Optimizer" step="batch-scenario" batchCard="productivity-target" onNavigate={onNavigate} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <LayoutGrid className="size-4 text-primary" />
                Create and Run Scenario
              </h3>
              <p className="text-muted-foreground text-sm">
                Apply one set of inputs (CF, wRVU target, PSQ) to all providers and run. Use scope and guardrails to filter who’s included.
              </p>
              <p className="text-muted-foreground text-xs">
                <strong className="text-foreground">When:</strong> Broad “what-if” across the whole cohort with a single scenario.
              </p>
              <GoToButton label="Create and Run Scenario" step="batch-scenario" batchCard="bulk-scenario" onNavigate={onNavigate} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Sliders className="size-4 text-primary" />
                Detailed scenarios
              </h3>
              <p className="text-muted-foreground text-sm">
                Overrides by specialty and by provider, then run. More control than the bulk scenario when you need different assumptions for different groups or individuals.
              </p>
              <p className="text-muted-foreground text-xs">
                <strong className="text-foreground">When:</strong> Targeted what-ifs; different CF or targets by specialty or provider.
              </p>
              <GoToButton label="Detailed scenarios" step="batch-scenario" batchCard="detailed-scenario" onNavigate={onNavigate} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Scenario results */}
      <section id={SECTION_IDS.batchResults}>
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-4" />
          </span>
          Scenario results
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">What:</strong> The screen you land on after running a bulk or detailed batch scenario. View and export results; save runs; switch between saved runs.
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">When to use:</strong> After running Create and Run Scenario or Detailed scenarios; when you need to review, export, or compare batch run outputs.
            </p>
            <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-1">
              <li>Dashboard and table of results</li>
              <li>Save and load batch runs</li>
              <li>Export and drill into row-level calculations</li>
            </ul>
            <GoToButton label="Scenario results" step="batch-results" onNavigate={onNavigate} />
          </CardContent>
        </Card>
      </section>

      {/* Compare scenarios */}
      <section id={SECTION_IDS.compareScenarios}>
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitCompare className="size-4" />
          </span>
          Compare scenarios
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">What:</strong> Compare two saved optimizer scenarios side-by-side. View differences and export the comparison.
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">When to use:</strong> After you’ve saved at least two CF Optimizer scenarios; when you want to compare before/after or two different optimization approaches.
            </p>
            <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-1">
              <li>Select two saved optimizer configs</li>
              <li>Side-by-side comparison and export</li>
            </ul>
            <GoToButton label="Compare scenarios" step="compare-scenarios" onNavigate={onNavigate} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
