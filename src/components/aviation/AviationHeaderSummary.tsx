export function AviationHeaderSummary({
  canRunScan,
  onPlanTrip,
  onRunScan,
}: {
  canRunScan: boolean;
  onPlanTrip: () => void;
  onRunScan: () => void;
}) {
  return (
    <header className="dashboard-header aviation-ops-header aviation-page-header clean-aviation-header">
      <div className="aviation-hero-copy">
        <p className="eyebrow">Aviation Readiness</p>
        <h1>Aviation Travel Readiness</h1>
        <p className="page-subtitle aviation-hero-subtitle">
          Plan airport-centered travel readiness, nearby facility support, FAA/NOAA watch items, trip risk, and executive brief materials.
        </p>
      </div>
      <div className="page-header-actions aviation-header-actions" aria-label="Primary aviation actions">
        <button type="button" className="ops-action-button secondary" onClick={onPlanTrip}>New Trip</button>
        <button type="button" className="ops-action-button" disabled={!canRunScan} title={canRunScan ? 'Run airport radius scan' : 'Select an airport before running a scan.'} onClick={onRunScan}>Run Scan</button>
      </div>
    </header>
  );
}
