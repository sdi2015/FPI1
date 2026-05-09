import { getAviationPilotConfig } from '../../services/aviationPilotConfig';
import { getAviationProviderConfig } from '../../services/aviationProviderConfig';

export function AviationPilotBanner() {
  const config = getAviationPilotConfig();
  const modes = Array.from(new Set(getAviationProviderConfig().map((provider) => provider.mode))).join(', ');
  return (
    <section className="panel aviation-panel aviation-pilot-banner">
      <div className="card-heading"><div><p className="eyebrow">FPI Aviation Travel Readiness — Controlled Pilot Mode</p><h3>{config.pilot_name}</h3></div><span className="mode-pill">{config.environment_mode}</span></div>
      <p><strong>Owner:</strong> {config.pilot_owner_role}</p>
      <p><strong>Data limitations:</strong> Allowed data sources are {config.allowed_data_sources.join(', ')}. Current provider modes: {modes}. Sensitive traveler/EP categories remain restricted.</p>
      <p><strong>Human decision authority:</strong> {config.human_decision_authority}</p>
      <p><strong>Source caveat:</strong> Data may include seeded, static, local, estimated, missing, stale, or provider-controlled sources. {config.advisory_disclaimer}</p>
    </section>
  );
}
