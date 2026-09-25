import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CloudRain,
  Gauge,
  ListChecks,
  RefreshCw,
  Route,
  SearchCheck,
  Sprout,
} from "lucide-react";
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
import { loadPuneData } from "../utils/loadAquaLinkData";
import { getLocationName, getRiskLevel, getTalukaName, getWaterScore } from "../utils/waterMetrics";

const districtStrategies = [
  {
    icon: CloudRain,
    title: "Rainwater harvesting",
    description: "Increase local rainwater capture and groundwater recharge.",
  },
  {
    icon: SearchCheck,
    title: "Groundwater monitoring",
    description: "Track groundwater conditions in high-stress locations.",
  },
  {
    icon: Sprout,
    title: "Demand management",
    description: "Encourage efficient agricultural, domestic, and industrial water use.",
  },
  {
    icon: RefreshCw,
    title: "Continuous monitoring",
    description: "Update the decision-support view as new water data becomes available.",
  },
];

function Recommendations() {
  const { selectedYear } = useSelectedYear();
  const [data, setData] = useState([]);
  const [scoreVersion, setScoreVersion] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadPuneData("pune", selectedYear)
      .then((result) => {
        if (active) {
          setData(result.records);
          setScoreVersion(result.metadata.scoringVersion);
          setMetadata(result.metadata);
          setError("");
        }
      })
      .catch((loadError) => {
        console.error("Error loading recommendation data:", loadError);
        if (active) setError("Recommendation inputs could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedYear]);

  const summary = useMemo(() => {
    const ranked = [...data].sort((a, b) => getWaterScore(b) - getWaterScore(a));
    const average = data.length
      ? data.reduce((sum, item) => sum + getWaterScore(item), 0) / data.length
      : 0;
    const priorityCount = data.filter((item) => {
      const risk = getRiskLevel(getWaterScore(item));
      return risk === "High" || risk === "Critical";
    }).length;
    return { ranked, average, priorityCount };
  }, [data]);

  if (loading) {
    return <div className="page-container"><LoadingState title="Preparing recommendations" /></div>;
  }

  if (error || !data.length) {
    return (
      <div className="page-container">
        <EmptyState error={Boolean(error)} title="Recommendations unavailable" description={error || "No monitored locations are available."} />
      </div>
    );
  }

  return (
    <div className="page-container recommendations-page">
      <PageHeader
        eyebrow="Decision support"
        title="Water management recommendations"
        description="Data-driven intervention priorities for Pune District."
      >
        <div className="method-badge"><Route size={16} aria-hidden="true" /><span>AquaLink DSS</span></div>
      </PageHeader>

      <YearSelector metadata={metadata} />
      <DataProvenance metadata={metadata} recordCount={data.length} />

      <FadeInUp>
        <section className="metric-grid recommendation-metrics">
          <MetricCard icon={Gauge} label="Average stress" value={summary.average.toFixed(1)} suffix="/100" detail="District average" />
          <MetricCard icon={ListChecks} label="Priority locations" value={summary.priorityCount} detail="High or critical risk" tone="danger" />
          <MetricCard icon={Activity} label="Locations monitored" value={data.length} detail="Pune District" tone="blue" />
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="recommendation-section">
          <SectionHeading
            eyebrow="Ranked action plan"
            title="Recommended actions"
            description="Highest-stress records, ordered for assessment and intervention."
            meta="Top 6"
          />
          <div className="recommendation-grid">
            {summary.ranked.slice(0, 6).map((area, index) => {
              const score = getWaterScore(area);
              const risk = getRiskLevel(score);
              const recommendation = area.recommendation;
              return (
                <article className="recommendation-card" key={`${area.location_id ?? area.Taluka}-${index}`}>
                  <div className="recommendation-card-top">
                    <div><span className="eyebrow">Priority {String(index + 1).padStart(2, "0")}</span><h2>{getLocationName(area)}</h2><p>{getTalukaName(area)}</p></div>
                    <div className="recommendation-score"><strong>{score}</strong><span>/100</span></div>
                  </div>
                  <div className="recommendation-risk-row"><span>Risk level</span><StatusBadge status={risk} /></div>
                  <ConfidenceBadge quality={area.quality} label="recommendation confidence" detailed />
                  <div className="recommendation-action"><span>Recommended action</span><strong>{recommendation.recommended_action}</strong></div>
                  <p className="recommendation-reason">{recommendation.rationale}</p>
                  <div className="recommendation-drivers"><span>Decision drivers</span><div>{recommendation.drivers.map((driver) => <strong key={driver}>{driver.replaceAll("_", " ")}</strong>)}</div></div>
                  <dl className="implementation-details">
                    <div><dt>Urgency</dt><dd>{recommendation.priority}</dd></div>
                    <div><dt>Estimated cost</dt><dd data-placeholder>Not estimated — placeholder</dd></div>
                    <div><dt>Expected impact</dt><dd data-placeholder>Not quantified — placeholder</dd></div>
                    <div><dt>Responsible department</dt><dd data-placeholder>Unassigned — placeholder</dd></div>
                    <div><dt>Implementation status</dt><dd data-placeholder>Not tracked — placeholder</dd></div>
                  </dl>
                  <div className="recommendation-footer"><span>Source record</span><strong>{area.Year ? `Year ${area.Year}` : "Latest available"} · {area.score_version || scoreVersion}</strong></div>
                </article>
              );
            })}
          </div>
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card strategy-section">
          <SectionHeading
            eyebrow="District-level strategy"
            title="Recommended water management measures"
            description="Cross-cutting measures that support the location-level action plan."
          />
          <div className="strategy-grid">
            {districtStrategies.map(({ icon: Icon, title, description }, index) => (
              <article className="strategy-item" key={title}>
                <span className="strategy-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="strategy-icon" aria-hidden="true"><Icon /></span>
                <div><h2>{title}</h2><p>{description}</p></div>
              </article>
            ))}
          </div>
        </section>
      </FadeInUp>
    </div>
  );
}

export default Recommendations;
