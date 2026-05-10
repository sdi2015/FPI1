import { buildQuery, tryAviationApiRequest } from './aviationApiClient';
import { isAviationApiEnabled } from './aviationRuntimeConfig';
import type { Airport } from '../types/aviation';

let airportCache: Airport[] | null = null;
let airportLoadPromise: Promise<Airport[]> | null = null;

const RECOMMENDED_AIRPORT_IDS = ['AIR-XNA', 'AIR-DFW', 'AIR-LIT', 'AIR-ATL', 'AIR-CLT', 'AIR-MCO', 'AIR-DEN', 'AIR-PHX'];

function normalizeAirportList(raw: unknown): Airport[] {
  if (Array.isArray(raw)) return raw as Airport[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { airports?: unknown }).airports)) return (raw as { airports: Airport[] }).airports;
  return [];
}

async function fetchAirportsFromStaticJson(): Promise<Airport[]> {
  const response = await fetch('/data/aviation/airports.json');
  if (!response.ok) throw new Error(`Airport data request failed: ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw)) throw new Error('Airport data payload was not an array.');
  return raw as Airport[];
}

async function fetchAirports(): Promise<Airport[]> {
  if (isAviationApiEnabled()) {
    const raw = await tryAviationApiRequest<unknown>(`/aviation/airports${buildQuery({ status: 'active', limit: 5000 })}`);
    const airports = raw ? normalizeAirportList(raw) : [];
    if (airports.length) return airports;
  }
  return fetchAirportsFromStaticJson();
}

export async function loadAirports(): Promise<Airport[]> {
  if (airportCache) return airportCache;
  if (!airportLoadPromise) {
    airportLoadPromise = fetchAirports().then((airports) => {
      airportCache = airports;
      return airports;
    }).finally(() => {
      airportLoadPromise = null;
    });
  }
  return airportLoadPromise;
}

export async function searchAirports(query: string): Promise<Airport[]> {
  if (isAviationApiEnabled()) {
    const raw = await tryAviationApiRequest<unknown>(`/aviation/airports${buildQuery({ query, status: 'active', limit: query.trim() ? 50 : 25 })}`);
    const airports = raw ? normalizeAirportList(raw) : [];
    if (airports.length) return airports;
  }

  const airports = await loadAirports();
  const active = airports.filter((airport) => airport.status !== 'inactive');
  const q = query.trim().toLowerCase();

  if (!q) {
    const recommended = RECOMMENDED_AIRPORT_IDS
      .map((id) => active.find((airport) => airport.airport_id === id))
      .filter(Boolean) as Airport[];
    return (recommended.length ? recommended : active).slice(0, 25);
  }

  return active
    .filter((airport) =>
      [airport.airport_name, airport.city, airport.state, airport.faa_id, airport.iata_code, airport.icao_code, airport.airport_type]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q)),
    )
    .slice(0, 50);
}

export async function getAirportById(airportId: string): Promise<Airport | null> {
  if (isAviationApiEnabled()) {
    const airport = await tryAviationApiRequest<Airport>(`/aviation/airports/${encodeURIComponent(airportId)}`);
    if (airport) return airport;
  }
  const airports = await loadAirports();
  return airports.find((airport) => airport.airport_id === airportId) ?? null;
}
