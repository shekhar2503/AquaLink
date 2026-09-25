import Papa from "papaparse";
import { normalizeMetadata, normalizeQuality, normalizeRecord, riskLevelForScore } from "./dataContract";
import { configureRiskThresholds } from "./waterMetrics";
import { historicalOnlyFallback, normalizeForecastResponse } from "./forecastContract";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const getStandardizedRiskLevel = riskLevelForScore;

async function fetchJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

function parseFallback(csvText, district) {
  const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Fallback CSV parse failed: ${parsed.errors[0].message}`);
  const rows = parsed.data.filter((row) => String(row.District ?? "").trim().toLowerCase() === district.toLowerCase());
  if (!rows.length) throw new Error(`Fallback CSV has no records for district '${district}'`);
  const years = rows.map((row, index) => finiteHistoricalNumber(row.Year, "Year", index));
  return { rows, years, latestYear: Math.max(...years) };
}

async function fallbackMetadata(years, latestYear, reason) {
  const response = await fetch("/aqualinkMetadata.json");
  if (!response.ok) throw new Error(`Fallback metadata returned HTTP ${response.status}`);
  const metadata = normalizeMetadata({ ...(await response.json()), latest_year: latestYear,
    year_range: { minimum: Math.min(...years), maximum: latestYear } }, "fallback");
  metadata.fallbackReason = reason;
  return metadata;
}

export async function loadAquaLinkMetadata() {
  return normalizeMetadata(await fetchJson("/metadata"), "api");
}

export async function loadPuneData(district = "pune", year = null) {
  try {
    const [metadata, payload] = await Promise.all([
      loadAquaLinkMetadata(), fetchJson(`/hotspots?district=${encodeURIComponent(district)}&limit=5000${year ? `&year=${year}` : ""}`),
    ]);
    if (!Array.isArray(payload.results) || !payload.results.length) throw new Error("Hotspots response contains no records");
    configureRiskThresholds(metadata.riskThresholds);
    metadata.selectedYear = payload.year;
    return { records: payload.results.map((row, index) => normalizeRecord(row, index, metadata.riskThresholds)), metadata, quality: normalizeQuality(payload.quality, "Hotspots aggregate quality"), supportingObservationCount: payload.supporting_observation_count };
  } catch (error) {
    console.warn("[AquaLink Data Layer] API unavailable or invalid; using the bundled CSV:", error.message);
    const response = await fetch("/aqualinkData.csv");
    if (!response.ok) throw new Error(`Fallback CSV returned HTTP ${response.status}`, { cause: error });
    const { rows, years, latestYear } = parseFallback(await response.text(), district);
    const metadata = await fallbackMetadata(years, latestYear, error.message);
    configureRiskThresholds(metadata.riskThresholds);
    const targetYear = year ?? latestYear;
    const selectedRows = rows.filter((row) => Number(row.Year) === targetYear);
    if (!selectedRows.length) throw new Error(`Fallback CSV has no records for ${targetYear}`, { cause: error });
    metadata.selectedYear = targetYear;
    return { records: selectedRows.map((row, index) => normalizeRecord(row, index, metadata.riskThresholds)), metadata, quality: null, supportingObservationCount: selectedRows.length };
  }
}

export async function loadPuneHistoricalData(district = "pune", throughYear = null) {
  try {
    const [metadata, forecast] = await Promise.all([
      loadAquaLinkMetadata(), fetchJson(`/api/forecast/district?district=${encodeURIComponent(district)}${throughYear ? `&through_year=${throughYear}` : ""}`),
    ]);
    if (!Array.isArray(forecast.historical_fitted) || !forecast.historical_fitted.length) throw new Error("Forecast response contains no historical records");
    configureRiskThresholds(metadata.riskThresholds);
    const normalizedForecast = normalizeForecastResponse(forecast);
    const records = normalizedForecast.historical.map((item) => ({ Year: item.year, Water_Stress_Score: item.actual }));
    return { records, metadata, forecast: normalizedForecast };
  } catch (error) {
    console.warn("[AquaLink Data Layer] Forecast API unavailable or invalid; using the bundled CSV:", error.message);
    const response = await fetch("/aqualinkData.csv");
    if (!response.ok) throw new Error(`Fallback CSV returned HTTP ${response.status}`, { cause: error });
    const { rows, years, latestYear } = parseFallback(await response.text(), district);
    const yearMap = new Map();
    rows.filter((row) => throughYear === null || Number(row.Year) <= throughYear).forEach((row, index) => {
      const year = finiteHistoricalNumber(row.Year, "Year", index);
      const score = finiteHistoricalNumber(row.Water_Stress_Score, "Water_Stress_Score", index);
      yearMap.set(year, [...(yearMap.get(year) ?? []), score]);
    });
    const records = [...yearMap.entries()].map(([year, scores]) => ({ Year: year, Water_Stress_Score: Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)), Record_Count: scores.length })).sort((a, b) => a.Year - b.Year);
    const metadata = await fallbackMetadata(years, latestYear, error.message);
    metadata.selectedYear = throughYear ?? latestYear;
    configureRiskThresholds(metadata.riskThresholds);
    return { records, metadata, forecast: historicalOnlyFallback(records, error.message) };
  }
}

export async function loadLocationDecisionSupport(locationId, year = null) {
  return fetchJson(`/village/${locationId}${year ? `?year=${year}` : ""}`);
}

export async function loadPuneAllYears(district = "pune") {
  try {
    const metadata = await loadAquaLinkMetadata();
    configureRiskThresholds(metadata.riskThresholds);
    const years = [];
    for (let year = metadata.yearRange.minimum; year <= metadata.yearRange.maximum; year += 1) years.push(year);
    const payloads = await Promise.all(years.map((year) => fetchJson(`/hotspots?district=${encodeURIComponent(district)}&year=${year}&limit=5000`)));
    return { records: payloads.flatMap((payload) => payload.results).map((row, index) => normalizeRecord(row, index, metadata.riskThresholds)), metadata };
  } catch (error) {
    const response = await fetch("/aqualinkData.csv");
    if (!response.ok) throw new Error(`Fallback CSV returned HTTP ${response.status}`, { cause: error });
    const { rows, years, latestYear } = parseFallback(await response.text(), district);
    const metadata = await fallbackMetadata(years, latestYear, error.message);
    configureRiskThresholds(metadata.riskThresholds);
    return { records: rows.map((row, index) => normalizeRecord(row, index, metadata.riskThresholds)), metadata };
  }
}

function finiteHistoricalNumber(value, field, index) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`Historical record ${index}: ${field} must be a finite number`);
  return number;
}
