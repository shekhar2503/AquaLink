from fastapi import APIRouter, Query
from app.core import data as data_layer
from app.core.engine import authoritative_record
from app.core.geography import safe_geography_fields
from app.core.quality import assess_prototype_aggregate, assess_prototype_record
from app.schemas import HotspotsResponse, canonicalize_record

router = APIRouter(prefix="/hotspots", tags=["Hotspots"])

MAP_FIELDS = [
    "location_id", "Year", "Region", "District", "Taluka", "Village_Ward", "Area_Type",
    "Latitude", "Longitude", "Population", "Households", "Annual_Rainfall_mm", "Rainy_Days",
    "PreMonsoon_WaterLevel_mbgl", "PostMonsoon_WaterLevel_mbgl", "Seasonal_Fluctuation_m",
    "GW_Extraction_Stage_pct", "GW_Category_CGWB", "GW_Historical_Trend",
    "Piped_Water_Coverage_pct", "Service_Norm_LPCD", "Actual_Supply_LPCD", "Supply_Gap_pct",
    "Water_Quality_Issue", "Water_Quality_Type", "Tribal_Remote_Area",
    "Groundwater_Stress_Score", "Water_Supply_Gap_Score", "Water_Stress_Score",
    "Risk_Category", "Recommended_Action",
]


@router.get("", response_model=HotspotsResponse)
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
    filtered = data_layer.filter_records(
        district=district, region=region,
        year=year or data_layer.latest_year(),
        risk=risk, tribal_only=tribal_only,
    )
    supporting_count = len(filtered)
    df = filtered[MAP_FIELDS].head(limit)
    latest_year = data_layer.latest_year()
    selected_year = year or latest_year
    history_counts = data_layer.load_dataset().groupby("location_id").size().to_dict()
    results = []
    for row in df.to_dict(orient="records"):
        geography = safe_geography_fields(row)
        enriched = {**authoritative_record(row), **geography}
        enriched["quality"] = assess_prototype_record(
            row, int(history_counts.get(row["location_id"], 0)), latest_year, geography["coordinate_status"]
        )
        results.append(canonicalize_record(enriched))
    aggregate_quality = assess_prototype_aggregate(selected_year, latest_year, supporting_count)
    return {
        "year": selected_year, "count": len(df),
        "supporting_observation_count": supporting_count, "quality": aggregate_quality,
        "results": results,
    }
