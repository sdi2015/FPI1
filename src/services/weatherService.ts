import seededWeatherAlerts from '../../data/aviation/weatherAlerts.json';
import { getAviationProvider } from './aviationProviderConfig';
import type { Airport, FacilityRiskBand, RiskBand, WeatherAlert } from '../types/aviation';

export type WeatherProviderResult = {
  alerts: WeatherAlert[];
  source: 'seeded_demo' | 'noaa_live' | 'manual' | 'unknown';
  last_updated: string;
  confidence: number;
  status: 'ok' | 'partial' | 'error' | 'no_data';
  error?: string;
};

function overlapsTrip(alert: WeatherAlert, tripStart?: string | null, tripEnd?: string | null): boolean {
  if (!tripStart || !tripEnd) return true;
  const alertStart = new Date(alert.effective_start).getTime();
  const alertEnd = new Date(alert.effective_end).getTime();
  const start = new Date(tripStart).getTime();
  const end = new Date(tripEnd).getTime();
  if ([alertStart, alertEnd, start, end].some(Number.isNaN)) return true;
  return alertStart <= end && alertEnd >= start;
}

export function mapNoaaSeverityToFpiRisk(rawSeverity: string): FacilityRiskBand {
  const value = rawSeverity.toLowerCase();
  if (value.includes('extreme') || value.includes('critical')) return 'Critical';
  if (value.includes('severe') || value.includes('high') || value.includes('warning')) return 'High';
  if (value.includes('elevated') || value.includes('watch')) return 'Elevated';
  if (value.includes('advisory') || value.includes('minor')) return 'Watch';
  if (value.includes('low') || value.includes('none')) return 'Low';
  return 'Unknown';
}

export function normalizeNoaaAlert(raw: unknown, airport: Airport): WeatherAlert {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const mapped = mapNoaaSeverityToFpiRisk(String(item.severity ?? item.event ?? 'Unknown'));
  const severity: RiskBand = mapped === 'Unknown' ? 'Watch' : mapped;
  return {
    weather_alert_id: String(item.weather_alert_id ?? item.id ?? `WX-${Date.now()}`),
    airport_id: airport.airport_id,
    affected_facility_ids: Array.isArray(item.affected_facility_ids) ? item.affected_facility_ids.map(String) : [],
    alert_type: String(item.alert_type ?? item.event ?? 'NOAA weather alert'),
    severity,
    summary: String(item.summary ?? item.description ?? 'NOAA live provider normalized item.'),
    effective_start: String(item.effective_start ?? item.onset ?? new Date().toISOString()),
    effective_end: String(item.effective_end ?? item.ends ?? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()),
    source: 'NOAA',
    source_url: typeof item.source_url === 'string' ? item.source_url : null,
    confidence: typeof item.confidence === 'number' ? item.confidence : 70,
    status: ['active', 'inactive', 'expired'].includes(String(item.status)) ? item.status as WeatherAlert['status'] : 'active',
  };
}

export async function getWeatherAlertsForAirportLive(airport: Airport, tripStart?: string | null, tripEnd?: string | null): Promise<WeatherProviderResult> {
  void tripStart; void tripEnd;
  return { alerts: [], source: 'noaa_live', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data', error: `Live NOAA provider is enabled for ${airport.airport_id}, but no approved endpoint is configured.` };
}

export async function fallbackToSeededWeather(airport: Airport, tripStart?: string | null, tripEnd?: string | null): Promise<WeatherProviderResult> {
  const provider = getAviationProvider('weatherProvider');
  const alerts = (seededWeatherAlerts as WeatherAlert[]).filter((alert) => alert.airport_id === airport.airport_id && overlapsTrip(alert, tripStart, tripEnd));
  return { alerts, source: 'seeded_demo', last_updated: new Date().toISOString(), confidence: alerts.length ? Math.round(alerts.reduce((sum, alert) => sum + alert.confidence, 0) / alerts.length) : provider.confidence, status: alerts.length ? 'ok' : 'no_data', error: provider.mode === 'live_api_pending' ? 'Live NOAA integration pending; using seeded fallback.' : undefined };
}

export async function getWeatherAlertsForAirport(airport: Airport, tripStart?: string | null, tripEnd?: string | null): Promise<WeatherProviderResult> {
  try {
    const provider = getAviationProvider('weatherProvider');
    if (provider.mode === 'live_api' && provider.enabled) return getWeatherAlertsForAirportLive(airport, tripStart, tripEnd);
    return fallbackToSeededWeather(airport, tripStart, tripEnd);
  } catch (error) {
    return { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'error', error: error instanceof Error ? error.message : 'Weather provider error' };
  }
}
