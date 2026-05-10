import { getAviationPersistenceMode, isAviationApiEnabled, isAviationLiveProviderEnabled } from './aviationRuntimeConfig';

export type AviationProviderMode = 'seeded_demo' | 'static_json' | 'localStorage' | 'live_api_pending' | 'live_api' | 'unavailable' | 'unknown';
export type AviationProviderStatus = 'ok' | 'partial' | 'missing' | 'error' | 'stale' | 'disabled' | 'pending';
export type AviationProviderName = 'airportProvider' | 'facilityProvider' | 'fpiRiskProvider' | 'faaProvider' | 'weatherProvider' | 'routingProvider' | 'epReadinessProvider' | 'incidentProvider' | 'persistenceProvider' | 'auditProvider';

export type AviationProviderConfigItem = {
  provider_name: AviationProviderName;
  display_name: string;
  mode: AviationProviderMode;
  status: AviationProviderStatus;
  source_label: string;
  last_updated: string | null;
  confidence: number;
  enabled: boolean;
  notes: string;
  next_step: string;
};

export const aviationProviderConfig: Record<AviationProviderName, AviationProviderConfigItem> = {
  airportProvider: { provider_name: 'airportProvider', display_name: 'Airport Data', mode: 'static_json', status: 'ok', source_label: 'Runtime-loaded static airport JSON', last_updated: null, confidence: 85, enabled: true, notes: 'Airport data is lazy-loaded from public/data/aviation/airports.json.', next_step: 'Confirm approved airport data source and refresh cadence.' },
  facilityProvider: { provider_name: 'facilityProvider', display_name: 'Walmart Facility Data', mode: 'seeded_demo', status: 'partial', source_label: 'Seeded demo facilities', last_updated: null, confidence: 60, enabled: true, notes: 'Using demo facility records until Walmart facility master integration is approved.', next_step: 'Connect to approved Walmart facility master source.' },
  fpiRiskProvider: { provider_name: 'fpiRiskProvider', display_name: 'FPI Facility Risk Posture', mode: 'seeded_demo', status: 'partial', source_label: 'Seeded FPI risk posture', last_updated: null, confidence: 60, enabled: true, notes: 'Using seeded risk scores and drivers.', next_step: 'Connect to real FPI facility risk/posture data.' },
  faaProvider: { provider_name: 'faaProvider', display_name: 'FAA / NOTAM Data', mode: 'seeded_demo', status: 'partial', source_label: 'Seeded FAA watch items', last_updated: null, confidence: 60, enabled: true, notes: 'Live FAA/NOTAM integration is not active.', next_step: 'Confirm approved FAA/NOTAM API or data source.' },
  weatherProvider: { provider_name: 'weatherProvider', display_name: 'NOAA Weather Data', mode: 'seeded_demo', status: 'partial', source_label: 'Seeded NOAA weather alerts', last_updated: null, confidence: 60, enabled: true, notes: 'Live NOAA integration is not active.', next_step: 'Confirm approved NOAA weather endpoint and refresh cadence.' },
  routingProvider: { provider_name: 'routingProvider', display_name: 'Drive-Time / Routing Data', mode: 'live_api_pending', status: 'pending', source_label: 'Estimated straight-line drive time', last_updated: null, confidence: 50, enabled: true, notes: 'Drive time is estimated from straight-line distance.', next_step: 'Connect approved routing provider.' },
  epReadinessProvider: { provider_name: 'epReadinessProvider', display_name: 'Executive Protection Readiness', mode: 'seeded_demo', status: 'partial', source_label: 'Seeded EP readiness fields', last_updated: null, confidence: 60, enabled: true, notes: 'EP readiness is currently derived from seeded facility fields.', next_step: 'Connect approved EP readiness/checklist data source.' },
  incidentProvider: { provider_name: 'incidentProvider', display_name: 'Incident / Safety Data', mode: 'unavailable', status: 'missing', source_label: 'Not connected', last_updated: null, confidence: 0, enabled: false, notes: 'Incident/safety integration is not yet connected.', next_step: 'Identify approved incident/safety data source.' },
  persistenceProvider: { provider_name: 'persistenceProvider', display_name: 'Saved Trip Persistence', mode: 'localStorage', status: 'ok', source_label: 'Browser localStorage', last_updated: null, confidence: 70, enabled: true, notes: 'Saved trips persist locally for prototype/demo use.', next_step: 'Move to production persistence layer.' },
  auditProvider: { provider_name: 'auditProvider', display_name: 'Audit Logging', mode: 'localStorage', status: 'partial', source_label: 'Local audit log', last_updated: null, confidence: 70, enabled: true, notes: 'Audit events are stored locally during Phase 2.', next_step: 'Move to production audit/event logging service.' },
};

function withRuntimeOverrides(provider: AviationProviderConfigItem): AviationProviderConfigItem {
  if (provider.provider_name === 'faaProvider' && isAviationLiveProviderEnabled('faa')) return { ...provider, mode: 'live_api', status: 'pending', source_label: 'Aviation API FAA/NOTAM endpoint', notes: 'Live FAA/NOTAM path is enabled through the configured Aviation API.' };
  if (provider.provider_name === 'weatherProvider' && isAviationLiveProviderEnabled('weather')) return { ...provider, mode: 'live_api', status: 'pending', source_label: 'Aviation API NOAA/weather endpoint', notes: 'Live NOAA/weather path is enabled through the configured Aviation API.' };
  if (provider.provider_name === 'facilityProvider' && isAviationLiveProviderEnabled('facilities')) return { ...provider, mode: 'live_api', status: 'pending', source_label: 'Aviation API facility endpoint', notes: 'Live facility master path is enabled through the configured Aviation API.' };
  if (provider.provider_name === 'routingProvider' && isAviationLiveProviderEnabled('routing')) return { ...provider, mode: 'live_api', status: 'pending', source_label: 'Aviation API routing endpoint', notes: 'Live routing path is enabled through the configured Aviation API.' };
  if ((provider.provider_name === 'persistenceProvider' || provider.provider_name === 'auditProvider') && isAviationApiEnabled() && getAviationPersistenceMode() === 'api') return { ...provider, mode: 'live_api', status: 'pending', source_label: 'Configured Aviation API', notes: 'Aviation persistence/audit calls are routed through the configured API with local fallback unless API is required.' };
  return provider;
}

export function getAviationProviderConfig(): AviationProviderConfigItem[] {
  return Object.values(aviationProviderConfig).map(withRuntimeOverrides);
}

export function getAviationProvider(providerName: AviationProviderName): AviationProviderConfigItem {
  return withRuntimeOverrides(aviationProviderConfig[providerName]);
}

export function isProviderLive(providerName: AviationProviderName): boolean {
  const provider = getAviationProvider(providerName);
  return provider.mode === 'live_api' && provider.enabled;
}

export function isProviderEnabled(providerName: AviationProviderName): boolean {
  return getAviationProvider(providerName).enabled;
}
