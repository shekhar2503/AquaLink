from datetime import datetime, timezone

from fastapi import APIRouter

from app.core import data as data_layer
from app.core.engine import SCORING_VERSION, risk_thresholds_metadata
from app.core.quality import methodology_metadata
from app.schemas import MetadataResponse

router = APIRouter(tags=["Metadata"])


@router.get("/metadata", response_model=MetadataResponse)
def get_metadata():
    df = data_layer.load_dataset()
    return {
        "api_version": "1.0.0",
        "scoring_version": SCORING_VERSION,
        "source_type": "synthetic_csv",
        "synthetic": True,
        "canonical_source": "backend/data/aqualink_dataset.csv",
        "last_updated": datetime.fromtimestamp(data_layer.DATA_PATH.stat().st_mtime, tz=timezone.utc),
        "year_range": {"minimum": int(df.Year.min()), "maximum": int(df.Year.max())},
        "latest_year": data_layer.latest_year(df),
        "record_count": len(df),
        "location_count": int(df.location_id.nunique()),
        "district_count": int(df.District.nunique()),
        "risk_thresholds": risk_thresholds_metadata(),
        "quality_methodology": methodology_metadata(),
    }
