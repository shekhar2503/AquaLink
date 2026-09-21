"""
AquaLink Backend Standard Library Test Suite
============================================
Runs unit tests using Python's standard unittest framework.
"""

import sys
import unittest
from pathlib import Path

# Ensure backend app directory is on path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core import engine
from app.core.forecasting import compute_ols_forecast
from app.routers.iot import IoTTelemetryPayload, ingest_telemetry, toggle_simulation


class TestAquaLinkBackend(unittest.TestCase):

    def test_groundwater_stress_score(self):
        score = engine.groundwater_stress_score(stage_pct=65.0, fluctuation_m=3.0, trend="Stable")
        self.assertEqual(score, 42.5)

        score_worsening = engine.groundwater_stress_score(stage_pct=65.0, fluctuation_m=3.0, trend="Declining (Worsening)")
        self.assertEqual(score_worsening, 48.5)

        score_improving = engine.groundwater_stress_score(stage_pct=65.0, fluctuation_m=3.0, trend="Improving")
        self.assertEqual(score_improving, 36.5)

    def test_supply_gap_score(self):
        score = engine.water_supply_gap_score(coverage_pct=80.0, supply_gap_pct=20.0)
        self.assertEqual(score, 20.0)

    def test_combined_water_stress_score(self):
        score = engine.combined_water_stress_score(50.0, 50.0)
        self.assertEqual(score, 47.5)

    def test_risk_thresholds(self):
        self.assertEqual(engine.risk_category(10.0), "Low")
        self.assertEqual(engine.risk_category(24.9), "Low")
        self.assertEqual(engine.risk_category(25.0), "Moderate")
        self.assertEqual(engine.risk_category(44.9), "Moderate")
        self.assertEqual(engine.risk_category(45.0), "High")
        self.assertEqual(engine.risk_category(64.9), "High")
        self.assertEqual(engine.risk_category(65.0), "Critical")
        self.assertEqual(engine.risk_category(85.0), "Critical")

    def test_explain_score(self):
        indicators = engine.RawIndicators(
            gw_extraction_stage_pct=95.0,
            seasonal_fluctuation_m=9.0,
            gw_trend="Declining (Worsening)",
            piped_coverage_pct=60.0,
            supply_gap_pct=25.0,
        )
        explanation = engine.explain_score(indicators)
        self.assertIn("water_stress_score", explanation)
        self.assertIn(explanation["risk_category"], ["High", "Critical"])
        self.assertIn("breakdown", explanation)
        self.assertGreater(explanation["breakdown"]["groundwater_percentage_share"], 0)
        self.assertGreater(len(explanation["main_contributors"]), 0)

    def test_ols_linear_regression_forecast(self):
        years = [2020, 2021, 2022, 2023, 2024]
        scores = [30.0, 32.0, 34.0, 36.0, 38.0]
        forecast = compute_ols_forecast(years, scores, forecast_years=3)

        self.assertEqual(forecast["model_type"], "Statistical Linear Regression Trend Forecast")
        self.assertEqual(forecast["slope"], 2.0)
        self.assertEqual(forecast["r_squared"], 1.0)
        self.assertEqual(len(forecast["forecast_projected"]), 3)
        self.assertEqual(forecast["forecast_projected"][0]["year"], 2025)
        self.assertEqual(forecast["forecast_projected"][0]["projected_score"], 40.0)

    def test_iot_telemetry_ingestion_and_simulation(self):
        payload = IoTTelemetryPayload(
            device_id="TEST_ESP32_01",
            location_id=999,
            groundwater_level=12.5,
            pipeline_pressure=0.85,
            flow_rate=22.0,
            is_simulated=True,
        )
        res = ingest_telemetry(payload)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["record"]["status"], "NORMAL")

        sim_res = toggle_simulation(count=5)
        self.assertEqual(sim_res["status"], "success")
        self.assertEqual(len(sim_res["telemetry_sample"]), 5)


if __name__ == "__main__":
    unittest.main()
