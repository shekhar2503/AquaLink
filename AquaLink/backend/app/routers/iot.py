"""Persistent SQLite-backed IoT telemetry API.

HTTP ingestion is implemented. No MQTT broker, LoRaWAN server, or live hardware
connection is claimed by this module.
"""

from __future__ import annotations

import random
import re
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from app.core.iot_repository import (
    DeviceConflictError,
    DuplicateTelemetryError,
    IoTRepository,
    LocationNotFoundError,
)

router = APIRouter(prefix="/api/iot", tags=["IoT Integration"])
repository = IoTRepository()
DEVICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{2,63}$")
MAX_FUTURE_SKEW = timedelta(minutes=5)
MAX_READING_AGE = timedelta(days=7)


class IoTTelemetryPayload(BaseModel):
    device_id: str = Field(min_length=3, max_length=64, examples=["GW-PUNE-001"])
    location_id: int = Field(gt=0, examples=[101])
    groundwater_level: float = Field(ge=0.0, le=150.0, description="Depth to water table in mbgl")
    pipeline_pressure: float = Field(ge=0.0, le=15.0, description="Pipeline pressure in bar")
    flow_rate: float = Field(ge=0.0, le=1000.0, description="Water flow rate in L/min")
    battery_voltage: float | None = Field(default=None, ge=0.0, le=5.0)
    source_type: Literal["live_hardware", "simulation"] | None = None
    is_simulated: bool | None = Field(default=None, description="Compatibility field; source_type is authoritative")
    timestamp: datetime | None = None

    @model_validator(mode="after")
    def validate_identity_and_source(self):
        if not DEVICE_ID_PATTERN.fullmatch(self.device_id):
            raise ValueError("device_id must use 3-64 letters, numbers, dots, colons, underscores, or hyphens")
        derived = "simulation" if self.is_simulated else "live_hardware"
        if self.source_type is not None and self.is_simulated is not None and self.source_type != derived:
            raise ValueError("source_type and is_simulated disagree")
        source = self.source_type or derived
        if source == "simulation" and not self.device_id.startswith("SIM-"):
            raise ValueError("simulation device_id values must start with 'SIM-'")
        if source == "live_hardware" and self.device_id.startswith("SIM-"):
            raise ValueError("live hardware device_id values cannot start with 'SIM-'")
        self.source_type = source
        self.is_simulated = source == "simulation"
        if self.timestamp is not None and self.timestamp.tzinfo is None:
            raise ValueError("timestamp must include a timezone offset")
        return self


def _telemetry_status(payload: IoTTelemetryPayload) -> str:
    if payload.groundwater_level > 100.0:
        return "CRITICAL_DEPLETION"
    if payload.pipeline_pressure < 0.2:
        return "LOW_PRESSURE_WARNING"
    if payload.flow_rate == 0.0:
        return "NO_FLOW"
    return "NORMAL"


def ingest_telemetry(payload: IoTTelemetryPayload):
    """Validate and persist one HTTP telemetry reading in SQLite."""
    received_at = datetime.now(timezone.utc)
    observed_at = (payload.timestamp or received_at).astimezone(timezone.utc)
    if observed_at > received_at + MAX_FUTURE_SKEW:
        raise HTTPException(status_code=422, detail="timestamp is more than 5 minutes in the future")
    if observed_at < received_at - MAX_READING_AGE:
        raise HTTPException(status_code=422, detail="timestamp is more than 7 days old")
    try:
        record = repository.save_reading({
            "device_id": payload.device_id, "location_id": payload.location_id,
            "groundwater_level": payload.groundwater_level,
            "pipeline_pressure": payload.pipeline_pressure, "flow_rate": payload.flow_rate,
            "battery_voltage": payload.battery_voltage, "source_type": payload.source_type,
            "telemetry_status": _telemetry_status(payload), "observed_at": observed_at,
            "received_at": received_at,
        })
    except LocationNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except DuplicateTelemetryError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except DeviceConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"status": "success", "message": "Telemetry persisted in SQLite", "record": record}


@router.post("/telemetry")
def ingest_telemetry_endpoint(payload: IoTTelemetryPayload):
    return ingest_telemetry(payload)


@router.post("/simulate")
def simulate_telemetry(count: int = Query(default=10, ge=1, le=100)):
    """Explicitly generate and persist labelled simulation readings for Pune locations."""
    location_ids = repository.sample_location_ids(count, "Pune")
    if not location_ids:
        raise HTTPException(status_code=503, detail="No Pune locations are available for simulation")
    generated = []
    base_time = datetime.now(timezone.utc)
    for index, location_id in enumerate(location_ids):
        payload = IoTTelemetryPayload(
            device_id=f"SIM-ESP32-{location_id:05d}", location_id=location_id,
            groundwater_level=round(random.uniform(4.5, 28.0), 2),
            pipeline_pressure=round(random.uniform(0.35, 1.15), 2),
            flow_rate=round(random.uniform(12.0, 45.0), 1), battery_voltage=3.7,
            source_type="simulation", timestamp=base_time + timedelta(microseconds=index),
        )
        generated.append(ingest_telemetry(payload)["record"])
    return {
        "status": "success", "simulation_active": True,
        "data_source": "explicit_simulation", "generated_count": len(generated),
        "telemetry_sample": generated,
        "notice": "Generated readings are persisted separately from live hardware data.",
    }


@router.get("/live")
def get_live_telemetry(
    location_id: int | None = Query(default=None, gt=0),
    source_type: Literal["live_hardware", "simulation", "all"] = Query(default="live_hardware"),
):
    """Return the latest persisted reading per device using indexed SQLite queries."""
    devices = repository.latest_devices(source_type=source_type, location_id=location_id)
    response = {
        "storage": "sqlite", "transport": "http_ingestion_only",
        "source_filter": source_type, "device_count": len(devices),
        "active_devices_count": sum(device["device_health"] != "stale" for device in devices),
        "stale_devices_count": sum(device["device_health"] == "stale" for device in devices),
        "devices": devices,
    }
    if location_id is not None:
        response.update({
            "location_id": location_id, "has_iot_device": bool(devices),
            "message": None if devices else "No persisted telemetry matches this location and source filter",
        })
    return response
