from fastapi import APIRouter, HTTPException
from app.core import data as data_layer

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
        "history": hist[[
            "Year", "GW_Extraction_Stage_pct", "Piped_Water_Coverage_pct",
            "Groundwater_Stress_Score", "Water_Supply_Gap_Score",
            "Water_Stress_Score", "Risk_Category",
        ]].to_dict(orient="records"),
    }
