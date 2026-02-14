import { cn } from '@/lib/utils'

interface SectionTitleWithIconProps {
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Rounded-square (squircle) icon container — use for section/page icons. */
const iconBoxClass =
  'flex shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400'

/** Page/section title with icon that matches the sidebar nav for this screen. */
export function SectionTitleWithIcon({ icon, children, className }: SectionTitleWithIconProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(iconBoxClass, 'size-10 [&_svg]:size-5')}>
        {icon}
      </div>
      <h2 className="section-title mb-0">{children}</h2>
    </div>
  )
}

export { iconBoxClass }
