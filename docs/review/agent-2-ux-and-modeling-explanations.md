# Agent 2: User Experience and Modeling Explanations — Deliverable

**Goal:** Best possible UX: answers user questions, easy navigation, and clear explanations of modeling so users trust and understand results.

---

## Task clarity

- **Screen purpose and “what to do next”:**
  - Upload: “Import data” section title; UploadAndMapping has clear upload + mapping + synonym flows. Good.
  - Data: DataTablesScreen has Provider/Market tabs; navigation to Upload is available. Good.
  - Single scenario: ModellerStepper shows Provider → Scenario → Market → Results. Section titles (“Single scenario,” “CURRENT vs MODELED”) are clear. Next/Back buttons guide flow.
  - Batch: BatchCardPicker presents four cards with labels and short descriptions. Each batch tool has a Back to picker.
  - Batch results: “Scenario results” header; Save/Load runs; Export CSV/XLSX. Clear.
  - Compare scenarios: “Compare two saved optimizer scenarios.” Clear.
  - Help: “How to use TCC Modeler” with sectioned content and “Go to” buttons. Clear.
- **Gap:** Empty states tell users what to do (e.g. “Upload provider and market files on the Upload screen first,” “Select a provider on the Provider step first”) but do not provide a direct link/button to that screen. Adding a “Go to Import data” or “Go to Provider step” button would make them actionable.
- **First-time flow:** Help screen offers “Take a quick tour” (HelpWizard) with “Try it” to jump to screens. The wizard is discoverable only from the Help screen. There is no automatic first-visit onboarding (e.g. “First time? Take a quick tour”). Recommendation: Optional — on first load (e.g. localStorage flag), show a small prompt or banner: “New to TCC Modeler? Open **How to use** in the sidebar for a quick tour.”

---

## Modeling explanations (user-facing)

### TCC (Total Cash Compensation)

- **Where:** `baseline-vs-modeled-section.tsx`
- **Present:** TCC breakdown dialog (“How TCC is calculated”) opened by clicking the TCC row; copy explains: “TCC = base salary (total) + incentive (wRVU) + quality payments (VBP) + quality payments (from file) + other incentives.” Row tooltip: “Click to see how TCC is calculated.”
- **Verdict:** Good. Formula and components are explained in-context.

### CF (Conversion factor)

- **Where:** Scenario section — “Conversion factor” subsection; Modeled CF slider and percentile; override option elsewhere (cfSource).
- **Present:** Slider for “Modeled CF”; row title “Calculated as Clinical Salary ÷ Modeled CF” (line 975). No single, prominent one-liner that “CF = $ per wRVU” or “market percentile = where you sit vs market.” Optimizer uses “target percentile” and “override” in configure stage with tooltips (OptimizerConfigureStage has SectionHeaderWithTooltip and objective/constraint tooltips).
- **Gap:** In the single-scenario Scenario step, a short line under “Conversion factor” (e.g. “Conversion factor is the $ per work RVU used to calculate incentive pay”) would help. Optional: tooltip on “Modeled CF” label explaining “Dollar amount per wRVU; can be set from market percentile or overridden.”

### wRVU / percentiles

- **Where:** Baseline vs modeled (Work wRVUs, Other wRVUs); Impact report and market position (TCC percentile, wRVU percentile).
- **Present:** Labels “Work wRVUs,” “Other wRVUs”; quality payments slider has aria-label describing “Value-based payment percentage… Quality payments $ = this % of base or total pay depending on scenario quality payments basis.” Percentile charts and tables show “TCC %ile,” “wRVU %ile” with axis labels.
- **Gap:** “wRVU target” (or “annual threshold”) and how it drives incentive are not explained in one sentence in the Scenario step. Governance and market position tables assume users know what “TCC percentile” and “wRVU percentile” mean. Recommendation: Add one sentence in Help (Single scenario section): “TCC percentile = where the provider’s total cash comp sits vs market; wRVU percentile = where their productivity sits. Alignment gap = TCC %ile − wRVU %ile.” Optionally repeat in a tooltip on the Market position table header.

### PSQ / value-based payment

- **Where:** `ScenarioInputs.psqPercent`, `psqBasis` (base_salary, total_guaranteed, total_pay); baseline-vs-modeled “Quality payments $ (VBP %)” row.
- **Present:** Slider label “Quality payments $ (VBP %)”; tooltip when quality from file: “Current value from provider file. Modeled value is from VBP % slider.” aria-label on slider: “Value-based payment percentage… Quality payments $ = this % of base or total pay depending on scenario quality payments basis.”
- **Gap:** The meaning of “basis” (base_salary vs total_guaranteed vs total_pay) is not explained in the single-scenario UI. Help does not explicitly say “PSQ basis: whether the % applies to base salary, total guaranteed, or total pay.” Recommendation: Add to Help (Single scenario or a “Terms” subsection): “Quality payments (VBP): A percentage of pay. Basis = what that % applies to: base salary, total guaranteed, or total pay.”

