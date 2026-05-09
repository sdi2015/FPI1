import type { AviationTripPlan } from '../../types/aviation';

export function SavedTripsPanel({ trips, onSave, onOpen, onDuplicate, onDelete }: { trips: AviationTripPlan[]; onSave: () => void; onOpen: (trip: AviationTripPlan) => void; onDuplicate: (tripId: string) => void; onDelete: (tripId: string) => void }) {
  return (
    <section className="panel aviation-panel">
      <div className="card-heading"><div><p className="eyebrow">Local persistence</p><h3>Saved Trips</h3></div><span className="mode-pill">{trips.length}</span></div>
      <button type="button" className="ops-action-button aviation-scan-button" onClick={onSave}>Save Trip</button>
      {trips.length === 0 ? <p className="aviation-empty">No saved aviation trip scans yet. Saved trips persist in this browser via localStorage for Phase 1.5.</p> : (
        <div className="aviation-saved-list">
          {trips.map((trip) => (
            <article key={trip.trip_id} className="aviation-selected-card">
              <strong>{trip.trip_name}</strong>
              <span>{trip.airport_snapshot.airport_name} • {trip.radius_miles} mi • {trip.risk_band} ({trip.risk_score})</span>
              <span>Updated {new Date(trip.updated_at).toLocaleString()} • {trip.source_freshness}</span>
              <div className="aviation-button-row">
                <button type="button" className="ops-action-button secondary" onClick={() => onOpen(trip)}>Open</button>
                <button type="button" className="ops-action-button secondary" onClick={() => onDuplicate(trip.trip_id)}>Duplicate</button>
                <button type="button" className="ops-action-button secondary" onClick={() => onDelete(trip.trip_id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
