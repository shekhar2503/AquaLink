"""
AquaLink Backend Test Suite
===========================
Tests engine scoring logic, standardized risk thresholds, score explainability,
OLS linear regression forecasting, IoT telemetry ingestion, and database operations.
"""

import sys
import json
from pathlib import Path
import pytest

# Ensure backend app is on sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core import engine
from app.core.forecasting import compute_ols_forecast
from app.routers.iot import IoTTelemetryPayload, ingest_telemetry, simulate_telemetry


def test_groundwater_stress_score():
    # Test normal inputs
    score = engine.groundwater_stress_score(stage_pct=65.0, fluctuation_m=3.0, trend="Stable")
    # 0.75 * (65/130*100) + 0.25 * (3/15*100) = 0.75*50 + 0.25*20 = 37.5 + 5.0 = 42.5
    assert score == 42.5

    # Test worsening trend bump (+6)
    score_worsening = engine.groundwater_stress_score(stage_pct=65.0, fluctuation_m=3.0, trend="Declining (Worsening)")
    assert score_worsening == 48.5

    # Test improving trend bump (-6)
    score_improving = engine.groundwater_stress_score(stage_pct=65.0, fluctuation_m=3.0, trend="Improving")
    assert score_improving == 36.5


def test_supply_gap_score():
    # 0.5 * (100 - 80) + 0.5 * (20) = 0.5*20 + 0.5*20 = 20.0
    score = engine.water_supply_gap_score(coverage_pct=80.0, supply_gap_pct=20.0)
    assert score == 20.0


def test_combined_water_stress_score():
    # GW=50, Supply=50 => 0.45*50 + 0.45*50 + 0.10*(2500/100) = 22.5 + 22.5 + 2.5 = 47.5
    score = engine.combined_water_stress_score(50.0, 50.0)
    assert score == 47.5


def test_risk_thresholds():
    """Verify AquaLink project-defined risk classification thresholds."""
    assert engine.risk_category(10.0) == "Low"
    assert engine.risk_category(24.9) == "Low"
    assert engine.risk_category(25.0) == "Moderate"
    assert engine.risk_category(44.9) == "Moderate"
    assert engine.risk_category(45.0) == "High"
    assert engine.risk_category(64.9) == "High"
    assert engine.risk_category(65.0) == "Critical"
    assert engine.risk_category(85.0) == "Critical"
    assert engine.risk_category(0.0) == "Low"
    assert engine.risk_category(100.0) == "Critical"


@pytest.mark.parametrize("value", [-0.1, 100.1, float("nan"), float("inf")])
def test_risk_category_rejects_invalid_values(value):
    with pytest.raises(ValueError):
        engine.risk_category(value)


def test_raw_indicator_clipping_and_trend_adjustments():
    assert engine.groundwater_stress_score(500, 500, "Stable") == 100.0
    assert engine.groundwater_stress_score(-10, -2, "Stable") == 0.0
    stable = engine.groundwater_stress_score(65, 3, "Stable")
    assert engine.groundwater_stress_score(65, 3, "Declining (Worsening)") == stable + 6
    assert engine.groundwater_stress_score(65, 3, "Improving") == stable - 6
    with pytest.raises(ValueError):
        engine.groundwater_stress_score(float("nan"), 3, "Stable")


@pytest.mark.parametrize(
    ("gw", "supply", "trend", "code", "priority"),
    [
        (45, 45, "Stable", "compound_stress", "urgent"),
        (45, 20, "Declining (Worsening)", "groundwater_declining", "urgent"),
        (45, 20, "Stable", "groundwater_stress", "high"),
        (20, 45, "Stable", "supply_gap", "high"),
        (20, 20, "Declining (Worsening)", "declining_trend", "medium"),
        (20, 20, "Improving", "monitor", "routine"),
    ],
)
def test_structured_recommendation_branches(gw, supply, trend, code, priority):
    recommendation = engine.recommendation_for(gw, supply, trend)
    assert recommendation.action_code == code
    assert recommendation.priority == priority
    assert recommendation.drivers
    assert recommendation.rationale
    assert recommendation.score_version == engine.SCORING_VERSION


