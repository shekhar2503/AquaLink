import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Filter,
  MapPinned,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import FadeInUp from "../components/FadeInUp";
import RiskMap from "../components/RiskMap";
import {
  EmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionHeading,
} from "../components/ui";
import { loadPuneData } from "../utils/loadAquaLinkData";
import { getRiskLevel, getTalukaName, getWaterScore } from "../utils/waterMetrics";

function MapPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("All");

  useEffect(() => {
    let active = true;
    loadPuneData()
      .then((result) => {
        if (active) setData(Array.isArray(result) ? result : []);
      })
      .catch((loadError) => {
        console.error("Error loading map data:", loadError);
        if (active) setError("Spatial water stress data could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((item) => {
      const risk = getRiskLevel(getWaterScore(item));
      const searchableName = `${getTalukaName(item)} ${item.Village_Ward || ""}`.toLowerCase();
      return (
        (selectedRisk === "All" || risk === selectedRisk) &&
        (!query || searchableName.includes(query))
      );
    });
  }, [data, searchTerm, selectedRisk]);

  const summary = useMemo(() => {
    const counts = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    data.forEach((item) => {
      counts[getRiskLevel(getWaterScore(item))] += 1;
    });
    const average = data.length
      ? data.reduce((sum, item) => sum + getWaterScore(item), 0) / data.length
      : 0;
    return { counts, average };
  }, [data]);

  if (loading) {
    return <div className="page-container"><LoadingState title="Loading Pune risk map" /></div>;
  }

  if (error || !data.length) {
    return (
      <div className="page-container">
        <EmptyState error={Boolean(error)} title="Map data unavailable" description={error || "No monitored locations are available."} />
      </div>
    );
  }

  return (
    <div className="page-container map-page">
      <PageHeader
        eyebrow="GIS monitoring"
        title="Pune water risk map"
        description="Spatial intelligence for locating water stress and prioritising field intervention."
      >
        <div className="data-state-pill"><span className="live-dot" /><div><strong>Spatial layer active</strong><small>{data.length} mapped records</small></div></div>
      </PageHeader>

      <FadeInUp>
        <section className="metric-grid map-metric-grid">
          <MetricCard icon={MapPinned} label="Monitored locations" value={data.length} detail="Pune District" />
          <MetricCard icon={ShieldCheck} label="Low risk" value={summary.counts.Low} detail="Score below 25" tone="success" />
          <MetricCard icon={AlertTriangle} label="High + critical" value={summary.counts.High + summary.counts.Critical} detail="Priority locations" tone="danger" />
          <MetricCard icon={BarChart3} label="Average stress" value={summary.average.toFixed(1)} suffix="/100" detail="District average" tone="blue" />
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card map-section">
          <SectionHeading
            eyebrow="Spatial view"
            title="Water stress distribution"
            description="Search, filter, and select any marker for location-level detail."
            meta={`${filteredData.length} of ${data.length} shown`}
          />

          <div className="filter-bar">
            <label className="field-group field-grow">
              <span>Search location</span>
              <div className="input-with-icon">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search taluka or village"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </label>
            <label className="field-group">
              <span>Risk level</span>
              <div className="input-with-icon">
                <Filter size={17} aria-hidden="true" />
                <select value={selectedRisk} onChange={(event) => setSelectedRisk(event.target.value)}>
                  <option value="All">All risk levels</option>
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </label>
          </div>

          <RiskMap data={filteredData} />
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="map-guidance-grid" aria-label="Map guidance">
          <article className="guidance-card"><MapPinned aria-hidden="true" /><div><h2>Explore locations</h2><p>Select a marker to review its score, risk class, and geographic position.</p></div></article>
          <article className="guidance-card"><Target aria-hidden="true" /><div><h2>Prioritise intervention</h2><p>Orange and red markers identify locations needing greater attention.</p></div></article>
        </section>
      </FadeInUp>
    </div>
  );
}

export default MapPage;
