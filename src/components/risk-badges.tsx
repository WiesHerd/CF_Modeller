import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RiskAssessment } from '@/types/scenario'

interface RiskBadgesProps {
  risk: RiskAssessment
}

export function RiskBadges({ risk }: RiskBadgesProps) {
  const { highRisk, warnings } = risk
  if (highRisk.length === 0 && warnings.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No risk flags for this scenario.</p>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <AlertTriangle className="size-4" />
        Risk assessment
      </h4>
      <div className="flex flex-wrap gap-2">
        {highRisk.map((msg) => (
          <Badge key={msg} variant="destructive">
            HIGH RISK: {msg}
          </Badge>
        ))}
        {warnings.map((msg) => (
          <Badge key={msg} variant="secondary">
            {msg}
          </Badge>
        ))}
      </div>
    </div>
  )
}
