import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import Papa from 'papaparse'
import type { ProviderRow } from '@/types/provider'
import type { ScenarioResults } from '@/types/scenario'
import { formatCurrency } from '@/utils/format'

export interface DivisionRow {
  provider: ProviderRow
  results: ScenarioResults
}

interface DivisionTableProps {
  rows: DivisionRow[]
  onExportCSV?: (csv: string) => void
}

type SortKey = 'name' | 'specialty' | 'currentTCC' | 'modeledTCC' | 'delta' | 'wrvuPercentile' | 'tccPercentile' | 'risk'

export function DivisionTable({ rows, onExportCSV }: DivisionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [search, setSearch] = useState('')

  const specialties = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.provider.specialty).filter(Boolean))
      ).sort() as string[],
    [rows]
  )

  const filtered = useMemo(() => {
    let list = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) =>
          (r.provider.providerName ?? '').toLowerCase().includes(q) ||
          (r.provider.providerId ?? '').toLowerCase().includes(q)
      )
    }
    if (filterSpecialty !== 'all') {
      list = list.filter((r) => r.provider.specialty === filterSpecialty)
    }
    if (filterRisk === 'high') {
      list = list.filter((r) => r.results.risk.highRisk.length > 0)
    } else if (filterRisk === 'warn') {
      list = list.filter((r) => r.results.risk.warnings.length > 0)
    }
    return list
  }, [rows, search, filterSpecialty, filterRisk])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const mult = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      let va: number | string
      let vb: number | string
      switch (sortKey) {
        case 'name':
          va = a.provider.providerName ?? a.provider.providerId ?? ''
          vb = b.provider.providerName ?? b.provider.providerId ?? ''
          break
        case 'specialty':
          va = a.provider.specialty ?? ''
          vb = b.provider.specialty ?? ''
          break
        case 'currentTCC':
          va = a.results.currentTCC
          vb = b.results.currentTCC
          break
        case 'modeledTCC':
          va = a.results.modeledTCC
          vb = b.results.modeledTCC
          break
        case 'delta':
          va = a.results.changeInTCC
          vb = b.results.changeInTCC
          break
        case 'wrvuPercentile':
          va = a.results.wrvuPercentile
          vb = b.results.wrvuPercentile
          break
        case 'tccPercentile':
          va = a.results.tccPercentile
          vb = b.results.tccPercentile
          break
        case 'risk':
          va = a.results.risk.highRisk.length * 2 + a.results.risk.warnings.length
          vb = b.results.risk.highRisk.length * 2 + b.results.risk.warnings.length
          break
        default:
          return 0
      }
      if (typeof va === 'number' && typeof vb === 'number') return mult * (va - vb)
      return mult * String(va).localeCompare(String(vb))
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else setSortKey(key)
  }

  const exportCSV = () => {
    const headers = [
      'Provider Name',
      'Provider ID',
      'Specialty',
      'Division',
      'Current TCC',
      'Modeled TCC',
      'Change in TCC',
      'wRVU %ile',
      'TCC %ile',
      'Risk',
    ]
    const data = sorted.map((r) => [
      r.provider.providerName ?? '',
      r.provider.providerId ?? '',
      r.provider.specialty ?? '',
      r.provider.division ?? '',
      r.results.currentTCC,
      r.results.modeledTCC,
      r.results.changeInTCC,
      r.results.wrvuPercentile.toFixed(1),
      r.results.tccPercentile.toFixed(1),
      r.results.risk.highRisk.length > 0
        ? 'HIGH'
        : r.results.risk.warnings.length > 0
          ? 'Warning'
          : '—',
    ])
    const csv = Papa.unparse([headers, ...data])
    if (onExportCSV) onExportCSV(csv)
    else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'division-results.csv'
      link.click()
      URL.revokeObjectURL(link.href)
    }
  }

  const fmt = (n: number) =>
    n >= 1000 ? n.toLocaleString() : n.toFixed(0)
  const fmtMoney = (n: number) =>
    formatCurrency(n, { decimals: 0 })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Input
          placeholder="Search provider…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[44px] w-full touch-manipulation sm:max-w-xs"
        />
        <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
          <SelectTrigger className="min-h-[44px] w-full min-w-0 touch-manipulation sm:w-[160px]">
            <SelectValue placeholder="Specialty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specialties</SelectItem>
            {specialties.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRisk} onValueChange={setFilterRisk}>
          <SelectTrigger className="min-h-[44px] w-full min-w-0 touch-manipulation sm:w-[140px]">
            <SelectValue placeholder="Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="high">High risk only</SelectItem>
            <SelectItem value="warn">Warnings only</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} className="min-h-[44px] touch-manipulation">
          <Download className="size-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <div className="touch-scroll-x rounded-md border overflow-x-auto">
        <ScrollArea className="h-[400px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('name')}
                  >
                    Provider {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('specialty')}
                  >
                    Specialty {sortKey === 'specialty' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('currentTCC')}
                  >
                    Current TCC {sortKey === 'currentTCC' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('modeledTCC')}
                  >
                    Modeled TCC {sortKey === 'modeledTCC' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('delta')}
                  >
                    Delta {sortKey === 'delta' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('wrvuPercentile')}
                  >
                    wRVU %ile {sortKey === 'wrvuPercentile' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('tccPercentile')}
                  >
                    TCC %ile {sortKey === 'tccPercentile' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => toggleSort('risk')}
                  >
                    Risk {sortKey === 'risk' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.provider.providerId ?? r.provider.providerName ?? Math.random()}>
                  <TableCell className="font-medium">
                    {r.provider.providerName ?? r.provider.providerId ?? '—'}
                  </TableCell>
                  <TableCell>{r.provider.specialty ?? '—'}</TableCell>
                  <TableCell>{fmtMoney(r.results.currentTCC)}</TableCell>
                  <TableCell>{fmtMoney(r.results.modeledTCC)}</TableCell>
                  <TableCell
                    className={
                      r.results.changeInTCC >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {r.results.changeInTCC >= 0 ? '+' : ''}
                    {fmtMoney(r.results.changeInTCC)}
                  </TableCell>
                  <TableCell>{fmt(r.results.wrvuPercentile)}</TableCell>
                  <TableCell>{fmt(r.results.tccPercentile)}</TableCell>
                  <TableCell>
                    {r.results.risk.highRisk.length > 0 ? (
                      <Badge variant="destructive">High</Badge>
                    ) : r.results.risk.warnings.length > 0 ? (
                      <Badge variant="secondary">Warn</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  )
}
