import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMetadata, normalizeQuality, normalizeRecord, riskLevelForScore } from "./dataContract.js";

const thresholds = {
  Low: { minimum: 0, maximum: 25 }, Moderate: { minimum: 25, maximum: 45 },
  High: { minimum: 45, maximum: 65 }, Critical: { minimum: 65, maximum: 100, maximum_inclusive: true },
};

const legacyRecord = {
  location_id: 1, Year: 2025, Region: "Western Maharashtra", District: "Pune", Taluka: "Haveli",
  Village_Ward: "Example", Area_Type: "Rural", Latitude: 18.5, Longitude: 73.8, Population: 1000,
  Households: 200, Annual_Rainfall_mm: 700, Rainy_Days: 60, PreMonsoon_WaterLevel_mbgl: 10,
  PostMonsoon_WaterLevel_mbgl: 5, Seasonal_Fluctuation_m: 5, GW_Extraction_Stage_pct: 70,
  GW_Category_CGWB: "Safe", GW_Historical_Trend: "Stable", Piped_Water_Coverage_pct: 80,
  Service_Norm_LPCD: 55, Actual_Supply_LPCD: 45, Supply_Gap_pct: 18.2, Water_Quality_Issue: false,
  Water_Quality_Type: "None", Tribal_Remote_Area: false, Groundwater_Stress_Score: 45,
  Water_Supply_Gap_Score: 19.1, Water_Stress_Score: 30, Risk_Category: "Moderate",
  Recommended_Action: "Monitor",
};

test("normalizes legacy CSV fields while retaining UI aliases", () => {
  const record = normalizeRecord(legacyRecord, 0, thresholds);
  assert.equal(record.water_stress_score, 30);
  assert.equal(record.Water_Stress_Score, 30);
  assert.equal(record.year, 2025);
  assert.equal(record.location_display_name, "Example");
  assert.equal(record.area_group_display_name, "Haveli");
  assert.equal(record.geography_source_status, "synthetic_unverified");
});

test("rejects missing or malformed scores instead of converting them to zero", () => {
  assert.throws(() => normalizeRecord({ ...legacyRecord, Water_Stress_Score: "" }, 0, thresholds), /missing water_stress_score/);
  assert.throws(() => normalizeRecord({ ...legacyRecord, Water_Stress_Score: "bad" }, 0, thresholds), /finite number/);
  assert.throws(() => riskLevelForScore(null, thresholds), /finite number/);
});

test("uses supplied authoritative thresholds", () => {
  assert.equal(riskLevelForScore(65, thresholds), "Critical");
  const metadata = normalizeMetadata({ latest_year: 2025, risk_thresholds: {
    Low: { minimum: 0, maximum: 20 }, Moderate: { minimum: 20, maximum: 40 },
    High: { minimum: 40, maximum: 60 }, Critical: { minimum: 60, maximum: 100, maximum_inclusive: true },
  } }, "fallback");
  assert.equal(metadata.source, "fallback");
  assert.equal(riskLevelForScore(60, metadata.riskThresholds), "Critical");
});

test("validates backend-authored confidence without recalculating it", () => {
  const quality = normalizeQuality({ confidence: "Low", quality_score: 59.9, supporting_observation_count: 3, dimensions: { freshness: { score: 50 } } });
  assert.equal(quality.confidence, "Low");
  assert.throws(() => normalizeQuality({ confidence: "Certain", quality_score: 100, supporting_observation_count: 3, dimensions: {} }), /invalid confidence/);
});
