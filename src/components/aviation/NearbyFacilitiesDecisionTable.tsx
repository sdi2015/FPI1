import { createFacilityReadinessAction } from '../../services/readinessActionService';
import type { FacilityWithDistance, TripReadinessAction } from '../../types/aviation';

function recommendedUse(facility: FacilityWithDistance): 'Support/Staging' | 'Monitor' | 'Verify' | 'Avoid' | 'Review' {
  if (facility.facility_risk_band === 'Critical') return 'Avoid';
  if (facility.facility_risk_band === 'High' || facility.ep_readiness_status === 'Gap') return 'Verify';
  if (facility.aviation_support_candidate && facility.ep_readiness_status === 'Stable') return 'Support/Staging';
  if (facility.facility_risk_band === 'Elevated' || facility.ep_readiness_status === 'Watch') return 'Review';
  return 'Monitor';
}

function rankFacilities(facilities: FacilityWithDistance[]): FacilityWithDistance[] {
  const epRank: Record<string, number> = { Gap: 3, Watch: 2, Unknown: 1, Restricted: 1, Stable: 0 };
  return [...facilities].sort((a, b) => b.facility_risk_score - a.facility_risk_score || (epRank[b.ep_readiness_status] ?? 0) - (epRank[a.ep_readiness_status] ?? 0) || a.distance_miles - b.distance_miles);
}

export function NearbyFacilitiesDecisionTable({
  facilities,
  tripId,
  canViewEPReadiness,
  onFacilitySelect,
  onCreateAction,
}: {
  facilities: FacilityWithDistance[];
  tripId: string;
  canViewEPReadiness: boolean;
  onFacilitySelect: (facility: FacilityWithDistance) => void;
  onCreateAction: (action: TripReadinessAction) => void;
}) {
  const ranked = rankFacilities(facilities);

  return (
    <section className="panel aviation-panel aviation-table-panel">
      <div className="card-heading">
        <div><p className="eyebrow">Facilities</p><h3>Decision table</h3></div>
        <span className="mode-pill">Auto-ranked</span>
      </div>
      <p className="aviation-caveat">Sorted by facility risk score, EP readiness gaps, then distance from airport. Use this table to decide what to verify, monitor, avoid, or stage.</p>
      {ranked.length === 0 ? <p className="aviation-empty">Run the aviation readiness scan to populate nearby Walmart facilities.</p> : (
        <div className="aviation-table-wrap">
          <table className="aviation-table aviation-decision-table">
            <thead><tr><th>Priority</th><th>Facility</th><th>Type</th><th>City/State</th><th>Distance</th><th>Risk Band</th><th>Risk Score</th><th>Top Driver</th><th>EP Status</th><th>Weather Exposure</th><th>Recommended Use</th><th>Action</th></tr></thead>
            <tbody>
              {ranked.map((facility, index) => {
                const use = recommendedUse(facility);
                return <tr key={facility.facility_id} className="aviation-clickable-row" onClick={() => onFacilitySelect(facility)}>
                  <td><strong>{index + 1}</strong></td>
                  <td><strong>{facility.facility_name}</strong><br /><span>#{facility.facility_number}</span></td>
                  <td>{facility.facility_type}</td>
                  <td>{facility.city}, {facility.state}</td>
                  <td>{facility.distance_miles.toFixed(1)} mi</td>
                  <td><span className={`aviation-risk-badge risk-${facility.facility_risk_band.toLowerCase()}`}>{facility.facility_risk_band}</span></td>
                  <td>{facility.facility_risk_score}</td>
                  <td>{facility.top_risk_driver}</td>
                  <td>{canViewEPReadiness ? facility.ep_readiness_status : 'Restricted'}</td>
                  <td>{facility.weather_exposure}</td>
                  <td><strong>{use}</strong></td>
                  <td><button type="button" className="ops-action-button secondary" onClick={(event) => { event.stopPropagation(); onCreateAction(createFacilityReadinessAction(tripId, facility)); }}>Create Action</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
