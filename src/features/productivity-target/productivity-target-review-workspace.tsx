import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProductivityTargetRunResult, ProductivityTargetSpecialtyResult, ProviderTargetStatus, PlanningCFSummary } from '@/types/productivity-target'
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
}: {
  result: ProductivityTargetRunResult
  percentilesBySpecialty?: Record<string, SpecialtyPercentiles>
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
    <div className="space-y-4">
      <div className="sticky top-0 z-20 rounded-lg border border-border/70 bg-background/95 p-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full min-w-[200px] md:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white pl-8 dark:bg-background"
              placeholder="Search specialty..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as 'all' | ProviderTargetStatus)}
              >
                <SelectTrigger className="w-[160px] bg-white dark:bg-background">
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
          </div>
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
