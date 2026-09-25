"""Repository layer for persistent IoT devices and telemetry readings."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core import db

STALE_AFTER = timedelta(minutes=15)


class LocationNotFoundError(ValueError):
    pass


class DuplicateTelemetryError(ValueError):
    pass


class DeviceConflictError(ValueError):
    pass


def battery_state(voltage: float | None) -> str:
    if voltage is None:
        return "unknown"
    if voltage < 3.3:
        return "critical"
    if voltage < 3.55:
        return "low"
    return "good"


def device_health(telemetry_status: str, battery: str, observed_at: datetime, now: datetime | None = None) -> str:
    reference = now or datetime.now(timezone.utc)
    if reference - observed_at > STALE_AFTER:
        return "stale"
    if battery == "critical" or telemetry_status == "CRITICAL_DEPLETION":
        return "critical"
    if battery == "low" or telemetry_status in {"LOW_PRESSURE_WARNING", "NO_FLOW"}:
        return "warning"
    return "healthy"


class IoTRepository:
    def __init__(self, db_path: str | Path | None = None):
        self.db_path = db_path

    def initialize(self) -> None:
        db.init_db(self.db_path)

    def location_exists(self, location_id: int) -> bool:
        with db.get_connection(self.db_path) as conn:
            return conn.execute("SELECT 1 FROM locations WHERE location_id = ?", (location_id,)).fetchone() is not None

    def sample_location_ids(self, count: int, district: str = "Pune") -> list[int]:
        self.initialize()
        with db.get_connection(self.db_path) as conn:
            rows = conn.execute(
                "SELECT location_id FROM locations WHERE lower(district) = lower(?) ORDER BY location_id LIMIT ?",
                (district, count),
            ).fetchall()
        return [int(row["location_id"]) for row in rows]

    def save_reading(self, reading: dict) -> dict:
        self.initialize()
        if not self.location_exists(reading["location_id"]):
            raise LocationNotFoundError(f"Unknown location_id {reading['location_id']}")
        observed = reading["observed_at"].astimezone(timezone.utc)
        received = reading["received_at"].astimezone(timezone.utc)
        observed_text, received_text = observed.isoformat(), received.isoformat()
        battery = battery_state(reading["battery_voltage"])
        health = device_health(reading["telemetry_status"], battery, observed, received)
        try:
            with db.get_connection(self.db_path) as conn:
                device = conn.execute("SELECT location_id, source_type FROM iot_devices WHERE device_id = ?", (reading["device_id"],)).fetchone()
                if device and (device["location_id"] != reading["location_id"] or device["source_type"] != reading["source_type"]):
                    raise DeviceConflictError("A device cannot change location or source type after registration")
                conn.execute("""
                    INSERT INTO iot_devices
                    (device_id, location_id, source_type, registered_at, last_seen_at, battery_voltage, battery_state, device_health, telemetry_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(device_id) DO UPDATE SET
                        last_seen_at=MAX(iot_devices.last_seen_at, excluded.last_seen_at),
                        battery_voltage=CASE WHEN excluded.last_seen_at >= iot_devices.last_seen_at THEN excluded.battery_voltage ELSE iot_devices.battery_voltage END,
                        battery_state=CASE WHEN excluded.last_seen_at >= iot_devices.last_seen_at THEN excluded.battery_state ELSE iot_devices.battery_state END,
                        device_health=CASE WHEN excluded.last_seen_at >= iot_devices.last_seen_at THEN excluded.device_health ELSE iot_devices.device_health END,
                        telemetry_status=CASE WHEN excluded.last_seen_at >= iot_devices.last_seen_at THEN excluded.telemetry_status ELSE iot_devices.telemetry_status END
                """, (reading["device_id"], reading["location_id"], reading["source_type"], received_text,
                      observed_text, reading["battery_voltage"], battery, health, reading["telemetry_status"]))
                cursor = conn.execute("""
                    INSERT INTO iot_telemetry
                    (device_id, location_id, groundwater_level, pipeline_pressure, flow_rate,
                     battery_voltage, telemetry_status, source_type, observed_at, received_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (reading["device_id"], reading["location_id"], reading["groundwater_level"],
                      reading["pipeline_pressure"], reading["flow_rate"], reading["battery_voltage"],
                      reading["telemetry_status"], reading["source_type"], observed_text, received_text))
                reading_id = cursor.lastrowid
        except sqlite3.IntegrityError as error:
            if "UNIQUE constraint failed" in str(error):
                raise DuplicateTelemetryError("Duplicate device_id and observed_at timestamp") from error
            raise
        return self.get_reading(reading_id)

    def get_reading(self, reading_id: int) -> dict:
        with db.get_connection(self.db_path) as conn:
            row = conn.execute("SELECT * FROM iot_telemetry WHERE id = ?", (reading_id,)).fetchone()
        return self._reading_dict(row)

    @staticmethod
    def _reading_dict(row: sqlite3.Row) -> dict:
        return {
            "reading_id": row["id"], "device_id": row["device_id"], "location_id": row["location_id"],
            "groundwater_level_mbgl": row["groundwater_level"], "pipeline_pressure_bar": row["pipeline_pressure"],
            "flow_rate_lpm": row["flow_rate"], "battery_voltage": row["battery_voltage"],
            "telemetry_status": row["telemetry_status"], "source_type": row["source_type"],
            "is_simulated": row["source_type"] == "simulation", "observed_at": row["observed_at"],
            "received_at": row["received_at"],
        }

    def latest_devices(self, source_type: str, location_id: int | None = None, now: datetime | None = None) -> list[dict]:
        self.initialize()
        where, params = [], []
        if source_type != "all":
            where.append("d.source_type = ?")
            params.append(source_type)
        if location_id is not None:
            where.append("d.location_id = ?")
            params.append(location_id)
        clause = " WHERE " + " AND ".join(where) if where else ""
        query = f"""
            SELECT d.*, t.id AS reading_id, t.groundwater_level, t.pipeline_pressure,
                   t.flow_rate, t.observed_at, t.received_at
            FROM iot_devices d
            JOIN iot_telemetry t ON t.id = (
                SELECT id FROM iot_telemetry latest
                WHERE latest.device_id = d.device_id
                ORDER BY latest.observed_at DESC, latest.id DESC LIMIT 1
            ){clause}
            ORDER BY d.last_seen_at DESC
        """
        reference = now or datetime.now(timezone.utc)
        with db.get_connection(self.db_path) as conn:
            rows = conn.execute(query, params).fetchall()
        devices = []
        for row in rows:
            observed = datetime.fromisoformat(row["observed_at"])
            health = device_health(row["telemetry_status"], row["battery_state"], observed, reference)
            devices.append({
                "device_id": row["device_id"], "location_id": row["location_id"], "source_type": row["source_type"],
                "is_simulated": row["source_type"] == "simulation", "device_health": health,
                "last_seen": row["last_seen_at"], "battery_voltage": row["battery_voltage"],
                "battery_state": row["battery_state"], "telemetry_status": row["telemetry_status"],
                "latest_reading": {
                    "reading_id": row["reading_id"], "groundwater_level_mbgl": row["groundwater_level"],
                    "pipeline_pressure_bar": row["pipeline_pressure"], "flow_rate_lpm": row["flow_rate"],
                    "observed_at": row["observed_at"], "received_at": row["received_at"],
                },
            })
        return devices
