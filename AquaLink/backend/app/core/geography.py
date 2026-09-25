"""Safe identifiers and labels for synthetic prototype geography."""

from __future__ import annotations

import re

MAHARASHTRA_REFERENCE_BOUNDS = (72.654608, 15.606125, 80.898357, 22.033719)
SYNTHETIC_GEOGRAPHY_STATUS = "synthetic_unverified"
COORDINATE_SOURCE = "synthetic_prototype"


def _area_number(value: str) -> str:
    match = re.search(r"_Taluka_(\d+)$", value)
    return match.group(1) if match else value


def safe_geography_fields(record: dict) -> dict:
    location_id = int(record["location_id"])
    district = str(record["District"])
    raw_area = str(record["Taluka"])
    area_number = _area_number(raw_area)
    longitude = float(record["Longitude"])
    latitude = float(record["Latitude"])
    west, south, east, north = MAHARASHTRA_REFERENCE_BOUNDS
    within_reference_extent = west <= longitude <= east and south <= latitude <= north
    return {
        "geography_id": f"syn-location-{location_id:05d}",
        "area_group_id": f"syn-area-{district.lower().replace(' ', '-')}-{area_number.lower()}",
        "location_display_name": f"Synthetic location {location_id:05d}",
        "area_group_display_name": f"Synthetic area group {area_number}",
        "geography_source_status": SYNTHETIC_GEOGRAPHY_STATUS,
        "coordinate_source": COORDINATE_SOURCE,
        "coordinate_status": "within_reference_state_extent" if within_reference_extent else "outside_reference_state_extent",
    }
