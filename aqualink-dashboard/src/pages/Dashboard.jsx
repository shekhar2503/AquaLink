import React, { useEffect, useMemo, useState } from "react";
import { loadPuneData } from "../utils/loadAquaLinkData";
import { talukaNames } from "../utils/talukaNames";

/* =========================================================
   HELPERS
========================================================= */

const getValue = (obj, keys, fallback = "") => {
  for (const key of keys) {
    if (
      obj &&
      obj[key] !== undefined &&
      obj[key] !== null &&
      obj[key] !== ""
    ) {
      return obj[key];
    }
  }

  return fallback;
};

const getScore = (item) => {
  const value = getValue(item, [
    "Water Stress Score",
    "Water_Stress_Score",
    "WaterStressScore",
    "Stress Score",
    "Stress_Score",
    "stress_score",
    "Score",
    "score",
    "WaterStress",
    "water_stress",
  ]);

  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
};

const getTaluka = (item) => {
  const value = getValue(item, [
    "Taluka",
    "taluka",
    "TALUKA",
    "Taluka_Name",
    "taluka_name",
    "Taluka Name",
  ]);

  return String(value || "Unknown Taluka").trim();
};

const getDisplayTalukaName = (taluka) => {
  if (!taluka) return "Unknown Taluka";

  return (
    talukaNames?.[taluka] ||
    talukaNames?.[String(taluka)] ||
    taluka
  );
};

/* =========================================================
   RISK CLASSIFICATION
========================================================= */

const getRiskLevel = (score) => {
  if (score >= 32) return "Critical";
  if (score >= 30) return "High";
  if (score >= 28) return "Moderate";
  return "Low";
};

const getRiskClass = (risk) => {
  switch (risk) {
    case "Critical":
      return "risk-critical";
    case "High":
      return "risk-high";
    case "Moderate":
      return "risk-moderate";
    default:
      return "risk-low";
  }
};

/* =========================================================
   RISK DISTRIBUTION
   IMPORTANT:
   This uses ALL 250 individual records.
========================================================= */

