import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ScenarioResults } from '@/types/scenario'

interface GovernanceFlagsProps {
  results: ScenarioResults | null
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

  const flags: { icon: React.ReactNode; text: string; isWarning: boolean }[] = []

  if (governanceFlags.underpayRisk) {
    flags.push({
      icon: <AlertTriangle className="size-4 shrink-0" />,
      text: 'Underpay risk: Alignment gap < -15',
      isWarning: true,
    })
  }
  if (governanceFlags.cfBelow25) {
    flags.push({
      icon: <AlertTriangle className="size-4 shrink-0" />,
      text: 'CF below 25th percentile',
      isWarning: true,
    })
  }
  if (governanceFlags.modeledInPolicyBand) {
    flags.push({
      icon: <CheckCircle2 className="size-4 shrink-0" />,
      text: 'Modeled scenario within policy band (25th–75th)',
      isWarning: false,
    })
  }
  if (governanceFlags.fmvCheckSuggested) {
    flags.push({
      icon: <AlertTriangle className="size-4 shrink-0" />,
      text: 'FMV check if TCC > 75th or Gap > +15',
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
        <ul className="space-y-2">
          {flags.length === 0 ? (
            <li className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
              No governance flags for this scenario.
            </li>
          ) : (
            flags.map((flag, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 text-sm ${
                  flag.isWarning
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-green-700 dark:text-green-400'
                }`}
              >
                {flag.icon}
                <span>{flag.text}</span>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
