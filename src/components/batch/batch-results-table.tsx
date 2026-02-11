import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatNumber } from '@/utils/format'
import type { BatchRowResult } from '@/types/batch'

const columnHelper = createColumnHelper<BatchRowResult>()

const EMPTY = '—'

function numOrEmpty(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatNumber(n, 2)
}

function curOrEmpty(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return EMPTY
  return formatCurrency(n, { decimals: 0 })
}

interface BatchResultsTableProps {
  rows: BatchRowResult[]
  /** Optional filter applied externally (e.g. filtered rows from dashboard). */
  maxHeight?: string
}

export function BatchResultsTable({ rows, maxHeight = '60vh' }: BatchResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'providerName', desc: false },
  ])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<BatchRowResult, any>[]>(
    () => [
      columnHelper.accessor('providerName', {
        header: 'Provider',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, sticky: true, minWidth: '140px' },
      }),
      columnHelper.accessor('providerId', {
        header: 'ID',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '80px' },
      }),
      columnHelper.accessor('specialty', {
        header: 'Specialty',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '140px' },
      }),
      columnHelper.accessor('division', {
        header: 'Division',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '100px' },
      }),
      columnHelper.accessor('scenarioName', {
        header: 'Model name',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '120px' },
      }),
      columnHelper.accessor((r) => r.results?.currentTCC, {
        id: 'currentTCC',
        header: 'Current TCC',
        cell: (c) => curOrEmpty(c.getValue()),
        meta: { minWidth: '90px' },
      }),
      columnHelper.accessor((r) => r.results?.modeledTCC, {
        id: 'modeledTCC',
        header: 'Modeled TCC',
        cell: (c) => curOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.currentCF, {
        id: 'currentCF',
        header: 'Current CF',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.modeledCF, {
        id: 'modeledCF',
        header: 'Modeled CF',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.totalWRVUs, {
        id: 'workRVUs',
        header: 'wRVUs',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.annualIncentive, {
        id: 'annualIncentive',
        header: 'Incentive',
        cell: (c) => {
          const val = c.getValue() as number | undefined
          const text = curOrEmpty(val)
          if (text === EMPTY) return text
          const isNegative = val != null && Number.isFinite(val) && val < 0
          const isPositive = val != null && Number.isFinite(val) && val > 0
          const colorClass = isNegative ? 'text-destructive font-medium' : isPositive ? 'text-green-600 dark:text-green-400 font-medium' : undefined
          return colorClass ? <span className={colorClass}>{text}</span> : text
        },
      }),
      columnHelper.accessor((r) => r.results?.psqDollars, {
        id: 'psqDollars',
        header: 'PSQ',
        cell: (c) => {
          const val = c.getValue() as number | undefined
          const text = curOrEmpty(val)
          if (text === EMPTY) return text
          const isNegative = val != null && Number.isFinite(val) && val < 0
          const isPositive = val != null && Number.isFinite(val) && val > 0
          const colorClass = isNegative ? 'text-destructive font-medium' : isPositive ? 'text-green-600 dark:text-green-400 font-medium' : undefined
          return colorClass ? <span className={colorClass}>{text}</span> : text
        },
      }),
      columnHelper.accessor((r) => r.results?.tccPercentile, {
        id: 'tccPercentile',
        header: 'TCC %tile',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.modeledTCCPercentile, {
        id: 'modeledTCCPercentile',
        header: 'Modeled TCC %tile',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.wrvuPercentile, {
        id: 'wrvuPercentile',
        header: 'wRVU %tile',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.alignmentGapModeled, {
        id: 'alignmentGapModeled',
        header: 'Gap (modeled)',
        cell: (c) => numOrEmpty(c.getValue()),
      }),
      columnHelper.accessor((r) => r.results?.imputedTCCPerWRVURatioModeled, {
        id: 'imputedTCCPerWRVU',
        header: 'Imputed $/wRVU',
        cell: (c) => curOrEmpty(c.getValue()),
      }),
      columnHelper.accessor('matchStatus', {
        header: 'Match',
        cell: (c) => {
          const v = c.getValue()
          const status = v as BatchRowResult['matchStatus']
          const variant =
            status === 'Missing'
              ? 'destructive'
              : status === 'Synonym'
                ? 'secondary'
                : 'outline'
          return <Badge variant={variant}>{status}</Badge>
        },
      }),
      columnHelper.accessor('matchedMarketSpecialty', {
        header: 'Matched market',
        cell: (c) => c.getValue() || EMPTY,
        meta: { wrap: true, minWidth: '120px' },
      }),
      columnHelper.accessor('riskLevel', {
        header: 'Risk',
        cell: (c) => {
          const v = c.getValue() as BatchRowResult['riskLevel']
          const variant =
            v === 'high' ? 'destructive' : v === 'medium' ? 'secondary' : 'outline'
          return <Badge variant={variant}>{v}</Badge>
        },
      }),
      columnHelper.accessor('warnings', {
        header: 'Messages',
        cell: (c) => {
          const w = c.getValue() as string[]
          if (!w?.length) return '—'
          const full = w.join('; ')
          return (
            <span className="block max-w-[220px] break-words text-left" title={full}>
              {w.length > 2 ? `${w.slice(0, 2).join('; ')} (+${w.length - 2} more)` : full}
            </span>
          )
        },
        meta: { wrap: true, minWidth: '180px' },
      }),
    ],
    []
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: 'includesString',
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search table..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div className="rounded-md border overflow-auto" style={{ maxHeight }}>
        <Table className="min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as { sticky?: boolean; minWidth?: string; wrap?: boolean } | undefined
                  const stickyClass = meta?.sticky ? 'sticky left-0 z-20 bg-muted/95 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]' : ''
                  const wrapClass = meta?.wrap ? 'whitespace-normal' : 'whitespace-nowrap'
                  return (
                    <TableHead
                      key={h.id}
                      className={`${wrapClass} ${stickyClass} px-3 py-2.5`}
                      style={{ minWidth: meta?.minWidth }}
                    >
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={() => h.column.toggleSorting()}
                          className="hover:underline text-left"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { sticky?: boolean; minWidth?: string; wrap?: boolean } | undefined
                  const stickyClass = meta?.sticky ? 'sticky left-0 z-10 bg-background shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''
                  const wrapClass = meta?.wrap ? 'whitespace-normal break-words align-top' : 'whitespace-nowrap'
                  const value = cell.getValue()
                  const titleAttr = meta?.wrap && typeof value === 'string' && value ? value : undefined
                  return (
                    <TableCell
                      key={cell.id}
                      className={`${wrapClass} ${stickyClass} px-3 py-2.5`}
                      style={{ minWidth: meta?.minWidth }}
                      title={titleAttr}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
