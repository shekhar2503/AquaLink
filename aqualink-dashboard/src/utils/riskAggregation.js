import { getRiskLevel, getWaterScore } from "./waterMetrics.js";

export function aggregateRisk(records) {
  const counts = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
  let totalScore = 0;
  for (const record of records) {
    const score = getWaterScore(record);
    counts[getRiskLevel(score)] += 1;
    totalScore += score;
  }
  return {
    counts,
    observationCount: records.length,
    averageScore: records.length ? totalScore / records.length : null,
    priorityCount: counts.High + counts.Critical,
  };
}
