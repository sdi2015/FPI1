# Aviation Page Connector and API Map

## Purpose

This document locates every data connector, service, and production API needed for the Aviation Travel Readiness page to function beyond controlled demo/local mode.

Current page entry point:

- `src/pages/AviationCommandCenter.tsx`

Current architecture:

- React UI calls frontend TypeScript services directly.
- Current data is static JSON, seeded JSON, calculated in-browser, or saved to browser `localStorage`.
- No production backend API is currently wired for Aviation.
- Live API branches exist for some providers, but they are stubs or gated off by provider config.

## Aviation Page Flow

`AviationCommandCenter.tsx` coordinates the full page:

1. Load facility source data.
2. Search/select airport.
3. Load FAA and weather signals for selected airport/trip window.
4. Scan nearby Walmart facilities within radius.
5. Calculate FPI trip risk score.
6. Generate readiness actions.
7. Generate trip brief/report content.
8. Save/open/duplicate/delete trip plans.
9. Record audit events.
10. Capture pilot feedback, issues, UAT runs, and stakeholder decisions.
11. Show admin/governance/provider status panels.

## Connector Inventory

| Connector / API | Current Location | Current Mode | Needed For | Production API Needed |
|---|---|---:|---|---|
| Airport data | `src/services/airportService.ts` | Static JSON via `/data/aviation/airports.json` | Airport search, selected airport, geo scan origin | Yes, if static JSON is not approved long-term |
| Walmart Facility Master | `src/services/facilityDataAdapter.ts` | Seeded demo JSON | Nearby facility scan, facility risk, support candidate | Yes |
| Facility geospatial scan | `src/services/facilityGeoService.ts` | In-browser calculation | Radius scan around airport | Optional backend API for scale/governance |
| FPI risk posture | `src/services/aviationRiskEngine.ts` plus facility fields | In-browser calculated from seeded/demo fields | Risk score, recommendations, drivers | Yes, if risk inputs/model must be governed server-side |
| FAA / NOTAM | `src/services/faaService.ts` | Seeded JSON; live stub | FAA watch panel, risk score, readiness actions | Yes |
| NOAA / weather | `src/services/weatherService.ts` | Seeded JSON; live stub | Weather panel, risk score, readiness actions | Yes |
| Routing / drive time | `src/services/routingService.ts` | Straight-line estimate; live stub | Facility travel time / support planning | Yes |
| EP readiness | Facility fields + `aviationProviderConfig.ts` | Seeded facility field | Sensitive EP readiness controls and actions | Yes |
| Incident / safety | `aviationProviderConfig.ts` only | Unavailable placeholder | Incident/safety risk domain | Yes, if included in production score |
| Trip persistence | `src/services/aviationTripStorageService.ts` | Browser localStorage | Saved trips, trip detail, metrics, reports | Yes |
| Audit logging | `src/services/aviationAuditService.ts` | Browser localStorage | Audit timeline, reports, governance | Yes |
| Feedback | `src/services/aviationFeedbackService.ts` | Browser localStorage | Pilot feedback panel, reports, metrics | Yes for pilot/prod |
| Issues | `src/services/aviationPilotIssueService.ts` | Browser localStorage | Pilot issue tracker, readout reports | Yes for pilot/prod |
| UAT runs | `src/services/aviationPilotExecutionService.ts` | Browser localStorage | UAT evidence, readout reports | Yes for pilot/prod |
| Stakeholder decisions | `src/services/aviationPilotExecutionService.ts` | Browser localStorage | Integration/data-source decision log | Yes for pilot/prod |
| IAM / RBAC | `src/services/aviationAuthorizationService.ts` | Local role selector | Role-based redaction/actions | Yes, required before production |
| Provider status/config | `src/services/aviationProviderConfig.ts` | Static frontend config | Integration status/admin panels | Yes for governed production operations |
| Brief/report generation | `src/services/tripBriefService.ts`, `aviationReadoutReportService.ts`, `aviationHandoffPacketService.ts` | Client-side text generation | Briefs, handoff packets, readouts | Optional backend API for auditable official exports |

## Current Connector Details

### 1. Airport Data Connector

Current files:

- `src/services/airportService.ts`
- `public/data/aviation/airports.json`
- `data/aviation/airports.json`

Current behavior:

- Uses `fetch('/data/aviation/airports.json')`.
- Caches airports in memory.
- Supports search by airport name, city, state, FAA ID, IATA code, ICAO code, and airport type.
- `getAirportById('AIR-XNA')` supports demo scenario launch.

