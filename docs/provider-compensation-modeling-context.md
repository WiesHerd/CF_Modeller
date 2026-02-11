# Provider Compensation Modeling – Comprehensive System Context

This application models provider compensation by evaluating the relationship between productivity, pay, and market benchmarks using standardized percentile methodology. The objective is to assess whether provider compensation is aligned with market norms, productivity expectations, and internal governance principles.

---

## 1. Core Compensation Framework

Most employed provider compensation models are productivity-based and anchored on **work RVUs (wRVUs)**. wRVUs represent the relative amount of clinical work performed. Compensation is translated from work into dollars using a **conversion factor (CF)**, expressed as dollars per wRVU.

Market compensation surveys provide benchmark distributions (typically 25th, 50th, 75th, 90th percentiles) for:

- **Total Cash Compensation (TCC)**
- **wRVUs**
- Sometimes **$ per wRVU** or data that allows derivation of implied rates

These benchmarks are used to evaluate both pay level and pay-for-productivity alignment.

---

## 2. FTE Normalization Principles

Providers often have mixed roles (clinical and non-clinical). To ensure fair benchmarking, normalization is required.

**Productivity normalization**  
Productivity expectations apply only to the clinical portion of effort.

```
wRVU_normalized = Actual_wRVUs / ClinicalFTE
```

**Compensation normalization**  
Cash compensation reflects total paid effort.

```
TCC_normalized = TotalCashComp / TotalFTE
```

**This distinction is critical:**

- wRVUs are normalized by **clinical FTE**
- TCC is normalized by **total FTE**

---

## 3. Percentile Calculation Methodology

Percentiles are calculated using **piecewise linear interpolation** between benchmark anchor points (25th, 50th, 75th, 90th). This method is applied consistently across all benchmarked metrics.

Percentiles calculated include:

- wRVU percentile (using wRVU_normalized)
- TCC percentile (using TCC_normalized)
- Conversion Factor percentile
- Imputed TCC per wRVU percentile

This ensures methodological consistency across productivity, pay, and rate-based metrics.

---

## 4. Conversion Factor (CF)

The compensation conversion factor represents the contractual dollar value paid per unit of work.

```
CF_current = ClinicalBasePay / Actual_wRVUs
```

The CF:

- Defines how productivity converts to compensation
- Establishes productivity targets
- Drives incentive calculations
- Is benchmarked against market CF distributions to determine a **CF percentile**

---

## 5. wRVU Incentive Mechanics

Clinical base pay establishes a productivity threshold.

```
Target_wRVUs = ClinicalBasePay / CF
```

Incentive eligibility is determined by performance relative to this target.

```
Excess_wRVUs = Actual_wRVUs - Target_wRVUs
Incentive_Pay = max(0, Excess_wRVUs) × CF
```

If actual wRVUs fall below the target, the provider has not fully covered clinical base pay, which may create salary risk depending on plan governance (guarantees, smoothing, or true-up policies).

---

## 6. Imputed TCC per wRVU

**Imputed TCC per wRVU** represents the effective dollars paid per unit of normalized clinical work, independent of contract mechanics.

```
Imputed_TCC_per_wRVU = TCC_normalized / wRVU_normalized
```

This is an **analytical metric**, not a contractual rate. It is used to:

- Reveal the effective compensation rate actually paid
- Explain mismatches between TCC percentile and wRVU percentile
- Compare providers fairly across different FTE and incentive structures
- Evaluate whether incentives and guarantees are functioning as intended

Imputed TCC per wRVU is benchmarked and assigned a percentile using market $/wRVU distributions.

---

## 7. Alignment Analysis

A central diagnostic is the comparison of pay percentile to productivity percentile.

```
Alignment_Gap = TCC_percentile - wRVU_percentile
```

**Interpretation:**

- **Positive gap:** pay exceeds productivity (potential over-market or intentional strategic premium)
- **Negative gap:** productivity exceeds pay (compression or retention risk)
- **Minimal gap:** compensation aligned with productivity

CF percentile and imputed TCC per wRVU percentile are used to explain and validate alignment outcomes.

---

## 8. Governance and Reliability Flags

The model should surface flags that inform decision-making, including:

- Low TotalFTE (e.g., &lt;0.70) affecting benchmark reliability
- Low ClinicalFTE affecting productivity normalization stability
- CF materially outside market norms
- Large alignment gaps requiring review

These flags do not imply error but signal where professional judgment is required.

---

## 9. Model Outputs (Per Provider)

The application should compute and present:

- Normalized wRVUs and TCC
- wRVU percentile
- TCC percentile
- Conversion Factor and CF percentile
- Imputed TCC per wRVU and percentile
- Target wRVUs, excess/deficit wRVUs, incentive dollars
- Alignment gap and governance indicators

---

## 10. Summary Principle

Provider compensation evaluation is fundamentally about **comparing normalized productivity to normalized pay** using market percentiles. Conversion factors translate work into dollars, incentives reward performance above target, and imputed TCC per wRVU explains the effective rate actually paid. Together, these metrics provide a defensible, market-aligned framework for compensation modeling and decision-making.
