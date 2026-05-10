# Aviation Code and API Locator

## Aviation Page Entry Point

- Main page: `src/pages/AviationCommandCenter.tsx`
- Aviation components: `src/components/aviation/`
- Aviation domain types: `src/types/aviation.ts`
- Aviation services/connectors: `src/services/`

Playwright was not needed for this locator because the API calls and connectors are statically identifiable in the TypeScript source.

## API Client and Runtime Config

| Purpose | File | Key Lines |
|---|---|---:|
| API request wrapper | `src/services/aviationApiClient.ts` | 30, 55 |
| Query builder | `src/services/aviationApiClient.ts` | 16 |
| Runtime API base URL | `src/services/aviationRuntimeConfig.ts` | 16 |
| Persistence mode | `src/services/aviationRuntimeConfig.ts` | 20 |
| Environment mode | `src/services/aviationRuntimeConfig.ts` | 26 |
| API required / production guard | `src/services/aviationRuntimeConfig.ts` | 40 |
| Live provider flags | `src/services/aviationRuntimeConfig.ts` | 49-54 |
| Env typings | `src/vite-env.d.ts` | 4-13 |
| Example env config | `.env.aviation.example` | full file |

## Environment Variables

```bash
VITE_AVIATION_API_BASE_URL=
VITE_AVIATION_PERSISTENCE_MODE=localStorage|api|firebase|disabled
VITE_AVIATION_ENVIRONMENT_MODE=demo|pilot|production
VITE_AVIATION_API_REQUIRED=false
VITE_AVIATION_ENABLE_LIVE_FAA=false
VITE_AVIATION_ENABLE_LIVE_WEATHER=false
VITE_AVIATION_ENABLE_LIVE_FACILITIES=false
VITE_AVIATION_ENABLE_LIVE_ROUTING=false
VITE_AVIATION_ENABLE_LIVE_RISK=false
VITE_AVIATION_ENABLE_LIVE_REPORTS=false
```

## Located API Endpoints

### IAM / RBAC

| Endpoint | Method | Code Location |
|---|---:|---|
| `/me/aviation-permissions` | GET | `src/services/aviationIdentityService.ts:45` |

Related UI production role-selector logic:

- `src/pages/AviationCommandCenter.tsx`
- `src/services/aviationIdentityService.ts`
- `src/services/aviationAuthorizationService.ts`

### Airports

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/airports?status=active&limit=5000` | GET | `src/services/airportService.ts:26` |
| `/aviation/airports?query=&status=active&limit=` | GET | `src/services/airportService.ts:48` |
| `/aviation/airports/:airportId` | GET | `src/services/airportService.ts:75` |
| `/data/aviation/airports.json` fallback | GET | `src/services/airportService.ts:17` |

Static data location:

- `public/data/aviation/airports.json`
- `data/aviation/airports.json`

### Facilities

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/facilities?limit=10000` | GET | `src/services/facilityDataAdapter.ts:37` |

Fallback data:

- `data/facilities.json`

Geospatial/radius scan code:

- `src/services/facilityGeoService.ts`

### FAA / NOTAM

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/faa/alerts?airportId=&start=&end=` | GET | `src/services/faaService.ts:69` |

Fallback data:

- `data/aviation/faaAlerts.json`

### NOAA / Weather

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/weather/alerts?airportId=&lat=&lng=&start=&end=` | GET | `src/services/weatherService.ts:69` |

Fallback data:

- `data/aviation/weatherAlerts.json`

### Routing / Drive Time

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/routing/drive-time` | POST | `src/services/routingService.ts:27` |

Fallback/estimate code:

- `src/services/routingService.ts`
- `src/services/facilityGeoService.ts`

### Trips / Persistence

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/trips` | POST | `src/services/aviationTripStorageService.ts:44` |
| `/aviation/trips` | GET | `src/services/aviationTripStorageService.ts:56` |
| `/aviation/trips/:tripId` | GET | `src/services/aviationTripStorageService.ts:69` |
| `/aviation/trips/:tripId` | PATCH | `src/services/aviationTripStorageService.ts:78` |
| `/aviation/trips/:tripId/duplicate` | POST | `src/services/aviationTripStorageService.ts:92` |
| `/aviation/trips/:tripId` | DELETE | `src/services/aviationTripStorageService.ts:119` |

Local fallback key:

- `fpi_aviation_saved_trip_plans_v1`

### Audit Events

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/audit-events` | POST | `src/services/aviationAuditService.ts:51` |

Local fallback key:

- `fpi_aviation_audit_events`

### Feedback

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/feedback` | POST | `src/services/aviationFeedbackService.ts:20` |
| `/aviation/feedback/:feedbackId` | PATCH | `src/services/aviationFeedbackService.ts:23` |

Local fallback key:

- `fpi_aviation_pilot_feedback`

