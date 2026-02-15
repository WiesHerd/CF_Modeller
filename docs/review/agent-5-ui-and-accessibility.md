# Agent 5: UI and Accessibility — Deliverable

**Goal:** Polished, consistent UI and an inclusive experience for all users.

---

## Visual design

- **Consistency:** Section titles use `SectionTitleWithIcon`; cards, buttons, inputs come from shared UI (Card, Button, Input, Select, Slider, Tabs). Spacing and typography (text-sm, text-muted-foreground, font-semibold) are applied consistently across Upload, Data, Modeller, Batch, Results, Compare, and Help.
- **Charts:** `src/components/charts/` (TCC waterfall, percentile-comparison, percentile-position, CF comparison) use Recharts with `ResponsiveContainer`, axis labels, and CSS variables (e.g. `var(--chart-1)`, `var(--destructive)`). Labels and legends are present. Contrast depends on theme (light/dark); no inline hard-coded colors that would break in dark mode.
- **Empty and loading states:** Empty states show a Card with centered message (e.g. “Upload provider and market files on the Upload screen first,” “Select a provider on the Provider step first”). No skeleton loaders for initial data load; batch run shows progress/state in the batch scenario step. **Suggestion:** Add a simple skeleton or “Loading…” for batch run while results are computing so the UI doesn’t look frozen.

---

## Responsiveness

- **Layout:** `app-layout.tsx` — desktop: fixed sidebar (68px collapsed, 260px expanded) with `md:pl-[68px]` / `md:pl-[260px]` on content; mobile: sheet menu, no persistent sidebar. Main content has `max-w-[1200px] px-4` and `overflow-auto` on main. Good.
- **Tables:** Data tables use `role="grid"`, horizontal scroll, and column visibility; batch results table has scroll and filters. Tables are usable on small screens with horizontal scroll.
- **Charts:** Recharts `ResponsiveContainer` adapts width; charts may become dense on very small viewports. Acceptable for a desktop-first tool.

---

## Accessibility

### Semantic HTML and landmarks

- **Layout:** `<aside>` for sidebar, `<main>` for content, `<footer>` with `<nav aria-label="Footer links">`. Good.
- **Headings:** Section titles use `h2`/`h3` (e.g. in Help, Modeller, batch steps). Some screens use `section-title` class without a semantic heading; recommend ensuring at least one `h1` per step (e.g. “Import data,” “Single scenario”) for screen reader navigation.
- **Lists:** Governance flags use `<ul>`/`<li>`; batch steps use `<nav aria-label="Batch steps">`. Good.

### Focus and keyboard

- **Focus visibility:** Buttons and interactive cards use `focus-visible:ring-2 focus-visible:ring-ring` (or `focus-visible:ring-primary`) and `focus-visible:ring-offset-2` (e.g. home-screen cards, batch-card-picker, batch-results filter buttons, optimizer tooltip triggers). Good.
- **Keyboard navigation:** Sidebar nav buttons are focusable; sheet/dialogs use Radix which typically traps focus. Data tables are grid-like with keyboard navigation (grid role). **Suggestion:** Verify focus trap in Sheet/Dialog (e.g. Save scenario, Row calculation modal) and that focus returns to trigger on close.
- **Skip link:** No “Skip to main content” link. Optional improvement for keyboard users when sidebar is expanded.

### ARIA

- **Sidebar:** Icon-only buttons have `aria-label` (e.g. “Import data,” “Expand sidebar”); active nav has `aria-current="page"`; sidebar container has `aria-expanded={!sidebarCollapsed}`. Good.
- **Forms and buttons:** Key actions have `aria-label` (e.g. “Save scenario,” “Saved runs,” “Edit provider,” “Column visibility”). Some icon-only buttons use only `title`; prefer `aria-label` for screen readers (title is often not announced).
- **Row calculation modal:** `SheetContent` has `aria-describedby="row-calculation-desc"`; `SheetDescription` provides id. Good.
- **Live regions:** No `aria-live` for dynamic updates (e.g. batch run progress). Optional: add `aria-live="polite"` for “Run complete” or error messages.

### Tooltips

- **TooltipProvider:** Used with `delayDuration={300}`. Tooltips are triggered on hover/focus. Critical information (e.g. TCC formula) is also in the TCC breakdown dialog, not only in tooltips. Good.
- **Keyboard:** Radix Tooltip typically shows on focus; ensure tooltip trigger buttons are focusable (they are). No change needed.

### Color and status

- **Governance flags:** Status is conveyed by icon (AlertTriangle, CheckCircle2) plus text (“Underpay risk: Alignment gap < -15,” “Modeled scenario within policy band”). Not color-only. Good.
- **Risk levels (batch):** Filter buttons use `aria-pressed` and text (High, Medium, Low); icons (AlertTriangle, AlertCircle) have `aria-hidden`. Good.
- **Charts:** Positive/negative deltas use green/red (chart-1, destructive). Ensure sufficient contrast in both themes; consider adding pattern or label for “increase”/“decrease” for color-blind users. Optional: add a short “Summary” line above charts (e.g. “Net change: +$X”) so meaning is clear without color.

---

## Interaction

- **Buttons and links:** Primary actions use Button; links (Privacy, Terms, “Go to” in Help) use `<a href>`. Destructive actions (Reset data, Delete scenario, Delete run) use `window.confirm` or explicit delete button with confirmation. Good.
- **Loading and errors:** Batch run triggers state updates; no global spinner for batch. Error messages (e.g. “Upload provider and market data first”) are visible in batch scenario step. **Suggestion:** Show a brief “Running…” or disabled “Run” state during batch execution so users know the app is working.

---

## Suggested fixes (prioritized)

1. **High:** Ensure at least one `h1` per major step for screen reader heading hierarchy (e.g. “Import data,” “Single scenario,” “Batch results”).
2. **Medium:** Replace any icon-only buttons that rely only on `title` with `aria-label` (e.g. sidebar and table toolbar buttons that already have title; double-check both are set or prefer aria-label).
3. **Medium:** Add a loading state or “Running scenario…” during batch run so the UI doesn’t appear unresponsive.
4. **Low:** Add optional “Skip to main content” link at top of layout for keyboard users.
5. **Low:** Consider `aria-live="polite"` for batch completion or error messages.
6. **Low:** Charts: ensure legend/labels are sufficient for users who cannot distinguish green/red (e.g. “Increase”/“Decrease” in text).

---

## Summary

- **Consistency:** Good; shared components and spacing.
- **Responsiveness:** Good; sidebar and tables adapt; charts are responsive.
- **Accessibility:** Solid base (landmarks, aria-current, aria-label on nav, focus-visible, governance/risk not color-only). Improvements: heading hierarchy (h1 per step), aria-label on all icon buttons, optional skip link and live region.
- **Interaction:** Clear affordances and confirmations; add explicit loading state for batch run.
