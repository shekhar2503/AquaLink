import Papa from "papaparse";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPuneData } from "./loadAquaLinkData";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const row = {
  location_id: 1212, Year: 2025, Region: "Western Maharashtra", District: "Pune", Taluka: "Pune_Taluka_01",
  Village_Ward: "Ward_01212", Area_Type: "Rural", Latitude: 18.5, Longitude: 73.8, Population: 1000,
  Households: 200, Annual_Rainfall_mm: 700, Rainy_Days: 60, PreMonsoon_WaterLevel_mbgl: 10,
  PostMonsoon_WaterLevel_mbgl: 5, Seasonal_Fluctuation_m: 5, GW_Extraction_Stage_pct: 70,
  GW_Category_CGWB: "Safe", GW_Historical_Trend: "Stable", Piped_Water_Coverage_pct: 80,
  Service_Norm_LPCD: 55, Actual_Supply_LPCD: 45, Supply_Gap_pct: 18.2, Water_Quality_Issue: false,
  Water_Quality_Type: "None", Tribal_Remote_Area: false, Groundwater_Stress_Score: 45,
  Water_Supply_Gap_Score: 19.1, Water_Stress_Score: 30, Risk_Category: "Moderate",
  Recommended_Action: "Monitor",
};
const risk_thresholds = {
  Low: { minimum: 0, maximum: 25 }, Moderate: { minimum: 25, maximum: 45 },
  High: { minimum: 45, maximum: 65 }, Critical: { minimum: 65, maximum: 100, maximum_inclusive: true },
};

describe("local fallback loader", () => {
  it("labels fallback results and preserves a valid record", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/aqualinkData.csv")) return { ok: true, status: 200, text: async () => Papa.unparse([row]) };
      if (url.endsWith("/aqualinkMetadata.json")) return { ok: true, status: 200, json: async () => ({ synthetic: true, scoring_version: "score-v1", risk_thresholds }) };
      return { ok: false, status: 503, json: async () => ({}) };
    });
    const result = await loadPuneData("pune", 2025);
    expect(result.metadata.source).toBe("fallback");
    expect(result.metadata.fallbackReason).toMatch(/503/);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].water_stress_score).toBe(30);
    expect(result.quality).toBeNull();
  });
});
