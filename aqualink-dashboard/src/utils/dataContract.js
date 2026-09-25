const aliases = {
  year: ["year", "Year"], region: ["region", "Region"], district: ["district", "District"],
  taluka: ["taluka", "Taluka"], village_ward: ["village_ward", "Village_Ward"],
  area_type: ["area_type", "Area_Type"], latitude: ["latitude", "Latitude"],
  longitude: ["longitude", "Longitude"], population: ["population", "Population"],
  households: ["households", "Households"], annual_rainfall_mm: ["annual_rainfall_mm", "Annual_Rainfall_mm"],
  rainy_days: ["rainy_days", "Rainy_Days"], pre_monsoon_water_level_mbgl: ["pre_monsoon_water_level_mbgl", "PreMonsoon_WaterLevel_mbgl"],
  post_monsoon_water_level_mbgl: ["post_monsoon_water_level_mbgl", "PostMonsoon_WaterLevel_mbgl"],
  seasonal_fluctuation_m: ["seasonal_fluctuation_m", "Seasonal_Fluctuation_m"],
  gw_extraction_stage_pct: ["gw_extraction_stage_pct", "GW_Extraction_Stage_pct"],
  gw_category_cgwb: ["gw_category_cgwb", "GW_Category_CGWB"],
  gw_historical_trend: ["gw_historical_trend", "GW_Historical_Trend"],
  piped_water_coverage_pct: ["piped_water_coverage_pct", "Piped_Water_Coverage_pct"],
  service_norm_lpcd: ["service_norm_lpcd", "Service_Norm_LPCD"], actual_supply_lpcd: ["actual_supply_lpcd", "Actual_Supply_LPCD"],
  supply_gap_pct: ["supply_gap_pct", "Supply_Gap_pct"], water_quality_issue: ["water_quality_issue", "Water_Quality_Issue"],
  water_quality_type: ["water_quality_type", "Water_Quality_Type"], tribal_remote_area: ["tribal_remote_area", "Tribal_Remote_Area"],
  groundwater_stress_score: ["groundwater_stress_score", "Groundwater_Stress_Score"],
  water_supply_gap_score: ["water_supply_gap_score", "Water_Supply_Gap_Score"],
  water_stress_score: ["water_stress_score", "Water_Stress_Score"], risk_category: ["risk_category", "Risk_Category"],
  recommended_action: ["recommended_action", "Recommended_Action"],
};
const legacyNames = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, names[1]]));
const numericFields = new Set(["year", "latitude", "longitude", "population", "households", "annual_rainfall_mm", "rainy_days", "pre_monsoon_water_level_mbgl", "post_monsoon_water_level_mbgl", "seasonal_fluctuation_m", "gw_extraction_stage_pct", "piped_water_coverage_pct", "service_norm_lpcd", "actual_supply_lpcd", "supply_gap_pct", "groundwater_stress_score", "water_supply_gap_score", "water_stress_score"]);

