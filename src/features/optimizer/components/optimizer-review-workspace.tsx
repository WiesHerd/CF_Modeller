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
import type { OptimizerSpecialtyResult } from '@/types/optimizer'
import type { OptimizerSettings } from '@/types/optimizer'
import type { MarketRow } from '@/types/market'
import type { GapInterpretation } from '@/features/optimizer/components/optimizer-constants'
import { getGapInterpretation, GAP_INTERPRETATION_LABEL } from '@/features/optimizer/components/optimizer-constants'
import { OptimizerResultsTable } from '@/features/optimizer/components/optimizer-results-table'
import { OptimizerDetailDrawer } from '@/features/optimizer/components/optimizer-detail-drawer'

const RECOMMENDATION_FILTER_OPTIONS = [
  { value: 'all', label: 'All recommendations' },
  { value: 'INCREASE', label: 'Increase' },
  { value: 'DECREASE', label: 'Decrease' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'NO_RECOMMENDATION', label: 'No recommendation' },
] as const

function rowMatchesSearch(r: OptimizerSpecialtyResult, query: string) {
  if (!query.trim()) return true
  const lower = query.trim().toLowerCase()
  const specialtyMatch = (r.specialty ?? '').toLowerCase().includes(lower)
  const divisions = [
    ...new Set(r.providerContexts.map((c) => (c.provider.division ?? '').trim()).filter(Boolean)),
  ]
  return specialtyMatch || divisions.some((division) => division.toLowerCase().includes(lower))
}

const PAY_VS_PRODUCTIVITY_OPTIONS: { value: 'all' | GapInterpretation; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overpaid', label: GAP_INTERPRETATION_LABEL.overpaid },
  { value: 'underpaid', label: GAP_INTERPRETATION_LABEL.underpaid },
  { value: 'aligned', label: GAP_INTERPRETATION_LABEL.aligned },
]

export function OptimizerReviewWorkspace({
  rows,
  settings = null,
  marketRows = [],
  synonymMap = {},
}: {
  rows: OptimizerSpecialtyResult[]
  settings?: OptimizerSettings | null
  marketRows?: MarketRow[]
  synonymMap?: Record<string, string>
}) {
  const [search, setSearch] = useState('')
  const [payVsProductivity, setPayVsProductivity] = useState<'all' | GapInterpretation>('all')
  const [recommendation, setRecommendation] = useState<string>('all')
  const [detailRow, setDetailRow] = useState<OptimizerSpecialtyResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const visibleRows = useMemo(() => {
    let list = rows
    if (search.trim()) list = list.filter((r) => rowMatchesSearch(r, search))
    if (payVsProductivity !== 'all') {
      list = list.filter((r) => getGapInterpretation(r.keyMetrics.gap) === payVsProductivity)
    }
    if (recommendation !== 'all') {
      list = list.filter((r) => r.recommendedAction === recommendation)
    }
    return list
  }, [rows, search, payVsProductivity, recommendation])

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
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full min-w-[200px] md:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white pl-8 dark:bg-background"
              placeholder="Search specialty or division..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pay vs productivity</Label>
              <Select
                value={payVsProductivity}
                onValueChange={(v) => setPayVsProductivity(v as 'all' | GapInterpretation)}
              >
                <SelectTrigger className="w-[180px] bg-white dark:bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_VS_PRODUCTIVITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Recommendation</Label>
              <Select value={recommendation} onValueChange={setRecommendation}>
                <SelectTrigger className="w-[180px] bg-white dark:bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECOMMENDATION_FILTER_OPTIONS.map((opt) => (
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
          No specialties match your search or filters. Try changing the filters or search.
        </p>
      ) : (
        <OptimizerResultsTable rows={visibleRows} onOpenDetail={handleOpenDetail} />
      )}

      <OptimizerDetailDrawer
        row={detailRow}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        settings={settings}
        marketRows={marketRows}
        synonymMap={synonymMap}
      />
    </div>
  )
}
