"""Validated OLS forecasting with prediction intervals and baseline back-testing."""

from __future__ import annotations

import math
import numpy as np

MIN_OBSERVATIONS = 4
MODEL_VERSION = "aqualink-forecast-v2.0.0"
MODEL_NAME = "Ordinary Least Squares linear trend"
PLANNING_DISCLAIMER = (
    "Statistical trend projection for planning only. It does not model rainfall, policy, "
    "infrastructure changes, or causal effects and should not be treated as a guaranteed outcome."
)

# Two-sided 95% Student-t critical values. Forecast series are small, so normal
# critical values would understate uncertainty.
T_975 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
         7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179,
         13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101,
         19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064,
         25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042}


def _validate_inputs(years: list[int], scores: list[float], forecast_years: int) -> tuple[np.ndarray, np.ndarray]:
    if len(years) != len(scores):
        raise ValueError("Years and scores must contain the same number of observations")
    if len(years) < MIN_OBSERVATIONS:
        raise ValueError(f"At least {MIN_OBSERVATIONS} historical observations are required")
    if not 1 <= forecast_years <= 5:
        raise ValueError("Forecast horizon must be between 1 and 5 years")
    x = np.asarray(years, dtype=float)
    y = np.asarray(scores, dtype=float)
    if not np.all(np.isfinite(x)) or not np.all(np.isfinite(y)):
        raise ValueError("Forecast inputs must be finite numbers")
    if len(np.unique(x)) != len(x) or not np.all(np.diff(x) > 0):
        raise ValueError("Historical years must be unique and strictly increasing")
    if np.any((y < 0) | (y > 100)):
        raise ValueError("Historical scores must be between 0 and 100")
    return x, y


def _fit_ols(x: np.ndarray, y: np.ndarray) -> tuple[float, float, np.ndarray, float]:
    slope, intercept = np.polyfit(x, y, 1)
    fitted = slope * x + intercept
    total = float(np.sum((y - np.mean(y)) ** 2))
    residual = float(np.sum((y - fitted) ** 2))
    r_squared = 1.0 - residual / total if total > 0 else 1.0
    return float(slope), float(intercept), fitted, max(0.0, min(1.0, r_squared))


def _metrics(actual: list[float], predicted: list[float]) -> dict:
    errors = np.asarray(predicted) - np.asarray(actual)
    return {
        "mae": round(float(np.mean(np.abs(errors))), 3),
        "rmse": round(float(np.sqrt(np.mean(errors ** 2))), 3),
        "test_observations": len(actual),
    }


def _backtest(x: np.ndarray, y: np.ndarray) -> dict:
    actual: list[float] = []
    predictions = {name: [] for name in ("ols", "last_value", "historical_mean", "simple_trend")}
    for index in range(3, len(x)):
        train_x, train_y = x[:index], y[:index]
        target_year = x[index]
        slope, intercept, _, _ = _fit_ols(train_x, train_y)
        actual.append(float(y[index]))
        predictions["ols"].append(float(slope * target_year + intercept))
        predictions["last_value"].append(float(train_y[-1]))
        predictions["historical_mean"].append(float(np.mean(train_y)))
        last_slope = float((train_y[-1] - train_y[-2]) / (train_x[-1] - train_x[-2]))
        predictions["simple_trend"].append(float(train_y[-1] + last_slope * (target_year - train_x[-1])))
    results = {name: _metrics(actual, values) for name, values in predictions.items()}
    selected = min(results, key=lambda name: (results[name]["rmse"], results[name]["mae"], name != "ols"))
    return {
        "method": "expanding-window one-step-ahead holdout",
        "minimum_training_observations": 3,
        "results": results,
        "selected_model": selected,
        "selection_metric": "rmse",
    }


def compute_ols_forecast(years: list[int], scores: list[float], forecast_years: int = 3) -> dict:
    x, y = _validate_inputs(years, scores, forecast_years)
    slope, intercept, fitted, r_squared = _fit_ols(x, y)
    residual_sum_squares = float(np.sum((y - fitted) ** 2))
    residual_std_error = math.sqrt(residual_sum_squares / (len(x) - 2))
    x_mean = float(np.mean(x))
    sxx = float(np.sum((x - x_mean) ** 2))
    critical = T_975.get(len(x) - 2, 1.96)

    historical_fitted = [
        {"year": int(year), "actual_score": round(float(actual), 1), "fitted_score": round(float(fit), 1)}
        for year, actual, fit in zip(x, y, fitted)
    ]
    baseline_year = int(x[-1])
    projected = []
    for step in range(1, forecast_years + 1):
        year = baseline_year + step
        estimate = slope * year + intercept
        prediction_se = residual_std_error * math.sqrt(1 + 1 / len(x) + ((year - x_mean) ** 2 / sxx))
        margin = critical * prediction_se
        projected.append({
            "year": year,
            "projected_score": round(float(np.clip(estimate, 0, 100)), 1),
            "lower_95": round(float(np.clip(estimate - margin, 0, 100)), 1),
            "upper_95": round(float(np.clip(estimate + margin, 0, 100)), 1),
        })

    backtest = _backtest(x, y)
    selected = backtest["selected_model"]
    return {
        "model_type": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "description": "OLS linear trend fitted to annual mean water-stress observations.",
        "disclaimer": PLANNING_DISCLAIMER,
        "slope": round(slope, 3),
        "intercept": round(intercept, 3),
        "r_squared": round(r_squared, 3),
        "observation_count": len(x),
        "forecast_horizon": forecast_years,
        "baseline_year": baseline_year,
        "interval_method": "95% OLS prediction interval using Student-t residual uncertainty",
        "historical_fitted": historical_fitted,
        "forecast_projected": projected,
        "backtest": backtest,
        "evidence_label": (
            "OLS has the lowest expanding-window RMSE among evaluated models."
            if selected == "ols" else
            f"{selected.replace('_', ' ').title()} has lower expanding-window RMSE than OLS; OLS is shown as a transparent trend scenario."
        ),
    }
