import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ScenarioResults } from '@/types/scenario'

interface GovernanceFlagsProps {
  results: ScenarioResults | null
}

function formatPct(value: number): string {
  return `${Math.round(value)}th`
}

export function GovernanceFlags({ results }: GovernanceFlagsProps) {
  if (!results) {
    return (
      <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-1 pb-2 pt-6">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Governance & flags
          </CardTitle>
          <p className="text-muted-foreground text-xs font-normal">
            Policy band, underpay risk, and FMV guidance
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4 text-center text-sm">
            Select a provider and run a scenario to see governance flags.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { governanceFlags } = results
  const {
    alignmentGapBaseline,
    alignmentGapModeled,
    cfPercentileCurrent,
    cfPercentileModeled,
    tccPercentile,
    modeledTCCPercentile,
  } = results

  const flags: {
    icon: React.ReactNode
    title: string
    description: string
    isWarning: boolean
  }[] = []

  if (governanceFlags.underpayRisk) {
    const gap = alignmentGapModeled < -15 ? alignmentGapModeled : alignmentGapBaseline
    flags.push({
      icon: <AlertTriangle className="size-4 shrink-0" />,
      title: 'Underpay risk',
      description: `Alignment gap (TCC percentile minus wRVU percentile) is ${gap.toFixed(0)}. A gap below -15 means pay ranks lower than productivity vs market — the provider may be underpaid relative to peers. Consider reviewing compensation.`,
      isWarning: true,
    })
  }
  if (governanceFlags.cfBelow25) {
    flags.push({
      icon: <AlertTriangle className="size-4 shrink-0" />,
      title: 'CF below 25th percentile',
      description: `The current conversion factor is at the ${formatPct(cfPercentileCurrent)} percentile vs market. Below the 25th may indicate below-market $/wRVU and can warrant review for competitiveness or retention.${cfPercentileModeled >= 25 ? ` The modeled scenario moves CF to the ${formatPct(cfPercentileModeled)} percentile.` : ''}`,
      isWarning: true,
    })
  }
  if (governanceFlags.modeledInPolicyBand) {
    flags.push({
      icon: <CheckCircle2 className="size-4 shrink-0" />,
      title: 'Modeled scenario within policy band',
      description: `Modeled total cash compensation is at the ${formatPct(modeledTCCPercentile)} percentile and modeled CF is within the 25th–75th range vs market. This scenario falls within the typical policy band (25th–75th), so pay and productivity positioning are in line with common governance guidelines.`,
      isWarning: false,
    })
  }
  if (governanceFlags.fmvCheckSuggested) {
    const reason =
      modeledTCCPercentile > 75 && alignmentGapModeled > 15
        ? `Modeled TCC is at the ${formatPct(modeledTCCPercentile)} percentile and the alignment gap is +${alignmentGapModeled.toFixed(0)}.`
        : modeledTCCPercentile > 75
          ? `Modeled total cash compensation is at the ${formatPct(modeledTCCPercentile)} percentile vs market (above 75th).`
          : `The alignment gap (TCC percentile minus wRVU percentile) is +${alignmentGapModeled.toFixed(0)} (above +15).`
    flags.push({
      icon: <AlertTriangle className="size-4 shrink-0" />,
      title: 'FMV check suggested',
      description: `${reason} Compensation above the 75th percentile or a large positive gap may require fair market value (FMV) documentation for compliance and audit.`,
      isWarning: true,
    })
  }

  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
      <CardHeader className="space-y-1 pb-2 pt-6">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">
          Governance & flags
        </CardTitle>
        <p className="text-muted-foreground text-xs font-normal">
          Policy band, underpay risk, and FMV guidance
        </p>
      </CardHeader>
      <CardContent className="pb-6 pt-2">
        <ul className="space-y-4">
          {flags.length === 0 ? (
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-green-700 dark:text-green-400" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-green-700 dark:text-green-400">No governance flags for this scenario.</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Modeled pay and conversion factor fall within typical policy ranges (e.g. 25th–75th) and alignment gap is between -15 and +15.
                </p>
              </div>
            </li>
          ) : (
            flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={
                    flag.isWarning
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-green-700 dark:text-green-400'
                  }
                >
                  {flag.icon}
                </span>
                <div className="min-w-0 space-y-1">
                  <p
                    className={`font-medium ${
                      flag.isWarning
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-green-700 dark:text-green-400'
                    }`}
                  >
                    {flag.title}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {flag.description}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
