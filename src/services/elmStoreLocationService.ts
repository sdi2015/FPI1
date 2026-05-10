export type ELMStoreLocation = {
  store_number: string;
  facility_id?: string;
  banner?: string;
  location_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude: number;
  longitude: number;
  final_status?: string;
  final_priority?: string;
  final_notes?: string;
  google_status?: string;
  google_priority?: string;
  source?: string;
  last_updated?: string;
};

const ELM_LOCATION_URL = '/data/elm-store-locations.json';

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function firstString(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(item[key]);
    if (value) return value;
  }
  return undefined;
}

function firstNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(item[key]);
    if (value !== null) return value;
  }
  return null;
}

export function normalizeELMStoreLocation(raw: unknown): ELMStoreLocation | null {
  const item = asRecord(raw);
  const storeNumber = firstString(item, ['store_number', 'storeNumber', 'store_num', 'store', 'facility_number', 'facilityNumber', 'facility_id', 'Location', 'location']);
  const latitude = firstNumber(item, ['latitude', 'lat', 'Latitude', 'LATITUDE']);
  const longitude = firstNumber(item, ['longitude', 'lng', 'lon', 'Longitude', 'LONGITUDE']);

  if (!storeNumber || latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    store_number: storeNumber.replace(/^Store\s*#/i, '').trim(),
    facility_id: firstString(item, ['facility_id', 'facilityId', 'store_id', 'storeId']),
    banner: firstString(item, ['banner', 'banner_desc', 'Banner Desc']),
    location_name: firstString(item, ['location_name', 'Location Name', 'facility_name', 'storeName', 'name']),
    address: firstString(item, ['address', 'Address', 'street_address', 'streetAddress', 'Physical Address Line 1']),
    city: firstString(item, ['city', 'City', 'Physical City']),
    state: firstString(item, ['state', 'State', 'Physical State']),
    zip_code: firstString(item, ['zip_code', 'Physical Zip Code', 'zip']),
    latitude,
    longitude,
    final_status: firstString(item, ['final_status', 'Final_Status_v6', 'status']),
    final_priority: firstString(item, ['final_priority', 'Final_Priority_v6', 'priority']),
    final_notes: firstString(item, ['final_notes', 'Final_Notes_v6', 'notes']),
    google_status: firstString(item, ['google_status', 'Google_Status']),
    google_priority: firstString(item, ['google_priority', 'Google_Priority']),
    source: firstString(item, ['source', 'Source']) ?? 'ELM store-location export',
    last_updated: firstString(item, ['last_updated', 'lastUpdated', 'updated_at', 'updatedAt']),
  };
}

function normalizeELMStoreLocationList(raw: unknown): ELMStoreLocation[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { stores?: unknown[] })?.stores) ? (raw as { stores: unknown[] }).stores : Array.isArray((raw as { locations?: unknown[] })?.locations) ? (raw as { locations: unknown[] }).locations : [];
  return rows.map(normalizeELMStoreLocation).filter((location): location is ELMStoreLocation => Boolean(location));
}

export async function getELMStoreLocations(): Promise<ELMStoreLocation[]> {
  try {
    const response = await fetch(ELM_LOCATION_URL);
    if (!response.ok) return [];
    return normalizeELMStoreLocationList(await response.json());
  } catch {
    return [];
  }
}

export function buildELMStoreLocationIndex(locations: ELMStoreLocation[]): Map<string, ELMStoreLocation> {
  const index = new Map<string, ELMStoreLocation>();
  for (const location of locations) {
    index.set(location.store_number, location);
    index.set(location.store_number.replace(/^0+/, ''), location);
    if (location.facility_id) {
      index.set(location.facility_id, location);
      index.set(location.facility_id.replace(/^Store\s*#/i, '').replace(/^0+/, ''), location);
    }
  }
  return index;
}
