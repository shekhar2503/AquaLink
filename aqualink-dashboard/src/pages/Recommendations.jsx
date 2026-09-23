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
import {
  EmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "../components/ui";
import { loadPuneData } from "../utils/loadAquaLinkData";
import { getRiskLevel, getTalukaName, getWaterScore } from "../utils/waterMetrics";

function getRecommendation(area) {
  if (area?.Recommended_Action) {
    return {
      action: area.Recommended_Action,
      reason: `Targeted intervention based on the recorded groundwater extraction stage (${area.GW_Extraction_Stage_pct ?? "N/A"}%) and piped coverage (${area.Piped_Water_Coverage_pct ?? "N/A"}%).`,
    };
  }

  const groundwaterStage = Number(area?.GW_Extraction_Stage_pct || 0);
  const coverage = Number(area?.Piped_Water_Coverage_pct || 100);
  const isDeclining = String(area?.GW_Historical_Trend || "Stable").includes("Declining");

  if (groundwaterStage >= 90 && coverage < 75) {
    return {
      action: "Groundwater recharge + water-supply augmentation",
      reason: "Compound stress detected: high groundwater extraction with a piped water-supply shortfall.",
    };
  }
  if (groundwaterStage >= 90) {
    return {
      action: isDeclining
        ? "Urgent groundwater recharge and extraction controls"
        : "Groundwater conservation and extraction management",
      reason: "Groundwater extraction exceeds safety norms and calls for recharge structures and improved irrigation efficiency.",
    };
  }
  if (coverage < 75) {
    return {
      action: "Improve piped water-supply infrastructure",
      reason: "Below-norm piped supply coverage indicates a need for distribution network expansion.",
    };
  }
  if (isDeclining) {
    return {
      action: "Increase water-table monitoring and rainwater harvesting",
      reason: "The declining five-year water-table trend indicates emerging vulnerability.",
    };
  }
  return {
    action: "Monitor and maintain",
    reason: "Current indicators remain within baseline safety thresholds.",
  };
}

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
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadPuneData()
      .then((result) => {
        if (active) setData(Array.isArray(result) ? result : []);
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
  }, []);

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
              const recommendation = getRecommendation(area);
              return (
                <article className="recommendation-card" key={`${area.location_id ?? area.Taluka}-${index}`}>
                  <div className="recommendation-card-top">
                    <div><span className="eyebrow">Priority {String(index + 1).padStart(2, "0")}</span><h2>{getTalukaName(area)}</h2><p>{area.Village_Ward || "Monitored location"}</p></div>
                    <div className="recommendation-score"><strong>{score}</strong><span>/100</span></div>
                  </div>
                  <div className="recommendation-risk-row"><span>Risk level</span><StatusBadge status={risk} /></div>
                  <div className="recommendation-action"><span>Recommended action</span><strong>{recommendation.action}</strong></div>
                  <p className="recommendation-reason">{recommendation.reason}</p>
                  <div className="recommendation-footer"><span>Source record</span><strong>{area.Year ? `Year ${area.Year}` : "Latest available"}</strong></div>
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
