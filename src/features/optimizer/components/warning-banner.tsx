import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BannerTone = 'warning' | 'error' | 'info'

const TONE_STYLE: Record<BannerTone, string> = {
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-border bg-muted/20 text-foreground',
}

export function WarningBanner({
  title,
  message,
  tone = 'warning',
  onDismiss,
  className,
}: {
  title?: string
  message: string
  tone?: BannerTone
  onDismiss?: () => void
  className?: string
}) {
  return (
    <Alert className={cn(TONE_STYLE[tone], onDismiss ? 'flex items-start justify-between gap-2' : '', className)}>
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <AlertCircle className="size-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          {title ? <AlertTitle>{title}</AlertTitle> : null}
          <AlertDescription>{message}</AlertDescription>
        </div>
      </div>
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 opacity-70 hover:opacity-100"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </Alert>
  )
}
