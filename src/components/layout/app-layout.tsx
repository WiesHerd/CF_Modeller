import { useState } from 'react'
import { Upload, Layers, Menu, Plus, PanelLeftClose, PanelLeft, FileUp, PenLine, TrendingUp, BarChart2, LayoutGrid, Sliders, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { BatchCardId } from '@/components/batch/batch-card-picker'

export type AppStep = 'upload' | 'data' | 'modeller' | 'batch-scenario' | 'batch-results'
export type AppMode = 'single' | 'batch'

/** When collapsed, only this rail width is reserved — content keeps max width. */
const RAIL_WIDTH = 56
const SIDEBAR_EXPANDED_WIDTH = 240

const BATCH_NAV: { id: BatchCardId; label: string; icon: React.ReactNode; tooltip: string }[] = [
  { id: 'cf-optimizer', label: 'CF Optimizer', icon: <TrendingUp className="size-4 shrink-0" />, tooltip: 'Conversion Factor Optimizer' },
  { id: 'imputed-vs-market', label: 'Market positioning', icon: <BarChart2 className="size-4 shrink-0" />, tooltip: 'Market positioning (imputed)' },
  { id: 'bulk-scenario', label: 'Bulk scenario', icon: <LayoutGrid className="size-4 shrink-0" />, tooltip: 'Bulk scenario planning' },
  { id: 'detailed-scenario', label: 'Detailed scenario', icon: <Sliders className="size-4 shrink-0" />, tooltip: 'Detailed scenario planning' },
]

interface AppLayoutProps {
  step: AppStep
  onStepChange: (step: AppStep) => void
  canShowBatchResults: boolean
  currentBatchCard?: BatchCardId | null
  currentSingleProviderMode?: 'existing' | 'new'
  onBatchCardSelect?: (id: BatchCardId) => void
  onSingleProviderMode?: (mode: 'existing' | 'new') => void
  children: React.ReactNode
}

function SidebarSection({
  label,
  children,
  className,
  collapsed,
}: {
  label: string
  children: React.ReactNode
  className?: string
  collapsed: boolean
}) {
  if (collapsed) return <>{children}</>
  return (
    <div className={cn('space-y-1', className)}>
      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      {children}
    </div>
  )
}

function NavButton({
  icon,
  label,
  tooltip,
  active,
  disabled,
  onClick,
  collapsed,
}: {
  icon: React.ReactNode
  label: string
  tooltip: string
  active: boolean
  disabled: boolean
  onClick: () => void
  collapsed: boolean
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center rounded-lg transition-colors text-left shrink-0',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5 text-sm',
        active && 'bg-muted text-foreground font-medium',
        !active && !disabled && 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? tooltip : undefined}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
  // Only wrap in Tooltip when collapsed (icons only); when expanded, labels are visible so no tooltip needed.
  // This also avoids rendering Tooltip outside TooltipProvider in the expanded overlay.
  if (!collapsed) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export function AppLayout({
  step,
  onStepChange,
  canShowBatchResults,
  currentBatchCard = null,
  currentSingleProviderMode,
  onBatchCardSelect,
  onSingleProviderMode,
  children,
}: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const isUploadActive = step === 'upload'
  const isDataActive = step === 'data'
  const isModellerActive = step === 'modeller'
  const isBatchScenarioActive = step === 'batch-scenario'

  const handleNav = (s: AppStep) => {
    onStepChange(s)
    setMobileOpen(false)
  }

  const handleBatchCard = (id: BatchCardId) => {
    onBatchCardSelect?.(id)
    onStepChange('batch-scenario')
    setMobileOpen(false)
  }

  const handleSingleMode = (mode: 'existing' | 'new') => {
    onSingleProviderMode?.(mode)
    onStepChange('modeller')
    setMobileOpen(false)
  }

  const railContent = (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col bg-muted/30 border-r border-border/50 w-full">
        {/* Logo — icon only when collapsed */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleNav('upload')}
              className="flex items-center justify-center p-2.5 w-full hover:bg-muted/50 transition-colors border-b border-border/50 shrink-0 rounded-none"
              aria-label="Go to Upload"
            >
              <img src="/NewIMage.png" alt="" className="size-7 rounded-md object-contain" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">TCC Modeler — Upload</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleNav('upload')}
              className={cn(
                'flex w-full items-center justify-center rounded-lg p-2.5 transition-colors shrink-0 mx-1 mt-1',
                isUploadActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
              aria-label="Start"
            >
              <Plus className="size-4 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Start — Upload</TooltipContent>
        </Tooltip>

        <div className="flex-1 overflow-auto py-1 space-y-0.5 px-1 min-h-0">
          <NavButton
            icon={<FileUp className="size-4 shrink-0" />}
            label="Upload"
            tooltip="Upload"
            active={isUploadActive}
            disabled={false}
            onClick={() => handleNav('upload')}
            collapsed={true}
          />
          <NavButton
            icon={<Table2 className="size-4 shrink-0" />}
            label="Data"
            tooltip="Browse and filter provider and market data"
            active={isDataActive}
            disabled={false}
            onClick={() => handleNav('data')}
            collapsed={true}
          />
          <NavButton
            icon={<Upload className="size-4 shrink-0" />}
            label="Single from upload"
            tooltip="Single from upload"
            active={isModellerActive && currentSingleProviderMode === 'existing'}
            disabled={false}
            onClick={() => handleSingleMode('existing')}
            collapsed={true}
          />
          <NavButton
            icon={<PenLine className="size-4 shrink-0" />}
            label="Custom single scenario"
            tooltip="Custom single scenario"
            active={isModellerActive && currentSingleProviderMode === 'new'}
            disabled={false}
            onClick={() => handleSingleMode('new')}
            collapsed={true}
          />
          {BATCH_NAV.map((item) => (
            <NavButton
              key={item.id}
              icon={item.icon}
              label={item.label}
              tooltip={item.tooltip}
              active={isBatchScenarioActive && currentBatchCard === item.id}
              disabled={false}
              onClick={() => handleBatchCard(item.id)}
              collapsed={true}
            />
          ))}
          {canShowBatchResults && (
            <NavButton
              icon={<Layers className="size-4 shrink-0" />}
              label="Results"
              tooltip="View batch run results"
              active={step === 'batch-results'}
              disabled={false}
              onClick={() => handleNav('batch-results')}
              collapsed={true}
            />
          )}
        </div>

        <div className="p-1 border-t border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="flex w-full items-center justify-center rounded-lg p-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )

  /** Full 240px sidebar content (with labels). Shown when expanded; same strip pushes content. */
  const expandedSidebarContent = (
    <div className="flex h-full w-full min-w-[240px] flex-col bg-muted/30 border-r border-border/50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50 shrink-0">
        <img src="/NewIMage.png" alt="" className="size-9 rounded-lg object-contain ring-1 ring-border/40" />
        <div className="min-w-0">
          <span className="font-semibold text-foreground block truncate">TCC Modeler</span>
          <span className="text-xs text-muted-foreground">Total cash compensation</span>
        </div>
      </div>
      {/* Start — goes to Upload (app starting point) */}
      <div className="p-2 border-b border-border/50">
        <button
          type="button"
          onClick={() => handleNav('upload')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isUploadActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <Plus className="size-4 shrink-0" />
          <span>Start</span>
        </button>
      </div>
      {/* Nav sections — match home screen cards */}
      <div className="flex-1 overflow-auto py-3 px-2 space-y-5">
        <SidebarSection label="Get started" collapsed={false}>
          <div className="space-y-0.5">
            <NavButton
              icon={<FileUp className="size-4 shrink-0" />}
            label="Upload"
            tooltip="Load provider and market data from CSV"
              active={isUploadActive}
              disabled={false}
              onClick={() => handleNav('upload')}
              collapsed={false}
            />
            <NavButton
              icon={<Table2 className="size-4 shrink-0" />}
              label="Data"
              tooltip="Browse and filter provider and market data"
              active={isDataActive}
              disabled={false}
              onClick={() => handleNav('data')}
              collapsed={false}
            />
          </div>
        </SidebarSection>
        <SidebarSection label="Single provider" collapsed={false}>
          <div className="space-y-0.5">
            <NavButton
              icon={<Upload className="size-4 shrink-0" />}
              label="Single from upload"
              tooltip="Use a provider from your uploaded file"
              active={isModellerActive && currentSingleProviderMode === 'existing'}
              disabled={false}
              onClick={() => handleSingleMode('existing')}
              collapsed={false}
            />
            <NavButton
              icon={<PenLine className="size-4 shrink-0" />}
              label="Custom single scenario"
              tooltip="Enter your own data — no upload required"
              active={isModellerActive && currentSingleProviderMode === 'new'}
              disabled={false}
              onClick={() => handleSingleMode('new')}
              collapsed={false}
            />
          </div>
        </SidebarSection>
        <SidebarSection label="Batch" collapsed={false}>
          <div className="space-y-0.5">
            {BATCH_NAV.map((item) => (
              <NavButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                tooltip={item.tooltip}
                active={isBatchScenarioActive && currentBatchCard === item.id}
                disabled={false}
                onClick={() => handleBatchCard(item.id)}
                collapsed={false}
              />
            ))}
          </div>
        </SidebarSection>
        {canShowBatchResults && (
          <SidebarSection label="Output" collapsed={false}>
            <NavButton
              icon={<Layers className="size-4 shrink-0" />}
              label="Results"
              tooltip="View batch run results (Bulk or Detailed)"
              active={step === 'batch-results'}
              disabled={false}
              onClick={() => handleNav('batch-results')}
              collapsed={false}
            />
          </SidebarSection>
        )}
      </div>
      {/* Collapse + footer */}
      <div className="border-t border-border/50 shrink-0">
        <button
          type="button"
          onClick={() => setSidebarCollapsed(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground mx-2 mt-2 transition-colors"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="size-4 shrink-0" />
          <span>Collapse</span>
        </button>
        <p className="px-4 py-3 text-xs text-muted-foreground/80 border-t border-border/50">
          Total cash compensation modeling
        </p>
      </div>
    </div>
  )

  /** Single sidebar: width transitions 56px ↔ 240px and pushes main content (no overlay). */
  const sidebarWidthPx = sidebarCollapsed ? RAIL_WIDTH : SIDEBAR_EXPANDED_WIDTH
  const desktopSidebar = (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col md:flex overflow-hidden',
        'transition-[width] duration-200 ease-out'
      )}
      style={{ width: sidebarWidthPx }}
      aria-expanded={!sidebarCollapsed}
    >
      {sidebarCollapsed ? railContent : expandedSidebarContent}
    </aside>
  )

  const mobileHeader = (
    <div className="flex md:hidden sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="m-2" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 overflow-hidden flex flex-col">
          <TooltipProvider delayDuration={300}>
            <div className="flex h-full flex-col bg-muted/30">
              <div className="flex items-center gap-2 p-4 border-b border-border/40">
                <img src="/NewIMage.png" alt="" className="size-8 rounded-lg object-contain" />
                <span className="font-semibold text-foreground">TCC</span>
                <span className="font-semibold text-primary"> Modeler</span>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => handleNav('upload')}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isUploadActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Plus className="size-4 shrink-0" />
                  <span>Start</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-2 space-y-4">
                <SidebarSection label="Get started" collapsed={false}>
                  <div className="space-y-0.5">
                    <NavButton
                      icon={<FileUp className="size-4 shrink-0" />}
                      label="Upload"
                      tooltip="Load provider and market data"
                      active={isUploadActive}
                      disabled={false}
                      onClick={() => handleNav('upload')}
                      collapsed={false}
                    />
                    <NavButton
                      icon={<Table2 className="size-4 shrink-0" />}
                      label="Data"
                      tooltip="Browse and filter provider and market data"
                      active={isDataActive}
                      disabled={false}
                      onClick={() => handleNav('data')}
                      collapsed={false}
                    />
                  </div>
                </SidebarSection>
                <SidebarSection label="Single provider" collapsed={false}>
                  <div className="space-y-0.5">
                    <NavButton
                      icon={<Upload className="size-4 shrink-0" />}
                      label="Single from upload"
                      tooltip="Use a provider from your uploaded file"
                      active={isModellerActive && currentSingleProviderMode === 'existing'}
                      disabled={false}
                      onClick={() => handleSingleMode('existing')}
                      collapsed={false}
                    />
                    <NavButton
                      icon={<PenLine className="size-4 shrink-0" />}
                      label="Custom single scenario"
                      tooltip="Enter your own data"
                      active={isModellerActive && currentSingleProviderMode === 'new'}
                      disabled={false}
                      onClick={() => handleSingleMode('new')}
                      collapsed={false}
                    />
                  </div>
                </SidebarSection>
                <SidebarSection label="Batch" collapsed={false}>
                  <div className="space-y-0.5">
                    {BATCH_NAV.map((item) => (
                      <NavButton
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        tooltip={item.tooltip}
                        active={isBatchScenarioActive && currentBatchCard === item.id}
                        disabled={false}
                        onClick={() => handleBatchCard(item.id)}
                        collapsed={false}
                      />
                    ))}
                  </div>
                </SidebarSection>
                {canShowBatchResults && (
                  <SidebarSection label="Output" collapsed={false}>
                    <NavButton
                      icon={<Layers className="size-4 shrink-0" />}
                      label="Results"
                      tooltip="View batch run results"
                      active={step === 'batch-results'}
                      disabled={false}
                      onClick={() => handleNav('batch-results')}
                      collapsed={false}
                    />
                  </SidebarSection>
                )}
              </div>
            </div>
          </TooltipProvider>
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2 py-2 pr-4">
        <img src="/NewIMage.png" alt="" className="size-7 rounded-lg object-contain" />
        <span className="font-semibold text-foreground">TCC</span>
        <span className="font-semibold text-primary"> Modeler</span>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {desktopSidebar}
      {mobileHeader}

      {/* Main content — pushed by sidebar on desktop; padding-left matches sidebar width and transitions */}
      <div
        className={cn(
          'relative z-0 flex flex-1 flex-col min-w-0 transition-[padding-left] duration-200 ease-out',
          sidebarCollapsed ? 'md:pl-[56px]' : 'md:pl-[240px]'
        )}
      >
        <main className="safe-area-bottom flex-1 overflow-auto pb-8 pt-6">
          <div className="mx-auto max-w-[1200px] px-4">
            {children}
          </div>
        </main>

        <footer className="mt-auto border-t border-border/60 bg-muted/20 py-4">
          <div className="mx-auto max-w-[1200px] flex flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:gap-4">
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
    </div>
  )
}
