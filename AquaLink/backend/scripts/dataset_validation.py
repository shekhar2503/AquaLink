"""Validation and engine-consistency checks for AquaLink CSV datasets."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import sys

import numpy as np
import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.engine import RawIndicators, score_area  # noqa: E402


REQUIRED_COLUMNS = [
    "location_id",
    "Year",
    "Region",
    "District",
    "Taluka",
    "Village_Ward",
    "Area_Type",
    "Latitude",
    "Longitude",
    "Population",
    "Households",
    "Annual_Rainfall_mm",
    "Rainy_Days",
    "PreMonsoon_WaterLevel_mbgl",
    "PostMonsoon_WaterLevel_mbgl",
    "Seasonal_Fluctuation_m",
    "GW_Extraction_Stage_pct",
    "GW_Category_CGWB",
    "GW_Historical_Trend",
    "Piped_Water_Coverage_pct",
    "Service_Norm_LPCD",
    "Actual_Supply_LPCD",
    "Supply_Gap_pct",
    "Water_Quality_Issue",
    "Water_Quality_Type",
    "Tribal_Remote_Area",
    "Groundwater_Stress_Score",
    "Water_Supply_Gap_Score",
    "Water_Stress_Score",
    "Risk_Category",
    "Recommended_Action",
]

ENGINE_COLUMNS = [
    "Groundwater_Stress_Score",
    "Water_Supply_Gap_Score",
    "Water_Stress_Score",
    "Risk_Category",
    "Recommended_Action",
]

STRING_COLUMNS = [
    "Region",
    "District",
    "Taluka",
    "Village_Ward",
    "Area_Type",
    "GW_Category_CGWB",
    "GW_Historical_Trend",
    "Water_Quality_Type",
    "Risk_Category",
    "Recommended_Action",
]

NUMERIC_RANGES = {
    "location_id": (1, None),
    "Year": (2000, 2100),
    "Latitude": (15.0, 23.0),
    "Longitude": (72.0, 82.0),
    "Population": (1, None),
    "Households": (1, None),
    "Annual_Rainfall_mm": (0, 6000),
    "Rainy_Days": (0, 366),
    "PreMonsoon_WaterLevel_mbgl": (0, 200),
    "PostMonsoon_WaterLevel_mbgl": (0, 200),
    "Seasonal_Fluctuation_m": (-50, 50),
    "GW_Extraction_Stage_pct": (0, 300),
    "Piped_Water_Coverage_pct": (0, 100),
    "Service_Norm_LPCD": (1, 500),
    "Actual_Supply_LPCD": (0, 500),
    "Supply_Gap_pct": (0, 100),
    "Groundwater_Stress_Score": (0, 100),
    "Water_Supply_Gap_Score": (0, 100),
    "Water_Stress_Score": (0, 100),
}

ALLOWED_VALUES = {
    "Area_Type": {"Rural", "Urban"},
    "GW_Category_CGWB": {"Safe", "Semi-Critical", "Critical", "Over-Exploited"},
    "GW_Historical_Trend": {"Improving", "Stable", "Declining (Worsening)"},
    "Risk_Category": {"Low", "Moderate", "High", "Critical"},
}

IDENTITY_COLUMNS = [
    "Region",
    "District",
    "Taluka",
    "Village_Ward",
    "Area_Type",
    "Latitude",
    "Longitude",
    "Service_Norm_LPCD",
    "Tribal_Remote_Area",
]


@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]
    statistics: dict
    derived_mismatches: dict[str, int]

    def to_dict(self) -> dict:
        return asdict(self)


def calculate_engine_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Calculate all five engine-owned columns without mutating the input."""
    results = []
    for row in frame.itertuples(index=False):
        scores = score_area(
            RawIndicators(
                gw_extraction_stage_pct=float(row.GW_Extraction_Stage_pct),
                seasonal_fluctuation_m=float(row.Seasonal_Fluctuation_m),
                gw_trend=str(row.GW_Historical_Trend),
                piped_coverage_pct=float(row.Piped_Water_Coverage_pct),
                supply_gap_pct=float(row.Supply_Gap_pct),
            )
        )
        results.append(
            {
                "Groundwater_Stress_Score": scores.groundwater_stress_score,
                "Water_Supply_Gap_Score": scores.water_supply_gap_score,
                "Water_Stress_Score": scores.water_stress_score,
                "Risk_Category": scores.risk_category,
                "Recommended_Action": scores.recommended_action,
            }
        )
    return pd.DataFrame(results, index=frame.index, columns=ENGINE_COLUMNS)


def derived_mismatch_counts(frame: pd.DataFrame) -> dict[str, int]:
    expected = calculate_engine_columns(frame)
    mismatches: dict[str, int] = {}
    for column in ENGINE_COLUMNS:
        if column not in frame.columns:
            mismatches[column] = len(frame)
        elif column.endswith("_Score"):
            actual = pd.to_numeric(frame[column], errors="coerce")
            expected_values = pd.to_numeric(expected[column], errors="coerce")
            mismatches[column] = int(
                (~np.isclose(actual, expected_values, atol=1e-9, rtol=0, equal_nan=False)).sum()
            )
        else:
            mismatches[column] = int((frame[column].astype(str) != expected[column]).sum())
    return mismatches


