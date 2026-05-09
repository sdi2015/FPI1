import seededFacilities from '../../data/facilities.json';
import { getAviationProvider } from './aviationProviderConfig';
import type { FacilityRiskBand, NormalizedFacility, ProviderSourceStatus } from '../types/aviation';

const allowedTypes = new Set<NormalizedFacility['facility_type']>(['Walmart Supercenter', 'Neighborhood Market', "Sam's Club", 'Distribution Center', 'Fulfillment Center', 'Corporate / Critical Support', 'Other']);
const riskBands = new Set<FacilityRiskBand>(['Low', 'Watch', 'Elevated', 'High', 'Critical', 'Unknown']);
const freshnessValues = new Set<ProviderSourceStatus>(['seeded_demo', 'live', 'verified', 'stale', 'missing', 'unknown']);

function asRecord(raw: unknown): Record<string, unknown> { return raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}; }
function asString(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value : fallback; }
function asNumber(value: unknown): number | null { if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value); return null; }

export function normalizeFacility(raw: unknown): NormalizedFacility {
  const item = asRecord(raw);
  const facilityType = asString(item.facility_type, 'Other') as NormalizedFacility['facility_type'];
  const riskScore = asNumber(item.facility_risk_score);
  const riskBand = asString(item.facility_risk_band, riskScore === null ? 'Unknown' : 'Low') as FacilityRiskBand;
  const epStatus = asString(item.ep_readiness_status, 'Unknown') as NormalizedFacility['ep_readiness_status'];
  const freshness = asString(item.source_freshness, 'seeded_demo') as ProviderSourceStatus;
  return { facility_id: asString(item.facility_id, `FAC-${Math.random().toString(36).slice(2, 8)}`), facility_number: asString(item.facility_number) || undefined, facility_name: asString(item.facility_name, 'Unknown facility'), facility_type: allowedTypes.has(facilityType) ? facilityType : 'Other', city: asString(item.city, 'Unknown city'), state: asString(item.state, 'Unknown state'), latitude: asNumber(item.latitude), longitude: asNumber(item.longitude), facility_risk_score: riskScore ?? 0, facility_risk_band: riskBands.has(riskBand) ? riskBand : 'Unknown', top_risk_driver: asString(item.top_risk_driver, riskScore === null ? 'Risk score missing from source' : 'No driver provided'), ep_readiness_status: ['Stable', 'Watch', 'Gap', 'Unknown', 'Restricted'].includes(epStatus) ? epStatus : 'Unknown', aviation_support_candidate: Boolean(item.aviation_support_candidate), source_freshness: freshnessValues.has(freshness) ? freshness : 'unknown' };
}

export function normalizeWalmartFacilityMasterRecord(raw: unknown): NormalizedFacility {
  const item = asRecord(raw);
  return normalizeFacility({ facility_id: item.facility_id ?? item.id ?? item.storeNumber, facility_number: item.facility_number ?? item.storeNumber, facility_name: item.facility_name ?? item.storeName ?? item.name, facility_type: item.facility_type ?? item.banner ?? 'Other', city: item.city, state: item.state, latitude: item.latitude ?? item.lat, longitude: item.longitude ?? item.lng, facility_risk_score: item.facility_risk_score ?? item.riskScore, facility_risk_band: item.facility_risk_band ?? item.riskTier, top_risk_driver: item.top_risk_driver ?? item.topDriver, ep_readiness_status: item.ep_readiness_status ?? item.epReadinessStatus, aviation_support_candidate: item.aviation_support_candidate ?? item.supportCandidate, source_freshness: item.source_freshness ?? 'live' });
}

export async function getFacilitiesFromSeededData(): Promise<NormalizedFacility[]> { return (seededFacilities as unknown[]).map(normalizeFacility); }
export async function getFacilitiesFromFacilityMasterStub(): Promise<NormalizedFacility[]> { return []; }
export async function fallbackToSeededFacilities(): Promise<NormalizedFacility[]> { return getFacilitiesFromSeededData(); }

export async function getFacilities(): Promise<NormalizedFacility[]> {
  const provider = getAviationProvider('facilityProvider');
  if (provider.mode === 'live_api' && provider.enabled) return getFacilitiesFromFacilityMasterStub();
  return fallbackToSeededFacilities();
}

export async function getFacilitiesForAviationScan(): Promise<NormalizedFacility[]> {
  return (await getFacilities()).filter((facility) => facility.latitude !== null && facility.longitude !== null);
}
