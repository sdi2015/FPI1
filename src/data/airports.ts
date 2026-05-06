// Mid-Atlantic / Walmart Region 75 relevant airports — IATA -> details.
// Includes a couple of nearby major hubs (DCA, IAD, BWI) plus regional
// fields that Walmart EP teams actually fly into for VA/MD store visits.

export type Airport = {
  iata: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export const AIRPORTS: Record<string, Airport> = {
  DCA: { iata: 'DCA', name: 'Ronald Reagan Washington National',  city: 'Arlington',     state: 'VA', latitude: 38.8512, longitude: -77.0402 },
  IAD: { iata: 'IAD', name: 'Washington Dulles International',     city: 'Sterling',      state: 'VA', latitude: 38.9531, longitude: -77.4565 },
  BWI: { iata: 'BWI', name: 'Baltimore/Washington International',  city: 'Baltimore',     state: 'MD', latitude: 39.1774, longitude: -76.6684 },
  RIC: { iata: 'RIC', name: 'Richmond International',              city: 'Sandston',      state: 'VA', latitude: 37.5052, longitude: -77.3197 },
  ORF: { iata: 'ORF', name: 'Norfolk International',               city: 'Norfolk',       state: 'VA', latitude: 36.8946, longitude: -76.2012 },
  PHF: { iata: 'PHF', name: 'Newport News/Williamsburg Intl',      city: 'Newport News',  state: 'VA', latitude: 37.1319, longitude: -76.4930 },
  ROA: { iata: 'ROA', name: 'Roanoke-Blacksburg Regional',         city: 'Roanoke',       state: 'VA', latitude: 37.3255, longitude: -79.9754 },
  LYH: { iata: 'LYH', name: 'Lynchburg Regional',                  city: 'Lynchburg',     state: 'VA', latitude: 37.3267, longitude: -79.2004 },
  SBY: { iata: 'SBY', name: 'Salisbury Regional',                  city: 'Salisbury',     state: 'MD', latitude: 38.3405, longitude: -75.5103 },
  HGR: { iata: 'HGR', name: 'Hagerstown Regional',                 city: 'Hagerstown',    state: 'MD', latitude: 39.7079, longitude: -77.7295 },
  PHL: { iata: 'PHL', name: 'Philadelphia International',          city: 'Philadelphia',  state: 'PA', latitude: 39.8729, longitude: -75.2437 },
  CHO: { iata: 'CHO', name: 'Charlottesville-Albemarle',           city: 'Charlottesville', state: 'VA', latitude: 38.1386, longitude: -78.4527 },
};

export function lookupAirport(code: string): Airport | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return AIRPORTS[normalized] ?? null;
}

export function listAirports(): Airport[] {
  return Object.values(AIRPORTS).sort((a, b) => a.iata.localeCompare(b.iata));
}
