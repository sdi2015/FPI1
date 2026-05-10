import { tryAviationApiRequest } from './aviationApiClient';
import { isAviationApiPersistenceEnabled } from './aviationRuntimeConfig';

export type AviationAuditEventType =
  | 'aviation_module_opened' | 'airport_selected' | 'radius_changed' | 'facility_filters_changed' | 'facilities_scanned' | 'facility_marker_selected' | 'scan_saved_as_trip' | 'trip_risk_calculated'
  | 'trip_brief_generated' | 'trip_saved' | 'trip_opened' | 'trip_duplicated' | 'trip_deleted'
  | 'readiness_actions_generated' | 'readiness_action_status_changed' | 'demo_scenario_launched'
  | 'faa_alerts_loaded' | 'weather_alerts_loaded' | 'integration_status_viewed' | 'brief_exported' | 'trip_closed'
  | 'pilot_feedback_submitted' | 'pilot_issue_created' | 'pilot_issue_updated' | 'pilot_metric_viewed'
  | 'handoff_packet_generated' | 'handoff_packet_exported' | 'governance_matrix_viewed'
  | 'data_validation_completed' | 'provider_mode_changed' | 'trip_reopened'
  | 'pilot_uat_logged' | 'stakeholder_decision_logged' | 'pilot_readout_report_generated'
  | 'pilot_readout_report_exported' | 'production_readiness_score_viewed';

export type AviationAuditEvent = {
  event_id: string;
  event_type: AviationAuditEventType;
  timestamp: string;
  actor_role: string;
  trip_id?: string | null;
  airport_id?: string | null;
  summary: string;
  source_context?: { provider?: string; source_status?: string; confidence?: number };
  metadata?: Record<string, unknown>;
};

const STORAGE_KEY = 'fpi_aviation_audit_events';

function readEvents(): AviationAuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AviationAuditEvent[] : [];
  } catch {
    return [];
  }
}

function writeEvents(events: AviationAuditEvent[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 500)));
}

export function recordAviationAuditEvent(event: Omit<AviationAuditEvent, 'event_id' | 'timestamp'>): AviationAuditEvent {
  const saved: AviationAuditEvent = {
    ...event,
    event_id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  writeEvents([saved, ...readEvents()]);
  if (isAviationApiPersistenceEnabled()) void tryAviationApiRequest<AviationAuditEvent>('/aviation/audit-events', { method: 'POST', body: saved });
  return saved;
}

export function getAviationAuditEvents(): AviationAuditEvent[] {
  return readEvents().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getAviationAuditEventsForTrip(tripId: string): AviationAuditEvent[] {
  return getAviationAuditEvents().filter((event) => event.trip_id === tripId);
}

export function clearAviationAuditEvents(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}
