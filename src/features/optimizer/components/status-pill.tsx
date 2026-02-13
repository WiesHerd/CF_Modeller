import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { OptimizerStatus } from '@/types/optimizer'

const STATUS_STYLE: Record<OptimizerStatus, string> = {
  GREEN:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300',
  YELLOW:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300',
  RED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300',
}

export function StatusPill({
  status,
  className,
}: {
  status: OptimizerStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        STATUS_STYLE[status],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  )
}
