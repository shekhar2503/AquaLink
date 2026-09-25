# AquaLink dashboard

This React application is the canonical frontend for AquaLink. It provides a Pune District dashboard, risk map, analytics, forecast, and rule-based recommendations backed by the AquaLink FastAPI service.

## Prerequisites

- Node.js compatible with Vite 8 (Node 20.19+ or 22.12+ recommended)
- npm
- Python 3.11+ for the backend

## Run locally

### 1. Start the backend

From the repository root:

```powershell
cd AquaLink\backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify it at `http://127.0.0.1:8000/health`; interactive API documentation is at `http://127.0.0.1:8000/docs`.

### 2. Start the dashboard

In a second terminal, from the repository root:

```powershell
cd aqualink-dashboard
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/dashboard`.

The npm commands must be run inside `aqualink-dashboard`, where `package.json` is located.

## Environment variables

Create `aqualink-dashboard/.env.local` when a non-default API address is required:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

`VITE_API_BASE_URL` defaults to `http://localhost:8000`. Do not commit `.env` or `.env.local` files. Only variables prefixed with `VITE_` are exposed to browser code, so secrets must never be stored in them.

## API and fallback behavior

For current-location pages, the dashboard first requests:

```text
GET {VITE_API_BASE_URL}/hotspots?district=pune&limit=5000
```

Forecast data first comes from:

```text
GET {VITE_API_BASE_URL}/api/forecast/district?district=pune
```

If the backend is unavailable or does not return usable records, the dashboard reads `public/aqualinkData.csv`. This fallback is generated as an exact publication of the repaired canonical dataset and currently covers 2020–2025. A later implementation phase will make source and year provenance visible in the UI.

## Project structure

```text
AquaLink/
├── aqualink-dashboard/          # Canonical React frontend
│   ├── public/                  # Static data and map assets
│   └── src/
│       ├── components/          # Shared navigation, map, footer, and UI
│       ├── pages/               # Dashboard, map, analytics, forecast, actions
│       └── utils/               # Data loading and metric normalization
└── AquaLink/
    ├── backend/
    │   ├── app/core/            # Data access, scoring, forecast, local DB
    │   ├── app/routers/         # FastAPI endpoints
    │   ├── data/                # Canonical backend prototype dataset
    │   └── tests/               # Unit and API tests
    └── docs/                    # Dataset documentation
```

`AquaLink/frontend` was an earlier standalone HTML prototype and is not the active frontend.

## Commands

From `aqualink-dashboard`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Run ESLint |
| `npm test` | Run frontend contract and React component tests |
| `npm run test:coverage` | Run React tests with V8 coverage output |
| `npm run test:e2e` | Start the local stack and run Chromium user journeys |
| `npm run build` | Create a production build in `dist` |
| `npm run preview` | Preview the production build locally |

From the repository root, run backend tests with:

```powershell
python -m pytest AquaLink\backend\tests -q
```

## Dataset limitations

The current dataset is simulated but hydrogeologically grounded. It is suitable for prototyping workflows and demonstrating the scoring engine, not for operational decisions.

- Village and taluka identifiers in the source data are generated placeholders.
- Coordinates are simulated around district centroids.
- Population and several environmental indicators are simulated.
- Correlations and trends are hand-modelled rather than learned from raw observations.
- The frontend maps Pune placeholder identifiers to readable area-group labels for demonstration.
- The fallback CSV is a generated copy of the canonical backend CSV; run the documented rebuild and validation commands after changing the canonical data.
- Real deployment requires validated CGWB/GSDA, JJM, IMD, LGD, and related records.

See [`../AquaLink/docs/DATA_DICTIONARY.md`](../AquaLink/docs/DATA_DICTIONARY.md) for fields, formulas, sources, and known limitations.

## Verification

Before submitting changes, run:

```powershell
cd aqualink-dashboard
npm run lint
npm test
npm run build
cd ..
python AquaLink\backend\scripts\validate_dataset.py --report "$env:TEMP\aqualink-validation.json"
python -m pytest AquaLink\backend\tests -q
```

For the browser suite, install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e` from `aqualink-dashboard`. The browser runner starts both local servers automatically.
