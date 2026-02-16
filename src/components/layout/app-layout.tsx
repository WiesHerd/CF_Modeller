import { useState } from 'react'
import { Menu, Plus, PanelLeftClose, PanelLeft, FileUp, User, Users, Gauge, BarChart2, Sliders, Table2, GitCompare, HelpCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { BatchCardId } from '@/components/batch/batch-card-picker'

export type AppStep = 'upload' | 'data' | 'modeller' | 'batch-scenario' | 'batch-results' | 'compare-scenarios' | 'reports' | 'help'
export type AppMode = 'single' | 'batch'

/** When collapsed, only this rail width is reserved — content keeps max width. */
const RAIL_WIDTH = 68
const SIDEBAR_EXPANDED_WIDTH = 260

const BATCH_NAV: { id: BatchCardId; label: string; icon: React.ReactNode; tooltip: string }[] = [
  { id: 'cf-optimizer', label: 'CF Optimizer', icon: <Gauge className="size-5 shrink-0" />, tooltip: 'Conversion Factor Optimizer' },
  { id: 'imputed-vs-market', label: 'Market positioning', icon: <BarChart2 className="size-5 shrink-0" />, tooltip: 'Market positioning (imputed)' },
  { id: 'bulk-scenario', label: 'Create and Run Scenario', icon: <Users className="size-5 shrink-0" />, tooltip: 'Create a scenario and run it for all providers' },
  { id: 'detailed-scenario', label: 'Detailed scenarios', icon: <Sliders className="size-5 shrink-0" />, tooltip: 'Scenario overrides by specialty and provider' },
]

interface AppLayoutProps {
  step: AppStep
  onStepChange: (step: AppStep) => void
  currentBatchCard?: BatchCardId | null
  onBatchCardSelect?: (id: BatchCardId) => void
  /** Called when the Reports nav item is clicked (e.g. to return to report library list from a sub-view). */
  onReportsNavClick?: () => void
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
        collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5 text-sm',
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
  currentBatchCard = null,
  onBatchCardSelect,
  onReportsNavClick,
  children,
}: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const isUploadActive = step === 'upload'
  const isDataActive = step === 'data'
  const isModellerActive = step === 'modeller'
  const isBatchScenarioActive = step === 'batch-scenario'
  const isCompareScenariosActive = step === 'compare-scenarios'
  const isReportsActive = step === 'reports'
  const isHelpActive = step === 'help'

  const handleNav = (s: AppStep) => {
    onStepChange(s)
    setMobileOpen(false)
  }

  const handleReportsClick = () => {
    onStepChange('reports')
    setMobileOpen(false)
    onReportsNavClick?.()
  }

  const handleBatchCard = (id: BatchCardId) => {
    onBatchCardSelect?.(id)
    onStepChange('batch-scenario')
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
              className="flex items-center justify-center p-3 w-full hover:bg-muted/50 transition-colors border-b border-border/50 shrink-0 rounded-none"
              aria-label="Go to Upload"
            >
              <img src="/NewIMage.png" alt="" className="size-8 rounded-md object-contain" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">TCC Modeler — Import data</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleNav('upload')}
              className={cn(
                'flex w-full items-center justify-center rounded-lg p-3 transition-colors shrink-0 mx-1 mt-1',
                isUploadActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
              aria-label="Start"
            >
              <Plus className="size-5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Start — Import data</TooltipContent>
        </Tooltip>

        <div className="flex-1 overflow-auto py-1 space-y-0.5 px-1 min-h-0">
          <NavButton
            icon={<FileUp className="size-5 shrink-0" />}
            label="Import data"
            tooltip="Import provider and market data"
            active={isUploadActive}
            disabled={false}
            onClick={() => handleNav('upload')}
            collapsed={true}
          />
          <NavButton
            icon={<Table2 className="size-5 shrink-0" />}
            label="Data browser"
            tooltip="Browse and filter provider and market data"
            active={isDataActive}
            disabled={false}
            onClick={() => handleNav('data')}
            collapsed={true}
          />
          <NavButton
            icon={<User className="size-5 shrink-0" />}
            label="Single scenario"
            tooltip="Model TCC for one provider — from upload or custom"
            active={isModellerActive}
            disabled={false}
            onClick={() => handleNav('modeller')}
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
          <NavButton
            icon={<GitCompare className="size-5 shrink-0" />}
            label="Compare scenarios"
            tooltip="Compare saved optimizer scenarios"
            active={isCompareScenariosActive}
            disabled={false}
            onClick={() => handleNav('compare-scenarios')}
            collapsed={true}
          />
          <NavButton
            icon={<FileText className="size-5 shrink-0" />}
            label="Reports"
            tooltip="Report library — TCC, wRVU, batch runs, impact"
            active={isReportsActive}
            disabled={false}
            onClick={handleReportsClick}
            collapsed={true}
          />
          <NavButton
            icon={<HelpCircle className="size-5 shrink-0" />}
            label="How to use"
            tooltip="Learn what each screen does and when to use it"
            active={isHelpActive}
            disabled={false}
            onClick={() => handleNav('help')}
            collapsed={true}
          />
        </div>

        <div className="p-1 border-t border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="flex w-full items-center justify-center rounded-lg p-3 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )

  /** Full expanded sidebar content (with labels). Shown when expanded; same strip pushes content. */
  const expandedSidebarContent = (
    <div className="flex h-full w-full min-w-[260px] flex-col bg-muted/30 border-r border-border/50">
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
          <Plus className="size-5 shrink-0" />
          <span>Start</span>
        </button>
      </div>
      {/* Nav sections — match home screen cards */}
      <div className="flex-1 overflow-auto py-3 px-2 space-y-5">
        <SidebarSection label="Get started" collapsed={false}>
          <div className="space-y-0.5">
            <NavButton
              icon={<FileUp className="size-5 shrink-0" />}
              label="Import data"
              tooltip="Import provider and market data"
              active={isUploadActive}
              disabled={false}
              onClick={() => handleNav('upload')}
              collapsed={false}
            />
            <NavButton
              icon={<Table2 className="size-5 shrink-0" />}
              label="Data browser"
              tooltip="Browse and filter provider and market data"
              active={isDataActive}
              disabled={false}
              onClick={() => handleNav('data')}
              collapsed={false}
            />
          </div>
        </SidebarSection>
        <SidebarSection label="Single scenario" collapsed={false}>
          <div className="space-y-0.5">
            <NavButton
              icon={<User className="size-5 shrink-0" />}
              label="Single scenario"
              tooltip="Model TCC for one provider — from upload or custom"
              active={isModellerActive}
              disabled={false}
              onClick={() => handleNav('modeller')}
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
        <SidebarSection label="Output" collapsed={false}>
          <NavButton
            icon={<GitCompare className="size-5 shrink-0" />}
            label="Compare scenarios"
            tooltip="Compare saved optimizer scenarios"
            active={isCompareScenariosActive}
            disabled={false}
            onClick={() => handleNav('compare-scenarios')}
            collapsed={false}
          />
          <NavButton
            icon={<FileText className="size-5 shrink-0" />}
            label="Reports"
            tooltip="Report library — TCC, wRVU, batch runs, impact"
            active={isReportsActive}
            disabled={false}
            onClick={handleReportsClick}
            collapsed={false}
          />
        </SidebarSection>
        <SidebarSection label="Help" collapsed={false}>
          <NavButton
            icon={<HelpCircle className="size-5 shrink-0" />}
            label="How to use"
            tooltip="Learn what each screen does and when to use it"
            active={isHelpActive}
            disabled={false}
            onClick={() => handleNav('help')}
            collapsed={false}
          />
        </SidebarSection>
      </div>
      {/* Collapse + footer */}
      <div className="border-t border-border/50 shrink-0">
        <button
          type="button"
          onClick={() => setSidebarCollapsed(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground mx-2 mt-2 transition-colors"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="size-5 shrink-0" />
          <span>Collapse</span>
        </button>
        <p className="px-4 py-3 text-xs text-muted-foreground/80 border-t border-border/50">
          Total cash compensation modeling
        </p>
      </div>
    </div>
  )

  /** Single sidebar: width transitions 68px ↔ 260px and pushes main content (no overlay). */
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
                  <Plus className="size-5 shrink-0" />
                  <span>Start</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-2 space-y-4">
                <SidebarSection label="Get started" collapsed={false}>
                  <div className="space-y-0.5">
                    <NavButton
                      icon={<FileUp className="size-5 shrink-0" />}
                      label="Import data"
                      tooltip="Import provider and market data"
                      active={isUploadActive}
                      disabled={false}
                      onClick={() => handleNav('upload')}
                      collapsed={false}
                    />
                    <NavButton
                      icon={<Table2 className="size-5 shrink-0" />}
                      label="Data browser"
                      tooltip="Browse and filter provider and market data"
                      active={isDataActive}
                      disabled={false}
                      onClick={() => handleNav('data')}
                      collapsed={false}
                    />
                  </div>
                </SidebarSection>
                <SidebarSection label="Single scenario" collapsed={false}>
                  <div className="space-y-0.5">
                    <NavButton
                      icon={<User className="size-5 shrink-0" />}
                      label="Single scenario"
                      tooltip="Model TCC for one provider — from upload or custom"
                      active={isModellerActive}
                      disabled={false}
                      onClick={() => handleNav('modeller')}
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
                <SidebarSection label="Output" collapsed={false}>
                  <NavButton
                    icon={<GitCompare className="size-5 shrink-0" />}
                    label="Compare scenarios"
                    tooltip="Compare saved optimizer scenarios"
                    active={isCompareScenariosActive}
                    disabled={false}
                    onClick={() => handleNav('compare-scenarios')}
                    collapsed={false}
                  />
                  <NavButton
                    icon={<FileText className="size-5 shrink-0" />}
                    label="Reports"
                    tooltip="Report library — TCC, wRVU, batch runs, impact"
                    active={isReportsActive}
                    disabled={false}
                    onClick={handleReportsClick}
                    collapsed={false}
                  />
                </SidebarSection>
                <SidebarSection label="Help" collapsed={false}>
                  <NavButton
                    icon={<HelpCircle className="size-5 shrink-0" />}
                    label="How to use"
                    tooltip="Learn what each screen does and when to use it"
                    active={isHelpActive}
                    disabled={false}
                    onClick={() => handleNav('help')}
                    collapsed={false}
                  />
                </SidebarSection>
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
          'layout-content-wrap relative z-0 flex flex-1 flex-col min-w-0 transition-[padding-left] duration-200 ease-out',
          sidebarCollapsed ? 'md:pl-[68px]' : 'md:pl-[260px]'
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
