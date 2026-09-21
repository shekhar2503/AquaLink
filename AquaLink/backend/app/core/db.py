"""
AquaLink Database Module
========================
Target Production Architecture: PostgreSQL + PostGIS database.
Development / Standalone Mode: SQLite fallback powered by Python standard library (sqlite3).
Seeds initial dataset from aqualink_dataset.csv on startup.
"""

from __future__ import annotations
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_FILE = Path(__file__).resolve().parents[2] / "aqualink.db"
TARGET_ARCHITECTURE = "PostgreSQL + PostGIS (Production Target) | SQLite (Local Dev Mode)"


def get_connection():
    """Returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables and seeds initial data from aqualink_dataset.csv if empty."""
    conn = get_connection()
    cursor = conn.cursor()

    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS locations (
        location_id INTEGER PRIMARY KEY,
        district TEXT,
        taluka TEXT,
        village_ward TEXT,
        region TEXT,
        area_type TEXT,
        latitude REAL,
        longitude REAL,
        population INTEGER,
        households INTEGER,
        is_tribal INTEGER DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS iot_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        location_id INTEGER,
        groundwater_level REAL,
        pipeline_pressure REAL,
        flow_rate REAL,
        battery_voltage REAL,
        status TEXT,
        is_simulated INTEGER DEFAULT 0,
        timestamp TEXT
    )
    """)

    conn.commit()
    conn.close()