### Pilot Issues

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/issues` | POST | `src/services/aviationPilotIssueService.ts:21` |
| `/aviation/issues/:issueId` | PATCH | `src/services/aviationPilotIssueService.ts:23` |
| `/aviation/issues/:issueId` | DELETE | `src/services/aviationPilotIssueService.ts:24` |

Local fallback key:

- `fpi_aviation_pilot_issues`

### UAT Runs

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/uat-runs` | POST | `src/services/aviationPilotExecutionService.ts:59` |
| `/aviation/uat-runs/:uatId` | PATCH | `src/services/aviationPilotExecutionService.ts:74` |

Local fallback key:

- `fpi_aviation_pilot_uat_runs`

### Stakeholder Decisions

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/decisions` | POST | `src/services/aviationPilotExecutionService.ts:81` |
| `/aviation/decisions/:decisionId` | PATCH | `src/services/aviationPilotExecutionService.ts:96` |

Local fallback key:

- `fpi_aviation_stakeholder_decisions`

### Provider Status / Health

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/providers/status` | GET | `src/services/aviationProviderStatusService.ts:11` |
| `/aviation/providers/:providerName/test-connection` | POST | `src/services/aviationProviderStatusService.ts:16` |
| `/aviation/providers/:providerName` | PATCH | `src/services/aviationProviderStatusService.ts:21` |

Static provider config:

- `src/services/aviationProviderConfig.ts`

### Official Risk, Actions, Briefs, Exports

| Endpoint | Method | Code Location |
|---|---:|---|
| `/aviation/risk/score-trip` | POST | `src/services/aviationOfficialRecordService.ts:5` |
| `/aviation/trips/:tripId/readiness-actions/generate` | POST | `src/services/aviationOfficialRecordService.ts:9` |
| `/aviation/trips/:tripId/briefs` | POST | `src/services/aviationOfficialRecordService.ts:16` |
| `/aviation/briefs/:briefId/export?format=txt|pdf|docx` | GET | `src/services/aviationOfficialRecordService.ts:20` |

Current local/client-side generators:

- Risk scoring: `src/services/aviationRiskEngine.ts`
- Readiness actions: `src/services/readinessActionService.ts`
- Trip brief: `src/services/tripBriefService.ts`
- Handoff packet: `src/services/aviationHandoffPacketService.ts`
- Pilot readout: `src/services/aviationReadoutReportService.ts`

## External Live APIs Not Directly Called by Frontend

The frontend does **not** directly call external NOAA, FAA, routing, Walmart facility master, EP, incident, or IAM systems. The code expects those to be proxied through the configured backend base URL:

```bash
VITE_AVIATION_API_BASE_URL=https://approved-backend.example.com
```

That means the effective live URLs are constructed as:

```text
${VITE_AVIATION_API_BASE_URL}/aviation/weather/alerts
${VITE_AVIATION_API_BASE_URL}/aviation/faa/alerts
${VITE_AVIATION_API_BASE_URL}/aviation/facilities
${VITE_AVIATION_API_BASE_URL}/aviation/routing/drive-time
...
```

## Local/Seeded Fallback Data Locations

| Data | File |
|---|---|
| Airports | `public/data/aviation/airports.json` |
| Airports source copy | `data/aviation/airports.json` |
| Facilities | `data/facilities.json` |
| FAA alerts | `data/aviation/faaAlerts.json` |
| Weather alerts | `data/aviation/weatherAlerts.json` |
| Empty trip plans seed | `data/aviation/tripPlans.json` |
| Empty readiness actions seed | `data/aviation/tripReadinessActions.json` |
| Empty trip briefs seed | `data/aviation/tripBriefs.json` |
| Empty risk scores seed | `data/aviation/tripRiskScores.json` |

## LocalStorage Keys

| Purpose | Key | Service |
|---|---|---|
| Saved trips | `fpi_aviation_saved_trip_plans_v1` | `aviationTripStorageService.ts` |
| Audit events | `fpi_aviation_audit_events` | `aviationAuditService.ts` |
| Feedback | `fpi_aviation_pilot_feedback` | `aviationFeedbackService.ts` |
| Pilot issues | `fpi_aviation_pilot_issues` | `aviationPilotIssueService.ts` |
| UAT runs | `fpi_aviation_pilot_uat_runs` | `aviationPilotExecutionService.ts` |
| Stakeholder decisions | `fpi_aviation_stakeholder_decisions` | `aviationPilotExecutionService.ts` |
| Aviation tab preferences | `fpi_aviation_tab_preferences` | `aviationTabPreferenceService.ts` |
| Auth token lookup | `fpi_aviation_auth_token` | `aviationRuntimeConfig.ts` |

## How to Enable API Mode Locally

Create `.env.local` from `.env.aviation.example` and set:

```bash
VITE_AVIATION_ENVIRONMENT_MODE=pilot
VITE_AVIATION_PERSISTENCE_MODE=api
VITE_AVIATION_API_BASE_URL=http://localhost:3000
VITE_AVIATION_ENABLE_LIVE_FAA=true
VITE_AVIATION_ENABLE_LIVE_WEATHER=true
VITE_AVIATION_ENABLE_LIVE_FACILITIES=true
VITE_AVIATION_ENABLE_LIVE_ROUTING=true
```

Then the frontend will call the listed backend routes. If the backend is absent and API is not required, it falls back to demo data/localStorage where applicable.
