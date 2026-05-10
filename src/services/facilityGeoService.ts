import type { Airport, FacilitySortMode, FacilityWithDistance, NormalizedFacility } from '../types/aviation';

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

export type FacilityScanOptions = {
  airport: Airport;
  facilities: NormalizedFacility[];
  radiusMiles: number;
  facilityTypes?: string[];
  includeClosedFacilities?: boolean;
  sortMode?: FacilitySortMode;
};

export function getRecommendedFacilityAction(facility: Pick<FacilityWithDistance, 'facility_risk_band' | 'ep_readiness_status' | 'aviation_support_candidate' | 'distance_miles'>): string {
  if (facility.facility_risk_band === 'Critical') return 'Avoid unless required; escalate for executive review';
  if (facility.facility_risk_band === 'High') return 'Verify local readiness before arrival';
  if (facility.ep_readiness_status === 'Gap') return 'Complete EP readiness verification';
  if (facility.aviation_support_candidate && facility.distance_miles <= 25) return 'Best candidate for support/staging';
  if (facility.aviation_support_candidate) return 'Candidate for support/staging';
  return 'Monitor as nearby facility context';
}

export function sortScannedFacilities(facilities: FacilityWithDistance[], sortMode: FacilitySortMode = 'risk'): FacilityWithDistance[] {
  const epRank: Record<string, number> = { Gap: 3, Watch: 2, Unknown: 1, Restricted: 1, Stable: 0 };
  const supportScore = (facility: FacilityWithDistance) => (facility.aviation_support_candidate ? 100 : 0) + Math.max(0, 100 - facility.distance_miles) + (facility.ep_readiness_status === 'Stable' ? 20 : 0) - epRank[facility.ep_readiness_status] * 8;
  return [...facilities].sort((a, b) => {
    if (sortMode === 'distance') return a.distance_miles - b.distance_miles || b.facility_risk_score - a.facility_risk_score;
    if (sortMode === 'support') return supportScore(b) - supportScore(a) || a.distance_miles - b.distance_miles;
    if (b.facility_risk_score !== a.facility_risk_score) return b.facility_risk_score - a.facility_risk_score;
    if ((epRank[b.ep_readiness_status] ?? 0) !== (epRank[a.ep_readiness_status] ?? 0)) return (epRank[b.ep_readiness_status] ?? 0) - (epRank[a.ep_readiness_status] ?? 0);
    return a.distance_miles - b.distance_miles;
  }).map((facility, index) => ({ ...facility, support_candidate_rank: facility.aviation_support_candidate ? index + 1 : undefined }));
}

export function scanFacilitiesNearAirport({ airport, facilities, radiusMiles, facilityTypes, sortMode = 'risk' }: FacilityScanOptions): FacilityWithDistance[] {
  const scanned = facilities
    .filter((facility) => facility.latitude !== null && facility.longitude !== null)
    .filter((facility) => !facilityTypes || facilityTypes.length === 0 || facilityTypes.includes(facility.facility_type))
    .map((facility) => {
      const distance_miles = getDistanceMiles(airport.latitude, airport.longitude, facility.latitude as number, facility.longitude as number);
      const enriched: FacilityWithDistance = {
        ...facility,
        facility_number: facility.facility_number ?? facility.facility_id,
        latitude: facility.latitude as number,
        longitude: facility.longitude as number,
        distance_miles,
        estimated_drive_time_minutes: estimateDriveTimeMinutes(distance_miles),
        drive_time_source: 'estimated',
        weather_exposure: facility.facility_risk_band === 'Critical' || facility.facility_risk_band === 'High' ? 'Elevated' : 'Low',
        recommended_action: 'Monitor as nearby facility context',
      };
      return { ...enriched, recommended_action: getRecommendedFacilityAction(enriched) };
    })
    .filter((facility) => facility.distance_miles <= radiusMiles);
  return sortScannedFacilities(scanned, sortMode);
}
