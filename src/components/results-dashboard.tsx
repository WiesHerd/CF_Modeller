import {
  BarChart3,
  DollarSign,
  Target,
  TrendingUp,
  Activity,
  Percent,
  Gift,
  BadgeDollarSign,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RiskBadges } from '@/components/risk-badges'
import { PercentileComparisonChart } from '@/components/charts/percentile-comparison-chart'
import { CFComparisonTable } from '@/components/cf-comparison-table'
import { formatCurrency } from '@/utils/format'
import type { ScenarioResults } from '@/types/scenario'

interface ResultsDashboardProps {
  results: ScenarioResults
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}
function fmtMoney(n: number): string {
  return formatCurrency(n, { decimals: 0 })
}

export function ResultsDashboard({ results }: ResultsDashboardProps) {
  const {
    totalWRVUs,
    annualThreshold,
    wRVUsAboveThreshold,
    currentCF,
    modeledCF,
    annualIncentive,
    psqDollars,
    currentTCC,
    modeledTCC,
    changeInTCC,
    wrvuPercentile,
    tccPercentile,
    modeledTCCPercentile,
    cfPercentileCurrent,
    cfPercentileModeled,
    risk,
  } = results

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-left">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
              <BarChart3 className="size-5" />
            </span>
            <span>Current vs modeled</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RiskBadges risk={risk} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <Activity className="size-4" />
              </span>
              Total wRVUs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtNum(totalWRVUs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <Target className="size-4" />
              </span>
              Annual threshold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtNum(annualThreshold)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <TrendingUp className="size-4" />
              </span>
              wRVUs above threshold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtNum(wRVUsAboveThreshold)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <DollarSign className="size-4" />
              </span>
              Current TCC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtMoney(currentTCC)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <DollarSign className="size-4" />
              </span>
              Modeled TCC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtMoney(modeledTCC)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <TrendingUp className="size-4" />
              </span>
              Change in TCC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold ${
                changeInTCC >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {changeInTCC >= 0 ? '+' : ''}{fmtMoney(changeInTCC)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <Percent className="size-4" />
              </span>
              CF (current / modeled)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatCurrency(currentCF)} / {formatCurrency(modeledCF)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <Gift className="size-4" />
              </span>
              Annual incentive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtMoney(annualIncentive)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
                <BadgeDollarSign className="size-4" />
              </span>
              PSQ dollars
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtMoney(psqDollars)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
              <BarChart3 className="size-4" />
            </span>
            Percentile comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PercentileComparisonChart
            wrvuCurrent={wrvuPercentile}
            wrvuModeled={wrvuPercentile}
            tccCurrent={tccPercentile}
            tccModeled={modeledTCCPercentile}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-accent-icon">
              <Percent className="size-4" />
            </span>
            CF comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CFComparisonTable
            cfPercentileCurrent={cfPercentileCurrent}
            cfPercentileModeled={cfPercentileModeled}
            currentCF={currentCF}
            modeledCF={modeledCF}
          />
        </CardContent>
      </Card>
    </div>
  )
}
