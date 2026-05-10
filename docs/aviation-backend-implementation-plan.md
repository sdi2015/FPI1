# FPI Aviation Backend Implementation Plan

## Status

No SQL backend, database migrations, production Aviation API, or persistent backend storage was found. Do not install backend dependencies until the approved platform is confirmed.

## Recommended Database

Recommended options, in order:

1. Approved enterprise Postgres/SQL platform.
2. Firebase/Firestore only if Walmart platform direction prefers Firebase and a document schema is approved.
3. Approved internal API platform backed by a governed persistence service.

Because the app already has a Firebase scaffold but no active backend usage, the immediate implementation should stay backend-neutral through a provider abstraction.

## Required Tables / Collections

- `aviation_trip_plans`
- `aviation_trip_facilities`
- `aviation_readiness_actions`
- `aviation_trip_briefs`
- `aviation_audit_events`
- `aviation_feedback`
- `aviation_pilot_issues`
- `aviation_provider_status`
- `aviation_decision_log`
- `aviation_uat_runs`

## Required API Services

Minimum production API surface:

- `GET /aviation/trips`
- `POST /aviation/trips`
- `GET /aviation/trips/:tripId`
- `PATCH /aviation/trips/:tripId`
- `DELETE /aviation/trips/:tripId`
- `POST /aviation/trips/:tripId/duplicate`
- `GET /aviation/trips/:tripId/actions`
- `POST /aviation/trips/:tripId/actions`
- `PATCH /aviation/actions/:actionId`
- `POST /aviation/trips/:tripId/briefs`
- `GET /aviation/trips/:tripId/briefs`
- `POST /aviation/audit-events`
- `GET /aviation/audit-events`
- `GET /aviation/feedback`
- `POST /aviation/feedback`
- `PATCH /aviation/feedback/:feedbackId`
- `GET /aviation/issues`
- `POST /aviation/issues`
- `PATCH /aviation/issues/:issueId`
- `GET /aviation/provider-status`
- `PATCH /aviation/provider-status/:providerName`
- `GET /aviation/decisions`
- `POST /aviation/decisions`
- `PATCH /aviation/decisions/:decisionId`
- `GET /aviation/uat-runs`
- `POST /aviation/uat-runs`

## Provider Abstraction Approach

Create a backend-neutral persistence interface before implementing any database-specific code.

Suggested shape:

```ts
export type AviationPersistenceMode = 'localStorage' | 'api' | 'firebase' | 'disabled';

export interface AviationPersistenceProvider {
  getTrips(): Promise<AviationTripPlan[]>;
  getTripById(tripId: string): Promise<AviationTripPlan | null>;
  saveTrip(trip: AviationTripPlan): Promise<AviationTripPlan>;
  updateTrip(tripId: string, updates: Partial<AviationTripPlan>): Promise<AviationTripPlan>;
  duplicateTrip(tripId: string): Promise<AviationTripPlan>;
  deleteTrip(tripId: string): Promise<void>;
  recordAuditEvent(event: Omit<AviationAuditEvent, 'event_id' | 'timestamp'>): Promise<AviationAuditEvent>;
  getAuditEvents(filters?: { tripId?: string }): Promise<AviationAuditEvent[]>;
}
```

Then add separate implementations:

- `localStorageAviationPersistenceProvider` for current demo behavior.
- `apiAviationPersistenceProvider` for future enterprise API routes.
- `firebaseAviationPersistenceProvider` only if Firebase/Firestore is approved.

## Migration Path From localStorage to Backend

1. Keep localStorage as the default controlled-pilot fallback.
2. Add provider abstraction and route all current storage services through it.
3. Add export/import utility to read existing localStorage records and send them to backend when enabled.
4. Add backend-generated IDs when in production mode; continue accepting existing `TRIP-*`, `ACT-*`, and `AUD-*` demo IDs during migration if needed.
5. Add schema versioning to saved localStorage records.
6. Add a one-time migration UI or admin-only command after backend approval.

## Required Environment Variables

Examples; names should be finalized after backend selection:

```bash
VITE_AVIATION_PERSISTENCE_MODE=localStorage|api|firebase
VITE_AVIATION_API_BASE_URL=
VITE_AVIATION_PROVIDER_MODE=no_live_api_by_default
VITE_NOAA_ALERTS_ENDPOINT=
VITE_FAA_NOTAM_ENDPOINT=
VITE_FACILITY_MASTER_ENDPOINT=
VITE_ROUTING_ENDPOINT=
VITE_AUTH_PROVIDER=enterprise_sso|firebase|none
```

Server-side secrets must not be exposed through `VITE_*` variables.

## Security / RBAC Concerns

- Navigation and tab visibility are not permissions.
- Current Aviation role selector is demo-only.
- Production needs server-side role enforcement.
- Sensitive EP/traveler/security fields must be redacted by backend policy, not only frontend display checks.
- Audit events must include real user identity and immutable timestamps.
- Exports/briefs should be authorized and auditable.
- Provider admin/config changes should be restricted to approved admin roles.
- RLS policies or endpoint authorization must be reviewed before production.

## Recommended Next Implementation Task

Create the Aviation persistence provider abstraction while preserving localStorage as the default implementation. This prepares the codebase for approved API/Firebase persistence without changing the current controlled-pilot user experience.
