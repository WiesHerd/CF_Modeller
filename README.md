# TCC Modeler

A React web app for **provider compensation modeling**. Upload provider and market survey data (CSV or XLSX), select specialty and provider or division, adjust scenario inputs (CF percentile, adjustment factor, threshold method), and view current vs modeled TCC, wRVU percentiles, and risk flags.

## Stack

- **React 18+** with **TypeScript** and **Vite**
- **Tailwind CSS** and **shadcn/ui**
- **Recharts** for bar charts
- **PapaParse** (CSV) and **SheetJS (xlsx)** for file parsing
- No backend; data and scenarios live in browser memory and `localStorage`

## Scripts

- `npm install` – install dependencies
- `npm run dev` – start dev server
- `npm run build` – production build (output: `dist/`)
- `npm run preview` – serve `dist/` locally

## Deploy on Vercel

1. Push the repo to GitHub (or connect another Git provider).
2. In [Vercel](https://vercel.com), **Add New Project** and import the repo.
3. Leave build settings as default (Vercel detects Vite):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Deploy. The SPA is served from `index.html`; `vercel.json` includes a rewrite so all routes fall back to `index.html`.

No environment variables are required for v1.

## Data

- **Provider file:** one row per provider (e.g. `providerId`, `providerName`, `specialty`, `division`, `totalFTE`, `clinicalFTE`, `baseSalary`, `totalWRVUs`, `psqPercent`, etc.). Headers can be mapped on upload if they don’t match expected names.
- **Market file:** one row per specialty (or specialty + type/region) with percentile columns: `TCC_25`–`TCC_90`, `WRVU_25`–`WRVU_90`, `CF_25`–`CF_90`.

## Features

- Upload provider and market CSV/XLSX with optional column mapping and preview.
- Select specialty (from market) and either a single provider (searchable) or a division for a table view.
- Scenario controls: proposed CF percentile, CF adjustment factor, PSQ %, threshold method (annual or wRVU percentile).
- Results: current vs modeled TCC, wRVU/TCC percentiles, CF, incentive, PSQ, risk badges (e.g. low FTE, off-scale percentiles).
- Division table: sort, filter by specialty/risk, export CSV.
- **Validate math:** header button runs the interpolation self-check (percentile ↔ value round-trip).

## Project layout

- `src/types/` – `ProviderRow`, `MarketRow`, `ScenarioInputs`, `ScenarioResults`, mapping types
- `src/lib/` – `interpolation.ts`, `compute.ts`, `parse-file.ts`, `storage.ts`, `utils.ts`
- `src/components/` – upload/mapping, specialty/provider/division select, scenario controls, results dashboard, division table, risk badges, charts
- `src/hooks/` – `use-app-state.ts`
