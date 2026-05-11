import type { Airport, AviationTripPlan, FAAAlert, FacilityWithDistance, TripReadinessAction, TripRiskResult, WeatherAlert } from '../../types/aviation';

type DashboardProps = {
  savedTrips: AviationTripPlan[];
  nearbyFacilities: FacilityWithDistance[];
  readinessActions: TripReadinessAction[];
  faaAlerts: FAAAlert[];
  weatherAlerts: WeatherAlert[];
  currentRisk: TripRiskResult;
  selectedAirport?: Airport | null;
  radiusMiles?: number;
  tripStart?: string;
  tripEnd?: string;
  onPlanTrip: () => void;
  onLaunchDemo: () => void;
  onOpenScanner: () => void;
  onGenerateBrief: () => void;
  onViewIntegrations: () => void;
  onOpenTrip: (trip: AviationTripPlan) => void;
};

function riskRank(band: string) {
  return ['Low', 'Watch', 'Elevated', 'High', 'Critical'].indexOf(band);
}

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function AviationOperationsDashboard({ savedTrips, nearbyFacilities, readinessActions, faaAlerts, weatherAlerts, currentRisk, selectedAirport, radiusMiles = 25, tripStart = '', tripEnd = '', onPlanTrip, onLaunchDemo, onOpenScanner, onGenerateBrief, onViewIntegrations, onOpenTrip }: DashboardProps) {
  const activeTrips = savedTrips.filter((trip) => trip.status !== 'closed');
  const highRiskTrips = savedTrips.filter((trip) => ['High', 'Critical'].includes(trip.risk_band));
  const openActions = [...readinessActions, ...savedTrips.flatMap((trip) => trip.readiness_actions)].filter((action) => !['Closed', 'Verified'].includes(action.status));
  const airportsMonitored = new Set(savedTrips.map((trip) => trip.airport_id)).size;
  const boardTrips = (activeTrips.length ? activeTrips : savedTrips).slice().sort((a, b) => riskRank(b.risk_band) - riskRank(a.risk_band)).slice(0, 5);
  const alertCount = faaAlerts.length + weatherAlerts.length;
  const briefsGenerated = savedTrips.filter((trip) => trip.generated_brief).length;
  const highestRiskFacility = nearbyFacilities[0];
  const supportFacility = nearbyFacilities.find((facility) => facility.aviation_support_candidate);

  return (
    <div className="aviation-dashboard">
      <section className="panel aviation-panel aviation-command-center-hero"><p className="eyebrow">Aviation Travel Readiness Command Center</p><h1>Aviation Travel Readiness Command Center</h1><p>Monitor airport-centered travel risk, nearby Walmart facility posture, FAA/NOAA signals, and pre-trip readiness actions.</p></section>
      <section className="aviation-kpi-grid aviation-command-kpis"><article className="aviation-kpi-card"><span>Planned Trips</span><strong>{activeTrips.length}</strong><small>Active or draft</small></article><article className="aviation-kpi-card"><span>Airports Monitored</span><strong>{airportsMonitored}</strong><small>Unique saved airports</small></article><article className="aviation-kpi-card"><span>High-Risk Trip Windows</span><strong>{highRiskTrips.length}</strong><small>High / Critical</small></article><article className="aviation-kpi-card"><span>Facilities Within Radius</span><strong>{nearbyFacilities.length}</strong><small>Selected scan</small></article><article className="aviation-kpi-card"><span>FAA Watch Items</span><strong>{faaAlerts.length}</strong><small>Selected trip</small></article><article className="aviation-kpi-card"><span>Weather Alerts</span><strong>{weatherAlerts.length}</strong><small>NOAA window</small></article><article className="aviation-kpi-card"><span>Open Readiness Actions</span><strong>{openActions.length}</strong><small>Unresolved tasks</small></article><article className="aviation-kpi-card"><span>Briefs Generated</span><strong>{briefsGenerated}</strong><small>Saved trip briefs</small></article></section>
      <section className="aviation-three-column"><aside className="panel aviation-panel"><p className="eyebrow">Trip Controls</p><h3>{selectedAirport?.airport_name ?? 'No airport selected'}</h3><p>Radius: {radiusMiles} mi</p><p>Window: {formatDate(tripStart)} → {formatDate(tripEnd)}</p><div className="aviation-button-row"><button className="ops-action-button" onClick={onOpenScanner}>Run scan</button><button className="ops-action-button secondary" onClick={onPlanTrip}>Trip setup</button><button className="ops-action-button secondary" onClick={onLaunchDemo}>Load demo scenario</button></div></aside><main className="panel aviation-panel"><p className="eyebrow">Active Scan Overview</p><h3>{nearbyFacilities.length} facilities in radius</h3><p>Highest-risk facility: {highestRiskFacility ? `${highestRiskFacility.facility_name} (${highestRiskFacility.facility_risk_band})` : 'Run a scan'}</p><p>Recommended support/staging: {supportFacility?.facility_name ?? 'No support candidate selected'}</p><div className="aviation-timeline"><span>{formatDate(tripStart)}</span><strong>Trip window</strong><span>{formatDate(tripEnd)}</span></div></main><aside className="panel aviation-panel"><p className="eyebrow">Decision Support</p><h3>{currentRisk.score} · {currentRisk.band}</h3><ul className="aviation-driver-list">{currentRisk.drivers.slice(0, 5).map((driver) => <li key={driver}>{driver}</li>)}</ul><div className="aviation-chip-list"><button className="aviation-filter-chip">Explain risk</button><button className="aviation-filter-chip">Best support site?</button><button className="aviation-filter-chip">Weather impact?</button></div><button className="ops-action-button" onClick={onGenerateBrief}>Generate brief</button></aside></section>
      <section className="aviation-command-surface">
        <div className="aviation-command-primary panel aviation-panel">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Start here</p>
              <h3>Operational Workflow</h3>
            </div>
            <span className={`aviation-risk-chip aviation-risk-${currentRisk.band.toLowerCase()}`}>Current risk {currentRisk.band}</span>
          </div>
          <p className="aviation-note compact">Use the guided flow below to build a trip plan, scan airport-adjacent facilities, review risk, and package a brief.</p>
          <div className="aviation-workflow-actions">
            <button type="button" className="ops-action-button" onClick={onPlanTrip}><span>1</span>Plan Trip</button>
            <button type="button" className="ops-action-button secondary" onClick={onOpenScanner}><span>2</span>Scan Airport</button>
            <button type="button" className="ops-action-button secondary" onClick={onGenerateBrief}><span>3</span>Generate Brief</button>
            <button type="button" className="ops-action-button ghost" onClick={onLaunchDemo}>Load Demo</button>
          </div>
        </div>

        <section className="aviation-kpi-grid aviation-executive-kpis" aria-label="Aviation command metrics">
          <article className="aviation-kpi-card"><span>Active Trips</span><strong>{activeTrips.length}</strong><small>{highRiskTrips.length} high-risk</small></article>
          <article className="aviation-kpi-card"><span>Open Actions</span><strong>{openActions.length}</strong><small>Across current and saved trips</small></article>
          <article className="aviation-kpi-card"><span>Airport Scan</span><strong>{nearbyFacilities.length}</strong><small>{airportsMonitored} saved airport(s)</small></article>
          <article className="aviation-kpi-card"><span>Live Watch</span><strong>{alertCount}</strong><small>{faaAlerts.length} FAA · {weatherAlerts.length} weather</small></article>
        </section>
      </section>

      <section className="panel aviation-panel">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Priority board</p>
            <h3>Trips Requiring Attention</h3>
          </div>
          <button type="button" className="ops-action-button secondary" onClick={onViewIntegrations}>Integration Status</button>
        </div>
        {boardTrips.length === 0 ? <p className="aviation-empty">No saved aviation trips yet. Plan a trip or launch the demo scenario to get started.</p> : <div className="aviation-trip-board">{boardTrips.map((trip) => {
          const openTripActions = trip.readiness_actions.filter((action) => !['Closed', 'Verified'].includes(action.status)).length;
          return <article key={trip.trip_id} className="aviation-trip-card">
            <div className="aviation-trip-card-main">
              <span className={`aviation-risk-chip aviation-risk-${trip.risk_band.toLowerCase()}`}>{trip.risk_band} · {trip.risk_score}</span>
              <div>
                <strong>{trip.trip_name}</strong>
                <p>{trip.airport_snapshot.faa_id ?? trip.airport_snapshot.airport_name} · {formatDate(trip.trip_start)} to {formatDate(trip.trip_end)}</p>
              </div>
            </div>
            <div className="aviation-trip-card-meta">
              <span><small>Radius</small>{trip.radius_miles} mi</span>
              <span><small>Actions</small>{openTripActions} open</span>
              <span><small>Status</small>{trip.status}</span>
            </div>
            <button type="button" className="ops-action-button secondary" onClick={() => onOpenTrip(trip)}>Open Trip</button>
          </article>;
        })}</div>}
      </section>

      <div className="aviation-two-column aviation-dashboard-support">
        <section className="panel aviation-panel">
          <div className="card-heading"><div><p className="eyebrow">Leadership review</p><h3>Highest-Risk Trips</h3></div></div>
          {highRiskTrips.length === 0 ? <p className="aviation-empty">No high-risk saved trips currently require leadership review.</p> : <div className="aviation-card-stack">{highRiskTrips.slice(0, 4).map((trip) => <article key={trip.trip_id} className="aviation-selected-card"><strong>{trip.trip_name}</strong><span>{trip.airport_snapshot.airport_name} · {trip.risk_band} ({trip.risk_score})</span></article>)}</div>}
        </section>
        <section className="panel aviation-panel">
          <div className="card-heading"><div><p className="eyebrow">Follow-up</p><h3>Open Readiness Actions</h3></div></div>
          {openActions.length === 0 ? <p className="aviation-empty">No open readiness actions. Generate actions from Risk when a scan is ready.</p> : <div className="aviation-card-stack">{openActions.slice(0, 5).map((action) => <article key={action.action_id} className="aviation-selected-card"><strong>{action.title}</strong><span>{action.owner_role} · {action.priority} · {action.status}</span></article>)}</div>}
        </section>
      </div>

      <section className="panel aviation-panel">
        <div className="card-heading"><div><p className="eyebrow">Watch items</p><h3>Selected Airport Alerts</h3></div></div>
        {alertCount === 0 ? <p className="aviation-empty">No relevant FAA or weather alerts found for the selected airport and trip window.</p> : <div className="aviation-alert-grid">{faaAlerts.slice(0, 3).map((alert) => <article key={alert.alert_id} className="aviation-alert-card"><strong>{alert.severity}: {alert.title}</strong><span>{alert.summary}</span></article>)}{weatherAlerts.slice(0, 3).map((alert) => <article key={alert.weather_alert_id} className="aviation-alert-card"><strong>{alert.severity}: {alert.alert_type}</strong><span>{alert.summary}</span></article>)}</div>}
      </section>
    </div>
  );
}
