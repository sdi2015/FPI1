import seededFacilities from '../../data/facilities.json';
import { buildQuery, tryAviationApiRequest } from './aviationApiClient';
import { getAviationProvider } from './aviationProviderConfig';
import { buildELMStoreLocationIndex, getELMStoreLocations, type ELMStoreLocation } from './elmStoreLocationService';
import type { FacilityRiskBand, NormalizedFacility, ProviderSourceStatus } from '../types/aviation';

const allowedTypes = new Set<NormalizedFacility['facility_type']>(['Walmart Supercenter', 'Neighborhood Market', "Sam's Club", 'Distribution Center', 'Fulfillment Center', 'Corporate / Critical Support', 'Other']);
const riskBands = new Set<FacilityRiskBand>(['Low', 'Watch', 'Elevated', 'High', 'Critical', 'Unknown']);
const freshnessValues = new Set<ProviderSourceStatus>(['seeded_demo', 'live', 'verified', 'stale', 'missing', 'unknown']);
const FPI_MASTER_URL = '/data/fpi-canonical-master.json';

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

function normalizeFacilityList(raw: unknown): NormalizedFacility[] {
  if (Array.isArray(raw)) return raw.map(normalizeWalmartFacilityMasterRecord);
  if (raw && typeof raw === 'object' && Array.isArray((raw as { facilities?: unknown }).facilities)) return (raw as { facilities: unknown[] }).facilities.map(normalizeWalmartFacilityMasterRecord);
  return [];
}

function mapFpiRiskBand(value: unknown): FacilityRiskBand {
  if (value === 'Critical') return 'Critical';
  if (value === 'High') return 'High';
  if (value === 'Medium') return 'Elevated';
  if (value === 'Low') return 'Low';
  return 'Unknown';
}

function mapFpiFacilityType(value: unknown): NormalizedFacility['facility_type'] {
  const text = asString(value, '').toLowerCase();
  if (text.includes('supercenter') || text.includes('store')) return 'Walmart Supercenter';
  if (text.includes('neighborhood')) return 'Neighborhood Market';
  if (text.includes('sam')) return "Sam's Club";
  if (text.includes('distribution') || text === 'dc') return 'Distribution Center';
  if (text.includes('fulfillment') || text === 'fc') return 'Fulfillment Center';
  if (text.includes('corporate') || text.includes('office')) return 'Corporate / Critical Support';
  return 'Other';
}

function deriveFpiDriver(item: Record<string, unknown>): string {
  const critical = asNumber(item.critical_task_count) ?? 0;
  const overdue = asNumber(item.overdue_task_count) ?? 0;
  const open = asNumber(item.open_task_count) ?? 0;
  if (critical > 0) return `${critical} critical FPI task(s) open`;
  if (overdue > 0) return `${overdue} overdue FPI task(s)`;
  if (open > 0) return `${open} open FPI task(s)`;
  return 'No major open FPI findings';
}

function mapELMPriorityToRisk(priority?: string): { score: number; band: FacilityRiskBand; ep: NormalizedFacility['ep_readiness_status'] } {
  const normalized = (priority ?? '').toLowerCase();
  if (normalized === 'high') return { score: 75, band: 'High', ep: 'Gap' };
  if (normalized === 'medium') return { score: 55, band: 'Elevated', ep: 'Watch' };
  if (normalized === 'low') return { score: 25, band: 'Low', ep: 'Stable' };
  return { score: 35, band: 'Watch', ep: 'Unknown' };
}

function normalizeELMStoreAsFacility(location: ELMStoreLocation): NormalizedFacility {
  const risk = mapELMPriorityToRisk(location.final_priority ?? location.google_priority);
  const name = location.location_name ? `${location.banner ?? 'Walmart'} ${location.location_name}` : `Walmart Store ${location.store_number}`;
  return normalizeFacility({
    facility_id: `WM-STORE-${location.store_number}`,
    facility_number: location.store_number,
    facility_name: name,
    facility_type: mapFpiFacilityType(location.banner),
    city: location.city,
    state: location.state,
    latitude: location.latitude,
    longitude: location.longitude,
    facility_risk_score: risk.score,
    facility_risk_band: risk.band,
    top_risk_driver: location.final_status ? `ELM location status: ${location.final_status}${location.final_priority ? ` (${location.final_priority})` : ''}` : 'ELM verified store location',
    ep_readiness_status: risk.ep,
    aviation_support_candidate: true,
    source_freshness: 'verified',
  });
}

