# FPI Aviation Backend Readiness Assessment

## 1. Executive Summary

The Aviation Travel Readiness tab is currently **frontend-demo / controlled-pilot only** with service-layer abstractions that make it partially backend-ready. It does not have production persistence, production authentication, production RBAC enforcement, or live approved FAA/NOAA/facility/routing integrations.

The root application is a Vite React frontend. A Firebase Functions scaffold exists in `functions/`, but no active application API, Firestore schema, aviation endpoints, or SQL database is implemented. Aviation state is primarily held in React state and browser `localStorage`; source data comes from static JSON and seeded demo data.

## 2. Current Storage Model

### Browser localStorage

Aviation localStorage-backed data includes:

- Saved trips: `src/services/aviationTripStorageService.ts`
  - key: `fpi_aviation_saved_trip_plans_v1`
  - used by `src/pages/AviationCommandCenter.tsx`, `SavedTripsPanel`, `AviationTripDetail`, metrics/readout/handoff components.
- Audit events: `src/services/aviationAuditService.ts`
  - key: `fpi_aviation_audit_events`
  - capped at 500 records.
- Pilot feedback: `src/services/aviationFeedbackService.ts`
  - localStorage-backed feedback records.
- Pilot issues: `src/services/aviationPilotIssueService.ts`
  - localStorage-backed issue tracker.
- Pilot UAT runs and stakeholder decisions: `src/services/aviationPilotExecutionService.ts`
  - localStorage-backed UAT/decision records.
- Aviation sub-tab preferences: `src/services/aviationTabPreferenceService.ts`
  - key: `fpi_aviation_tab_preferences`.
- NOAA live readiness last-success placeholder: `NoaaLiveIntegrationReadinessPanel.tsx`
  - key: `fpi_aviation_noaa_last_successful_fetch`.

### Static JSON / seeded data

- Airport data is loaded from static JSON via `src/services/airportService.ts`; provider config describes this as `static_json` from `public/data/aviation/airports.json`.
- Facility data is loaded from `data/facilities.json` through `src/services/facilityDataAdapter.ts` and normalized for aviation scans.
- FAA alerts are seeded from `data/aviation/faaAlerts.json` via `src/services/faaService.ts`.
- NOAA/weather alerts are seeded from `data/aviation/weatherAlerts.json` via `src/services/weatherService.ts`.
- FPI risk and EP readiness are currently derived from seeded facility fields and frontend calculations.

### React state only

Some in-session state is held in `AviationCommandCenter.tsx`, including selected airport, selected trip, nearby facilities, current role, risk result, readiness actions, current FAA/weather result, and active aviation sub-tab. Readiness actions are embedded into saved trip plans when trips are saved.

### Real backend

No real backend persistence was found for Aviation. No Aviation API routes, database client, Firestore use, SQL migrations, or backend storage calls currently persist Aviation records.

## 3. SQL / Backend Findings

No SQL backend implementation is present in the root app dependencies. No SQL migrations, Prisma, Drizzle, TypeORM, Knex, Postgres client, SQLite package, or SQL table definitions were found.

A Firebase scaffold exists:

- `firebase.json`
- `.firebaserc`
- `functions/package.json`
- `functions/index.js`
- `functions/main.py`

The Firebase Functions code is starter/example scaffold only. It does not currently expose active Aviation endpoints or initialize an application persistence model.

## 4. API / Service Layer Findings

The current frontend uses plain TypeScript service functions rather than API route calls or backend clients. No `fetch(` usage, Axios usage, `/api/` calls, React Query/TanStack Query, or service-class backend client pattern was found in `src`.

Current pattern:

- UI components call local service functions directly.
- Service functions read static JSON, use localStorage, or return seeded/stubbed values.
- Provider behavior is centralized in `src/services/aviationProviderConfig.ts`.
- Live provider paths exist as stubs in FAA/weather/facility/routing services, guarded by provider mode and enabled flags.

Recommended clean pattern for Aviation backend integration:

1. Add an Aviation persistence provider abstraction first.
2. Keep current localStorage implementation as `localStorage`/demo provider.
3. Add a future `api` or `firebase` implementation behind the same interface.
4. Gate provider selection with environment/config values.
5. Avoid wiring UI components directly to database clients.

## 5. Auth / RBAC Findings

RBAC is currently **frontend/demo only** for Aviation.

Findings:

