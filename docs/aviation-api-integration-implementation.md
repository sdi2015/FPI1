# Aviation API Integration Implementation

## Current Implementation

The Aviation page now has a backend-ready frontend API layer. The implementation keeps demo/local behavior as the default while allowing approved backend APIs to be enabled through environment variables.

Internet access and approved external API credentials are not embedded in the client. NOAA, FAA/NOTAM, routing, EP, and incident integrations must be routed through an approved backend API/proxy before live use.

## Runtime Configuration

Example file:

- `.env.aviation.example`

Supported variables:

```bash
VITE_AVIATION_ENVIRONMENT_MODE=demo|pilot|production
VITE_AVIATION_PERSISTENCE_MODE=localStorage|api|firebase|disabled
VITE_AVIATION_API_BASE_URL=
VITE_AVIATION_API_REQUIRED=false
VITE_AVIATION_ENABLE_LIVE_FAA=false
VITE_AVIATION_ENABLE_LIVE_WEATHER=false
VITE_AVIATION_ENABLE_LIVE_FACILITIES=false
VITE_AVIATION_ENABLE_LIVE_ROUTING=false
VITE_AVIATION_ENABLE_LIVE_RISK=false
VITE_AVIATION_ENABLE_LIVE_REPORTS=false
```

Default behavior remains local/demo unless these variables are configured.

## Added Frontend Infrastructure

### API Client

File:

- `src/services/aviationApiClient.ts`

Provides:

- `aviationApiRequest<T>()`
- `tryAviationApiRequest<T>()`
- `buildQuery()`

All Aviation backend calls now go through this client.

### Runtime Config

File:

- `src/services/aviationRuntimeConfig.ts`

Provides:

- API base URL detection
- persistence mode detection
- environment mode detection
- production mode detection
- live provider feature flags
- auth token lookup from browser storage for approved backend tokens

### IAM / RBAC Adapter

File:

- `src/services/aviationIdentityService.ts`

Endpoint expected:

- `GET /me/aviation-permissions`

Production behavior:

- Local role selector is hidden in production mode.
- Role should come from enterprise IAM/backend permissions.

Demo behavior:

- Falls back to the existing demo role if API is not configured.

### Provider Status API Adapter

File:

- `src/services/aviationProviderStatusService.ts`

Endpoints expected:

- `GET /aviation/providers/status`
- `PATCH /aviation/providers/:providerName`
- `POST /aviation/providers/:providerName/test-connection`

### Official Record API Helpers

File:

- `src/services/aviationOfficialRecordService.ts`

Endpoints expected:

- `POST /aviation/risk/score-trip`
- `POST /aviation/trips/:tripId/readiness-actions/generate`
- `POST /aviation/trips/:tripId/briefs`
- `GET /aviation/briefs/:briefId/export?format=txt|pdf|docx`

These helpers are available for switching official risk/actions/briefs to backend-generated records when approved.

## Updated Existing Connectors

### Trip Persistence

File:

- `src/services/aviationTripStorageService.ts`

When `VITE_AVIATION_PERSISTENCE_MODE=api` and `VITE_AVIATION_API_BASE_URL` is set, trip persistence attempts API calls first:

- `GET /aviation/trips`
- `POST /aviation/trips`
- `GET /aviation/trips/:tripId`
- `PATCH /aviation/trips/:tripId`
- `DELETE /aviation/trips/:tripId`
- `POST /aviation/trips/:tripId/duplicate`

LocalStorage remains a fallback unless API is required/production.

### Audit Logging

File:

- `src/services/aviationAuditService.ts`

When API persistence is enabled, audit events are posted to:

- `POST /aviation/audit-events`

The local audit timeline remains available in demo mode.

### Airport API

File:

- `src/services/airportService.ts`

Attempts API first when configured:

- `GET /aviation/airports?query=&status=active&limit=`
- `GET /aviation/airports/:airportId`

Falls back to:

- `/data/aviation/airports.json`

### Facility API

File:

- `src/services/facilityDataAdapter.ts`

