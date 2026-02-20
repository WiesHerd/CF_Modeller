import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  ChevronRight,
} from 'lucide-react'
import type { AppStep } from '@/components/layout/app-layout'
import type { BatchCardId } from '@/components/batch/batch-card-picker'
import { cn } from '@/lib/utils'

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

const SECTION_NAV: { value: string; label: string }[] = [
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

const iconBoxClass =
  'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5'

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
      variant="ghost"
      size="sm"
      className="gap-1.5 text-primary hover:text-primary hover:bg-primary/10 -ml-2 mt-3"
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

  useEffect(() => {
    const sectionElements = SECTION_NAV.map(({ value }) => document.getElementById(value)).filter(
      Boolean
    ) as HTMLElement[]
    if (sectionElements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.id
          if (SECTION_NAV.some((t) => t.value === id)) setActiveSection(id)
        }
      },
      { rootMargin: '-100px 0px -70% 0px', threshold: 0 }
    )
    sectionElements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
      {/* Sticky sidebar nav — desktop */}
      <aside className="shrink-0 lg:w-52">
        <div className="lg:sticky lg:top-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            In this section
          </h2>
          <ScrollArea className="lg:max-h-[calc(100vh-8rem)]">
            <nav className="space-y-0.5" aria-label="Help sections">
              {SECTION_NAV.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setActiveSection(value)
                    scrollToSection(value)
                  }}
                  className={cn(
                    'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    activeSection === value
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>
          </ScrollArea>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-12">
        {/* Overview */}
        <section id={SECTION_IDS.overview} className="scroll-mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Overview</h2>
          <Card className="overflow-hidden border border-border/80 shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">TCC Modeler</strong> is a total cash compensation
                modeling tool for physicians. You can model pay for a single provider or run batch
                scenarios across your uploaded cohort, with market data and governance guardrails.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">Typical flow:</strong> Import provider and market
                data → optionally browse or verify data → run a single-provider scenario and/or a
                batch workflow (CF Optimizer, market positioning, bulk or detailed scenarios) →
                review and compare results.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Import data */}
        <section id={SECTION_IDS.importData} className="scroll-mt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={iconBoxClass}>
              <FileUp className="size-5" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">Import data</h2>
          </div>
          <Card className="overflow-hidden border border-border/80 shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">What:</strong> Load provider and market data from
                CSV files. Map columns to the expected fields and, for batch workflows, set up
                specialty synonym mapping so provider specialties align with market data.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">When to use:</strong> Start here for any
                workflow. Single scenario and all batch tools require provider and market data to be
                loaded first.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">Total Cash Compensation (TCC)</strong> is built
                from: base pay (base salary + non-clinical) + wRVU incentive (if positive) + PSQ +
                quality payments + other incentives. Non-clinical pay can come from{' '}
                <strong className="text-foreground">Admin pay</strong> +{' '}
                <strong className="text-foreground">Teaching pay</strong> +{' '}
                <strong className="text-foreground">Research pay</strong> when you map those columns,
                or is calculated from FTE when they are not provided.
              </p>
              <ul className="text-muted-foreground text-[15px] leading-relaxed list-disc pl-5 space-y-1">
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
        <section id={SECTION_IDS.dataBrowser} className="scroll-mt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={iconBoxClass}>
              <Table2 className="size-5" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">Data browser</h2>
          </div>
          <Card className="overflow-hidden border border-border/80 shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">What:</strong> Browse and filter your uploaded
                provider and market data in tabular form. Switch between Provider and Market tabs to
                inspect rows, sort, and verify data before modeling.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">When to use:</strong> After importing, when you
                want to verify uploads, inspect values, or confirm specialty names and counts before
                running single or batch scenarios.
              </p>
              <ul className="text-muted-foreground text-[15px] leading-relaxed list-disc pl-5 space-y-1">
                <li>Provider and market tables with sorting and filtering</li>
                <li>Pagination and column visibility</li>
              </ul>
              <GoToButton label="Data browser" step="data" onNavigate={onNavigate} />
            </CardContent>
          </Card>
        </section>

        {/* Single scenario */}
        <section id={SECTION_IDS.singleScenario} className="scroll-mt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={iconBoxClass}>
              <User className="size-5" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">Single scenario</h2>
          </div>
          <Card className="overflow-hidden border border-border/80 shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">What:</strong> Model total cash compensation for
                one provider. You can choose a provider from your uploaded data or enter custom
                compensation and productivity data (hypothetical provider). The flow has four steps:
                Provider → Scenario → Market data → Results.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">When to use:</strong> When you need a deep dive
                on one person, want to model a hypothetical provider, or explain a single scenario
                with an impact report and market position.
              </p>
              <ul className="text-muted-foreground text-[15px] leading-relaxed list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Provider:</strong> Select from upload or enter
                  custom data; set specialty
                </li>
                <li>
                  <strong className="text-foreground">Scenario:</strong> Set conversion factor, wRVU
                  target, PSQ, and other levers
                </li>
                <li>
                  <strong className="text-foreground">Market data:</strong> View TCC, wRVU, and CF
                  percentiles for the specialty
                </li>
                <li>
                  <strong className="text-foreground">Results:</strong> Impact report, market position
                  table, governance flags
                </li>
              </ul>
              <GoToButton label="Single scenario" step="modeller" onNavigate={onNavigate} />
            </CardContent>
          </Card>
        </section>

        {/* Batch */}
        <section id={SECTION_IDS.batch} className="scroll-mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Batch</h2>
          <p className="text-muted-foreground text-[15px] mb-6">
            Run scenarios across your uploaded cohort. Choose one of five batch workflows:
          </p>
          <div className="grid gap-4 sm:grid-cols-1">
            {[
              {
                icon: <Gauge className="size-5" />,
                title: 'Conversion Factor Optimizer',
                description:
                  'Recommends specialty-level conversion factor adjustments to align productivity and pay positioning. Includes governance guardrails and audit-ready outputs. Save and compare optimizer scenarios.',
                when: 'Align pay and productivity across specialties; compare before/after optimization.',
                step: 'batch-scenario' as AppStep,
                batchCard: 'cf-optimizer' as BatchCardId,
                goToLabel: 'CF Optimizer',
              },
              {
                icon: <BarChart2 className="size-5" />,
                title: 'Market positioning (imputed)',
                description:
                  'Compare your effective $/wRVU to market 25th–90th percentiles by specialty. See your percentile and market CF targets.',
                when: 'Benchmarking; understanding where you sit vs. market by specialty.',
                step: 'batch-scenario' as AppStep,
                batchCard: 'imputed-vs-market' as BatchCardId,
                goToLabel: 'Market positioning',
              },
              {
                icon: <Target className="size-5" />,
                title: 'Target Optimizer',
                description:
                  'Set a group wRVU target per specialty (1.0 cFTE) and scale by cFTE; compare actuals to target, plan incentive payout, and export.',
                when: 'Setting productivity expectations by specialty; planning incentive without individualized salary-based targets.',
                step: 'batch-scenario' as AppStep,
                batchCard: 'productivity-target' as BatchCardId,
                goToLabel: 'Target Optimizer',
              },
              {
                icon: <LayoutGrid className="size-5" />,
                title: 'Create and Run Scenario',
                description:
                  'Apply one set of inputs (CF, wRVU target, PSQ) to all providers and run. Use scope and guardrails to filter who’s included.',
                when: 'Broad “what-if” across the whole cohort with a single scenario.',
                step: 'batch-scenario' as AppStep,
                batchCard: 'bulk-scenario' as BatchCardId,
                goToLabel: 'Create and Run Scenario',
              },
              {
                icon: <Sliders className="size-5" />,
                title: 'Detailed scenarios',
                description:
                  'Overrides by specialty and by provider, then run. More control than the bulk scenario when you need different assumptions for different groups or individuals.',
                when: 'Targeted what-ifs; different CF or targets by specialty or provider.',
                step: 'batch-scenario' as AppStep,
                batchCard: 'detailed-scenario' as BatchCardId,
                goToLabel: 'Detailed scenarios',
              },
            ].map((item) => (
              <Card
                key={item.goToLabel}
                className="overflow-hidden border border-border/80 shadow-sm transition-colors hover:border-border"
              >
                <CardContent className="p-6 sm:p-8 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className={iconBoxClass}>{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground">{item.title}</h3>
                      <p className="text-muted-foreground text-[15px] leading-relaxed mt-1">
                        {item.description}
                      </p>
                      <p className="text-muted-foreground text-xs mt-2">
                        <strong className="text-foreground">When:</strong> {item.when}
                      </p>
                      <GoToButton
                        label={item.goToLabel}
                        step={item.step}
                        batchCard={item.batchCard}
                        onNavigate={onNavigate}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Scenario results */}
        <section id={SECTION_IDS.batchResults} className="scroll-mt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={iconBoxClass}>
              <Layers className="size-5" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">Scenario results</h2>
          </div>
          <Card className="overflow-hidden border border-border/80 shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">What:</strong> The screen you land on after
                running a bulk or detailed batch scenario. View and export results; save runs;
                switch between saved runs.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">When to use:</strong> After running Create and Run
                Scenario or Detailed scenarios; when you need to review, export, or compare batch run
                outputs.
              </p>
              <ul className="text-muted-foreground text-[15px] leading-relaxed list-disc pl-5 space-y-1">
                <li>Dashboard and table of results</li>
                <li>Save and load batch runs</li>
                <li>Export and drill into row-level calculations</li>
              </ul>
              <GoToButton label="Scenario results" step="batch-results" onNavigate={onNavigate} />
            </CardContent>
          </Card>
        </section>

        {/* Compare scenarios */}
        <section id={SECTION_IDS.compareScenarios} className="scroll-mt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={iconBoxClass}>
              <GitCompare className="size-5" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">Compare scenarios</h2>
          </div>
          <Card className="overflow-hidden border border-border/80 shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">What:</strong> Compare two saved optimizer
                scenarios side-by-side. View differences and export the comparison.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                <strong className="text-foreground">When to use:</strong> After you’ve saved at least
                two CF Optimizer scenarios; when you want to compare before/after or two different
                optimization approaches.
              </p>
              <ul className="text-muted-foreground text-[15px] leading-relaxed list-disc pl-5 space-y-1">
                <li>Select two saved optimizer configs</li>
                <li>Side-by-side comparison and export</li>
              </ul>
              <GoToButton label="Compare scenarios" step="compare-scenarios" onNavigate={onNavigate} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
