import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ScenarioInputs } from '@/types/scenario'

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

interface ModellerTopSectionProps {
  provider: ProviderRow | null
  marketRow: MarketRow | null
  scenarioInputs: ScenarioInputs
  specialtyLabel?: string
}

export function ModellerTopSection({
  provider,
  marketRow,
  scenarioInputs,
  specialtyLabel,
}: ModellerTopSectionProps) {
  const totalFTE = provider?.totalFTE ?? 0
  const clinicalFTE = provider?.clinicalFTE ?? 0
  const adminFTE = provider?.adminFTE ?? 0
  const baseSalary = provider?.baseSalary ?? 0
  const cFTESalary =
    totalFTE > 0 ? (baseSalary * (clinicalFTE / totalFTE)) : 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Provider Input — Excel-style */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="border-b border-red-600 bg-red-600 px-3 py-2 text-sm font-semibold text-white">
          Provider Input
        </div>
        <div className="p-0">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground w-[55%]">
                  PSQ
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null
                    ? `${scenarioInputs.psqPercent}%`
                    : '—'}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  Proposed CF %tile
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null
                    ? fmtNum(scenarioInputs.proposedCFPercentile, 2)
                    : '—'}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  CF Adjustment Factor
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null
                    ? scenarioInputs.cfAdjustmentFactor
                    : '—'}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  Base Salary
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null && baseSalary != null
                    ? fmtMoney(baseSalary)
                    : '—'}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  Total FTE
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null && totalFTE != null
                    ? fmtNum(totalFTE, 2)
                    : '—'}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  Admin FTE
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null && adminFTE != null && adminFTE > 0
                    ? fmtNum(adminFTE, 2)
                    : '—'}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  cFTE
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null && clinicalFTE != null
                    ? fmtNum(clinicalFTE, 2)
                    : '—'}
                </td>
              </tr>
              <tr>
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  cFTE Salary
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {provider != null && cFTESalary > 0
                    ? fmtMoney(cFTESalary)
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Market Data - Weighted Average — Excel-style */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="border-b border-red-600 bg-red-600 px-3 py-2 text-sm font-semibold text-white">
          Market Data – Weighted Average
          {specialtyLabel && (
            <span className="ml-2 font-normal opacity-90">
              ({specialtyLabel})
            </span>
          )}
        </div>
        <div className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/80">
                <th className="border-r border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Ranges
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  25th
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  50th
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  75th
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  90th
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  TCC (Total Compensation Cost)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.TCC_25) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.TCC_50) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.TCC_75) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.TCC_90) : '—'}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  wRVUs (Work Relative Value Units)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtNum(marketRow.WRVU_25, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtNum(marketRow.WRVU_50, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtNum(marketRow.WRVU_75, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtNum(marketRow.WRVU_90, 2) : '—'}
                </td>
              </tr>
              <tr>
                <td className="border-r border-border bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  CFs (Conversion Factors)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.CF_25) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.CF_50) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.CF_75) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {marketRow ? fmtMoney(marketRow.CF_90) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
