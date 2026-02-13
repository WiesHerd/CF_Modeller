import { Badge } from '@/components/ui/badge'
import { POLICY_CHIP } from '@/features/optimizer/components/optimizer-constants'
import type { PolicyCheckStatus } from '@/types/optimizer'

export function PolicyChip({ policy }: { policy: PolicyCheckStatus }) {
  const chip = POLICY_CHIP[policy]
  return <Badge variant={chip.variant}>{chip.label}</Badge>
}

export function FlagChip({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  )
}

export function ExclusionChip({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      {label}
    </Badge>
  )
}