def validate_dataframe(frame: pd.DataFrame) -> ValidationResult:
    errors: list[str] = []
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    extra_columns = [column for column in frame.columns if column not in REQUIRED_COLUMNS]
    if missing_columns:
        errors.append(f"Missing required columns: {', '.join(missing_columns)}")
    if extra_columns:
        errors.append(f"Unexpected columns: {', '.join(extra_columns)}")

    if missing_columns:
        return ValidationResult(False, errors, {"rows": len(frame)}, {})

    null_counts = frame[REQUIRED_COLUMNS].isna().sum()
    null_columns = {column: int(count) for column, count in null_counts.items() if count}
    if null_columns:
        errors.append(f"Null required values: {null_columns}")

    blank_columns = {
        column: int(frame[column].astype(str).str.strip().eq("").sum())
        for column in STRING_COLUMNS
        if frame[column].astype(str).str.strip().eq("").any()
    }
    if blank_columns:
        errors.append(f"Blank required text values: {blank_columns}")

    for column, (minimum, maximum) in NUMERIC_RANGES.items():
        numeric = pd.to_numeric(frame[column], errors="coerce")
        invalid_numeric = int(numeric.isna().sum())
        if invalid_numeric:
            errors.append(f"{column} has {invalid_numeric} non-numeric values")
            continue
        outside = pd.Series(False, index=frame.index)
        if minimum is not None:
            outside |= numeric < minimum
        if maximum is not None:
            outside |= numeric > maximum
        if outside.any():
            errors.append(
                f"{column} has {int(outside.sum())} values outside [{minimum}, {maximum}]"
            )

    for column, allowed in ALLOWED_VALUES.items():
        invalid = sorted(set(frame[column].dropna().astype(str)) - allowed)
        if invalid:
            errors.append(f"{column} has unsupported values: {invalid}")

    for column in ("Water_Quality_Issue", "Tribal_Remote_Area"):
        if not pd.api.types.is_bool_dtype(frame[column]):
            invalid = ~frame[column].isin([True, False])
            if invalid.any():
                errors.append(f"{column} has {int(invalid.sum())} non-boolean values")

    duplicate_count = int(frame.duplicated(["location_id", "Year"]).sum())
    if duplicate_count:
        errors.append(f"Duplicate location_id/Year pairs: {duplicate_count}")

    if (frame["Households"] > frame["Population"]).any():
        errors.append(
            f"Households exceeds population in {int((frame['Households'] > frame['Population']).sum())} rows"
        )

    quality_mismatch = (
        (~frame["Water_Quality_Issue"] & frame["Water_Quality_Type"].ne("No_Issue_Detected"))
        | (frame["Water_Quality_Issue"] & frame["Water_Quality_Type"].eq("No_Issue_Detected"))
    )
    if quality_mismatch.any():
        errors.append(f"Water-quality flag/type mismatches: {int(quality_mismatch.sum())}")

    identity_variants = frame.groupby("location_id")[IDENTITY_COLUMNS].nunique(dropna=False)
    unstable_identity = int((identity_variants > 1).any(axis=1).sum())
    if unstable_identity:
        errors.append(f"Locations with changing identity/geography fields: {unstable_identity}")

    years_per_location = frame.groupby("location_id")["Year"].nunique()
    expected_year_count = frame["Year"].nunique()
    incomplete_locations = int((years_per_location != expected_year_count).sum())
    if incomplete_locations:
        errors.append(f"Locations missing one or more dataset years: {incomplete_locations}")

    mismatch_counts = derived_mismatch_counts(frame)
    for column, count in mismatch_counts.items():
        if count:
            errors.append(f"{column} differs from the scoring engine in {count} rows")

    statistics = {
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "locations": int(frame["location_id"].nunique()),
        "years": sorted(int(year) for year in frame["Year"].unique()),
        "districts": int(frame["District"].nunique()),
        "talukas": int(frame["Taluka"].nunique()),
        "duplicate_location_year_pairs": duplicate_count,
        "missing_required_values": int(frame[REQUIRED_COLUMNS].isna().sum().sum()),
        "risk_distribution": {
            str(key): int(value) for key, value in frame["Risk_Category"].value_counts().items()
        },
    }
    return ValidationResult(not errors, errors, statistics, mismatch_counts)


def compare_datasets(canonical: pd.DataFrame, fallback: pd.DataFrame) -> list[str]:
    errors = []
    if list(canonical.columns) != list(fallback.columns):
        errors.append("Fallback columns or column order differ from the canonical dataset")
        return errors
    if canonical.shape != fallback.shape:
        errors.append(
            f"Fallback shape {fallback.shape} differs from canonical shape {canonical.shape}"
        )
        return errors
    try:
        pd.testing.assert_frame_equal(
            canonical.reset_index(drop=True),
            fallback.reset_index(drop=True),
            check_dtype=False,
            check_exact=True,
        )
    except AssertionError as error:
        errors.append(f"Fallback values differ from the canonical dataset: {str(error).splitlines()[0]}")
    return errors
