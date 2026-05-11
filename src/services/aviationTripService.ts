import { getDistanceMiles, scanFacilitiesNearAirport, sortScannedFacilities } from './facilityGeoService';
import type { Airport, AviationMultiAirportTrip, AviationRiskBandWithPending, AviationSelectedFacility, AviationTravelerType, AviationTripAirportStop, FAAAlert, FacilityWithDistance, NormalizedFacility, RiskBand, WeatherAlert } from '../types/aviation';

export type AviationTripStopScan = {
  stop: AviationTripAirportStop;
  facilities: FacilityWithDistance[];
  faaAlerts: FAAAlert[];
  weatherAlerts: WeatherAlert[];
  risk: AviationAirportRisk;
};

export type AviationAirportRisk = {
  score: number;
  band: AviationRiskBandWithPending;
  confidence: number;
  drivers: string[];
};

export type AviationTripRisk = AviationAirportRisk;

export function newAviationTripId(): string {
  return `TRIP-${Date.now()}`;
}

export function createEmptyAviationTrip(): AviationMultiAirportTrip {
  return {
    trip_id: newAviationTripId(),
    trip_name: '',
    trip_status: 'Draft',
    traveler_type: 'Executive',
    trip_start: '',
    trip_end: '',
    default_radius_miles: 25,
    facility_types: [],
    airports: [],
    selected_facilities: [],
    overall_risk_band: 'Pending',
  };
}

