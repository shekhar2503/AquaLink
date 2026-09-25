"""HTTP integration tests for explicit AquaLink API failure contracts."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_unknown_location_returns_404():
    response = client.get("/village/99999999")
    assert response.status_code == 404
    assert "No village found" in response.json()["detail"]


def test_location_year_without_record_returns_404():
    response = client.get("/village/1?year=1999")
    assert response.status_code == 404
    assert "No record found" in response.json()["detail"]


def test_forecast_rejects_insufficient_history():
    response = client.get("/api/forecast/district?district=Pune&through_year=2022")
    assert response.status_code == 422
    assert "At least 4 historical observations" in response.json()["detail"]


def test_iot_payload_range_validation_returns_422():
    response = client.post("/api/iot/telemetry", json={
        "device_id": "GW-RANGE-001", "location_id": 1212,
        "groundwater_level": 151, "pipeline_pressure": 0.8, "flow_rate": 20,
        "source_type": "live_hardware",
    })
    assert response.status_code == 422


def test_unknown_district_forecast_returns_404():
    response = client.get("/api/forecast/district?district=Not-A-District")
    assert response.status_code == 404
