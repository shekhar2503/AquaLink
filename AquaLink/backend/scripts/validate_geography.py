"""Run the reproducible AquaLink synthetic geography audit."""

from pathlib import Path
import sys

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.data import DATA_PATH  # noqa: E402
from scripts.geography_validation import validate_geography  # noqa: E402


def main() -> int:
    result = validate_geography(
        pd.read_csv(DATA_PATH),
        REPOSITORY_ROOT / "aqualink-dashboard" / "public" / "maharashtra.geojson",
        REPOSITORY_ROOT / "aqualink-dashboard" / "src" / "data" / "puneTalukas.geojson",
    )
    print("Geography audit: PASS" if result.valid_coordinate_values else "Geography audit: FAIL")
    print(f"Locations: {result.locations:,}")
    print(f"Inside reference state polygons: {result.within_reference_state:,}; outside: {result.outside_reference_state:,}")
    print(f"Inside matching district polygon: {result.within_named_reference_district:,}; outside/unmatched: {result.outside_or_unmatched_district:,}")
    print(f"Pune reference polygon: {result.pune_inside_reference_district}/{result.pune_locations} inside; {result.pune_outside_reference_district} outside")
    print(f"Boundary layer: {result.boundary_granularity}, vintage {result.boundary_vintage}; taluka usable: {result.taluka_boundary_usable}")
    return 0 if result.valid_coordinate_values else 1


if __name__ == "__main__":
    raise SystemExit(main())