const RiskDistribution = ({ distribution, total }) => {
  const low = distribution.Low;
  const moderate = distribution.Moderate;
  const high = distribution.High;
  const critical = distribution.Critical;

  const lowPct = total ? (low / total) * 100 : 0;
  const moderatePct = total ? (moderate / total) * 100 : 0;
  const highPct = total ? (high / total) * 100 : 0;

  const gradient = `
    conic-gradient(
      #16a34a 0 ${lowPct}%,
      #f0b400 ${lowPct}% ${lowPct + moderatePct}%,
      #f97316 ${lowPct + moderatePct}% ${lowPct + moderatePct + highPct}%,
      #dc2626 ${lowPct + moderatePct + highPct}% 100%
    )
  `;

  const categories = [
    {
      name: "Low",
      value: low,
      range: "Score 0–27",
      className: "distribution-low",
    },
    {
      name: "Moderate",
      value: moderate,
      range: "Score 28–29",
      className: "distribution-moderate",
    },
    {
      name: "High",
      value: high,
      range: "Score 30–31",
      className: "distribution-high",
    },
    {
      name: "Critical",
      value: critical,
      range: "Score 32+",
      className: "distribution-critical",
    },
  ];

  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <div>
          <span className="section-eyebrow">RISK DISTRIBUTION</span>
          <h2>Current Location Risk</h2>
          <p>Classification of all {total} monitored locations</p>
        </div>

        <span className="section-meta">ALL MONITORED RECORDS</span>
      </div>

      <div className="risk-distribution-panel">
        <div className="distribution-header">
          <div>
            <strong>{total} locations</strong>
            <span>Current distribution</span>
          </div>

          <span>100%</span>
        </div>

        <div className="distribution-main">
          {/* DONUT */}
          <div className="donut-wrapper">
            <div
              className="risk-donut"
              style={{ background: gradient }}
            >
              <div className="risk-donut-center">
                <strong>{total}</strong>
                <span>Locations</span>
              </div>
            </div>
          </div>

          {/* LEGEND CARDS */}
          <div className="distribution-grid">
            {categories.map((item) => (
              <div
                key={item.name}
                className={`distribution-card ${item.className}`}
              >
                <div className="distribution-title">
                  <span className="distribution-dot" />
                  <span>{item.name}</span>
                </div>

                <strong>{item.value}</strong>
                <span>{item.range}</span>

                <div className="distribution-percent">
                  {total
                    ? ((item.value / total) * 100).toFixed(1)
                    : "0.0"}
                  %
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FULL WIDTH BAR */}
        <div className="distribution-bar">
          <div
            className="bar-low"
            style={{ width: `${lowPct}%` }}
          />
          <div
            className="bar-moderate"
            style={{ width: `${moderatePct}%` }}
          />
          <div
            className="bar-high"
            style={{ width: `${highPct}%` }}
          />
          <div
            className="bar-critical"
            style={{
              width: `${100 - lowPct - moderatePct - highPct}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
};

/* =========================================================
   KPI CARD
========================================================= */

const KpiCard = ({
  icon,
  label,
  value,
  subtitle,
  variant = "",
}) => {
  return (
    <div className={`kpi-card ${variant}`}>
      <div className="kpi-icon">{icon}</div>

      <div className="kpi-content">
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
        <span className="kpi-subtitle">{subtitle}</span>
      </div>
    </div>
  );
};

/* =========================================================
   DECISION CARD
========================================================= */

const DecisionCard = ({
  icon,
  priority,
  title,
  value,
  description,
  action,
  variant,
}) => {
  return (
    <div className={`decision-card ${variant}`}>
      <div className="decision-icon">{icon}</div>

      <span className="decision-priority">
        {priority}
      </span>

      <h3>{title}</h3>

      <strong className="decision-value">{value}</strong>

      <p>{description}</p>

      <span className="decision-action">{action}</span>
    </div>
  );
};

/* =========================================================
   MAIN DASHBOARD
========================================================= */

export default function Dashboard() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  /* -------------------------------------------------------
     LOAD DATA
  ------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const result = await loadPuneData();

        let data = [];

        if (Array.isArray(result)) {
          data = result;
        } else if (Array.isArray(result?.data)) {
          data = result.data;
        } else if (Array.isArray(result?.records)) {
          data = result.records;
        }

        if (mounted) {
          setRawData(data);
        }
      } catch (error) {
        console.error("Failed to load Pune data:", error);

        if (mounted) {
          setRawData([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const dashboardData = useMemo(() => {
    if (!rawData.length) {
      return {
        totalLocations: 0,
        totalTalukas: 0,
        districtScore: 0,
        districtRisk: "Low",
        highRiskTalukas: 0,
        criticalTalukas: 0,
        distribution: {
          Low: 0,
          Moderate: 0,
          High: 0,
          Critical: 0,
        },
        talukas: [],
        priorityTalukas: [],
      };
    }

    /* -----------------------------------------------------
       ALL 250 RECORDS
    ----------------------------------------------------- */

    const totalLocations = rawData.length;

    /* -----------------------------------------------------
       DISTRICT AVERAGE
    ----------------------------------------------------- */

    const scores = rawData.map(getScore);

    const districtScore =
      scores.reduce((sum, score) => sum + score, 0) /
      Math.max(scores.length, 1);

    const districtRisk = getRiskLevel(districtScore);

    /* -----------------------------------------------------
       RISK DISTRIBUTION
       ALL INDIVIDUAL RECORDS
    ----------------------------------------------------- */

    const distribution = {
      Low: 0,
      Moderate: 0,
      High: 0,
      Critical: 0,
    };

    rawData.forEach((item) => {
      const risk = getRiskLevel(getScore(item));
      distribution[risk]++;
    });

    /* -----------------------------------------------------
       GROUP ALL RECORDS BY TALUKA
    ----------------------------------------------------- */

    const talukaGroups = {};

    rawData.forEach((item) => {
      const taluka = getTaluka(item);

      if (!talukaGroups[taluka]) {
        talukaGroups[taluka] = [];
      }

      talukaGroups[taluka].push(item);
    });

    /* -----------------------------------------------------
       TALUKA AVERAGES
    ----------------------------------------------------- */

    const talukas = Object.entries(talukaGroups)
      .map(([taluka, records]) => {
        const talukaScores = records.map(getScore);

        const average =
          talukaScores.reduce(
            (sum, score) => sum + score,
            0
          ) / Math.max(talukaScores.length, 1);

        const risk = getRiskLevel(average);

        return {
          rawName: taluka,
          name: getDisplayTalukaName(taluka),
          records: records.length,
          score: Number(average.toFixed(1)),
          risk,
        };
      })
      .sort((a, b) => b.score - a.score);

    /* -----------------------------------------------------
       TALUKA KPI COUNTS
       Based on TALUKA AVERAGES, not individual records
    ----------------------------------------------------- */

    const highRiskTalukas = talukas.filter(
      (item) => item.score >= 30 && item.score < 32
    ).length;

    const criticalTalukas = talukas.filter(
      (item) => item.score >= 32
    ).length;

    return {
      totalLocations,
      totalTalukas: talukas.length,
      districtScore: Number(districtScore.toFixed(1)),
      districtRisk,
      highRiskTalukas,
      criticalTalukas,
      distribution,
      talukas,
      priorityTalukas: talukas.slice(0, 5),
    };
  }, [rawData]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>Loading Pune water intelligence...</p>
        </div>
      </main>
    );
  }

  /* =======================================================
     EMPTY DATA
  ======================================================= */

  if (!rawData.length) {
    return (
      <main className="dashboard">
        <div className="empty-dashboard">
          <div className="empty-icon">💧</div>
          <h2>No dataset available</h2>
          <p>
            The Pune water stress dataset could not be loaded.
          </p>
        </div>
      </main>
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

  const locationsRequiringAttention =
    distribution.High + distribution.Critical;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="dashboard">

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="dashboard-header">
        <div>
          <span className="brand-eyebrow">
            AQUA-LINK • DECISION SUPPORT SYSTEM
          </span>

          <h1>Pune Water Intelligence</h1>

          <p>
            District-wide water stress monitoring and
            intervention prioritization
          </p>
        </div>

        <div className="dataset-status">
          <span className="status-dot" />

          <div>
            <strong>Dataset Active</strong>
            <span>
              {totalLocations} records analysed
            </span>
          </div>
        </div>
      </header>

      {/* ===================================================
          DISTRICT HERO
      =================================================== */}

      <section className="district-hero">

        <div className="hero-content">
          <span className="section-eyebrow">
            DISTRICT WATER STRESS
          </span>

          <div className="hero-score">
            {districtScore}
            <span>/100</span>
          </div>

          <p>
            Average water stress across all monitored
            locations in Pune District
          </p>

          <div className="hero-risk">
            <span>CURRENT RISK</span>

            <strong className={getRiskClass(districtRisk)}>
              {districtRisk}
            </strong>

            <span>
              Based on {totalLocations} monitored records
            </span>
          </div>
        </div>

        <div className="hero-water-decoration">
          💧
        </div>

      </section>

      {/* ===================================================
          KPI CARDS
      =================================================== */}

      <section className="kpi-grid">

        <KpiCard
          icon="📍"
          label="TALUKAS MONITORED"
          value={totalTalukas}
          subtitle="Unique talukas"
        />

        <KpiCard
          icon="⚠️"
          label="HIGH-RISK TALUKAS"
          value={highRiskTalukas}
          subtitle="Average score 30–31"
          variant="kpi-high"
        />

        <KpiCard
          icon="🚨"
          label="CRITICAL TALUKAS"
          value={criticalTalukas}
          subtitle="Average score 32+"
          variant="kpi-critical"
        />

        <KpiCard
          icon="📊"
          label="MONITORED LOCATIONS"
          value={totalLocations}
          subtitle="All source records"
        />

      </section>

      
      {/* ===================================================
          INTERVENTION PRIORITY
      =================================================== */}

      <section className="dashboard-section intervention-section">

        <div className="section-heading">
          <div>
            <span className="section-eyebrow">
              INTERVENTION PRIORITY
            </span>

            <h2>Priority Talukas</h2>

            <p>
              Talukas with the highest average water stress
            </p>
          </div>

          <span className="section-meta">
            TOP 5
          </span>
        </div>

        <div className="priority-table">

          <div className="priority-table-header">
            <span>RANK</span>
            <span>TALUKA</span>
            <span>RECORDS</span>
            <span>RISK</span>
            <span>SCORE</span>
          </div>

          {priorityTalukas.map((item, index) => (
            <div
              className="priority-row"
              key={`${item.rawName}-${index}`}
            >

              <div className="priority-rank">
                {String(index + 1).padStart(2, "0")}
              </div>

              <div className="priority-name">
                <strong>{item.name}</strong>
              </div>

              <div className="priority-records">
                {item.records} records
              </div>

              <div>
                <span
                  className={`risk-pill ${getRiskClass(
                    item.risk
                  )}`}
                >
                  {item.risk}
                </span>
              </div>

              <div className="priority-score">
                <strong>{item.score}</strong>
                <span>/100</span>
              </div>

            </div>
          ))}

        </div>
      </section>

      {/* ===================================================
          RISK DISTRIBUTION
      =================================================== */}

      <RiskDistribution
        distribution={distribution}
        total={totalLocations}
      />

      {/* ===================================================
          TALUKA OVERVIEW
      =================================================== */}

      <section className="dashboard-section taluka-section">

        <div className="section-heading">
          <div>
            <span className="section-eyebrow">
              TALUKA OVERVIEW
            </span>

            <h2>Water Stress by Taluka</h2>

            <p>
              Average water stress calculated from all
              available records
            </p>
          </div>

          <span className="section-meta">
            {totalTalukas} TALUKAS
          </span>
        </div>

        <div className="taluka-chart-card">

          <div className="taluka-chart">

            {talukas.map((item, index) => {

              const width = Math.min(
                Math.max((item.score / 40) * 100, 5),
                100
              );

              return (
                <div
                  className="taluka-bar-row"
                  key={`${item.rawName}-${index}`}
                >

                  <div className="taluka-bar-label">
                    {item.name}
                  </div>

                  <div className="taluka-bar-track">
                    <div
                      className={`taluka-bar ${getRiskClass(
                        item.risk
                      )}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>

                  <div className="taluka-bar-score">
                    {item.score}
                  </div>

                </div>
              );
            })}

          </div>

          <div className="chart-legend">

            <div>
              <span className="legend-dot low" />
              Low ≤ 27
            </div>

            <div>
              <span className="legend-dot moderate" />
              Moderate 28–29
            </div>

            <div>
              <span className="legend-dot high" />
              High 30–31
            </div>

            <div>
              <span className="legend-dot critical" />
              Critical 32+
            </div>

          </div>

        </div>
      </section>

      {/* ===================================================
          FOOTER INSIGHT
      =================================================== */}

      <footer className="dashboard-footer">

        <div className="footer-mark">
          💡
        </div>

        <div>
          <span className="section-eyebrow">
            AQUA-LINK INSIGHT
          </span>

          <h3>
            Focus intervention on high-stress areas
          </h3>

          <p>
            {distribution.Critical} locations are in the
            critical category and require immediate
            attention.
          </p>

          <span className="footer-note">
            Aqua-Link Decision Support System • Pune
            District
          </span>
        </div>

      </footer>

    </main>
  );
}