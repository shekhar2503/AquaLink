import { useEffect, useState } from "react";
import { loadPuneData } from "../utils/loadAquaLinkData";
import { talukaNames } from "../utils/talukaNames";

function Recommendations() {

  const [data, setData] = useState([]);

  useEffect(() => {
    loadPuneData()
      .then((result) => {
        console.log("Recommendation Data:", result);
        setData(result);
      })
      .catch((error) => {
        console.error(
          "Error loading recommendation data:",
          error
        );
      });
  }, []);

  if (!data.length) {
    return (
      <div className="recommendations-page">
        <h1>Water Management Recommendations</h1>
        <p>Loading recommendations...</p>
      </div>
    );
  }

  // Average Pune stress
  const averageStress =
    data.reduce(
      (sum, item) =>
        sum + Number(item.Water_Stress_Score || 0),
      0
    ) / data.length;

  // Priority locations (High or Critical, or top scored if all moderate)
  const highRiskLocations = [...data]
    .sort((a, b) => Number(b.Water_Stress_Score || 0) - Number(a.Water_Stress_Score || 0));

  const getRiskLevel = (score) => {
    const value = Number(score);
    if (value >= 65) return "Critical";
    if (value >= 45) return "High";
    if (value >= 25) return "Moderate";
    return "Low";
  };

  const getRecommendation = (area) => {
    if (area?.Recommended_Action && area.Recommended_Action !== "") {
      return {
        action: area.Recommended_Action,
        reason: `Targeted intervention based on recorded Groundwater Extraction Stage (${area.GW_Extraction_Stage_pct || 'N/A'}%) and Piped Coverage (${area.Piped_Water_Coverage_pct || 'N/A'}%).`,
        priority: getRiskLevel(area.Water_Stress_Score),
      };
    }

    const gwStage = Number(area.GW_Extraction_Stage_pct || 0);
    const coverage = Number(area.Piped_Water_Coverage_pct || 100);
    const trend = String(area.GW_Historical_Trend || "Stable");

    const gwHigh = gwStage >= 90;
    const supplyHigh = coverage < 75;
    const isDeclining = trend.includes("Declining");

    if (gwHigh && supplyHigh) {
      return {
        action: "Groundwater recharge + Water-supply augmentation",
        reason: "Compound stress detected: high groundwater extraction stage combined with piped water supply shortfall.",
        priority: "Critical",
      };
    }

    if (gwHigh) {
      return {
        action: isDeclining
          ? "Urgent groundwater recharge & artificial extraction controls"
          : "Groundwater conservation & extraction management",
        reason: "Groundwater extraction exceeds safety norms; demands artificial recharge structures and irrigation efficiency.",
        priority: "High",
      };
    }

    if (supplyHigh) {
      return {
        action: "Improve piped water-supply infrastructure & LPCD distribution",
        reason: "Sub-norm per capita piped supply coverage requires distribution network expansion under Jal Jeevan Mission.",
        priority: "High",
      };
    }

    if (isDeclining) {
      return {
        action: "Increase groundwater table monitoring & rainwater harvesting",
        reason: "Declining 5-year water table trend indicates emerging vulnerability.",
        priority: "Medium",
      };
    }

    return {
      action: "Monitor & maintain (low priority)",
      reason: "Current indicators operate within acceptable baseline safety thresholds.",
      priority: "Low",
    };
  };


  return (

    <div className="recommendations-page">

      {/* HEADER */}

      <div className="recommendations-header">

        <div>

          <h1>
            Water Management Recommendations
          </h1>

          <p>
            Data-driven intervention priorities
            for Pune District
          </p>

        </div>

        <div className="recommendation-badge">
          AquaLink DSS
        </div>

      </div>


      {/* SUMMARY */}

      <div className="recommendation-summary">

        <div className="recommendation-stat">

          <span>
            AVERAGE STRESS
          </span>

          <strong>
            {averageStress.toFixed(1)}
          </strong>

          <small>
            /100
          </small>

        </div>


        <div className="recommendation-stat">

          <span>
            PRIORITY LOCATIONS
          </span>

          <strong>
            {highRiskLocations.length}
          </strong>

          <small>
            High / Critical
          </small>

        </div>


        <div className="recommendation-stat">

          <span>
            LOCATIONS MONITORED
          </span>

          <strong>
            {data.length}
          </strong>

          <small>
            Pune District
          </small>

        </div>

      </div>


      {/* RECOMMENDATION CARDS */}

      <div className="recommendation-section">

        <div className="recommendation-section-header">

          <div>

            <h2>
              Recommended Actions
            </h2>

            <p>
              Priority interventions based on
              observed water stress
            </p>

          </div>

        </div>


        <div className="recommendation-grid">

          {highRiskLocations
            .slice(0, 6)
            .map((area, index) => {

              const recommendation = getRecommendation(area);


              const taluka =
                talukaNames[area.Taluka] ||
                area.Taluka;

              return (

                <div
                  className="recommendation-card"
                  key={index}
                >

                  <div className="recommendation-card-top">

                    <div>

                      <span className="recommendation-label">
                        PRIORITY {index + 1}
                      </span>

                      <h3>
                        {taluka}
                      </h3>

                    </div>

                    <div className="recommendation-score">

                      <strong>
                        {area.Water_Stress_Score}
                      </strong>

                      <span>
                        /100
                      </span>

                    </div>

                  </div>


                  <div className="recommendation-risk">

                    <span>
                      Risk Level
                    </span>

                    <strong>
                      {getRiskLevel(
                        area.Water_Stress_Score
                      )}
                    </strong>

                  </div>


                  <div className="recommendation-action">

                    <span>
                      Recommended Action
                    </span>

                    <strong>
                      {recommendation.action}
                    </strong>

                  </div>


                  <p className="recommendation-reason">

                    {recommendation.reason}

                  </p>


                  <div className="recommendation-footer">

                    <span>
                      Data records
                    </span>

                    <strong>
                      {area.Record_Count}
                    </strong>

                  </div>

                </div>

              );

            })}

        </div>

      </div>


      {/* GENERAL STRATEGIES */}

      <div className="strategy-card">

        <div>

          <span className="section-label">
            DISTRICT-LEVEL STRATEGY
          </span>

          <h2>
            Recommended Water Management Measures
          </h2>

        </div>


        <div className="strategy-list">

          <div className="strategy-item">

            <span>01</span>

            <div>

              <strong>
                Rainwater Harvesting
              </strong>

              <p>
                Increase local rainwater capture
                and groundwater recharge.
              </p>

            </div>

          </div>


          <div className="strategy-item">

            <span>02</span>

            <div>

              <strong>
                Groundwater Monitoring
              </strong>

              <p>
                Track groundwater conditions in
                high-stress locations.
              </p>

            </div>

          </div>


          <div className="strategy-item">

            <span>03</span>

            <div>

              <strong>
                Demand Management
              </strong>

              <p>
                Encourage efficient agricultural,
                domestic and industrial water use.
              </p>

            </div>

          </div>


          <div className="strategy-item">

            <span>04</span>

            <div>

              <strong>
                Continuous Monitoring
              </strong>

              <p>
                Regularly update the dashboard as
                new water data becomes available.
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>

  );
}

export default Recommendations;