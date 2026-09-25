"""Explainable, rules-based data-quality assessment for AquaLink."""

from __future__ import annotations

import math
from typing import Any

QUALITY_VERSION = "aqualink-quality-v1.0.0"
CONFIDENCE_THRESHOLDS = {"High": 80.0, "Medium": 60.0, "Low": 0.0}
DIMENSION_WEIGHTS = {
    "completeness": 0.25,
    "freshness": 0.15,
    "source_reliability": 0.20,
    "observation_count": 0.15,
    "spatial_accuracy": 0.15,
    "observation_status": 0.10,
}
REQUIRED_RECORD_FIELDS = (
    "location_id", "Year", "District", "Latitude", "Longitude",
    "GW_Extraction_Stage_pct", "GW_Historical_Trend",
    "Piped_Water_Coverage_pct", "Service_Norm_LPCD", "Actual_Supply_LPCD",
)


def methodology_metadata() -> dict:
    return {
        "version": QUALITY_VERSION,
        "formula": "Weighted sum of six rule scores on a 0-100 scale.",
        "weights": DIMENSION_WEIGHTS,
        "confidence_thresholds": {
            "high_minimum": 80,
            "medium_minimum": 60,
            "low_maximum_exclusive": 60,
        },
        "stale_after_years": 2,
        "simulated_confidence_cap": "Medium",
    }


def _missing(value: Any) -> bool:
    if value is None or (isinstance(value, str) and not value.strip()):
        return True
    return isinstance(value, float) and math.isnan(value)


def _component(score: float, reason: str) -> dict:
    label = "Strong" if score >= 80 else "Adequate" if score >= 60 else "Limited"
    return {"score": float(score), "rating": label, "reasons": [reason]}


def _confidence(score: float) -> str:
    if score >= CONFIDENCE_THRESHOLDS["High"]:
        return "High"
    if score >= CONFIDENCE_THRESHOLDS["Medium"]:
        return "Medium"
    return "Low"


def assess_quality(
    *,
    record: dict | None,
    assessed_year: int,
    latest_year: int,
    observation_count: int,
    source_reliability: str = "simulated_prototype",
    spatial_accuracy: str = "within_reference_state_extent",
    simulated: bool = True,
    required_fields: tuple[str, ...] = REQUIRED_RECORD_FIELDS,
) -> dict:
    """Return a transparent quality score; this is not an ML probability."""
    missing_fields = [] if record is None else [field for field in required_fields if _missing(record.get(field))]
    completeness_ratio = 1.0 if record is None else (len(required_fields) - len(missing_fields)) / len(required_fields)
    if completeness_ratio == 1:
        completeness_score = 100
    elif completeness_ratio >= 0.9:
        completeness_score = 80
    elif completeness_ratio >= 0.75:
        completeness_score = 50
    else:
        completeness_score = 20

    age = max(0, int(latest_year) - int(assessed_year))
    freshness_score = 100 if age == 0 else 75 if age == 1 else 50 if age == 2 else 25
    source_scores = {
        "verified_official": 100, "verified_partner": 85,
        "reported_unverified": 60, "simulated_prototype": 35, "unknown": 20,
    }
    source_score = source_scores.get(source_reliability, 20)
    count_score = 100 if observation_count >= 6 else 75 if observation_count >= 4 else 50 if observation_count >= 2 else 25 if observation_count == 1 else 0
    spatial_scores = {
        "verified_coordinate": 100, "approximate_admin_centroid": 65,
        "within_reference_state_extent": 40, "outside_reference_state_extent": 0, "unknown": 20,
    }
    spatial_score = spatial_scores.get(spatial_accuracy, 20)
    status_score = 20 if simulated else (100 if source_reliability in {"verified_official", "verified_partner"} else 60)

    dimensions = {
        "completeness": _component(completeness_score, f"{len(required_fields) - len(missing_fields)} of {len(required_fields)} required fields are present."),
        "freshness": _component(freshness_score, "Observation matches the latest dataset year." if age == 0 else f"Observation is {age} dataset year(s) older than the latest available year."),
        "source_reliability": _component(source_score, source_reliability.replace("_", " ").capitalize() + "."),
        "observation_count": _component(count_score, f"{observation_count} supporting observation(s) are available."),
        "spatial_accuracy": _component(spatial_score, spatial_accuracy.replace("_", " ").capitalize() + "."),
        "observation_status": _component(status_score, "Simulated prototype values are not verified field observations." if simulated else "Values are treated as observed data; source verification is scored separately."),
    }
    weighted_score = round(sum(dimensions[name]["score"] * weight for name, weight in DIMENSION_WEIGHTS.items()), 1)
    confidence = _confidence(weighted_score)
    cap_applied = simulated and confidence == "High"
    if cap_applied:
        confidence = "Medium"

    indicators = []
    if missing_fields:
        indicators.append("missing_required_values")
    if age >= 2:
        indicators.append("stale_observation")
    if observation_count < 4:
        indicators.append("limited_observation_history")
    if spatial_score < 60:
        indicators.append("limited_spatial_verification")
    if simulated:
        indicators.append("simulated_not_observed")

    reasons = [
        f"Overall score is {weighted_score}/100 from the documented weighted rules.",
        dimensions["observation_status"]["reasons"][0],
    ]
    if missing_fields:
        reasons.append(f"Missing required fields: {', '.join(missing_fields)}.")
    if age >= 2:
        reasons.append(f"The observation is stale under the {methodology_metadata()['stale_after_years']}-year rule.")
    if cap_applied:
        reasons.append("Confidence was capped at Medium because simulated data cannot receive High confidence.")

    return {
        "quality_version": QUALITY_VERSION,
        "confidence": confidence,
        "quality_score": weighted_score,
        "confidence_cap_applied": cap_applied,
        "supporting_observation_count": int(observation_count),
        "assessed_year": int(assessed_year),
        "latest_available_year": int(latest_year),
        "is_stale": age >= 2,
        "stale_years": age,
        "missing_fields": missing_fields,
        "indicators": indicators,
        "reasons": reasons,
        "dimensions": dimensions,
    }


def assess_prototype_record(record: dict, observation_count: int, latest_year: int, coordinate_status: str) -> dict:
    return assess_quality(
        record=record,
        assessed_year=int(record["Year"]),
        latest_year=latest_year,
        observation_count=observation_count,
        source_reliability="simulated_prototype",
        spatial_accuracy=coordinate_status,
        simulated=True,
    )


def assess_prototype_aggregate(assessed_year: int, latest_year: int, observation_count: int) -> dict:
    return assess_quality(
        record=None,
        assessed_year=assessed_year,
        latest_year=latest_year,
        observation_count=observation_count,
        source_reliability="simulated_prototype",
        spatial_accuracy="within_reference_state_extent",
        simulated=True,
    )
