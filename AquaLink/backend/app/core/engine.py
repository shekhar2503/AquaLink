"""
AquaLink Water Stress Engine
=============================
Pure scoring logic, decoupled from data loading/storage so it can run on
the prototype dataset today and on real CGWB/JJM feeds later without
changing this file.

Formulas mirror the ones used to build the prototype dataset (see
docs/DATA_DICTIONARY.md) so scores stay consistent end-to-end.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class RawIndicators:
    """Minimum inputs the engine needs for one area/year record."""
    gw_extraction_stage_pct: float      # CGWB Stage of Groundwater Extraction (%)
    seasonal_fluctuation_m: float       # pre-monsoon minus post-monsoon depth (m)
    gw_trend: str                       # "Improving" | "Stable" | "Declining (Worsening)"
    piped_coverage_pct: float           # % households with tap connection
    supply_gap_pct: float               # % shortfall vs LPCD service norm


@dataclass
class StressScores:
    groundwater_stress_score: float
    water_supply_gap_score: float
    water_stress_score: float
    risk_category: str
    recommended_action: str


# ---- tunable weights (documented, exposed here so they're easy to demo/tweak) ----
GW_STAGE_WEIGHT = 0.75
GW_FLUCTUATION_WEIGHT = 0.25
GW_TREND_BUMP = 6.0            # points added/subtracted for worsening/improving trend

SUPPLY_COVERAGE_WEIGHT = 0.5
SUPPLY_GAP_WEIGHT = 0.5

COMBINED_GW_WEIGHT = 0.45
COMBINED_SUPPLY_WEIGHT = 0.45
COMBINED_INTERACTION_WEIGHT = 0.10   # rewards compound (both-high) stress

RISK_THRESHOLDS = {
    "Low": (0, 25),
    "Moderate": (25, 45),
    "High": (45, 65),
    "Critical": (65, 100.01),
}

STAGE_NORMALIZATION_CAP = 130   # % extraction stage treated as "100" on the 0-100 scale
FLUCTUATION_NORMALIZATION_CAP = 15  # metres of seasonal fluctuation treated as "100"


def _clip(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def groundwater_stress_score(stage_pct: float, fluctuation_m: float, trend: str) -> float:
    stage_component = _clip(stage_pct, 0, STAGE_NORMALIZATION_CAP) / STAGE_NORMALIZATION_CAP * 100
    fluctuation_component = _clip(fluctuation_m, 0, FLUCTUATION_NORMALIZATION_CAP) / FLUCTUATION_NORMALIZATION_CAP * 100

    trend_bump = 0.0
    if trend == "Declining (Worsening)":
        trend_bump = GW_TREND_BUMP
    elif trend == "Improving":
        trend_bump = -GW_TREND_BUMP

    score = GW_STAGE_WEIGHT * stage_component + GW_FLUCTUATION_WEIGHT * fluctuation_component + trend_bump
    return round(_clip(score), 1)


def water_supply_gap_score(coverage_pct: float, supply_gap_pct: float) -> float:
    coverage_gap_component = 100 - _clip(coverage_pct)
    score = SUPPLY_COVERAGE_WEIGHT * coverage_gap_component + SUPPLY_GAP_WEIGHT * _clip(supply_gap_pct)
    return round(_clip(score), 1)


def combined_water_stress_score(gw_score: float, supply_score: float) -> float:
    score = (
        COMBINED_GW_WEIGHT * gw_score
        + COMBINED_SUPPLY_WEIGHT * supply_score
        + COMBINED_INTERACTION_WEIGHT * (gw_score * supply_score) / 100
    )
    return round(_clip(score), 1)


def risk_category(score: float) -> str:
    for label, (lo, hi) in RISK_THRESHOLDS.items():
        if lo <= score < hi:
            return label
    return "Critical"


def recommended_action(gw_score: float, supply_score: float) -> str:
    gw_high = gw_score >= 50
    supply_high = supply_score >= 50
    if gw_high and supply_high:
        return "Groundwater recharge + Water-supply augmentation"
    if gw_high and not supply_high:
        return "Groundwater conservation + Extraction management"
    if not gw_high and supply_high:
        return "Improve water-supply infrastructure"
    return "Monitor & maintain (low priority)"


def score_area(indicators: RawIndicators) -> StressScores:
    """Run the full engine on one area/year record."""
    gw = groundwater_stress_score(
        indicators.gw_extraction_stage_pct,
        indicators.seasonal_fluctuation_m,
        indicators.gw_trend,
    )
    supply = water_supply_gap_score(
        indicators.piped_coverage_pct,
        indicators.supply_gap_pct,
    )
    combined = combined_water_stress_score(gw, supply)
    return StressScores(
        groundwater_stress_score=gw,
        water_supply_gap_score=supply,
        water_stress_score=combined,
        risk_category=risk_category(combined),
        recommended_action=recommended_action(gw, supply),
    )
