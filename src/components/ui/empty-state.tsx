import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  message: string
  description?: string
  action?: ReactNode
  className?: string
}

/**
 * Standardised empty-state display. Use inside <CardContent> or standalone.
 * Renders a centred message with muted text at a consistent py-8 vertical rhythm.
 */
export function EmptyState({ message, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-8 text-center', className)}>
      <p className="text-sm text-muted-foreground">{message}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
