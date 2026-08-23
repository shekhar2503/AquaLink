from fastapi import APIRouter, Query
from app.core import data as data_layer

router = APIRouter(prefix="/districts", tags=["Districts"])


@router.get("")
def list_districts():
    """All district names in the dataset."""
    return {"districts": data_layer.get_districts()}


@router.get("/summary")
def districts_summary(year: int | None = Query(default=None, description="Defaults to latest year in dataset")):
    """
    District-level rollup: average scores, village counts, and count of
    Critical/High risk villages -- the primary data source for the
    priority ranking table and the district-level bar chart.
    """
    summary = data_layer.district_summary(year=year)
    return {
        "year": year or data_layer.latest_year(),
        "count": len(summary),
        "results": summary.to_dict(orient="records"),
    }
