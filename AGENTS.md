# AGENTS.md

## Cursor Cloud specific instructions

### Overview

TCC Modeler is a **client-only React SPA** (no backend, no database, no external APIs). All data lives in browser `localStorage`/`sessionStorage`. Heavy computations use Web Workers.

### Dev commands

Standard commands are in `package.json` and `README.md`. Quick reference:

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, default port 5173) |
| Lint | `npm run lint` |
| Unit tests | `npm run test` (Vitest, 71 tests across 5 files in `src/lib/`) |
| Build | `npm run build` (`tsc -b && vite build`) |
| Preview build | `npm run preview` |

### Caveats

- **Lint exits non-zero** with pre-existing warnings (112 warnings, 24 errors as of initial setup). These are React Compiler memoization warnings, `react-refresh` export warnings, and a few `prefer-const` errors in the existing codebase — not blockers.
- **No environment variables** are required. Vite provides `import.meta.env.DEV` automatically.
- **No backend or Docker** needed. The app is entirely client-side.
- To test the app manually, use the built-in "Download sample" buttons on the Import Data page to get properly formatted provider and market CSV files, upload them, then navigate to Single Scenario to model compensation.
- Path alias `@/` maps to `./src/` (configured in `vite.config.ts` and `tsconfig.json`).
