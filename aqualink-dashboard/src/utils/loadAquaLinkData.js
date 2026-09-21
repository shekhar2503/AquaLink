import Papa from "papaparse";

const API_BASE_URL = "http://localhost:8000";

/*
  AquaLink Standardized Risk Level Helper
  AquaLink project-defined risk classification thresholds:
  - Low: 0 <= Score < 25
  - Moderate: 25 <= Score < 45
  - High: 45 <= Score < 65
  - Critical: 65 <= Score <= 100
*/
export function getStandardizedRiskLevel(score) {
  const value = Number(score || 0);
  if (value >= 65) return "Critical";
  if (value >= 45) return "High";
  if (value >= 25) return "Moderate";
  return "Low";
}

/*
  Load Pune / District locations.
  Primary: FastAPI backend /hotspots
  Fallback: Local /aqualinkData.csv
*/
export async function loadPuneData(district = "pune") {
  // Primary attempt: FastAPI backend
  try {
    const apiRes = await fetch(`${API_BASE_URL}/hotspots?district=${encodeURIComponent(district)}&limit=5000`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data?.results) && data.results.length > 0) {
        console.log(`[AquaLink Data Layer] Loaded ${data.results.length} records from FastAPI backend`);
        return data.results.map((row) => ({
          ...row,
          Latitude: Number(row.Latitude),
          Longitude: Number(row.Longitude),
          Water_Stress_Score: Number(row.Water_Stress_Score || 0),
          Risk_Category: getStandardizedRiskLevel(row.Water_Stress_Score),
        }));
      }
    }
  } catch (err) {
    console.warn("[AquaLink Data Layer] FastAPI backend unavailable, falling back to static CSV:", err.message);
  }

  // Fallback: Local CSV
  const response = await fetch("/aqualinkData.csv");
  const csvText = await response.text();

  const result = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const filteredData = result.data.filter(
    (row) =>
      row.District &&
      String(row.District).trim().toLowerCase() === district.toLowerCase()
  );

  const validYears = filteredData
    .map((row) => Number(row.Year))
    .filter((year) => !isNaN(year));

  if (!validYears.length) {
    console.error(`No valid years found in ${district} data`);
    return [];
  }

  const latestYear = Math.max(...validYears);

  const latestData = filteredData.filter(
    (row) => Number(row.Year) === latestYear
  );

  const locationData = latestData
    .filter(
      (row) =>
        !isNaN(Number(row.Latitude)) &&
        !isNaN(Number(row.Longitude))
    )
    .map((row) => ({
      ...row,
      Latitude: Number(row.Latitude),
      Longitude: Number(row.Longitude),
      Water_Stress_Score: Number(row.Water_Stress_Score || 0),
      Risk_Category: getStandardizedRiskLevel(row.Water_Stress_Score),
    }));

  console.log(`[AquaLink Data Layer] Fallback loaded ${locationData.length} records from aqualinkData.csv`);
  return locationData;
}

/*
  Load historical data for forecasting and trend analysis.
  Primary: FastAPI backend /api/forecast/district
  Fallback: Local /aqualinkData.csv
*/
export async function loadPuneHistoricalData(district = "pune") {
  try {
    const apiRes = await fetch(`${API_BASE_URL}/api/forecast/district?district=${encodeURIComponent(district)}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data?.historical_fitted) && data.historical_fitted.length > 0) {
        console.log("[AquaLink Data Layer] Loaded historical forecast series from FastAPI OLS model");
        return data.historical_fitted.map((item) => ({
          Year: item.year,
          Water_Stress_Score: item.actual_score,
        }));
      }
    }
  } catch (err) {
    console.warn("[AquaLink Data Layer] FastAPI forecast endpoint unavailable, falling back to static CSV:", err.message);
  }

  const response = await fetch("/aqualinkData.csv");
  const csvText = await response.text();

  const result = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const filteredData = result.data.filter(
    (row) =>
      row.District &&
      String(row.District).trim().toLowerCase() === district.toLowerCase()
  );

  const yearMap = new Map();

  filteredData.forEach((row) => {
    const year = Number(row.Year);
    const score = Number(row.Water_Stress_Score);

    if (isNaN(year) || isNaN(score)) return;

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }
    yearMap.get(year).push(score);
  });

  const historicalData = Array.from(yearMap.entries())
    .map(([year, scores]) => {
      const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      return {
        Year: year,
        Water_Stress_Score: Number(average.toFixed(1)),
        Record_Count: scores.length,
      };
    })
    .sort((a, b) => a.Year - b.Year);

  return historicalData;
}