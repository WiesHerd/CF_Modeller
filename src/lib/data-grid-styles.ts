/**
 * Data grid table standard: shared class names for consistent tables across the app.
 * Use these when building or refactoring data tables so headers, padding, and wrappers match.
 *
 * Standard:
 * - Wrapper: rounded border, overflow-x-auto, optional max-height
 * - Header: sticky top, z-20, bg-muted, border-b
 * - Header/cell padding: px-3 py-2.5
 * - Striping: row index % 2 === 1 → bg-muted/30
 * - Frozen first column (optional): sticky left-0, z-10, bg + shadow
 */

export const DATA_GRID = {
  /** Table wrapper (scrollable container). Use with overflow-x-auto and optional max-h. */
  wrapper:
    'rounded-md border border-border overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',

  /** Sticky table header row. Use on TableHeader. */
  header:
    'sticky top-0 z-20 border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground [&_th]:font-medium',

  /** Header and body cell padding (use on TableHead and TableCell). */
  cellPadding: 'px-3 py-2.5',

  /** Sticky first column (header). Use on first TableHead when column is frozen. Higher z so it stays above body and scrolling content. */
  stickyColHeader:
    'sticky left-0 top-0 z-30 bg-muted shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]',

  /** Sticky first column (body cell). Use on first TableCell when column is frozen. z-20 so it paints above scrolling cells (no z-index). */
  stickyColCell: 'sticky left-0 z-20 bg-background',

  /** Striped row (alternate). Apply to TableRow when row.index % 2 === 1. */
  rowStriped: 'bg-muted/30',

  /** Table base (caption-bottom text-sm). Use on <table> or Table. */
  table: 'w-full caption-bottom text-sm',
} as const
