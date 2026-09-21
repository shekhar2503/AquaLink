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

router = APIRouter(prefix="/api/forecast", tags=["Forecasting"])


@router.get("/location/{location_id}")
def get_location_forecast(location_id: int, forecast_years: int = Query(default=3, le=5)):
    """
    Returns multi-year historical trend and OLS linear regression forecast
    (slope, intercept, R-squared, projected scores) for one specific village/ward.
    """
    hist = data_layer.village_history(location_id)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No location found with location_id={location_id}")

    years = hist["Year"].tolist()
    scores = hist["Water_Stress_Score"].tolist()

    res = compute_ols_forecast(years=years, scores=scores, forecast_years=forecast_years)
    res["location_id"] = location_id
    res["district"] = hist.iloc[-1]["District"]
    res["taluka"] = hist.iloc[-1]["Taluka"]
    res["village_ward"] = hist.iloc[-1]["Village_Ward"]
    return res


@router.get("/district")
def get_district_forecast(
    district: str = Query(default="Pune"),
    forecast_years: int = Query(default=3, le=5),
):
    """
    Returns district-wide yearly average water stress scores and OLS linear regression projection.
    """
    df = data_layer.filter_records(district=district)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for district '{district}'")

    yearly = df.groupby("Year")["Water_Stress_Score"].mean().reset_index().sort_values("Year")
    years = yearly["Year"].tolist()
    scores = [round(float(s), 1) for s in yearly["Water_Stress_Score"].tolist()]

    res = compute_ols_forecast(years=years, scores=scores, forecast_years=forecast_years)
    res["district"] = district
    return res
