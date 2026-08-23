# AquaLink — Water Stress Monitoring & Decision-Support Platform
### SIH2026 Prototype (Round 1)

Combines groundwater stress indicators + piped water-supply gap indicators
into an area-wise Water Stress Score, an interactive risk map, priority
ranking, and rule-based intervention recommendations.

## Project structure
```
AquaLink/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── engine.py      # Water Stress Engine (pure scoring logic)
│   │   │   └── data.py        # Data loading + query layer
│   │   ├── routers/
│   │   │   ├── districts.py   # /districts, /districts/summary
│   │   │   ├── hotspots.py    # /hotspots (map data)
│   │   │   ├── rankings.py    # /rankings (priority table)
│   │   │   └── village.py     # /village/{id} (drill-down + history)
│   │   └── main.py            # FastAPI app entrypoint
│   ├── data/
│   │   └── aqualink_dataset.csv
│   └── requirements.txt
├── frontend/
│   └── index.html             # Map + rankings + filters (Leaflet, vanilla JS)
└── docs/
    └── DATA_DICTIONARY.md     # Column definitions, sources, scoring formulas
```

## How to run

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/docs` for interactive API docs (Swagger UI).

Quick sanity check:
```bash
curl http://localhost:8000/health
```

### 2. Frontend
No build step needed — it's a single static HTML file that calls the API
directly.
```bash
cd frontend
python -m http.server 5500
```
Then open `http://localhost:5500` in your browser (backend must be running
on port 8000 at the same time).

## API reference (current endpoints)

| Endpoint | Purpose |
|---|---|
| `GET /health` | Sanity check — row count, districts, years loaded |
| `GET /districts` | List of all district names |
| `GET /districts/summary?year=` | Avg scores + Critical/High counts per district (ranking bar chart, table) |
| `GET /hotspots?district=&region=&risk=&year=&tribal_only=&limit=` | Map-ready points with lat/long + risk category |
| `GET /rankings?district=&year=&top=` | Villages/wards ranked by Water_Stress_Score descending |
| `GET /village/{location_id}` | Full multi-year history + latest score breakdown for one location |

## What's done (this session)
- ✅ Full project structure scaffolded
- ✅ Water Stress Engine extracted as a standalone, reusable module (`core/engine.py`)
  — same formulas as the dataset, ready to run on real CGWB/JJM data later
- ✅ FastAPI backend with 5 working endpoints, tested end-to-end against the
  real (enriched, 44,430-row, 6-year) dataset
- ✅ Frontend dashboard: interactive Leaflet map (color-coded by risk),
  filterable by year/district/risk, priority ranking table, and a
  click-through detail panel showing score breakdown + recommendation
- ✅ Verified real hotspots surface correctly (Beed, Solapur, Nandurbar rank
  highest — consistent with the documented CGWB/JJM patterns the dataset was built on)

## Next steps (not yet done)
- [ ] Trend chart in the detail panel (data is already in `/village/{id}`'s
      `history` array — just needs a small chart, e.g. Chart.js)
- [ ] District-level choropleth / boundary overlay instead of only point markers
      (needs Maharashtra district GeoJSON boundaries)
- [ ] Move from CSV-in-memory to SQLite/Postgres for faster filtering at scale
- [ ] Auth / multi-user features (likely out of scope for Round 1 demo)
- [ ] Deploy: backend → Render/Railway, frontend → Vercel/Netlify
- [ ] Swap the `location_id` village/taluka identifiers for real LGD codes if
      you get access to actual CGWB/JJM village-level exports before Round 2
