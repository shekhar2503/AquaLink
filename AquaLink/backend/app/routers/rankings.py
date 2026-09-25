from fastapi import APIRouter, Query
from app.core import data as data_layer
from app.core.engine import authoritative_record
from app.core.geography import safe_geography_fields
from app.core.quality import assess_prototype_aggregate, assess_prototype_record
from app.schemas import RankingsResponse, canonicalize_record

router = APIRouter(prefix="/rankings", tags=["Rankings"])


@router.get("", response_model=RankingsResponse)
def get_rankings(
    district: str | None = Query(default=None),
    year: int | None = Query(default=None, description="Defaults to latest year"),
    top: int = Query(default=50, le=1000),
):
    """
    Villages/wards ranked by Water_Stress_Score descending -- the primary
    data source for the priority ranking table ("which locations need
    attention first").
    """
    filtered = data_layer.filter_records(district=district, year=year or data_layer.latest_year())
    supporting_count = len(filtered)
    df = filtered.sort_values("Water_Stress_Score", ascending=False).head(top)
    cols = [
        "location_id", "Year", "District", "Taluka", "Village_Ward",
        "Water_Stress_Score", "Groundwater_Stress_Score",
        "Water_Supply_Gap_Score", "Risk_Category", "Recommended_Action",
    ]
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
        results.append(canonicalize_record({key: value for key, value in enriched.items() if key in cols or key in {"Recommendation", "Score_Version", "geography_id", "area_group_id", "location_display_name", "area_group_display_name", "geography_source_status", "coordinate_source", "coordinate_status", "quality"}}))
    return {
        "year": selected_year,
        "count": len(df),
        "supporting_observation_count": supporting_count,
        "quality": assess_prototype_aggregate(selected_year, latest_year, supporting_count),
        "results": results,
    }
