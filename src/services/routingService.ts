import { tryAviationApiRequest } from './aviationApiClient';
import { getAviationProvider } from './aviationProviderConfig';

export type RoutingProviderResult = {
  drive_time_minutes: number | null;
  distance_miles: number | null;
  source: 'estimated' | 'routing_live' | 'unavailable' | 'unknown';
  confidence: number;
  status: 'ok' | 'partial' | 'error' | 'no_data';
  caveat: string;
};

export function estimateDriveTimeMinutes(distanceMiles: number): number {
  const averageSpeedMph = 35;
  return Math.max(5, Math.round((distanceMiles / averageSpeedMph) * 60));
}

export async function getDriveTimeEstimate(distanceMiles: number): Promise<RoutingProviderResult> {
  const provider = getAviationProvider('routingProvider');
  if (!provider.enabled || provider.mode === 'unavailable') return { drive_time_minutes: null, distance_miles: distanceMiles, source: 'unavailable', confidence: 0, status: 'no_data', caveat: 'Routing provider is unavailable.' };
  return { drive_time_minutes: estimateDriveTimeMinutes(distanceMiles), distance_miles: distanceMiles, source: 'estimated', confidence: provider.confidence, status: 'partial', caveat: 'Estimated from straight-line distance. Routing integration pending.' };
}

export async function getDriveTimeFromRoutingProviderStub(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): Promise<RoutingProviderResult> {
  const provider = getAviationProvider('routingProvider');
  if (provider.mode !== 'live_api' || !provider.enabled) return { drive_time_minutes: null, distance_miles: null, source: 'unavailable', confidence: provider.confidence, status: 'no_data', caveat: 'Live routing is not enabled.' };
  const result = await tryAviationApiRequest<unknown>('/aviation/routing/drive-time', { method: 'POST', body: { origin, destination } });
  return result ? normalizeRoutingResult(result) : normalizeRoutingResult({ origin, destination, status: 'no_data' });
}

export function normalizeRoutingResult(raw: unknown): RoutingProviderResult {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const minutes = typeof item.drive_time_minutes === 'number' ? item.drive_time_minutes : null;
  const miles = typeof item.distance_miles === 'number' ? item.distance_miles : null;
  return { drive_time_minutes: minutes, distance_miles: miles, source: 'routing_live', confidence: minutes ? 85 : 0, status: minutes ? 'ok' : 'no_data', caveat: minutes ? 'Live routing provider response.' : 'Routing live provider stub has no configured endpoint.' };
}
