"""
AquaLink data layer.

Loads the prototype dataset once at startup and exposes simple, typed
query functions. Swapping this file's internals for a real database
(Postgres/PostGIS) later should not require changing the routers.
"""

from __future__ import annotations
from pathlib import Path
from functools import lru_cache
import pandas as pd

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "aqualink_dataset.csv"


@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH)
    return df


def latest_year(df: pd.DataFrame | None = None) -> int:
    df = df if df is not None else load_dataset()
    return int(df.Year.max())


def get_districts(df: pd.DataFrame | None = None) -> list[str]:
    df = df if df is not None else load_dataset()
    return sorted(df.District.unique().tolist())


def filter_records(
    district: str | None = None,
    region: str | None = None,
    year: int | None = None,
    risk: str | None = None,
    tribal_only: bool = False,
) -> pd.DataFrame:
    df = load_dataset()
    if year is not None:
        df = df[df.Year == year]
    if district is not None:
        df = df[df.District.str.lower() == district.lower()]
    if region is not None:
        df = df[df.Region.str.lower() == region.lower()]
    if risk is not None:
        df = df[df.Risk_Category.str.lower() == risk.lower()]
    if tribal_only:
        df = df[df.Tribal_Remote_Area == True]  # noqa: E712
    return df


def district_summary(year: int | None = None) -> pd.DataFrame:
    df = load_dataset()
    if year is not None:
        df = df[df.Year == year]
    else:
        df = df[df.Year == latest_year(df)]

    agg = (
        df.groupby(["Region", "District"])
        .agg(
            avg_water_stress_score=("Water_Stress_Score", "mean"),
            avg_gw_stress_score=("Groundwater_Stress_Score", "mean"),
            avg_supply_gap_score=("Water_Supply_Gap_Score", "mean"),
            villages_count=("location_id", "count"),
            critical_count=("Risk_Category", lambda s: (s == "Critical").sum()),
            high_count=("Risk_Category", lambda s: (s == "High").sum()),
        )
        .reset_index()
    )
    agg = agg.round(1).sort_values("avg_water_stress_score", ascending=False)
    return agg


def village_history(location_id: int) -> pd.DataFrame:
    df = load_dataset()
    return df[df.location_id == location_id].sort_values("Year")
