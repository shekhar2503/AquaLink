"""Boundary tests for the explainable quality rules."""

from app.core.quality import DIMENSION_WEIGHTS, assess_quality


def complete_record():
    return {
        "location_id": 1, "Year": 2025, "District": "Pune", "Latitude": 18.5,
        "Longitude": 73.8, "GW_Extraction_Stage_pct": 70,
        "GW_Historical_Trend": "Stable", "Piped_Water_Coverage_pct": 80,
        "Service_Norm_LPCD": 70, "Actual_Supply_LPCD": 60,
    }


def assess(**overrides):
    values = dict(record=complete_record(), assessed_year=2025, latest_year=2025,
                  observation_count=6, source_reliability="verified_official",
                  spatial_accuracy="verified_coordinate", simulated=False)
    values.update(overrides)
    return assess_quality(**values)


def test_weights_sum_to_one():
    assert sum(DIMENSION_WEIGHTS.values()) == 1.0


def test_high_confidence_verified_complete_current_record():
    result = assess()
    assert result["confidence"] == "High"
    assert result["quality_score"] == 100


def test_completeness_boundaries_and_missing_indicator():
    nine_of_ten = complete_record(); nine_of_ten["District"] = None
    seven_of_ten = complete_record()
    for field in ("District", "Latitude", "Longitude"):
        seven_of_ten[field] = None
    assert assess(record=nine_of_ten)["dimensions"]["completeness"]["score"] == 80
    result = assess(record=seven_of_ten)
    assert result["dimensions"]["completeness"]["score"] == 20
    assert "missing_required_values" in result["indicators"]


def test_freshness_boundary_marks_two_years_stale():
    one_year = assess(assessed_year=2024)
    two_years = assess(assessed_year=2023)
    assert one_year["dimensions"]["freshness"]["score"] == 75
    assert one_year["is_stale"] is False
    assert two_years["dimensions"]["freshness"]["score"] == 50
    assert two_years["is_stale"] is True


def test_source_reliability_rules():
    assert assess(source_reliability="verified_partner")["dimensions"]["source_reliability"]["score"] == 85
    assert assess(source_reliability="reported_unverified")["dimensions"]["source_reliability"]["score"] == 60
    assert assess(source_reliability="unknown")["dimensions"]["source_reliability"]["score"] == 20


def test_observation_count_boundaries():
    expected = {0: 0, 1: 25, 2: 50, 3: 50, 4: 75, 5: 75, 6: 100}
    for count, score in expected.items():
        assert assess(observation_count=count)["dimensions"]["observation_count"]["score"] == score


def test_spatial_accuracy_rules():
    assert assess(spatial_accuracy="verified_coordinate")["dimensions"]["spatial_accuracy"]["score"] == 100
    assert assess(spatial_accuracy="approximate_admin_centroid")["dimensions"]["spatial_accuracy"]["score"] == 65
    result = assess(spatial_accuracy="outside_reference_state_extent")
    assert result["dimensions"]["spatial_accuracy"]["score"] == 0
    assert "limited_spatial_verification" in result["indicators"]


def test_simulated_status_is_explained_and_high_is_capped():
    result = assess(simulated=True)
    assert result["dimensions"]["observation_status"]["score"] == 20
    assert result["confidence"] == "Medium"
    assert result["confidence_cap_applied"] is True
    assert "simulated_not_observed" in result["indicators"]


def test_medium_and_low_examples_are_explainable():
    medium = assess(source_reliability="simulated_prototype", spatial_accuracy="within_reference_state_extent", simulated=True)
    low = assess(assessed_year=2020, source_reliability="simulated_prototype",
                 spatial_accuracy="outside_reference_state_extent", simulated=True,
                 observation_count=1)
    assert medium["confidence"] == "Medium"
    assert low["confidence"] == "Low"
    assert low["is_stale"] is True
    assert len(low["reasons"]) >= 3
