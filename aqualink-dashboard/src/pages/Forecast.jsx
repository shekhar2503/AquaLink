import { useEffect, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import {
  loadPuneHistoricalData,
} from "../utils/loadAquaLinkData";


function Forecast() {

  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);


  // =========================================
  // LOAD DATA
  // =========================================

  useEffect(() => {

    loadPuneHistoricalData()
      .then((result) => {

        console.log(
          "Pune Historical Data:",
          result
        );

        setHistoricalData(result);
        setLoading(false);

      })
      .catch((error) => {

        console.error(
          "Error loading historical data:",
          error
        );

        setLoading(false);

      });

  }, []);


  // =========================================
  // LOADING
  // =========================================

  if (loading) {

    return (
      <div className="forecast-page">

        <div className="forecast-header">

          <div>

            <span className="section-label">
              PREDICTIVE ANALYTICS
            </span>

            <h1>
              Water Stress Forecast
            </h1>

            <p>
              Historical trend and projected water
              stress for Pune District
            </p>

          </div>

        </div>

        <div className="forecast-loading">

          <p>
            Loading historical data...
          </p>

        </div>

      </div>
    );

  }


  // =========================================
  // NO DATA
  // =========================================

  if (!historicalData.length) {

    return (
      <div className="forecast-page">

        <div className="forecast-header">

          <div>

            <span className="section-label">
              PREDICTIVE ANALYTICS
            </span>

            <h1>
              Water Stress Forecast
            </h1>

            <p>
              Historical trend and projected water
              stress for Pune District
            </p>

          </div>

        </div>

        <div className="forecast-loading">

          <h2>
            No historical data available
          </h2>

          <p>
            Please check the CSV data and try again.
          </p>

        </div>

      </div>
    );

  }


  // =========================================
  // PREPARE YEAR-WISE DATA
  // =========================================

  const yearMap = {};


  historicalData.forEach((row) => {

    const year = Number(row.Year);

    const score =
      Number(row.Water_Stress_Score);


    if (
      isNaN(year) ||
      isNaN(score)
    ) {
      return;
    }


    if (!yearMap[year]) {

      yearMap[year] = {
        total: 0,
        count: 0,
      };

    }


    yearMap[year].total += score;

    yearMap[year].count += 1;

  });


  // =========================================
  // YEARLY AVERAGE
  // =========================================

  const yearlyData = Object.entries(yearMap)

    .map(([year, values]) => {

      const average =
        values.total / values.count;

      return {
        year: Number(year),
        score: Number(
          average.toFixed(1)
        ),
      };

    })

    .sort(
      (a, b) => a.year - b.year
    );


  // =========================================
  // CURRENT SCORE
  // =========================================

  const currentData =
    yearlyData[yearlyData.length - 1];


  const previousData =
    yearlyData.length >= 2
      ? yearlyData[yearlyData.length - 2]
      : null;


  const currentScore =
    currentData?.score || 0;


  // =========================================
  // YEARLY CHANGE
  // =========================================

  const yearlyChange =
    previousData
      ? Number(
          (
            currentScore -
            previousData.score
          ).toFixed(1)
        )
      : 0;


  // =========================================
  // FORECAST
  // =========================================

  const forecastYears = 3;


  const forecastValues = [];


  for (
    let i = 1;
    i <= forecastYears;
    i++
  ) {

    const predicted =
      Math.min(
        100,
        Math.max(
          0,
          currentScore +
            yearlyChange * i
        )
      );


    forecastValues.push({

      year:
        currentData.year + i,

      score:
        Number(
          predicted.toFixed(1)
        ),

    });

  }


  // =========================================
  // CHART DATA
  // =========================================

  const chartData = [

    ...yearlyData.map(
      (item) => ({

        year: item.year,

        historical:
          item.score,

        forecast:
          null,

      })
    ),


    // Connect forecast to current year
    {
      year: currentData.year,

      historical: null,

      forecast: currentScore,

    },


    ...forecastValues.map(
      (item) => ({

        year: item.year,

        historical: null,

        forecast: item.score,

      })
    ),

  ];


  // =========================================
  // RISK LEVEL
  // =========================================

  const getRiskLevel = (score) => {
    const value = Number(score);

    if (value >= 65) return "Critical";
    if (value >= 45) return "High";
    if (value >= 25) return "Moderate";

    return "Low";
  };



  // =========================================
  // RISK CLASS
  // =========================================

  const getRiskClass = (score) => {

    const risk =
      getRiskLevel(score);

    return risk.toLowerCase();

  };


  // =========================================
  // FINAL FORECAST SCORE
  // =========================================

  const finalForecast =
    forecastValues.length > 0
      ? forecastValues[
          forecastValues.length - 1
        ].score
      : currentScore;


  // =========================================
  // TREND
  // =========================================

  const getTrendText = () => {

    if (yearlyChange < 0) {
      return "Decreasing";
    }

    if (yearlyChange > 0) {
      return "Increasing";
    }

    return "Stable";

  };


  const trendText =
    getTrendText();


  // =========================================
  // OUTLOOK DATA
  // =========================================

  const outlookData = [

    ...yearlyData.map(
      (item) => ({

        year: item.year,

        type: "Historical",

        score: item.score,

        risk:
          getRiskLevel(item.score),

      })
    ),


    ...forecastValues.map(
      (item) => ({

        year: item.year,

        type: "Forecast",

        score: item.score,

        risk:
          getRiskLevel(item.score),

      })
    ),

  ];


  // =========================================
  // RETURN
  // =========================================

  return (

    <div className="forecast-page">


      {/* =====================================
          HEADER
      ===================================== */}

      <div className="forecast-header">

        <div>

          <span className="section-label">
            PREDICTIVE ANALYTICS
          </span>

          <h1>
            Water Stress Forecast
          </h1>

          <p>
            Historical trend and projected water
            stress for Pune District
          </p>

        </div>


        <div className="forecast-badge">
          Statistical OLS Model
        </div>


      </div>


      {/* =====================================
          SUMMARY CARDS
      ===================================== */}

      <div className="forecast-summary">


        {/* CURRENT STRESS */}

        <div className="forecast-stat">

          <span>
            CURRENT STRESS
          </span>

          <strong>
            {currentScore.toFixed(1)}
          </strong>

          <small>
            /100
          </small>

        </div>


        {/* CURRENT RISK */}

        <div className="forecast-stat">

          <span>
            CURRENT RISK
          </span>

          <strong>
            {getRiskLevel(
              currentScore
            )}
          </strong>

          <small>
            Latest available data
          </small>

        </div>


        {/* FORECAST */}

        <div className="forecast-stat">

          <span>
            FORECAST SCORE
          </span>

          <strong>
            {finalForecast.toFixed(1)}
          </strong>

          <small>
            Projected {currentData.year + 3}
          </small>

        </div>


        {/* TREND */}

        <div className="forecast-stat">

          <span>
            TREND
          </span>

          <strong
            className={
              yearlyChange < 0
                ? "trend-positive"
                : yearlyChange > 0
                ? "trend-negative"
                : ""
            }
          >

            {yearlyChange < 0
              ? "↓ Decreasing"
              : yearlyChange > 0
              ? "↑ Increasing"
              : "→ Stable"}

          </strong>

          <small>

            {yearlyChange > 0
              ? `+${yearlyChange}`
              : yearlyChange}

            {" "}points/year

          </small>

        </div>


      </div>


      {/* =====================================
          TREND CHART
      ===================================== */}

      <div className="forecast-card">


        <div className="forecast-chart-header">

          <div>

            <span className="section-label">
              TREND ANALYSIS
            </span>

            <h2>
              Water Stress Trend
            </h2>

            <p>
              Historical Pune water stress with
              projected trend
            </p>

          </div>

        </div>


        <div
          style={{
            width: "100%",
            height: "430px",
          }}
        >

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <LineChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 15,
                bottom: 10,
              }}
            >

              <CartesianGrid
                strokeDasharray="3 3"
              />


              <XAxis
                dataKey="year"
                tick={{
                  fontSize: 12,
                }}
              />


              <YAxis
                domain={[0, 100]}
                ticks={[
                  0,
                  20,
                  40,
                  60,
                  80,
                  100,
                ]}
                label={{
                  value:
                    "Water Stress Score",
                  angle: -90,
                  position:
                    "insideLeft",
                }}
              />


              <Tooltip
                formatter={(value) => [
                  `${value}/100`,
                  "Water Stress",
                ]}
              />


              {/* CRITICAL THRESHOLD */}

              <ReferenceLine
                y={65}
                stroke="#dc2626"
                strokeDasharray="6 6"
                label={{
                  value:
                    "Critical ≥65",
                  position:
                    "insideTopRight",
                }}
              />



              {/* HISTORICAL */}

              <Line
                type="monotone"
                dataKey="historical"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{
                  r: 5,
                }}
                connectNulls={false}
                name="Historical data"
              />


              {/* FORECAST */}

              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#dc2626"
                strokeWidth={3}
                strokeDasharray="8 6"
                dot={{
                  r: 5,
                }}
                connectNulls={true}
                name="Forecast trend"
              />

            </LineChart>

          </ResponsiveContainer>

        </div>


        {/* CHART LEGEND */}

        <div className="forecast-chart-legend">

          <div>

            <span
              className="forecast-legend-dot historical"
            ></span>

            Historical data

          </div>


          <div>

            <span
              className="forecast-legend-dot forecast"
            ></span>

            Forecast trend

          </div>


          <div>

            <span
              className="forecast-legend-dot critical"
            ></span>

            Critical threshold ≥65

          </div>


        </div>

      </div>


      {/* =====================================
          FORECAST OUTLOOK
      ===================================== */}

      <div className="forecast-outlook-card">


        {/* HEADER */}

        <div className="forecast-outlook-header">

          <div>

            <span className="section-label">
              PROJECTION SUMMARY
            </span>

            <h2>
              Forecast Outlook
            </h2>

            <p>
              Historical observations and projected
              water stress levels
            </p>

          </div>


          <div className="forecast-outlook-badge">
            Trend Based
          </div>

        </div>


        {/* SUMMARY */}

        <div className="outlook-summary">


          <div className="outlook-summary-item">

            <span>
              CURRENT
            </span>

            <strong>
              {currentScore.toFixed(1)}
            </strong>

            <small>
              /100
            </small>

          </div>


          <div className="outlook-summary-item">

            <span>
              FORECAST
            </span>

            <strong>
              {finalForecast.toFixed(1)}
            </strong>

            <small>
              /100
            </small>

          </div>


          <div className="outlook-summary-item">

            <span>
              TREND
            </span>

            <strong
              className={
                yearlyChange < 0
                  ? "trend-positive"
                  : yearlyChange > 0
                  ? "trend-negative"
                  : ""
              }
            >

              {yearlyChange < 0
                ? "↓ Improving"
                : yearlyChange > 0
                ? "↑ Worsening"
                : "→ Stable"}

            </strong>

          </div>

        </div>


        {/* TABLE */}

        <div className="forecast-table-wrapper">

          <table className="forecast-table">

            <thead>

              <tr>

                <th>
                  YEAR
                </th>

                <th>
                  TYPE
                </th>

                <th>
                  STRESS SCORE
                </th>

                <th>
                  RISK LEVEL
                </th>

                <th>
                  STATUS
                </th>

              </tr>

            </thead>


            <tbody>

              {outlookData.map(
                (item, index) => {

                  const isForecast =
                    item.type ===
                    "Forecast";


                  return (

                    <tr
                      key={`${item.year}-${index}`}
                      className={
                        isForecast
                          ? "forecast-row"
                          : ""
                      }
                    >


                      {/* YEAR */}

                      <td>

                        <strong>
                          {item.year}
                        </strong>

                      </td>


                      {/* TYPE */}

                      <td>

                        <span
                          className={
                            isForecast
                              ? "forecast-type"
                              : "historical-type"
                          }
                        >

                          {item.type}

                        </span>

                      </td>


                      {/* SCORE */}

                      <td>

                        <div className="forecast-score-cell">

                          <strong>
                            {item.score.toFixed(1)}
                          </strong>

                          <span>
                            /100
                          </span>

                        </div>

                      </td>


                      {/* RISK */}

                      <td>

                        <span
                          className={`risk-pill ${getRiskClass(
                            item.score
                          )}`}
                        >

                          <span className="risk-pill-dot"></span>

                          {item.risk}

                        </span>

                      </td>


                      {/* STATUS */}

                      <td>

                        <span
                          className={
                            isForecast
                              ? "status-projected"
                              : "status-observed"
                          }
                        >

                          {isForecast
                            ? "Projected"
                            : "Observed"}

                        </span>

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>


        {/* INFORMATION NOTE */}

        <div className="forecast-outlook-note">

          <span className="forecast-note-icon">
            💡
          </span>

          <div>

            <strong>
              Forecast interpretation
            </strong>

            <p>
              The projection extends the observed
              year-to-year change in Pune's
              historical water stress score.
              It should be treated as a trend
              indicator for planning and
              decision support rather than a
              definitive predictive model.
            </p>

          </div>

        </div>


      </div>


    </div>

  );

}


export default Forecast;