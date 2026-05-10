import { aviationApiRequest, tryAviationApiRequest } from './aviationApiClient';
import { isAviationApiPersistenceEnabled, isAviationApiRequired } from './aviationRuntimeConfig';
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

function normalizeTripList(raw: unknown): AviationTripPlan[] {
  if (Array.isArray(raw)) return raw as AviationTripPlan[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { trips?: unknown }).trips)) return (raw as { trips: AviationTripPlan[] }).trips;
  return [];
}

function localSaveTripPlan(trip: AviationTripPlan): AviationTripPlan {
  const trips = readTrips();
  const existingIndex = trips.findIndex((item) => item.trip_id === trip.trip_id);
  const saved = { ...trip, updated_at: now() };
  if (existingIndex >= 0) trips[existingIndex] = saved;
  else trips.unshift(saved);
  writeTrips(trips);
  return saved;
}

export async function saveTripPlan(trip: AviationTripPlan): Promise<AviationTripPlan> {
  if (isAviationApiPersistenceEnabled()) {
    const saved = await tryAviationApiRequest<AviationTripPlan>('/aviation/trips', { method: 'POST', body: trip });
    if (saved) {
      localSaveTripPlan(saved);
      return saved;
    }
    if (isAviationApiRequired()) throw new Error('Unable to save trip plan through the Aviation API.');
  }
  return localSaveTripPlan(trip);
}

export async function getSavedTripPlans(): Promise<AviationTripPlan[]> {
  if (isAviationApiPersistenceEnabled()) {
    const raw = await tryAviationApiRequest<unknown>('/aviation/trips');
    const trips = raw ? normalizeTripList(raw) : [];
    if (trips.length || raw) {
      writeTrips(trips);
      return trips.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    if (isAviationApiRequired()) throw new Error('Unable to load trip plans from the Aviation API.');
  }
  return readTrips().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getTripPlanById(tripId: string): Promise<AviationTripPlan | null> {
  if (isAviationApiPersistenceEnabled()) {
    const trip = await tryAviationApiRequest<AviationTripPlan>(`/aviation/trips/${encodeURIComponent(tripId)}`);
    if (trip) return trip;
    if (isAviationApiRequired()) throw new Error('Unable to load trip plan from the Aviation API.');
  }
  return readTrips().find((trip) => trip.trip_id === tripId) ?? null;
}

export async function updateTripPlan(tripId: string, updates: Partial<AviationTripPlan>): Promise<AviationTripPlan> {
  if (isAviationApiPersistenceEnabled()) {
    const updated = await tryAviationApiRequest<AviationTripPlan>(`/aviation/trips/${encodeURIComponent(tripId)}`, { method: 'PATCH', body: updates });
    if (updated) {
      localSaveTripPlan(updated);
      return updated;
    }
    if (isAviationApiRequired()) throw new Error('Unable to update trip plan through the Aviation API.');
  }
  const existing = await getTripPlanById(tripId);
  if (!existing) throw new Error('Trip plan not found.');
  return localSaveTripPlan({ ...existing, ...updates, trip_id: tripId, updated_at: now() });
}

export async function duplicateTripPlan(tripId: string): Promise<AviationTripPlan> {
  if (isAviationApiPersistenceEnabled()) {
    const duplicated = await tryAviationApiRequest<AviationTripPlan>(`/aviation/trips/${encodeURIComponent(tripId)}/duplicate`, { method: 'POST' });
    if (duplicated) {
      localSaveTripPlan(duplicated);
      return duplicated;
    }
    if (isAviationApiRequired()) throw new Error('Unable to duplicate trip plan through the Aviation API.');
  }
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
  if (isAviationApiPersistenceEnabled()) {
    try {
      await aviationApiRequest<void>(`/aviation/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE' });
      writeTrips(readTrips().filter((trip) => trip.trip_id !== tripId));
      return;
    } catch (error) {
      if (isAviationApiRequired()) throw error;
    }
  }
  writeTrips(readTrips().filter((trip) => trip.trip_id !== tripId));
}
