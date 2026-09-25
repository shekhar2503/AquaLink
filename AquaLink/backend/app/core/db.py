"""SQLite setup and safe schema migrations for local AquaLink persistence."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

import pandas as pd

DEFAULT_DB_FILE = Path(__file__).resolve().parents[2] / "aqualink.db"
DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "aqualink_dataset.csv"


def database_path() -> Path:
    return Path(os.environ.get("AQUALINK_DB_PATH", DEFAULT_DB_FILE))


def get_connection(db_path: str | Path | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _create_telemetry_table(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS iot_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            location_id INTEGER NOT NULL,
            groundwater_level REAL NOT NULL,
            pipeline_pressure REAL NOT NULL,
            flow_rate REAL NOT NULL,
            battery_voltage REAL,
            telemetry_status TEXT NOT NULL,
            source_type TEXT NOT NULL CHECK(source_type IN ('live_hardware', 'simulation')),
            observed_at TEXT NOT NULL,
            received_at TEXT NOT NULL,
            FOREIGN KEY(device_id) REFERENCES iot_devices(device_id),
            FOREIGN KEY(location_id) REFERENCES locations(location_id),
            UNIQUE(device_id, observed_at)
        )
    """)


def _migrate_legacy_telemetry(conn: sqlite3.Connection) -> None:
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(iot_telemetry)")}
    if not columns or "observed_at" in columns:
        return
    suffix = 1
    backup = "iot_telemetry_legacy"
    existing = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    while backup in existing:
        suffix += 1
        backup = f"iot_telemetry_legacy_{suffix}"
    conn.execute(f'ALTER TABLE iot_telemetry RENAME TO "{backup}"')


def _seed_locations(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT COUNT(*) FROM locations").fetchone()[0] > 0:
        return
    df = pd.read_csv(DATA_FILE).sort_values("Year").drop_duplicates("location_id", keep="last")
    rows = [(
        int(row.location_id), str(row.District), str(row.Taluka), str(row.Village_Ward),
        str(row.Region), str(row.Area_Type), float(row.Latitude), float(row.Longitude),
        int(row.Population), int(row.Households), int(bool(row.Tribal_Remote_Area)),
    ) for row in df.itertuples()]
    conn.executemany("""
        INSERT OR IGNORE INTO locations
        (location_id, district, taluka, village_ward, region, area_type, latitude, longitude, population, households, is_tribal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)


def init_db(db_path: str | Path | None = None) -> None:
    """Create or migrate the SQLite schema without deleting legacy readings."""
    with get_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS locations (
                location_id INTEGER PRIMARY KEY, district TEXT, taluka TEXT,
                village_ward TEXT, region TEXT, area_type TEXT, latitude REAL,
                longitude REAL, population INTEGER, households INTEGER,
                is_tribal INTEGER DEFAULT 0
            )
        """)
        _seed_locations(conn)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS iot_devices (
                device_id TEXT PRIMARY KEY,
                location_id INTEGER NOT NULL,
                source_type TEXT NOT NULL CHECK(source_type IN ('live_hardware', 'simulation')),
                registered_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                battery_voltage REAL,
                battery_state TEXT NOT NULL,
                device_health TEXT NOT NULL,
                telemetry_status TEXT NOT NULL,
                FOREIGN KEY(location_id) REFERENCES locations(location_id)
            )
        """)
        _migrate_legacy_telemetry(conn)
        _create_telemetry_table(conn)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_iot_telemetry_device_observed ON iot_telemetry(device_id, observed_at DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_iot_devices_location_source ON iot_devices(location_id, source_type)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_iot_devices_last_seen ON iot_devices(last_seen_at DESC)")
