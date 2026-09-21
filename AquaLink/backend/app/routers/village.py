from fastapi import APIRouter, HTTPException
from app.core import data as data_layer, engine

router = APIRouter(prefix="/village", tags=["Village"])


@router.get("/{location_id}")
def village_detail(location_id: int):
    """
    Full multi-year record for one village/ward -- powers the drill-down
    panel (trend line + latest score breakdown + recommendation) when a
    marker or ranking row is clicked.
    """
    hist = data_layer.village_history(location_id)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No village found with location_id={location_id}")

    latest = hist.iloc[-1].to_dict()
    latest_indicators = engine.RawIndicators(
        gw_extraction_stage_pct=float(latest["GW_Extraction_Stage_pct"]),
        seasonal_fluctuation_m=float(latest["Seasonal_Fluctuation_m"]),
        gw_trend=str(latest["GW_Historical_Trend"]),
        piped_coverage_pct=float(latest["Piped_Water_Coverage_pct"]),
        supply_gap_pct=float(latest["Supply_Gap_pct"]),
    )
    explanation = engine.explain_score(latest_indicators)

    return {
        "location_id": location_id,
        "district": latest["District"],
        "taluka": latest["Taluka"],
        "village_ward": latest["Village_Ward"],
        "latest_year": int(latest["Year"]),
        "latest_scores": {
            "groundwater_stress_score": latest["Groundwater_Stress_Score"],
            "water_supply_gap_score": latest["Water_Supply_Gap_Score"],
            "water_stress_score": latest["Water_Stress_Score"],
            "risk_category": latest["Risk_Category"],
            "recommended_action": latest["Recommended_Action"],
        },
        "explanation": explanation,
        "history": hist[[
            "Year", "GW_Extraction_Stage_pct", "Piped_Water_Coverage_pct",
            "Groundwater_Stress_Score", "Water_Supply_Gap_Score",
            "Water_Stress_Score", "Risk_Category",
        ]].to_dict(orient="records"),
    }


@router.get("/{location_id}/explain")
def village_explanation(location_id: int):
    """
    Detailed explainability endpoint: breaks down how Groundwater, Supply Gap,
    and Interaction components contributed to the final Water Stress Score.
    """
    hist = data_layer.village_history(location_id)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No village found with location_id={location_id}")

    latest = hist.iloc[-1].to_dict()
    indicators = engine.RawIndicators(
        gw_extraction_stage_pct=float(latest["GW_Extraction_Stage_pct"]),
        seasonal_fluctuation_m=float(latest["Seasonal_Fluctuation_m"]),
        gw_trend=str(latest["GW_Historical_Trend"]),
        piped_coverage_pct=float(latest["Piped_Water_Coverage_pct"]),
        supply_gap_pct=float(latest["Supply_Gap_pct"]),
    )
    res = engine.explain_score(indicators)
    res["location_id"] = location_id
    res["district"] = latest["District"]
    res["taluka"] = latest["Taluka"]
    res["village_ward"] = latest["Village_Ward"]
    return res

