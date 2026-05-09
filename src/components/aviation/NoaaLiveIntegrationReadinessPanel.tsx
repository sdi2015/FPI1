import { getAviationProvider } from '../../services/aviationProviderConfig';

const requiredConfig = ['VITE_NOAA_ALERTS_ENDPOINT or approved proxy URL', 'NOAA user-agent/contact value if required by endpoint', 'Airport lat/long source from static airport JSON', 'Timeout, retry, and fallback-to-seeded policy', 'Cache duration / refresh cadence', 'Attribution and operational caveat text'];
const LAST_SUCCESS_KEY = 'fpi_aviation_noaa_last_successful_fetch';

function getLastSuccessfulFetch(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LAST_SUCCESS_KEY);
}

export function NoaaLiveIntegrationReadinessPanel() {
  const provider = getAviationProvider('weatherProvider');
  const liveEnabled = provider.mode === 'live_api' && provider.enabled;
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">NOAA-first live source</p><h3>NOAA Live Integration Readiness</h3></div><span className={`aviation-badge aviation-badge-${provider.mode}`}>{provider.mode}</span></div><div className="aviation-detail-grid"><article className="aviation-selected-card"><span className="eyebrow">Provider Status</span><strong>{provider.status}</strong><span>{provider.source_label}</span><p>{provider.notes}</p></article><article className="aviation-selected-card"><span className="eyebrow">Live API Guard</span><strong>{liveEnabled ? 'Live mode explicitly enabled' : 'Live mode disabled by default'}</strong><span>{liveEnabled ? 'Weather service may call live stub/endpoint if configured.' : 'Weather service uses seeded fallback and must not call NOAA live APIs.'}</span></article><article className="aviation-selected-card"><span className="eyebrow">Last Successful Fetch</span><strong>{getLastSuccessfulFetch() ?? 'None recorded'}</strong><span>Recorded only if future live mode successfully fetches NOAA data.</span></article></div><div className="aviation-table-wrap"><table className="aviation-table"><thead><tr><th>Required endpoint/config value</th><th>Status</th></tr></thead><tbody>{requiredConfig.map((item) => <tr key={item}><td>{item}</td><td><span className="aviation-badge aviation-status-pending">pending approval</span></td></tr>)}</tbody></table></div><p className="aviation-caveat">Fallback behavior: if provider mode is seeded_demo, live_api_pending, unavailable, disabled, or live fetch fails, the weather service returns seeded NOAA demo alerts with caveats. No live NOAA API is called unless weatherProvider.mode is live_api and enabled.</p></section>;
}
