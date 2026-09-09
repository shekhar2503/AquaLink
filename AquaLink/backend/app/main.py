from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import districts, hotspots, village, rankings
from app.core import data as data_layer

app = FastAPI(
    title="AquaLink API",
    description="Water Stress monitoring and decision-support API for Maharashtra (SIH2026 prototype).",
    version="0.1.0",
)

# permissive CORS for prototype/demo purposes -- tighten before any real deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(districts.router)
app.include_router(hotspots.router)
app.include_router(village.router)
app.include_router(rankings.router)


@app.get("/")
def root():
    return {
        "name": "AquaLink API",
        "status": "ok",
        "docs": "/docs",
        "endpoints": ["/districts", "/districts/summary", "/hotspots", "/village/{id}", "/rankings"],
    }


@app.get("/health")
def health():
    df = data_layer.load_dataset()
    return {
        "status": "ok",
        "rows_loaded": len(df),
        "districts": df.District.nunique(),
        "years": sorted(df.Year.unique().tolist()),
    }