Current required data shape:

```ts
Airport = {
  airport_id: string;
  faa_id?: string;
  iata_code?: string;
  icao_code?: string;
  airport_name: string;
  airport_type?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'inactive' | 'unknown';
  source_freshness: SourceFreshness;
  last_updated: string;
}
```

Production API candidates:

- `GET /aviation/airports?query=&status=active&limit=50`
- `GET /aviation/airports/:airportId`

Needed production controls:

- Approved airport source.
- Refresh cadence.
- Source timestamp.
- Status handling for inactive/closed airports.
- Server-side search if static JSON size becomes an issue.

### 2. Walmart Facility Master Connector

Current files:

- `src/services/facilityDataAdapter.ts`
- `data/facilities.json`

Current behavior:

- Imports seeded facility records from `data/facilities.json`.
- Normalizes records with `normalizeFacility()`.
- `getFacilitiesFromFacilityMasterStub()` exists but returns `[]`.
- `getFacilitiesForAviationScan()` filters facilities without lat/lon.

Current required data shape:

```ts
NormalizedFacility = {
  facility_id: string;
  facility_number?: string;
  facility_name: string;
  facility_type: 'Walmart Supercenter' | 'Neighborhood Market' | "Sam's Club" | 'Distribution Center' | 'Fulfillment Center' | 'Corporate / Critical Support' | 'Other';
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  facility_risk_score: number;
  facility_risk_band: FacilityRiskBand;
  top_risk_driver: string;
  ep_readiness_status: 'Stable' | 'Watch' | 'Gap' | 'Unknown' | 'Restricted';
  aviation_support_candidate: boolean;
  source_freshness: ProviderSourceStatus;
}
```

Production API candidates:

- `GET /aviation/facilities?bounds=&types=&status=&limit=`
- `GET /aviation/facilities/nearby?airportId=&lat=&lng=&radiusMiles=&types=`
- `GET /aviation/facilities/:facilityId`

Needed production controls:

- Approved facility master source.
- Exact field mapping for facility ID, facility number, banner/type, city/state, lat/lon.
- Refresh cadence and source timestamp.
- Rules for excluding closed/private/non-operational facilities.
- Sensitive field classification.

### 3. Facility Radius / Geospatial Scan

Current file:

- `src/services/facilityGeoService.ts`

Current behavior:

- Calculates distance in browser.
- Filters facilities by radius and selected facility types.
- Returns sorted nearby facilities.

Production API candidates:

- `POST /aviation/scans/facilities`

Example request:

```json
{
  "airport_id": "AIR-XNA",
  "latitude": 36.2819,
  "longitude": -94.3068,
  "radius_miles": 25,
  "facility_types": ["Distribution Center", "Walmart Supercenter"]
}
```

Example response:

```json
{
  "scan_id": "SCAN-...",
  "source_freshness": "live",
  "facilities": []
}
```

Backend version is recommended if facility counts become large, if access rules vary by user, or if scan results need to be auditable snapshots.

### 4. FPI Risk Posture / Risk Engine

Current files:

- `src/services/aviationRiskEngine.ts`
- `src/services/readinessActionService.ts`
- `src/types/aviation.ts`

Current behavior:

- Risk is calculated in browser from:
  - nearby facility risk scores/bands
  - EP readiness fields
  - FAA alert severity
  - weather alert severity
  - missing/stale data confidence
  - support/staging candidate presence
- `fpiRiskProvider` is configured as `seeded_demo`.

Production API candidates:

- `POST /aviation/risk/score-trip`
- `GET /aviation/trips/:tripId/risk`
- `POST /aviation/trips/:tripId/readiness-actions/generate`

Needed production controls:

- Approved scoring model owner.
- Versioned scoring algorithm.
- Server-side risk calculation if recommendations become official record.
- Traceable input snapshots.
- Human decision disclaimer retained.
- Model validation and sign-off.

### 5. FAA / NOTAM Connector

Current file:

- `src/services/faaService.ts`
- `data/aviation/faaAlerts.json`

Current behavior:

- Seeded FAA alerts are filtered by airport and trip window.
- `getFAAAlertsForAirportLive()` exists but returns no data with a message that no approved endpoint is configured.
- Live path only runs if provider mode is `live_api` and enabled.

Current required data shape:

