# Planning Incentive / Potential Payout – Addendum to Productivity Target Plan

This addendum extends the Specialty Productivity Target Optimizer plan to show a **planning incentive** (potential payout) per provider and per specialty, using the loaded wRVUs and the computed group target as the threshold.

## Behaviour

- **Formula:** For each provider, using **loaded actual wRVUs** and **ramped target as threshold**:
  - `planningIncentiveDollars = max(0, actualWRVUs - rampedTargetWRVU) * planningCF`
- **Planning CF** can be:
  - **Market percentile:** `planningCF = interpPercentile(planningCFPercentile, market.CF_25, CF_50, CF_75, CF_90)` for that specialty’s market (default percentile 50).
  - **Manual:** User enters a single $/wRVU value; applied to all providers (useful when market is missing for some specialties).

## Types (add to productivity-target types)

- **Settings:** `planningCFSource: 'market_percentile' | 'manual'` (default `'market_percentile'`), `planningCFPercentile` (default 50), `planningCFManual?: number`.
- **Provider result:** `planningIncentiveDollars?: number`.
- **Specialty result:** `totalPlanningIncentiveDollars` (sum of providers’ `planningIncentiveDollars`).

## Engine

- After `computeProviderTargets`, for each provider with valid `rampedTargetWRVU`: resolve planning CF (from market or manual), then set `planningIncentiveDollars = max(0, actualWRVUs - rampedTargetWRVU) * planningCF`. Sum by specialty for `totalPlanningIncentiveDollars`.
- When market is missing: if `planningCFSource === 'manual'`, use `planningCFManual` for all; otherwise leave `planningIncentiveDollars` undefined (or 0) for that provider.

## UI

- **Plan settings:** "CF for planning" = "Market at P50" (with percentile selector) or "Manual" (with $/wRVU input). Tooltip: "Estimated incentive if threshold = group target and CF = chosen value; based on loaded wRVUs. For planning only."
- **Provider table:** Add column **Potential incentive ($)**.
- **Specialty card:** Show **Total potential incentive ($)** for the specialty.

## Export

- CSV: include column `planningIncentiveDollars` (or `potentialIncentiveDollars`).

## Unit test

- Provider with actualWRVUs 4000, rampedTarget 3000, CF 50 → planningIncentiveDollars = 50,000.
- Provider below target (actual 2000) → planningIncentiveDollars = 0.