function normalizeFpiFacilityWithELMLocation(raw: unknown, locationIndex: Map<string, { latitude: number; longitude: number; address?: string; city?: string; state?: string }>): NormalizedFacility | null {
  const item = asRecord(raw);
  const facilityId = asString(item.facility_id);
  if (!facilityId) return null;
  const location = locationIndex.get(facilityId) ?? locationIndex.get(facilityId.replace(/^0+/, ''));
  if (!location) return null;
  const riskScore = asNumber(item.risk_score) ?? 0;
  const riskBand = mapFpiRiskBand(item.risk_tier);
  return normalizeFacility({
    facility_id: `WM-STORE-${facilityId}`,
    facility_number: facilityId,
    facility_name: item.facility_name ?? `Store #${facilityId}`,
    facility_type: mapFpiFacilityType(item.banner),
    city: location.city ?? item.city,
    state: location.state ?? item.state,
    latitude: location.latitude,
    longitude: location.longitude,
    facility_risk_score: riskScore,
    facility_risk_band: riskBand,
    top_risk_driver: deriveFpiDriver(item),
    ep_readiness_status: riskBand === 'Critical' || riskBand === 'High' ? 'Gap' : riskBand === 'Elevated' ? 'Watch' : 'Stable',
    aviation_support_candidate: true,
    source_freshness: 'verified',
  });
}

function mergeFacilities(primary: NormalizedFacility[], fallback: NormalizedFacility[]): NormalizedFacility[] {
  const merged = new Map<string, NormalizedFacility>();
  for (const facility of [...fallback, ...primary]) merged.set(facility.facility_id, facility);
  return Array.from(merged.values());
}

export async function getFacilitiesFromSeededData(): Promise<NormalizedFacility[]> { return (seededFacilities as unknown[]).map(normalizeFacility); }
export async function getFacilitiesFromELMStoreLocations(): Promise<NormalizedFacility[]> { return (await getELMStoreLocations()).map(normalizeELMStoreAsFacility); }
export async function getFacilitiesFromFpiWithElmLocations(): Promise<NormalizedFacility[]> {
  try {
    const [locations, response] = await Promise.all([getELMStoreLocations(), fetch(FPI_MASTER_URL)]);
    if (!response.ok || locations.length === 0) return [];
    const raw = await response.json() as { facilities?: unknown[] };
    if (!Array.isArray(raw.facilities)) return [];
    const locationIndex = buildELMStoreLocationIndex(locations);
    return raw.facilities.map((facility) => normalizeFpiFacilityWithELMLocation(facility, locationIndex)).filter((facility): facility is NormalizedFacility => Boolean(facility));
  } catch {
    return [];
  }
}
export async function getFacilitiesFromFacilityMasterStub(): Promise<NormalizedFacility[]> {
  const raw = await tryAviationApiRequest<unknown>(`/aviation/facilities${buildQuery({ limit: 10000 })}`);
  return raw ? normalizeFacilityList(raw) : [];
}
export async function fallbackToSeededFacilities(): Promise<NormalizedFacility[]> { return getFacilitiesFromSeededData(); }

export async function getFacilities(): Promise<NormalizedFacility[]> {
  const provider = getAviationProvider('facilityProvider');
  if (provider.mode === 'live_api' && provider.enabled) {
    const liveFacilities = await getFacilitiesFromFacilityMasterStub();
    if (liveFacilities.length) return liveFacilities;
  }
  const [elmFacilities, fpiElmFacilities, seeded] = await Promise.all([getFacilitiesFromELMStoreLocations(), getFacilitiesFromFpiWithElmLocations(), fallbackToSeededFacilities()]);
  const enrichedFacilities = mergeFacilities(fpiElmFacilities, elmFacilities);
  return enrichedFacilities.length ? mergeFacilities(enrichedFacilities, seeded) : seeded;
}

export async function getFacilitiesForAviationScan(): Promise<NormalizedFacility[]> {
  return (await getFacilities()).filter((facility) => facility.latitude !== null && facility.longitude !== null);
}
