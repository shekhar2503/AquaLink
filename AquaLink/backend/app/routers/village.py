from fastapi import APIRouter, HTTPException, Query
from app.core import data as data_layer, engine
from app.core.geography import safe_geography_fields
from app.core.quality import assess_prototype_record

router = APIRouter(prefix="/village", tags=["Village"])


@router.get("/{location_id}")
def village_detail(location_id: int, year: int | None = Query(default=None)):
    """
    Full multi-year record for one village/ward -- powers the drill-down
    panel (trend line + latest score breakdown + recommendation) when a
    marker or ranking row is clicked.
    """
    hist = data_layer.village_history(location_id)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No village found with location_id={location_id}")

    selected = hist[hist.Year == year] if year is not None else hist.tail(1)
    if selected.empty:
        raise HTTPException(status_code=404, detail=f"No record found for location_id={location_id}, year={year}")
    latest = selected.iloc[-1].to_dict()
    engine.authoritative_record(latest)
    latest_indicators = engine.indicators_from_record(latest)
    explanation = engine.explain_score(latest_indicators)
    geography = safe_geography_fields(latest)
    quality = assess_prototype_record(latest, len(hist), data_layer.latest_year(), geography["coordinate_status"])

    return {
        **geography,
        "location_id": location_id,
        "district": latest["District"],
        "taluka": latest["Taluka"],
        "village_ward": latest["Village_Ward"],
        "latest_year": int(latest["Year"]),
        "latest_scores": {
            "groundwater_stress_score": explanation["groundwater_stress_score"],
            "water_supply_gap_score": explanation["water_supply_gap_score"],
            "water_stress_score": explanation["water_stress_score"],
            "risk_category": explanation["risk_category"],
            "recommended_action": explanation["recommended_action"],
            "recommendation": explanation["recommendation"],
            "score_version": explanation["score_version"],
        },
        "explanation": explanation,
        "quality": quality,
        "history": hist[[
            "Year", "GW_Extraction_Stage_pct", "Piped_Water_Coverage_pct",
            "Groundwater_Stress_Score", "Water_Supply_Gap_Score",
            "Water_Stress_Score", "Risk_Category",
        ]].to_dict(orient="records"),
    }


@router.get("/{location_id}/explain")
def village_explanation(location_id: int, year: int | None = Query(default=None)):
    """
    Detailed explainability endpoint: breaks down how Groundwater, Supply Gap,
    and Interaction components contributed to the final Water Stress Score.
    """
    hist = data_layer.village_history(location_id)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No village found with location_id={location_id}")

    selected = hist[hist.Year == year] if year is not None else hist.tail(1)
    if selected.empty:
        raise HTTPException(status_code=404, detail=f"No record found for location_id={location_id}, year={year}")
    latest = selected.iloc[-1].to_dict()
    engine.authoritative_record(latest)
    indicators = engine.indicators_from_record(latest)
    res = engine.explain_score(indicators)
    res["location_id"] = location_id
    res["year"] = int(latest["Year"])
    res["district"] = latest["District"]
    res["taluka"] = latest["Taluka"]
    res["village_ward"] = latest["Village_Ward"]
    geography = safe_geography_fields(latest)
    res.update(geography)
    res["quality"] = assess_prototype_record(latest, len(hist), data_layer.latest_year(), geography["coordinate_status"])
    return res

