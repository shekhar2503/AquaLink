"""
AquaLink FastAPI Integration Test Suite
======================================
Tests all REST API endpoints using FastAPI TestClient.
"""

import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

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

    def test_rankings_endpoint(self):
        res = client.get("/rankings?district=Pune&top=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 5)

    def test_village_explain(self):
        res = client.get("/village/1/explain")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("water_stress_score", data)
        self.assertIn("breakdown", data)

    def test_forecast_district_ols(self):
        res = client.get("/api/forecast/district?district=Pune")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["model_type"], "Statistical Linear Regression Trend Forecast")
        self.assertIn("slope", data)
        self.assertIn("r_squared", data)
        self.assertEqual(len(data["forecast_projected"]), 3)

    def test_iot_telemetry_and_simulation(self):
        # Test simulation endpoint
        sim_res = client.post("/api/iot/simulate?count=5")
        self.assertEqual(sim_res.status_code, 200)
        self.assertTrue(sim_res.json()["simulation_active"])

        # Test live telemetry endpoint
        live_res = client.get("/api/iot/live")
        self.assertEqual(live_res.status_code, 200)
        self.assertGreaterEqual(live_res.json()["active_devices_count"], 5)


if __name__ == "__main__":
    unittest.main()
