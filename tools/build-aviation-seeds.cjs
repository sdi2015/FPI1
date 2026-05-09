const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const aviationDir = path.join(root, 'data', 'aviation');
fs.mkdirSync(aviationDir, { recursive: true });

const sourcePath = 'C:\\Users\\j0w16ja\\Downloads\\Airports.geojson';
const geo = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const now = new Date().toISOString();

function safe(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function slug(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function statusFrom(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('operational')) return 'active';
  if (normalized.includes('closed') || normalized.includes('inactive')) return 'inactive';
  return 'unknown';
}

function typeFrom(code) {
  const map = { AD: 'Airport', SP: 'Seaplane Base', HP: 'Heliport', UL: 'Ultralight', GL: 'Gliderport', BAL: 'Balloonport' };
  return map[code] || code || 'unknown';
}

const airports = (geo.features || [])
  .map((feature, index) => {
    const p = feature.properties || {};
    const coords = feature.geometry && Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [];
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const faaId = safe(p.IDENT);
    const icao = safe(p.ICAO_ID);
    const iata = faaId && /^[A-Z]{3}$/.test(faaId) ? faaId : undefined;
    const idPart = slug(iata || faaId || icao || p.GLOBAL_ID || index + 1);

    return {
      airport_id: `AIR-${idPart}`,
      faa_id: faaId,
      iata_code: iata,
      icao_code: icao,
      airport_name: safe(p.NAME) || `Airport ${index + 1}`,
      airport_type: typeFrom(safe(p.TYPE_CODE)),
      city: safe(p.SERVCITY),
      state: safe(p.STATE),
      latitude,
      longitude,
      status: statusFrom(p.OPERSTATUS),
      source_freshness: 'uploaded_geojson',
      last_updated: now,
      source_metadata: {
        object_id: p.OBJECTID ?? null,
        type_code: p.TYPE_CODE ?? null,
        private_use: p.PRIVATEUSE ?? null,
        operational_status: p.OPERSTATUS ?? null,
        country: p.COUNTRY ?? null,
      },
    };
  })
  .filter(Boolean);

fs.writeFileSync(path.join(aviationDir, 'airports.json'), JSON.stringify(airports, null, 2));

const xnaId = airports.find((a) => a.faa_id === 'XNA')?.airport_id || 'AIR-XNA';
const dfwId = airports.find((a) => a.faa_id === 'DFW')?.airport_id || 'AIR-DFW';

fs.writeFileSync(
  path.join(aviationDir, 'faaAlerts.json'),
  JSON.stringify(
    [
      {
        alert_id: 'FAA-0001',
        airport_id: xnaId,
        alert_type: 'NOTAM',
        severity: 'Watch',
        title: 'Runway/taxiway limitation',
        summary: 'Seeded FAA watch item for aviation readiness scoring. Validate against live FAA source before operational use.',
        effective_start: '2026-05-14T06:00:00-05:00',
        effective_end: '2026-05-14T18:00:00-05:00',
        source: 'FAA',
        source_url: null,
        confidence: 80,
        status: 'active',
      },
      {
        alert_id: 'FAA-0002',
        airport_id: dfwId,
        alert_type: 'Airport Delay',
        severity: 'Elevated',
        title: 'Ground delay program watch',
        summary: 'Seeded delay watch for demo scoring; live integration not connected in Phase 1.',
        effective_start: '2026-05-14T10:00:00-05:00',
        effective_end: '2026-05-14T16:00:00-05:00',
        source: 'FAA',
        source_url: null,
        confidence: 70,
        status: 'active',
      },
    ],
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(aviationDir, 'weatherAlerts.json'),
  JSON.stringify(
    [
      {
        weather_alert_id: 'WX-0001',
        airport_id: xnaId,
        affected_facility_ids: ['WM-STORE-1001', 'WM-SAMS-4969'],
        alert_type: 'Severe Thunderstorm Watch',
        severity: 'Elevated',
        summary: 'Seeded NOAA alert: thunderstorms possible during arrival window with wind and lightning exposure.',
        effective_start: '2026-05-14T12:00:00-05:00',
        effective_end: '2026-05-14T20:00:00-05:00',
        source: 'NOAA',
        source_url: null,
        confidence: 90,
        status: 'active',
      },
      {
        weather_alert_id: 'WX-0002',
        airport_id: dfwId,
        affected_facility_ids: ['WM-STORE-2020'],
        alert_type: 'High Wind Advisory',
        severity: 'Watch',
        summary: 'Seeded NOAA alert: gusty crosswinds may affect airport operations and ground movement.',
        effective_start: '2026-05-14T09:00:00-05:00',
        effective_end: '2026-05-14T17:00:00-05:00',
        source: 'NOAA',
        source_url: null,
        confidence: 76,
        status: 'active',
      },
    ],
    null,
    2,
  ),
);

for (const name of ['tripPlans', 'aviationRiskSignals', 'tripRiskScores', 'tripReadinessActions', 'tripBriefs']) {
  fs.writeFileSync(path.join(aviationDir, `${name}.json`), JSON.stringify([], null, 2));
}

const facilities = [
  ['WM-STORE-1001', '1001', 'Walmart Supercenter 1001', 'Walmart Supercenter', 'Bentonville', 'AR', 36.3729, -94.2088, 42, 'Watch', 'Open camera maintenance case', 'Watch', true],
  ['WM-HO-0001', 'HO1', 'Walmart Home Office Campus', 'Corporate / Critical Support', 'Bentonville', 'AR', 36.3659, -94.1793, 36, 'Watch', 'Visitor access workflow refresh pending', 'Stable', true],
  ['WM-SAMS-4969', '4969', "Sam's Club 4969", "Sam's Club", 'Fayetteville', 'AR', 36.112, -94.1574, 61, 'Elevated', 'EP readiness contact requires revalidation', 'Gap', true],
  ['WM-DC-0609', '0609', 'Walmart Distribution Center 0609', 'Distribution Center', 'Siloam Springs', 'AR', 36.1881, -94.5405, 53, 'Elevated', 'Perimeter lighting work order open', 'Watch', true],
  ['WM-NM-2744', '2744', 'Neighborhood Market 2744', 'Neighborhood Market', 'Rogers', 'AR', 36.332, -94.1185, 24, 'Low', 'No major open findings', 'Stable', false],
  ['WM-FC-AR01', 'AR01', 'Northwest Arkansas Fulfillment Node', 'Fulfillment Center', 'Lowell', 'AR', 36.2554, -94.1308, 78, 'High', 'Access control exception unresolved', 'Gap', true],
  ['WM-STORE-2020', '2020', 'Walmart Supercenter 2020', 'Walmart Supercenter', 'Irving', 'TX', 32.865, -96.95, 58, 'Elevated', 'Recent incident trend requires AP review', 'Watch', true],
  ['WM-SAMS-6251', '6251', "Sam's Club 6251", "Sam's Club", 'Grapevine', 'TX', 32.9343, -97.0781, 31, 'Watch', 'Vendor badge audit pending', 'Stable', true],
  ['WM-DC-6056', '6056', 'Walmart Distribution Center 6056', 'Distribution Center', 'Cleburne', 'TX', 32.3476, -97.3867, 47, 'Watch', 'Guard coverage schedule not verified', 'Watch', false],
  ['WM-FC-DFW1', 'DFW1', 'Dallas Fulfillment Center', 'Fulfillment Center', 'Dallas', 'TX', 32.8998, -96.745, 72, 'High', 'High-value inventory exception', 'Gap', true],
  ['WM-STORE-1189', '1189', 'Walmart Supercenter 1189', 'Walmart Supercenter', 'North Little Rock', 'AR', 34.7695, -92.2671, 44, 'Watch', 'Camera uptime below target', 'Watch', true],
  ['WM-SAMS-8104', '8104', "Sam's Club 8104", "Sam's Club", 'Little Rock', 'AR', 34.7465, -92.2896, 27, 'Low', 'Routine monitoring only', 'Stable', true],
  ['WM-STORE-3775', '3775', 'Walmart Supercenter 3775', 'Walmart Supercenter', 'Atlanta', 'GA', 33.749, -84.388, 63, 'Elevated', 'Crowd management plan stale', 'Gap', true],
  ['WM-DC-6010', '6010', 'Atlanta Regional Distribution Center', 'Distribution Center', 'McDonough', 'GA', 33.4473, -84.1469, 39, 'Watch', 'Dock gate repair pending', 'Stable', false],
  ['WM-STORE-5487', '5487', 'Walmart Supercenter 5487', 'Walmart Supercenter', 'Chicago', 'IL', 41.8781, -87.6298, 68, 'Elevated', 'Urban incident pattern watch', 'Watch', false],
  ['WM-FC-ORD1', 'ORD1', 'Chicago Fulfillment Center', 'Fulfillment Center', 'Joliet', 'IL', 41.525, -88.0817, 55, 'Elevated', 'Fire panel inspection follow-up', 'Watch', true],
  ['WM-STORE-2223', '2223', 'Walmart Supercenter 2223', 'Walmart Supercenter', 'Aurora', 'CO', 39.7294, -104.8319, 33, 'Watch', 'Winter weather readiness checklist due', 'Stable', true],
  ['WM-DC-7042', '7042', 'Denver Grocery Distribution Center', 'Distribution Center', 'Loveland', 'CO', 40.3978, -105.0749, 49, 'Watch', 'Backup generator service pending', 'Watch', false],
  ['WM-STORE-5330', '5330', 'Walmart Supercenter 5330', 'Walmart Supercenter', 'Phoenix', 'AZ', 33.4484, -112.074, 46, 'Watch', 'Heat response plan review due', 'Stable', true],
  ['WM-FC-PHX1', 'PHX1', 'Phoenix Fulfillment Center', 'Fulfillment Center', 'Goodyear', 'AZ', 33.4353, -112.3582, 57, 'Elevated', 'Access badge reconciliation overdue', 'Gap', true],
  ['WM-STORE-4101', '4101', 'Walmart Supercenter 4101', 'Walmart Supercenter', 'Orlando', 'FL', 28.5383, -81.3792, 52, 'Elevated', 'Severe weather supply staging required', 'Watch', true],
  ['WM-SAMS-4782', '4782', "Sam's Club 4782", "Sam's Club", 'Kissimmee', 'FL', 28.292, -81.4076, 38, 'Watch', 'Local contact list aging', 'Unknown', true],
  ['WM-STORE-7190', '7190', 'Walmart Supercenter 7190', 'Walmart Supercenter', 'Charlotte', 'NC', 35.2271, -80.8431, 29, 'Low', 'No major open findings', 'Stable', true],
  ['WM-DC-6070', '6070', 'Charlotte Distribution Center', 'Distribution Center', 'Shelby', 'NC', 35.2924, -81.5356, 51, 'Elevated', 'Perimeter patrol exception', 'Watch', false],
  ['WM-STORE-3456', '3456', 'Walmart Supercenter 3456', 'Walmart Supercenter', 'Seattle', 'WA', 47.6062, -122.3321, 64, 'Elevated', 'Civil disruption monitoring active', 'Watch', false],
  ['WM-CORP-SFO', 'SFO1', 'Bay Area Critical Support Office', 'Corporate / Critical Support', 'San Bruno', 'CA', 37.6305, -122.4111, 41, 'Watch', 'Visitor management refresh pending', 'Stable', true],
].map(([facility_id, facility_number, facility_name, facility_type, city, state, latitude, longitude, facility_risk_score, facility_risk_band, top_risk_driver, ep_readiness_status, aviation_support_candidate]) => ({
  facility_id,
  facility_number,
  facility_name,
  facility_type,
  city,
  state,
  latitude,
  longitude,
  facility_risk_score,
  facility_risk_band,
  top_risk_driver,
  ep_readiness_status,
  aviation_support_candidate,
  source_freshness: 'seeded_demo',
}));

fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'facilities.json'), JSON.stringify(facilities, null, 2));
fs.writeFileSync(path.join(root, 'data', 'airportFacilities.json'), JSON.stringify([], null, 2));
fs.writeFileSync(
  path.join(root, 'data', 'assistantKnowledge.json'),
  JSON.stringify(
    {
      aviation_travel_readiness: {
        mode: 'seeded_demo',
        guardrails: [
          'FPI produces go/no-go readiness recommendations only; final authority remains with authorized leadership.',
          'Sensitive trip details require role-based authorization.',
          'Seeded/demo/missing/stale data must be labeled.',
        ],
      },
    },
    null,
    2,
  ),
);

console.log(`Converted ${airports.length} airports to data/aviation/airports.json`);
