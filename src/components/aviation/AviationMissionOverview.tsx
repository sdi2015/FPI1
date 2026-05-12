import type { FAAAlert, FacilityWithDistance, TripReadinessAction, TripRiskResult, WeatherAlert } from '../../types/aviation';

function MetricCard({ label, value, helper, tone }: { label: string; value: string | number; helper?: string; tone?: string }) {
  return <article className={`aviation-mission-kpi${tone ? ` ${tone}` : ''}`}><span>{label}</span><strong>{value}</strong>{helper ? <small>{helper}</small> : null}</article>;
}

export function AviationMissionOverview({
  facilities,
  risk,
  faaAlerts,
  weatherAlerts,
  actions,
  briefGenerated,
}: {
  facilities: FacilityWithDistance[];
  risk: TripRiskResult;
  faaAlerts: FAAAlert[];
  weatherAlerts: WeatherAlert[];
  actions: TripReadinessAction[];
  briefGenerated: boolean;
}) {
  const riskTone = `risk-${risk.band.toLowerCase()}`;
  return (
    <section className="aviation-mission-overview" aria-label="Mission overview">
      <MetricCard label="Facilities in Radius" value={facilities.length} helper="Walmart locations found" />
      <MetricCard label="Trip Risk" value={risk.score ? `${risk.score}/100` : 'Pending'} helper={risk.band} tone={riskTone} />
      <MetricCard label="FAA Watch Items" value={faaAlerts.length} helper="Airport/NOTAM signals" />
      <MetricCard label="Weather Alerts" value={weatherAlerts.length} helper="NOAA seeded/demo" />
      <MetricCard label="Open Readiness Actions" value={actions.filter((action) => !['Closed', 'Verified'].includes(action.status)).length} helper={`${actions.length} total`} />
      <MetricCard label="Brief Generated" value={briefGenerated ? 'Yes' : 'No'} helper={briefGenerated ? 'Ready to copy/export' : 'Generate after review'} />
    </section>
  );
}
