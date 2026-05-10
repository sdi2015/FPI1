import { useMemo, useState } from 'react';
import type { Airport, FacilityRiskBand, FacilityWithDistance } from '../../types/aviation';

export type FacilityRadiusMapProps = {
  airport: Airport | null;
  radiusMiles: number;
  facilities: FacilityWithDistance[];
  selectedFacilityId?: string | null;
  onFacilitySelect?: (facility: FacilityWithDistance) => void;
};

const MAP_WIDTH = 768;
const MAP_HEIGHT = 430;
const TILE_SIZE = 256;

const riskColors: Record<FacilityRiskBand, string> = {
  Low: '#22c55e',
  Watch: '#64748b',
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

export function FacilityRadiusMap({ airport, radiusMiles, facilities, selectedFacilityId, onFacilitySelect }: FacilityRadiusMapProps) {
  const [activeId, setActiveId] = useState<string | null>(selectedFacilityId ?? null);
  const activeFacility = facilities.find((facility) => facility.facility_id === (selectedFacilityId ?? activeId)) ?? null;

  const mapModel = useMemo(() => {
    if (!airport) return null;
    const zoom = chooseZoom(radiusMiles);
    const center = project(airport.latitude, airport.longitude, zoom);
    const facilityPins = facilities.map((facility) => {
      const point = project(facility.latitude, facility.longitude, zoom);
      return {
        facility,
        left: MAP_WIDTH / 2 + (point.x - center.x),
        top: MAP_HEIGHT / 2 + (point.y - center.y),
      };
    }).filter((pin) => pin.left >= -24 && pin.left <= MAP_WIDTH + 24 && pin.top >= -24 && pin.top <= MAP_HEIGHT + 24);
    return {
      zoom,
      center,
      tiles: tileRange(center, zoom),
      facilityPins,
      circleRadiusPx: Math.max(24, Math.min(MAP_WIDTH * 0.48, radiusMiles / milesPerPixel(airport.latitude, zoom))),
    };
  }, [airport, radiusMiles, facilities]);

  if (!airport || !mapModel) {
    return <section className="panel aviation-panel aviation-map-card"><p className="aviation-empty">Select an airport to display the map and scan radius.</p></section>;
  }

  return (
    <section className="panel aviation-panel aviation-map-card">
      <div className="card-heading">
        <div><p className="eyebrow">Interactive OSM radius map</p><h3>{airport.airport_name}</h3></div>
        <span className="mode-pill">{radiusMiles} mi radius</span>
      </div>
      <div className="aviation-osm-map" role="application" aria-label={`Map centered on ${airport.airport_name}`}>
        {mapModel.tiles.map((tile) => <img key={`${tile.x}-${tile.y}`} src={`https://tile.openstreetmap.org/${mapModel.zoom}/${tile.urlX}/${tile.y}.png`} alt="" style={{ left: tile.left, top: tile.top }} loading="lazy" />)}
        <div className="aviation-map-radius-circle" style={{ width: mapModel.circleRadiusPx * 2, height: mapModel.circleRadiusPx * 2, left: MAP_WIDTH / 2 - mapModel.circleRadiusPx, top: MAP_HEIGHT / 2 - mapModel.circleRadiusPx }} aria-hidden="true" />
        <button type="button" className="aviation-airport-marker" style={{ left: MAP_WIDTH / 2, top: MAP_HEIGHT / 2 }}>
          <span>✈</span>
          <strong>{airportCode(airport)}</strong>
          <small>{airport.airport_name}<br />{airport.city}, {airport.state}<br />{airport.latitude.toFixed(4)}, {airport.longitude.toFixed(4)}</small>
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
          </button>
        ))}
      </div>
      <div className="aviation-map-legend">
        <span><i className="airport-legend" />Airport</span>
        {Object.entries(riskColors).map(([band, color]) => <span key={band}><i style={{ background: color }} />{band}</span>)}
      </div>
      {facilities.length === 0 ? <p className="aviation-empty">No Walmart facilities found within this radius. Increase the radius or adjust facility type filters.</p> : null}
      {activeFacility ? (
        <article className="aviation-selected-card aviation-map-detail">
          <span className="eyebrow">Facility marker details</span>
          <strong>{activeFacility.facility_name} #{activeFacility.facility_number}</strong>
          <span>{activeFacility.facility_type} • {activeFacility.city}, {activeFacility.state}</span>
          <span>{activeFacility.distance_miles.toFixed(1)} mi • ~{activeFacility.estimated_drive_time_minutes} min drive • {activeFacility.drive_time_source}</span>
          <span>Risk: {activeFacility.facility_risk_band} ({activeFacility.facility_risk_score}) • Driver: {activeFacility.top_risk_driver}</span>
          <span>EP readiness: {activeFacility.ep_readiness_status} • Support candidate: {activeFacility.aviation_support_candidate ? 'Yes' : 'No'}</span>
          <span>Recommended action: {activeFacility.recommended_action}</span>
        </article>
      ) : null}
    </section>
  );
}
