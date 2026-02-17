import type { Column } from '@tanstack/react-table'

/**
 * Data grid table standard: shared class names for consistent tables across the app.
 * Use these when building or refactoring data tables so headers, padding, and wrappers match.
 *
 * Standard:
 * - Wrapper: rounded border, overflow-x-auto, optional max-height
 * - Header: sticky top, z-20, bg-muted, border-b
 * - Header/cell padding: px-3 py-2.5
 * - Striping: row index % 2 === 1 → bg-muted/30
 * - Pinned columns: use getPinnedCellStyles() for native TanStack column pinning
 */

export const DATA_GRID = {
  /** Table wrapper (scrollable container). Use with overflow-x-auto and optional max-h. */
  wrapper:
    'rounded-md border border-border overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',

  /** Sticky table header row. Use on TableHeader. Keep above sticky body cells. */
  header:
    'sticky top-0 z-40 border-b border-border bg-background [&_tr]:bg-background [&_th]:bg-background [&_th]:text-foreground [&_th]:font-medium',

  /** Header and body cell padding (use on TableHead and TableCell). */
  cellPadding: 'px-3 py-2.5',

  /** Striped row (alternate). Apply to TableRow when row.index % 2 === 1. */
  rowStriped: 'bg-muted/30',

  /** Table base (caption-bottom text-sm). Use on <table> or Table. */
  table: 'w-full caption-bottom text-sm',
} as const

/* ------------------------------------------------------------------ */
/*  Native TanStack Table column-pinning helpers                      */
/* ------------------------------------------------------------------ */

/** CSS class string for a pinned header cell. */
export const PINNED_HEADER_CLASS =
  'isolate bg-background [background-color:var(--background)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'

/** CSS class string for a pinned body cell. */
export const PINNED_CELL_CLASS =
  'isolate bg-background [background-color:var(--background)]'

/** CSS class for pinned body cell on a striped (odd) row. Opaque blend so it matches row stripe (bg-muted/30) and no bleed-through. */
export const PINNED_CELL_STRIPED_CLASS =
  'isolate [background-color:color-mix(in_srgb,var(--muted)_30%,var(--background))]'

/**
 * Return inline styles for a column that participates in TanStack column pinning.
 * Works for both header and body cells.
 *
 * @param column – the TanStack Column instance
 * @param isHeader – true when styling a <th>; bumps z-index above body pins
 */
export function getPinnedCellStyles<T>(
  column: Column<T, unknown>,
  isHeader = false,
): React.CSSProperties {
  const isPinned = column.getIsPinned()
  if (!isPinned) return {}
  return {
    position: 'sticky',
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    zIndex: isHeader ? 50 : 10,
  }
}
