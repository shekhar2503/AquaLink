"""Typed public response contract for the AquaLink API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class YearRange(ApiModel):
    minimum: int
    maximum: int


class RiskThreshold(ApiModel):
    minimum: float = Field(ge=0, le=100)
    maximum: float = Field(ge=0, le=100)
    minimum_inclusive: bool = True
    maximum_inclusive: bool = False


class QualityDimension(ApiModel):
    score: float = Field(ge=0, le=100)
    rating: Literal["Strong", "Adequate", "Limited"]
    reasons: list[str]


class QualityAssessment(ApiModel):
    quality_version: str
    confidence: Literal["High", "Medium", "Low"]
    quality_score: float = Field(ge=0, le=100)
    confidence_cap_applied: bool
    supporting_observation_count: int = Field(ge=0)
    assessed_year: int
    latest_available_year: int
    is_stale: bool
    stale_years: int = Field(ge=0)
    missing_fields: list[str]
    indicators: list[str]
    reasons: list[str]
    dimensions: dict[str, QualityDimension]


class QualityMethodology(ApiModel):
    version: str
    formula: str
    weights: dict[str, float]
    confidence_thresholds: dict[str, float]
    stale_after_years: int
    simulated_confidence_cap: Literal["Medium"]


class MetadataResponse(ApiModel):
    api_version: str
    scoring_version: str
    source_type: Literal["synthetic_csv"]
    synthetic: bool
    canonical_source: str
    last_updated: datetime
    year_range: YearRange
    latest_year: int
    record_count: int
    location_count: int
    district_count: int
    risk_thresholds: dict[str, RiskThreshold]
    quality_methodology: QualityMethodology


class RecommendationData(ApiModel):
    action_code: str
    priority: Literal["routine", "medium", "high", "urgent"]
    recommended_action: str
    drivers: list[str]
    rationale: str
    score_version: str


class HotspotRecord(ApiModel):
    location_id: int
    year: int
    region: str
    district: str
    taluka: str
    village_ward: str
    area_type: str
    latitude: float
    longitude: float
    population: int
    households: int
    annual_rainfall_mm: float
    rainy_days: int
    pre_monsoon_water_level_mbgl: float
    post_monsoon_water_level_mbgl: float
    seasonal_fluctuation_m: float
    gw_extraction_stage_pct: float
    gw_category_cgwb: str
    gw_historical_trend: str
    piped_water_coverage_pct: float
    service_norm_lpcd: float
    actual_supply_lpcd: float
    supply_gap_pct: float
    water_quality_issue: bool
    water_quality_type: str
    tribal_remote_area: bool
    groundwater_stress_score: float = Field(ge=0, le=100)
    water_supply_gap_score: float = Field(ge=0, le=100)
    water_stress_score: float = Field(ge=0, le=100)
    risk_category: Literal["Low", "Moderate", "High", "Critical"]
    recommended_action: str
    recommendation: RecommendationData
    score_version: str
    geography_id: str
    area_group_id: str
    location_display_name: str
    area_group_display_name: str
    geography_source_status: Literal["synthetic_unverified"]
    coordinate_source: Literal["synthetic_prototype"]
    coordinate_status: Literal["within_reference_state_extent", "outside_reference_state_extent"]
    quality: QualityAssessment


class HotspotsResponse(ApiModel):
    year: int
    count: int
    supporting_observation_count: int
    quality: QualityAssessment
    results: list[HotspotRecord]


class RankingRecord(ApiModel):
    location_id: int
    year: int
    district: str
    taluka: str
    village_ward: str
    water_stress_score: float
    groundwater_stress_score: float
    water_supply_gap_score: float
    risk_category: Literal["Low", "Moderate", "High", "Critical"]
    recommended_action: str
    recommendation: RecommendationData
    score_version: str
    geography_id: str
    area_group_id: str
    location_display_name: str
    area_group_display_name: str
    geography_source_status: Literal["synthetic_unverified"]
    coordinate_source: Literal["synthetic_prototype"]
    coordinate_status: Literal["within_reference_state_extent", "outside_reference_state_extent"]
    quality: QualityAssessment


class RankingsResponse(ApiModel):
    year: int
    count: int
    supporting_observation_count: int
    quality: QualityAssessment
    results: list[RankingRecord]


class DistrictSummaryRecord(ApiModel):
    region: str
    district: str
    avg_water_stress_score: float
    avg_gw_stress_score: float
    avg_supply_gap_score: float
    villages_count: int
    critical_count: int
    high_count: int
    supporting_observation_count: int
    quality: QualityAssessment


class DistrictSummariesResponse(ApiModel):
    year: int
    count: int
    supporting_observation_count: int
    quality: QualityAssessment
    results: list[DistrictSummaryRecord]


class HistoricalForecastPoint(ApiModel):
    year: int
    actual_score: float
    fitted_score: float


class ProjectedForecastPoint(ApiModel):
    year: int
    projected_score: float
    lower_95: float
    upper_95: float


class ForecastMetrics(ApiModel):
    mae: float
    rmse: float
    test_observations: int


class ForecastBacktest(ApiModel):
    method: str
    minimum_training_observations: int
    results: dict[str, ForecastMetrics]
    selected_model: Literal["ols", "last_value", "historical_mean", "simple_trend"]
    selection_metric: Literal["rmse"]


class ForecastResponse(ApiModel):
    model_type: str
    model_version: str
    description: str
    disclaimer: str
    slope: float
    intercept: float
    r_squared: float
    observation_count: int
    forecast_horizon: int
    baseline_year: int
    interval_method: str
    historical_fitted: list[HistoricalForecastPoint]
    forecast_projected: list[ProjectedForecastPoint]
    backtest: ForecastBacktest
    evidence_label: str
    supporting_record_count: int
    quality: QualityAssessment


class LocationForecastResponse(ForecastResponse):
    location_id: int
    district: str
    taluka: str
    village_ward: str


class DistrictForecastResponse(ForecastResponse):
    district: str


DATASET_TO_API_FIELDS = {
    "Year": "year", "Region": "region", "District": "district",
    "Taluka": "taluka", "Village_Ward": "village_ward", "Area_Type": "area_type",
    "Latitude": "latitude", "Longitude": "longitude", "Population": "population",
    "Households": "households", "Annual_Rainfall_mm": "annual_rainfall_mm",
    "Rainy_Days": "rainy_days", "PreMonsoon_WaterLevel_mbgl": "pre_monsoon_water_level_mbgl",
    "PostMonsoon_WaterLevel_mbgl": "post_monsoon_water_level_mbgl",
    "Seasonal_Fluctuation_m": "seasonal_fluctuation_m",
    "GW_Extraction_Stage_pct": "gw_extraction_stage_pct", "GW_Category_CGWB": "gw_category_cgwb",
    "GW_Historical_Trend": "gw_historical_trend", "Piped_Water_Coverage_pct": "piped_water_coverage_pct",
    "Service_Norm_LPCD": "service_norm_lpcd", "Actual_Supply_LPCD": "actual_supply_lpcd",
    "Supply_Gap_pct": "supply_gap_pct", "Water_Quality_Issue": "water_quality_issue",
    "Water_Quality_Type": "water_quality_type", "Tribal_Remote_Area": "tribal_remote_area",
    "Groundwater_Stress_Score": "groundwater_stress_score",
    "Water_Supply_Gap_Score": "water_supply_gap_score", "Water_Stress_Score": "water_stress_score",
    "Risk_Category": "risk_category", "Recommended_Action": "recommended_action",
    "Recommendation": "recommendation", "Score_Version": "score_version",
}


def canonicalize_record(record: dict) -> dict:
    return {DATASET_TO_API_FIELDS.get(key, key): value for key, value in record.items()}
