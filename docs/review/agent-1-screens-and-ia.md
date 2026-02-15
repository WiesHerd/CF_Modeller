# Agent 1: Screens and Information Architecture — Deliverable

**Goal:** Ensure the app has the right screens, clear flow, and easy navigation for every user task.

---

## Screens checklist

| Screen | Status | Notes |
|--------|--------|--------|
| Import data (upload + mapping + synonyms) | Present | `step === 'upload'`, UploadAndMapping, Save scenario, Saved scenarios dropdown, Reset |
| Data browser (providers + market tabs) | Present | `step === 'data'`, DataTablesScreen with dataTab |
| Single scenario: Provider → Scenario → Market → Results | Present | `step === 'modeller'` with ModellerStepper; four sub-steps |
| Batch: CF Optimizer | Present | `batch-scenario` + `batchCard === 'cf-optimizer'` |
| Batch: Market positioning (imputed) | Present | `batchCard === 'imputed-vs-market'` |
| Batch: Bulk scenario | Present | `batchCard === 'bulk-scenario'` |
| Batch: Detailed scenario | Present | `batchCard === 'detailed-scenario'` |
| Batch results (dashboard + table + save/load runs) | Present | `step === 'batch-results'`; uses batchCard for bulk vs detailed |
| Compare scenarios | Present | `step === 'compare-scenarios'` |
| Help (How to use) | Present | `step === 'help'`, HelpScreen with HelpContent + Quick tour |
| Legal (Privacy, Terms) | Present | Hash-based; LegalPage for #privacy, #terms |

**Verdict:** All required screens are present.

---

## Landing / home

- **Current behavior:** App opens with `step === 'upload'` (Import data). There is no dedicated "home" screen in the main flow.
- **HomeScreen component:** `src/components/home-screen.tsx` exists (cards: Import data, Single scenario, CF Optimizer, Market positioning, Create and Run Scenario, Detailed scenarios) but is **not rendered** in `App.tsx`. It is dead code for the current flow.
- **Recommendation:**
  - **Option A (keep as-is):** Upload-as-landing is sufficient. Users typically need to import data first; the sidebar clearly shows all destinations. No change.
  - **Option B (add home):** If product wants a clear "What do you want to do?" entry point (e.g. for returning users who already have data), integrate HomeScreen as the initial view when the app loads and let "Import data" be one card. Then default `step` could be a new `'home'` or render HomeScreen when `step === 'upload'` and no data is loaded (hybrid).
- **Deliverable recommendation:** **Upload-as-landing is sufficient** for the current scope. Remove or repurpose the unused HomeScreen to avoid confusion (e.g. delete it or use it only in a future "home" step).

---

## Navigation

- **Sidebar** (`app-layout.tsx`):
  - Collapsed rail (68px) and expanded (260px); all steps reachable: Import data, Data browser, Single scenario, four Batch cards, Compare scenarios, How to use.
  - "Start" button goes to Upload (same as Import data).
  - Mobile: sheet menu with same nav; header shows logo + "TCC Modeler".
- **Back paths:**
  - Modeller: Back goes stepwise (results → market → scenario → provider) then to Data; never traps.
  - Batch scenario: Back from each batch card goes to Batch card picker (`setBatchCard(null)`).
  - Batch results: Back goes to batch-scenario and restores the card (bulk or detailed); if user had no results, they see card picker. No trap.
  - Compare scenarios: Back goes to Upload (plan says "onBack={() => handleStepChange('upload')}"). Consider whether Back should go to Batch (CF Optimizer) for consistency; current behavior is acceptable.
- **Issue (minor):** Compare scenarios "Back" goes to Upload. Users who navigated Batch → CF Optimizer → Compare might expect Back to return to CF Optimizer. Optional improvement: pass a "return step" (e.g. batch-scenario + cf-optimizer) when opening Compare from the optimizer.

---

## Help "Go to" entry points

Verified in `help-content.tsx`:

| Go to button | step | batchCard | Result |
|--------------|------|-----------|--------|
| Import data | upload | — | Correct |
| Data browser | data | — | Correct |
| Single scenario | modeller | — | Correct |
| CF Optimizer | batch-scenario | cf-optimizer | Correct |
| Market positioning | batch-scenario | imputed-vs-market | Correct |
| Create and Run Scenario | batch-scenario | bulk-scenario | Correct |
| Detailed scenarios | batch-scenario | detailed-scenario | Correct |
| Scenario results | batch-results | (none) | Correct; shows bulk results or empty state |
| Compare scenarios | compare-scenarios | — | Correct |

Help `onNavigate` is passed from App as `(s, batchCard) => { handleStepChange(s); if (batchCard != null) setBatchCard(batchCard) }`, so batch cards are set correctly when navigating from Help. **No issues found.**

---

## Missing or redundant

- **Missing screens:** None required for the stated scope. Optional future: dedicated "Saved scenarios" list (currently scenarios are in dropdowns on Upload and Modeller).
- **Redundant/unused:** HomeScreen is unused; recommend removal or integration as above.

---

## Summary

- **Screen gaps:** None. All required screens exist.
- **Navigation issues:** Minor — Compare scenarios Back goes to Upload; consider Back-to-optimizer for consistency.
- **Home vs upload-as-landing:** Recommend keeping Upload as landing; remove or repurpose unused HomeScreen to reduce dead code and clarify IA.
