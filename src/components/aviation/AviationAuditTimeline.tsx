import { getAviationAuditEvents, getAviationAuditEventsForTrip } from '../../services/aviationAuditService';

export type AviationAuditTimelineProps = { tripId?: string | null; limit?: number };

export function AviationAuditTimeline({ tripId, limit = 10 }: AviationAuditTimelineProps) {
  const events = (tripId ? getAviationAuditEventsForTrip(tripId) : getAviationAuditEvents()).slice(0, limit);
  return (
    <section className="panel aviation-panel">
      <div className="card-heading"><div><p className="eyebrow">Local audit log</p><h3>{tripId ? 'Trip Audit Timeline' : 'Recent Aviation Audit'}</h3></div><span className="mode-pill">{events.length}</span></div>
      {events.length === 0 ? <p className="aviation-empty">No aviation audit events recorded yet.</p> : (
        <ol className="aviation-audit-list">
          {events.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><span>{new Date(event.timestamp).toLocaleString()} • {event.actor_role}</span><p>{event.summary}</p>{event.source_context ? <small>{event.source_context.provider ?? 'provider'} • {event.source_context.source_status ?? 'unknown'} • Confidence {event.source_context.confidence ?? 0}%</small> : null}</li>)}
        </ol>
      )}
    </section>
  );
}
