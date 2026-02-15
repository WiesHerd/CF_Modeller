# Agent 3: Reporting and Export (and Report Library) — Deliverable

**Goal:** Good reporting for decision-making and audit; decide if a report library is needed.

---

## Current reporting

### Single scenario (Impact report)

- **Where:** `src/components/impact-report-page.tsx`
- **Content:** Compensation impact report header (provider label), KPI cards (Current TCC, Modeled TCC, Δ TCC, TCC %ile, % change), impact headline, benchmark comparison table, optional takeaway (opportunity/risk/neutral), percentile charts, TCC waterfall, CF comparison, governance flags.
- **Export/print:** None. The report is view-only in the app. There is no “Print” or “Export to PDF” button.
- **Assessment:** For “share with CFO” or “attach to contract,” users cannot export the single-provider impact report. Browser Print (Ctrl/Cmd+P) will work but may include sidebar and navigation; print-specific CSS is not present (no `@media print` or `.impact-report` print rules). **Gap:** No first-class print or PDF export for single scenario.

### Batch results

- **Where:** `src/components/batch/batch-results-dashboard.tsx`; export via `src/lib/batch-export.ts`
- **Content:** Dashboard (summary, filters, risk/match breakdown), table of rows (provider, specialty, scenario, TCC, CF, percentiles, governance flags, etc.), row-level calculation modal (“How we calculated this row”).
- **Export:** CSV and XLSX buttons; `downloadBatchResultsCSV` and `exportBatchResultsXLSX` produce a wide table (one row per provider per scenario) with all key metrics and governance Y/N columns. Filename: `batch-results-YYYY-MM-DD.csv` / `.xlsx`.
- **Assessment:** Meets “audit-ready” and “share data” for batch. Columns and formatting are consistent with in-app table. **Good.**

### Compare scenarios

- **Where:** `src/features/optimizer/compare-scenarios-screen.tsx`; export via `src/lib/compare-scenarios-export.ts`
- **Content:** Report-style Excel: title “Scenario Comparison Report,” generated date, scenario names, narrative summary, roll-up metrics (spend impact, incentive, mean percentiles, counts), assumptions table, by-specialty comparison. Single sheet with column widths set.
- **Assessment:** Meets “compare before/after” and “share comparison.” **Good.**

---

## Report library

- **Need:** Do stakeholders need (1) PDF export for single or batch reports, (2) print-friendly layouts, (3) branded/multi-page reports, or (4) scheduled/email reports?
  - **Single-provider PDF:** Likely yes for “attach to contract” or “send to physician/HR.” Today they can only screenshot or browser print.
  - **Batch PDF:** Less critical if Excel/CSV is the primary audit artifact; optional.
  - **Print-friendly:** Low effort: add `@media print` to hide sidebar/nav and optionally expand `.impact-report` for single scenario. No library needed.
  - **Branded/multi-page / scheduled:** Would require a server and possibly a report library (e.g. React-PDF, Puppeteer). Out of scope for current client-side app.
- **Recommendation:**
  - **Short term:** No new report library. Add **print-friendly CSS** for the single-scenario Impact report (and optionally batch results) so “Print” (browser) produces a clean, single-document report. Optionally add a visible “Print report” button that triggers `window.print()` and/or focuses the report region.
  - **If PDF is required for single scenario:** Add a lightweight client-side PDF option (e.g. jsPDF + html2canvas, or a simple React-PDF layout that mirrors the impact report). This avoids a server. If high-fidelity or multi-page branded reports are required later, consider a dedicated report library or server-side generation (Puppeteer, etc.).
- **Verdict:** **Print-only** for now (CSS + optional “Print report” button). **Add report library** only if product requires PDF or multi-page branded reports.

---

## Consistency

- **Terminology:** TCC, wRVU, CF, percentile, PSQ, alignment gap, governance flags are used consistently in Impact report, batch export columns, and compare-scenarios export. Column names in batch export match in-app concepts (e.g. `modeledTCCPercentile`, `wrvuPercentile`, `fmvCheckSuggested`).
- **Number/currency formatting:** App uses `src/utils/format.ts` (`formatCurrency`, `formatNumber`, `formatOrdinal`, `formatCurrencyCompact`). Compare-scenarios-export defines its own `formatCurrency` and `formatPercentile` locally; behavior is aligned (USD, no decimals for currency; percentile with “Below 25th” etc.). Batch export uses raw numbers or EMPTY string; Excel will display numbers with default formatting. **Minor:** Unify on shared formatters in export libs (import from `@/utils/format`) to avoid drift.

---

## User needs

| Need | Single scenario | Batch | Compare |
|------|-----------------|--------|---------|
| View in app | Yes (Impact report) | Yes (dashboard + table) | Yes |
| Export data (Excel/CSV) | No | Yes (CSV, XLSX) | Yes (Excel) |
| Print report | Browser only; no print CSS | Browser only | Browser only |
| PDF for sharing | No | No | No |
| Audit trail | N/A (single run) | Yes (export + row drill-down) | Yes (export) |

**Summary:** “Share with CFO” / “attach to contract” for a **single** provider is not fully met (no export/print optimization). Batch and compare are in good shape for data sharing and audit.

---

## Recommendations (concise)

1. **Add print-friendly CSS** for the Impact report (and optionally batch results): hide sidebar/nav in `@media print`, ensure report content is the focus.
2. **Add “Print report” button** on the single-scenario Results step that calls `window.print()` (and optionally scrolls to/focuses the report).
3. **Report library:** Not required for current scope. Revisit if PDF export or multi-page branded reports become a requirement.
4. **Unify formatting:** Import `formatCurrency` / `formatNumber` from `@/utils/format` in `compare-scenarios-export.ts` (and any other export modules) to keep formatting consistent.