function firstValue(record, names) {
  for (const name of names) if (record[name] !== undefined && record[name] !== null && record[name] !== "") return record[name];
  return undefined;
}
function finiteNumber(value, field, context) {
  if (value === null || value === undefined || value === "" || (typeof value === "string" && !value.trim())) {
    throw new TypeError(`${context}: ${field} must be a finite number`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${context}: ${field} must be a finite number`);
  return parsed;
}
function booleanValue(value, field, context) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || String(value).toLowerCase() === "true") return true;
  if (value === 0 || value === "0" || String(value).toLowerCase() === "false") return false;
  throw new TypeError(`${context}: ${field} must be a boolean`);
}
export function riskLevelForScore(score, thresholds) {
  if (!thresholds) throw new TypeError("Risk classification requires backend-authored thresholds");
  const value = finiteNumber(score, "water_stress_score", "Risk classification");
  const match = Object.entries(thresholds).find(([, rule]) => value >= Number(rule.minimum) && (rule.maximum_inclusive ? value <= Number(rule.maximum) : value < Number(rule.maximum)));
  if (!match) throw new RangeError(`Risk classification: score ${value} is outside configured thresholds`);
  return match[0];
}
export function normalizeQuality(quality, context = "Quality assessment") {
  if (!quality || typeof quality !== "object") throw new TypeError(`${context}: missing quality assessment`);
  if (!["High", "Medium", "Low"].includes(quality.confidence)) throw new TypeError(`${context}: invalid confidence level`);
  finiteNumber(quality.quality_score, "quality_score", context);
  finiteNumber(quality.supporting_observation_count, "supporting_observation_count", context);
  if (!quality.dimensions || typeof quality.dimensions !== "object") throw new TypeError(`${context}: missing component dimensions`);
  return quality;
}
export function normalizeRecord(record, index = 0, thresholds) {
  if (!record || typeof record !== "object") throw new TypeError(`Record ${index}: expected an object`);
  const context = `Record ${index}`;
  const normalized = { location_id: finiteNumber(firstValue(record, ["location_id", "Location_ID", "id"]), "location_id", context) };
  for (const [field, names] of Object.entries(aliases)) {
    const value = firstValue(record, names);
    if (value === undefined) throw new TypeError(`${context}: missing ${field}`);
    normalized[field] = numericFields.has(field) ? finiteNumber(value, field, context) : value;
  }
  normalized.water_quality_issue = booleanValue(normalized.water_quality_issue, "water_quality_issue", context);
  normalized.tribal_remote_area = booleanValue(normalized.tribal_remote_area, "tribal_remote_area", context);
  const calculatedRisk = riskLevelForScore(normalized.water_stress_score, thresholds);
  if (normalized.risk_category !== calculatedRisk) throw new TypeError(`${context}: risk_category ${normalized.risk_category} disagrees with score (${calculatedRisk})`);
  normalized.recommendation = record.recommendation ?? record.Recommendation ?? {
    action_code: "stored_dataset_action", priority: null,
    recommended_action: normalized.recommended_action, drivers: [],
    rationale: "Recommendation supplied by the engine-validated fallback dataset.",
    score_version: record.score_version ?? record.Score_Version ?? null,
  };
  normalized.score_version = record.score_version ?? record.Score_Version ?? normalized.recommendation.score_version;
  const areaNumber = String(normalized.taluka).match(/_Taluka_(\d+)$/i)?.[1] ?? String(normalized.taluka);
  normalized.geography_id = record.geography_id ?? `syn-location-${String(normalized.location_id).padStart(5, "0")}`;
  normalized.area_group_id = record.area_group_id ?? `syn-area-${normalized.district.toLowerCase().replaceAll(" ", "-")}-${areaNumber.toLowerCase()}`;
  // Village_Ward is the most specific source identity currently available.
  // Prefer it over generated display labels so every view refers to the same
  // exact dataset location without implying that it is a verified place name.
  normalized.location_display_name = String(normalized.village_ward).trim().replaceAll("_", " ");
  normalized.area_group_display_name = String(normalized.taluka).trim().replaceAll("_", " ");
  normalized.geography_source_status = record.geography_source_status ?? "synthetic_unverified";
  normalized.coordinate_source = record.coordinate_source ?? "synthetic_prototype";
  normalized.coordinate_status = record.coordinate_status ?? "synthetic_unverified";
  normalized.quality = record.quality ? normalizeQuality(record.quality, `${context} quality`) : null;
  for (const [field, legacy] of Object.entries(legacyNames)) normalized[legacy] = normalized[field];
  return normalized;
}
export function normalizeMetadata(metadata, source = "api") {
  if (!metadata || typeof metadata !== "object") throw new TypeError("Metadata response must be an object");
  const thresholds = metadata.risk_thresholds;
  if (!thresholds) throw new TypeError("Metadata is missing risk_thresholds");
  for (const label of ["Low", "Moderate", "High", "Critical"]) {
    if (!thresholds[label]) throw new TypeError(`Metadata is missing the ${label} threshold`);
    finiteNumber(thresholds[label].minimum, `${label}.minimum`, "Metadata");
    finiteNumber(thresholds[label].maximum, `${label}.maximum`, "Metadata");
  }
  return { source, sourceType: metadata.source_type ?? (source === "api" ? "synthetic_csv" : "bundled_csv"), synthetic: metadata.synthetic ?? true, latestYear: finiteNumber(metadata.latest_year, "latest_year", "Metadata"), yearRange: metadata.year_range, lastUpdated: metadata.last_updated ?? null, scoringVersion: metadata.scoring_version, riskThresholds: thresholds, qualityMethodology: metadata.quality_methodology ?? null };
}