def test_recommendation_rejects_invalid_inputs():
    with pytest.raises(ValueError):
        engine.recommendation_for(101, 20, "Stable")
    with pytest.raises(ValueError):
        engine.recommendation_for(20, 20, "Unknown")


def test_frontend_fallback_metadata_matches_engine():
    metadata_path = backend_dir.parents[1] / "aqualink-dashboard" / "public" / "aqualinkMetadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert metadata["scoring_version"] == engine.SCORING_VERSION
    assert metadata["risk_thresholds"] == engine.risk_thresholds_metadata()


def test_explain_score():
    indicators = engine.RawIndicators(
        gw_extraction_stage_pct=95.0,
        seasonal_fluctuation_m=9.0,
        gw_trend="Declining (Worsening)",
        piped_coverage_pct=60.0,
        supply_gap_pct=25.0,
    )
    explanation = engine.explain_score(indicators)
    assert "water_stress_score" in explanation
    assert explanation["risk_category"] in ["High", "Critical"]
    assert "breakdown" in explanation
    assert explanation["breakdown"]["groundwater_percentage_share"] > 0
    assert len(explanation["main_contributors"]) > 0
    breakdown = explanation["breakdown"]
    assert breakdown["unrounded_total"] == pytest.approx(
        breakdown["groundwater_contribution"]
        + breakdown["supply_gap_contribution"]
        + breakdown["interaction_contribution"]
    )
    assert explanation["recommendation"]["score_version"] == engine.SCORING_VERSION


def test_ols_linear_regression_forecast():
    years = [2020, 2021, 2022, 2023, 2024]
    scores = [30.0, 32.0, 34.0, 36.0, 38.0]
    forecast = compute_ols_forecast(years, scores, forecast_years=3)

    assert forecast["model_type"] == "Ordinary Least Squares linear trend"
    assert forecast["slope"] == 2.0
    assert forecast["r_squared"] == 1.0
    assert len(forecast["forecast_projected"]) == 3
    assert forecast["forecast_projected"][0]["year"] == 2025
    assert forecast["forecast_projected"][0]["projected_score"] == 40.0
    assert forecast["forecast_projected"][0]["lower_95"] <= 40.0 <= forecast["forecast_projected"][0]["upper_95"]
    assert set(forecast["backtest"]["results"]) == {"ols", "last_value", "historical_mean", "simple_trend"}
    assert forecast["backtest"]["selected_model"] in forecast["backtest"]["results"]


@pytest.mark.parametrize(
    ("years", "scores", "message"),
    [
        ([2022, 2023, 2024], [10, 11, 12], "At least 4"),
        ([2021, 2022, 2022, 2024], [10, 11, 12, 13], "unique"),
        ([2021, 2022, 2023, 2024], [10, 11, float("nan"), 13], "finite"),
        ([2021, 2022, 2023, 2024], [10, 11, 101, 13], "between 0 and 100"),
    ],
)
def test_forecast_minimum_data_validation(years, scores, message):
    with pytest.raises(ValueError, match=message):
        compute_ols_forecast(years, scores)


def test_backtest_tie_is_reported_deterministically():
    result = compute_ols_forecast([2020, 2021, 2022, 2023, 2024, 2025], [30, 30, 30, 30, 30, 30])
    assert result["backtest"]["selected_model"] == "ols"
    for metrics in result["backtest"]["results"].values():
        assert metrics["mae"] == 0
        assert metrics["rmse"] == 0


def test_iot_telemetry_ingestion_and_simulation(tmp_path, monkeypatch):
    from app.core.iot_repository import IoTRepository
    from app.routers import iot as iot_router
    monkeypatch.setattr(iot_router, "repository", IoTRepository(tmp_path / "iot-unit.db"))
    payload = IoTTelemetryPayload(
        device_id="SIM-TEST-ESP32-01",
        location_id=999,
        groundwater_level=12.5,
        pipeline_pressure=0.85,
        flow_rate=22.0,
        is_simulated=True,
    )
    res = ingest_telemetry(payload)
    assert res["status"] == "success"
    assert res["record"]["telemetry_status"] == "NORMAL"

    sim_res = simulate_telemetry(count=5)
    assert sim_res["status"] == "success"
    assert len(sim_res["telemetry_sample"]) == 5