```ts
FAAAlert = {
  alert_id: string;
  airport_id: string;
  alert_type: string;
  severity: RiskBand;
  title: string;
  summary: string;
  effective_start: string;
  effective_end: string;
  source: 'FAA';
  source_url?: string | null;
  confidence: number;
  status: 'active' | 'inactive' | 'expired';
}
```

Production API candidates:

- `GET /aviation/faa/alerts?airportId=&start=&end=`
- `GET /aviation/faa/notams?airportCode=&start=&end=`

Needed production controls:

- Approved FAA/NOTAM source/provider.
- Usage terms and attribution.
- Refresh cadence.
- Severity normalization rules.
- Outage/fallback behavior.
- Cache and rate-limit strategy.

### 6. NOAA / Weather Connector

Current file:

- `src/services/weatherService.ts`
- `data/aviation/weatherAlerts.json`
- `src/components/aviation/NoaaLiveIntegrationReadinessPanel.tsx`

Current behavior:

- Seeded weather alerts are filtered by airport and trip window.
- `getWeatherAlertsForAirportLive()` exists but returns no data with a message that no approved endpoint is configured.
- Live path only runs if provider mode is `live_api` and enabled.
- NOAA readiness panel tracks a local `fpi_aviation_noaa_last_successful_fetch` placeholder.

Current required data shape:

```ts
WeatherAlert = {
  weather_alert_id: string;
  airport_id: string;
  affected_facility_ids: string[];
  alert_type: string;
  severity: RiskBand;
  summary: string;
  effective_start: string;
  effective_end: string;
  source: 'NOAA';
  source_url?: string | null;
  confidence: number;
  status: 'active' | 'inactive' | 'expired';
}
```

Production API candidates:

- `GET /aviation/weather/alerts?airportId=&lat=&lng=&start=&end=`
- `GET /aviation/weather/forecast?lat=&lng=&start=&end=`

Needed production controls:

- Approved NOAA endpoint/proxy.
- Forecast vs alert distinction.
- Refresh cadence.
- Severity normalization rules.
- Attribution rules.
- Cache and rate-limit strategy.
- Fallback to seeded/demo only for non-production/demo mode.

### 7. Routing / Drive-Time Connector

Current file:

- `src/services/routingService.ts`

Current behavior:

- Estimates drive time from straight-line distance using 35 mph average speed.
- Live routing stub exists but has no endpoint.
- `routingProvider` is `live_api_pending`.

Production API candidates:

- `POST /aviation/routing/drive-time`
- `POST /aviation/routing/matrix`

Example request:

```json
{
  "origin": { "latitude": 36.2819, "longitude": -94.3068 },
  "destinations": [
    { "facility_id": "FAC-123", "latitude": 36.37, "longitude": -94.21 }
  ]
}
```

Needed production controls:

- Approved routing provider.
- Cost controls and rate limits.
- Caching.
- Handling for unavailable road routes.
- Drive time timestamp and confidence.

### 8. EP Readiness Connector

Current files:

- `src/types/aviation.ts`
- `src/services/facilityDataAdapter.ts`
- `src/services/aviationAuthorizationService.ts`
- `src/components/aviation/NearbyFacilitiesTable.tsx`
- `src/components/aviation/TripReadinessActions.tsx`

Current behavior:

- EP readiness is a field on seeded facility records.
- Frontend RBAC hides or redacts some EP-sensitive content.
- No production EP checklist/source exists.

Production API candidates:

- `GET /aviation/ep-readiness?facilityIds=&tripId=`
- `GET /aviation/trips/:tripId/ep-readiness`
- `PATCH /aviation/readiness-actions/:actionId/evidence`

Needed production controls:

- EP data owner approval.
- Minimum safe fields for pilot.
- Server-side redaction by role.
- No sensitive itinerary/traveler data unless authorized.
- Audit every access and export.

### 9. Incident / Safety Connector

Current files:

- `src/services/aviationProviderConfig.ts`
- `src/services/aviationRiskEngine.ts`

Current behavior:

- Provider exists as `incidentProvider` but is `unavailable` and disabled.
- Risk engine only uses a placeholder based on facility driver text containing `incident`.

Production API candidates:

- `GET /aviation/incidents?facilityIds=&airportId=&start=&end=&radiusMiles=`
- `GET /aviation/safety-signals?facilityIds=&lookbackDays=`

Needed production controls:

- Approved incident/safety source.
- Data classification and role restrictions.
- Aggregation/anonymization rules.
- Retention and audit policy.

### 10. Trip Persistence API

Current file:

- `src/services/aviationTripStorageService.ts`

Current behavior:

