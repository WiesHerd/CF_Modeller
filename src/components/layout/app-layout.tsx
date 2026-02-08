import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppStep = 'upload' | 'modeller'

interface AppLayoutProps {
  step: AppStep
  onStepChange: (step: AppStep) => void
  canShowModeller: boolean
  children: React.ReactNode
}

export function AppLayout({
  step,
  onStepChange,
  canShowModeller,
  children,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center sm:items-start">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              <span className="text-foreground">CF</span>
              <span className="text-primary"> Modeler</span>
            </h1>
            <p className="text-sm font-normal text-muted-foreground">
              Provider Compensation Modeling
            </p>
          </div>
          <Tabs
            value={step}
            onValueChange={(v) => onStepChange(v as AppStep)}
            className="w-full max-w-[280px] sm:block"
          >
            <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/80 border border-border/60">
              <TabsTrigger
                value="upload"
                className={cn(
                  'text-xs sm:text-sm min-h-[44px] gap-1.5',
                  'data-[state=active]:bg-background data-[state=active]:shadow-sm'
                )}
              >
                <Upload className="size-4 shrink-0" />
                Upload
              </TabsTrigger>
              <TabsTrigger
                value="modeller"
                disabled={!canShowModeller}
                className={cn(
                  'text-xs sm:text-sm min-h-[44px] gap-1.5',
                  'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                  'disabled:opacity-50 disabled:pointer-events-none'
                )}
              >
                <Calculator className="size-4 shrink-0" />
                Modeller
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-8 pt-6">
        <div className="mx-auto max-w-[1200px] px-4">
          {children}
        </div>
      </main>
    </div>
  )
}
