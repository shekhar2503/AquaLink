from fastapi import APIRouter, Query
from app.core import data as data_layer

router = APIRouter(prefix="/hotspots", tags=["Hotspots"])

MAP_FIELDS = [
    "location_id", "District", "Taluka", "Village_Ward", "Area_Type",
    "Latitude", "Longitude", "Groundwater_Stress_Score",
    "Water_Supply_Gap_Score", "Water_Stress_Score", "Risk_Category",
    "Recommended_Action",
]


@router.get("")
def get_hotspots(
    district: str | None = Query(default=None),
    region: str | None = Query(default=None),
    risk: str | None = Query(default=None, description="Low | Moderate | High | Critical"),
    year: int | None = Query(default=None, description="Defaults to latest year"),
    tribal_only: bool = Query(default=False),
    limit: int = Query(default=2000, le=10000),
):
    """
    Map-ready points: filtered village/ward records with lat/long and
    risk category, for the GIS map layer.
    """
    df = data_layer.filter_records(
        district=district, region=region,
        year=year or data_layer.latest_year(),
        risk=risk, tribal_only=tribal_only,
    )
    df = df[MAP_FIELDS].head(limit)
    return {"year": year or data_layer.latest_year(), "count": len(df), "results": df.to_dict(orient="records")}
