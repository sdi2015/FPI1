import type { FacilitySortMode, FacilityWithDistance } from '../../types/aviation';

export function NearbyFacilitiesTable({ facilities, canViewEPReadiness, sortMode = 'risk', onSortChange = () => undefined, onFacilitySelect = () => undefined }: { facilities: FacilityWithDistance[]; canViewEPReadiness: boolean; sortMode?: FacilitySortMode; onSortChange?: (mode: FacilitySortMode) => void; onFacilitySelect?: (facility: FacilityWithDistance) => void }) {
  const elevated = facilities.filter((facility) => ['Elevated', 'High', 'Critical'].includes(facility.facility_risk_band)).length;
  const supportCandidates = facilities.filter((facility) => facility.aviation_support_candidate).length;
  const epGaps = facilities.filter((facility) => facility.ep_readiness_status === 'Gap').length;
  const closest = facilities.reduce<FacilityWithDistance | null>((best, facility) => !best || facility.distance_miles < best.distance_miles ? facility : best, null);
  const highestRisk = facilities[0] ?? null;

  return (
    <section className="panel aviation-panel aviation-table-panel">
      <div className="card-heading">
        <div><p className="eyebrow">Nearby Walmart facilities</p><h3>Facility scan results</h3></div>
        <span className="mode-pill">{facilities.length} matched</span>
      </div>
      <div className="aviation-table-summary">
        <strong>{facilities.length} Walmart facilities found.</strong>
        <span>{elevated} elevated/high risk</span>
        <span>{supportCandidates} support candidates</span>
        <span>{epGaps} EP readiness gap(s)</span>
        {closest ? <span>Closest: {closest.facility_number} — {closest.distance_miles.toFixed(1)} mi</span> : null}
      </div>
      <div className="aviation-table-toolbar">
        <div className="aviation-chip-list">
          <span className="aviation-info-chip">Highest Risk: {highestRisk ? `${highestRisk.facility_number} ${highestRisk.facility_risk_band}` : 'N/A'}</span>
          <span className="aviation-info-chip">Best Support: {facilities.find((facility) => facility.aviation_support_candidate)?.facility_number ?? 'N/A'}</span>
        </div>
        <label className="aviation-sort-control">
          <span>Sort results</span>
          <select className="aviation-input" value={sortMode} onChange={(event) => onSortChange(event.target.value as FacilitySortMode)}>
            <option value="risk">Highest Risk</option>
            <option value="distance">Closest Distance</option>
            <option value="support">Best Support Candidate</option>
          </select>
        </label>
      </div>
      {facilities.length === 0 ? <p className="aviation-empty">No Walmart facilities found within this radius. Increase the radius or adjust facility type filters.</p> : (
        <div className="aviation-table-wrap">
          <table className="aviation-table aviation-facility-table">
            <thead><tr><th>Facility</th><th>Type</th><th>City/State</th><th>Distance</th><th>Drive Time</th><th>Risk</th><th>Top Driver</th><th>EP Readiness</th><th>Support</th><th>Recommended Action</th></tr></thead>
            <tbody>
              {facilities.map((facility, index) => {
                const bestSupport = facility.aviation_support_candidate && index === facilities.findIndex((candidate) => candidate.aviation_support_candidate);
                const highRisk = ['High', 'Critical'].includes(facility.facility_risk_band);
                return (
                  <tr key={facility.facility_id} onClick={() => onFacilitySelect(facility)} className="aviation-clickable-row">
                    <td><strong>{facility.facility_name}</strong><br /><span>#{facility.facility_number}</span>{highRisk ? <em className="aviation-row-badge risk">Highest Risk</em> : null}{bestSupport ? <em className="aviation-row-badge support">Best Support Candidate</em> : null}</td>
                    <td>{facility.facility_type}</td>
                    <td>{facility.city}, {facility.state}</td>
                    <td>{facility.distance_miles.toFixed(1)} mi</td>
                    <td><strong>~{facility.estimated_drive_time_minutes} min</strong><br /><span>{facility.drive_time_source === 'estimated' ? 'Straight-line estimate' : facility.drive_time_source}</span></td>
                    <td>{facility.facility_risk_band} ({facility.facility_risk_score})</td>
                    <td>{facility.top_risk_driver}</td>
                    <td>{canViewEPReadiness ? facility.ep_readiness_status : 'Restricted'}</td>
                    <td>{facility.aviation_support_candidate ? 'Yes' : 'No'}</td>
                    <td>{facility.recommended_action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