- `src/services/aviationAuthorizationService.ts` maps `AviationUserRole` values to permissions in frontend code.
- `src/pages/AviationCommandCenter.tsx` uses a local role selector initialized to `aviation_admin`.
- No real user object was found.
- No SSO integration was found.
- No Firebase Auth, OIDC, SAML, JWT validation, session validation, or backend authorization enforcement was found.
- Aviation role state is not persisted as a real authenticated identity; it is a local UI selector.
- General app settings explicitly state: `No backend, auth, write-back, dispatch, or production integrations are enabled.` in `src/components/views/SettingsView.tsx`.

Production RBAC needs:

- Enterprise auth/SSO user identity.
- User-to-role mapping from an approved IAM source.
- Server-side authorization checks for all read/write/export/admin actions.
- Auditable user identifiers, not just actor role strings.
- Backend enforcement for EP-sensitive fields, provider controls, exports, trip closure, issue updates, and admin/governance actions.
- Row-level or endpoint-level authorization rules for trip ownership, role scope, and sensitive fields.

## 6. Connector Findings

### Airports

- Current provider: `airportProvider`
- Mode: `static_json`
- Status: `ok`
- Source: runtime-loaded static airport JSON.
- Live API: not implemented.
- Fallback: static JSON only.
- Source/confidence labels: yes, through provider config and airport records.

### Facilities

- Current provider: `facilityProvider`
- Mode: `seeded_demo`
- Status: `partial`
- Source: `data/facilities.json` seeded/demo records.
- Live API: stub exists as `getFacilitiesFromFacilityMasterStub()` but returns an empty array.
- Fallback: seeded facilities.
- Failure handling: safe fallback because live mode is not active by default.
- Source/confidence labels: yes via provider config and facility `source_freshness`.

### FPI risk

- Current provider: `fpiRiskProvider`
- Mode: `seeded_demo`
- Status: `partial`
- Risk is calculated in frontend from nearby facilities, FAA alerts, weather alerts, and source confidence.
- Live API: not implemented.
- Fallback: seeded/demo risk posture.
- Source/confidence labels: yes in risk domain breakdown and provider config.

### FAA / NOTAM

- Current provider: `faaProvider`
- Mode: `seeded_demo`
- Status: `partial`
- Source: `data/aviation/faaAlerts.json`.
- Live API: stub exists as `getFAAAlertsForAirportLive()` and returns `no_data` with an explanatory error.
- Guard: live path only if provider mode is `live_api` and enabled.
- Fallback: seeded FAA alerts.
- Failure handling: catches provider errors and returns `status: error` safely.
- Source/confidence labels: yes.

### NOAA / weather

- Current provider: `weatherProvider`
- Mode: `seeded_demo`
- Status: `partial`
- Source: `data/aviation/weatherAlerts.json`.
- Live API: stub exists as `getWeatherAlertsForAirportLive()` and returns `no_data` with an explanatory error.
- Guard: live path only if provider mode is `live_api` and enabled.
- Fallback: seeded NOAA/weather alerts.
- Failure handling: catches provider errors and returns `status: error` safely.
- Source/confidence labels: yes.

### Routing

- Current provider: `routingProvider`
- Mode: `live_api_pending`
- Status: `pending`
- Current behavior: estimated drive time from straight-line distance.
- Live API: stub exists as `getDriveTimeFromRoutingProviderStub()` but no endpoint is configured.
- Fallback: estimated drive time.
- Source/confidence labels: yes.

### Audit

- Current provider: `auditProvider`
- Mode: `localStorage`
- Status: `partial`
- Storage: browser localStorage.
- Production backend: not implemented.

### Persistence

- Current provider: `persistenceProvider`
- Mode: `localStorage`
- Status: `ok` for prototype/demo.
- Production backend: not implemented.

## 7. Production Gaps

Missing for live production use:

1. Approved backend persistence for trips, facilities-in-trip snapshots, readiness actions, briefs, feedback, issues, audit events, UAT, and decisions.
2. Real authentication / SSO integration.
3. Server-side RBAC and audit identity.
4. Approved database schema and retention policy.
5. API layer or backend client abstraction for Aviation persistence.
6. Approved live NOAA/weather endpoint/proxy.
7. Approved FAA/NOTAM source.
8. Approved Walmart facility master integration.
9. Approved routing/drive-time provider.
10. Approved incident/safety provider if required.
11. Production audit/event logging target.
12. Data classification and sensitive field handling.
13. Error telemetry and monitoring.
14. Environment variables for backend endpoints, provider modes, and auth.
15. Migration path from localStorage to backend.

