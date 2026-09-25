import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  MapPin,
  Radar,
  ShieldAlert,
  Waves,
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
import { aggregateRisk } from "../utils/riskAggregation";

const riskCategories = ["Low", "Moderate", "High", "Critical"];

function RiskDistribution({ distribution, total }) {
  const percentages = Object.fromEntries(
    riskCategories.map((risk) => [
      risk,
      total ? (distribution[risk] / total) * 100 : 0,
    ]),
  );

  const moderateEnd = percentages.Low + percentages.Moderate;
  const highEnd = moderateEnd + percentages.High;
  const gradient = `conic-gradient(
    var(--risk-low) 0 ${percentages.Low}%,
    var(--risk-moderate) ${percentages.Low}% ${moderateEnd}%,
    var(--risk-high) ${moderateEnd}% ${highEnd}%,
    var(--risk-critical) ${highEnd}% 100%
  )`;

  return (
    <section className="surface-card dashboard-section">
      <SectionHeading
        eyebrow="Risk distribution"
        title="Current location risk"
        description={`Classification across all ${total} monitored locations.`}
        meta="Latest dataset"
      />
      <div className="distribution-layout">
        <div className="donut-wrap">
          <div className="risk-donut" style={{ background: gradient }}>
            <div className="risk-donut-center">
              <strong>{total}</strong>
              <span>Locations</span>
            </div>
          </div>
        </div>
        <div className="distribution-grid">
          {riskCategories.map((risk) => (
            <article className={`distribution-card risk-${risk.toLowerCase()}`} key={risk}>
              <div className="distribution-card-heading">
                <span className="risk-dot" />
                <span>{risk}</span>
              </div>
              <strong>{distribution[risk]}</strong>
              <p>{percentages[risk].toFixed(1)}% of locations</p>
            </article>
          ))}
        </div>
      </div>
      <div className="distribution-track" aria-label="Risk distribution proportions">
        {riskCategories.map((risk) => (
          <span
            key={risk}
            className={`risk-${risk.toLowerCase()}`}
            style={{ width: `${percentages[risk]}%` }}
          />
        ))}
      </div>
      <table className="sr-only">
        <caption>Location risk distribution</caption>
        <thead><tr><th scope="col">Risk category</th><th scope="col">Locations</th><th scope="col">Percentage</th></tr></thead>
        <tbody>
          {riskCategories.map((risk) => (
            <tr key={risk}><th scope="row">{risk}</th><td>{distribution[risk]}</td><td>{percentages[risk].toFixed(1)}%</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Dashboard() {
  const { selectedYear } = useSelectedYear();
  const [rawData, setRawData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [aggregateQuality, setAggregateQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    loadPuneData("pune", selectedYear)
      .then((result) => {
        if (!active) return;
        const records = Array.isArray(result)
          ? result
          : result?.data ?? result?.records ?? [];
        setRawData(records);
        setMetadata(result.metadata);
        setAggregateQuality(result.quality);
        setError("");
      })
      .catch((loadError) => {
        console.error("Failed to load Pune data:", loadError);
        if (active) setError("The AquaLink dataset could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedYear]);

  const dashboardData = useMemo(() => {
    const distribution = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    if (!rawData.length) {
      return {
        totalLocations: 0,
        totalTalukas: 0,
        districtScore: 0,
        districtRisk: "Low",
        highRiskTalukas: 0,
        criticalTalukas: 0,
        distribution,
        talukas: [],
        priorityLocations: [],
      };
    }

    const riskSummary = aggregateRisk(rawData);
    Object.assign(distribution, riskSummary.counts);

    const talukaGroups = rawData.reduce((groups, item) => {
      const rawName = String(item?.Taluka ?? item?.taluka ?? "Unknown Taluka");
      groups[rawName] ??= [];
      groups[rawName].push(item);
      return groups;
    }, {});

    const talukas = Object.entries(talukaGroups)
      .map(([rawName, records]) => {
        const scores = records.map(getWaterScore);
        const average =
          scores.reduce((sum, score) => sum + score, 0) /
          Math.max(scores.length, 1);
        const peakScore = Math.max(...scores);
        return {
          rawName,
          name: getTalukaName(rawName),
          records: records.length,
          score: Number(average.toFixed(1)),
          averageRisk: getRiskLevel(average),
          peakScore,
          // A taluka needs attention when any monitored location in it does.
          // Using the taluka average here hid isolated high/critical hotspots.
          risk: getRiskLevel(peakScore),
        };
      })
      .sort((a, b) => b.peakScore - a.peakScore || b.score - a.score);

    const districtScore = riskSummary.averageScore;
    const priorityLocations = [...rawData]
      .sort((a, b) => getWaterScore(b) - getWaterScore(a))
      .slice(0, 5)
      .map((record) => ({
        id: record.geography_id ?? record.location_id,
        name: getLocationName(record),
        sourceArea: getTalukaName(record),
        score: getWaterScore(record),
        risk: getRiskLevel(getWaterScore(record)),
      }));

    return {
      totalLocations: rawData.length,
      totalTalukas: talukas.length,
      districtScore: Number(districtScore.toFixed(1)),
      districtRisk: getRiskLevel(districtScore),
      highRiskTalukas: talukas.filter((item) => item.risk === "High").length,
      criticalTalukas: talukas.filter((item) => item.risk === "Critical").length,
      distribution,
      talukas,
      priorityLocations,
    };
  }, [rawData]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState
          title="Loading Pune water intelligence"
          description="Analysing monitored locations and taluka-level risk."
        />
      </div>
    );
  }

  if (error || !rawData.length) {
    return (
      <div className="page-container">
        <EmptyState
          error={Boolean(error)}
          title="No dataset available"
          description={error || "The Pune water stress dataset contains no records."}
        />
      </div>
    );
  }

  const {
    totalLocations,
    totalTalukas,
    districtScore,
    districtRisk,
    highRiskTalukas,
    criticalTalukas,
    distribution,
    priorityLocations,
    talukas,
  } = dashboardData;
  const locationsRequiringAttention = distribution.High + distribution.Critical;

  return (
    <div className="page-container dashboard-page">
      <PageHeader
        eyebrow="AquaLink decision support"
        title="Pune water intelligence"
        description="District-wide water stress monitoring and intervention prioritisation."
      >
        <div className="data-state-pill">
          <span className="live-dot" />
          <div>
            <strong>Dataset active</strong>
            <small>{totalLocations} records analysed</small>
          </div>
        </div>
      </PageHeader>

      <YearSelector metadata={metadata} />
      <DataProvenance metadata={metadata} recordCount={totalLocations} />

      <FadeInUp>
        <section className="district-hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-content">
            <span className="eyebrow">District water stress</span>
            <div className="hero-score">
              {districtScore}
              <span>/100</span>
            </div>
            <ConfidenceBadge quality={aggregateQuality} label="aggregate confidence" detailed />
            <p>Average score across all monitored Pune District locations.</p>
            <div className="hero-status-row">
              <StatusBadge status={districtRisk} />
              <span>{locationsRequiringAttention} locations need priority attention</span>
            </div>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="hero-orbit-ring" />
            <Waves size={58} strokeWidth={1.2} />
          </div>
        </section>
      </FadeInUp>

      <FadeInUp delay={80}>
        <section className="metric-grid">
          <MetricCard icon={MapPin} label="Source area identifiers" value={totalTalukas} detail="Dataset-provided grouping identifiers" />
          <MetricCard icon={AlertTriangle} label="Areas containing high risk" value={highRiskTalukas} detail="Highest location risk is High" tone="warning" />
          <MetricCard icon={ShieldAlert} label="Areas containing critical risk" value={criticalTalukas} detail="At least one Critical location" tone="danger" />
          <MetricCard icon={Radar} label="Monitored locations" value={totalLocations} detail="Latest source records" tone="blue" />
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card dashboard-section">
          <SectionHeading
            eyebrow="Intervention priority"
            title="Priority locations"
            description="The five exact dataset locations with the highest individual water-stress scores."
            meta="Top 5"
          />
          <div className="table-scroll">
            <table className="data-table priority-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Location</th>
                  <th scope="col">Source area</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {priorityLocations.map((item, index) => (
                  <tr key={item.id}>
                    <td><span className="rank-number">{String(index + 1).padStart(2, "0")}</span></td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.sourceArea}</td>
                    <td><StatusBadge status={item.risk} /></td>
                    <td><strong>{item.score}</strong><span className="table-unit">/100</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </FadeInUp>

      <FadeInUp>
        <RiskDistribution distribution={distribution} total={totalLocations} />
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card dashboard-section">
          <SectionHeading
            eyebrow="Source-area overview"
            title="Average water stress by source area identifier"
            description="Average score across locations assigned to each dataset source area. These identifiers are not verified administrative talukas."
            meta={`${totalTalukas} areas`}
          />
          <div className="taluka-chart">
            {talukas.map((item) => (
              <div className="taluka-bar-row" key={item.rawName}>
                <span className="taluka-bar-label">{item.name}</span>
                <div className="taluka-bar-track">
                  <span
                    className={`taluka-bar-fill risk-${item.averageRisk.toLowerCase()}`}
                    style={{ width: `${Math.max(item.score, 2)}%` }}
                  />
                </div>
                <strong>{item.score}</strong>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Average water stress by source area identifier</caption>
            <thead><tr><th scope="col">Source area</th><th scope="col">Average score</th><th scope="col">Average risk</th><th scope="col">Highest location risk</th></tr></thead>
            <tbody>{talukas.map((item) => <tr key={item.rawName}><th scope="row">{item.name}</th><td>{item.score}</td><td>{item.averageRisk}</td><td>{item.risk}</td></tr>)}</tbody>
          </table>
          <div className="risk-legend" aria-label="Water stress risk thresholds">
            {riskCategories.map((risk) => (
              <span key={risk} className={`risk-${risk.toLowerCase()}`}>
                <i /> {risk}
              </span>
            ))}
          </div>
        </section>
      </FadeInUp>

      <FadeInUp>
        <aside className="insight-banner">
          <span className="insight-icon" aria-hidden="true"><Activity /></span>
          <div>
            <span className="eyebrow">AquaLink insight</span>
            <h2>Focus intervention on high-stress areas</h2>
            <p>{distribution.Critical} locations are currently critical and require immediate attention.</p>
          </div>
          <ArrowUpRight aria-hidden="true" />
        </aside>
      </FadeInUp>
    </div>
  );
}

export default Dashboard;
