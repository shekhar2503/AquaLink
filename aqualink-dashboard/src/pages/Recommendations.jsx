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

  // Highest-risk locations
  const highRiskLocations = [...data]
    .filter(
      (item) =>
        Number(item.Water_Stress_Score) >= 30
    )
    .sort(
      (a, b) =>
        Number(b.Water_Stress_Score) -
        Number(a.Water_Stress_Score)
    );

  const getRiskLevel = (score) => {

    const value = Number(score);

    if (value <= 27) return "Low";
    if (value <= 29) return "Moderate";
    if (value <= 31) return "High";

    return "Critical";
  };

  const getRecommendation = (score) => {

    const value = Number(score);

    if (value >= 32) {
      return {
        action: "Immediate Water Conservation",
        reason:
          "Critical water stress requires immediate intervention and demand reduction.",
        priority: "Critical"
      };
    }

    if (value >= 30) {
      return {
        action: "Increase Groundwater Monitoring",
        reason:
          "High stress indicates the need for closer monitoring and conservation measures.",
        priority: "High"
      };
    }

    if (value >= 28) {
      return {
        action: "Promote Rainwater Harvesting",
        reason:
          "Moderate stress can be addressed through recharge and efficient water use.",
        priority: "Medium"
      };
    }

    return {
      action: "Continue Monitoring",
      reason:
        "Current stress is relatively low but should continue to be monitored.",
      priority: "Low"
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

              const recommendation =
                getRecommendation(
                  area.Water_Stress_Score
                );

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