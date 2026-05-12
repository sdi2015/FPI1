import type { FAAProviderResult } from '../../services/faaService';

export function FAAWatchPanel({ result }: { result: FAAProviderResult }) {
  return (
    <section className="panel aviation-panel">
      <div className="card-heading"><div><p className="eyebrow">FAA provider adapter</p><h3>FAA / Airport Watch</h3></div><span className="mode-pill">{result.status}</span></div>
      <p className="aviation-empty">Source: {result.source} • Freshness: {new Date(result.last_updated).toLocaleString()} • Confidence {result.confidence}%</p>
      {result.error ? <p className="aviation-empty aviation-error">{result.error}</p> : null}
      {result.alerts.length === 0 ? <p className="aviation-empty">No FAA watch items found for the selected airport and trip window. Live FAA/NOTAM integration is prepared but not connected in Phase 1.5.</p> : result.alerts.map((alert) => (
        <article key={alert.alert_id} className="aviation-alert-card">
          <strong>{alert.severity}: {alert.title}</strong>
          <span>{alert.alert_type} • {alert.status} • Confidence {alert.confidence}%</span>
          <p>{alert.summary}</p>
          <small>{alert.effective_start} to {alert.effective_end} • Source {alert.source} • {result.source}</small>
        </article>
      ))}
    </section>
  );
}