## 8. Recommended Backend Path

Because no SQL/backend persistence implementation exists and the app currently uses frontend service functions, the recommended next step is a **generic Aviation persistence provider abstraction first**.

Recommended path:

1. Define `aviationPersistenceProvider` interfaces for trips, actions, briefs, audit, feedback, issues, UAT, and decisions.
2. Move current localStorage logic behind a `localStorageAviationPersistenceProvider`.
3. Add provider selection through config/env, defaulting to localStorage for demo mode.
4. Add a future `apiAviationPersistenceProvider` or `firebaseAviationPersistenceProvider` without changing UI components.
5. Once enterprise backend choice is approved, implement API routes or approved database persistence behind the abstraction.

Database recommendation: use an approved enterprise Postgres/SQL platform, internal API platform, or Firebase/Firestore if Walmart platform direction requires it. Adapt the same provider interface to the approved backend.

## 9. Recommended Tables

Required Aviation persistence tables/collections:

1. `aviation_trip_plans`
   - trip metadata, airport snapshot, trip window, radius, status, risk score, confidence, source freshness, created/updated metadata.
2. `aviation_trip_facilities`
   - trip-to-facility snapshots, distance, drive time, risk band, top driver, support candidate, source freshness.
3. `aviation_readiness_actions`
   - generated/assigned actions, owner role, priority, due time, status, source driver, evidence requirement, closure fields.
4. `aviation_trip_briefs`
   - generated brief body, format, export status, source/confidence notice, generated_by, timestamps.
5. `aviation_audit_events`
   - event type, user ID, actor role, trip ID, airport ID, summary, source context, metadata, timestamp.
6. `aviation_feedback`
   - stakeholder feedback category/severity/status/details and linked trip.
7. `aviation_pilot_issues`
   - pilot issue tracker records linked to feedback/trips.
8. `aviation_provider_status`
   - provider mode/status/source/confidence/last successful fetch/error metadata.
9. `aviation_decision_log`
   - stakeholder decisions, decision type/status/owner/follow-up/due date.
10. `aviation_uat_runs`
   - pilot UAT session results, scenario, stakeholder role, issues, notes.

## 10. Recommended Next Build Tasks

Priority order:

1. Create Aviation persistence provider interfaces and localStorage implementation wrapper.
2. Refactor `aviationTripStorageService`, `aviationAuditService`, `aviationFeedbackService`, `aviationPilotIssueService`, and `aviationPilotExecutionService` to use the provider abstraction.
3. Add configuration for persistence mode: `localStorage`, `api`, `firebase`, or `disabled`.
4. Create DTO/schema definitions for trips, actions, audit events, feedback, issues, UAT, and decisions.
5. Draft SQL schema or API contract once backend platform is approved.
6. Add server-side RBAC integration with real user identity.
7. Add backend audit event write path.
8. Add production migration/import utility from localStorage demo records.
9. Implement live provider proxies only after NOAA/FAA/facility/routing sources are approved.
10. Add integration tests for provider fallback behavior and RBAC-sensitive outputs.

## Files Inspected

- `package.json`
- `package-lock.json` search results
- `firebase.json`
- `functions/package.json`
- `functions/index.js`
- `functions/main.py`
- `src/App.tsx`
- `src/components/views/SettingsView.tsx` search result
- `src/pages/AviationCommandCenter.tsx`
- `src/services/airportService.ts`
- `src/services/aviationAuditService.ts`
- `src/services/aviationAuthorizationService.ts`
- `src/services/aviationFeedbackService.ts`
- `src/services/aviationPilotConfig.ts`
- `src/services/aviationPilotExecutionService.ts`
- `src/services/aviationPilotIssueService.ts`
- `src/services/aviationProviderConfig.ts`
- `src/services/aviationReadoutReportService.ts`
- `src/services/aviationTripStorageService.ts`
- `src/services/faaService.ts`
- `src/services/facilityDataAdapter.ts`
- `src/services/facilityGeoService.ts`
- `src/services/readinessActionService.ts`
- `src/services/routingService.ts`
- `src/services/tripBriefService.ts`
- `src/services/weatherService.ts`
- Aviation components under `src/components/aviation/`
