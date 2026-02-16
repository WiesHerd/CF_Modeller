# Data grid table standard

Shared conventions for data tables so they look and behave consistently across screens.

## Wrapper

- Use: `rounded-md border border-border overflow-x-auto` (see `DATA_GRID.wrapper` in `src/lib/data-grid-styles.ts`).
- Optional: `max-h-[…]` or `style={{ maxHeight }}` for vertical scroll.

## Header

- Sticky: `sticky top-0 z-20`.
- Background and border: `border-b border-border bg-muted [&_th]:bg-muted [&_th]:text-foreground [&_th]:font-medium`.
- Use the constant `DATA_GRID.header` so all tables share the same class set.

## Cell padding

- Header and body: `px-3 py-2.5` (`DATA_GRID.cellPadding`).

## Numeric columns

- Use `text-right tabular-nums` for numeric cells.

## Striping

- Optional: for data rows, apply `bg-muted/30` when `row.index % 2 === 1` (`DATA_GRID.rowStriped`).

## Frozen first column (optional)

- For grids where the first column (e.g. Name, Specialty) should stay visible when scrolling horizontally:
  - Header: `sticky left-0 top-0 z-[21] bg-muted` + shadow.
  - Body cell: `sticky left-0 z-10 bg-background` (and match striping/highlight background when needed).
- Use `DATA_GRID.stickyColHeader` and `DATA_GRID.stickyColCell`.

## Z-index

- Standard sticky header: `z-20`.
- Sticky first column header: `z-[21]` so it stays above the rest of the header.
- Sticky first column cell: `z-10`.

## Pagination / search / column visibility

- Data grids that support many rows should use the same pattern: "Rows" selector (25/50/100/200), "Previous" / "Next", "Page X of Y", and a "Search table…" input.
- Column visibility: same control (e.g. Columns icon + dropdown) where applicable.
