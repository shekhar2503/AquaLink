import { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import { talukaNames } from "../utils/talukaNames";
import { loadPuneData } from "../utils/loadAquaLinkData";


/* =========================================================
   MAP CENTER
========================================================= */

const PUNE_CENTER = [18.5204, 73.8567];


/* =========================================================
   RISK HELPERS
========================================================= */

function getRiskLevel(score) {
  const value = Number(score);

  if (value >= 32) return "Critical";
  if (value >= 30) return "High";
  if (value >= 28) return "Moderate";

  return "Low";
}


function getRiskColor(risk) {
  switch (risk) {
    case "Critical":
      return "#dc2626";

    case "High":
      return "#f97316";

    case "Moderate":
      return "#eab308";

    default:
      return "#16a34a";
  }
}


function getRiskBackground(risk) {
  switch (risk) {
    case "Critical":
      return "#fef2f2";

    case "High":
      return "#fff7ed";

    case "Moderate":
      return "#fefce8";

    default:
      return "#f0fdf4";
  }
}


/* =========================================================
   GET TALUKA NAME
========================================================= */

function getTalukaName(item) {
  if (!item) return "Unknown Taluka";

  const possibleKeys = [
    item.Taluka,
    item.taluka,
    item.TALUKA,
    item.Taluka_Name,
    item.taluka_name,
    item.TalukaName,
  ];

  for (const value of possibleKeys) {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      continue;
    }

    const rawValue = String(value).trim();

    /* Direct mapping */

    if (
      talukaNames &&
      talukaNames[rawValue]
    ) {
      return talukaNames[rawValue];
    }


    /* Case-insensitive mapping */

    if (talukaNames) {
      const matchedKey =
        Object.keys(talukaNames).find(
          (key) =>
            String(key).toLowerCase() ===
            rawValue.toLowerCase()
        );

      if (matchedKey) {
        return talukaNames[matchedKey];
      }
    }


    /* Handle Pune_Taluka_XX */

    const numberMatch =
      rawValue.match(
        /taluka[_\s-]*(\d+)/i
      );

    if (numberMatch && talukaNames) {
      const number = numberMatch[1];

      const possibleMappedKeys = [
        `Pune_Taluka_${number}`,
        `Taluka_${number}`,
        `Pune Taluka ${number}`,
        number,
      ];

      for (
        const key of possibleMappedKeys
      ) {
        if (talukaNames[key]) {
          return talukaNames[key];
        }
      }
    }


    /* Already readable */

    return rawValue
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }


  /*
    FALLBACK

    If Taluka is hidden inside another
    dataset field, extract it.
  */

  const fallbackFields = [
    item.Location,
    item.Location_Name,
    item.LocationName,
    item.Village,
    item.Ward,
    item.Name,
  ];

  for (
    const value of fallbackFields
  ) {
    if (!value) continue;

    const rawValue = String(value);

    const numberMatch =
      rawValue.match(
        /taluka[_\s-]*(\d+)/i
      );

    if (
      numberMatch &&
      talukaNames
    ) {
      const number =
        numberMatch[1];

      const possibleMappedKeys = [
        `Pune_Taluka_${number}`,
        `Taluka_${number}`,
        `Pune Taluka ${number}`,
        number,
      ];

      for (
        const key of possibleMappedKeys
      ) {
        if (talukaNames[key]) {
          return talukaNames[key];
        }
      }
    }
  }

  return "Unknown Taluka";
}


/* =========================================================
   GET SCORE
========================================================= */

function getScore(item) {
  const values = [
    item?.Water_Stress_Score,
    item?.water_stress_score,
    item?.WaterStressScore,
    item?.Score,
    item?.score,
  ];

  for (const value of values) {
    const number = Number(value);

    if (!Number.isNaN(number)) {
      return number;
    }
  }

  return 0;
}


/* =========================================================
   GET LATITUDE / LONGITUDE
========================================================= */

function getLatitude(item) {
  return Number(
    item?.Latitude ??
      item?.latitude ??
      item?.LATITUDE ??
      item?.Lat ??
      item?.lat
  );
}


function getLongitude(item) {
  return Number(
    item?.Longitude ??
      item?.longitude ??
      item?.LONGITUDE ??
      item?.Lng ??
      item?.lng ??
      item?.Lon ??
      item?.lon
  );
}


