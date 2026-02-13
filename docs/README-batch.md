# Batch TCC Modeler

The Batch mode runs the same scenario logic across all uploaded providers at once and produces a consolidated results table and export.

## How to run batch

1. **Upload** provider and market files (CSV or XLSX) and map columns as in Single provider mode.
2. Switch to **Batch** via the "Single provider | Batch" toggle.
3. Open **Batch scenario**: set global scenario inputs (CF method, percentiles, threshold, PSQ, etc.) and optionally add **synonyms** (see below).
4. Click **Run model**. Progress is shown (processed / total, elapsed time). When done, you are taken to **Results**.
5. On **Results**, filter by specialty, division, risk, match status; use "Flagged only" or "Missing market"; export to CSV or XLSX.

## Market matching

For each provider, the app finds a market row by the provider’s **specialty** in this order:

1. **Exact** — Normalized match: trim, lower case, collapse spaces, remove punctuation. If the provider specialty (normalized) equals a market row’s specialty (normalized), that row is used and status is **Exact**.
2. **Synonym** — If no exact match, the **synonym map** is checked. If the provider specialty (or its normalized form) is a key in the map, the map’s value is used to look up a market row by normalized specialty. Status is **Synonym**.
3. **Missing** — If still no match, the provider is marked **Missing** and no scenario is computed for that provider (numeric result columns are empty in the table and export).

Match status is shown in the Results table and in the export (**Match** and **matchedMarketSpecialty**).

## Exported fields (wide CSV/XLSX)

- **Provider**: providerId, providerName, specialty, division  
- **Scenario**: scenarioId, scenarioName  
- **Match**: matchStatus (Exact | Normalized | Synonym | Missing), matchedMarketSpecialty  
- **Risk**: riskLevel, warnings  
- **Current vs modeled**: currentTCC, modeledTCC, currentCF, modeledCF, workRVUs, currentIncentive, annualIncentive, psqDollars  
- **Percentiles**: tccPercentile, modeledTCCPercentile, wrvuPercentile  
- **Alignment**: alignmentGapBaseline, alignmentGapModeled  
- **Imputed**: imputedTCCPerWRVURatioCurrent, imputedTCCPerWRVURatioModeled, imputedTCCPerWRVUPercentileCurrent, imputedTCCPerWRVUPercentileModeled  
- **Governance**: underpayRisk, cfBelow25, modeledInPolicyBand, fmvCheckSuggested (Y/N)

Numeric values are exported as raw numbers; missing market rows have empty or placeholder values for computed columns.

## How to add synonyms

1. In **Batch scenario**, open the **Specialty synonym map** card.
2. Enter **Provider specialty (from file)** — e.g. the exact or normalized value that appears in your provider file (e.g. `Cardiology`).
3. Enter **Market specialty (exact name in market file)** — e.g. the specialty string as it appears in your market file (e.g. `Cardiovascular`).
4. Click **Add**. The mapping is saved to localStorage and used on the next Run model.

To remove a synonym, use the trash icon next to that row. Synonyms are persisted across sessions.

## How to run batch with multiple scenarios

- **One scenario**: Use only the current scenario inputs on the Batch scenario step (no need to save a preset). Run model runs **providers × 1 scenario**.
- **Multiple scenarios**: Save one or more scenario presets in **Single provider** mode (Modeller → Scenario → Save scenario). In **Batch** mode, when you click Run model, the batch runs **Current scenario + all saved scenarios** (providers × (1 + number of saved presets)). Each row in the results table is one provider × one scenario; the **Scenario** column identifies which scenario (e.g. "Current", or the saved preset name).

No extra UI is required to “select” which scenarios to run: the batch always runs the current global inputs plus every saved scenario. Results and export include scenarioId and scenarioName so you can filter or pivot by scenario.
