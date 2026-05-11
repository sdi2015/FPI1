import type { FAAAlert, FacilityWithDistance, TripReadinessAction, TripRiskResult, WeatherAlert } from '../types/aviation';

function now() {
  return new Date().toISOString();
}

function due(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function action(partial: Omit<TripReadinessAction, 'action_id' | 'created_at' | 'updated_at' | 'status'>, index: number): TripReadinessAction {
  const timestamp = now();
  return {
    ...partial,
    action_id: `ACT-${Date.now()}-${index}`,
    status: 'Open',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function generateReadinessActions({
  tripId,
  weatherAlerts,
  faaAlerts,
  nearbyFacilities,
  risk,
}: {
  tripId: string;
  weatherAlerts: WeatherAlert[];
  faaAlerts: FAAAlert[];
  nearbyFacilities: FacilityWithDistance[];
  risk: TripRiskResult;
}): TripReadinessAction[] {
  const actions: TripReadinessAction[] = [];
  const severeWeather = weatherAlerts.find((alert) => ['Elevated', 'High', 'Critical'].includes(alert.severity));
  const faaWatch = faaAlerts.find((alert) => alert.status === 'active');
  const highRiskFacility = nearbyFacilities.find((facility) => facility.facility_risk_band === 'High' || facility.facility_risk_band === 'Critical');
  const epGap = nearbyFacilities.find((facility) => facility.ep_readiness_status === 'Gap');
  const supportCandidate = nearbyFacilities.some((facility) => facility.aviation_support_candidate);

  if (severeWeather) actions.push(action({ trip_id: tripId, title: 'Verify weather at T-minus 6 hours and T-minus 2 hours', description: severeWeather.summary, owner_role: 'Aviation Operations', due_time: due(6), priority: severeWeather.severity === 'Critical' ? 'Critical' : 'High', evidence_required: true, evidence_type: 'NOAA screenshot or approved weather briefing reference', created_from_driver: `${severeWeather.severity} weather: ${severeWeather.alert_type}`, source_domain: 'Weather' }, actions.length));
  if (faaWatch) actions.push(action({ trip_id: tripId, title: 'Confirm airport/NOTAM status before departure', description: faaWatch.summary, owner_role: 'Aviation Dispatch', due_time: due(4), priority: faaWatch.severity === 'Critical' ? 'Critical' : 'High', evidence_required: true, evidence_type: 'Approved FAA/NOTAM status verification', created_from_driver: `${faaWatch.severity} FAA watch: ${faaWatch.title}`, source_domain: 'FAA' }, actions.length));
  if (highRiskFacility) actions.push(action({ trip_id: tripId, title: 'Verify high-risk nearby facility posture', description: `${highRiskFacility.facility_name}: ${highRiskFacility.top_risk_driver}`, owner_role: 'Field Security / FPI Owner', due_time: due(8), priority: highRiskFacility.facility_risk_band === 'Critical' ? 'Critical' : 'High', evidence_required: true, evidence_type: 'Facility owner confirmation', created_from_driver: highRiskFacility.top_risk_driver, source_domain: 'Facility' }, actions.length));
  if (epGap) actions.push(action({ trip_id: tripId, title: 'Confirm EP checklist and local contact', description: `${epGap.facility_name} has an EP readiness gap.`, owner_role: 'Executive Protection', due_time: due(8), priority: 'High', evidence_required: true, evidence_type: 'EP checklist confirmation', created_from_driver: 'EP readiness gap', source_domain: 'EP' }, actions.length));
  if (risk.domain_breakdown.some((domain) => domain.source_status === 'missing' || domain.source_status === 'stale')) actions.push(action({ trip_id: tripId, title: 'Validate missing or stale source data manually', description: 'One or more FAA, NOAA, facility, or EP inputs are missing/stale/demo-only.', owner_role: 'FPI Analyst', due_time: due(12), priority: 'Medium', evidence_required: true, evidence_type: 'Manual source validation note', created_from_driver: 'Missing/stale source data', source_domain: 'Data Freshness' }, actions.length));
  if (!supportCandidate) actions.push(action({ trip_id: tripId, title: 'Identify alternate support/staging facility', description: 'No aviation support candidate was identified inside the selected radius.', owner_role: 'Field Security', due_time: due(10), priority: 'Medium', evidence_required: false, created_from_driver: 'No support candidate', source_domain: 'Support' }, actions.length));
  if (risk.band === 'Critical' || risk.score >= 70) actions.push(action({ trip_id: tripId, title: 'Escalate for aviation/security leadership review', description: `Trip scored ${risk.score} (${risk.band}). FPI remains advisory; authorized leaders retain final decision authority.`, owner_role: 'Aviation / EP / Security Leadership', due_time: due(2), priority: risk.band === 'Critical' ? 'Critical' : 'High', evidence_required: true, evidence_type: 'Leadership review disposition', created_from_driver: 'Critical/high trip risk', source_domain: 'Incident' }, actions.length));

  return actions;
}

export function createFacilityReadinessAction(tripId: string, facility: FacilityWithDistance, title = 'Verify selected facility support/staging posture'): TripReadinessAction {
  return action({
    trip_id: tripId,
    title,
    description: `${facility.facility_name} #${facility.facility_number} is ${facility.distance_miles.toFixed(1)} miles from the selected airport. Risk ${facility.facility_risk_band}; EP readiness ${facility.ep_readiness_status}; driver: ${facility.top_risk_driver}.`,
    owner_role: facility.ep_readiness_status === 'Gap' ? 'Executive Protection' : 'Field Security / Facility Protection',
    due_time: due(8),
    priority: facility.facility_risk_band === 'Critical' ? 'Critical' : facility.facility_risk_band === 'High' ? 'High' : 'Medium',
    evidence_required: true,
    evidence_type: 'Facility leadership or EP readiness confirmation',
    created_from_driver: facility.top_risk_driver,
    source_domain: facility.ep_readiness_status === 'Gap' ? 'EP' : 'Facility',
    related_facility_id: facility.facility_id,
  }, 0);
}

export function updateReadinessActionStatus(actions: TripReadinessAction[], actionId: string, status: TripReadinessAction['status']): TripReadinessAction[] {
  return actions.map((action) => action.action_id === actionId ? { ...action, status, updated_at: now(), verified_at: status === 'Verified' ? now() : action.verified_at } : action);
}

export function updateReadinessActionEvidence(actions: TripReadinessAction[], actionId: string, updates: Pick<Partial<TripReadinessAction>, 'evidence_note' | 'evidence_file_name' | 'evidence_received' | 'verifier_name' | 'verified_at'>): TripReadinessAction[] {
  return actions.map((action) => action.action_id === actionId ? { ...action, ...updates, updated_at: now() } : action);
}
