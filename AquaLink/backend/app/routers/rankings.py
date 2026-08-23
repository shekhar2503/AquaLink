from fastapi import APIRouter, Query
from app.core import data as data_layer

router = APIRouter(prefix="/rankings", tags=["Rankings"])


@router.get("")
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
    df = data_layer.filter_records(district=district, year=year or data_layer.latest_year())
    df = df.sort_values("Water_Stress_Score", ascending=False).head(top)
    cols = [
        "location_id", "District", "Taluka", "Village_Ward",
        "Water_Stress_Score", "Groundwater_Stress_Score",
        "Water_Supply_Gap_Score", "Risk_Category", "Recommended_Action",
    ]
    return {
        "year": year or data_layer.latest_year(),
        "count": len(df),
        "results": df[cols].to_dict(orient="records"),
    }
