import test from "node:test";
import assert from "node:assert/strict";
import { normalizeForecastResponse } from "./forecastContract.js";

const backendPayload = {
  model_type: "Ordinary Least Squares linear trend", model_version: "aqualink-forecast-v2.0.0",
  description: "OLS", disclaimer: "Planning only", slope: -0.617, intercept: 1277.9, r_squared: 0.79,
  observation_count: 4, forecast_horizon: 3, baseline_year: 2025, interval_method: "Student-t",
  evidence_label: "OLS evidence", historical_fitted: [
    { year: 2022, actual_score: 30.1, fitted_score: 30.5 }, { year: 2023, actual_score: 30.4, fitted_score: 29.9 },
    { year: 2024, actual_score: 28.7, fitted_score: 29.3 }, { year: 2025, actual_score: 29.3, fitted_score: 28.7 },
  ],
  forecast_projected: [
    { year: 2026, projected_score: 28.2, lower_95: 25.0, upper_95: 31.4 },
    { year: 2027, projected_score: 27.6, lower_95: 23.4, upper_95: 31.8 },
    { year: 2028, projected_score: 27.0, lower_95: 21.7, upper_95: 32.3 },
  ],
  backtest: { method: "expanding", minimum_training_observations: 3, results: {}, selected_model: "ols", selection_metric: "rmse" },
  supporting_record_count: 1000,
  quality: { confidence: "Medium", quality_score: 70, supporting_observation_count: 6, dimensions: {}, reasons: [], indicators: [], missing_fields: [] },
};

test("frontend projections exactly preserve backend years, scores, and intervals", () => {
  const normalized = normalizeForecastResponse(backendPayload);
  assert.deepEqual(normalized.projections, [
    { year: 2026, projected: 28.2, lower95: 25, upper95: 31.4 },
    { year: 2027, projected: 27.6, lower95: 23.4, upper95: 31.8 },
    { year: 2028, projected: 27, lower95: 21.7, upper95: 32.3 },
  ]);
  assert.equal(normalized.quality.confidence, "Medium");
  assert.equal(normalized.supportingRecordCount, 1000);
});
