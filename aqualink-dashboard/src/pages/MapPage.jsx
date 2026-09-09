import { useEffect, useMemo, useState } from "react";

import RiskMap from "../components/RiskMap";

import { loadPuneData } from "../utils/loadAquaLinkData";


function MapPage() {

  // =========================================
  // STATE
  // =========================================

  const [data, setData] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedRisk, setSelectedRisk] =
    useState("All");


  // =========================================
  // LOAD DATA
  // =========================================

  useEffect(() => {

    loadPuneData()
      .then((result) => {

        console.log(
          "Map Page Data:",
          result
        );

        setData(result);

      })
      .catch((error) => {

        console.error(
          "Error loading map data:",
          error
        );

      });

  }, []);


  // =========================================
  // RISK LEVEL
  // =========================================

  const getRiskLevel = (score) => {

    const value = Number(score);

    if (value <= 27) {
      return "Low";
    }

    if (value <= 29) {
      return "Moderate";
    }

    if (value <= 31) {
      return "High";
    }

    return "Critical";
  };


  // =========================================
  // FILTER DATA
  // =========================================

  const filteredData = useMemo(() => {

    const search =
      searchTerm.trim().toLowerCase();


    return data.filter((item) => {

      const risk = getRiskLevel(
        item.Water_Stress_Score
      );


      const name = String(
        item.Taluka ||
        item.Village_Ward ||
        ""
      ).toLowerCase();


      const matchesRisk =
        selectedRisk === "All" ||
        risk === selectedRisk;


      const matchesSearch =
        search === "" ||
        name.includes(search);


      return (
        matchesRisk &&
        matchesSearch
      );

    });

  }, [
    data,
    selectedRisk,
    searchTerm
  ]);


  // =========================================
  // DISTRICT AVERAGE
  // =========================================

  const averageStress =
    data.length > 0

      ? data.reduce(
          (sum, item) =>
            sum +
            Number(
              item.Water_Stress_Score || 0
            ),
          0
        ) / data.length

      : 0;


  // =========================================
  // RISK COUNTS
  // =========================================

  const lowRisk = data.filter(
    (item) =>
      Number(
        item.Water_Stress_Score
      ) <= 27
  ).length;


  const moderateRisk = data.filter(
    (item) => {

      const score =
        Number(
          item.Water_Stress_Score
        );

      return (
        score >= 28 &&
        score <= 29
      );

    }
  ).length;


  const highRisk = data.filter(
    (item) => {

      const score =
        Number(
          item.Water_Stress_Score
        );

      return (
        score >= 30 &&
        score <= 31
      );

    }
  ).length;


  const criticalRisk = data.filter(
    (item) =>
      Number(
        item.Water_Stress_Score
      ) >= 32
  ).length;


  // =========================================
  // LOADING STATE
  // =========================================

  if (!data.length) {

    return (

      <div className="map-page">

        <div className="map-page-header">

          <div>

            <span className="section-label">
              GIS MONITORING
            </span>

            <h1>
              Pune Water Risk Map
            </h1>

            <p>
              Loading spatial water stress data...
            </p>

          </div>

          <div className="map-status">

            <span className="status-dot"></span>

            Loading Dataset

          </div>

        </div>

      </div>

    );

  }


  // =========================================
  // PAGE
  // =========================================

  return (

    <div className="map-page">


      {/* =====================================
          HEADER
      ===================================== */}

      <div className="map-page-header">

        <div>

          <span className="section-label">
            GIS MONITORING
          </span>

          <h1>
            Pune Water Risk Map
          </h1>

          <p>
            Spatial intelligence for identifying
            water-stressed locations
          </p>

        </div>


        <div className="map-status">

          <span className="status-dot"></span>

          Dataset Active

        </div>

      </div>


      {/* =====================================
          RISK SUMMARY
      ===================================== */}

      <div className="map-risk-summary">


        {/* TOTAL */}

        <div className="map-risk-total">

          <span>
            MONITORED LOCATIONS
          </span>

          <strong>
            {data.length}
          </strong>

          <small>
            Pune District
          </small>

        </div>


        {/* LOW */}

        <div className="map-risk-stat low">

          <span className="map-risk-dot"></span>

          <div>

            <strong>
              {lowRisk}
            </strong>

            <small>
              Low
            </small>

          </div>

        </div>


        {/* MODERATE */}

        <div className="map-risk-stat moderate">

          <span className="map-risk-dot"></span>

          <div>

            <strong>
              {moderateRisk}
            </strong>

            <small>
              Moderate
            </small>

          </div>

        </div>


        {/* HIGH */}

        <div className="map-risk-stat high">

          <span className="map-risk-dot"></span>

          <div>

            <strong>
              {highRisk}
            </strong>

            <small>
              High
            </small>

          </div>

        </div>


        {/* CRITICAL */}

        <div className="map-risk-stat critical">

          <span className="map-risk-dot"></span>

          <div>

            <strong>
              {criticalRisk}
            </strong>

            <small>
              Critical
            </small>

          </div>

        </div>

      </div>


      {/* =====================================
          MAP TOOLBAR
      ===================================== */}

      <div className="map-toolbar">


        {/* SEARCH */}

        <div className="map-search">

          <span>
            🔎
          </span>

          <input
            type="text"
            placeholder="Search taluka or location..."
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(
                e.target.value
              )
            }
          />

        </div>


        {/* FILTER */}

        <div className="map-filter-group">

          <span>
            FILTER
          </span>


          <select
            value={selectedRisk}
            onChange={(e) =>
              setSelectedRisk(
                e.target.value
              )
            }
          >

            <option value="All">
              All Risk Levels
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


      {/* =====================================
          MAP
      ===================================== */}

      <div className="map-main-card">


        {/* MAP HEADER */}

        <div className="map-main-header">

          <div>

            <span className="section-label">
              SPATIAL VIEW
            </span>

            <h2>
              Water Stress Distribution
            </h2>

          </div>


          <div className="map-result-count">

            Showing{" "}

            <strong>
              {filteredData.length}
            </strong>{" "}

            of{" "}

            <strong>
              {data.length}
            </strong>{" "}

            locations

          </div>

        </div>


        {/* MAP */}

        <div className="map-full">

          <RiskMap
            filteredData={filteredData}
          />

        </div>


      </div>


      {/* =====================================
          LEGEND
      ===================================== */}

      <div className="map-legend-card">


        <div>

          <strong>
            Risk Classification
          </strong>

          <span>
            Water stress score
          </span>

        </div>


        <div className="map-legend-items">


          <div>

            <span className="legend-dot low"></span>

            <span>
              Low
            </span>

            <small>
              0–27
            </small>

          </div>


          <div>

            <span className="legend-dot moderate"></span>

            <span>
              Moderate
            </span>

            <small>
              28–29
            </small>

          </div>


          <div>

            <span className="legend-dot high"></span>

            <span>
              High
            </span>

            <small>
              30–31
            </small>

          </div>


          <div>

            <span className="legend-dot critical"></span>

            <span>
              Critical
            </span>

            <small>
              32+
            </small>

          </div>


        </div>

      </div>


      {/* =====================================
          INFORMATION CARDS
      ===================================== */}

      <div className="map-bottom-grid">


        {/* EXPLORE */}

        <div className="map-info-card">

          <span className="map-info-icon">
            📍
          </span>

          <div>

            <h3>
              Explore locations
            </h3>

            <p>
              Click any marker to view the
              location's water stress score,
              risk classification and
              geographic information.
            </p>

          </div>

        </div>


        {/* PRIORITIZE */}

        <div className="map-info-card">

          <span className="map-info-icon">
            🎯
          </span>

          <div>

            <h3>
              Prioritize intervention
            </h3>

            <p>
              Red and orange markers indicate
              locations where water stress
              requires greater attention.
            </p>

          </div>

        </div>


        {/* AVERAGE */}

        <div className="map-info-card">

          <span className="map-info-icon">
            📊
          </span>

          <div>

            <h3>
              Average district stress
            </h3>

            <p>

              Current Pune average:

              <strong>
                {" "}
                {averageStress.toFixed(1)}
                /100
              </strong>

            </p>

          </div>

        </div>


      </div>


    </div>

  );

}


export default MapPage;