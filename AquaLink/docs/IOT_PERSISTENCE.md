# IoT persistence and API behavior

AquaLink's implemented IoT transport is authenticated-network-neutral HTTP ingestion into SQLite. MQTT, LoRaWAN network-server integration, PostgreSQL, PostGIS, and verified live hardware connections are not active.

## Storage

`backend/aqualink.db` contains:

- `locations`: valid location identifiers seeded from the canonical CSV;
- `iot_devices`: one registration and current health summary per device;
- `iot_telemetry`: immutable timestamped readings with a unique `(device_id, observed_at)` constraint.

Set `AQUALINK_DB_PATH` to use a different SQLite file. Startup creates missing tables and indexes. If the former telemetry schema exists, it is renamed to `iot_telemetry_legacy` and retained rather than deleted.

## Validation

- `location_id` must exist in `locations`.
- Device identifiers contain 3–64 letters, numbers, `.`, `:`, `_`, or `-`.
- Simulation identifiers start with `SIM-`; live-hardware identifiers must not.
- Timestamps require a timezone, may be no more than five minutes in the future, and no more than seven days old.
- Duplicate device/timestamp pairs return HTTP 409.
- A registered device cannot silently change location or source type.

## Health rules

- Devices become `stale` after 15 minutes without a newer observation.
- Battery is `critical` below 3.3 V, `low` below 3.55 V, `good` otherwise, or `unknown` when omitted.
- Critical depletion or critical battery produces `critical` health.
- Low pressure, no flow, or low battery produces `warning` health.
- Other current readings produce `healthy` health.

`GET /api/iot/live` defaults to `source_type=live_hardware`. Use `source_type=simulation` to inspect generated demo readings, or `source_type=all` for both. Counts and device health are recomputed from persisted latest readings.

## Example live-hardware ingestion

```http
POST /api/iot/telemetry
Content-Type: application/json

{
  "device_id": "GW-PUNE-001",
  "location_id": 1212,
  "groundwater_level": 12.5,
  "pipeline_pressure": 0.85,
  "flow_rate": 22.0,
  "battery_voltage": 3.7,
  "source_type": "live_hardware"
}
```

Simulation is only created through explicitly labelled payloads or `POST /api/iot/simulate`; it is persisted but excluded from the default live-hardware query.
