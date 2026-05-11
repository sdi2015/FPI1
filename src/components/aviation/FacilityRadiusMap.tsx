import { useEffect, useMemo, useState } from 'react';
import type { Airport, FacilityRiskBand, FacilityWithDistance } from '../../types/aviation';

export type FacilityRadiusMapProps = {
  airport: Airport | null;
  radiusMiles: number;
  facilities: FacilityWithDistance[];
  selectedFacilityId?: string | null;
  scanHasRun?: boolean;
  scanIsStale?: boolean;
  hiddenRecordsCount?: number;
  onFacilitySelect?: (facility: FacilityWithDistance) => void;
};

const MAP_WIDTH = 768;
const MAP_HEIGHT = 430;
const TILE_SIZE = 256;

const riskColors: Record<FacilityRiskBand, string> = {
  Low: '#22c55e',
  Watch: '#facc15',
  Elevated: '#f59e0b',
  High: '#ef4444',
  Critical: '#7f1d1d',
  Unknown: '#94a3b8',
};

function airportCode(airport: Airport): string {
  return airport.iata_code ?? airport.faa_id ?? airport.icao_code ?? airport.airport_id;
}

function chooseZoom(radiusMiles: number): number {
  if (radiusMiles <= 5) return 12;
  if (radiusMiles <= 10) return 11;
  if (radiusMiles <= 25) return 10;
  if (radiusMiles <= 50) return 9;
  if (radiusMiles <= 100) return 8;
  return 7;
}

function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function milesPerPixel(latitude: number, zoom: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return metersPerPixel / 1609.344;
}

function tileRange(center: { x: number; y: number }, zoom: number) {
  const startX = Math.floor((center.x - MAP_WIDTH / 2) / TILE_SIZE);
  const endX = Math.floor((center.x + MAP_WIDTH / 2) / TILE_SIZE);
  const startY = Math.floor((center.y - MAP_HEIGHT / 2) / TILE_SIZE);
  const endY = Math.floor((center.y + MAP_HEIGHT / 2) / TILE_SIZE);
  const maxTile = 2 ** zoom;
  const tiles: Array<{ x: number; y: number; left: number; top: number; urlX: number }> = [];
  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const urlX = ((x % maxTile) + maxTile) % maxTile;
      tiles.push({ x, y, urlX, left: x * TILE_SIZE - (center.x - MAP_WIDTH / 2), top: y * TILE_SIZE - (center.y - MAP_HEIGHT / 2) });
    }
  }
  return tiles;
}

