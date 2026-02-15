# Agent 4: Code Quality — Deliverable

**Goal:** Maintainable, consistent, and correct code.

---

## Structure

- **App.tsx:** Large (~974 lines). Contains step routing, modeller state (step, modelMode, modellerStep, newProviderForm, batchCard, dialogs), all step content (Upload, Data, Modeller with four sub-steps, Batch cards, Batch results, Compare, Help), and handlers. This makes the file hard to scan and test.
- **Recommendation:** Extract step content into feature or route components, e.g.:
  - `UploadStep` (or keep inline if short enough)
  - `ModellerStepContent` that receives `modellerStep`, `modelMode`, `effectiveProvider`, `marketRow`, etc., and renders Provider / Scenario / Market / Results
  - `BatchResultsStep` that receives results, snapshot, and handlers
  Alternatively, a small step router (e.g. `step === 'upload' ? <UploadStep /> : step === 'data' ? <DataStep /> : ...`) with each step in its own file under `src/features/` or `src/screens/` would improve testability and readability.
- **Features vs components:** Feature-specific code lives under `src/features/` (data, help, optimizer). Shared UI is in `src/components/`. Batch UI is in `src/components/batch/`; it could be moved to `src/features/batch/` for consistency, but the current split is acceptable.

---

## State

- **use-app-state.ts:** Single hook holding the full app state (providers, market, scenario, batch, optimizer, saved runs, etc.) and many updaters. Initial state is hydrated from storage (storage, batchStorage, optimizerStorage). Persistence is done via useEffect per slice (providerRows, marketRows, savedScenarios, batch results, etc.).
- **Assessment:** Clear responsibilities; no Redux. For clarity, consider grouping related updaters (e.g. batch: setBatchResults, saveCurrentBatchRun, loadSavedBatchRun, etc.) or documenting the state shape in a README. No need to split state into multiple hooks unless performance (e.g. batch results causing full-app re-renders) becomes an issue.
- **Persistence:** `storage.ts` (providers, market, mappings, saved scenarios, data browser filters), `batch-storage.ts` (batch results by mode, saved runs, synonym map, scenario configs, upload meta), `optimizer-storage.ts` (saved optimizer configs). Try/catch in loaders return safe defaults; no explicit error surfacing to user for load failures. **Suggestion:** Log load errors (e.g. console.warn) so corrupt localStorage can be diagnosed.

---

## Types

- **src/types/:** provider, market, scenario, batch, optimizer, upload. Types are used consistently across components and lib.
- **any:** No `any` or `as any` found in `src/`. Type safety is good.

---

## Core logic

- **compute.ts:** Pure scenario computation; handles zero FTE (highRisk), low wRVU (warnings), division-by-zero via safeDiv. Good.
- **optimizer-engine.ts:** Pure functions (percentileFromBenchmarks, calculateModeledTCC, buildExplanation, optimizeCFForSpecialty, etc.); edge cases (missing market, empty providers) return empty or safe results. Good.
- **interpolation.ts:** interpPercentile, inferPercentile; runInterpolationSelfCheck for validation. Good.
- **normalize-compensation.ts:** TCC breakdown, baseline for optimizer; many exported helpers. Good.
- **Tests:** Only `optimizer-engine.test.ts` exists. **Gaps:** No tests for `compute.ts` (scenario TCC/incentive/percentile), `interpolation.ts`, or export functions (batch-export, compare-scenarios-export). Recommendation: Add unit tests for compute and interpolation; optionally for export (snapshot or key columns).

---

## Dependencies

- **package.json:** React 19, Vite, TypeScript, Tailwind, Recharts, xlsx, papaparse, Radix-based UI. No obvious bloat. Versions are pinned. Good.

---

## Linting and formatting

- **ESLint:** `npm run lint` passes (exit 0). There are **warnings** worth addressing:
  1. **Unused eslint-disable:** `batch-results-dashboard.tsx` (line 94), `batch-scenario-step.tsx` (line 79). Remove the directive or fix the rule.
  2. **react-refresh/only-export-components:** Files that export both components and non-components (e.g. constants, functions) trigger this: `delta-indicator.tsx`, `modeling-impact-section.tsx`, `new-provider-form.tsx`. Consider moving shared constants/helpers to a separate file (e.g. `delta-indicator-utils.ts`, `modeling-impact-utils.ts`) so the component file only exports components.
  3. **react-hooks/purity:** `Math.random()` used in React `key` in render in: `division-table.tsx`, `existing-provider-and-market-card.tsx`, `percentile-modeler-header.tsx`, `provider-division-select.tsx`. Keys should be stable. Use a stable fallback (e.g. index only if list is static, or ensure providerId/providerName is always set) instead of `Math.random()`.
- **Project rules:** kebab-case filenames are used. Logic in UI: some components (e.g. baseline-vs-modeled-section) contain non-trivial logic (slider handlers, derived state); acceptable for now; further extraction would be optional.

---

## Summary of recommendations

1. **Refactor App.tsx:** Extract step content into separate components or a step router to reduce file size and improve testability.
2. **Fix lint warnings:** Remove unused eslint-disable; fix Math.random() in keys (use stable id); consider splitting files that mix component and non-component exports for react-refresh.
3. **Tests:** Add unit tests for `compute.ts` and `interpolation.ts`; optionally for export modules.
4. **Persistence:** Add minimal logging (e.g. console.warn) when storage load fails so corrupt data can be diagnosed.
5. **Optional:** Move batch UI from `components/batch/` to `features/batch/` for consistency with other features.
