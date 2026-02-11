import { useMemo, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, AlertCircle, MapPinOff, Gauge } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BatchResultsTable } from '@/components/batch/batch-results-table'
import { downloadBatchResultsCSV, exportBatchResultsXLSX } from '@/lib/batch-export'
import type { BatchResults, BatchRiskLevel, MarketMatchStatus } from '@/types/batch'

interface BatchResultsDashboardProps {
  results: BatchResults
  onExportCSV?: () => void
  onExportXLSX?: () => void
}

const RISK_LEVELS: BatchRiskLevel[] = ['high', 'medium', 'low']
const MATCH_STATUSES: MarketMatchStatus[] = ['Exact', 'Normalized', 'Synonym', 'Missing']

export function BatchResultsDashboard({
  results,
  onExportCSV,
  onExportXLSX,
}: BatchResultsDashboardProps) {
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>('all')
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const [showMissingOnly, setShowMissingOnly] = useState(false)
  const gapChartRef = useRef<HTMLDivElement>(null)

  const { rows } = results

  const specialties = useMemo(() => {
    const set = new Set(rows.map((r) => r.specialty).filter(Boolean))
    return Array.from(set).sort()
  }, [rows])
  const divisions = useMemo(() => {
    const set = new Set(rows.map((r) => r.division).filter(Boolean))
    return Array.from(set).sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    let out = rows
    if (specialtyFilter !== 'all') out = out.filter((r) => r.specialty === specialtyFilter)
    if (divisionFilter !== 'all') out = out.filter((r) => r.division === divisionFilter)
    if (riskFilter !== 'all') out = out.filter((r) => r.riskLevel === riskFilter)
    if (matchStatusFilter !== 'all') out = out.filter((r) => r.matchStatus === matchStatusFilter)
    if (showFlaggedOnly)
      out = out.filter(
        (r) =>
          r.riskLevel === 'high' ||
          r.warnings.length > 0 ||
          (r.results?.governanceFlags &&
            (r.results.governanceFlags.underpayRisk || r.results.governanceFlags.fmvCheckSuggested))
      )
    if (showMissingOnly) out = out.filter((r) => r.matchStatus === 'Missing')
    return out
  }, [
    rows,
    specialtyFilter,
    divisionFilter,
    riskFilter,
    matchStatusFilter,
    showFlaggedOnly,
    showMissingOnly,
  ])

  const summary = useMemo(() => {
    const byRisk = { high: 0, medium: 0, low: 0 }
    let missingMarket = 0
    let gapSum = 0
    let gapCount = 0
    for (const r of rows) {
      byRisk[r.riskLevel]++
      if (r.matchStatus === 'Missing') missingMarket++
      if (r.results?.alignmentGapModeled != null && Number.isFinite(r.results.alignmentGapModeled)) {
        gapSum += r.results.alignmentGapModeled
        gapCount++
      }
    }
    return {
      byRisk,
      missingMarket,
      avgGap: gapCount > 0 ? gapSum / gapCount : null,
    }
  }, [rows])

  const gapHistogramData = useMemo(() => {
    const bins: Record<string, number> = {}
    const bucket = (g: number) => {
      if (g < -20) return '< -20'
      if (g < -10) return '-20 to -10'
      if (g < 0) return '-10 to 0'
      if (g < 10) return '0 to 10'
      if (g < 20) return '10 to 20'
      return '> 20'
    }
    for (const r of rows) {
      const g = r.results?.alignmentGapModeled
      if (g != null && Number.isFinite(g)) {
        const b = bucket(g)
        bins[b] = (bins[b] || 0) + 1
      }
    }
    const order = ['< -20', '-20 to -10', '-10 to 0', '0 to 10', '10 to 20', '> 20']
    return order.filter((k) => bins[k]).map((name) => ({ name, count: bins[name] }))
  }, [rows])

  const flaggedByDivision = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      if (r.riskLevel !== 'high' && r.warnings.length === 0) continue
      const div = r.division || '—'
      map.set(div, (map.get(div) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([division, count]) => ({ division, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [rows])

  const incentiveHistogramData = useMemo(() => {
    const buckets: { name: string; count: number; fill: string }[] = [
      { name: '< -100k', count: 0, fill: 'hsl(var(--destructive))' },
      { name: '-100k to 0', count: 0, fill: 'hsl(var(--destructive))' },
      { name: '0 to 50k', count: 0, fill: 'hsl(142 76% 36%)' },
      { name: '50k to 100k', count: 0, fill: 'hsl(142 76% 36%)' },
      { name: '> 100k', count: 0, fill: 'hsl(142 76% 36%)' },
    ]
    const getBucket = (v: number) => {
      if (v < -100_000) return 0
      if (v < 0) return 1
      if (v < 50_000) return 2
      if (v < 100_000) return 3
      return 4
    }
    let hasAny = false
    for (const r of rows) {
      const inc = r.results?.annualIncentive
      if (inc != null && Number.isFinite(inc)) {
        buckets[getBucket(inc)].count++
        hasAny = true
      }
    }
    return hasAny ? buckets : []
  }, [rows])

  return (
    <div className="space-y-8">
      <p className="section-subtitle">
        Run at {new Date(results.runAt).toLocaleString()} — {results.providerCount} providers ×{' '}
        {results.scenarioCount} scenario(s) = {results.rows.length} rows.
      </p>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-l-4 border-l-destructive/80 bg-destructive/5 dark:bg-destructive/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setRiskFilter('high')
              setMatchStatusFilter('all')
              setShowMissingOnly(false)
            }}
            aria-pressed={riskFilter === 'high'}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">High risk</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">{summary.byRisk.high}</p>
                <p className="text-[11px] text-muted-foreground">rows need review</p>
              </div>
              {riskFilter === 'high' && (
                <span className="text-xs text-destructive font-medium shrink-0">Filtered</span>
              )}
            </CardContent>
          </button>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-amber-500/70 bg-amber-500/5 dark:bg-amber-500/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setRiskFilter('medium')
              setMatchStatusFilter('all')
              setShowMissingOnly(false)
            }}
            aria-pressed={riskFilter === 'medium'}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Medium risk</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">{summary.byRisk.medium}</p>
                <p className="text-[11px] text-muted-foreground">watch list</p>
              </div>
              {riskFilter === 'medium' && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0">Filtered</span>
              )}
            </CardContent>
          </button>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-orange-500/70 bg-orange-500/5 dark:bg-orange-500/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setMatchStatusFilter('Missing')
              setRiskFilter('all')
              setShowMissingOnly(false)
            }}
            aria-pressed={matchStatusFilter === 'Missing'}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
                <MapPinOff className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Missing market</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">{summary.missingMarket}</p>
                <p className="text-[11px] text-muted-foreground">no benchmark match</p>
              </div>
              {matchStatusFilter === 'Missing' && (
                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium shrink-0">Filtered</span>
              )}
            </CardContent>
          </button>
        </Card>
        <Card className="overflow-hidden border-l-4 border-l-[var(--chart-1)] bg-[var(--chart-1)]/10 transition-all hover:shadow-md p-0 gap-0">
          <button
            type="button"
            onClick={() => {
              setRiskFilter('all')
              setMatchStatusFilter('all')
              setShowMissingOnly(false)
              gapChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
          >
            <CardContent className="flex flex-row items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--chart-1)]/15 text-[var(--chart-1)]">
                <Gauge className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Avg alignment gap</p>
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {summary.avgGap != null ? summary.avgGap.toFixed(1) : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground">comp vs prod %</p>
              </div>
            </CardContent>
          </button>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3" ref={gapChartRef}>
        {gapHistogramData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Comp-vs-prod gap (modeled)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={gapHistogramData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {incentiveHistogramData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Incentive distribution (modeled)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={incentiveHistogramData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {incentiveHistogramData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {flaggedByDivision.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Flagged by division</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={flaggedByDivision}
                  layout="vertical"
                  margin={{ top: 8, right: 8, left: 40, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="2 4" className="stroke-muted" strokeOpacity={0.5} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="division"
                    width={80}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Specialty</Label>
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Division</Label>
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Risk</Label>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {RISK_LEVELS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Match</Label>
          <Select value={matchStatusFilter} onValueChange={setMatchStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {MATCH_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFlaggedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFlaggedOnly((v) => !v)}
          >
            Flagged only
          </Button>
          <Button
            variant={showMissingOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowMissingOnly((v) => !v)}
          >
            Missing market
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Results table ({filteredRows.length} rows)</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV ?? (() => downloadBatchResultsCSV(results))}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportXLSX ?? (() => exportBatchResultsXLSX(results))}
            >
              Export XLSX
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BatchResultsTable rows={filteredRows} maxHeight="60vh" />
        </CardContent>
      </Card>
    </div>
  )
}