export function FacilityRadiusMap({ airport, radiusMiles, facilities, selectedFacilityId, scanHasRun = true, scanIsStale = false, hiddenRecordsCount = 0, onFacilitySelect }: FacilityRadiusMapProps) {
  const [activeId, setActiveId] = useState<string | null>(selectedFacilityId ?? null);
  const [showOnlyInRadius, setShowOnlyInRadius] = useState(true);
  const activeFacility = facilities.find((facility) => facility.facility_id === (selectedFacilityId ?? activeId)) ?? null;

  useEffect(() => {
    setActiveId(selectedFacilityId ?? null);
  }, [selectedFacilityId]);

  const mappableFacilities = useMemo(() => facilities.filter((facility) => Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude)), [facilities]);

  const mapModel = useMemo(() => {
    if (!airport || !Number.isFinite(airport.latitude) || !Number.isFinite(airport.longitude)) return null;
    const zoom = chooseZoom(radiusMiles);
    const center = project(airport.latitude, airport.longitude, zoom);
    const facilityPins = (scanHasRun ? mappableFacilities : []).map((facility) => {
      const point = project(facility.latitude, facility.longitude, zoom);
      return {
        facility,
        left: MAP_WIDTH / 2 + (point.x - center.x),
        top: MAP_HEIGHT / 2 + (point.y - center.y),
      };
    }).filter((pin) => !showOnlyInRadius || (pin.left >= -24 && pin.left <= MAP_WIDTH + 24 && pin.top >= -24 && pin.top <= MAP_HEIGHT + 24));
    return {
      zoom,
      center,
      tiles: tileRange(center, zoom),
      facilityPins,
      circleRadiusPx: Math.max(24, Math.min(MAP_WIDTH * 0.48, radiusMiles / milesPerPixel(airport.latitude, zoom))),
    };
  }, [airport, radiusMiles, mappableFacilities, scanHasRun, showOnlyInRadius]);

  if (!airport || !mapModel) {
    return <section className="panel aviation-panel aviation-map-card"><div className="card-heading"><div><p className="eyebrow">Airport Radius Map</p><h3>Readiness zone</h3></div></div><p className="aviation-empty">Select an airport to view the radius map.</p></section>;
  }

  return (
    <section className="panel aviation-panel aviation-map-card">
      <div className="card-heading">
        <div><p className="eyebrow">Airport Radius Map</p><h3>{airport.airport_name}</h3><p className="aviation-caveat">Visualize the selected airport, scan radius, and Walmart facilities inside the readiness zone.</p></div>
        <span className="mode-pill">{radiusMiles} mi radius</span>
      </div>
      <div className="aviation-map-controls" aria-label="Map controls">
        <button type="button" className="ops-action-button secondary" onClick={() => setActiveId(null)}>Fit to radius</button>
        <button type="button" className="ops-action-button secondary" onClick={() => setActiveId(null)}>Reset view</button>
        <button type="button" className={showOnlyInRadius ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => setShowOnlyInRadius((current) => !current)}>Show only in-radius facilities</button>
      </div>
      <div className="aviation-osm-map" role="application" aria-label={`Map centered on ${airport.airport_name}`}>
        {mapModel.tiles.map((tile) => <img key={`${tile.x}-${tile.y}`} src={`https://tile.openstreetmap.org/${mapModel.zoom}/${tile.urlX}/${tile.y}.png`} alt="" style={{ left: tile.left, top: tile.top }} loading="lazy" />)}
        <div className="aviation-map-radius-circle" style={{ width: mapModel.circleRadiusPx * 2, height: mapModel.circleRadiusPx * 2, left: MAP_WIDTH / 2 - mapModel.circleRadiusPx, top: MAP_HEIGHT / 2 - mapModel.circleRadiusPx }} aria-hidden="true" />
        <button type="button" className="aviation-airport-marker" style={{ left: MAP_WIDTH / 2, top: MAP_HEIGHT / 2 }} aria-label={`Airport ${airportCode(airport)}`}>
          <span>✈</span>
          <strong>{airportCode(airport)}</strong>
          <small>Airport<br />{airport.airport_name}<br />{airport.city}, {airport.state}</small>
        </button>
        {mapModel.facilityPins.map(({ facility, left, top }) => (
          <button
            type="button"
            key={facility.facility_id}
            className={facility.facility_id === activeFacility?.facility_id ? 'aviation-facility-marker active' : 'aviation-facility-marker'}
            style={{ left, top, background: riskColors[facility.facility_risk_band] ?? riskColors.Unknown }}
            onClick={() => { setActiveId(facility.facility_id); onFacilitySelect?.(facility); }}
            aria-label={`Select ${facility.facility_name}`}
          >
            <span>{facility.facility_number}</span>
            <small>{facility.facility_name} #{facility.facility_number}<br />{facility.facility_type} · {facility.city}, {facility.state}<br />{facility.distance_miles.toFixed(1)} mi · Risk {facility.facility_risk_band} ({facility.facility_risk_score})<br />EP {facility.ep_readiness_status} · Weather {facility.weather_exposure}<br />{facility.recommended_action}</small>
          </button>
        ))}
      </div>
      <div className="aviation-map-legend">
        <span><i className="airport-legend" />Airport</span>
        {Object.entries(riskColors).map(([band, color]) => <span key={band}><i style={{ background: color }} />{band}</span>)}
      </div>
      {!scanHasRun ? <p className="aviation-empty">Run scan to populate nearby Walmart facilities.</p> : null}
      {scanIsStale ? <p className="aviation-caveat">Radius or airport changed after the last scan. Run scan again to refresh facility markers.</p> : null}
      {scanHasRun && facilities.length === 0 ? <p className="aviation-empty">No Walmart facilities found within the selected radius. Increase the radius or adjust facility type filters.</p> : null}
      {hiddenRecordsCount > 0 ? <p className="aviation-caveat">Some facilities are not shown because latitude/longitude data is missing.</p> : null}
      {activeFacility ? (
        <article className="aviation-selected-card aviation-map-detail">
          <span className="eyebrow">Facility marker details</span>
          <strong>{activeFacility.facility_name} #{activeFacility.facility_number}</strong>
          <span>{activeFacility.facility_type} • {activeFacility.city}, {activeFacility.state}</span>
          <span>{activeFacility.distance_miles.toFixed(1)} mi • Risk {activeFacility.facility_risk_band} ({activeFacility.facility_risk_score})</span>
          <span>EP readiness: {activeFacility.ep_readiness_status} • Weather exposure: {activeFacility.weather_exposure}</span>
          <span>Recommended action: {activeFacility.recommended_action}</span>
        </article>
      ) : null}
    </section>
  );
}
