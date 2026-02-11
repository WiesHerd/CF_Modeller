# Calculation Rules Audit vs. Provider Compensation Context

This document compares the application’s calculations to the rules in `provider-compensation-modeling-context.md` and notes changes made to align with them.

---

## 1. Core Compensation Framework ✅

- **Rule:** Productivity-based on wRVUs; compensation via conversion factor (CF); market benchmarks at 25/50/75/90.
- **App:** Uses `totalWRVUs`, `currentCF` / `modeledCF`, and `MarketRow` with TCC_25–90, WRVU_25–90, CF_25–90. **Matches.**

---

## 2. FTE Normalization ✅

- **Rule:**  
  - `wRVU_normalized = Actual_wRVUs / ClinicalFTE`  
  - `TCC_normalized = TotalCashComp / TotalFTE`
- **App:**  
  - `wrvuNorm = totalWRVUs / clinicalFTE` (line 116)  
  - `tccNorm = currentTCC / totalFTE`, `modeledTccNorm = modeledTCC / totalFTE` (lines 117–118)  
  - Percentiles for wRVU and TCC use these normalized values.  
- **Change:** Normalized values are now exposed in results as `wrvuNormalized`, `tccNormalized`, `modeledTccNormalized` so the app “computes and presents” them per the doc.

---

## 3. Percentile Methodology ✅

- **Rule:** Piecewise linear interpolation between 25, 50, 75, 90.
- **App:** `interpolation.ts` uses 25/50/75/90 and linear segments; `inferPercentile` and `interpPercentile` used for all benchmarked metrics. **Matches.**

---

## 4. Conversion Factor ✅

- **Rule:** `CF_current = ClinicalBasePay / Actual_wRVUs` (definition of CF).
- **App:** Uses `provider.currentCF` and `provider.currentThreshold` as inputs; when threshold is derived, `annualThreshold = modeledBase / modeledCF`. The app does not recompute CF from base/wRVUs; it assumes supplied CF is consistent with that definition. **Acceptable.**

---

## 5. wRVU Incentive Mechanics ✅

- **Rule:**  
  - `Target_wRVUs = ClinicalBasePay / CF`  
  - `Excess_wRVUs = Actual_wRVUs - Target_wRVUs`  
  - `Incentive_Pay = max(0, Excess_wRVUs) × CF`
- **App:**  
  - Derived threshold: `annualThreshold = safeDiv(modeledBase, modeledCF, 0)`.  
  - `wRVUsAboveThreshold = max(0, totalWRVUs - annualThreshold)`, `annualIncentive = wRVUsAboveThreshold * modeledCF`.  
  - Same structure for current plan with `currentThreshold` and `currentCF`.  
- **Matches.**

---

## 6. Imputed TCC per wRVU ✅ (Fixed)

- **Rule:** `Imputed_TCC_per_wRVU = TCC_normalized / wRVU_normalized` (analytical metric); benchmark and assign percentile using market $/wRVU.
- **App (before):** Used `currentTCC / totalWRVUs` and `modeledTCC / totalWRVUs` (raw, not normalized).  
- **App (after):**  
  - `imputedTCCPerWRVURatioCurrent = tccNorm / wrvuNorm`  
  - `imputedTCCPerWRVURatioModeled = modeledTccNorm / wrvuNorm`  
- **Percentile:** Market $/wRVU at each percentile derived as `TCC_p / WRVU_p` (e.g. `marketDp25 = TCC_25 / WRVU_25`); `inferPercentile` used to get `imputedTCCPerWRVUPercentileCurrent` and `imputedTCCPerWRVUPercentileModeled`. **Now matches.**

---

## 7. Alignment Analysis ✅

- **Rule:** `Alignment_Gap = TCC_percentile - wRVU_percentile`
- **App:** `alignmentGapBaseline = tccPctResult.percentile - wrvuPctResult.percentile` (and same for modeled). Percentiles are from normalized TCC and normalized wRVU. **Matches.**

---

## 8. Governance and Reliability Flags ✅

- **Rule:** Flag low TotalFTE (e.g. &lt;0.70), low ClinicalFTE, CF outside market norms, large alignment gaps.
- **App:**  
  - `LOW_FTE_RISK = 0.7`; high-risk when clinical or total FTE &lt; 0.7.  
  - Low wRVU warning when total wRVUs &lt; 1000.  
  - `governanceFlags`: underpayRisk (gap &lt; -15), cfBelow25, modeledInPolicyBand, fmvCheckSuggested (TCC &gt; 75th or gap &gt; 15).  
- **Matches.**

---

## 9. Model Outputs (Per Provider) ✅

- **Rule:** Present normalized wRVUs and TCC; wRVU/TCC/CF percentiles; imputed TCC per wRVU and its percentile; target/excess/deficit wRVUs and incentive dollars; alignment gap and governance indicators.
- **App:** All of these are now computed and available on `ScenarioResults`. Added: `wrvuNormalized`, `tccNormalized`, `modeledTccNormalized`, `imputedTCCPerWRVUPercentileCurrent`, `imputedTCCPerWRVUPercentileModeled`. **Matches.**

---

## Summary of Code Changes

1. **`src/lib/compute.ts`**  
   - Imputed TCC per wRVU now uses **normalized** TCC and wRVU: `tccNorm/wrvuNorm` and `modeledTccNorm/wrvuNorm`.  
   - Market $/wRVU curve derived from `TCC_p/WRVU_p`; imputed $/wRVU percentiles (current and modeled) added.  
   - Results now include: `wrvuNormalized`, `tccNormalized`, `modeledTccNormalized`, `imputedTCCPerWRVUPercentileCurrent`, `imputedTCCPerWRVUPercentileModeled`.

2. **`src/types/scenario.ts`**  
   - `ScenarioResults` extended with the new fields and short comments tying them to the doc.

UI components that already consume `ScenarioResults` (e.g. baseline-vs-modeled, market-position-table, modeller-top-section) continue to work; they can optionally display the new normalized and imputed-percentile fields where useful.
