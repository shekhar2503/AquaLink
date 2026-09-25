"""Regression tests for canonical dataset integrity and publication."""

from pathlib import Path
import sys

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = BACKEND_DIR / "scripts"
REPOSITORY_ROOT = BACKEND_DIR.parents[1]
for path in (BACKEND_DIR, SCRIPTS_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from scripts.dataset_validation import (  # noqa: E402
    ENGINE_COLUMNS,
    calculate_engine_columns,
    compare_datasets,
    validate_dataframe,
)

CANONICAL_PATH = BACKEND_DIR / "data" / "aqualink_dataset.csv"
FALLBACK_PATH = REPOSITORY_ROOT / "aqualink-dashboard" / "public" / "aqualinkData.csv"


def test_canonical_dataset_is_valid():
    result = validate_dataframe(pd.read_csv(CANONICAL_PATH))
    assert result.valid, result.errors
    assert all(count == 0 for count in result.derived_mismatches.values())


def test_frontend_fallback_matches_canonical():
    canonical = pd.read_csv(CANONICAL_PATH)
    fallback = pd.read_csv(FALLBACK_PATH)
    assert compare_datasets(canonical, fallback) == []


def test_engine_recalculation_is_idempotent():
    frame = pd.read_csv(CANONICAL_PATH).head(100)
    recalculated = calculate_engine_columns(frame)
    pd.testing.assert_frame_equal(
        frame[ENGINE_COLUMNS].reset_index(drop=True),
        recalculated[ENGINE_COLUMNS].reset_index(drop=True),
        check_dtype=False,
        check_exact=True,
    )


def test_duplicate_location_year_is_rejected():
    frame = pd.read_csv(CANONICAL_PATH).head(100)
    frame = pd.concat([frame, frame.iloc[[0]]], ignore_index=True)
    result = validate_dataframe(frame)
    assert not result.valid
    assert any("Duplicate location_id/Year pairs" in error for error in result.errors)


def test_invalid_coordinate_is_rejected():
    frame = pd.read_csv(CANONICAL_PATH).head(100)
    frame.loc[frame.index[0], "Latitude"] = 95
    result = validate_dataframe(frame)
    assert not result.valid
    assert any("Latitude" in error and "outside" in error for error in result.errors)


def test_engine_owned_change_is_rejected():
    frame = pd.read_csv(CANONICAL_PATH).head(100)
    frame.loc[frame.index[0], "Recommended_Action"] = "Unapproved manual action"
    result = validate_dataframe(frame)
    assert not result.valid
    assert result.derived_mismatches["Recommended_Action"] == 1


def test_missing_required_column_is_rejected():
    frame = pd.read_csv(CANONICAL_PATH).head(10).drop(columns=["Water_Stress_Score"])
    result = validate_dataframe(frame)
    assert not result.valid
    assert any("Missing required columns" in error for error in result.errors)
