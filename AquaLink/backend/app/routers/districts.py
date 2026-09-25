from fastapi import APIRouter, Query
from app.core import data as data_layer
from app.schemas import DistrictSummariesResponse, canonicalize_record
from app.core.quality import assess_prototype_aggregate

router = APIRouter(prefix="/districts", tags=["Districts"])


@router.get("")
def list_districts():
    """All district names in the dataset."""
    return {"districts": data_layer.get_districts()}


@router.get("/summary", response_model=DistrictSummariesResponse)
def districts_summary(year: int | None = Query(default=None, description="Defaults to latest year in dataset")):
    """
    District-level rollup: average scores, village counts, and count of
    Critical/High risk villages -- the primary data source for the
    priority ranking table and the district-level bar chart.
    """
    summary = data_layer.district_summary(year=year)
    selected_year = year or data_layer.latest_year()
    latest_year = data_layer.latest_year()
    results = []
    for row in summary.to_dict(orient="records"):
        supporting_count = int(row["villages_count"])
        results.append(canonicalize_record({
            **row,
            "supporting_observation_count": supporting_count,
            "quality": assess_prototype_aggregate(selected_year, latest_year, supporting_count),
        }))
    total_support = int(summary["villages_count"].sum()) if not summary.empty else 0
    return {
        "year": selected_year,
        "count": len(summary),
        "supporting_observation_count": total_support,
        "quality": assess_prototype_aggregate(selected_year, latest_year, total_support),
        "results": results,
    }
