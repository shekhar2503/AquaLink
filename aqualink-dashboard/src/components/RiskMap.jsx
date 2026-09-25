import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { MapPin, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import {
  normalizeLocation,
  getLocationName,
  getRiskLevel,
  getStressScore,
  RISK_COLORS,
} from "../utils/waterMetrics";
import { StatusBadge } from "./ui";
import ConfidenceBadge from "./ConfidenceBadge";
import { loadLocationDecisionSupport } from "../utils/loadAquaLinkData";

const PUNE_CENTER = [18.5204, 73.8567];

function MapBounds({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) return;
    const bounds = locations.map((item) => [item._latitude, item._longitude]);
    if (bounds.length === 1) {
      map.setView(bounds[0], 12);
    } else {
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 11 });
    }
  }, [locations, map]);

  return null;
}

function RiskMap({ data = [], metadata, selectedYear, stressLayer = "combined" }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [decisionSupport, setDecisionSupport] = useState(null);
  const [detailError, setDetailError] = useState("");
  const locations = useMemo(
    () =>
      data
        .map((item, index) => {
          const normalized = normalizeLocation(item, index);
          const score = getStressScore(item, stressLayer);
          return { ...normalized, _score: score, _risk: getRiskLevel(score) };
        })
        .filter(
          (item) =>
            Number.isFinite(item._latitude) && Number.isFinite(item._longitude),
        ),
    [data, stressLayer],
  );

  useEffect(() => {
    if (!selectedLocation) return undefined;
    let active = true;
    loadLocationDecisionSupport(selectedLocation.location_id, selectedYear)
      .then((result) => { if (active) setDecisionSupport(result); })
      .catch((error) => { if (active) setDetailError(error.message); });
    return () => { active = false; };
  }, [selectedLocation, selectedYear]);

  const activeSelectedLocation = selectedLocation
    ? locations.find((item) => item._id === selectedLocation._id) ?? null
    : null;

  return (
    <div className="risk-map-shell">
      <div className="map-canvas">
        <MapContainer
          center={PUNE_CENTER}
          zoom={9}
          scrollWheelZoom
          className="leaflet-map"
          aria-label="Interactive map of Pune water stress locations"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds locations={locations} />
          {locations.map((item, index) => {
            const color = RISK_COLORS[item._risk];
            return (
              <CircleMarker
                key={`${item._id}-${index}`}
                center={[item._latitude, item._longitude]}
                radius={item._risk === "Critical" ? 8 : 6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.78,
                  opacity: 0.9,
                  weight: 1.5,
                }}
                eventHandlers={{
                  click: () => {
                    setDecisionSupport(null);
                    setDetailError("");
                    setSelectedLocation(item);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <strong>{item._taluka}</strong>
                  <br />
                  {getLocationName(item)} · {item._score}/100
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <span className="eyebrow">Monitored location</span>
                    <h3>{getLocationName(item)}</h3>
                    <p>{item._taluka}, Pune District</p>
                    <div className="map-popup-grid">
                      <div><span>Stress score</span><strong>{item._score}/100</strong></div>
                      <div><span>Risk level</span><StatusBadge status={item._risk} /></div>
                    </div>
                    <ConfidenceBadge quality={item.quality} />
                    <p className="location-provenance">{metadata?.synthetic ? "Prototype data" : "Reported source"} · {metadata?.source === "fallback" ? "Local CSV" : "API"} · {item.Year}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        <div className="map-count-pill">
          <MapPin size={15} aria-hidden="true" />
          {locations.length} locations
        </div>

        <div className="map-overlay-legend" aria-label="Map risk legend">
          <strong>{stressLayer === "combined" ? "Combined" : stressLayer === "groundwater" ? "Groundwater" : "Supply-gap"} stress</strong>
          {Object.entries(RISK_COLORS).map(([risk, color]) => (
            <span key={risk}><i style={{ background: color }} />{risk}</span>
          ))}
        </div>

        {!locations.length ? (
          <div className="map-empty-state" role="status">
            <MapPin aria-hidden="true" />
            <strong>No matching locations</strong>
            <span>Adjust the search or risk filter to restore map markers.</span>
          </div>
        ) : null}
      </div>

      {activeSelectedLocation ? (
        <aside className="selected-location" aria-live="polite">
          <div>
            <span className="eyebrow">Selected location</span>
            <h3>{getLocationName(activeSelectedLocation)}</h3>
            <p>{activeSelectedLocation._taluka}, Pune District</p>
            <p className="location-provenance">Source: {metadata?.source === "fallback" ? "bundled local CSV" : "AquaLink API"} · {metadata?.synthetic ? "prototype demonstration data" : "reported source data"} · score {activeSelectedLocation.score_version || metadata?.scoringVersion}</p>
          </div>
          <div className="selected-location-metrics">
            <div><span>{stressLayer} stress</span><strong>{activeSelectedLocation._score}/100</strong></div>
            <div><span>Risk</span><StatusBadge status={activeSelectedLocation._risk} /></div>
            <div>
              <span>Coordinates</span>
              <strong>{activeSelectedLocation._latitude.toFixed(4)}, {activeSelectedLocation._longitude.toFixed(4)}</strong>
            </div>
          </div>
          <ConfidenceBadge quality={decisionSupport?.quality ?? activeSelectedLocation.quality} label="score confidence" detailed />
          <button
            className="icon-button"
            type="button"
            aria-label="Clear selected location"
            onClick={() => {
              setSelectedLocation(null);
              setDecisionSupport(null);
              setDetailError("");
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
          <div className="location-investigation">
            {detailError ? <p role="status">History and explanation unavailable in the current data-source mode.</p> : null}
            {!decisionSupport && !detailError ? <p role="status">Loading location history and score explanation…</p> : null}
            {decisionSupport ? <>
              <div className="history-block"><h4>Location history</h4><div className="table-scroll"><table className="data-table compact-table"><thead><tr><th>Year</th><th>Combined</th><th>Groundwater</th><th>Supply gap</th><th>Risk</th></tr></thead><tbody>{decisionSupport.history.map((row) => <tr key={row.Year}><td>{row.Year}</td><td>{row.Water_Stress_Score}</td><td>{row.Groundwater_Stress_Score}</td><td>{row.Water_Supply_Gap_Score}</td><td>{row.Risk_Category}</td></tr>)}</tbody></table></div></div>
              <details className="score-explanation" open><summary>Why this score?</summary><div className="explanation-grid">
                {[["Groundwater", decisionSupport.explanation.breakdown.groundwater_contribution], ["Supply gap", decisionSupport.explanation.breakdown.supply_gap_contribution], ["Interaction", decisionSupport.explanation.breakdown.interaction_contribution]].map(([label, value]) => <div key={label}><span>{label} contribution</span><strong>{value}</strong><small>{value === 0 ? "Valid zero: this component added no points after clipping and weighting." : "Points contributed to the combined score."}</small></div>)}
              </div><p><strong>Drivers:</strong> {decisionSupport.explanation.recommendation.drivers.join(", ").replaceAll("_", " ")}</p><p>{decisionSupport.explanation.recommendation.rationale}</p></details>
            </> : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default RiskMap;
