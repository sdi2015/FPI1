import type { WeatherProviderResult } from '../../services/weatherService';

export function WeatherRiskPanel({ result }: { result: WeatherProviderResult }) {
  return (
    <section className="panel aviation-panel">
      <div className="card-heading"><div><p className="eyebrow">NOAA provider adapter</p><h3>NOAA Weather Watch</h3></div><span className="mode-pill">{result.status}</span></div>
      <p className="aviation-empty">Source: {result.source} • Freshness: {new Date(result.last_updated).toLocaleString()} • Confidence {result.confidence}%</p>
      {result.error ? <p className="aviation-empty aviation-error">{result.error}</p> : null}
      {result.alerts.length === 0 ? <p className="aviation-empty">No NOAA weather alerts found for the selected airport and trip window. Live NOAA integration is prepared but not connected in Phase 1.5.</p> : result.alerts.map((alert) => (
        <article key={alert.weather_alert_id} className="aviation-alert-card">
          <strong>{alert.severity}: {alert.alert_type}</strong>
          <span>{alert.status} • Confidence {alert.confidence}%</span>
          <p>{alert.summary}</p>
          <small>{alert.effective_start} to {alert.effective_end} • Source {alert.source} • {result.source}</small>
        </article>
      ))}
    </section>
  );
}
