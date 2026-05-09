import type { Airport, FacilityWithDistance, NormalizedFacility } from '../types/aviation';

export function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateDriveTimeMinutes(distanceMiles: number): number {
  const averageSpeedMph = 35;
  return Math.max(5, Math.round((distanceMiles / averageSpeedMph) * 60));
}

export function scanFacilitiesNearAirport({
  airport,
  facilities,
  radiusMiles,
  facilityTypes,
}: {
  airport: Airport;
  facilities: NormalizedFacility[];
  radiusMiles: number;
  facilityTypes?: string[];
}): FacilityWithDistance[] {
  return facilities
    .filter((facility) => facility.latitude !== null && facility.longitude !== null)
    .filter((facility) => !facilityTypes || facilityTypes.length === 0 || facilityTypes.includes(facility.facility_type))
    .map((facility) => ({
      ...facility,
      facility_number: facility.facility_number ?? facility.facility_id,
      latitude: facility.latitude as number,
      longitude: facility.longitude as number,
      distance_miles: getDistanceMiles(airport.latitude, airport.longitude, facility.latitude as number, facility.longitude as number),
    }))
    .filter((facility) => facility.distance_miles <= radiusMiles)
    .sort((a, b) => {
      if (b.facility_risk_score !== a.facility_risk_score) return b.facility_risk_score - a.facility_risk_score;
      if (a.distance_miles !== b.distance_miles) return a.distance_miles - b.distance_miles;
      const epRank: Record<string, number> = { Gap: 3, Watch: 2, Unknown: 1, Restricted: 1, Stable: 0 };
      return (epRank[b.ep_readiness_status] ?? 0) - (epRank[a.ep_readiness_status] ?? 0);
    });
}
