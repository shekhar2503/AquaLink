import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CircleCheck,
  Gauge,
  Search,
  ShieldAlert,
  Download,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FadeInUp from "../components/FadeInUp";
import DataProvenance from "../components/DataProvenance";
import YearSelector from "../components/YearSelector";
import ConfidenceBadge from "../components/ConfidenceBadge";
import { useSelectedYear } from "../context/useSelectedYear";
import {
  EmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "../components/ui";
import { loadPuneAllYears, loadPuneData } from "../utils/loadAquaLinkData";
import { downloadRecordsCsv } from "../utils/csvExport";
import {
  getRiskLevel,
  getLocationName,
  getTalukaName,
  getWaterScore,
  RISK_COLORS,
} from "../utils/waterMetrics";

const chartTooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  color: "var(--text)",
  boxShadow: "var(--shadow-card)",
};

function Analytics() {
  const { selectedYear } = useSelectedYear();
  const [data, setData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([loadPuneData("pune", selectedYear), loadPuneAllYears()])
      .then(([result, history]) => {
        if (active) {
          setData(result.records);
          setMetadata(result.metadata);
          setHistoricalRecords(history.records);
          setError("");
        }
      })
      .catch((loadError) => {
        console.error("Error loading analytics data:", loadError);
        if (active) setError("The analytics dataset could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedYear]);

  const analyticsData = useMemo(
    () =>
      data.map((item, index) => {
        const score = getWaterScore(item);
        return {
          id: `${item.location_id ?? index}-${index}`,
          taluka: getTalukaName(item),
          village: getLocationName(item),
          score,
          risk: getRiskLevel(score),
          record: item,
        };
      }),
    [data],
  );

  const summary = useMemo(() => {
    const counts = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    analyticsData.forEach((item) => {
      counts[item.risk] += 1;
    });
    const average = analyticsData.length
      ? analyticsData.reduce((sum, item) => sum + item.score, 0) / analyticsData.length
      : 0;
    return {
      counts,
      average,
      priorityCount: counts.High + counts.Critical,
    };
  }, [analyticsData]);

  const sortedData = useMemo(
    () => [...analyticsData].sort((a, b) => b.score - a.score),
    [analyticsData],
  );

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sortedData.filter(
      (item) =>
        (riskFilter === "All" || item.risk === riskFilter) &&
        (!query || `${item.taluka} ${item.village}`.toLowerCase().includes(query)),
    );
  }, [riskFilter, searchTerm, sortedData]);

  const areaComparison = useMemo(() => {
    if (!metadata || !historicalRecords.length) return [];
    const year = metadata.selectedYear ?? metadata.latestYear;
    const previousYear = year - 1;
    const aggregate = (targetYear) => {
      const groups = new Map();
      historicalRecords.filter((record) => record.year === targetYear).forEach((record) => {
        const id = record.geography_id ?? record.location_id;
        const values = groups.get(id) ?? { name: getLocationName(record), scores: [] };
        values.scores.push(record.water_stress_score); groups.set(id, values);
      });
      return [...groups.entries()].map(([id, value]) => ({ id, name: value.name, average: value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length }))
        .sort((a, b) => b.average - a.average).map((item, index) => ({ ...item, rank: index + 1 }));
    };
    const current = aggregate(year); const previous = new Map(aggregate(previousYear).map((item) => [item.id, item]));
    return current.map((item) => ({ ...item, previousAverage: previous.get(item.id)?.average ?? null, previousRank: previous.get(item.id)?.rank ?? null, rankMovement: previous.has(item.id) ? previous.get(item.id).rank - item.rank : null }));
  }, [historicalRecords, metadata]);

  if (loading) {
    return <div className="page-container"><LoadingState title="Loading water analytics" /></div>;
  }

  if (error || !analyticsData.length) {
    return (
      <div className="page-container">
        <EmptyState error={Boolean(error)} title="Analytics unavailable" description={error || "No monitored locations are available for analysis."} />
      </div>
    );
  }

  const riskDistribution = Object.entries(summary.counts).map(([name, value]) => ({ name, value }));
  const topTen = sortedData.slice(0, 10).map((item) => ({ ...item, name: item.village }));
  const priorityPercentage = ((summary.priorityCount / analyticsData.length) * 100).toFixed(1);

  return (
    <div className="page-container analytics-page">
      <PageHeader
        eyebrow="AquaLink analytics"
        title="Water intelligence"
        description="Location-level analysis of water stress across Pune District."
      >
        <div className="data-state-pill"><span className="live-dot" /><div><strong>Dataset active</strong><small>{analyticsData.length} locations</small></div></div>
      </PageHeader>

      <YearSelector metadata={metadata} />
      <DataProvenance metadata={metadata} recordCount={analyticsData.length} />

      <FadeInUp>
        <section className="metric-grid">
          <MetricCard icon={Gauge} label="Average stress" value={summary.average.toFixed(1)} suffix="/100" detail="District-wide average" />
          <MetricCard icon={CircleCheck} label="Low risk" value={summary.counts.Low} detail="Backend-classified locations" tone="success" />
          <MetricCard icon={AlertTriangle} label="High risk" value={summary.counts.High} detail="Backend-classified locations" tone="warning" />
          <MetricCard icon={ShieldAlert} label="Critical" value={summary.counts.Critical} detail="Requires action" tone="danger" />
        </section>
      </FadeInUp>

      <section className="analytics-chart-grid">
        <FadeInUp className="surface-card chart-card">
          <SectionHeading eyebrow="Risk profile" title="Risk distribution" description={`Classification across ${analyticsData.length} monitored locations.`} />
          <div className="chart-wrap pie-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} cx="50%" cy="45%" innerRadius={72} outerRadius={108} paddingAngle={3} dataKey="value">
                  {riskDistribution.map((entry) => <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "var(--text)" }} />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center"><strong>{analyticsData.length}</strong><span>Locations</span></div>
          </div>
          <table className="sr-only"><caption>Risk distribution</caption><tbody>{riskDistribution.map((item) => <tr key={item.name}><th>{item.name}</th><td>{item.value}</td></tr>)}</tbody></table>
        </FadeInUp>

        <FadeInUp className="surface-card chart-card" delay={80}>
          <SectionHeading eyebrow="Priority analysis" title="Highest-risk locations" description="Top 10 records by water stress score." />
          <div className="chart-wrap bar-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTen} layout="vertical" margin={{ top: 5, right: 20, left: 32, bottom: 5 }}>
                <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={92} stroke="var(--text-muted)" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--border-soft)" }} />
                <Bar dataKey="score" name="Stress score" radius={[0, 7, 7, 0]}>
                  {topTen.map((item) => <Cell key={item.id} fill={RISK_COLORS[item.risk]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only"><caption>Ten highest-risk locations</caption><tbody>{topTen.map((item) => <tr key={item.id}><th>{item.village}</th><td>{item.score}</td></tr>)}</tbody></table>
        </FadeInUp>
      </section>

      <FadeInUp><section className="surface-card analytics-table-card"><SectionHeading eyebrow="Historical comparison" title="Location rank movement" description="Current-year location stress and movement from the preceding year; positive movement means the location moved toward higher priority." />
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Current rank</th><th>Location</th><th>Current score</th><th>Previous score</th><th>Rank movement</th></tr></thead><tbody>{areaComparison.map((item) => <tr key={item.id}><td>{item.rank}</td><td>{item.name}</td><td>{item.average.toFixed(1)}</td><td>{item.previousAverage === null ? "Not available" : item.previousAverage.toFixed(1)}</td><td>{item.rankMovement === null ? "Not available" : item.rankMovement === 0 ? "No change" : `${item.rankMovement > 0 ? "+" : ""}${item.rankMovement}`}</td></tr>)}</tbody></table></div>
      </section></FadeInUp>

      <FadeInUp>
        <section className="decision-banner">
          <div className="decision-icon" aria-hidden="true"><BarChart3 /></div>
          <div className="decision-content">
            <span className="eyebrow">Decision support</span>
            <h2>Intervention priority</h2>
            <p>{summary.priorityCount} of {analyticsData.length} monitored locations are High or Critical risk.</p>
            <div className="progress-track"><span style={{ width: `${priorityPercentage}%` }} /></div>
          </div>
          <div className="decision-value"><strong>{priorityPercentage}%</strong><span>Priority coverage</span></div>
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card analytics-table-card">
          <div className="table-card-header">
            <SectionHeading eyebrow="Location intelligence" title="Water stress records" description={`Complete dataset — ${analyticsData.length} monitored locations.`} />
            <div className="table-controls">
              <button className="export-button" type="button" onClick={() => downloadRecordsCsv(filteredData.map((item) => item.record), `aqualink-${metadata.selectedYear ?? metadata.latestYear}-filtered.csv`)}><Download size={16} aria-hidden="true" />Export filtered CSV</button>
              <label className="field-group field-grow">
                <span>Search locations</span>
                <div className="input-with-icon"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Search taluka or village" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
              </label>
              <label className="field-group">
                <span>Risk level</span>
                <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                  <option value="All">All risks</option>
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </label>
            </div>
          </div>
          <p className="table-result-count">Showing <strong>{filteredData.length}</strong> of <strong>{analyticsData.length}</strong> locations</p>
          <div className="table-scroll">
            <table className="data-table analytics-table">
              <thead><tr><th scope="col">#</th><th scope="col">Location</th><th scope="col">Stress score</th><th scope="col">Confidence</th><th scope="col">Risk level</th><th scope="col">Stress index</th><th scope="col">Priority</th></tr></thead>
              <tbody>
                {filteredData.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td><div className="table-primary"><strong>{item.village}</strong><span>{item.taluka}</span></div></td>
                    <td><strong style={{ color: RISK_COLORS[item.risk] }}>{item.score}</strong><span className="table-unit">/100</span></td>
                    <td><ConfidenceBadge quality={item.record.quality} /></td>
                    <td><StatusBadge status={item.risk} /></td>
                    <td><div className="stress-track"><span style={{ width: `${Math.max(item.score, 2)}%`, background: RISK_COLORS[item.risk] }} /></div></td>
                    <td><span className={`priority-label ${item.risk.toLowerCase()}`}>{item.risk === "Critical" ? "Immediate" : item.risk === "High" ? "Priority" : item.risk === "Moderate" ? "Monitor" : "Stable"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredData.length ? <EmptyState title="No locations found" description="Try changing your search or risk filter." /> : null}
          </div>
        </section>
      </FadeInUp>
    </div>
  );
}

export default Analytics;
