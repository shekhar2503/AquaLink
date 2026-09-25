# AquaLink

AquaLink is a water-stress monitoring and decision-support prototype for Pune District. The canonical user interface is the React application in [`aqualink-dashboard`](aqualink-dashboard/); the FastAPI service and scoring engine are in [`AquaLink/backend`](AquaLink/backend/).

## Quick start

Run the backend in one terminal:

```powershell
cd AquaLink\backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Run the dashboard in a second terminal:

```powershell
cd aqualink-dashboard
npm install
npm run dev
```

Open `http://127.0.0.1:5173/dashboard`. API documentation is available at `http://127.0.0.1:8000/docs`.

See [`aqualink-dashboard/README.md`](aqualink-dashboard/README.md) for complete setup, fallback behavior, commands, environment variables, architecture, and dataset limitations.

## Run the CI checks locally

Install backend development dependencies once:

```powershell
python -m pip install -r AquaLink\backend\requirements-dev.txt
```

Run the backend suite and the same dataset validation used in CI:

```powershell
python AquaLink\backend\scripts\validate_dataset.py --report "$env:TEMP\aqualink-validation.json"
cd AquaLink\backend
python -m pytest -q
cd ..\..
```

Run frontend checks:

```powershell
cd aqualink-dashboard
npm ci
npm run lint
npm test
npm run build
```

Install the E2E browser once, then run the browser journeys:

```powershell
npx playwright install chromium
npm run test:e2e
```

Playwright starts the frontend and backend automatically. See [`AquaLink/docs/TESTING.md`](AquaLink/docs/TESTING.md) for coverage and known gaps.
