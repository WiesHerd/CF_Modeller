import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/utils/format'
import {
  getGapInterpretation,
  GAP_INTERPRETATION_LABEL,
  formatPercentile,
  getFmvRiskLevel,
  FMV_RISK_LABEL,
  type FmvRiskLevel,
} from '@/features/optimizer/components/optimizer-constants'
import type { BatchRowResult } from '@/types/batch'

export interface TccWrvuSummaryTableProps {
  rows: BatchRowResult[]
  /** Optional title shown above the table (e.g. in a Card header). */
  title?: string
  /** Optional subtitle/description. */
  subtitle?: string
  /** When true, include "Model name" column (scenario name). Default true. */
  showScenarioName?: boolean
  /** Optional class for the wrapper. */
  className?: string
  /** When set, each row is clickable and opens a detail drawer. */
  onProviderClick?: (row: BatchRowResult) => void
}

export function TccWrvuSummaryTable({
  rows,
  title,
  subtitle,
  showScenarioName = true,
  className,
  onProviderClick,
}: TccWrvuSummaryTableProps) {
  return (
    <div className={className}>
      {(title != null || subtitle != null) && (
        <div className="mb-2">
          {title != null && <p className="font-medium text-foreground">{title}</p>}
          {subtitle != null && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}
      <div className="w-full overflow-auto rounded-md border border-border">
        <Table className="w-full caption-bottom text-sm border-collapse">
          <TableHeader className="sticky top-0 z-10 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground [&_th]:font-medium">
            <TableRow className="border-b border-border bg-muted">
              <TableHead className="min-w-[120px] px-3 py-2.5">Provider</TableHead>
              <TableHead className="min-w-[100px] px-3 py-2.5">Specialty</TableHead>
              {showScenarioName && (
                <TableHead className="min-w-[90px] px-3 py-2.5">Model name</TableHead>
              )}
              <TableHead className="text-right min-w-[80px] px-3 py-2.5">Current TCC</TableHead>
              <TableHead className="text-right min-w-[80px] px-3 py-2.5">Modeled TCC</TableHead>
              <TableHead className="text-right min-w-[70px] px-3 py-2.5" title="Current TCC vs market">
                Current TCC %ile
              </TableHead>
              <TableHead className="text-right min-w-[70px] px-3 py-2.5" title="Modeled TCC vs market">
                Modeled TCC %ile
              </TableHead>
              <TableHead className="text-right min-w-[70px] px-3 py-2.5">wRVU %ile</TableHead>
              <TableHead className="min-w-[120px] px-3 py-2.5">Pay vs productivity</TableHead>
              <TableHead className="min-w-[88px] px-3 py-2.5" title="Fair Market Value review risk when TCC is at or above 75th percentile">
                FMV risk
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const res = row.results
              const gap = res?.alignmentGapModeled
              const gapInterpretation =
                gap != null && Number.isFinite(gap) ? getGapInterpretation(gap) : null
              const gapColor =
                gapInterpretation === 'overpaid'
                  ? 'text-red-600 dark:text-red-400'
                  : gapInterpretation === 'underpaid'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
              return (
                <TableRow
                  key={`${row.providerId}-${row.scenarioId}-${index}`}
                  className={cn(
                    index % 2 === 1 ? 'bg-muted/30' : undefined,
                    onProviderClick &&
                      'cursor-pointer hover:bg-muted/60 focus-within:bg-muted/60 transition-colors [&:focus-within]:outline [&:focus-within]:outline-2 [&:focus-within]:outline-offset-[-2px] [&:focus-within]:outline-ring'
                  )}
                  role={onProviderClick ? 'button' : undefined}
                  tabIndex={onProviderClick ? 0 : undefined}
                  onClick={onProviderClick ? () => onProviderClick(row) : undefined}
                  onKeyDown={
                    onProviderClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onProviderClick(row)
                          }
                        }
                      : undefined
                  }
                  aria-label={onProviderClick ? `View details for ${row.providerName || row.providerId || 'provider'}` : undefined}
                >
                  <TableCell className="px-3 py-2.5 font-medium">
                    {onProviderClick ? (
                      <span className="text-primary">
                        {row.providerName || row.providerId || '—'}
                      </span>
                    ) : (
                      row.providerName || row.providerId || '—'
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground">
                    {row.specialty || '—'}
                  </TableCell>
                  {showScenarioName && (
                    <TableCell className="px-3 py-2.5">{row.scenarioName || '—'}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums px-3 py-2.5">
                    {res?.currentTCC != null && Number.isFinite(res.currentTCC)
                      ? formatCurrency(res.currentTCC, { decimals: 0 })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">
                    {res?.modeledTCC != null && Number.isFinite(res.modeledTCC)
                      ? formatCurrency(res.modeledTCC, { decimals: 0 })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">
                    {res?.tccPercentile != null && Number.isFinite(res.tccPercentile)
                      ? formatPercentile(res.tccPercentile)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">
                    {res?.modeledTCCPercentile != null && Number.isFinite(res.modeledTCCPercentile)
                      ? formatPercentile(res.modeledTCCPercentile)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums px-3 py-2.5">
                    {res?.wrvuPercentile != null && Number.isFinite(res.wrvuPercentile)
                      ? formatPercentile(res.wrvuPercentile)
                      : '—'}
                  </TableCell>
                  <TableCell className={`px-3 py-2.5 ${gapColor}`}>
                    {gapInterpretation != null
                      ? GAP_INTERPRETATION_LABEL[gapInterpretation]
                      : '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {(() => {
                      const fmvRisk: FmvRiskLevel = getFmvRiskLevel(res?.tccPercentile, res?.modeledTCCPercentile)
                      const riskColor =
                        fmvRisk === 'high'
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : fmvRisk === 'elevated'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                      return (
                        <span className={riskColor} title={fmvRisk !== 'low' ? 'TCC at or above 75th percentile may warrant FMV review.' : undefined}>
                          {FMV_RISK_LABEL[fmvRisk]}
                        </span>
                      )
                    })()}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