/* =========================================================
   MAP FLY CONTROLLER
========================================================= */

function MapFlyController({
  selectedLocation,
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    const lat =
      Number(
        selectedLocation._latitude
      );

    const lng =
      Number(
        selectedLocation._longitude
      );

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      map.flyTo(
        [lat, lng],
        13,
        {
          duration: 1,
        }
      );
    }
  }, [
    selectedLocation,
    map,
  ]);

  return null;
}


/* =========================================================
   MAP BOUNDS
========================================================= */

function MapBounds({
  data,
}) {
  const map = useMap();

  useEffect(() => {
    if (!data.length) return;

    const validPoints =
      data.filter(
        (item) =>
          Number.isFinite(
            item._latitude
          ) &&
          Number.isFinite(
            item._longitude
          )
      );

    if (!validPoints.length) {
      return;
    }

    const bounds =
      validPoints.map(
        (item) => [
          item._latitude,
          item._longitude,
        ]
      );

    map.fitBounds(
      bounds,
      {
        padding: [45, 45],
      }
    );
  }, [
    data,
    map,
  ]);

  return null;
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

function RiskMap() {

  const [data, setData] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [riskFilter, setRiskFilter] =
    useState("All");

  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState(null);


  /* =======================================================
     LOAD ALL RECORDS
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);

        const result =
          await loadPuneData();

        if (!mounted) {
          return;
        }


        /*
          IMPORTANT:

          DO NOT GROUP THESE RECORDS.

          Every CSV row remains an
          individual map marker.

          Therefore if the dataset
          contains 250 records,
          all 250 remain available.
        */

        const processed =
          (result || [])
            .map(
              (item, index) => {

                const latitude =
                  getLatitude(item);

                const longitude =
                  getLongitude(item);

                const score =
                  getScore(item);

                const risk =
                  getRiskLevel(
                    score
                  );

                const taluka =
                  getTalukaName(
                    item
                  );

                return {
                  ...item,

                  _id:
                    item.ID ??
                    item.id ??
                    item.Location_ID ??
                    item.LocationID ??
                    index,

                  _latitude:
                    latitude,

                  _longitude:
                    longitude,

                  _score:
                    score,

                  _risk:
                    risk,

                  _taluka:
                    taluka,
                };
              }
            )
            .filter(
              (item) =>
                Number.isFinite(
                  item._latitude
                ) &&
                Number.isFinite(
                  item._longitude
                )
            );


        setData(processed);

        console.log(
          `Risk Map loaded ${processed.length} records`
        );

      } catch (error) {

        console.error(
          "Error loading Risk Map data:",
          error
        );

        setData([]);

      } finally {

        if (mounted) {
          setLoading(false);
        }

      }
    }


    loadData();


    return () => {
      mounted = false;
    };

  }, []);


  /* =======================================================
     FILTERED DATA
  ======================================================= */

  const filteredData =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();


      return data.filter(
        (item) => {

          /*
            SEARCH ONLY BY TALUKA NAME
          */

          const matchesSearch =
            !query ||
            item._taluka
              .toLowerCase()
              .includes(query);


          const matchesRisk =
            riskFilter === "All" ||
            item._risk ===
              riskFilter;


          return (
            matchesSearch &&
            matchesRisk
          );
        }
      );

    }, [
      data,
      search,
      riskFilter,
    ]);


  /* =======================================================
     STATISTICS
  ======================================================= */

  const statistics =
    useMemo(() => {

      const result = {
        All: data.length,
        Low: 0,
        Moderate: 0,
        High: 0,
        Critical: 0,
      };


      data.forEach(
        (item) => {

          if (
            result[item._risk] !==
            undefined
          ) {
            result[item._risk]++;
          }

        }
      );


      return result;

    }, [data]);


  /* =======================================================
     AVERAGE STRESS
  ======================================================= */

  const averageStress =
    useMemo(() => {

      if (!data.length) {
        return 0;
      }

      const total =
        data.reduce(
          (sum, item) =>
            sum +
            item._score,
          0
        );

      return (
        total /
        data.length
      );

    }, [data]);


  /* =======================================================
     UNIQUE TALUKAS
  ======================================================= */

  const uniqueTalukas =
    useMemo(() => {

      return new Set(
        data.map(
          (item) =>
            item._taluka
        )
      ).size;

    }, [data]);


  /* =======================================================
     HIGHEST RISK RECORD
  ======================================================= */

  const highestRisk =
    useMemo(() => {

      if (!data.length) {
        return null;
      }

      return [...data].sort(
        (a, b) =>
          b._score -
          a._score
      )[0];

    }, [data]);


  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (loading) {

    return (
      <div
        style={{
          minHeight:
            "620px",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          background:
            "#f8fafc",

          borderRadius:
            "20px",
        }}
      >

        <div
          style={{
            textAlign:
              "center",

            background:
              "#ffffff",

            padding:
              "36px 48px",

            borderRadius:
              "20px",

            border:
              "1px solid #e2e8f0",

            boxShadow:
              "0 15px 40px rgba(15,23,42,0.08)",
          }}
        >

          <div
            style={{
              fontSize:
                "32px",

              marginBottom:
                "10px",
            }}
          >
            💧
          </div>

          <div
            style={{
              fontSize:
                "18px",

              fontWeight:
                800,

              color:
                "#172033",
            }}
          >
            Loading Risk Map
          </div>

          <div
            style={{
              marginTop:
                "6px",

              fontSize:
                "13px",

              color:
                "#64748b",
            }}
          >
            Preparing Pune water
            stress data...
          </div>

        </div>

      </div>
    );
  }


  /* =======================================================
     PAGE
  ======================================================= */

  return (

    <div
      style={{
        width:
          "100%",

        background:
          "#f5f7fb",

        borderRadius:
          "22px",

        padding:
          "24px",

        boxSizing:
          "border-box",
      }}
    >

      {/* ===================================================
          HEADER
      =================================================== */}

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "20px",

          marginBottom:
            "22px",

          flexWrap:
            "wrap",
        }}
      >

        <div>

          <div
            style={{
              fontSize:
                "11px",

              fontWeight:
                800,

              letterSpacing:
                "0.16em",

              textTransform:
                "uppercase",

              color:
                "#2563eb",

              marginBottom:
                "7px",
            }}
          >
            GIS • WATER INTELLIGENCE
          </div>

          <h1
            style={{
              margin:
                0,

              fontSize:
                "32px",

              lineHeight:
                1.15,

              fontWeight:
                850,

              color:
                "#172033",

              letterSpacing:
                "-0.035em",
            }}
          >
            Pune Water Risk Map
          </h1>

          <p
            style={{
              margin:
                "8px 0 0",

              color:
                "#64748b",

              fontSize:
                "14px",

              lineHeight:
                1.5,
            }}
          >
            Spatial view of water stress
            across monitored locations
            in Pune District.
          </p>

        </div>


        {/* DATA STATUS */}

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "10px",

            background:
              "#ffffff",

            border:
              "1px solid #dbe4ef",

            borderRadius:
              "14px",

            padding:
              "12px 16px",

            boxShadow:
              "0 5px 18px rgba(15,23,42,0.05)",
          }}
        >

          <span
            style={{
              width:
                "9px",

              height:
                "9px",

              borderRadius:
                "50%",

              background:
                "#16a34a",

              boxShadow:
                "0 0 0 4px #dcfce7",
            }}
          />

          <div>

            <div
              style={{
                fontSize:
                  "12px",

                fontWeight:
                  800,

                color:
                  "#172033",
              }}
            >
              Dataset Active
            </div>

            <div
              style={{
                fontSize:
                  "10px",

                color:
                  "#64748b",

                marginTop:
                  "2px",
              }}
            >
              {data.length} records loaded
            </div>

          </div>

        </div>

      </div>


      {/* ===================================================
          KPI STRIP
      =================================================== */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "1.3fr repeat(4, 1fr)",

          gap:
            "12px",

          marginBottom:
            "16px",
        }}
      >

        {/* TOTAL */}

        <div
          style={{
            background:
              "#172033",

            color:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "18px 20px",

            minHeight:
              "86px",

            boxSizing:
              "border-box",
          }}
        >

          <div
            style={{
              fontSize:
                "10px",

              fontWeight:
                800,

              letterSpacing:
                "0.1em",

              opacity:
                0.65,
            }}
          >
            MONITORED LOCATIONS
          </div>

          <div
            style={{
              fontSize:
                "29px",

              fontWeight:
                850,

              marginTop:
                "5px",
            }}
          >
            {data.length}
          </div>

          <div
            style={{
              fontSize:
                "10px",

              opacity:
                0.65,

              marginTop:
                "1px",
            }}
          >
            {uniqueTalukas} Talukas
          </div>

        </div>


        {[
          {
            name: "Low",
            value: statistics.Low,
          },
          {
            name: "Moderate",
            value: statistics.Moderate,
          },
          {
            name: "High",
            value: statistics.High,
          },
          {
            name: "Critical",
            value: statistics.Critical,
          },
        ].map(
          (item) => {

            const color =
              getRiskColor(
                item.name
              );

            return (
              <div
                key={item.name}
                style={{
                  background:
                    "#ffffff",

                  border:
                    "1px solid #e0e7f0",

                  borderRadius:
                    "16px",

                  padding:
                    "18px",

                  minHeight:
                    "86px",

                  boxSizing:
                    "border-box",

                  position:
                    "relative",

                  overflow:
                    "hidden",
                }}
              >

                <div
                  style={{
                    position:
                      "absolute",

                    top:
                      0,

                    left:
                      0,

                    right:
                      0,

                    height:
                      "3px",

                    background:
                      color,
                  }}
                />

                <div
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    gap:
                      "7px",

                    fontSize:
                      "10px",

                    color:
                      "#64748b",

                    fontWeight:
                      800,

                    textTransform:
                      "uppercase",

                    letterSpacing:
                      "0.07em",
                  }}
                >

                  <span
                    style={{
                      width:
                        "7px",

                      height:
                        "7px",

                      borderRadius:
                        "50%",

                      background:
                        color,
                    }}
                  />

                  {item.name}

                </div>

                <div
                  style={{
                    fontSize:
                      "27px",

                    lineHeight:
                      1,

                    fontWeight:
                      850,

                    color:
                      "#172033",

                    marginTop:
                      "10px",
                  }}
                >
                  {item.value}
                </div>

              </div>
            );
          }
        )}

      </div>


      {/* ===================================================
          TOOLBAR — ONLY ONE SEARCH BAR
      =================================================== */}

      <div
        style={{
          background:
            "#ffffff",

          border:
            "1px solid #dce4ef",

          borderRadius:
            "16px",

          padding:
            "14px",

          marginBottom:
            "16px",

          display:
            "flex",

          alignItems:
            "center",

          gap:
            "12px",

          flexWrap:
            "wrap",

          boxShadow:
            "0 5px 18px rgba(15,23,42,0.04)",
        }}
      >

        {/* SEARCH */}

        <div
          style={{
            flex:
              "1 1 360px",

            position:
              "relative",
          }}
        >

          <span
            style={{
              position:
                "absolute",

              left:
                "15px",

              top:
                "50%",

              transform:
                "translateY(-50%)",

              fontSize:
                "16px",

              opacity:
                0.7,
            }}
          >
            🔎
          </span>

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search by Taluka name..."
            style={{
              width:
                "100%",

              height:
                "46px",

              boxSizing:
                "border-box",

              border:
                "1px solid #d8e1ec",

              borderRadius:
                "11px",

              background:
                "#f8fafc",

              padding:
                "0 42px 0 43px",

              fontSize:
                "13px",

              color:
                "#172033",

              outline:
                "none",
            }}
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              style={{
                position:
                  "absolute",

                right:
                  "10px",

                top:
                  "50%",

                transform:
                  "translateY(-50%)",

                width:
                  "27px",

                height:
                  "27px",

                border:
                  "none",

                borderRadius:
                  "50%",

                background:
                  "#e2e8f0",

                color:
                  "#475569",

                cursor:
                  "pointer",

                fontSize:
                  "17px",

                lineHeight:
                  1,
              }}
            >
              ×
            </button>
          )}

        </div>


        {/* RISK FILTER */}

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "8px",

            flexWrap:
              "wrap",
          }}
        >

          <span
            style={{
              fontSize:
                "10px",

              fontWeight:
                800,

              color:
                "#64748b",

              letterSpacing:
                "0.08em",
            }}
          >
            RISK
          </span>


          {[
            "All",
            "Low",
            "Moderate",
            "High",
            "Critical",
          ].map(
            (risk) => {

              const active =
                riskFilter ===
                risk;

              const color =
                risk === "All"
                  ? "#2563eb"
                  : getRiskColor(
                      risk
                    );

              return (
                <button
                  key={risk}
                  type="button"
                  onClick={() =>
                    setRiskFilter(
                      risk
                    )
                  }
                  style={{
                    height:
                      "38px",

                    padding:
                      "0 12px",

                    borderRadius:
                      "9px",

                    border:
                      active
                        ? `1px solid ${color}`
                        : "1px solid #dce4ef",

                    background:
                      active
                        ? risk ===
                          "All"
                          ? "#eff6ff"
                          : getRiskBackground(
                              risk
                            )
                        : "#ffffff",

                    color:
                      active
                        ? color
                        : "#64748b",

                    fontSize:
                      "11px",

                    fontWeight:
                      800,

                    cursor:
                      "pointer",
                  }}
                >
                  {risk}

                  <span
                    style={{
                      marginLeft:
                        "5px",

                      opacity:
                        0.65,
                    }}
                  >
                    {statistics[
                      risk
                    ]}
                  </span>

                </button>
              );
            }
          )}

        </div>

      </div>


      {/* ===================================================
          MAP CARD
      =================================================== */}

      <div
        style={{
          background:
            "#ffffff",

          border:
            "1px solid #dce4ef",

          borderRadius:
            "20px",

          padding:
            "12px",

          boxShadow:
            "0 10px 30px rgba(15,23,42,0.06)",
        }}
      >

        {/* MAP HEADER */}

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            padding:
              "9px 10px 14px",

            gap:
              "12px",

            flexWrap:
              "wrap",
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  "10px",

                fontWeight:
                  800,

                color:
                  "#2563eb",

                letterSpacing:
                  "0.12em",

                textTransform:
                  "uppercase",
              }}
            >
              SPATIAL DISTRIBUTION
            </div>

            <div
              style={{
                fontSize:
                  "19px",

                fontWeight:
                  800,

                color:
                  "#172033",

                marginTop:
                  "3px",
              }}
            >
              Water Stress Across Pune
            </div>

          </div>


          <div
            style={{
              fontSize:
                "12px",

              color:
                "#64748b",

              background:
                "#f8fafc",

              border:
                "1px solid #e2e8f0",

              borderRadius:
                "9px",

              padding:
                "8px 11px",
            }}
          >
            Showing{" "}
            <strong
              style={{
                color:
                  "#172033",
              }}
            >
              {filteredData.length}
            </strong>{" "}
            locations
          </div>

        </div>


        {/* MAP */}

        <div
          style={{
            height:
              "570px",

            width:
              "100%",

            borderRadius:
              "14px",

            overflow:
              "hidden",

            position:
              "relative",
          }}
        >

          <MapContainer
            center={
              PUNE_CENTER
            }
            zoom={9}
            scrollWheelZoom={
              true
            }
            style={{
              height:
                "100%",

              width:
                "100%",
            }}
          >

            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />


            <MapBounds
              data={
                filteredData
              }
            />


            <MapFlyController
              selectedLocation={
                selectedLocation
              }
            />


            {/* =============================================
                250 INDIVIDUAL MARKERS
            ============================================= */}

            {filteredData.map(
              (item) => {

                const color =
                  getRiskColor(
                    item._risk
                  );

                return (
                  <CircleMarker
                    key={
                      item._id
                    }
                    center={[
                      item._latitude,
                      item._longitude,
                    ]}
                    radius={8}
                    pathOptions={{
                      color:
                        "#ffffff",

                      weight:
                        2,

                      fillColor:
                        color,

                      fillOpacity:
                        0.9,
                    }}
                    eventHandlers={{
                      click:
                        () =>
                          setSelectedLocation(
                            item
                          ),
                    }}
                  >

                    {/* TOOLTIP = TALUKA */}

                    <Tooltip
                      direction="top"
                      offset={[
                        0,
                        -7,
                      ]}
                    >
                      <strong>
                        {
                          item._taluka
                        }
                      </strong>

                      <br />

                      Stress:{" "}
                      {
                        item._score
                      }
                    </Tooltip>


                    {/* POPUP */}

                    <Popup>

                      <div
                        style={{
                          minWidth:
                            "235px",

                          fontFamily:
                            "Inter, system-ui, sans-serif",
                        }}
                      >

                        <div
                          style={{
                            fontSize:
                              "9px",

                            color:
                              "#64748b",

                            fontWeight:
                              800,

                            letterSpacing:
                              "0.12em",

                            textTransform:
                              "uppercase",

                            marginBottom:
                              "5px",
                          }}
                        >
                          TALUKA
                        </div>

                        <div
                          style={{
                            fontSize:
                              "20px",

                            fontWeight:
                              850,

                            color:
                              "#172033",

                            marginBottom:
                              "13px",
                          }}
                        >
                          {
                            item._taluka
                          }
                        </div>


                        <div
                          style={{
                            display:
                              "grid",

                            gridTemplateColumns:
                              "1fr 1fr",

                            gap:
                              "8px",
                          }}
                        >

                          <div
                            style={{
                              padding:
                                "10px",

                              background:
                                "#f8fafc",

                              borderRadius:
                                "9px",
                            }}
                          >

                            <div
                              style={{
                                fontSize:
                                  "9px",

                                color:
                                  "#64748b",

                                fontWeight:
                                  700,
                              }}
                            >
                              WATER STRESS
                            </div>

                            <div
                              style={{
                                fontSize:
                                  "21px",

                                fontWeight:
                                  850,

                                marginTop:
                                  "3px",
                              }}
                            >
                              {
                                item._score
                              }
                              <span
                                style={{
                                  fontSize:
                                    "10px",

                                  color:
                                    "#94a3b8",

                                  fontWeight:
                                    600,
                                }}
                              >
                                /100
                              </span>
                            </div>

                          </div>


                          <div
                            style={{
                              padding:
                                "10px",

                              background:
                                getRiskBackground(
                                  item._risk
                                ),

                              borderRadius:
                                "9px",
                            }}
                          >

                            <div
                              style={{
                                fontSize:
                                  "9px",

                                color:
                                  "#64748b",

                                fontWeight:
                                  700,
                              }}
                            >
                              RISK LEVEL
                            </div>

                            <div
                              style={{
                                fontSize:
                                  "14px",

                                fontWeight:
                                  850,

                                color:
                                  color,

                                marginTop:
                                  "6px",
                              }}
                            >
                              {
                                item._risk
                              }
                            </div>

                          </div>

                        </div>


                        <div
                          style={{
                            marginTop:
                              "12px",

                            paddingTop:
                              "10px",

                            borderTop:
                              "1px solid #e2e8f0",

                            fontSize:
                              "10px",

                            color:
                              "#64748b",

                            lineHeight:
                              1.6,
                          }}
                        >

                          📍{" "}
                          {item._latitude.toFixed(
                            4
                          )}
                          {" , "}
                          {item._longitude.toFixed(
                            4
                          )}

                        </div>

                      </div>

                    </Popup>

                  </CircleMarker>
                );
              }
            )}


            {/* =================================================
                MAP LEGEND
            ================================================= */}

            <div
              className="leaflet-control"
              style={{
                position:
                  "absolute",

                bottom:
                  "18px",

                right:
                  "18px",

                zIndex:
                  1000,

                background:
                  "rgba(255,255,255,0.97)",

                border:
                  "1px solid #dce4ef",

                borderRadius:
                  "13px",

                padding:
                  "13px 15px",

                boxShadow:
                  "0 8px 22px rgba(15,23,42,0.14)",

                minWidth:
                  "150px",
              }}
            >

              <div
                style={{
                  fontSize:
                    "11px",

                  fontWeight:
                    850,

                  color:
                    "#172033",

                  marginBottom:
                    "9px",
                }}
              >
                Water Stress Risk
              </div>


              {[
                {
                  name: "Low",
                  range: "0–27",
                },
                {
                  name: "Moderate",
                  range: "28–29",
                },
                {
                  name: "High",
                  range: "30–31",
                },
                {
                  name: "Critical",
                  range: "32+",
                },
              ].map(
                (item) => {

                  const color =
                    getRiskColor(
                      item.name
                    );

                  return (
                    <div
                      key={
                        item.name
                      }
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "center",

                        gap:
                          "8px",

                        marginTop:
                          "6px",

                        fontSize:
                          "10px",
                      }}
                    >

                      <span
                        style={{
                          width:
                            "8px",

                          height:
                            "8px",

                          borderRadius:
                            "50%",

                          background:
                            color,

                          flexShrink:
                            0,
                        }}
                      />

                      <span
                        style={{
                          flex:
                            1,

                          color:
                            "#334155",

                          fontWeight:
                            600,
                        }}
                      >
                        {
                          item.name
                        }
                      </span>

                      <span
                        style={{
                          color:
                            "#94a3b8",
                        }}
                      >
                        {
                          item.range
                        }
                      </span>

                    </div>
                  );
                }
              )}

            </div>

          </MapContainer>


          {/* MAP COUNT */}

          <div
            style={{
              position:
                "absolute",

              top:
                "14px",

              left:
                "14px",

              zIndex:
                1000,

              background:
                "rgba(255,255,255,0.96)",

              border:
                "1px solid #dce4ef",

              borderRadius:
                "10px",

              padding:
                "8px 12px",

              boxShadow:
                "0 5px 15px rgba(15,23,42,0.12)",

              fontSize:
                "11px",

              fontWeight:
                800,

              color:
                "#172033",
            }}
          >
            📍{" "}
            {filteredData.length} locations
          </div>

        </div>

      </div>


      {/* ===================================================
          INSIGHT CARDS
      =================================================== */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(3, 1fr)",

          gap:
            "12px",

          marginTop:
            "16px",
        }}
      >

        {/* AVERAGE */}

        <div
          style={{
            background:
              "#ffffff",

            border:
              "1px solid #dce4ef",

            borderRadius:
              "16px",

            padding:
              "17px",

            display:
              "flex",

            gap:
              "13px",

            alignItems:
              "center",
          }}
        >

          <div
            style={{
              width:
                "42px",

              height:
                "42px",

              borderRadius:
                "12px",

              background:
                "#eff6ff",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              fontSize:
                "19px",
            }}
          >
            📊
          </div>

          <div>

            <div
              style={{
                fontSize:
                  "10px",

                fontWeight:
                  800,

                color:
                  "#64748b",

                textTransform:
                  "uppercase",

                letterSpacing:
                  "0.08em",
              }}
            >
              District Average
            </div>

            <div
              style={{
                fontSize:
                  "21px",

                fontWeight:
                  850,

                color:
                  "#172033",

                marginTop:
                  "3px",
              }}
            >
              {
                averageStress.toFixed(
                  1
                )
              }
              <span
                style={{
                  fontSize:
                    "10px",

                  color:
                    "#94a3b8",
                }}
              >
                /100
              </span>
            </div>

          </div>

        </div>


        {/* HIGHEST */}

        <div
          style={{
            background:
              "#ffffff",

            border:
              "1px solid #dce4ef",

            borderRadius:
              "16px",

            padding:
              "17px",

            display:
              "flex",

            gap:
              "13px",

            alignItems:
              "center",
          }}
        >

          <div
            style={{
              width:
                "42px",

              height:
                "42px",

              borderRadius:
                "12px",

              background:
                "#fef2f2",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              fontSize:
                "19px",
            }}
          >
            ⚠️
          </div>

          <div
            style={{
              minWidth:
                0,
            }}
          >

            <div
              style={{
                fontSize:
                  "10px",

                fontWeight:
                  800,

                color:
                  "#64748b",

                textTransform:
                  "uppercase",

                letterSpacing:
                  "0.08em",
              }}
            >
              Highest Stress
            </div>

            <div
              style={{
                fontSize:
                  "16px",

                fontWeight:
                  850,

                color:
                  "#172033",

                marginTop:
                  "3px",

                whiteSpace:
                  "nowrap",

                overflow:
                  "hidden",

                textOverflow:
                  "ellipsis",
              }}
            >
              {highestRisk
                ? highestRisk._taluka
                : "—"}
            </div>

            <div
              style={{
                fontSize:
                  "10px",

                color:
                  "#dc2626",

                fontWeight:
                  700,

                marginTop:
                  "2px",
              }}
            >
              {highestRisk
                ? `${highestRisk._score}/100 • ${highestRisk._risk}`
                : "No data"}
            </div>

          </div>

        </div>


        {/* COVERAGE */}

        <div
          style={{
            background:
              "#ffffff",

            border:
              "1px solid #dce4ef",

            borderRadius:
              "16px",

            padding:
              "17px",

            display:
              "flex",

            gap:
              "13px",

            alignItems:
              "center",
          }}
        >

          <div
            style={{
              width:
                "42px",

              height:
                "42px",

              borderRadius:
                "12px",

              background:
                "#f0fdf4",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              fontSize:
                "19px",
            }}
          >
            🗺️
          </div>

          <div>

            <div
              style={{
                fontSize:
                  "10px",

                fontWeight:
                  800,

                color:
                  "#64748b",

                textTransform:
                  "uppercase",

                letterSpacing:
                  "0.08em",
              }}
            >
              Spatial Coverage
            </div>

            <div
              style={{
                fontSize:
                  "21px",

                fontWeight:
                  850,

                color:
                  "#172033",

                marginTop:
                  "3px",
              }}
            >
              {uniqueTalukas}
              <span
                style={{
                  fontSize:
                    "11px",

                  color:
                    "#94a3b8",

                  marginLeft:
                    "4px",
                }}
              >
                Talukas
              </span>
            </div>

          </div>

        </div>

      </div>


      {/* ===================================================
          SELECTED LOCATION
      =================================================== */}

      {selectedLocation && (

        <div
          style={{
            marginTop:
              "16px",

            background:
              "#172033",

            color:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "18px 20px",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            gap:
              "20px",

            flexWrap:
              "wrap",
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  "9px",

                fontWeight:
                  800,

                letterSpacing:
                  "0.14em",

                color:
                  "#94a3b8",

                textTransform:
                  "uppercase",
              }}
            >
              Selected Taluka
            </div>

            <div
              style={{
                fontSize:
                  "21px",

                fontWeight:
                  850,

                marginTop:
                  "4px",
              }}
            >
              {
                selectedLocation._taluka
              }
            </div>

          </div>


          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "28px",

              flexWrap:
                "wrap",
            }}
          >

            <div>

              <div
                style={{
                  fontSize:
                    "9px",

                  color:
                    "#94a3b8",

                  textTransform:
                    "uppercase",

                  fontWeight:
                    700,
                }}
              >
                Water Stress
              </div>

              <div
                style={{
                  fontSize:
                    "18px",

                  fontWeight:
                    850,

                  marginTop:
                    "3px",
                }}
              >
                {
                  selectedLocation._score
                }
                /100
              </div>

            </div>


            <div>

              <div
                style={{
                  fontSize:
                    "9px",

                  color:
                    "#94a3b8",

                  textTransform:
                    "uppercase",

                  fontWeight:
                    700,
                }}
              >
                Risk
              </div>

              <div
                style={{
                  fontSize:
                    "14px",

                  fontWeight:
                    850,

                  color:
                    getRiskColor(
                      selectedLocation._risk
                    ),

                  marginTop:
                    "6px",
                }}
              >
                {
                  selectedLocation._risk
                }
              </div>

            </div>


            <button
              type="button"
              onClick={() =>
                setSelectedLocation(
                  null
                )
              }
              style={{
                width:
                  "32px",

                height:
                  "32px",

                border:
                  "1px solid #475569",

                background:
                  "transparent",

                color:
                  "#cbd5e1",

                borderRadius:
                  "8px",

                cursor:
                  "pointer",

                fontSize:
                  "17px",
              }}
            >
              ×
            </button>

          </div>

        </div>

      )}


      {/* ===================================================
          FOOTNOTE
      =================================================== */}

      <div
        style={{
          marginTop:
            "13px",

          textAlign:
            "center",

          fontSize:
            "10px",

          color:
            "#94a3b8",
        }}
      >
        Each marker represents an individual
        monitored record. Search and labels
        use Taluka names.
      </div>

    </div>
  );
}


export default RiskMap;