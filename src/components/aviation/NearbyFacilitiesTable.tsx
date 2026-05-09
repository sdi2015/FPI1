import { estimateDriveTimeMinutes } from '../../services/routingService';
import type { FacilityWithDistance } from '../../types/aviation';

function getRecommendedAction(facility: FacilityWithDistance): string {
  if (facility.facility_risk_band === 'Critical') return 'Avoid unless required; escalate for review';
  if (facility.facility_risk_band === 'High') return 'Verify before arrival';
  if (facility.ep_readiness_status === 'Gap') return 'Complete EP readiness verification';
  if (facility.aviation_support_candidate) return 'Candidate for support/staging';
  return 'Monitor';
}

export function NearbyFacilitiesTable({ facilities, canViewEPReadiness }: { facilities: FacilityWithDistance[]; canViewEPReadiness: boolean }) {
  return (
    <section className="panel aviation-panel aviation-table-panel">
      <div className="card-heading"><div><p className="eyebrow">Walmart facilities in radius</p><h3>Nearby Facilities</h3></div><span className="mode-pill">{facilities.length} matched</span></div>
      {facilities.length === 0 ? <p className="aviation-empty">No facilities are inside the selected radius. Increase the radius or select another airport.</p> : (
        <div className="aviation-table-wrap">
          <table className="aviation-table">
            <thead><tr><th>Facility</th><th>Type</th><th>City/State</th><th>Distance</th><th>Drive Time</th><th>Facility Risk</th><th>Top Driver</th><th>EP Readiness</th><th>Weather Exposure</th><th>Recommended Action</th></tr></thead>
            <tbody>
              {facilities.map((facility) => (
                <tr key={facility.facility_id}>
                  <td><strong>{facility.facility_name}</strong><br /><span>#{facility.facility_number}</span></td>
                  <td>{facility.facility_type}</td>
                  <td>{facility.city}, {facility.state}</td>
                  <td>{facility.distance_miles.toFixed(1)} mi</td>
                  <td><strong>~{estimateDriveTimeMinutes(facility.distance_miles)} min est.</strong><br /><span title="Estimated from straight-line distance. Routing integration pending.">Straight-line estimate</span></td>
                  <td>{facility.facility_risk_band} ({facility.facility_risk_score})</td>
                  <td>{facility.top_risk_driver}</td>
                  <td>{canViewEPReadiness ? facility.ep_readiness_status : 'Restricted'}</td>
                  <td>{facility.facility_risk_band === 'High' || facility.facility_risk_band === 'Critical' ? 'Elevated' : 'Seeded/demo'}</td>
                  <td>{getRecommendedAction(facility)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
