import { tryAviationApiRequest } from './aviationApiClient';
import type { Airport, FAAAlert, FacilityWithDistance, TripReadinessAction, TripRiskResult, WeatherAlert } from '../types/aviation';

export async function scoreTripWithAviationApi(input: { nearbyFacilities: FacilityWithDistance[]; faaAlerts: FAAAlert[]; weatherAlerts: WeatherAlert[]; airport: Airport | null; tripId?: string | null }): Promise<TripRiskResult | null> {
  return tryAviationApiRequest<TripRiskResult>('/aviation/risk/score-trip', { method: 'POST', body: input });
}

export async function generateReadinessActionsWithAviationApi(input: { tripId: string; nearbyFacilities: FacilityWithDistance[]; faaAlerts: FAAAlert[]; weatherAlerts: WeatherAlert[]; risk: TripRiskResult }): Promise<TripReadinessAction[] | null> {
  const result = await tryAviationApiRequest<unknown>(`/aviation/trips/${encodeURIComponent(input.tripId)}/readiness-actions/generate`, { method: 'POST', body: input });
  if (Array.isArray(result)) return result as TripReadinessAction[];
  if (result && typeof result === 'object' && Array.isArray((result as { actions?: unknown }).actions)) return (result as { actions: TripReadinessAction[] }).actions;
  return null;
}

export async function createOfficialTripBrief(input: { tripId: string; brief: string; format?: 'text' | 'markdown' }): Promise<{ brief_id: string; export_url?: string } | null> {
  return tryAviationApiRequest<{ brief_id: string; export_url?: string }>(`/aviation/trips/${encodeURIComponent(input.tripId)}/briefs`, { method: 'POST', body: input });
}

export async function requestOfficialBriefExport(briefId: string, format: 'txt' | 'pdf' | 'docx' = 'txt'): Promise<{ url?: string; content?: string } | null> {
  return tryAviationApiRequest<{ url?: string; content?: string }>(`/aviation/briefs/${encodeURIComponent(briefId)}/export?format=${encodeURIComponent(format)}`);
}
