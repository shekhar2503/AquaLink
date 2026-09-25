import { normalizeQuality } from "./dataContract.js";

function number(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`Forecast ${field} must be a finite number`);
  return parsed;
}

export function normalizeForecastResponse(payload) {
  if (!payload || typeof payload !== "object") throw new TypeError("Forecast response must be an object");
  if (!Array.isArray(payload.historical_fitted) || payload.historical_fitted.length < 4) {
    throw new TypeError("Forecast response requires at least four historical observations");
  }
  if (!Array.isArray(payload.forecast_projected)) throw new TypeError("Forecast response is missing forecast_projected");
  return {
    source: "api",
    modelName: payload.model_type,
    modelVersion: payload.model_version,
    description: payload.description,
    disclaimer: payload.disclaimer,
    slope: number(payload.slope, "slope"),
    intercept: number(payload.intercept, "intercept"),
    rSquared: number(payload.r_squared, "r_squared"),
    observationCount: number(payload.observation_count, "observation_count"),
    forecastHorizon: number(payload.forecast_horizon, "forecast_horizon"),
    baselineYear: number(payload.baseline_year, "baseline_year"),
    intervalMethod: payload.interval_method,
    evidenceLabel: payload.evidence_label,
    historical: payload.historical_fitted.map((point) => ({
      year: number(point.year, "historical year"), actual: number(point.actual_score, "actual_score"),
      fitted: number(point.fitted_score, "fitted_score"),
    })),
    projections: payload.forecast_projected.map((point) => ({
      year: number(point.year, "projection year"), projected: number(point.projected_score, "projected_score"),
      lower95: number(point.lower_95, "lower_95"), upper95: number(point.upper_95, "upper_95"),
    })),
    backtest: payload.backtest,
    supportingRecordCount: number(payload.supporting_record_count, "supporting_record_count"),
    quality: normalizeQuality(payload.quality, "Forecast quality"),
  };
}

export function historicalOnlyFallback(records, reason) {
  if (records.length < 4) throw new TypeError("Fallback history requires at least four annual observations");
  return {
    source: "fallback_historical_only", modelName: "No fallback forecast model", modelVersion: null,
    description: "Bundled CSV observations only; projections require the backend forecasting service.",
    disclaimer: `Forecast unavailable in fallback mode. ${reason}`,
    slope: null, intercept: null, rSquared: null, observationCount: records.length, forecastHorizon: 0,
    baselineYear: records.at(-1).Year, intervalMethod: null,
    evidenceLabel: "No projection is shown because reproducing a second forecasting engine in React could diverge from the backend.",
    historical: records.map((row) => ({ year: row.Year, actual: row.Water_Stress_Score, fitted: null })),
    projections: [], backtest: null, supportingRecordCount: records.reduce((sum, row) => sum + (row.Record_Count ?? 0), 0), quality: null,
  };
}
