import { cn } from '@/lib/utils'

interface SectionTitleWithIconProps {
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Rounded icon container — clean, minimal (Google/Silicon Valley style) */
const iconBoxClass =
  'flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'

/** Capitalize first letter of each word; leave rest of word unchanged (e.g. "CF" stays "CF", "specialty" → "Specialty"). */
function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (word.length === 0 ? '' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

/** Page/section title with icon that matches the sidebar nav for this screen. */
export function SectionTitleWithIcon({ icon, children, className }: SectionTitleWithIconProps) {
  const titleContent =
    typeof children === 'string' ? toTitleCase(children) : children
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(iconBoxClass, 'size-10 [&_svg]:size-5')}>
        {icon}
      </div>
      <h2 className="section-title mb-0">{titleContent}</h2>
    </div>
  )
}

export { iconBoxClass }
