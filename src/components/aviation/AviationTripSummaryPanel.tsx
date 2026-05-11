import { getRiskBadgeClass } from '../../services/aviationTravelRiskReportService';
import type { Airport, FacilityWithDistance, TripReadinessAction, TripRiskResult } from '../../types/aviation';

function dateText(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function airportCodes(airport: Airport | null): string {
  if (!airport) return 'Not selected';
  return [airport.iata_code, airport.icao_code, airport.faa_id ? `FAA: ${airport.faa_id}` : null].filter(Boolean).join(' / ') || 'Codes unavailable';
}

export function AviationTripSummaryPanel({ tripName, airport, radiusMiles, selectedFacilityTypes, travelerType, tripStart, tripEnd, scanHasRun, lastScannedAt, risk, nearbyFacilities, faaCount, weatherCount, readinessActions, onLaunchDemo }: { tripName: string; airport: Airport | null; radiusMiles: number; selectedFacilityTypes: string[]; travelerType: string; tripStart: string; tripEnd: string; scanHasRun: boolean; lastScannedAt: string | null; risk: TripRiskResult; nearbyFacilities: FacilityWithDistance[]; faaCount: number; weatherCount: number; readinessActions: TripReadinessAction[]; onLaunchDemo: () => void }) {
  const openActions = readinessActions.filter((action) => action.status !== 'Closed').length;
  const riskBand = scanHasRun ? risk.band : 'Pending';
  const drivers = scanHasRun ? (risk.drivers.length ? risk.drivers : risk.risk_drivers.map((driver) => driver.label)).slice(0, 5) : [];

  if (!tripName.trim()) {
    return <section className="panel aviation-panel aviation-trip-summary-panel"><div className="card-heading"><div><p className="eyebrow">Trip</p><h2>Trip Summary</h2></div></div><p className="aviation-empty">No trip selected. Create a new trip or launch the demo scenario.</p><button type="button" className="ops-action-button secondary" onClick={onLaunchDemo}>Launch Demo Scenario</button></section>;
  }

  return (
    <section className="panel aviation-panel aviation-trip-summary-panel">
      <div className="card-heading"><div><p className="eyebrow">Trip</p><h2>Trip Summary</h2></div><span className={getRiskBadgeClass(riskBand)}>{riskBand}</span></div>
      {!airport ? <p className="aviation-empty">Select an airport to begin the travel readiness workflow.</p> : null}
      {airport && !scanHasRun ? <p className="aviation-empty">Run scan to populate nearby facilities, FAA/NOAA watch items, and trip risk.</p> : null}
      <div className="aviation-report-grid aviation-trip-summary-grid">
        <Metric label="Trip name" value={tripName || 'Draft trip'} />
        <Metric label="Selected airport" value={airport?.airport_name ?? 'Not selected'} />
        <Metric label="Airport code" value={airportCodes(airport)} />
        <Metric label="City/state" value={airport ? `${airport.city}, ${airport.state}` : 'Not selected'} />
        <Metric label="Trip start" value={dateText(tripStart)} />
        <Metric label="Trip end" value={dateText(tripEnd)} />
        <Metric label="Radius" value={`${radiusMiles} miles`} />
        <Metric label="Facility type filters" value={selectedFacilityTypes.length ? selectedFacilityTypes.join(', ') : 'All facility types'} />
        <Metric label="Traveler type" value={travelerType} />
        <Metric label="Scan status" value={scanHasRun ? 'Complete' : 'Pending'} />
        <Metric label="Last scanned" value={dateText(lastScannedAt)} />
        <Metric label="Overall risk" value={riskBand} />
        <Metric label="Risk score" value={scanHasRun ? String(risk.score) : 'Pending'} />
        <Metric label="Confidence" value={scanHasRun ? `${risk.confidence}%` : 'Pending'} />
        <Metric label="Facilities inside radius" value={scanHasRun ? String(nearbyFacilities.length) : 'Pending'} />
        <Metric label="FAA watch items" value={scanHasRun ? String(faaCount) : 'Pending'} />
        <Metric label="NOAA weather alerts" value={scanHasRun ? String(weatherCount) : 'Pending'} />
        <Metric label="Open readiness actions" value={String(openActions)} />
      </div>
      <section className="aviation-report-section compact"><h3>Primary risk drivers</h3>{drivers.length ? <div className="aviation-risk-driver-cards">{drivers.map((driver) => <article key={driver}>{driver}</article>)}</div> : <p className="aviation-empty">Risk drivers will populate after scan.</p>}</section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="aviation-trip-metric"><span>{label}</span><strong>{value}</strong></article>;
}
