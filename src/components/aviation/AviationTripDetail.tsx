import { useMemo, useState } from 'react';
import { getAviationPermissions } from '../../services/aviationAuthorizationService';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';
import { calculateTripRiskScore } from '../../services/aviationRiskEngine';
import { saveTripPlan } from '../../services/aviationTripStorageService';
import { updateReadinessActionStatus } from '../../services/readinessActionService';
import { generateTripBrief } from '../../services/tripBriefService';
import { downloadBriefAsMarkdown, downloadBriefAsTxt, openPrintFriendlyBrief } from './TripBriefPanel';
import { AviationAuditTimeline } from './AviationAuditTimeline';
import { AviationDataValidationPanel } from './AviationDataValidationPanel';
import { IntegrationStatusPanel } from './IntegrationStatusPanel';
import { NearbyFacilitiesTable } from './NearbyFacilitiesTable';
import { TripReadinessActions } from './TripReadinessActions';
import { TripRiskScoreCard } from './TripRiskScoreCard';
import type { AviationTripPlan, TripReadinessAction } from '../../types/aviation';

export type AviationTripDetailProps = { trip: AviationTripPlan; currentRole: string; onClose: () => void; onTripUpdated?: (trip: AviationTripPlan) => void };

export function AviationTripDetail({ trip, currentRole, onClose, onTripUpdated }: AviationTripDetailProps) {
  const [draft, setDraft] = useState(trip);
  const [closureNotes, setClosureNotes] = useState('');
  const permissions = getAviationPermissions(currentRole as Parameters<typeof getAviationPermissions>[0]);
  const isClosed = draft.status === 'closed' || Boolean(draft.closure_summary);
  const canCloseOrReopen = ['aviation_admin', 'executive_protection', 'global_security', 'fpi_admin'].includes(currentRole);
  const risk = useMemo(() => calculateTripRiskScore({ nearbyFacilities: draft.nearby_facilities, faaAlerts: draft.faa_alerts, weatherAlerts: draft.weather_alerts, hasSelectedAirport: true }), [draft]);
  const brief = useMemo(() => {
    const base = draft.generated_brief || generateTripBrief({ airport: draft.airport_snapshot, radiusMiles: draft.radius_miles, tripStart: draft.trip_start ?? '', tripEnd: draft.trip_end ?? '', facilityTypes: draft.facility_types, nearbyFacilities: draft.nearby_facilities, risk, faaAlerts: draft.faa_alerts, weatherAlerts: draft.weather_alerts });
    return draft.closure_summary ? `${base}\n\nTRIP CLOSURE SUMMARY\n- Closed At: ${draft.closure_summary.closed_at}\n- Closed By Role: ${draft.closure_summary.closed_by_role}\n- Final Review Status: ${draft.closure_summary.final_review_status}\n- Final Risk: ${draft.closure_summary.final_risk_score} (${draft.closure_summary.final_risk_band})\n- Completed Actions: ${draft.closure_summary.completed_actions_count}\n- Open Actions: ${draft.closure_summary.open_actions_count}\n- Unresolved Drivers: ${draft.closure_summary.unresolved_risk_drivers.join('; ') || 'None'}\n- Final Notes: ${draft.closure_summary.final_notes}` : base;
  }, [draft, risk]);

  async function persist(next: AviationTripPlan) { const saved = await saveTripPlan(next); setDraft(saved); onTripUpdated?.(saved); }
  function updateStatus(actionId: string, status: TripReadinessAction['status']) { if (isClosed) return; const actions = updateReadinessActionStatus(draft.readiness_actions, actionId, status); const next = { ...draft, readiness_actions: actions, updated_at: new Date().toISOString() }; persist(next); recordAviationAuditEvent({ event_type: 'readiness_action_status_changed', actor_role: currentRole, trip_id: draft.trip_id, airport_id: draft.airport_id, summary: `Readiness action ${actionId} changed to ${status}.` }); }
  async function regenerateBrief() { if (isClosed) return; const next = { ...draft, generated_brief: generateTripBrief({ airport: draft.airport_snapshot, radiusMiles: draft.radius_miles, tripStart: draft.trip_start ?? '', tripEnd: draft.trip_end ?? '', facilityTypes: draft.facility_types, nearbyFacilities: draft.nearby_facilities, risk, faaAlerts: draft.faa_alerts, weatherAlerts: draft.weather_alerts }), updated_at: new Date().toISOString() }; await persist(next); recordAviationAuditEvent({ event_type: 'trip_brief_generated', actor_role: currentRole, trip_id: draft.trip_id, airport_id: draft.airport_id, summary: 'Trip detail brief regenerated.' }); }
  async function closeTrip() { if (!canCloseOrReopen || !closureNotes.trim()) return; const completed = draft.readiness_actions.filter((action) => action.status === 'Closed' || action.status === 'Verified').length; const open = draft.readiness_actions.length - completed; const closure_summary = { closed_at: new Date().toISOString(), closed_by_role: currentRole, final_review_status: 'Closed after pilot review', final_risk_score: risk.score, final_risk_band: risk.band, completed_actions_count: completed, open_actions_count: open, unresolved_risk_drivers: open ? risk.drivers : [], final_notes: closureNotes }; const next = { ...draft, status: 'closed' as const, closure_summary, updated_at: new Date().toISOString() }; await persist(next); recordAviationAuditEvent({ event_type: 'trip_closed', actor_role: currentRole, trip_id: draft.trip_id, airport_id: draft.airport_id, summary: 'Trip closed with closure summary.' }); }
  async function reopenTrip() { if (!canCloseOrReopen) return; const next = { ...draft, status: 'reviewed' as const, closure_summary: undefined, updated_at: new Date().toISOString() }; await persist(next); recordAviationAuditEvent({ event_type: 'trip_reopened', actor_role: currentRole, trip_id: draft.trip_id, airport_id: draft.airport_id, summary: 'Trip reopened by authorized role.' }); }
  function auditExport(summary: string) { recordAviationAuditEvent({ event_type: 'brief_exported', actor_role: currentRole, trip_id: draft.trip_id, airport_id: draft.airport_id, summary }); }

  return (
    <div className="aviation-modal-backdrop" role="dialog" aria-modal="true" aria-label="Aviation saved trip detail">
      <section className="aviation-trip-detail panel">
        <div className="card-heading"><div><p className="eyebrow">Saved trip detail</p><h2>{draft.trip_name}</h2></div><button type="button" className="ops-action-button secondary" onClick={onClose}>Close</button></div>
        <section className="aviation-detail-grid">
          <article className="aviation-selected-card"><span className="eyebrow">Trip Summary</span><strong>{draft.status.toUpperCase()}</strong><span>{draft.trip_start ?? 'No start'} to {draft.trip_end ?? 'No end'} • {draft.radius_miles} mi • {draft.source_freshness}</span></article>
          <article className="aviation-selected-card"><span className="eyebrow">Selected Airport</span><strong>{draft.airport_snapshot.airport_name}</strong><span>{draft.airport_snapshot.city}, {draft.airport_snapshot.state} • {draft.airport_snapshot.faa_id ?? 'No FAA code'}</span></article>
          <article className="aviation-selected-card"><span className="eyebrow">Radius and Facility Filters</span><strong>{draft.radius_miles} miles</strong><span>{draft.facility_types.length ? draft.facility_types.join(', ') : 'All facility types'}</span></article>
        </section>
        <TripRiskScoreCard risk={risk} canViewRecommendation={permissions.canViewGoNoGoRecommendation} />
        {isClosed ? <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Closure summary</p><h3>Trip Closed</h3></div></div><p>{draft.closure_summary?.final_notes}</p><p className="aviation-caveat">Closed by {draft.closure_summary?.closed_by_role} at {draft.closure_summary?.closed_at}. Completed actions: {draft.closure_summary?.completed_actions_count}; Open actions: {draft.closure_summary?.open_actions_count}.</p>{canCloseOrReopen ? <button className="ops-action-button secondary" onClick={reopenTrip}>Reopen trip</button> : null}</section> : null}
        <AviationDataValidationPanel trip={draft} canViewSensitive={permissions.canViewSensitiveTripDetails} />
        <NearbyFacilitiesTable facilities={draft.nearby_facilities} canViewEPReadiness={permissions.canViewEPReadiness} />
        <section className="aviation-detail-grid"><article className="aviation-selected-card"><span className="eyebrow">FAA Watch Items</span><strong>{draft.faa_alerts.length}</strong><span>{draft.faa_alerts.map((alert) => `${alert.severity}: ${alert.title}`).join('; ') || 'None'}</span></article><article className="aviation-selected-card"><span className="eyebrow">NOAA Weather Items</span><strong>{draft.weather_alerts.length}</strong><span>{draft.weather_alerts.map((alert) => `${alert.severity}: ${alert.alert_type}`).join('; ') || 'None'}</span></article></section>
        <TripReadinessActions actions={draft.readiness_actions} canCreateActions={permissions.canCreateReadinessActions} canViewEPReadiness={permissions.canViewEPReadiness} onGenerateActions={() => undefined} onStatusChange={updateStatus} />
        <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Generated Brief</p><h3>Export and Review</h3></div></div>{!isClosed ? <textarea className="aviation-input" placeholder="Required final notes before closing trip" value={closureNotes} onChange={(event) => setClosureNotes(event.target.value)} /> : null}<div className="aviation-brief-actions"><button className="ops-action-button secondary" onClick={() => { navigator.clipboard.writeText(brief); auditExport('Trip detail brief copied.'); }}>Copy brief</button><button className="ops-action-button secondary" onClick={() => { downloadBriefAsTxt(brief, `fpi-trip-${draft.trip_id}.txt`); auditExport('Trip detail brief downloaded as TXT.'); }}>Download TXT</button><button className="ops-action-button secondary" onClick={() => { downloadBriefAsMarkdown(brief, `fpi-trip-${draft.trip_id}.md`); auditExport('Trip detail brief downloaded as MD.'); }}>Download MD</button><button className="ops-action-button secondary" onClick={() => { openPrintFriendlyBrief(brief); auditExport('Trip detail brief opened in print view.'); }}>Print view</button><button className="ops-action-button" disabled={isClosed} onClick={regenerateBrief}>Regenerate brief</button><button className="ops-action-button secondary" disabled={isClosed || !canCloseOrReopen || !closureNotes.trim()} onClick={closeTrip}>Close trip</button></div><pre className="aviation-brief">{brief}</pre></section>
        <IntegrationStatusPanel />
        <AviationAuditTimeline tripId={draft.trip_id} limit={25} />
        <p className="aviation-caveat">Advisory / human decision authority disclaimer: FPI readiness outputs do not make autonomous flight, travel, EP, or security decisions. Authorized human leaders retain final authority.</p>
      </section>
    </div>
  );
}
