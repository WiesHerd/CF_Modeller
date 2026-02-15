# Synthesis: Consolidated User-First Backlog

This document merges findings from all five review agents into a single prioritized backlog with the **user in mind**. Items are grouped by impact: (a) unblock/avoid confusion, (b) explanations and help, (c) reporting and report library, (d) code and UI polish.

---

## (a) Fixes that unblock or avoid confusion

| # | Item | Source | Action |
|---|------|--------|--------|
| 1 | Empty states are not actionable | Agent 2 | Add “Go to Import data” or “Go to Provider step” button where the message says to do that (Modeller empty states, batch “Upload provider and market data first,” etc.). |
| 2 | Batch run has no visible loading state | Agent 5, Agent 2 | Show “Running…” or disable “Run” and show a spinner/progress so users know the app is working. |
| 3 | Single-scenario Impact report cannot be printed or exported | Agent 3 | Add print-friendly CSS (`@media print` hide sidebar/nav) and a “Print report” button so users can share or attach the single-provider report. |
| 4 | Compare scenarios Back goes to Upload | Agent 1 | Optional: when opening Compare from CF Optimizer, Back could return to CF Optimizer for consistency. |

---

## (b) Explanations and help

| # | Item | Source | Action |
|---|------|--------|--------|
| 5 | TCC / wRVU percentile and alignment gap not defined for new users | Agent 2 | Add one sentence in Help (Single scenario or Overview): “TCC percentile = where the provider’s total cash comp sits vs market; wRVU percentile = where their productivity sits. Alignment gap = TCC %ile − wRVU %ile.” Optionally add tooltip on Market position table header. |
| 6 | CF (conversion factor) not explained in one line on Scenario step | Agent 2 | Add short line under “Conversion factor”: “Conversion factor is the $ per work RVU used to calculate incentive pay.” Optional: tooltip on “Modeled CF” label. |
| 7 | PSQ / VBP basis not explained | Agent 2 | In Help, add: “Quality payments (VBP): A percentage of pay. Basis = what that % applies to: base salary, total guaranteed, or total pay.” |
| 8 | Governance flags “why this matters” | Agent 2 | Optional: add “What are governance flags?” tooltip or one sentence in Help. |
| 9 | First-time discoverability of Help / Quick tour | Agent 2 | Optional: on first load (e.g. localStorage flag), show a small banner: “New to TCC Modeler? Open **How to use** in the sidebar for a quick tour.” |

---

## (c) Reporting and report library

| # | Item | Source | Action |
|---|------|--------|--------|
| 10 | Report library | Agent 3 | No new library for now. Add print-only (CSS + “Print report” button). Revisit PDF or report library only if product requires PDF or multi-page branded reports. |
| 11 | Formatting consistency in exports | Agent 3 | Import `formatCurrency` / `formatNumber` from `@/utils/format` in `compare-scenarios-export.ts` (and any other export modules) to avoid drift. |

---

## (d) Code and UI polish

| # | Item | Source | Action |
|---|------|--------|--------|
| 12 | Unused HomeScreen | Agent 1 | Remove `home-screen.tsx` or integrate as a real “home” step. Recommendation: remove to reduce dead code unless product wants a dedicated home. |
| 13 | App.tsx size | Agent 4 | Extract step content into feature components or a step router to improve readability and testability. |
| 14 | Lint: Math.random() in React key | Agent 4 | Replace with stable id in `division-table.tsx`, `existing-provider-and-market-card.tsx`, `percentile-modeler-header.tsx`, `provider-division-select.tsx`. |
| 15 | Lint: unused eslint-disable | Agent 4 | Remove or fix in `batch-results-dashboard.tsx`, `batch-scenario-step.tsx`. |
| 16 | Lint: react-refresh (mixed exports) | Agent 4 | Optional: move shared constants/helpers to separate files in `delta-indicator.tsx`, `modeling-impact-section.tsx`, `new-provider-form.tsx`. |
| 17 | Heading hierarchy (a11y) | Agent 5 | Ensure at least one `h1` per major step (e.g. “Import data,” “Single scenario”) for screen reader navigation. |
| 18 | aria-label on icon-only buttons | Agent 5 | Prefer `aria-label` over `title` only for icon-only buttons so screen readers announce them. |
| 19 | Optional: Skip to main content | Agent 5 | Add skip link at top of layout for keyboard users. |
| 20 | Optional: aria-live for batch completion | Agent 5 | Add `aria-live="polite"` for “Run complete” or error messages. |
| 21 | Unit tests | Agent 4 | Add tests for `compute.ts` and `interpolation.ts`; optionally for export modules. |
| 22 | Storage load errors | Agent 4 | Log (e.g. console.warn) when localStorage load fails so corrupt data can be diagnosed. |

---

## Priority summary

- **Do first (user-facing, low effort):** 1 (actionable empty states), 3 (print report + CSS), 5 (percentile/gap in Help), 6 (CF one-liner).
- **Next (explanations and clarity):** 2 (batch loading), 7 (PSQ basis in Help), 8–9 (governance, first-time tour).
- **Then (consistency and maintainability):** 10–11 (report library decision, format utils), 12 (HomeScreen), 13–16 (refactor App, lint fixes), 17–18 (a11y).
- **Backlog (optional):** 4 (Compare Back), 19–22 (skip link, aria-live, tests, storage logging).

All five agent deliverables are in `docs/review/`: `agent-1-screens-and-ia.md`, `agent-2-ux-and-modeling-explanations.md`, `agent-3-reporting-and-export.md`, `agent-4-code-quality.md`, `agent-5-ui-and-accessibility.md`.
