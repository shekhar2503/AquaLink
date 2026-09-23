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
    </section>
  );
}

function Dashboard() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    loadPuneData()
      .then((result) => {
        if (!active) return;
        const records = Array.isArray(result)
          ? result
          : result?.data ?? result?.records ?? [];
        setRawData(records);
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
  }, []);

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
        priorityTalukas: [],
      };
    }

    rawData.forEach((item) => {
      distribution[getRiskLevel(getWaterScore(item))] += 1;
    });

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

    const districtScore =
      rawData.reduce((sum, item) => sum + getWaterScore(item), 0) / rawData.length;

    return {
      totalLocations: rawData.length,
      totalTalukas: talukas.length,
      districtScore: Number(districtScore.toFixed(1)),
      districtRisk: getRiskLevel(districtScore),
      highRiskTalukas: talukas.filter((item) => item.risk === "High").length,
      criticalTalukas: talukas.filter((item) => item.risk === "Critical").length,
      distribution,
      talukas,
      priorityTalukas: talukas.slice(0, 5),
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
    priorityTalukas,
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

      <FadeInUp>
        <section className="district-hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-content">
            <span className="eyebrow">District water stress</span>
            <div className="hero-score">
              {districtScore}
              <span>/100</span>
            </div>
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
          <MetricCard icon={MapPin} label="Talukas monitored" value={totalTalukas} detail="Unique talukas" />
          <MetricCard icon={AlertTriangle} label="High-risk talukas" value={highRiskTalukas} detail="Contain a score of 45–64" tone="warning" />
          <MetricCard icon={ShieldAlert} label="Critical talukas" value={criticalTalukas} detail="Contain a score of 65+" tone="danger" />
          <MetricCard icon={Radar} label="Monitored locations" value={totalLocations} detail="Latest source records" tone="blue" />
        </section>
      </FadeInUp>

      <FadeInUp>
        <section className="surface-card dashboard-section">
          <SectionHeading
            eyebrow="Intervention priority"
            title="Priority talukas"
            description="Talukas containing the most severe monitored hotspots."
            meta="Top 5"
          />
          <div className="table-scroll">
            <table className="data-table priority-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Taluka</th>
                  <th scope="col">Records</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {priorityTalukas.map((item, index) => (
                  <tr key={item.rawName}>
                    <td><span className="rank-number">{String(index + 1).padStart(2, "0")}</span></td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.records} records</td>
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
            eyebrow="Taluka overview"
            title="Water stress by taluka"
            description="Average water stress calculated from all available records."
            meta={`${totalTalukas} talukas`}
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
