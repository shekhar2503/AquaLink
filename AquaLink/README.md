# AquaLink backend and data

This directory contains the AquaLink FastAPI backend, scoring and forecasting modules, prototype datasets, tests, and data documentation.

The canonical frontend is the React application at [`../aqualink-dashboard`](../aqualink-dashboard/). The previous standalone HTML frontend has been retired.

## Run the API

From the repository root:

```powershell
cd AquaLink\backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health check: `http://127.0.0.1:8000/health`
- OpenAPI documentation: `http://127.0.0.1:8000/docs`

## Run tests

From the repository root:

```powershell
python -m pytest AquaLink\backend\tests -q
```

## Main API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Dataset and service health |
| `GET /districts` | Available districts |
| `GET /districts/summary` | District-level score summary |
| `GET /hotspots` | Filtered map-ready location records |
| `GET /rankings` | Highest-stress locations |
| `GET /village/{location_id}` | Location history and latest details |
| `GET /village/{location_id}/explain` | Score contribution explanation |
| `GET /api/forecast/location/{location_id}` | Location OLS projection |
| `GET /api/forecast/district` | District OLS projection |
| `POST /api/iot/telemetry` | Prototype telemetry ingestion |
| `POST /api/iot/simulate` | Explicitly simulated telemetry |
| `GET /api/iot/live` | Latest persisted SQLite telemetry by device |

## Storage and dataset status

Analytical endpoints currently load `backend/data/aqualink_dataset.csv` into memory with pandas. IoT devices and telemetry are persisted in local SQLite. The analytical API is not backed by SQLite, PostgreSQL, or PostGIS, and no MQTT broker is connected.

The dataset is synthetic but hydrogeologically grounded and must not be represented as verified village-level field observations. See [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) for formulas, reference sources, and limitations.

Complete frontend and full-project setup instructions are in [`../aqualink-dashboard/README.md`](../aqualink-dashboard/README.md).
