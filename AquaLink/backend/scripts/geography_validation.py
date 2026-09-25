"""Geographic audit helpers for synthetic AquaLink locations."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path

import pandas as pd


@dataclass
class GeographyValidationResult:
    valid_coordinate_values: bool
    locations: int
    within_reference_state: int
    outside_reference_state: int
    within_named_reference_district: int
    outside_or_unmatched_district: int
    pune_locations: int
    pune_inside_reference_district: int
    pune_outside_reference_district: int
    boundary_granularity: str
    boundary_vintage: str
    taluka_boundary_usable: bool

    def to_dict(self) -> dict:
        return asdict(self)


def _polygons(geometry: dict) -> list:
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


def _ring_contains(ring: list, longitude: float, latitude: float) -> bool:
    inside = False
    previous = len(ring) - 1
    for current, (x_current, y_current) in enumerate(ring):
        x_previous, y_previous = ring[previous]
        crosses = (y_current > latitude) != (y_previous > latitude)
        if crosses and longitude < (x_previous - x_current) * (latitude - y_current) / (y_previous - y_current) + x_current:
            inside = not inside
        previous = current
    return inside


def geometry_contains(geometry: dict, longitude: float, latitude: float) -> bool:
    for polygon in _polygons(geometry):
        if _ring_contains(polygon[0], longitude, latitude) and not any(
            _ring_contains(hole, longitude, latitude) for hole in polygon[1:]
        ):
            return True
    return False


def validate_geography(frame: pd.DataFrame, district_geojson_path: Path, taluka_geojson_path: Path) -> GeographyValidationResult:
    required = {"location_id", "District", "Latitude", "Longitude"}
    if not required.issubset(frame.columns):
        raise ValueError(f"Missing geography columns: {sorted(required - set(frame.columns))}")
    locations = frame.drop_duplicates("location_id")
    numeric = locations[["Latitude", "Longitude"]].apply(pd.to_numeric, errors="coerce")
    valid_values = bool(numeric.notna().all().all() and numeric.Latitude.between(-90, 90).all() and numeric.Longitude.between(-180, 180).all())

    collection = json.loads(district_geojson_path.read_text(encoding="utf-8-sig"))
    features = collection.get("features", [])
    by_district = {str(feature["properties"].get("district", "")).casefold(): feature for feature in features}
    within_state = []
    within_district = []
    for row in locations.itertuples():
        within_state.append(any(geometry_contains(feature["geometry"], row.Longitude, row.Latitude) for feature in features))
        feature = by_district.get(str(row.District).casefold())
        within_district.append(bool(feature and geometry_contains(feature["geometry"], row.Longitude, row.Latitude)))

    pune_mask = locations.District.eq("Pune").tolist()
    pune_inside = sum(match for match, is_pune in zip(within_district, pune_mask) if is_pune)
    taluka_usable = taluka_geojson_path.exists() and taluka_geojson_path.stat().st_size > 0
    vintages = {str(feature.get("properties", {}).get("year", "unknown")) for feature in features}
    return GeographyValidationResult(
        valid_coordinate_values=valid_values,
        locations=len(locations),
        within_reference_state=sum(within_state),
        outside_reference_state=len(locations) - sum(within_state),
        within_named_reference_district=sum(within_district),
        outside_or_unmatched_district=len(locations) - sum(within_district),
        pune_locations=sum(pune_mask),
        pune_inside_reference_district=pune_inside,
        pune_outside_reference_district=sum(pune_mask) - pune_inside,
        boundary_granularity="district",
        boundary_vintage=", ".join(sorted(vintages)),
        taluka_boundary_usable=taluka_usable,
    )
