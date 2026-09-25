import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarRange, Gauge, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import FadeInUp from "../components/FadeInUp";
import DataProvenance from "../components/DataProvenance";
import YearSelector from "../components/YearSelector";
import ConfidenceBadge from "../components/ConfidenceBadge";
import { useSelectedYear } from "../context/useSelectedYear";
import { EmptyState, LoadingState, MetricCard, PageHeader, SectionHeading, StatusBadge } from "../components/ui";
import { loadPuneData, loadPuneHistoricalData } from "../utils/loadAquaLinkData";
import { getRiskLevel } from "../utils/waterMetrics";

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text)", boxShadow: "var(--shadow-card)" };
const modelLabels = { ols: "OLS", last_value: "Last value", historical_mean: "Historical mean", simple_trend: "Simple trend" };

function Forecast() {
  const { selectedYear } = useSelectedYear();
  const [forecast, setForecast] = useState(null);
  const [criticalThreshold, setCriticalThreshold] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadPuneData("pune", selectedYear)
      .then((result) => { if (active) setMetadata(result.metadata); })
      .catch((metadataError) => console.error("Error loading forecast metadata:", metadataError));
    loadPuneHistoricalData("pune", selectedYear)
      .then((result) => {
        if (active) {
          setForecast(result.forecast);
          setCriticalThreshold(result.metadata.riskThresholds.Critical.minimum);
          setMetadata(result.metadata);
          setError("");
        }
      })
      .catch((loadError) => {
        console.error("Error loading forecast:", loadError);
        if (active) setError("The validated water-stress forecast could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedYear]);

  const view = useMemo(() => {
    if (!forecast?.historical?.length) return null;
    const current = forecast.historical.at(-1);
    const projectedStart = forecast.projections.length ? [{ year: current.year, projected: current.actual }] : [];
    const chartData = [
      ...forecast.historical.map((point) => ({ year: point.year, observed: point.actual, fitted: point.fitted })),
      ...projectedStart,
      ...forecast.projections,
    ].reduce((rows, row) => {
      const existing = rows.find((candidate) => candidate.year === row.year);
      if (existing) Object.assign(existing, row); else rows.push({ ...row });
      return rows;
    }, []).sort((a, b) => a.year - b.year);
    const outlook = [
      ...forecast.historical.map((point) => ({ year: point.year, score: point.actual, type: "Observed" })),
      ...forecast.projections.map((point) => ({ year: point.year, score: point.projected, type: "Forecast", interval: `${point.lower95.toFixed(1)}–${point.upper95.toFixed(1)}` })),
    ];
    return { current, chartData, outlook };
  }, [forecast]);

  if (loading) return <div className="page-container"><LoadingState title="Loading validated forecast" /></div>;
  if (error || !view) return <div className="page-container"><PageHeader eyebrow="Predictive analytics" title="Water stress forecast" description="Forecasting requires at least four yearly observations through the selected analysis year." /><YearSelector metadata={metadata} /><EmptyState error={Boolean(error)} title="Forecast unavailable" description={error || "Insufficient historical observations. Select a later analysis year."} /></div>;

  const { current, chartData, outlook } = view;
  const finalProjection = forecast.projections.at(-1);
  const trend = forecast.slope === null ? null : forecast.slope;
  const trendText = trend === null ? "Unavailable" : trend < 0 ? "Improving" : trend > 0 ? "Worsening" : "Stable";
  const TrendIcon = trend === null || trend === 0 ? Minus : trend < 0 ? TrendingDown : TrendingUp;

  return (
    <div className="page-container forecast-page">
      <PageHeader eyebrow="Predictive analytics" title="Water stress forecast" description="Backend-validated observations, OLS fit, prediction intervals, and planning outlook for Pune District.">
        <div className="method-badge"><Activity size={16} aria-hidden="true" /><span>{forecast.modelName}</span></div>
      </PageHeader>

      <YearSelector metadata={metadata} />
      <DataProvenance metadata={metadata} recordCount={forecast.observationCount} />
      <ConfidenceBadge quality={forecast.quality} label="forecast confidence" detailed />

      <FadeInUp><section className="metric-grid">
        <MetricCard icon={Gauge} label="Current stress" value={current.actual.toFixed(1)} suffix="/100" detail={`${current.year} observed`} />
        <MetricCard icon={Activity} label="Current risk" value={getRiskLevel(current.actual)} detail="Latest observation" tone="warning" />
        <MetricCard icon={CalendarRange} label="Forecast score" value={finalProjection ? finalProjection.projected.toFixed(1) : "N/A"} suffix={finalProjection ? "/100" : ""} detail={finalProjection ? `Projected ${finalProjection.year}` : "Backend required"} tone="blue" />
        <MetricCard icon={TrendIcon} label="OLS trend" value={trendText} detail={trend === null ? "Not calculated in fallback mode" : `${trend > 0 ? "+" : ""}${trend.toFixed(3)} points/year`} tone={trend > 0 ? "danger" : trend < 0 ? "success" : "aqua"} />
      </section></FadeInUp>

      <FadeInUp><section className="surface-card forecast-chart-card">
        <SectionHeading eyebrow="Model output" title="Observed, fitted, and projected stress" description="The projected series is rendered directly from the backend response." meta={`${forecast.baselineYear} baseline`} />
        <div className="forecast-chart"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" stroke="var(--text-muted)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
            <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} stroke="var(--text-muted)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}/100`, name]} />
            {criticalThreshold !== null && <ReferenceLine y={criticalThreshold} stroke="#fb7185" strokeDasharray="6 6" label={{ value: `Critical ${criticalThreshold}`, fill: "#fda4af", fontSize: 11, position: "insideTopRight" }} />}
            <Line type="monotone" dataKey="observed" name="Observed" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
            <Line type="monotone" dataKey="fitted" name="OLS fitted" stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="projected" name="OLS projected" stroke="#60a5fa" strokeWidth={3} strokeDasharray="8 6" dot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="lower95" name="95% lower" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="upper95" name="95% upper" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer></div>
        <div className="chart-legend-row"><span><i className="legend-line historical" />Observed</span><span><i className="legend-line projected" />OLS fitted/projected</span><span>95% prediction interval</span></div>
      </section></FadeInUp>

      <FadeInUp><section className="surface-card forecast-outlook-card">
        <SectionHeading eyebrow="Model evidence" title="Forecast diagnostics" description={forecast.evidenceLabel} meta={`${forecast.supportingRecordCount} supporting records`} />
        <div className="outlook-summary">
          <div><span>Observations</span><strong>{forecast.observationCount}</strong></div>
          <div><span>R²</span><strong>{forecast.rSquared === null ? "N/A" : forecast.rSquared.toFixed(3)}</strong></div>
          <div><span>Horizon</span><strong>{forecast.forecastHorizon}</strong><small> years</small></div>
        </div>
        {forecast.backtest && <div className="table-scroll"><table className="data-table forecast-table">
          <thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>Held-out years</th><th>Evidence</th></tr></thead>
          <tbody>{Object.entries(forecast.backtest.results).map(([name, metrics]) => <tr key={name}>
            <td><strong>{modelLabels[name] || name}</strong></td><td>{metrics.mae.toFixed(3)}</td><td>{metrics.rmse.toFixed(3)}</td><td>{metrics.test_observations}</td>
            <td>{forecast.backtest.selected_model === name ? "Lowest RMSE" : "Benchmark"}</td>
          </tr>)}</tbody>
        </table></div>}
        <div className="table-scroll"><table className="data-table forecast-table">
          <thead><tr><th>Year</th><th>Type</th><th>Stress score</th><th>95% interval</th><th>Risk</th></tr></thead>
          <tbody>{outlook.map((item) => <tr key={`${item.year}-${item.type}`} className={item.type === "Forecast" ? "forecast-row" : ""}>
            <td><strong>{item.year}</strong></td><td>{item.type}</td><td>{item.score.toFixed(1)}</td><td>{item.interval || "—"}</td><td><StatusBadge status={getRiskLevel(item.score)} /></td>
          </tr>)}</tbody>
        </table></div>
        <aside className="info-note"><Info size={19} aria-hidden="true" /><div><strong>{forecast.intervalMethod || "Fallback limitation"}</strong><p>{forecast.disclaimer}</p></div></aside>
      </section></FadeInUp>
    </div>
  );
}

export default Forecast;
