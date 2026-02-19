import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  className?: string
}

/**
 * Standardised loading indicator for async operations.
 * Use for any short-lived async wait (data fetching, file parsing, etc.).
 * For long-running batch/optimizer runs, keep the dedicated <Progress> bar.
 */
export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-8 text-center',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