export function airportToStop(airport: Airport, stopType: AviationTripAirportStop['stop_type'], sequence: number, radiusMiles: number): AviationTripAirportStop {
  return {
    stop_id: `${stopType.toUpperCase()}-${airport.airport_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sequence,
    stop_type: stopType,
    airport_id: airport.airport_id,
    airport_name: airport.airport_name,
    faa_id: airport.faa_id,
    iata_code: airport.iata_code,
    icao_code: airport.icao_code,
    city: airport.city ?? 'Unknown city',
    state: airport.state ?? 'Unknown state',
    latitude: airport.latitude,
    longitude: airport.longitude,
    radius_miles: radiusMiles,
    scan_status: 'Not Scanned',
    nearby_facility_ids: [],
    selected_facility_ids: [],
    airport_risk_band: 'Pending',
  };
}

export function stopToAirport(stop: AviationTripAirportStop): Airport {
  return {
    airport_id: stop.airport_id,
    airport_name: stop.airport_name,
    faa_id: stop.faa_id,
    iata_code: stop.iata_code,
    icao_code: stop.icao_code,
    city: stop.city,
    state: stop.state,
    latitude: stop.latitude,
    longitude: stop.longitude,
    status: 'active',
    source_freshness: 'seeded_demo',
    last_updated: new Date().toISOString(),
  };
}

export function resequenceStops(stops: AviationTripAirportStop[]): AviationTripAirportStop[] {
  return stops.map((stop, index) => ({ ...stop, sequence: index + 1, stop_type: index === 0 ? 'Start' : index === stops.length - 1 ? 'End' : 'Intermediate' }));
}

export function setEndpointStop(stops: AviationTripAirportStop[], airport: Airport, endpoint: 'Start' | 'End', radiusMiles: number): AviationTripAirportStop[] {
  const existing = stops.find((stop) => stop.stop_type === endpoint);
  const replacement = existing ? { ...airportToStop(airport, endpoint, existing.sequence, existing.radius_miles || radiusMiles), stop_id: existing.stop_id, scan_status: 'Needs Refresh' as const } : airportToStop(airport, endpoint, endpoint === 'Start' ? 1 : stops.length + 1, radiusMiles);
  const withoutEndpoint = stops.filter((stop) => stop.stop_type !== endpoint);
  return resequenceStops(endpoint === 'Start' ? [replacement, ...withoutEndpoint] : [...withoutEndpoint, replacement]);
}

export function addAirportStop(stops: AviationTripAirportStop[], airport: Airport, radiusMiles: number): AviationTripAirportStop[] {
  const start = stops.find((stop) => stop.stop_type === 'Start');
  const end = stops.find((stop) => stop.stop_type === 'End');
  const middle = stops.filter((stop) => stop.stop_type === 'Intermediate');
  const next = airportToStop(airport, 'Intermediate', middle.length + 2, radiusMiles);
  return resequenceStops([...(start ? [start] : []), ...middle, next, ...(end ? [end] : [])]);
}

export function removeAirportStop(stops: AviationTripAirportStop[], stopId: string): AviationTripAirportStop[] {
  return resequenceStops(stops.filter((stop) => stop.stop_id !== stopId || stop.stop_type !== 'Intermediate'));
}

export function moveIntermediateStop(stops: AviationTripAirportStop[], stopId: string, direction: -1 | 1): AviationTripAirportStop[] {
  const start = stops.find((stop) => stop.stop_type === 'Start');
  const end = stops.find((stop) => stop.stop_type === 'End');
  const middle = stops.filter((stop) => stop.stop_type === 'Intermediate');
  const index = middle.findIndex((stop) => stop.stop_id === stopId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= middle.length) return stops;
  [middle[index], middle[nextIndex]] = [middle[nextIndex], middle[index]];
  return resequenceStops([...(start ? [start] : []), ...middle, ...(end ? [end] : [])]);
}

export function updateAirportStopRadius(stops: AviationTripAirportStop[], stopId: string, radiusMiles: number): AviationTripAirportStop[] {
  return stops.map((stop) => stop.stop_id === stopId ? { ...stop, radius_miles: radiusMiles, scan_status: stop.scan_status === 'Scanned' ? 'Needs Refresh' : stop.scan_status } : stop);
}

function bandFromScore(score: number): RiskBand {
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 55) return 'Elevated';
  if (score >= 35) return 'Watch';
  return 'Low';
}

const bandScore: Record<string, number> = { Pending: 0, Low: 20, Watch: 40, Elevated: 60, High: 78, Critical: 95, Unknown: 20 };

export function calculateAirportRisk(input: { facilities: FacilityWithDistance[]; selectedFacilityIds: string[]; faaAlerts: FAAAlert[]; weatherAlerts: WeatherAlert[]; scanHasRun: boolean }): AviationAirportRisk {
  if (!input.scanHasRun) return { score: 0, band: 'Pending', confidence: 0, drivers: ['Run radius scan to calculate airport risk.'] };
  const selected = input.facilities.filter((facility) => input.selectedFacilityIds.includes(facility.facility_id));
  const maxFacility = Math.max(0, ...input.facilities.map((facility) => facility.facility_risk_score));
  const maxSelected = Math.max(0, ...selected.map((facility) => facility.facility_risk_score));
  const maxFaa = Math.max(0, ...input.faaAlerts.map((alert) => bandScore[alert.severity] ?? 0));
  const maxWeather = Math.max(0, ...input.weatherAlerts.map((alert) => bandScore[alert.severity] ?? 0));
  const epGapCount = input.facilities.filter((facility) => facility.ep_readiness_status === 'Gap' || facility.ep_readiness_status === 'Restricted').length;
  const score = Math.min(100, Math.round(maxFacility * 0.28 + maxSelected * 0.22 + maxFaa * 0.2 + maxWeather * 0.2 + Math.min(20, epGapCount * 4) + Math.min(8, input.facilities.length / 6)));
  const drivers = [
    maxFaa >= 70 ? 'High FAA / airport watch signal.' : null,
    maxWeather >= 70 ? 'High NOAA weather signal.' : null,
    maxFacility >= 70 ? 'High-risk Walmart facility inside radius.' : null,
    maxSelected >= 70 ? 'Selected Walmart location has elevated risk.' : null,
    epGapCount > 0 ? `${epGapCount} EP readiness gap(s) inside radius.` : null,
    input.facilities.length === 0 ? 'No Walmart facilities found in selected radius.' : null,
  ].filter(Boolean) as string[];
  return { score, band: bandFromScore(score), confidence: input.facilities.length ? 78 : 55, drivers: drivers.length ? drivers : ['No elevated airport risk drivers identified.'] };
}

export function calculateOverallTripRisk(airportRisks: AviationAirportRisk[], selectedFacilities: AviationSelectedFacility[]): AviationTripRisk {
  const scanned = airportRisks.filter((risk) => risk.band !== 'Pending');
  if (!scanned.length) return { score: 0, band: 'Pending', confidence: 0, drivers: ['Risk remains Pending until at least one airport scan runs.'] };
  const highest = Math.max(...scanned.map((risk) => risk.score));
  const average = scanned.reduce((sum, risk) => sum + risk.score, 0) / scanned.length;
  const selectedHigh = selectedFacilities.filter((facility) => ['High', 'Critical'].includes(facility.facility_risk_band ?? '')).length;
  const score = Math.min(100, Math.round(highest * 0.55 + average * 0.35 + Math.min(10, airportRisks.length * 1.5) + Math.min(10, selectedHigh * 3)));
  const drivers = [
    `Highest airport score: ${highest}.`,
    `Average scanned airport score: ${Math.round(average)}.`,
    selectedHigh ? `${selectedHigh} selected high-risk Walmart location(s).` : null,
    airportRisks.some((risk) => risk.band === 'Critical') ? 'At least one airport stop is Critical.' : null,
  ].filter(Boolean) as string[];
  return { score, band: bandFromScore(score), confidence: Math.round(scanned.reduce((sum, risk) => sum + risk.confidence, 0) / scanned.length), drivers };
}

export function scanFacilitiesForAirportStop(stop: AviationTripAirportStop, facilities: NormalizedFacility[], facilityTypes: string[] = []): FacilityWithDistance[] {
  return scanFacilitiesNearAirport({ airport: stopToAirport(stop), facilities, radiusMiles: stop.radius_miles, facilityTypes });
}

export function buildSelectedFacility(tripId: string, stop: AviationTripAirportStop, facility: FacilityWithDistance, selected = true): AviationSelectedFacility {
  return { trip_id: tripId, stop_id: stop.stop_id, airport_id: stop.airport_id, facility_id: facility.facility_id, selected, distance_miles: facility.distance_miles, facility_risk_score: facility.facility_risk_score, facility_risk_band: facility.facility_risk_band, recommended_role: facility.facility_risk_band === 'Critical' ? 'Avoid' : facility.facility_risk_band === 'High' || facility.ep_readiness_status === 'Gap' ? 'Verification Required' : facility.aviation_support_candidate ? 'Support / Staging' : 'Monitor' };
}

export function dedupeFacilityRows(rows: Array<{ stop: AviationTripAirportStop; facility: FacilityWithDistance }>): Array<{ stop: AviationTripAirportStop; facility: FacilityWithDistance; associatedStops: AviationTripAirportStop[] }> {
  const byFacility = new Map<string, { stop: AviationTripAirportStop; facility: FacilityWithDistance; associatedStops: AviationTripAirportStop[] }>();
  for (const row of rows) {
    const existing = byFacility.get(row.facility.facility_id);
    if (!existing || row.facility.distance_miles < existing.facility.distance_miles) byFacility.set(row.facility.facility_id, { ...row, associatedStops: existing ? [...existing.associatedStops, row.stop] : [row.stop] });
    else existing.associatedStops.push(row.stop);
  }
  return Array.from(byFacility.values());
}

export function routeDistanceMiles(stops: AviationTripAirportStop[]): number {
  return stops.slice(1).reduce((sum, stop, index) => sum + getDistanceMiles(stops[index].latitude, stops[index].longitude, stop.latitude, stop.longitude), 0);
}
