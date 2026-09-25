from pathlib import Path

import pandas as pd

from app.core import data as data_layer
from app.core.geography import safe_geography_fields
from scripts.geography_validation import validate_geography

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DISTRICT_GEOJSON = REPOSITORY_ROOT / "aqualink-dashboard" / "public" / "maharashtra.geojson"
TALUKA_GEOJSON = REPOSITORY_ROOT / "aqualink-dashboard" / "src" / "data" / "puneTalukas.geojson"


def test_safe_synthetic_geography_identifiers_are_stable():
    row = data_layer.load_dataset().iloc[0].to_dict()
    first = safe_geography_fields(row)
    second = safe_geography_fields(row)
    assert first == second
    assert first["geography_id"].startswith("syn-location-")
    assert first["area_group_id"].startswith("syn-area-")
    assert first["geography_source_status"] == "synthetic_unverified"
    assert "LGD" not in " ".join(first.values())


def test_coordinate_audit_detects_reference_boundary_mismatches():
    result = validate_geography(pd.read_csv(data_layer.DATA_PATH), DISTRICT_GEOJSON, TALUKA_GEOJSON)
    assert result.valid_coordinate_values
    assert result.locations == 7405
    assert result.outside_reference_state == 412
    assert result.pune_locations == 250
    assert result.pune_outside_reference_district == 5


def test_repository_has_no_usable_taluka_boundary_layer():
    result = validate_geography(pd.read_csv(data_layer.DATA_PATH), DISTRICT_GEOJSON, TALUKA_GEOJSON)
    assert result.boundary_granularity == "district"
    assert result.boundary_vintage == "2011_c, update2014"
    assert not result.taluka_boundary_usable
