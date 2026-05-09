import type { AviationTripPlan } from '../types/aviation';

const STORAGE_KEY = 'fpi_aviation_saved_trip_plans_v1';

function readTrips(): AviationTripPlan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AviationTripPlan[] : [];
  } catch {
    return [];
  }
}

function writeTrips(trips: AviationTripPlan[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

function now() {
  return new Date().toISOString();
}

export async function saveTripPlan(trip: AviationTripPlan): Promise<AviationTripPlan> {
  const trips = readTrips();
  const existingIndex = trips.findIndex((item) => item.trip_id === trip.trip_id);
  const saved = { ...trip, updated_at: now() };
  if (existingIndex >= 0) trips[existingIndex] = saved;
  else trips.unshift(saved);
  writeTrips(trips);
  return saved;
}

export async function getSavedTripPlans(): Promise<AviationTripPlan[]> {
  return readTrips().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getTripPlanById(tripId: string): Promise<AviationTripPlan | null> {
  return readTrips().find((trip) => trip.trip_id === tripId) ?? null;
}

export async function updateTripPlan(tripId: string, updates: Partial<AviationTripPlan>): Promise<AviationTripPlan> {
  const existing = await getTripPlanById(tripId);
  if (!existing) throw new Error('Trip plan not found.');
  return saveTripPlan({ ...existing, ...updates, trip_id: tripId, updated_at: now() });
}

export async function duplicateTripPlan(tripId: string): Promise<AviationTripPlan> {
  const existing = await getTripPlanById(tripId);
  if (!existing) throw new Error('Trip plan not found.');
  const stamp = now();
  const duplicateId = `TRIP-${Date.now()}`;
  return saveTripPlan({
    ...existing,
    trip_id: duplicateId,
    trip_name: `${existing.trip_name} Copy`,
    status: 'draft',
    closure_summary: undefined,
    created_at: stamp,
    updated_at: stamp,
    last_scanned: stamp,
    readiness_actions: existing.readiness_actions.map((action) => ({ ...action, action_id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, trip_id: duplicateId })),
  });
}

export async function deleteTripPlan(tripId: string): Promise<void> {
  writeTrips(readTrips().filter((trip) => trip.trip_id !== tripId));
}
