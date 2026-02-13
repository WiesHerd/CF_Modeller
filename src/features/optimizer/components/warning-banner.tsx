import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type BannerTone = 'warning' | 'error' | 'info'

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
  className,
}: {
  title?: string
  message: string
  tone?: BannerTone
  className?: string
}) {
  return (
    <Alert className={cn(TONE_STYLE[tone], className)}>
      <AlertCircle className="size-4" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
