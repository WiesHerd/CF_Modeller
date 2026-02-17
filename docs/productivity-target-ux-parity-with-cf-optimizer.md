# Productivity Target Optimizer – UX Parity with CF Optimizer

The Productivity Target Builder (Target Optimizer) must look and behave like the CF Optimizer: same step-through flow, save/load of models, icons, and drawers.

## Reference: CF Optimizer structure

- **Screen:** `ConversionFactorOptimizerScreen`
- **Phases:** `optimizerStep === 'configure' | 'run'`
- **Configure:** `OptimizerConfigureStage` – single Card with numbered step nav (1–4), Next/Back, Run. Steps: Target population, Objective, Governance, Total cash compensation.
- **Run:** `OptimizerRunStage` – Card “Run and review” with Run / Start over, Export, optional CF Sweep; then `OptimizerReviewWorkspace` (filters, table); row click → `OptimizerDetailDrawer`.
- **Toolbar:** Back; when on run, “Change requirements”; Save (disabled until result); Load (FolderOpen dropdown); Compare scenarios (GitCompare); Reset (RotateCcw).
- **Save dialog:** Name + “Update current” / “Save as new” when a scenario is loaded.
- **Persistence:** `optimizerConfig` (in-memory snapshot), `onOptimizerConfigChange`, `savedOptimizerConfigs`, load/delete; `optimizer-storage.ts` for localStorage.
- **Drawers:** `CFSweepDrawer` (Sheet, resizable); `OptimizerDetailDrawer` (Sheet, resizable) for specialty/provider detail.

## Productivity Target Optimizer – same patterns

### 1. Layout and toolbar

- **Section title:** `SectionTitleWithIcon` with **Target** (or **Crosshair**) icon + “Productivity Target Builder” (or “Specialty Productivity Target”).
- **Toolbar (left):** Back (when configure → exit; when run → “Change requirements” to go back to configure).
- **Toolbar (right):** Save (disabled until run has result), Load (FolderOpen + ChevronDown dropdown of saved target scenarios), optional Compare (if we add compare later), Reset (RotateCcw) to clear config.
- Reuse same `Button` variants and `TooltipProvider` / tooltips as CF Optimizer.

### 2. Two phases: configure | run

- **State:** `targetStep === 'configure' | 'run'` (same idea as `optimizerStep`).
- **Configure phase:** One Card containing the step-through (see below). On “Run”, set `targetStep = 'run'` and run the engine (sync).
- **Run phase:** Card “Run and review” + review workspace; “Change requirements” returns to configure and resets to step 1 or keeps last step.

### 3. Configure stage – step-through

- **Single Card** with:
  - **CardHeader:** Icon (Target/Crosshair in rounded `bg-primary/10`), title “Productivity Target Builder”, subtitle e.g. “Set group wRVU target per specialty and compare to actuals.”
  - **Step nav:** Numbered steps (e.g. 1, 2, 3) in a pill/tab strip like CF Optimizer (`CONFIG_STEPS`), e.g.:
    - **Step 1 – Target scope:** Target population (all vs custom specialties), optional divisions, provider type filter, exclusion rules (min cFTE, min wRVU) to match CF Optimizer scope.
    - **Step 2 – Target method & planning:** Approach A/B dropdown, target percentile, CF percentile (for B), alignment tolerance; Planning incentive section (CF for planning: market percentile vs manual). Optional ramp (Phase 1 minimal).
    - **Step 3 – Review & run:** Summary of choices, Run button.
  - **CardContent:** Per-step content; **Back** / **Next** at bottom; **Run** on last step (or always visible when step 3).
- Reuse same step-nav styling (e.g. `bg-muted/50`, active = primary).

### 4. Run stage

- **Card “Run and review”** (same pattern as `OptimizerRunStage`):
  - Header with Target icon and “Run and review” title + short tooltip.
  - When no result: “Run” button (runs engine synchronously).
  - When running: progress or “Running…”.
  - When result: “Run again”, “Start over” (back to configure), **Export CSV**.
