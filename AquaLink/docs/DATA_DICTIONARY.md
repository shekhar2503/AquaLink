# AquaLink — Maharashtra Water Stress Prototype Dataset

**File:** `AquaLink_Maharashtra_WaterStress_Dataset.csv`
**Rows:** 37,025 | **Columns:** 31
**Coverage:** All 36 districts of Maharashtra → 368 talukas → 7,405 villages/wards → 5 years (2020–2024)

## What this is
A **synthetic but hydrogeologically-grounded** dataset built for the AquaLink Round-1 prototype. Real village-level open data combining CGWB groundwater assessments and JJM tap-connection records does not exist as one downloadable file — so each district was seeded with real, sourced baseline parameters (see below), and village/taluka/year-level records were simulated around those baselines with realistic noise, correlations, and multi-year trends.

**This is a simulation for prototyping the Water Stress Engine — not scraped real records.** Be upfront about this if asked during evaluation; it's a normal and expected approach for a Round-1 SIH prototype.

## Reference sources used to set district baselines
1. **CGWB "Dynamic Ground Water Resources of India" (2023/2025)** — official Stage-of-Extraction categories: Safe ≤70%, Semi-Critical 70–90%, Critical 90–100%, Over-Exploited >100%.
2. **CGWB / GSDA district reports** and the Rajiv Gandhi Institute for Contemporary Studies groundwater review — used to anchor which Maharashtra districts are known over-exploited/critical belts: Beed, Latur, Dharashiv (Osmanabad), Jalna (Marathwada); Jalgaon, Ahmednagar (North Maharashtra); Solapur, Sangli (western Maharashtra sugar belt); Buldhana/Akola (Vidarbha-west).
3. **Jal Jeevan Mission (JJM) progress reports** (Feb 2025 / Oct 2025) — national rural tap coverage ~80–82%, used to calibrate the coverage-gain-by-year trend (JJM rollout effect 2020→2024).
4. **JJM service norm**: 55 LPCD rural / CPHEEO norm ~135–150 LPCD urban.
5. **Known access-gap tribal belts** despite adequate rainfall: Palghar, Nandurbar, Gadchiroli — documented in JJM district dashboards / tribal development reports.
6. **IMD long-period rainfall averages** by zone: Konkan (2000–3500+ mm), Western Ghats wet belt, Marathwada rain-shadow (550–800 mm), Vidarbha (900–1450 mm).

## Data dictionary

| Column | Description |
|---|---|
| `location_id` | Unique village/ward identifier (constant across years) |
| `Year` | 2020–2024 |
| `Region` | One of 6 divisions (Konkan, Western Maharashtra, North Maharashtra, Marathwada, Vidarbha-Amravati, Vidarbha-Nagpur) |
| `District`, `Taluka`, `Village_Ward` | Administrative hierarchy (district names real; taluka/village identifiers synthetic) |
| `Area_Type` | Urban / Rural |
| `Latitude`, `Longitude` | Synthetic coordinates jittered around each district's real centroid (for GIS map demo) |
| `Population`, `Households` | Simulated |
| `Annual_Rainfall_mm`, `Rainy_Days` | Simulated around IMD district rainfall norms, with a below-normal 2023 monsoon reflected |
| `PreMonsoon_WaterLevel_mbgl` / `PostMonsoon_WaterLevel_mbgl` | Depth to water table, metres below ground level |
| `Seasonal_Fluctuation_m` | Pre − Post monsoon depth (depletion proxy) |
| `GW_Extraction_Stage_pct` | CGWB-style Stage of Groundwater Extraction (%) |
| `GW_Category_CGWB` | Safe / Semi-Critical / Critical / Over-Exploited (CGWB thresholds) |
| `GW_Historical_Trend` | Improving / Stable / Declining (Worsening), from 5-yr slope |
| `Piped_Water_Coverage_pct` | % households with piped/tap connection |
| `Service_Norm_LPCD` | 55 (rural) / 135–150 (urban) |
| `Actual_Supply_LPCD` | Simulated actual per-capita supply |
| `Supply_Gap_pct` | Shortfall vs. norm, % |
| `Water_Quality_Issue`, `Water_Quality_Type` | Flag + type (Fluoride/Nitrate/Salinity/Iron), probability rises with extraction stage |
| `Tribal_Remote_Area` | Known low-access belt flag |
| `Groundwater_Stress_Score` | 0–100, engine output |
| `Water_Supply_Gap_Score` | 0–100, engine output |
| `Water_Stress_Score` | Combined score (see formula below) |
| `Risk_Category` | Low (<25) / Moderate (25–45) / High (45–65) / Critical (≥65) |
| `Recommended_Action` | Rule-based recommendation per PS logic |

## Scoring formulas (tunable — exposed as parameters in the prototype)
```
Groundwater_Stress_Score = 0.75 × (Stage/130×100) + 0.25 × (Fluctuation/15×100) + trend_bump(±6)
Water_Supply_Gap_Score   = 0.5 × (100 − Coverage%) + 0.5 × Supply_Gap%
Water_Stress_Score       = 0.45×GW_Score + 0.45×Supply_Score + 0.10×(GW_Score×Supply_Score)/100
```
The interaction term is deliberate: it rewards **compound stress** (both dimensions bad at once) rather than averaging it away — this is the exact gap the PS identifies in existing single-dimension platforms.

## Known limitations (disclose these to the jury proactively)
- Village/taluka names are synthetic identifiers, not the official Census/LGD village list — swap-in for real LGD codes is the natural next step for a working version.
- Correlations (rainfall↔extraction stage, stage↔water-quality-risk) are hand-modeled from documented regional patterns, not fitted to raw CGWB well-monitoring data.
- No real Census 2011/2021 population figures were used — population is simulated, not sourced.
- Real deployment should replace this with CGWB WRIS/INDIA-WRIS API + JJM IMIS dashboard exports + GSDA data.
