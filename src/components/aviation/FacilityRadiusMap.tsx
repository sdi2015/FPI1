import { useMemo, useState } from 'react';
import type { Airport, FacilityWithDistance } from '../../types/aviation';

export type FacilityRadiusMapProps = {
  airport: Airport | null;
  radiusMiles: number;
  facilities: FacilityWithDistance[];
  selectedFacilityId?: string | null;
  onFacilitySelect?: (facility: FacilityWithDistance) => void;
};

const colors: Record<string, string> = {
  Low: '#22c55e',
  Watch: '#eab308',
  Elevated: '#f97316',
  High: '#ef4444',
  Critical: '#a855f7',
  Unknown: '#94a3b8',
};

function getRecommendedAction(facility: FacilityWithDistance): string {
  if (facility.facility_risk_band === 'Critical') return 'Avoid unless required; escalate for review';
  if (facility.facility_risk_band === 'High') return 'Verify before arrival';
  if (facility.ep_readiness_status === 'Gap') return 'Complete EP readiness verification';
  if (facility.aviation_support_candidate) return 'Candidate for support/staging';
  return 'Monitor';
}

export function FacilityRadiusMap({ airport, radiusMiles, facilities, selectedFacilityId, onFacilitySelect }: FacilityRadiusMapProps) {
  const [activeId, setActiveId] = useState<string | null>(selectedFacilityId ?? null);
  const activeFacility = facilities.find((facility) => facility.facility_id === (selectedFacilityId ?? activeId)) ?? null;

  const pins = useMemo(() => {
    if (!airport || radiusMiles <= 0) return [];
    return facilities.map((facility) => {
      const latDelta = facility.latitude - airport.latitude;
      const lonDelta = facility.longitude - airport.longitude;
      const milesNorth = latDelta * 69;
      const milesEast = lonDelta * 69 * Math.cos((airport.latitude * Math.PI) / 180);
      const scale = 42 / radiusMiles;
      return {
        facility,
        x: Math.max(8, Math.min(92, 50 + milesEast * scale)),
        y: Math.max(8, Math.min(92, 50 - milesNorth * scale)),
      };
    });
  }, [airport, facilities, radiusMiles]);

  if (!airport) {
    return <section className="panel aviation-panel aviation-map-card"><p className="aviation-empty">Select an airport to display the radius map.</p></section>;
  }

  return (
    <section className="panel aviation-panel aviation-map-card">
      <div className="card-heading"><div><p className="eyebrow">Visual radius map</p><h3>{airport.airport_name}</h3></div><span className="mode-pill">{radiusMiles} mi</span></div>
      {facilities.length === 0 ? <p className="aviation-empty">No facilities found inside this radius. The map will populate after a matching scan.</p> : null}
      <div className="aviation-svg-map" aria-label="Airport radius map">
        <svg viewBox="0 0 100 100" role="img">
          <circle cx="50" cy="50" r="43" className="aviation-radius-ring" />
          <line x1="50" y1="4" x2="50" y2="96" className="aviation-map-grid" />
          <line x1="4" y1="50" x2="96" y2="50" className="aviation-map-grid" />
          <circle cx="50" cy="50" r="3.6" className="aviation-airport-dot" />
          <text x="53.8" y="48" className="aviation-map-label">Airport</text>
          {pins.map(({ facility, x, y }) => (
            <g key={facility.facility_id} role="button" tabIndex={0} onClick={() => { setActiveId(facility.facility_id); onFacilitySelect?.(facility); }}>
              <circle cx={x} cy={y} r={facility.facility_id === activeFacility?.facility_id ? 3.7 : 2.8} fill={colors[facility.facility_risk_band] ?? colors.Unknown} stroke="#fff" strokeWidth="0.7" />
              <title>{facility.facility_name} — {facility.facility_risk_band}</title>
            </g>
          ))}
        </svg>
      </div>
      <div className="aviation-map-legend">
        {Object.entries(colors).map(([band, color]) => <span key={band}><i style={{ background: color }} />{band}</span>)}
      </div>
      {activeFacility ? (
        <article className="aviation-selected-card aviation-map-detail">
          <span className="eyebrow">Facility pin details</span>
          <strong>{activeFacility.facility_name} #{activeFacility.facility_number}</strong>
          <span>{activeFacility.facility_type} • {activeFacility.city}, {activeFacility.state} • {activeFacility.distance_miles.toFixed(1)} mi</span>
          <span>Risk: {activeFacility.facility_risk_band} ({activeFacility.facility_risk_score}) • EP: {activeFacility.ep_readiness_status}</span>
          <span>Driver: {activeFacility.top_risk_driver}</span>
          <span>Support candidate: {activeFacility.aviation_support_candidate ? 'Yes' : 'No'} • Action: {getRecommendedAction(activeFacility)}</span>
        </article>
      ) : null}
    </section>
  );
}
