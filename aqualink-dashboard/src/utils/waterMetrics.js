import { riskLevelForScore } from "./dataContract.js";
import { talukaNames } from "./talukaNames.js";

let configuredRiskThresholds = null;


export function configureRiskThresholds(thresholds) {
  configuredRiskThresholds = thresholds;
}

export const RISK_COLORS = {
  Low: "#34d399",
  Moderate: "#facc15",
  High: "#fb923c",
  Critical: "#fb7185",
};

export function getWaterScore(item) {
  const candidates = [
    item?.Water_Stress_Score,
    item?.water_stress_score,
    item?.WaterStressScore,
    item?.["Water Stress Score"],
    item?.["Stress Score"],
    item?.Stress_Score,
    item?.stress_score,
    item?.Score,
    item?.score,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") continue;
    const score = Number(candidate);
    if (Number.isFinite(score)) return score;
  }

  throw new TypeError("AquaLink record is missing a valid water stress score");
}

export function getStressScore(item, layer = "combined") {
  const fields = {
    combined: ["water_stress_score", "Water_Stress_Score"],
    groundwater: ["groundwater_stress_score", "Groundwater_Stress_Score"],
    supply: ["water_supply_gap_score", "Water_Supply_Gap_Score"],
  };
  for (const field of fields[layer] ?? fields.combined) {
    const value = item?.[field];
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  throw new TypeError(`AquaLink record is missing a valid ${layer} stress score`);
}

export function getRiskLevel(score) {
  return riskLevelForScore(score, configuredRiskThresholds);
}

export function getRiskClass(riskOrScore) {
  const risk =
    typeof riskOrScore === "number"
      ? getRiskLevel(riskOrScore)
      : riskOrScore;

  return `risk-${String(risk || "Low").toLowerCase()}`;
}

export function getTalukaName(itemOrName) {
  const rawValue =
    typeof itemOrName === "string"
      ? itemOrName
      : itemOrName?.Taluka ??
        itemOrName?.taluka ??
        itemOrName?.TALUKA ??
        itemOrName?.Taluka_Name ??
        itemOrName?.taluka_name ??
        "Unknown Taluka";

  const raw = String(rawValue || "Unknown source area").trim();
  if (talukaNames[raw]) return talukaNames[raw];
  return raw.replaceAll("_", " ");
}

export function getLocationName(item) {
  const sourceName = item?.village_ward ?? item?.Village_Ward;
  if (sourceName) return String(sourceName).trim().replaceAll("_", " ");
  if (item?.location_display_name) return String(item.location_display_name).trim().replaceAll("_", " ");
  const id = Number(item?.location_id ?? item?.ID ?? item?.id);
  return Number.isInteger(id) ? `Location ${String(id).padStart(5, "0")}` : "Unknown location";
}

export function normalizeLocation(item, index = 0) {
  const latitude = Number(
    item?.Latitude ?? item?.latitude ?? item?.LATITUDE ?? item?.Lat ?? item?.lat,
  );
  const longitude = Number(
    item?.Longitude ??
      item?.longitude ??
      item?.LONGITUDE ??
      item?.Lng ??
      item?.lng ??
      item?.Lon ??
      item?.lon,
  );
  const score = getWaterScore(item);

  return {
    ...item,
    _id: item?.location_id ?? item?.ID ?? item?.id ?? item?.Location_ID ?? index,
    _latitude: latitude,
    _longitude: longitude,
    _score: score,
    _risk: getRiskLevel(score),
    _taluka: getTalukaName(item),
  };
}
