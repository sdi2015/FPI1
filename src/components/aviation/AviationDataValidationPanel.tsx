import { useEffect, useMemo } from 'react';
import { getAviationAuditEventsForTrip } from '../../services/aviationAuditService';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';
import type { AviationTripPlan } from '../../types/aviation';

export type AviationValidationCheck = { check_id: string; label: string; status: 'pass' | 'warning' | 'fail' | 'not_applicable'; summary: string; recommended_fix?: string };

export function buildAviationValidationChecks(trip: AviationTripPlan, canViewSensitive: boolean): AviationValidationCheck[] {
  const elevated = ['Elevated', 'High', 'Critical'].includes(trip.risk_band);
  const auditCount = getAviationAuditEventsForTrip(trip.trip_id).length;
  return [
    { check_id: 'airport-selected', label: 'Airport selected', status: trip.airport_snapshot ? 'pass' : 'fail', summary: trip.airport_snapshot?.airport_name ?? 'No airport selected.' },
    { check_id: 'airport-coordinates', label: 'Airport coordinates', status: Number.isFinite(trip.airport_snapshot.latitude) && Number.isFinite(trip.airport_snapshot.longitude) ? 'pass' : 'fail', summary: 'Latitude/longitude must be valid.', recommended_fix: 'Select an airport with valid static JSON coordinates.' },
    { check_id: 'radius', label: 'Radius selected', status: trip.radius_miles > 0 ? 'pass' : 'fail', summary: `${trip.radius_miles} miles.` },
    { check_id: 'facilities', label: 'Facilities found', status: trip.nearby_facilities.length ? 'pass' : 'warning', summary: `${trip.nearby_facilities.length} nearby facilities found.`, recommended_fix: 'Increase radius or confirm facility source coverage.' },
    { check_id: 'facility-coordinates', label: 'Facility coordinates', status: trip.nearby_facilities.every((facility) => Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude)) ? 'pass' : 'fail', summary: 'Scanned facilities should have valid coordinates.' },
    { check_id: 'facility-risk', label: 'Facility risk posture', status: trip.nearby_facilities.some((facility) => facility.facility_risk_band !== 'Unknown') ? 'pass' : 'warning', summary: 'Risk posture is seeded/demo unless live provider is enabled.' },
    { check_id: 'faa', label: 'FAA data status', status: trip.faa_alerts.length ? 'pass' : 'warning', summary: trip.faa_alerts.length ? `${trip.faa_alerts.length} FAA item(s).` : 'No FAA items; seeded or missing data clearly allowed.' },
    { check_id: 'weather', label: 'Weather data status', status: trip.weather_alerts.length ? 'pass' : 'warning', summary: trip.weather_alerts.length ? `${trip.weather_alerts.length} weather item(s).` : 'No weather items; seeded or missing data clearly allowed.' },
    { check_id: 'drive-time', label: 'Drive time', status: 'warning', summary: 'Drive time is estimated from straight-line distance, not route verified.' },
    { check_id: 'actions', label: 'Readiness actions', status: elevated ? (trip.readiness_actions.length ? 'pass' : 'fail') : 'not_applicable', summary: elevated ? `${trip.readiness_actions.length} action(s) for elevated+ risk.` : 'Not required below Elevated risk.' },
    { check_id: 'confidence', label: 'Source confidence', status: trip.confidence > 0 ? 'pass' : 'warning', summary: `Overall confidence ${trip.confidence}%.` },
    { check_id: 'role', label: 'Role restrictions', status: canViewSensitive ? 'pass' : 'warning', summary: canViewSensitive ? 'Current role can view sensitive trip details.' : 'Sensitive fields are restricted for this role.' },
    { check_id: 'brief', label: 'Brief generated', status: trip.generated_brief ? 'pass' : 'warning', summary: trip.generated_brief ? 'Generated brief exists.' : 'Generate a brief before formal review.' },
    { check_id: 'audit', label: 'Audit trail', status: auditCount ? 'pass' : 'warning', summary: `${auditCount} audit event(s) found for this trip.` },
  ];
}

export function AviationDataValidationPanel({ trip, canViewSensitive }: { trip: AviationTripPlan; canViewSensitive: boolean }) {
  const checks = useMemo(() => buildAviationValidationChecks(trip, canViewSensitive), [trip, canViewSensitive]);
  useEffect(() => { recordAviationAuditEvent({ event_type: 'data_validation_completed', actor_role: 'system', trip_id: trip.trip_id, airport_id: trip.airport_id, summary: `Data validation completed with ${checks.filter((check) => check.status === 'fail').length} failure(s).` }); }, [trip.trip_id]);
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Pilot readiness</p><h3>Data Validation</h3></div></div><div className="aviation-table-wrap"><table className="aviation-table"><thead><tr><th>Check</th><th>Status</th><th>Summary</th><th>Recommended Fix</th></tr></thead><tbody>{checks.map((check) => <tr key={check.check_id}><td>{check.label}</td><td><span className={`aviation-badge aviation-status-${check.status}`}>{check.status}</span></td><td>{check.summary}</td><td>{check.recommended_fix ?? '—'}</td></tr>)}</tbody></table></div></section>;
}
