import type { FpiFacility, FpiProgramData, FpiRiskTier } from './fpiTypes';

type RawElmLocation = Record<string, unknown>;

const ELM_SOURCE = 'ELM location intelligence';

export function mergeElmLocationsIntoFpiProgram(programData: FpiProgramData, rawLocations: unknown): FpiProgramData {
  const locations = normalizeElmLocations(rawLocations);
  if (!locations.length) return programData;

  const facilitiesById = new Map(programData.facilities.map((facility) => [facility.facilityId, facility]));

  for (const location of locations) {
    const existing = facilitiesById.get(location.facilityId);
    facilitiesById.set(location.facilityId, existing ? enrichFacility(existing, location) : location);
  }

  return {
    ...programData,
    metadata: {
      ...programData.metadata,
      datasetName: `${programData.metadata.datasetName} + ELM Locations Master`,
      region: `${programData.metadata.region} + national ELM location inventory`,
    },
    facilities: Array.from(facilitiesById.values()).sort(sortFacilities),
  };
}

function normalizeElmLocations(raw: unknown): FpiFacility[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { locations?: unknown[] }).locations)
      ? (raw as { locations: unknown[] }).locations
      : [];

  return rows.map(normalizeElmLocation).filter((facility): facility is FpiFacility => Boolean(facility));
}

function normalizeElmLocation(raw: unknown): FpiFacility | null {
  const item = asRecord(raw);
  const storeNumber = asString(item.store_number) || asString(item.facility_id);
  const latitude = asNumber(item.latitude);
  const longitude = asNumber(item.longitude);
  if (!storeNumber || latitude === null || longitude === null) return null;

  const finalPriority = asString(item.final_priority);
  const googlePriority = asString(item.google_priority);
  const riskTier = priorityToRiskTier(finalPriority || googlePriority);
  const locationName = asString(item.location_name);
  const banner = asString(item.banner) || 'Walmart';

  return {
    facilityId: storeNumber,
    facilityName: locationName ? `${banner} ${locationName}` : `Walmart Store ${storeNumber}`,
    market: asString(item.market) || 'ELM National Inventory',
    region: asString(item.region) || 'ELM Location Master',
    division: asString(item.division) || 'Store Operations',
    city: asString(item.city) || 'Unknown',
    state: asString(item.state) || 'Unknown',
    address: asString(item.address) || undefined,
    latitude,
    longitude,
    locationSource: asString(item.source) || ELM_SOURCE,
    locationName: locationName || undefined,
    zipCode: asString(item.zip_code) || undefined,
    finalStatus: asString(item.final_status) || undefined,
    finalPriority: finalPriority || undefined,
    finalNotes: asString(item.final_notes) || undefined,
    googleStatus: asString(item.google_status) || undefined,
    googlePriority: googlePriority || undefined,
    banner,
    riskScore: priorityToRiskScore(finalPriority || googlePriority),
    riskTier,
  };
}

function enrichFacility(existing: FpiFacility, elm: FpiFacility): FpiFacility {
  const priority = elm.finalPriority || elm.googlePriority;
  return {
    ...existing,
    facilityName: existing.facilityName || elm.facilityName,
    city: elm.city !== 'Unknown' ? elm.city : existing.city,
    state: elm.state !== 'Unknown' ? elm.state : existing.state,
    address: elm.address ?? existing.address,
    latitude: elm.latitude ?? existing.latitude,
    longitude: elm.longitude ?? existing.longitude,
    locationSource: elm.locationSource ?? existing.locationSource,
    locationName: elm.locationName ?? existing.locationName,
    zipCode: elm.zipCode ?? existing.zipCode,
    finalStatus: elm.finalStatus ?? existing.finalStatus,
    finalPriority: elm.finalPriority ?? existing.finalPriority,
    finalNotes: elm.finalNotes ?? existing.finalNotes,
    googleStatus: elm.googleStatus ?? existing.googleStatus,
    googlePriority: elm.googlePriority ?? existing.googlePriority,
    banner: existing.banner !== 'Unknown' ? existing.banner : elm.banner,
    riskScore: Math.max(existing.riskScore, priority ? priorityToRiskScore(priority) : 0),
    riskTier: maxRiskTier(existing.riskTier, elm.riskTier),
  };
}

function priorityToRiskTier(priority: string): FpiRiskTier {
  const normalized = priority.toLowerCase();
  if (normalized === 'high') return 'High';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'low') return 'Low';
  return 'Unknown';
}

function priorityToRiskScore(priority: string): number {
  const normalized = priority.toLowerCase();
  if (normalized === 'high') return 75;
  if (normalized === 'medium') return 55;
  if (normalized === 'low') return 25;
  return 35;
}

function maxRiskTier(a: FpiRiskTier, b: FpiRiskTier): FpiRiskTier {
  return riskWeight(b) > riskWeight(a) ? b : a;
}

function riskWeight(tier: FpiRiskTier): number {
  if (tier === 'Critical') return 4;
  if (tier === 'High') return 3;
  if (tier === 'Medium') return 2;
  if (tier === 'Low') return 1;
  return 0;
}

function sortFacilities(a: FpiFacility, b: FpiFacility): number {
  return numericId(a.facilityId) - numericId(b.facilityId) || a.facilityId.localeCompare(b.facilityId);
}

function numericId(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function asRecord(raw: unknown): RawElmLocation {
  return raw && typeof raw === 'object' ? raw as RawElmLocation : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
