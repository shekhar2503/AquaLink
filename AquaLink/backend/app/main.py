from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import districts, hotspots, village, rankings, forecast, iot, metadata
from app.core import data as data_layer, db
from app.core.engine import risk_thresholds_metadata

app = FastAPI(
    title="AquaLink API",
    description="Water Stress monitoring and decision-support API for Maharashtra (SIH2026 prototype).",
    version="1.0.0",
)

# permissive CORS for prototype/demo purposes -- tighten before any real deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    try:
        db.init_db()
    except Exception as e:
        print(f"[AquaLink DB Init Error] SQLite initialization failed: {e}")

app.include_router(districts.router)
app.include_router(hotspots.router)
app.include_router(village.router)
app.include_router(rankings.router)
app.include_router(forecast.router)
app.include_router(iot.router)
app.include_router(metadata.router)


@app.get("/")
def root():
    return {
        "name": "AquaLink API",
        "status": "ok",
        "version": "1.0.0",
        "docs": "/docs",
        "risk_thresholds": risk_thresholds_metadata(),
        "endpoints": [
            "/districts", "/districts/summary", "/hotspots",
            "/village/{id}", "/village/{id}/explain", "/rankings",
            "/api/forecast/location/{id}", "/api/forecast/district",
            "/api/iot/telemetry", "/api/iot/simulate", "/api/iot/live", "/metadata"
        ],
    }


@app.get("/health")
def health():
    df = data_layer.load_dataset()
    return {
        "status": "ok",
        "rows_loaded": len(df),
        "districts": df.District.nunique(),
        "years": sorted(df.Year.unique().tolist()),
        "database": "SQLite",
        "iot_layer": "Persistent SQLite telemetry via HTTP ingestion",
        "mqtt_active": False,
        "postgis_active": False,
    }

