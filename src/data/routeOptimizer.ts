// Distance + route optimisation helpers for the Visit Brief wizard.
// Uses Haversine for great-circle distance; nearest-neighbour for an
// O(n^2) route ordering that's plenty fast for the ~12-stop demo data.

const EARTH_RADIUS_MI = 3958.8;

export type LatLng = { latitude: number; longitude: number };

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Nearest-neighbour TSP starting from `origin`. Greedy and not optimal but
// fine for ~12 stops; preserves array identity of the inputs.
export function nearestNeighborOrder<T extends LatLng>(origin: LatLng, stops: T[]): T[] {
  const remaining = stops.slice();
  const ordered: T[] = [];
  let cursor: LatLng = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMiles(cursor, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [chosen] = remaining.splice(bestIdx, 1);
    ordered.push(chosen);
    cursor = chosen;
  }
  return ordered;
}

// Total miles for an ordered route (origin -> stop1 -> ... -> stopN).
export function totalRouteMiles(origin: LatLng, ordered: LatLng[]): number {
  let total = 0;
  let cursor = origin;
  for (const stop of ordered) {
    total += haversineMiles(cursor, stop);
    cursor = stop;
  }
  return total;
}

// Pick the closest item from a list to a reference point.
export function nearestTo<T extends LatLng>(reference: LatLng, items: T[]): T | null {
  if (items.length === 0) return null;
  let best = items[0];
  let bestDist = haversineMiles(reference, best);
  for (let i = 1; i < items.length; i++) {
    const d = haversineMiles(reference, items[i]);
    if (d < bestDist) {
      bestDist = d;
      best = items[i];
    }
  }
  return best;
}

// Return the N closest items to a reference, ordered nearest-first.
export function nearestN<T extends LatLng>(reference: LatLng, items: T[], n: number): Array<{ item: T; miles: number }> {
  return items
    .map((item) => ({ item, miles: haversineMiles(reference, item) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, Math.max(0, n));
}
