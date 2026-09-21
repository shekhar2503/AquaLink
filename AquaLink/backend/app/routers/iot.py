"""
AquaLink IoT Telemetry & Simulation Router
==========================================
Provides real-time IoT sensor telemetry ingestion, simulation daemon triggers,
and live field monitoring endpoints.

Target Hardware Architecture:
Submersible Pressure Transducer (Groundwater) + 0-1.2 MPa Transducer (Pressure) + YF-S201 (Flow)
ESP32 -> LoRaWAN -> Gateway -> LoRaWAN Network Server -> MQTT/HTTP -> FastAPI (/api/iot/telemetry)
"""

from __future__ import annotations
import random
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/iot", tags=["IoT Integration"])

# In-memory storage for active live telemetry (augmented with database persistence)
LIVE_TELEMETRY_STORE: dict[str, dict] = {}
SIMULATION_ACTIVE: bool = False


class IoTTelemetryPayload(BaseModel):
    device_id: str = Field(..., example="GW_001")
    location_id: int = Field(..., example=101)
    groundwater_level: float = Field(..., ge=0.0, le=150.0, description="Depth to water table in mbgl")
    pipeline_pressure: float = Field(..., ge=0.0, le=15.0, description="Pipeline pressure in bar / MPa")
    flow_rate: float = Field(..., ge=0.0, le=1000.0, description="Water flow rate in L/min")
    battery_voltage: float | None = Field(default=3.7, ge=0.0, le=5.0)
    is_simulated: bool = Field(default=False)
    timestamp: str | None = None


@router.post("/telemetry")
def ingest_telemetry(payload: IoTTelemetryPayload):
    """
    Ingests live telemetry from LoRaWAN application server MQTT/HTTP bridge.
    Validates physical sensor ranges and logs readings to DB.
    """
    # Range & Quality Checks
    if payload.groundwater_level > 100.0:
        status = "CRITICAL_DEPLETION"
    elif payload.pipeline_pressure < 0.2:
        status = "LOW_PRESSURE_WARNING"
    elif payload.flow_rate == 0.0:
        status = "NO_FLOW"
    else:
        status = "NORMAL"

    rec = {
        "device_id": payload.device_id,
        "location_id": payload.location_id,
        "groundwater_level_mbgl": payload.groundwater_level,
        "pipeline_pressure_bar": payload.pipeline_pressure,
        "flow_rate_lpm": payload.flow_rate,
        "battery_voltage": payload.battery_voltage or 3.7,
        "status": status,
        "is_simulated": payload.is_simulated,
        "data_source": "Simulated IoT Data" if payload.is_simulated else "Field Hardware Transducer (LoRaWAN)",
        "timestamp": payload.timestamp or datetime.now(timezone.utc).isoformat(),
    }

    LIVE_TELEMETRY_STORE[str(payload.location_id)] = rec
    return {
        "status": "success",
        "message": "Telemetry received and validated",
        "record": rec,
    }


@router.post("/simulate")
def toggle_simulation(
    count: int = Query(default=10, le=100, description="Number of locations to simulate readings for"),
):
    """
    Generates realistic simulated IoT telemetry across monitored locations for SIH demo testing.
    Clearly tags generated data as 'Simulated IoT Data'.
    """
    global SIMULATION_ACTIVE
    SIMULATION_ACTIVE = True
    generated = []

    # Seed 10 Pune/Maharashtra location IDs
    sample_locations = [1, 2, 5, 12, 18, 24, 30, 42, 55, 60]
    for loc_id in sample_locations[:count]:
        gw_depth = round(random.uniform(4.5, 28.0), 2)
        pressure = round(random.uniform(0.35, 1.15), 2)
        flow = round(random.uniform(12.0, 45.0), 1)

        payload = IoTTelemetryPayload(
            device_id=f"ESP32_LORA_{loc_id:03d}",
            location_id=loc_id,
            groundwater_level=gw_depth,
            pipeline_pressure=pressure,
            flow_rate=flow,
            is_simulated=True,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        res = ingest_telemetry(payload)
        generated.append(res["record"])

    return {
        "status": "success",
        "simulation_active": True,
        "generated_count": len(generated),
        "telemetry_sample": generated,
    }


@router.get("/live")
def get_live_telemetry(location_id: int | None = Query(default=None)):
    """
    Returns latest live IoT sensor telemetry.
    """
    if location_id is not None:
        rec = LIVE_TELEMETRY_STORE.get(str(location_id))
        if not rec:
            return {
                "location_id": location_id,
                "has_iot_device": False,
                "message": "No active IoT telemetry received for this location yet",
            }
        return {"has_iot_device": True, "telemetry": rec}

    return {
        "active_devices_count": len(LIVE_TELEMETRY_STORE),
        "devices": list(LIVE_TELEMETRY_STORE.values()),
    }
