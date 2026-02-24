import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProductivityTargetRunResult, ProductivityTargetSpecialtyResult, ProviderTargetStatus, IncentiveDistributionMethod } from '@/types/productivity-target'
import type { SpecialtyPercentiles } from '@/features/productivity-target/productivity-target-percentiles'
import { ProductivityTargetDetailDrawer } from '@/features/productivity-target/productivity-target-detail-drawer'
import { ProductivityTargetResultsTable } from '@/features/productivity-target/productivity-target-results-table'
import { ProductivityTargetHistogram } from '@/features/productivity-target/productivity-target-histogram'

const STATUS_FILTER_OPTIONS: { value: 'all' | ProviderTargetStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Above Target', label: 'Above Target' },
  { value: 'At Target', label: 'At Target' },
  { value: 'Below Target', label: 'Below Target' },
]

const INCENTIVE_DISTRIBUTION_OPTIONS: { value: IncentiveDistributionMethod; label: string }[] = [
  { value: 'individual', label: 'Individual (above target × CF)' },
  { value: 'pool_by_wrvu_share', label: 'Pool by specialty — share of group wRVUs' },
  { value: 'pool_by_wrvu_above_target_share', label: 'Pool by specialty — share of wRVUs above target' },
]

function rowMatchesSearch(r: ProductivityTargetSpecialtyResult, query: string): boolean {
  if (!query.trim()) return true
  const lower = query.trim().toLowerCase()
  return (r.specialty ?? '').toLowerCase().includes(lower)
}

function specialtyHasStatus(r: ProductivityTargetSpecialtyResult, status: 'all' | ProviderTargetStatus): boolean {
  if (status === 'all') return true
  return r.providers.some((p) => p.status === status)
}

export function ProductivityTargetReviewWorkspace({
  result,
  percentilesBySpecialty,
  incentiveDistributionMethod,
  onIncentiveDistributionMethodChange,
}: {
  result: ProductivityTargetRunResult
  percentilesBySpecialty?: Record<string, SpecialtyPercentiles>
  incentiveDistributionMethod: IncentiveDistributionMethod
  onIncentiveDistributionMethodChange: (method: IncentiveDistributionMethod) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProviderTargetStatus>('all')
  const [detailRow, setDetailRow] = useState<ProductivityTargetSpecialtyResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const visibleRows = useMemo(() => {
    let list = result.bySpecialty
    if (search.trim()) list = list.filter((r) => rowMatchesSearch(r, search))
    if (statusFilter !== 'all') list = list.filter((r) => specialtyHasStatus(r, statusFilter))
    return list
  }, [result.bySpecialty, search, statusFilter])

  const handleOpenDetail = (row: ProductivityTargetSpecialtyResult) => {
    setDetailRow(row)
    setDrawerOpen(true)
  }

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open)
    if (!open) setDetailRow(null)
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
        <div className="relative flex items-center gap-2 shrink-0">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[200px] bg-background pl-2 dark:bg-background"
            placeholder="Search specialty..."
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Status</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'all' | ProviderTargetStatus)}
          >
            <SelectTrigger className="h-9 w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Incentive</span>
          <Select
            value={incentiveDistributionMethod}
            onValueChange={(v) => onIncentiveDistributionMethodChange(v as IncentiveDistributionMethod)}
          >
            <SelectTrigger className="h-9 w-[260px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INCENTIVE_DISTRIBUTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          No specialties match your search or filters.
        </p>
      ) : (
        <>
          <ProductivityTargetResultsTable
            rows={visibleRows}
            onOpenDetail={handleOpenDetail}
            percentilesBySpecialty={percentilesBySpecialty}
          />
          <ProductivityTargetHistogram result={result} />
        </>
      )}

      <ProductivityTargetDetailDrawer
        row={detailRow}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        specialtyPercentiles={percentilesBySpecialty}
        planningCFSummary={result?.planningCFSummary}
      />
    </div>
  )
}
