"""Persistence and validation tests for the SQLite IoT layer."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core import db
from app.core.iot_repository import IoTRepository
from app.main import app
from app.routers import iot

client = TestClient(app)


@pytest.fixture(scope="module")
def persistent_db(tmp_path_factory):
    path = tmp_path_factory.mktemp("iot") / "iot-test.db"
    IoTRepository(path).initialize()
    return path


@pytest.fixture(autouse=True)
def isolated_repository(monkeypatch, persistent_db):
    repo = IoTRepository(persistent_db)
    monkeypatch.setattr(iot, "repository", repo)
    return repo


def pune_location(repository: IoTRepository) -> int:
    return repository.sample_location_ids(1, "Pune")[0]


def payload(device_id: str, location_id: int, timestamp: datetime, **overrides):
    data = {
        "device_id": device_id, "location_id": location_id,
        "groundwater_level": 12.5, "pipeline_pressure": 0.85,
        "flow_rate": 22.0, "battery_voltage": 3.7,
        "source_type": "live_hardware", "timestamp": timestamp.isoformat(),
    }
    data.update(overrides)
    return data


def test_reading_survives_repository_restart(isolated_repository, persistent_db):
    location_id = pune_location(isolated_repository)
    observed = datetime.now(timezone.utc)
    response = client.post("/api/iot/telemetry", json=payload("GW-PERSIST-001", location_id, observed))
    assert response.status_code == 200

    restarted_repository = IoTRepository(persistent_db)
    devices = restarted_repository.latest_devices("live_hardware", location_id)
    assert devices[0]["device_id"] == "GW-PERSIST-001"
    assert devices[0]["latest_reading"]["groundwater_level_mbgl"] == 12.5


def test_invalid_location_and_device_identifier_are_rejected(isolated_repository):
    now = datetime.now(timezone.utc)
    unknown = client.post("/api/iot/telemetry", json=payload("GW-UNKNOWN-001", 99999999, now))
    malformed = client.post("/api/iot/telemetry", json=payload("bad device!", pune_location(isolated_repository), now))
    assert unknown.status_code == 404
    assert malformed.status_code == 422


def test_duplicate_device_timestamp_is_rejected(isolated_repository):
    location_id = pune_location(isolated_repository)
    observed = datetime.now(timezone.utc)
    body = payload("GW-DUPLICATE-001", location_id, observed)
    assert client.post("/api/iot/telemetry", json=body).status_code == 200
    duplicate = client.post("/api/iot/telemetry", json=body)
    assert duplicate.status_code == 409
    assert "Duplicate" in duplicate.json()["detail"]


def test_stale_device_and_battery_state_are_reported(isolated_repository):
    location_id = pune_location(isolated_repository)
    observed = datetime.now(timezone.utc) - timedelta(hours=1)
    response = client.post("/api/iot/telemetry", json=payload(
        "GW-STALE-001", location_id, observed, battery_voltage=3.4,
    ))
    assert response.status_code == 200
    live = client.get(f"/api/iot/live?location_id={location_id}&source_type=live_hardware").json()
    stale = next(device for device in live["devices"] if device["device_id"] == "GW-STALE-001")
    assert stale["device_health"] == "stale"
    assert stale["battery_state"] == "low"
    assert live["stale_devices_count"] >= 1


def test_simulation_is_separate_from_live_hardware(isolated_repository):
    location_id = pune_location(isolated_repository)
    now = datetime.now(timezone.utc)
    simulated = payload("SIM-TEST-009", location_id, now, source_type="simulation", is_simulated=True)
    assert client.post("/api/iot/telemetry", json=simulated).status_code == 200
    live_ids = {item["device_id"] for item in client.get("/api/iot/live?source_type=live_hardware").json()["devices"]}
    simulated_ids = {item["device_id"] for item in client.get("/api/iot/live?source_type=simulation").json()["devices"]}
    assert "SIM-TEST-009" not in live_ids
    assert "SIM-TEST-009" in simulated_ids


def test_timestamp_boundaries_are_validated(isolated_repository):
    location_id = pune_location(isolated_repository)
    future = datetime.now(timezone.utc) + timedelta(minutes=6)
    old = datetime.now(timezone.utc) - timedelta(days=8)
    assert client.post("/api/iot/telemetry", json=payload("GW-FUTURE-001", location_id, future)).status_code == 422
    assert client.post("/api/iot/telemetry", json=payload("GW-OLD-001", location_id, old)).status_code == 422


def test_legacy_schema_is_preserved_during_migration(tmp_path):
    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE iot_telemetry (id INTEGER PRIMARY KEY, device_id TEXT, timestamp TEXT)")
        conn.execute("INSERT INTO iot_telemetry VALUES (1, 'OLD-001', '2025-01-01T00:00:00+00:00')")
    db.init_db(path)
    with db.get_connection(path) as conn:
        tables = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(iot_telemetry)")}
        assert "iot_telemetry_legacy" in tables
        assert conn.execute("SELECT COUNT(*) FROM iot_telemetry_legacy").fetchone()[0] == 1
        assert {"observed_at", "received_at", "source_type"}.issubset(columns)
