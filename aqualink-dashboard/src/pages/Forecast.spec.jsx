import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import YearProvider from "../context/YearProvider";
import { configureRiskThresholds } from "../utils/waterMetrics";

const fixtures = vi.hoisted(() => {
  const metadata = {
    source: "api", synthetic: true, selectedYear: 2025, latestYear: 2025, lastUpdated: "2026-09-24T00:00:00Z",
    scoringVersion: "score-v1", yearRange: { minimum: 2020, maximum: 2025 }, qualityMethodology: {},
    riskThresholds: {
      Low: { minimum: 0, maximum: 25 }, Moderate: { minimum: 25, maximum: 45 },
      High: { minimum: 45, maximum: 65 }, Critical: { minimum: 65, maximum: 100, maximum_inclusive: true },
    },
  };
  const quality = { confidence: "Medium", quality_score: 70, supporting_observation_count: 6, reasons: ["Rules based."], dimensions: {}, missing_fields: [], is_stale: false };
  const forecast = {
    modelName: "Ordinary Least Squares linear trend", modelVersion: "forecast-v2", slope: -0.5, rSquared: 0.8,
    observationCount: 4, forecastHorizon: 3, baselineYear: 2025, supportingRecordCount: 1000,
    intervalMethod: "95% prediction interval", evidenceLabel: "OLS evidence", disclaimer: "Planning only.", quality,
    historical: [{ year: 2022, actual: 30, fitted: 30.2 }, { year: 2023, actual: 29.5, fitted: 29.7 }, { year: 2024, actual: 29, fitted: 29.2 }, { year: 2025, actual: 28.5, fitted: 28.7 }],
    projections: [{ year: 2026, projected: 28, lower95: 24, upper95: 32 }, { year: 2027, projected: 27.5, lower95: 23, upper95: 32 }, { year: 2028, projected: 27, lower95: 22, upper95: 32 }],
    backtest: null,
  };
  return { metadata, quality, forecast };
});

vi.mock("../utils/loadAquaLinkData", () => ({
  loadPuneData: vi.fn(async () => ({ records: [], metadata: fixtures.metadata })),
  loadPuneHistoricalData: vi.fn(async () => ({ records: [], metadata: fixtures.metadata, forecast: fixtures.forecast })),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>, LineChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null, Line: () => null, ReferenceLine: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

import Forecast from "./Forecast";

describe("forecast rendering", () => {
  beforeEach(() => configureRiskThresholds(fixtures.metadata.riskThresholds));

  it("renders backend projections, evidence, confidence, and accessible table values", async () => {
    render(<YearProvider><Forecast /></YearProvider>);
    expect(await screen.findByRole("heading", { name: "Water stress forecast" })).toBeInTheDocument();
    expect(screen.getByText("Ordinary Least Squares linear trend")).toBeInTheDocument();
    expect(screen.getByText(/Medium forecast confidence/)).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /2028 Forecast 27\.0 22\.0–32\.0 Moderate/ });
    expect(row).toBeInTheDocument();
    expect(screen.getByText("1000 supporting records")).toBeInTheDocument();
  });
});
