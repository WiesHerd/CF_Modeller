import { Upload, Calculator, Layers, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type AppStep = 'upload' | 'modeller' | 'batch-scenario' | 'batch-results'
export type AppMode = 'single' | 'batch'

const SINGLE_STEPS: { id: AppStep; label: string; icon: React.ReactNode }[] = [
  { id: 'upload', label: 'Upload', icon: <Upload className="size-4" /> },
  { id: 'modeller', label: 'Modeller', icon: <Calculator className="size-4" /> },
]

const BATCH_STEPS: { id: AppStep; label: string; icon: React.ReactNode }[] = [
  { id: 'upload', label: 'Upload', icon: <Upload className="size-4" /> },
  { id: 'batch-scenario', label: 'Batch scenario', icon: <Calculator className="size-4" /> },
  { id: 'batch-results', label: 'Results', icon: <Layers className="size-4" /> },
]

interface AppLayoutProps {
  step: AppStep
  onStepChange: (step: AppStep) => void
  appMode: AppMode
  onAppModeChange: (mode: AppMode) => void
  canShowModeller: boolean
  canShowBatchResults: boolean
  /** When true (e.g. inside CF Optimizer), hide the Results tab to avoid confusion—optimizer shows its own results. */
  hideBatchResultsTab?: boolean
  children: React.ReactNode
}

export function AppLayout({
  step,
  onStepChange,
  appMode,
  onAppModeChange,
  canShowModeller,
  canShowBatchResults,
  hideBatchResultsTab = false,
  children,
}: AppLayoutProps) {
  const steps = appMode === 'batch'
    ? (hideBatchResultsTab ? BATCH_STEPS.filter((s) => s.id !== 'batch-results') : BATCH_STEPS)
    : SINGLE_STEPS

  const isStepDisabled = (s: AppStep) => {
    if (s === 'upload') return false
    if (appMode === 'single' && s === 'modeller') return !canShowModeller
    if (appMode === 'batch' && s === 'batch-results') return !canShowBatchResults
    return false
  }

  const stepButtonClass = cn(
    'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
    'border-transparent'
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex items-center gap-2">
              <img
                src="/NewIMage.png"
                alt="TCC Modeler"
                className="size-8 rounded-lg object-contain sm:size-9"
              />
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                <span className="text-foreground">TCC</span>
                <span className="text-primary"> Modeler</span>
              </h1>
            </div>
            <nav
              className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"
              aria-label="App mode"
            >
              <button
                type="button"
                onClick={() => onAppModeChange('single')}
                className={cn(
                  stepButtonClass,
                  appMode === 'single' &&
                    'border-border bg-background text-foreground shadow-sm ring-1 ring-primary/20',
                  appMode !== 'single' &&
                    'bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground'
                )}
                aria-current={appMode === 'single' ? 'true' : undefined}
              >
                <User className="size-4 shrink-0" />
                <span className="hidden truncate sm:inline">Single provider</span>
              </button>
              <button
                type="button"
                onClick={() => onAppModeChange('batch')}
                className={cn(
                  stepButtonClass,
                  appMode === 'batch' &&
                    'border-border bg-background text-foreground shadow-sm ring-1 ring-primary/20',
                  appMode !== 'batch' &&
                    'bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground'
                )}
                aria-current={appMode === 'batch' ? 'true' : undefined}
              >
                <Users className="size-4 shrink-0" />
                <span className="hidden truncate sm:inline">Batch</span>
              </button>
            </nav>
          </div>
          <nav
            className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"
            aria-label="App steps"
          >
            <TooltipProvider delayDuration={300}>
              {steps.map((s) => {
                const isActive = s.id === step
                const isDisabled = isStepDisabled(s.id)
                const resultStepTooltip =
                  s.id === 'batch-results'
                    ? 'View batch run results (Bulk or Detailed scenario output)'
                    : undefined
                const batchScenarioTooltip =
                  s.id === 'batch-scenario'
                    ? 'Configure and run: CF Optimizer, Imputed vs market, Bulk or Detailed scenario'
                    : undefined
                const tooltip = resultStepTooltip ?? batchScenarioTooltip
                const button = (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => !isDisabled && onStepChange(s.id)}
                    disabled={isDisabled}
                    className={cn(
                      stepButtonClass,
                      isActive && 'border-border bg-background text-foreground shadow-sm ring-1 ring-primary/20',
                      !isActive && !isDisabled &&
                        'bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground',
                      !isActive && isDisabled && 'cursor-not-allowed opacity-50'
                    )}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    {s.icon}
                    <span className="hidden truncate sm:inline">{s.label}</span>
                  </button>
                )
                return tooltip ? (
                  <Tooltip key={s.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="bottom">{tooltip}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span key={s.id}>{button}</span>
                )
              })}
            </TooltipProvider>
          </nav>
        </div>
      </header>

      <main className="safe-area-bottom flex-1 overflow-auto pb-8 pt-6">
        <div className="mx-auto max-w-[1200px] px-4">
          {children}
        </div>
      </main>

      <footer className="mt-auto border-t border-border/60 bg-muted/20 py-4">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:gap-4">
          <p className="text-center text-sm text-muted-foreground sm:text-left">
            © {new Date().getFullYear()} TCC Modeler. Total cash compensation modeling.
          </p>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground" aria-label="Footer links">
            <a href="#privacy" className="hover:text-foreground underline-offset-4 hover:underline">
              Privacy
            </a>
            <a href="#terms" className="hover:text-foreground underline-offset-4 hover:underline">
              Terms
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
