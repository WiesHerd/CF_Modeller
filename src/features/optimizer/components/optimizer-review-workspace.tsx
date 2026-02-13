import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { OptimizerSpecialtyResult } from '@/types/optimizer'
import {
  formatPercentile,
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
} from '@/features/optimizer/components/optimizer-constants'
import { OptimizerResultsTable } from '@/features/optimizer/components/optimizer-results-table'
import { OptimizerDetailDrawer } from '@/features/optimizer/components/optimizer-detail-drawer'
import { MarketCFLine } from '@/features/optimizer/components/market-cf-line'

function rowMatchesSearch(r: OptimizerSpecialtyResult, query: string) {
  if (!query.trim()) return true
  const lower = query.trim().toLowerCase()
  const specialtyMatch = (r.specialty ?? '').toLowerCase().includes(lower)
  const divisions = [
    ...new Set(r.providerContexts.map((c) => (c.provider.division ?? '').trim()).filter(Boolean)),
  ]
  return specialtyMatch || divisions.some((division) => division.toLowerCase().includes(lower))
}

function formatRecommendation(row: OptimizerSpecialtyResult): string {
  const labels: Record<string, string> = {
    INCREASE: 'Increase',
    DECREASE: 'Decrease',
    HOLD: 'Hold',
    NO_RECOMMENDATION: 'No recommendation',
  }
  if (row.recommendedAction === 'HOLD' || row.recommendedAction === 'NO_RECOMMENDATION') {
    return labels[row.recommendedAction] ?? row.recommendedAction
  }
  const pct = row.cfChangePct >= 0 ? `+${row.cfChangePct.toFixed(1)}%` : `${row.cfChangePct.toFixed(1)}%`
  return `${labels[row.recommendedAction] ?? row.recommendedAction} ${pct}`
}

export function OptimizerReviewWorkspace({ rows }: { rows: OptimizerSpecialtyResult[] }) {
  const [search, setSearch] = useState('')
  const [detailRow, setDetailRow] = useState<OptimizerSpecialtyResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const visibleRows = useMemo(
    () => (search.trim() ? rows.filter((r) => rowMatchesSearch(r, search)) : rows),
    [rows, search]
  )

  const handleOpenDetail = (row: OptimizerSpecialtyResult) => {
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
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            placeholder="Search specialty or division..."
          />
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No specialties match your search.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <OptimizerResultsTable rows={visibleRows} onOpenDetail={handleOpenDetail} />
          </div>
          <div className="grid gap-3 md:hidden">
            {visibleRows.map((row) => {
              const gapInterpretation = getGapInterpretation(row.keyMetrics.gap)
              const gapColor =
                gapInterpretation === 'overpaid'
                  ? 'text-red-600 dark:text-red-400'
                  : gapInterpretation === 'underpaid'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
              const divisions = [
                ...new Set(
                  row.providerContexts
                    .map((c) => (c.provider.division ?? '').trim())
                    .filter(Boolean)
                ),
              ].join(', ')
              return (
                <button
                  key={row.specialty}
                  type="button"
                  onClick={() => handleOpenDetail(row)}
                  className="rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{row.specialty}</p>
                      {divisions ? (
                        <p className="truncate text-xs text-muted-foreground">{divisions}</p>
                      ) : null}
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${gapColor}`}>
                      {GAP_INTERPRETATION_LABEL[gapInterpretation]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      wRVU {formatPercentile(row.keyMetrics.prodPercentile)} · TCC{' '}
                      {formatPercentile(row.keyMetrics.compPercentile)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{formatRecommendation(row)}</span>
                    {row.marketCF ? (
                      <MarketCFLine
                        currentCF={row.currentCF}
                        recommendedCF={row.recommendedCF}
                        marketCF={row.marketCF}
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">No market</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      <OptimizerDetailDrawer
        row={detailRow}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
      />
    </div>
  )
}