- Browser localStorage key: `fpi_aviation_saved_trip_plans_v1`
- Supports save, list, get by ID, update, duplicate, delete.

Production API candidates:

- `GET /aviation/trips`
- `POST /aviation/trips`
- `GET /aviation/trips/:tripId`
- `PATCH /aviation/trips/:tripId`
- `DELETE /aviation/trips/:tripId`
- `POST /aviation/trips/:tripId/duplicate`
- `POST /aviation/trips/:tripId/close`
- `POST /aviation/trips/:tripId/reopen`

Needed production controls:

- Real user identity.
- Trip ownership/team visibility.
- Server-side role checks.
- Immutable created/updated metadata.
- Snapshot provider inputs when a trip is saved.
- Retention policy.

### 11. Readiness Actions API

Current files:

- `src/services/readinessActionService.ts`
- readiness actions are stored inside `AviationTripPlan.readiness_actions`

Current behavior:

- Generated client-side.
- Updated in local state and embedded into trip save.

Production API candidates:

- `GET /aviation/trips/:tripId/readiness-actions`
- `POST /aviation/trips/:tripId/readiness-actions/generate`
- `POST /aviation/trips/:tripId/readiness-actions`
- `PATCH /aviation/readiness-actions/:actionId`
- `POST /aviation/readiness-actions/:actionId/evidence`

Needed production controls:

- Action ownership by role/team.
- Evidence requirements.
- Status transition audit.
- Due-date/escalation handling.
- Server-side generation if official.

### 12. Audit Logging API

Current file:

- `src/services/aviationAuditService.ts`

Current behavior:

- Browser localStorage key: `fpi_aviation_audit_events`
- Stores latest 500 events.
- Actor is currently role text, not a real user ID.

Production API candidates:

- `POST /aviation/audit-events`
- `GET /aviation/audit-events?tripId=&eventType=&actorId=&start=&end=`
- `GET /aviation/trips/:tripId/audit-events`

Needed production controls:

- Immutable event storage.
- Real user identity.
- Server timestamp.
- Tamper resistance.
- Export logging.
- Sensitive metadata controls.

### 13. IAM / RBAC API

Current files:

- `src/services/aviationAuthorizationService.ts`
- `src/pages/AviationCommandCenter.tsx`

Current behavior:

- Role is selected in the UI.
- Permissions are hardcoded in frontend.

Production API candidates:

- `GET /me`
- `GET /me/aviation-permissions`
- `POST /aviation/authz/check`

Needed production controls:

- Enterprise identity provider integration.
- Server-issued roles/claims.
- Backend permission enforcement for every read/write/export/admin operation.
- Field-level redaction for EP/traveler/security fields.

### 14. Feedback, Issues, UAT, Decision APIs

Current files:

- `src/services/aviationFeedbackService.ts`
- `src/services/aviationPilotIssueService.ts`
- `src/services/aviationPilotExecutionService.ts`

Current localStorage keys:

- `fpi_aviation_pilot_feedback`
- `fpi_aviation_pilot_issues`
- `fpi_aviation_pilot_uat_runs`
- `fpi_aviation_stakeholder_decisions`

Production API candidates:

- `GET /aviation/feedback`
- `POST /aviation/feedback`
- `PATCH /aviation/feedback/:feedbackId`
- `GET /aviation/issues`
- `POST /aviation/issues`
- `PATCH /aviation/issues/:issueId`
- `DELETE /aviation/issues/:issueId`
- `GET /aviation/uat-runs`
- `POST /aviation/uat-runs`
- `PATCH /aviation/uat-runs/:uatId`
- `GET /aviation/decisions`
- `POST /aviation/decisions`
- `PATCH /aviation/decisions/:decisionId`

Needed production controls:

- Role-based access by pilot/admin/user role.
- Audit on updates.
- Retention and export policy.
- Link feedback/issues to trips and users where applicable.

### 15. Provider Status / Admin Config API

Current file:

- `src/services/aviationProviderConfig.ts`

Current behavior:

- Static frontend provider config.
- Admin/governance panels read this config for labels and caveats.
- Changing provider mode requires code changes.

Production API candidates:

- `GET /aviation/providers/status`
- `PATCH /aviation/providers/:providerName`
- `POST /aviation/providers/:providerName/test-connection`
- `GET /aviation/providers/:providerName/health`

Needed production controls:

- Admin-only access.
- Change approval workflow.
- Audit all provider config changes.
- Never expose backend secrets in frontend config.
- Store only non-secret source status client-side.

