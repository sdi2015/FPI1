import type { Airport, AviationUserRole, TripRiskResult } from '../../types/aviation';

export function AviationHeaderSummary({
  role,
  selectedAirport,
  tripName,
  risk,
  onPlanTrip,
  onRunScan,
  onLaunchDemo,
  onGenerateBrief,
  onSaveTrip,
}: {
  role: AviationUserRole;
  selectedAirport: Airport | null;
  tripName: string | null;
  risk: TripRiskResult;
  onPlanTrip: () => void;
  onRunScan: () => void;
  onLaunchDemo: () => void;
  onGenerateBrief: () => void;
  onSaveTrip: () => void;
}) {
  return (
    <header className="dashboard-header aviation-ops-header aviation-hero">
      <div className="aviation-hero-copy">
        <p className="eyebrow">FPI Aviation Travel Readiness</p>
        <h1>Aviation Readiness</h1>
        <p className="aviation-hero-subtitle">Plan, scan, assess risk, and produce executive-ready trip materials from one guided workspace.</p>
        <div className="aviation-header-meta aviation-status-grid" aria-label="Current aviation workspace summary">
          <span><small>Mode</small><strong>Controlled pilot</strong></span>
          <span><small>Role</small><strong>{role.split('_').join(' ')}</strong></span>
          <span><small>Trip</small><strong>{tripName ?? 'No active trip'}</strong></span>
          <span><small>Airport</small><strong>{selectedAirport?.faa_id ?? selectedAirport?.airport_name ?? 'Not selected'}</strong></span>
          <span className={`aviation-risk-chip aviation-risk-${risk.band.toLowerCase()}`}><small>Risk</small><strong>{risk.band} · {risk.score}</strong></span>
        </div>
      </div>
      <div className="aviation-header-actions aviation-hero-actions" aria-label="Primary aviation actions">
        <button type="button" className="ops-action-button" onClick={onPlanTrip}>Plan New Trip</button>
        <button type="button" className="ops-action-button secondary" disabled={!selectedAirport} onClick={onRunScan}>Run Scan</button>
        <button type="button" className="ops-action-button secondary" disabled={!selectedAirport} onClick={onSaveTrip}>Save Trip</button>
        <button type="button" className="ops-action-button secondary" onClick={onGenerateBrief}>Brief</button>
        <button type="button" className="ops-action-button ghost" onClick={onLaunchDemo}>Demo</button>
      </div>
    </header>
  );
}
