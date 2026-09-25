import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRisk } from "./riskAggregation.js";
import { configureRiskThresholds } from "./waterMetrics.js";

configureRiskThresholds({
  Low: { minimum: 0, maximum: 25 }, Moderate: { minimum: 25, maximum: 45 },
  High: { minimum: 45, maximum: 65 }, Critical: { minimum: 65, maximum: 100, maximum_inclusive: true },
});

test("aggregates all risk boundaries without treating valid zero as missing", () => {
  const result = aggregateRisk([0, 25, 45, 65].map((water_stress_score) => ({ water_stress_score })));
  assert.deepEqual(result.counts, { Low: 1, Moderate: 1, High: 1, Critical: 1 });
  assert.equal(result.averageScore, 33.75);
  assert.equal(result.priorityCount, 2);
  assert.equal(result.observationCount, 4);
});

test("empty aggregation has no fabricated average", () => {
  assert.equal(aggregateRisk([]).averageScore, null);
});
