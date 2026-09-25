"""
AquaLink FastAPI Integration Test Suite
======================================
Tests all REST API endpoints using FastAPI TestClient.
"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.core.iot_repository import IoTRepository
from app.routers import iot as iot_router

client = TestClient(app)


class TestAquaLinkAPI(unittest.TestCase):

    def test_root_endpoint(self):
        res = client.get("/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("risk_thresholds", data)

    def test_health_endpoint(self):
        res = client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertGreater(data["rows_loaded"], 0)

    def test_metadata_contract(self):
        res = client.get("/metadata")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["latest_year"], 2025)
        self.assertTrue(data["synthetic"])
        self.assertEqual(data["scoring_version"], "aqualink-score-v1.1.0")
        self.assertEqual(data["risk_thresholds"]["High"]["minimum"], 45)
        self.assertTrue(data["risk_thresholds"]["Critical"]["maximum_inclusive"])
        self.assertEqual(data["quality_methodology"]["version"], "aqualink-quality-v1.0.0")
        self.assertEqual(data["quality_methodology"]["simulated_confidence_cap"], "Medium")

    def test_districts_endpoint(self):
        res = client.get("/districts")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("districts", data)
        self.assertIn("Pune", data["districts"])

    def test_districts_summary(self):
        res = client.get("/districts/summary?year=2024")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["count"], 0)

    def test_hotspots_endpoint(self):
        res = client.get("/hotspots?district=Pune&limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 10)
        record = data["results"][0]
        self.assertIn("year", record)
        self.assertIn("gw_extraction_stage_pct", record)
        self.assertIn("recommended_action", record)
        self.assertEqual(record["score_version"], "aqualink-score-v1.1.0")
        self.assertIn("action_code", record["recommendation"])
        self.assertIn("rationale", record["recommendation"])
        self.assertTrue(record["geography_id"].startswith("syn-location-"))
        self.assertTrue(record["area_group_id"].startswith("syn-area-"))
        self.assertEqual(record["geography_source_status"], "synthetic_unverified")
        self.assertNotIn("Water_Stress_Score", record)
        self.assertIn(record["quality"]["confidence"], ["High", "Medium", "Low"])
        self.assertEqual(record["quality"]["supporting_observation_count"], 6)
        self.assertIn("simulated_not_observed", record["quality"]["indicators"])
        self.assertGreaterEqual(data["supporting_observation_count"], data["count"])

    def test_hotspots_respect_selected_year(self):
        res = client.get("/hotspots?district=Pune&year=2022&limit=250")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["count"], 0)
        self.assertTrue(all(record["year"] == 2022 for record in data["results"]))

    def test_rankings_endpoint(self):
        res = client.get("/rankings?district=Pune&top=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 5)
        self.assertIn("water_stress_score", data["results"][0])

    def test_response_models_are_in_openapi(self):
        schemas = client.get("/openapi.json").json()["components"]["schemas"]
        for name in ["MetadataResponse", "HotspotsResponse", "RankingsResponse", "DistrictSummariesResponse", "LocationForecastResponse", "DistrictForecastResponse", "QualityAssessment"]:
            self.assertIn(name, schemas)

    def test_village_explain(self):
        res = client.get("/village/1/explain")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("water_stress_score", data)
        self.assertIn("breakdown", data)

    def test_village_detail_and_explanation_respect_selected_year(self):
        detail = client.get("/village/1?year=2022")
        explanation = client.get("/village/1/explain?year=2022")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(explanation.status_code, 200)
        self.assertEqual(detail.json()["latest_year"], 2022)
        self.assertEqual(explanation.json()["year"], 2022)

    def test_forecast_district_ols(self):
        res = client.get("/api/forecast/district?district=Pune")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["model_type"], "Ordinary Least Squares linear trend")
        self.assertIn("slope", data)
        self.assertIn("r_squared", data)
        self.assertEqual(len(data["forecast_projected"]), 3)
        self.assertEqual(data["observation_count"], 6)
        self.assertEqual(data["baseline_year"], 2025)
        self.assertIn("backtest", data)
        self.assertIn("lower_95", data["forecast_projected"][0])
        self.assertEqual(data["quality"]["confidence"], "Medium")
        self.assertEqual(data["quality"]["supporting_observation_count"], 6)
        self.assertEqual(data["supporting_record_count"], 1500)

    def test_forecast_respects_through_year(self):
        res = client.get("/api/forecast/district?district=Pune&through_year=2023")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["baseline_year"], 2023)
        self.assertEqual(data["observation_count"], 4)
        self.assertEqual(data["historical_fitted"][-1]["year"], 2023)

    def test_iot_telemetry_and_simulation(self):
        temp_dir = tempfile.mkdtemp(prefix="aqualink-iot-test-")
        isolated = IoTRepository(Path(temp_dir) / "iot-api.db")
        with patch.object(iot_router, "repository", isolated):
            sim_res = client.post("/api/iot/simulate?count=5")
            self.assertEqual(sim_res.status_code, 200)
            self.assertTrue(sim_res.json()["simulation_active"])

            live_res = client.get("/api/iot/live?source_type=simulation")
            self.assertEqual(live_res.status_code, 200)
            self.assertGreaterEqual(live_res.json()["active_devices_count"], 5)


if __name__ == "__main__":
    unittest.main()
