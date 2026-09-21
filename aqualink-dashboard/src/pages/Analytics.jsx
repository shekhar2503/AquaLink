import { useEffect, useMemo, useState } from "react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

import { loadPuneData } from "../utils/loadAquaLinkData";
import { talukaNames } from "../utils/talukaNames";


function Analytics() {

  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [loading, setLoading] = useState(true);


  // =====================================================
  // LOAD ALL DATA
  // =====================================================

  useEffect(() => {

    loadPuneData()
      .then((result) => {

        if (Array.isArray(result)) {
          setData(result);
        } else {
          setData([]);
        }

        setLoading(false);

      })
      .catch((error) => {

        console.error(
          "Error loading analytics data:",
          error
        );

        setData([]);
        setLoading(false);

      });

  }, []);


  // =====================================================
  // TALUKA NAME
  // =====================================================

  const getTalukaName = (item) => {

    const taluka =
      item?.Taluka !== undefined &&
      item?.Taluka !== null
        ? String(item.Taluka).trim()
        : "";

    return (
      talukaNames[taluka] ||
      taluka ||
      "Unknown Taluka"
    );

  };


  // =====================================================
  // SCORE
  // =====================================================

  const getScore = (item) => {

    const score =
      Number(item?.Water_Stress_Score);

    return Number.isFinite(score)
      ? score
      : 0;

  };


  // =====================================================
  // RISK LEVEL
  // =====================================================

  const getRiskLevel = (score) => {
    const value = Number(score);
    if (value >= 65) return "Critical";
    if (value >= 45) return "High";
    if (value >= 25) return "Moderate";
    return "Low";
  };



  // =====================================================
  // NORMALIZED DATA
  // =====================================================

  const analyticsData = useMemo(() => {

    return data.map((item, index) => {

      const score = getScore(item);

      return {
        id: index,
        taluka: getTalukaName(item),
        score: score,
        risk: getRiskLevel(score)
      };

    });

  }, [data]);


  // =====================================================
  // RISK COUNTS
  // =====================================================

  const lowCount =
    analyticsData.filter(
      item => item.risk === "Low"
    ).length;

  const moderateCount =
    analyticsData.filter(
      item => item.risk === "Moderate"
    ).length;

  const highCount =
    analyticsData.filter(
      item => item.risk === "High"
    ).length;

  const criticalCount =
    analyticsData.filter(
      item => item.risk === "Critical"
    ).length;


  const totalTalukas =
    analyticsData.length;


  // =====================================================
  // AVERAGE
  // =====================================================

  const averageStress =
    totalTalukas > 0
      ? analyticsData.reduce(
          (sum, item) =>
            sum + item.score,
          0
        ) / totalTalukas
      : 0;


  // =====================================================
  // PRIORITY
  // =====================================================

  const priorityCount =
    highCount + criticalCount;


  const priorityPercentage =
    totalTalukas > 0
      ? (
          priorityCount /
          totalTalukas *
          100
        ).toFixed(1)
      : "0.0";


  // =====================================================
  // PIE DATA
  // =====================================================

  const riskDistribution = [

    {
      name: "Low",
      value: lowCount
    },

    {
      name: "Moderate",
      value: moderateCount
    },

    {
      name: "High",
      value: highCount
    },

    {
      name: "Critical",
      value: criticalCount
    }

  ];


  const riskColors = {

    Low: "#16a34a",

    Moderate: "#eab308",

    High: "#f97316",

    Critical: "#dc2626"

  };


  // =====================================================
  // SORTED DATA
  // =====================================================

  const sortedData = useMemo(() => {

    return [...analyticsData].sort(
      (a, b) =>
        b.score - a.score
    );

  }, [analyticsData]);


  // =====================================================
  // TOP 10 TALUKAS
  // =====================================================

  const topTen = sortedData.slice(
    0,
    10
  );


  // =====================================================
  // BAR CHART DATA
  // =====================================================

  const barData =
    topTen.map(item => ({

      name: item.taluka,

      score: item.score,

      risk: item.risk

    }));


  // =====================================================
  // FILTERED TABLE
  // =====================================================

  const filteredData = useMemo(() => {

    return sortedData.filter(
      item => {

        const matchesSearch =
          item.taluka
            .toLowerCase()
            .includes(
              searchTerm
                .toLowerCase()
            );

        const matchesRisk =
          riskFilter === "All" ||
          item.risk === riskFilter;

        return (
          matchesSearch &&
          matchesRisk
        );

      }
    );

  }, [
    sortedData,
    searchTerm,
    riskFilter
  ]);


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (

      <main className="analytics-page">

        <div className="analytics-loading">

          <div className="loading-icon">
            💧
          </div>

          <h2>
            Loading Analytics
          </h2>

          <p>
            Preparing Pune water
            intelligence...
          </p>

        </div>

      </main>

    );

  }


  // =====================================================
  // PAGE
  // =====================================================

  return (

    <main className="analytics-page">


      {/* =================================================
          HEADER
      ================================================= */}

      <section className="analytics-header">

        <div>

          <span className="analytics-eyebrow">
            AQUALINK ANALYTICS
          </span>

          <h1>
            Water Intelligence
          </h1>

          <p>
            Taluka-level analysis of water
            stress across Pune District
          </p>

        </div>


        <div className="analytics-live">

          <span className="live-dot"></span>

          <div>

            <small>
              DATASET STATUS
            </small>

            <strong>
              {totalTalukas} Talukas Active
            </strong>

          </div>

        </div>

      </section>


      {/* =================================================
          KPI CARDS
      ================================================= */}

      <section className="analytics-kpis">


        <div className="analytics-kpi-card blue">

          <div className="kpi-icon">
            💧
          </div>

          <div>

            <span>
              AVERAGE STRESS
            </span>

            <strong>
              {averageStress.toFixed(1)}
              <small>/100</small>
            </strong>

            <p>
              District-wide average
            </p>

          </div>

        </div>


        <div className="analytics-kpi-card green">

          <div className="kpi-icon">
            ✓
          </div>

          <div>

            <span>
              LOW RISK
            </span>

            <strong>
              {lowCount}
            </strong>

            <p>
              Talukas
            </p>

          </div>

        </div>


        <div className="analytics-kpi-card orange">

          <div className="kpi-icon">
            ⚠
          </div>

          <div>

            <span>
              HIGH RISK
            </span>

            <strong>
              {highCount}
            </strong>

            <p>
              Talukas
            </p>

          </div>

        </div>


        <div className="analytics-kpi-card red">

          <div className="kpi-icon">
            !
          </div>

          <div>

            <span>
              CRITICAL
            </span>

            <strong>
              {criticalCount}
            </strong>

            <p>
              Talukas requiring action
            </p>

          </div>

        </div>


      </section>


      {/* =================================================
          CHART ROW
      ================================================= */}

      <section className="analytics-chart-grid">


        {/* RISK DISTRIBUTION */}

        <div className="analytics-card">

          <div className="analytics-card-header">

            <div>

              <span>
                RISK PROFILE
              </span>

              <h2>
                Risk Distribution
              </h2>

              <p>
                Classification across all
                {totalTalukas} talukas
              </p>

            </div>

          </div>


          <div className="pie-wrapper">

            <ResponsiveContainer
              width="100%"
              height={310}
            >

              <PieChart>

                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="48%"
                  innerRadius={82}
                  outerRadius={120}
                  paddingAngle={3}
                  dataKey="value"
                >

                  {riskDistribution.map(
                    (entry) => (

                      <Cell
                        key={entry.name}
                        fill={
                          riskColors[
                            entry.name
                          ]
                        }
                      />

                    )
                  )}

                </Pie>


                <Tooltip />


                <Legend
                  verticalAlign="bottom"
                  height={36}
                />

              </PieChart>

            </ResponsiveContainer>


            <div className="pie-center">

              <strong>
                {totalTalukas}
              </strong>

              <span>
                TALUKAS
              </span>

            </div>

          </div>

        </div>


        {/* TOP RISK */}

        <div className="analytics-card">

          <div className="analytics-card-header">

            <div>

              <span>
                PRIORITY ANALYSIS
              </span>

              <h2>
                Highest-Risk Talukas
              </h2>

              <p>
                Top 10 locations by
                water stress score
              </p>

            </div>

          </div>


          <div className="risk-bar-chart">

            <ResponsiveContainer
              width="100%"
              height={340}
            >

              <BarChart
                data={barData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 20,
                  left: 45,
                  bottom: 5
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  domain={[
                    0,
                    "dataMax + 3"
                  ]}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{
                    fontSize: 11
                  }}
                />

                <Tooltip />

                <Bar
                  dataKey="score"
                  name="Stress Score"
                  radius={[
                    0,
                    6,
                    6,
                    0
                  ]}
                >

                  {barData.map(
                    (item) => (

                      <Cell
                        key={item.name}
                        fill={
                          riskColors[
                            item.risk
                          ]
                        }
                      />

                    )
                  )}

                </Bar>

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>


      </section>


      {/* =================================================
          DECISION SUPPORT
      ================================================= */}

      <section className="decision-support">


        <div className="decision-content">

          <span className="decision-label">
            DECISION SUPPORT
          </span>

          <h2>
            Intervention Priority
          </h2>

          <p>
            {priorityCount} of {totalTalukas}
            {" "}
            monitored talukas are classified
            as High or Critical risk and should
            receive priority assessment.
          </p>


          <div className="decision-progress">

            <div
              className="decision-progress-fill"
              style={{
                width:
                  `${priorityPercentage}%`
              }}
            />

          </div>


          <div className="decision-footer">

            <span>
              Priority coverage
            </span>

            <strong>
              {priorityPercentage}%
            </strong>

          </div>

        </div>


        <div className="decision-stats">

          <div>

            <strong>
              {highCount}
            </strong>

            <span>
              High Risk
            </span>

          </div>


          <div>

            <strong>
              {criticalCount}
            </strong>

            <span>
              Critical
            </span>

          </div>


          <div>

            <strong>
              {priorityCount}
            </strong>

            <span>
              Priority
            </span>

          </div>

        </div>

      </section>


      {/* =================================================
          FULL TALUKA TABLE
      ================================================= */}

      <section className="analytics-table-card">


        <div className="analytics-table-header">

          <div>

            <span>
              TALUKA INTELLIGENCE
            </span>

            <h2>
              Water Stress by Taluka
            </h2>

            <p>
              Complete dataset — all{" "}
              {totalTalukas} monitored
              locations
            </p>

          </div>


          <div className="table-controls">

            <div className="table-search">

              <span>
                🔎
              </span>

              <input
                type="text"
                placeholder="Search taluka..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
              />

            </div>


            <select
              value={riskFilter}
              onChange={(e) =>
                setRiskFilter(
                  e.target.value
                )
              }
            >

              <option value="All">
                All Risks
              </option>

              <option value="Low">
                Low
              </option>

              <option value="Moderate">
                Moderate
              </option>

              <option value="High">
                High
              </option>

              <option value="Critical">
                Critical
              </option>

            </select>

          </div>

        </div>


        <div className="table-result">

          Showing{" "}
          <strong>
            {filteredData.length}
          </strong>{" "}
          of{" "}
          <strong>
            {totalTalukas}
          </strong>{" "}
          talukas

        </div>


        <div className="analytics-table-scroll">

          <table className="analytics-table">

            <thead>

              <tr>

                <th>
                  #
                </th>

                <th>
                  TALUKA
                </th>

                <th>
                  STRESS SCORE
                </th>

                <th>
                  RISK LEVEL
                </th>

                <th>
                  STRESS INDEX
                </th>

                <th>
                  PRIORITY
                </th>

              </tr>

            </thead>


            <tbody>

              {filteredData.map(
                (item, index) => {

                  const percentage =
                    Math.min(
                      (
                        item.score /
                        40
                      ) *
                      100,
                      100
                    );

                  return (

                    <tr
                      key={item.id}
                    >

                      <td>
                        {index + 1}
                      </td>


                      <td>

                        <div className="taluka-name">

                          <strong>
                            {item.taluka}
                          </strong>

                          <span>
                            Pune District
                          </span>

                        </div>

                      </td>


                      <td>

                        <strong
                          className="score-value"
                          style={{
                            color:
                              riskColors[
                                item.risk
                              ]
                          }}
                        >
                          {item.score}
                        </strong>

                        <span>
                          /100
                        </span>

                      </td>


                      <td>

                        <span
                          className="risk-badge"
                          style={{
                            color:
                              riskColors[
                                item.risk
                              ],
                            background:
                              `${riskColors[item.risk]}18`
                          }}
                        >

                          <i
                            style={{
                              background:
                                riskColors[
                                  item.risk
                                ]
                            }}
                          />

                          {item.risk}

                        </span>

                      </td>


                      <td>

                        <div className="stress-bar">

                          <div>

                            <span
                              style={{
                                width:
                                  `${percentage}%`,
                                background:
                                  riskColors[
                                    item.risk
                                  ]
                              }}
                            />

                          </div>

                        </div>

                      </td>


                      <td>

                        <span
                          className={
                            item.risk ===
                            "Critical"
                              ? "priority critical"
                              : item.risk ===
                                "High"
                                ? "priority high"
                                : item.risk ===
                                  "Moderate"
                                  ? "priority monitor"
                                  : "priority stable"
                          }
                        >

                          {item.risk ===
                          "Critical"
                            ? "Immediate"
                            : item.risk ===
                              "High"
                              ? "Priority"
                              : item.risk ===
                                "Moderate"
                                ? "Monitor"
                                : "Stable"}

                        </span>

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>


          {filteredData.length ===
            0 && (

            <div className="no-results">

              <span>
                🔎
              </span>

              <h3>
                No talukas found
              </h3>

              <p>
                Try changing your search
                or risk filter.
              </p>

            </div>

          )}

        </div>

      </section>


    </main>

  );

}


export default Analytics;