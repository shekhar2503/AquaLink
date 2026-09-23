import { talukaNames } from "./talukaNames";

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
    const score = Number(candidate);
    if (Number.isFinite(score)) return score;
  }

  return 0;
}

export function getRiskLevel(score) {
  const value = Number(score || 0);
  if (value >= 65) return "Critical";
  if (value >= 45) return "High";
  if (value >= 25) return "Moderate";
  return "Low";
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

  const raw = String(rawValue || "Unknown Taluka").trim();
  const directMatch = talukaNames[raw];
  if (directMatch) return directMatch;

  const caseInsensitiveKey = Object.keys(talukaNames).find(
    (key) => key.toLowerCase() === raw.toLowerCase(),
  );

  return caseInsensitiveKey
    ? talukaNames[caseInsensitiveKey]
    : raw.replaceAll("_", " ");
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
