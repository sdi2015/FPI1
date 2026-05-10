import seededFAAAlerts from '../../data/aviation/faaAlerts.json';
import { buildQuery, tryAviationApiRequest } from './aviationApiClient';
import { getAviationProvider } from './aviationProviderConfig';
import type { FAAAlert, FacilityRiskBand, RiskBand } from '../types/aviation';

export type FAAProviderResult = {
  alerts: FAAAlert[];
  source: 'seeded_demo' | 'faa_live' | 'manual' | 'unknown';
  last_updated: string;
  confidence: number;
  status: 'ok' | 'partial' | 'error' | 'no_data';
  error?: string;
};

function overlapsTrip(alert: FAAAlert, tripStart?: string | null, tripEnd?: string | null): boolean {
  if (!tripStart || !tripEnd) return true;
  const alertStart = new Date(alert.effective_start).getTime();
  const alertEnd = new Date(alert.effective_end).getTime();
  const start = new Date(tripStart).getTime();
  const end = new Date(tripEnd).getTime();
  if ([alertStart, alertEnd, start, end].some(Number.isNaN)) return true;
  return alertStart <= end && alertEnd >= start;
}

export function mapFaaSeverityToFpiRisk(rawSeverity: string): FacilityRiskBand {
  const value = rawSeverity.toLowerCase();
  if (value.includes('critical') || value.includes('closed')) return 'Critical';
  if (value.includes('high') || value.includes('severe')) return 'High';
  if (value.includes('elevated') || value.includes('delay')) return 'Elevated';
  if (value.includes('watch') || value.includes('advisory')) return 'Watch';
  if (value.includes('low') || value.includes('normal')) return 'Low';
  return 'Unknown';
}

export function normalizeFaaAlert(raw: unknown, airportId: string): FAAAlert {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const mapped = mapFaaSeverityToFpiRisk(String(item.severity ?? item.status ?? 'Unknown'));
  const severity: RiskBand = mapped === 'Unknown' ? 'Watch' : mapped;
  return {
    alert_id: String(item.alert_id ?? item.id ?? `FAA-${Date.now()}`),
    airport_id: airportId,
    alert_type: String(item.alert_type ?? item.type ?? 'NOTAM'),
    severity,
    title: String(item.title ?? 'FAA/airport status item'),
    summary: String(item.summary ?? item.description ?? 'FAA live provider normalized item.'),
    effective_start: String(item.effective_start ?? item.start ?? new Date().toISOString()),
    effective_end: String(item.effective_end ?? item.end ?? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()),
    source: 'FAA',
    source_url: typeof item.source_url === 'string' ? item.source_url : null,
    confidence: typeof item.confidence === 'number' ? item.confidence : 70,
    status: ['active', 'inactive', 'expired'].includes(String(item.status)) ? item.status as FAAAlert['status'] : 'active',
  };
}

function normalizeFAAProviderResult(raw: unknown, airportId: string): FAAProviderResult {
  if (raw && typeof raw === 'object' && Array.isArray((raw as { alerts?: unknown }).alerts)) {
    const item = raw as Partial<FAAProviderResult> & { alerts: unknown[] };
    const alerts = item.alerts.map((alert) => normalizeFaaAlert(alert, airportId));
    return { alerts, source: 'faa_live', last_updated: String(item.last_updated ?? new Date().toISOString()), confidence: typeof item.confidence === 'number' ? item.confidence : 80, status: item.status ?? (alerts.length ? 'ok' : 'no_data'), error: item.error };
  }
  if (Array.isArray(raw)) {
    const alerts = raw.map((alert) => normalizeFaaAlert(alert, airportId));
    return { alerts, source: 'faa_live', last_updated: new Date().toISOString(), confidence: alerts.length ? 80 : 0, status: alerts.length ? 'ok' : 'no_data' };
  }
  return { alerts: [], source: 'faa_live', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data' };
}

export async function getFAAAlertsForAirportLive(airportId: string, tripStart?: string | null, tripEnd?: string | null): Promise<FAAProviderResult> {
  const raw = await tryAviationApiRequest<unknown>(`/aviation/faa/alerts${buildQuery({ airportId, start: tripStart, end: tripEnd })}`);
  if (raw) return normalizeFAAProviderResult(raw, airportId);
  return { alerts: [], source: 'faa_live', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data', error: `Live FAA/NOTAM provider is enabled for ${airportId}, but no approved endpoint is configured.` };
}

export async function fallbackToSeededFAA(airportId: string, tripStart?: string | null, tripEnd?: string | null): Promise<FAAProviderResult> {
  const provider = getAviationProvider('faaProvider');
  const alerts = (seededFAAAlerts as FAAAlert[]).filter((alert) => alert.airport_id === airportId && overlapsTrip(alert, tripStart, tripEnd));
  return { alerts, source: 'seeded_demo', last_updated: new Date().toISOString(), confidence: alerts.length ? Math.round(alerts.reduce((sum, alert) => sum + alert.confidence, 0) / alerts.length) : provider.confidence, status: alerts.length ? 'ok' : 'no_data', error: provider.mode === 'live_api_pending' ? 'Live FAA/NOTAM integration pending; using seeded fallback.' : undefined };
}

export async function getFAAAlertsForAirport(airportId: string, tripStart?: string | null, tripEnd?: string | null): Promise<FAAProviderResult> {
  try {
    const provider = getAviationProvider('faaProvider');
    if (provider.mode === 'live_api' && provider.enabled) return getFAAAlertsForAirportLive(airportId, tripStart, tripEnd);
    return fallbackToSeededFAA(airportId, tripStart, tripEnd);
  } catch (error) {
    return { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'error', error: error instanceof Error ? error.message : 'FAA provider error' };
  }
}
