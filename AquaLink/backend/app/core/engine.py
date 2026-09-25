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
import math

SCORING_VERSION = "aqualink-score-v1.1.0"


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
    recommendation: "Recommendation"


@dataclass(frozen=True)
class Recommendation:
    action_code: str
    priority: str
    recommended_action: str
    drivers: list[str]
    rationale: str
    score_version: str = SCORING_VERSION


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


def risk_thresholds_metadata() -> dict:
    labels = list(RISK_THRESHOLDS)
    return {
        label: {
            "minimum": bounds[0],
            "maximum": 100 if label == "Critical" else bounds[1],
            "minimum_inclusive": True,
            "maximum_inclusive": index == len(labels) - 1,
        }
        for index, (label, bounds) in enumerate(RISK_THRESHOLDS.items())
    }

STAGE_NORMALIZATION_CAP = 130   # % extraction stage treated as "100" on the 0-100 scale
FLUCTUATION_NORMALIZATION_CAP = 15  # metres of seasonal fluctuation treated as "100"


def _clip(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Score inputs must be finite numbers")
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
    if not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 100:
        raise ValueError("Water stress score must be a finite value between 0 and 100")
    for label, (lo, hi) in RISK_THRESHOLDS.items():
        if lo <= score < hi:
            return label
    return "Critical"


def recommendation_for(gw_score: float, supply_score: float, trend: str = "Stable") -> Recommendation:
    """
    Cause-and-effect decision matrix for interventions:
    Evaluates underlying stress drivers (Groundwater Extraction vs Supply Gap)
    and trend direction to output actionable intervention guidance.
    """
    for name, value in (("groundwater", gw_score), ("supply-gap", supply_score)):
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError(f"{name} score must be a finite value between 0 and 100")
    if trend not in {"Improving", "Stable", "Declining", "Declining (Worsening)"}:
        raise ValueError(f"Unsupported groundwater trend: {trend}")

    gw_high = gw_score >= 45.0
    supply_high = supply_score >= 45.0
    is_declining = trend in ["Declining (Worsening)", "Declining"]

    if gw_high and supply_high:
        return Recommendation(
            "compound_stress", "urgent", "Groundwater recharge + Water-supply augmentation",
            ["groundwater_stress_high", "supply_gap_stress_high"],
            "Both groundwater and water-supply stress scores meet the intervention threshold.",
        )
    if gw_high:
        if is_declining:
            return Recommendation(
                "groundwater_declining", "urgent", "Urgent groundwater recharge & artificial extraction controls",
                ["groundwater_stress_high", "groundwater_trend_declining"],
                "Groundwater stress is high and the historical groundwater trend is declining.",
            )
        return Recommendation(
            "groundwater_stress", "high", "Groundwater conservation & extraction management",
            ["groundwater_stress_high"], "Groundwater stress meets the intervention threshold.",
        )
    if supply_high:
        return Recommendation(
            "supply_gap", "high", "Improve piped water-supply infrastructure & LPCD distribution",
            ["supply_gap_stress_high"], "Water-supply gap stress meets the intervention threshold.",
        )
    if is_declining:
        return Recommendation(
            "declining_trend", "medium", "Increase groundwater table monitoring & rainwater harvesting",
            ["groundwater_trend_declining"],
            "The groundwater trend is declining even though current component scores are below intervention thresholds.",
        )
    return Recommendation(
        "monitor", "routine", "Monitor & maintain (low priority)", ["scores_below_intervention_thresholds"],
        "Groundwater and supply-gap stress scores are below intervention thresholds.",
    )


def recommended_action(gw_score: float, supply_score: float, trend: str = "Stable") -> str:
    """Compatibility accessor for the dataset's stored action string."""
    return recommendation_for(gw_score, supply_score, trend).recommended_action


def explain_score(indicators: RawIndicators) -> dict:
    """
    Generates dynamic score explainability breakdown detailing exact
    contributions of Groundwater, Supply Gap, and Compound Interaction.
    """
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
    risk = risk_category(combined)
    recommendation = recommendation_for(gw, supply, indicators.gw_trend)

    gw_contrib = round(COMBINED_GW_WEIGHT * gw, 3)
    supply_contrib = round(COMBINED_SUPPLY_WEIGHT * supply, 3)
    interaction_contrib = round(COMBINED_INTERACTION_WEIGHT * (gw * supply) / 100, 3)

    tot = max(gw_contrib + supply_contrib + interaction_contrib, 0.1)
    gw_pct_share = round((gw_contrib / tot) * 100, 1)
    supply_pct_share = round((supply_contrib / tot) * 100, 1)
    interaction_pct_share = round((interaction_contrib / tot) * 100, 1)

    contributors = []
    if indicators.gw_extraction_stage_pct >= 90:
        contributors.append(f"High GW Extraction ({indicators.gw_extraction_stage_pct}% stage)")
    if indicators.seasonal_fluctuation_m >= 8:
        contributors.append(f"High Seasonal Fluctuation ({indicators.seasonal_fluctuation_m}m)")
    if indicators.gw_trend in ["Declining (Worsening)", "Declining"]:
        contributors.append("Declining GW Table Trend (+6pt penalty)")
    if indicators.piped_coverage_pct < 80:
        contributors.append(f"Low Piped Tap Coverage ({indicators.piped_coverage_pct}%)")
    if indicators.supply_gap_pct > 15:
        contributors.append(f"Significant Supply Deficit ({indicators.supply_gap_pct}% vs norm)")

    if not contributors:
        contributors.append("All monitored indicators within normal parameters")

    return {
        "water_stress_score": combined,
        "score_version": SCORING_VERSION,
        "risk_category": risk,
        "risk_classification_standard": "AquaLink project-defined risk classification thresholds",
        "groundwater_stress_score": gw,
        "water_supply_gap_score": supply,
        "breakdown": {
            "groundwater_contribution": gw_contrib,
            "groundwater_percentage_share": gw_pct_share,
            "supply_gap_contribution": supply_contrib,
            "supply_gap_percentage_share": supply_pct_share,
            "interaction_contribution": interaction_contrib,
            "interaction_percentage_share": interaction_pct_share,
            "unrounded_total": round(gw_contrib + supply_contrib + interaction_contrib, 3),
            "weights": {
                "groundwater": COMBINED_GW_WEIGHT,
                "supply_gap": COMBINED_SUPPLY_WEIGHT,
                "interaction": COMBINED_INTERACTION_WEIGHT,
            },
        },
        "main_contributors": contributors,
        "recommendation": recommendation.__dict__,
        "recommended_action": recommendation.recommended_action,
    }


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
    recommendation = recommendation_for(gw, supply, indicators.gw_trend)
    return StressScores(
        groundwater_stress_score=gw,
        water_supply_gap_score=supply,
        water_stress_score=combined,
        risk_category=risk_category(combined),
        recommended_action=recommendation.recommended_action,
        recommendation=recommendation,
    )


def indicators_from_record(record: dict) -> RawIndicators:
    """Build authoritative engine inputs from a canonical dataset record."""
    return RawIndicators(
        gw_extraction_stage_pct=float(record["GW_Extraction_Stage_pct"]),
        seasonal_fluctuation_m=float(record["Seasonal_Fluctuation_m"]),
        gw_trend=str(record["GW_Historical_Trend"]),
        piped_coverage_pct=float(record["Piped_Water_Coverage_pct"]),
        supply_gap_pct=float(record["Supply_Gap_pct"]),
    )


def authoritative_record(record: dict, verify_stored: bool = True) -> dict:
    """Return engine-owned fields and reject stale stored derivations."""
    scores = score_area(indicators_from_record(record))
    expected = {
        "Groundwater_Stress_Score": scores.groundwater_stress_score,
        "Water_Supply_Gap_Score": scores.water_supply_gap_score,
        "Water_Stress_Score": scores.water_stress_score,
        "Risk_Category": scores.risk_category,
        "Recommended_Action": scores.recommended_action,
    }
    if verify_stored:
        for field, value in expected.items():
            stored = record.get(field)
            agrees = math.isclose(float(stored), float(value), abs_tol=1e-9) if field.endswith("_Score") else stored == value
            if not agrees:
                raise ValueError(f"Stored {field} disagrees with {SCORING_VERSION}: {stored!r} != {value!r}")
    return {**record, **expected, "Score_Version": SCORING_VERSION, "Recommendation": scores.recommendation.__dict__}

