"""
AquaLink Forecasting Module
===========================
Provides Ordinary Least Squares (OLS) Linear Regression statistical trend
forecasting over multi-year historical observations.

Model Name: Statistical Linear Regression Trend Forecast
"""

from __future__ import annotations
import numpy as np


def compute_ols_forecast(years: list[int], scores: list[float], forecast_years: int = 3) -> dict:
    """
    Computes OLS Linear Regression for a given historical series of years and scores.
    Returns slope, intercept, R-squared, historical fitted values, and projected scores.
    """
    if len(years) < 2 or len(scores) < 2:
        last_year = years[-1] if years else 2024
        last_score = scores[-1] if scores else 50.0
        return {
            "model_type": "Statistical Linear Regression Trend Forecast",
            "disclaimer": "Statistical trend projection for planning purposes",
            "slope": 0.0,
            "intercept": float(last_score),
            "r_squared": 0.0,
            "historical_fitted": [{"year": y, "score": float(s)} for y, s in zip(years, scores)],
            "forecast_projected": [
                {"year": last_year + i, "score": float(last_score)} for i in range(1, forecast_years + 1)
            ],
        }

    x = np.array(years, dtype=float)
    y = np.array(scores, dtype=float)

    n = len(x)
    sum_x = np.sum(x)
    sum_y = np.sum(y)
    sum_xy = np.sum(x * y)
    sum_x2 = np.sum(x ** 2)

    denominator = n * sum_x2 - sum_x ** 2
    if denominator == 0:
        slope = 0.0
        intercept = float(np.mean(y))
    else:
        slope = float((n * sum_xy - sum_x * sum_y) / denominator)
        intercept = float((sum_y - slope * sum_x) / n)

    # Calculate R-squared
    y_pred = slope * x + intercept
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    ss_res = float(np.sum((y - y_pred) ** 2))
    r_squared = float(round(1.0 - (ss_res / ss_tot), 3)) if ss_tot > 0 else 1.0

    historical_fitted = [
        {"year": int(yr), "actual_score": round(float(act), 1), "fitted_score": round(float(pred), 1)}
        for yr, act, pred in zip(x, y, y_pred)
    ]

    last_year = int(max(years))
    forecast_projected = []
    for i in range(1, forecast_years + 1):
        future_year = last_year + i
        proj_score = float(np.clip(slope * future_year + intercept, 0.0, 100.0))
        forecast_projected.append({
            "year": future_year,
            "projected_score": round(proj_score, 1),
        })

    return {
        "model_type": "Statistical Linear Regression Trend Forecast",
        "description": "Ordinary Least Squares (OLS) multi-year linear trend regression model",
        "disclaimer": "Statistical trend projection for planning purposes — does not overclaim AI precision",
        "slope": round(slope, 3),
        "intercept": round(intercept, 3),
        "r_squared": max(0.0, min(1.0, r_squared)),
        "historical_fitted": historical_fitted,
        "forecast_projected": forecast_projected,
    }
