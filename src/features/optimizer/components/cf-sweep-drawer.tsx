import { useCallback, useMemo, useState } from 'react'
import { LineChart, TrendingUp } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type {
  OptimizerRunResult,
  OptimizerSettings,
  CFSweepAllResult,
  CFSweepRow,
} from '@/types/optimizer'
import { runModeledTCCSweepAllSpecialties } from '@/lib/optimizer-engine'

const DEFAULT_PERCENTILES = [20, 30, 40, 50]

function formatPercentile(v: number): string {
  if (v < 25) return `<25 (${v.toFixed(1)})`
  if (v > 90) return `>90 (${v.toFixed(1)})`
  return v.toFixed(1)
}

function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export interface CFSweepDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  settings: OptimizerSettings
  synonymMap: Record<string, string>
  /** Last optimizer result (for specialty list and context). */
  result: OptimizerRunResult | null
}

export function CFSweepDrawer({
  open,
  onOpenChange,
  providerRows,
  marketRows,
  settings,
  synonymMap,
  result,
}: CFSweepDrawerProps) {
  const maxFromGov = settings.maxRecommendedCFPercentile ?? 50
  const percentileOptions = useMemo(() => {
    const set = new Set(DEFAULT_PERCENTILES)
    if (maxFromGov > 0 && maxFromGov <= 100) set.add(maxFromGov)
    return [...set].sort((a, b) => a - b)
  }, [maxFromGov])

  const [selectedPercentiles, setSelectedPercentiles] = useState<number[]>(() => [...DEFAULT_PERCENTILES])
  const [scope, setScope] = useState<string>('all')
  const [sweepResult, setSweepResult] = useState<CFSweepAllResult | null>(null)

  const togglePercentile = useCallback((p: number) => {
    setSelectedPercentiles((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b)
    )
  }, [])

  const runSweep = useCallback(() => {
    if (selectedPercentiles.length === 0) return
    const specialtyFilter = scope === 'all' ? undefined : scope
    const out = runModeledTCCSweepAllSpecialties(providerRows, marketRows, settings, {
      cfPercentiles: selectedPercentiles,
      synonymMap,
      specialtyFilter,
    })
    setSweepResult(out)
  }, [providerRows, marketRows, settings, synonymMap, selectedPercentiles, scope])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setSweepResult(null)
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const specialtiesForScope = useMemo(
    () => (result?.bySpecialty?.map((r) => r.specialty).filter(Boolean) ?? []) as string[],
    [result]
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-6 overflow-hidden px-6 py-5 sm:max-w-[680px] md:max-w-[720px] border-border"
      >
        <SheetHeader className="space-y-1.5 border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            <LineChart className="size-5 text-muted-foreground" />
            Model at CF percentiles
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground leading-relaxed">
            Run the same population at several conversion factor percentiles (e.g. 20th, 30th, 40th, 50th) and see
            modeled TCC percentile, gap, and incentives. Use this to see if raising CF would make TCC percentile walk
            with wRVU percentile.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">CF percentiles to run</Label>
            <div className="flex flex-wrap gap-2">
              {percentileOptions.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-foreground/25 has-[:checked]:bg-muted has-[:checked]:shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedPercentiles.includes(p)}
                    onChange={() => togglePercentile(p)}
                    className="rounded border-input"
                  />
                  {p}th{p === maxFromGov ? ' (max from Governance)' : ''}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="All specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All specialties</SelectItem>
                {specialtiesForScope.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={runSweep} disabled={selectedPercentiles.length === 0} className="gap-2 w-fit">
            <TrendingUp className="size-4" />
            Run sweep
          </Button>

          {sweepResult ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
              <h4 className="text-sm font-semibold text-foreground">Results</h4>
              <SweepResultsTable sweepResult={sweepResult} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SweepResultsTable({ sweepResult }: { sweepResult: CFSweepAllResult }) {
  const entries = useMemo(
    () => Object.entries(sweepResult.bySpecialty).filter(([, rows]) => rows.length > 0),
    [sweepResult]
  )

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No results. Run the sweep with at least one percentile and ensure there are included providers for the
        selected scope.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {entries.map(([specialty, rows]) => (
        <div key={specialty} className="overflow-hidden rounded-lg border border-border">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">{specialty}</div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-right font-semibold">CF %ile</TableHead>
                <TableHead className="text-right font-semibold">CF $</TableHead>
                <TableHead className="text-right font-semibold">Mean TCC %ile</TableHead>
                <TableHead className="text-right font-semibold">Mean wRVU %ile</TableHead>
                <TableHead className="text-right font-semibold">Gap</TableHead>
                <TableHead className="text-right font-semibold">Incentive $</TableHead>
                <TableHead className="text-right font-semibold">Spend impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: CFSweepRow) => (
                <TableRow key={row.cfPercentile} className="tabular-nums text-sm">
                  <TableCell className="text-right">{row.cfPercentile}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cfDollars, 2)}</TableCell>
                  <TableCell className="text-right">{formatPercentile(row.meanModeledTCCPctile)}</TableCell>
                  <TableCell className="text-right">{formatPercentile(row.meanWrvuPctile)}</TableCell>
                  <TableCell className="text-right">{formatPercentile(row.gap)}</TableCell>
                  <TableCell className="text-right">
                    {row.totalIncentiveDollars != null ? formatCurrency(row.totalIncentiveDollars, 0) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.spendImpactRaw != null ? formatCurrency(row.spendImpactRaw, 0) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}