When live facilities are enabled, attempts:

- `GET /aviation/facilities?limit=10000`

Falls back to seeded facility data if not configured or empty.

### FAA / NOTAM API

File:

- `src/services/faaService.ts`

When `VITE_AVIATION_ENABLE_LIVE_FAA=true`, attempts:

- `GET /aviation/faa/alerts?airportId=&start=&end=`

Falls back to seeded FAA data when live provider is not enabled.

### NOAA / Weather API

File:

- `src/services/weatherService.ts`

When `VITE_AVIATION_ENABLE_LIVE_WEATHER=true`, attempts:

- `GET /aviation/weather/alerts?airportId=&lat=&lng=&start=&end=`

Falls back to seeded weather data when live provider is not enabled.

### Routing API

File:

- `src/services/routingService.ts`

When `VITE_AVIATION_ENABLE_LIVE_ROUTING=true`, attempts:

- `POST /aviation/routing/drive-time`

Falls back to straight-line estimated drive time.

### Provider Config Runtime Overrides

File:

- `src/services/aviationProviderConfig.ts`

Provider status now reflects runtime flags. Live provider modes are shown only when the approved API base URL and provider-specific flag are enabled.

### Feedback / Issues / UAT / Decisions

Files:

- `src/services/aviationFeedbackService.ts`
- `src/services/aviationPilotIssueService.ts`
- `src/services/aviationPilotExecutionService.ts`

When API persistence is enabled, creates/updates are mirrored to API endpoints:

- `POST /aviation/feedback`
- `PATCH /aviation/feedback/:feedbackId`
- `POST /aviation/issues`
- `PATCH /aviation/issues/:issueId`
- `DELETE /aviation/issues/:issueId`
- `POST /aviation/uat-runs`
- `PATCH /aviation/uat-runs/:uatId`
- `POST /aviation/decisions`
- `PATCH /aviation/decisions/:decisionId`

## Backend API Contract Summary

A backend compatible with this frontend should implement:

### IAM

- `GET /me/aviation-permissions`

### Airports

- `GET /aviation/airports`
- `GET /aviation/airports/:airportId`

### Facilities

- `GET /aviation/facilities`
- Optional: `GET /aviation/facilities/nearby`

### Weather / FAA

- `GET /aviation/weather/alerts`
- `GET /aviation/faa/alerts`

### Routing

- `POST /aviation/routing/drive-time`

### Trips

- `GET /aviation/trips`
- `POST /aviation/trips`
- `GET /aviation/trips/:tripId`
- `PATCH /aviation/trips/:tripId`
- `DELETE /aviation/trips/:tripId`
- `POST /aviation/trips/:tripId/duplicate`

### Risk / Actions / Briefs

- `POST /aviation/risk/score-trip`
- `POST /aviation/trips/:tripId/readiness-actions/generate`
- `POST /aviation/trips/:tripId/briefs`
- `GET /aviation/briefs/:briefId/export`

### Audit

- `POST /aviation/audit-events`
- `GET /aviation/trips/:tripId/audit-events`

### Governance / Pilot Management

- `GET/POST/PATCH /aviation/feedback`
- `GET/POST/PATCH/DELETE /aviation/issues`
- `GET/POST/PATCH /aviation/uat-runs`
- `GET/POST/PATCH /aviation/decisions`
- `GET/PATCH /aviation/providers/status`
- `POST /aviation/providers/:providerName/test-connection`

## What Still Requires External Approval

The code is now ready to call approved backend endpoints, but these live sources still require data-owner approval and backend/proxy implementation:

- NOAA/weather live endpoint
- FAA/NOTAM live endpoint
- Walmart facility master endpoint
- FPI risk posture data
- EP readiness data
- Incident/safety data
- Routing provider
- Enterprise IAM provider
- Enterprise audit/event logging destination
- Official brief/report export service

No frontend code should directly call external NOAA, FAA, routing, or sensitive Walmart/internal systems. Calls should go through the approved Aviation API backend.
