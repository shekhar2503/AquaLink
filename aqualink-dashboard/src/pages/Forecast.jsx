import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarRange,
  Gauge,
  Info,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FadeInUp from "../components/FadeInUp";
import {
  EmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "../components/ui";
import { loadPuneHistoricalData } from "../utils/loadAquaLinkData";
import { getRiskLevel } from "../utils/waterMetrics";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  color: "var(--text)",
  boxShadow: "var(--shadow-card)",
};

function Forecast() {
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadPuneHistoricalData()
      .then((result) => {
        if (active) setHistoricalData(Array.isArray(result) ? result : []);
      })
      .catch((loadError) => {
        console.error("Error loading historical data:", loadError);
        if (active) setError("Historical water stress data could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const forecast = useMemo(() => {
    const years = new Map();
    historicalData.forEach((row) => {
      const year = Number(row.Year);
      const score = Number(row.Water_Stress_Score);
      if (!Number.isFinite(year) || !Number.isFinite(score)) return;
      const values = years.get(year) || [];
      values.push(score);
      years.set(year, values);
    });

    const yearlyData = [...years.entries()]
      .map(([year, values]) => ({
        year,
        score: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
      }))
      .sort((a, b) => a.year - b.year);

    if (!yearlyData.length) return null;
    const current = yearlyData.at(-1);
    const previous = yearlyData.at(-2);
    const yearlyChange = previous ? Number((current.score - previous.score).toFixed(1)) : 0;
    const projected = Array.from({ length: 3 }, (_, index) => ({
      year: current.year + index + 1,
      score: Number(Math.min(100, Math.max(0, current.score + yearlyChange * (index + 1))).toFixed(1)),
    }));
    const chartData = [
      ...yearlyData.map((item) => ({
        year: item.year,
        historical: item.score,
        projected: item.year === current.year ? current.score : null,
      })),
      ...projected.map((item) => ({ year: item.year, historical: null, projected: item.score })),
    ];
    const outlook = [
      ...yearlyData.map((item) => ({ ...item, type: "Historical" })),
      ...projected.map((item) => ({ ...item, type: "Forecast" })),
    ];

    return { yearlyData, current, yearlyChange, projected, chartData, outlook };
  }, [historicalData]);

  if (loading) {
    return <div className="page-container"><LoadingState title="Loading water stress forecast" /></div>;
  }

  if (error || !forecast) {
    return (
      <div className="page-container">
        <EmptyState error={Boolean(error)} title="Forecast data unavailable" description={error || "No valid historical years were found in the dataset."} />
      </div>
    );
  }

  const { current, yearlyChange, projected, chartData, outlook } = forecast;
  const finalForecast = projected.at(-1)?.score ?? current.score;
  const trendText = yearlyChange < 0 ? "Improving" : yearlyChange > 0 ? "Worsening" : "Stable";
  const TrendIcon = yearlyChange < 0 ? TrendingDown : yearlyChange > 0 ? TrendingUp : Minus;

  return (
    <div className="page-container forecast-page">
      <PageHeader
        eyebrow="Predictive analytics"
        title="Water stress forecast"
        description="Historical trend and three-year planning outlook for Pune District."
      >
        <div className="method-badge"><Activity size={16} aria-hidden="true" /><span>Trend projection</span></div>
      </PageHeader>

      <FadeInUp>
        <section className="metric-grid">
          <MetricCard icon={Gauge} label="Current stress" value={current.score.toFixed(1)} suffix="/100" detail={`${current.year} observed`} />
          <MetricCard icon={Activity} label="Current risk" value={getRiskLevel(current.score)} detail="Latest available data" tone="warning" />
          <MetricCard icon={CalendarRange} label="Forecast score" value={finalForecast.toFixed(1)} suffix="/100" detail={`Projected ${projected.at(-1)?.year}`} tone="blue" />
          <MetricCard icon={TrendIcon} label="Trend" value={trendText} detail={`${yearlyChange > 0 ? "+" : ""}${yearlyChange} points/year`} tone={yearlyChange > 0 ? "danger" : yearlyChange < 0 ? "success" : "aqua"} />
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card forecast-chart-card">
          <SectionHeading
            eyebrow="Trend analysis"
            title="Water stress trend"
            description="Observed Pune water stress with a three-year trend extension."
            meta={`${current.year} baseline`}
          />
          <div className="forecast-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" stroke="var(--text-muted)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} stroke="var(--text-muted)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}/100`, "Water stress"]} />
                <ReferenceLine y={65} stroke="#fb7185" strokeDasharray="6 6" label={{ value: "Critical 65", fill: "#fda4af", fontSize: 11, position: "insideTopRight" }} />
                <Line type="monotone" dataKey="historical" name="Historical" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: "#22d3ee", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} />
                <Line type="monotone" dataKey="projected" name="Forecast" stroke="#60a5fa" strokeWidth={3} strokeDasharray="8 6" dot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend-row">
            <span><i className="legend-line historical" />Historical data</span>
            <span><i className="legend-line projected" />Forecast trend</span>
            <span><i className="legend-line critical" />Critical threshold</span>
          </div>
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card forecast-outlook-card">
          <SectionHeading
            eyebrow="Projection summary"
            title="Forecast outlook"
            description="Historical observations and projected water stress levels."
            meta="Trend based"
          />
          <div className="outlook-summary">
            <div><span>Current</span><strong>{current.score.toFixed(1)}</strong><small>/100</small></div>
            <div><span>Forecast</span><strong>{finalForecast.toFixed(1)}</strong><small>/100</small></div>
            <div><span>Trend</span><strong className={yearlyChange > 0 ? "text-danger" : "text-success"}>{trendText}</strong></div>
          </div>
          <div className="table-scroll">
            <table className="data-table forecast-table">
              <thead><tr><th scope="col">Year</th><th scope="col">Type</th><th scope="col">Stress score</th><th scope="col">Risk level</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {outlook.map((item) => {
                  const risk = getRiskLevel(item.score);
                  return (
                    <tr key={`${item.year}-${item.type}`} className={item.type === "Forecast" ? "forecast-row" : ""}>
                      <td><strong>{item.year}</strong></td>
                      <td><span className={`type-badge ${item.type.toLowerCase()}`}>{item.type}</span></td>
                      <td><strong>{item.score.toFixed(1)}</strong><span className="table-unit">/100</span></td>
                      <td><StatusBadge status={risk} /></td>
                      <td>{item.type === "Forecast" ? "Projected" : "Observed"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <aside className="info-note">
            <Info size={19} aria-hidden="true" />
            <div><strong>Forecast interpretation</strong><p>The projection extends the observed year-to-year change. Use it as a planning indicator rather than a definitive prediction.</p></div>
          </aside>
        </section>
      </FadeInUp>
    </div>
  );
}

export default Forecast;
