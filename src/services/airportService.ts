import type { Airport } from '../types/aviation';

let airportCache: Airport[] | null = null;
let airportLoadPromise: Promise<Airport[]> | null = null;

const RECOMMENDED_AIRPORT_IDS = ['AIR-XNA', 'AIR-DFW', 'AIR-LIT', 'AIR-ATL', 'AIR-CLT', 'AIR-MCO', 'AIR-DEN', 'AIR-PHX'];

async function fetchAirports(): Promise<Airport[]> {
  const response = await fetch('/data/aviation/airports.json');
  if (!response.ok) throw new Error(`Airport data request failed: ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw)) throw new Error('Airport data payload was not an array.');
  return raw as Airport[];
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
  const airports = await loadAirports();
  return airports.find((airport) => airport.airport_id === airportId) ?? null;
}
