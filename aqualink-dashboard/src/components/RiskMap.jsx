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
  RISK_COLORS,
} from "../utils/waterMetrics";
import { StatusBadge } from "./ui";

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

function RiskMap({ data = [] }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const locations = useMemo(
    () =>
      data
        .map(normalizeLocation)
        .filter(
          (item) =>
            Number.isFinite(item._latitude) && Number.isFinite(item._longitude),
        ),
    [data],
  );

  const activeSelectedLocation =
    selectedLocation &&
    locations.some((item) => item._id === selectedLocation._id)
      ? selectedLocation
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
                eventHandlers={{ click: () => setSelectedLocation(item) }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <strong>{item._taluka}</strong>
                  <br />
                  {item.Village_Ward || "Monitored location"} · {item._score}/100
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <span className="eyebrow">Monitored location</span>
                    <h3>{item.Village_Ward || item._taluka}</h3>
                    <p>{item._taluka}, Pune District</p>
                    <div className="map-popup-grid">
                      <div><span>Stress score</span><strong>{item._score}/100</strong></div>
                      <div><span>Risk level</span><StatusBadge status={item._risk} /></div>
                    </div>
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
          <strong>Water stress risk</strong>
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
            <h3>{activeSelectedLocation.Village_Ward || activeSelectedLocation._taluka}</h3>
            <p>{activeSelectedLocation._taluka}, Pune District</p>
          </div>
          <div className="selected-location-metrics">
            <div><span>Water stress</span><strong>{activeSelectedLocation._score}/100</strong></div>
            <div><span>Risk</span><StatusBadge status={activeSelectedLocation._risk} /></div>
            <div>
              <span>Coordinates</span>
              <strong>{activeSelectedLocation._latitude.toFixed(4)}, {activeSelectedLocation._longitude.toFixed(4)}</strong>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Clear selected location"
            onClick={() => setSelectedLocation(null)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </aside>
      ) : null}
    </div>
  );
}

export default RiskMap;