### 16. Brief / Report Export API

Current files:

- `src/services/tripBriefService.ts`
- `src/services/aviationHandoffPacketService.ts`
- `src/services/aviationReadoutReportService.ts`
- `src/components/aviation/TripBriefPanel.tsx`
- `src/components/aviation/AviationHandoffPacketPanel.tsx`
- `src/components/aviation/AviationPilotReadoutReportPanel.tsx`

Current behavior:

- Generates plain text client-side.
- Copy/print/export actions are local/browser-driven.
- Audit events are localStorage.

Production API candidates:

- `POST /aviation/trips/:tripId/briefs`
- `GET /aviation/trips/:tripId/briefs`
- `GET /aviation/briefs/:briefId/export?format=pdf|txt|docx`
- `POST /aviation/reports/pilot-readout`
- `POST /aviation/reports/handoff-packet`

Needed production controls:

- Server-side generation for official records.
- Export authorization.
- Watermark/source/confidence notices.
- Audit on generation/export/copy.
- Redaction based on viewer role.

## Minimum API Set to Make the Page Production-Functional

Required before production pilot:

1. `GET /me/aviation-permissions`
2. `GET /aviation/airports`
3. `GET /aviation/airports/:airportId`
4. `GET /aviation/facilities/nearby`
5. `GET /aviation/weather/alerts`
6. `GET /aviation/faa/alerts`
7. `POST /aviation/risk/score-trip`
8. `POST /aviation/trips`
9. `GET /aviation/trips`
10. `GET /aviation/trips/:tripId`
11. `PATCH /aviation/trips/:tripId`
12. `DELETE /aviation/trips/:tripId`
13. `GET /aviation/trips/:tripId/readiness-actions`
14. `POST /aviation/trips/:tripId/readiness-actions/generate`
15. `PATCH /aviation/readiness-actions/:actionId`
16. `POST /aviation/audit-events`
17. `GET /aviation/trips/:tripId/audit-events`
18. `GET /aviation/providers/status`

Recommended for pilot governance and readout:

19. `GET/POST/PATCH /aviation/feedback`
20. `GET/POST/PATCH /aviation/issues`
21. `GET/POST/PATCH /aviation/uat-runs`
22. `GET/POST/PATCH /aviation/decisions`
23. `POST /aviation/trips/:tripId/briefs`
24. `GET /aviation/briefs/:briefId/export`
25. `POST /aviation/routing/drive-time`
26. `GET /aviation/ep-readiness`
27. `GET /aviation/incidents`

## Priority Build Order

1. Build backend-neutral Aviation API/persistence adapter in frontend.
2. Replace localStorage trip persistence with API-backed trip persistence behind the adapter.
3. Add real IAM/RBAC and remove local role selector from production mode.
4. Add backend audit logging.
5. Add airport/facility APIs or approved static airport + facility API combination.
6. Add NOAA weather API/proxy.
7. Add FAA/NOTAM API/proxy.
8. Move risk scoring/readiness action generation server-side if it becomes official record.
9. Add provider health/status API.
10. Add routing, EP readiness, incident/safety connectors after data owner approval.
11. Add official brief/report generation/export APIs.

## Files Inspected for This Map

- `src/pages/AviationCommandCenter.tsx`
- `src/types/aviation.ts`
- `src/services/airportService.ts`
- `src/services/facilityDataAdapter.ts`
- `src/services/facilityGeoService.ts`
- `src/services/faaService.ts`
- `src/services/weatherService.ts`
- `src/services/routingService.ts`
- `src/services/aviationRiskEngine.ts`
- `src/services/readinessActionService.ts`
- `src/services/tripBriefService.ts`
- `src/services/aviationTripStorageService.ts`
- `src/services/aviationAuditService.ts`
- `src/services/aviationAuthorizationService.ts`
- `src/services/aviationFeedbackService.ts`
- `src/services/aviationPilotIssueService.ts`
- `src/services/aviationPilotExecutionService.ts`
- `src/services/aviationProviderConfig.ts`
- `src/services/aviationHandoffPacketService.ts`
- `src/services/aviationReadoutReportService.ts`
- `src/components/aviation/AviationLiveIntegrationDecisionMatrix.tsx`
- `src/components/aviation/NoaaLiveIntegrationReadinessPanel.tsx`
- `public/data/aviation/airports.json`
- `data/aviation/faaAlerts.json`
- `data/aviation/weatherAlerts.json`
- `data/facilities.json`