- **Review workspace** below the card:
  - Sticky filters: search (specialty/division), optional filter by status (Above / At / Below target).
  - By-specialty table or cards (expandable rows): group target, total potential incentive, provider count; expand to show provider table (cFTE, actual wRVUs, target, % to target, variance, status, potential incentive).
  - **Row/specialty click** → open **detail drawer** (Sheet, resizable) with:
    - Specialty name, group target at 1.0 cFTE, approach, percentiles.
    - Provider list for that specialty with full columns.
    - Short “How target is set” / “How planning incentive is calculated” copy (like market-positioning-calculation-drawer).
  - Optional: histogram of percent-to-target bands below or in a collapsible section.

### 5. Save / Load / Reset

- **Snapshot type:** `ProductivityTargetConfigSnapshot` with: `settings` (ProductivityTargetSettings), `configStep`, `targetStep`?, `lastRunResult` (by-specialty results + provider rows), scope (selectedSpecialties, selectedDivisions, etc. if we add them).
- **In-memory:** `targetOptimizerConfig` (or `productivityTargetConfig`) in app state, `onProductivityTargetConfigChange`, so switching batch cards and coming back restores state.
- **Persisted:** `savedProductivityTargetConfigs` (array of `{ id, name, createdAt, snapshot }`), stored in localStorage via e.g. `productivity-target-storage.ts` (same pattern as `optimizer-storage.ts`).
- **Save dialog:** Same as CF Optimizer – “Save target scenario”, scenario name input, “Update current” when a saved scenario is loaded, “Save as new” / “Save”.
- **Load:** Dropdown (FolderOpen + ChevronDown) listing saved configs; each row: name + delete (Trash2) icon; on select, load into `productivityTargetConfig` and set `loadedProductivityTargetConfigId`.
- **Reset (RotateCcw):** Clear in-memory config and loaded id; reinitialize to defaults.

### 6. Icons

- **Main / section:** Target or Crosshair (lucide-react) – distinct from Gauge (CF Optimizer).
- **Toolbar:** ArrowLeft (Back), Save, FolderOpen, ChevronDown, GitCompare (optional), RotateCcw.
- **Card header (configure):** Target/Crosshair in rounded box.
- **Run stage card:** Same Target icon.
- **Drawer:** Same as CF Optimizer (no extra icon in title if not needed).

### 7. Drawers

- **Detail drawer:** When user clicks a specialty (or a provider row), open a **Sheet** (resizable width, same pattern as `OptimizerDetailDrawer` / `CFSweepDrawer`): drag handle to resize, title = specialty name (or “Provider detail”), content = provider list for that specialty + short explanation of group target and planning incentive formula.
- **Optional “Target sweep” drawer:** Like CF Sweep – run at several target percentiles (e.g. 25, 50, 75) and show comparison. Can be Phase 2; not required for initial release.

### 8. App integration

- **App state:** Add `productivityTargetConfig: ProductivityTargetConfigSnapshot | null`, `loadedProductivityTargetConfigId: string | null`, `savedProductivityTargetConfigs: SavedProductivityTargetConfig[]`.
- **Persistence:** Load/save `savedProductivityTargetConfigs` from/to localStorage on init and on save/delete.
- **Reports / Help:** Link to “Productivity Target Builder” same way as “CF Optimizer” (batch card, help GoToButton).

## Summary checklist

- [ ] Section title + Target (or Crosshair) icon
- [ ] Toolbar: Back, Change requirements (when on run), Save, Load dropdown, Compare (optional), Reset
- [ ] Two phases: configure | run
- [ ] Configure: Single Card with step nav (1=Scope, 2=Target method & planning, 3=Review & run), Next/Back, Run
- [ ] Run: Card “Run and review” with Run / Start over / Export CSV; review workspace with filters and by-specialty table/cards
- [ ] Row/specialty click → resizable detail drawer (target + provider list + short calculation explanation)
- [ ] Save dialog (name, Update current / Save as new)
- [ ] Saved configs in localStorage, Load dropdown with delete per item
- [ ] Snapshot includes settings, configStep, lastRunResult so state survives tab switch and load