### Governance flags

- **Where:** `governance-flags.tsx`
- **Present:** Card title “Governance & flags”; subtitle “Policy band, underpay risk, and FMV guidance.” Each flag has short text: “Underpay risk: Alignment gap < -15,” “CF below 25th percentile,” “Modeled scenario within policy band (25th–75th),” “FMV check if TCC > 75th or Gap > +15.” Empty state: “No governance flags for this scenario.”
- **Gap:** “Why this matters” is implied (e.g. underpay risk = may need review) but not spelled out. Recommendation: Optional — add a “What are governance flags?” tooltip or Help sentence: “Flags highlight scenarios that may need policy or FMV review (e.g. underpay risk, CF below 25th, or TCC above 75th).”

---

## Batch-specific

### CF Optimizer

- **Where:** `optimizer-specialty-card.tsx`, `optimizer-detail-drawer.tsx`; `optimizer-engine.ts` `buildExplanation`.
- **Present:** Each specialty card shows `result.explanation.headline`; “Why” bullets (up to 3) and “What to do next” in card and detail drawer. Configure stage has SectionHeaderWithTooltip for Objective, Governance, TCC; error metric has getRecommendedErrorMetric with reason (MAE vs MSE).
- **Verdict:** Explanations are visible and understandable for users who read the cards/drawer. Optional: One-line reminder at top of Run stage: “The optimizer recommends a specialty-level CF to align pay and productivity; review the table and specialty cards below.”

### Row-level calculation (batch results)

- **Where:** `row-calculation-modal.tsx` (“How we calculated this row”).
- **Present:** Sheet with sections for Incentive, wRVU, TCC; formulas and values; scrollToSection when opening from a clicked column.
- **Verdict:** Sufficient for power users who want to audit a single row.

---

## Error and empty states

- **Upload:** “Upload provider and market files on the Upload screen first” (Modeller, new provider). No link.
- **Data:** Tables show data or empty grid; no global “no data” block in Data screen (data is from state).
- **Modeller:** “Select a provider on the Provider step first” (Scenario step); “Select a provider and specialty on the Provider step first” (Market step); “Select a provider and set scenario parameters in the previous steps to see results” (Results step). All informative but not actionable (no button).
- **Batch scenario step:** “Upload provider and market data first.” (batch-scenario-step.tsx). Error set in state; user sees message.
- **Imputed vs market:** WarningBanner “Upload provider and market data on the Upload screen first.”
- **Governance / market position:** “Select a provider and run a scenario to see governance flags.” / “Select a provider and market to see market position.”

**Recommendation:** Add a single primary action where it makes sense (e.g. “Go to Import data” or “Go to Provider step”) so empty states are actionable without relying on the sidebar.

---

## Help and discoverability

- **Help content:** Covers Overview, Import data, Data browser, Single scenario, Batch (four tools), Scenario results, Compare scenarios. Each section has What / When to use / bullets and a “Go to” button.
- **Gaps:** (1) Synonym mapping (when to use, how it affects batch) is mentioned in Import but could have one sentence in Batch. (2) Difference between “Create and Run Scenario” (bulk) and “Detailed scenarios” (overrides by specialty/provider) is in Help; in-app labels on BatchCardPicker are clear. (3) No glossary: TCC, wRVU, CF, PSQ, percentile, alignment gap could be in an Overview or “Terms” subsection.
- **In-context help:** Optimizer configure stage uses tooltips (SectionHeaderWithTooltip). Single-scenario Scenario step has row tooltips and TCC dialog but no “What’s this?” next to “Proposed CF percentile” or “PSQ basis.” Recommendation: Add tooltips or short helper text for “Proposed CF percentile” and “PSQ basis” in the Scenario step (or link to Help section).

---

## Prioritized recommendations

1. **High:** Make empty states actionable — add “Go to Import data” or “Go to Provider step” button where the message says to do that.
2. **High:** Add one sentence in Help (and optionally in UI) for “TCC percentile,” “wRVU percentile,” and “alignment gap” so new users can interpret market position and governance.
3. **Medium:** Add a single line under “Conversion factor” in the Scenario step: “CF = $ per work RVU for incentive pay.”
4. **Medium:** In Help, add a short “Quality payments (VBP) basis” and “PSQ basis” explanation (what base_salary / total_guaranteed / total_pay mean).
5. **Low:** Optional first-time prompt: “New? Open How to use for a quick tour.”
6. **Low:** Optional “What are governance flags?” tooltip or Help sentence.
7. **Low:** Optional tooltips on “Proposed CF percentile” and “PSQ basis” in the Scenario step.
