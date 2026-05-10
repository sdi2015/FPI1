import fs from 'node:fs';
import path from 'node:path';

const [, , inputPath, masterPath = 'public/data/fpi-canonical-master.json', publicOutPath = 'public/data/elm-store-locations.json'] = process.argv;

if (!inputPath) {
  console.error('Usage: node tools/ingest-elm-store-locations.mjs <elm-json-or-csv> [master-json] [public-out-json]');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const [headers = [], ...values] = rows;
  return values.map((items) => Object.fromEntries(headers.map((header, index) => [header.trim(), items[index]?.trim() ?? ''])));
}

function readRows(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (filePath.toLowerCase().endsWith('.csv')) return parseCsv(text);
  const raw = JSON.parse(text);
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.stores)) return raw.stores;
  if (Array.isArray(raw.locations)) return raw.locations;
  throw new Error('ELM input must be a JSON array, { stores: [] }, { locations: [] }, or CSV file.');
}

function firstString(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function normalize(row) {
  const storeNumber = firstString(row, ['store_number', 'storeNumber', 'store_num', 'store', 'number', 'facility_number', 'facilityNumber', 'facility_id', 'Location', 'location']);
  const latitude = firstNumber(row, ['latitude', 'lat', 'Latitude', 'LATITUDE']);
  const longitude = firstNumber(row, ['longitude', 'lng', 'lon', 'Longitude', 'LONGITUDE']);
  if (!storeNumber || latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    store_number: storeNumber.replace(/^Store\s*#/i, '').trim(),
    address: firstString(row, ['address', 'Address', 'street_address', 'streetAddress']),
    city: firstString(row, ['city', 'City']),
    state: firstString(row, ['state', 'State']),
    latitude,
    longitude,
    source: firstString(row, ['source', 'Source']) ?? 'ELM store-location export',
    last_updated: firstString(row, ['last_updated', 'lastUpdated', 'updated_at', 'updatedAt']) ?? new Date().toISOString(),
  };
}

function indexLocations(locations) {
  const index = new Map();
  for (const location of locations) {
    index.set(location.store_number, location);
    index.set(location.store_number.replace(/^0+/, ''), location);
  }
  return index;
}

const locations = readRows(inputPath).map(normalize).filter(Boolean);
if (!locations.length) throw new Error('No valid ELM store-location rows found. Expected store number plus latitude/longitude.');

fs.mkdirSync(path.dirname(publicOutPath), { recursive: true });
fs.writeFileSync(publicOutPath, `${JSON.stringify(locations, null, 2)}\n`);

const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const locationIndex = indexLocations(locations);
let enrichedCount = 0;
master.facilities = (master.facilities ?? []).map((facility) => {
  const location = locationIndex.get(String(facility.facility_id)) ?? locationIndex.get(String(facility.facility_id).replace(/^0+/, ''));
  if (!location) return facility;
  enrichedCount += 1;
  return {
    ...facility,
    address: location.address ?? facility.address,
    city: location.city ?? facility.city,
    state: location.state ?? facility.state,
    latitude: location.latitude,
    longitude: location.longitude,
    location_source: location.source,
  };
});
fs.writeFileSync(masterPath, `${JSON.stringify(master, null, 2)}\n`);

console.log(`ELM store-location rows written: ${locations.length}`);
console.log(`FPI canonical facilities enriched: ${enrichedCount}`);
console.log(`Wrote ${publicOutPath}`);
console.log(`Updated ${masterPath}`);
