"""
AquaLink Forecasting API Router
===============================
Exposes multi-year statistical linear regression trend forecasts.

Model Name: Statistical Linear Regression Trend Forecast (OLS)
"""

from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from app.core import data as data_layer
from app.core.forecasting import compute_ols_forecast
from app.core.quality import assess_prototype_aggregate
from app.schemas import DistrictForecastResponse, LocationForecastResponse

router = APIRouter(prefix="/api/forecast", tags=["Forecasting"])


def _validated_forecast(years: list[int], scores: list[float], forecast_years: int) -> dict:
    try:
        return compute_ols_forecast(years=years, scores=scores, forecast_years=forecast_years)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/location/{location_id}", response_model=LocationForecastResponse)
def get_location_forecast(location_id: int, forecast_years: int = Query(default=3, ge=1, le=5)):
    """
    Returns multi-year historical trend and OLS linear regression forecast
    (slope, intercept, R-squared, projected scores) for one specific village/ward.
    """
    hist = data_layer.village_history(location_id)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No location found with location_id={location_id}")

    years = hist["Year"].tolist()
    scores = hist["Water_Stress_Score"].tolist()

    res = _validated_forecast(years, scores, forecast_years)
    res["location_id"] = location_id
    res["district"] = hist.iloc[-1]["District"]
    res["taluka"] = hist.iloc[-1]["Taluka"]
    res["village_ward"] = hist.iloc[-1]["Village_Ward"]
    res["supporting_record_count"] = len(hist)
    res["quality"] = assess_prototype_aggregate(int(years[-1]), data_layer.latest_year(), len(years))
    return res


@router.get("/district", response_model=DistrictForecastResponse)
def get_district_forecast(
    district: str = Query(default="Pune"),
    forecast_years: int = Query(default=3, ge=1, le=5),
    through_year: int | None = Query(default=None),
):
    """
    Returns district-wide yearly average water stress scores and OLS linear regression projection.
    """
    df = data_layer.filter_records(district=district)
    if through_year is not None:
        df = df[df.Year <= through_year]
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for district '{district}'")

    yearly = df.groupby("Year")["Water_Stress_Score"].mean().reset_index().sort_values("Year")
    years = yearly["Year"].tolist()
    scores = [round(float(s), 1) for s in yearly["Water_Stress_Score"].tolist()]

    res = _validated_forecast(years, scores, forecast_years)
    res["district"] = district
    res["supporting_record_count"] = len(df)
    res["quality"] = assess_prototype_aggregate(int(years[-1]), data_layer.latest_year(), len(years))
    return res
