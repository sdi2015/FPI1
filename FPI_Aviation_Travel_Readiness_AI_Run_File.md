# FPI Aviation Travel Readiness — PRD and AI Builder Run File

**Product:** Facility Protection Intelligence (FPI)  
**New Module:** Aviation Travel Readiness  
**Feature Set:** Airport Radius Scanner, Trip Risk Analysis, FAA/NOAA Ingestion, Aviation Travel Briefs  
**Audience:** Walmart Aviation, Executive Protection, Global Security, Field/Facility Protection, FPI product/build teams  
**Status:** Builder-ready PRD / AI tool run file  
**Version:** 1.0

---

## 1. Executive Summary

Walmart Aviation asked whether FPI can support travel planning by scanning nearby Walmart facilities around any airport, using a customizable radius, and generating risk analysis before planned trips. This PRD defines an FPI module that allows aviation users to select a major or small airport, choose a radius, identify nearby Walmart facilities, ingest FAA and NOAA signals, merge those signals with FPI facility posture, and generate a trip risk score, readiness actions, and an executive-ready aviation travel brief.

The module should be built as an extension of the existing FPI operating model: detect signals, score risk, recommend actions, assign ownership, capture evidence, verify closure, and generate briefings through Ask FPI.

---

## 2. Product Objective

Build an Aviation Travel Readiness module inside FPI that streamlines travel planning for Walmart Aviation and supporting security teams by answering five operational questions:

1. What Walmart facilities are near this airport?
2. What is the risk posture of those nearby facilities?
3. What FAA, airport, weather, safety, and operational signals could affect this trip?
4. What actions should be completed before the trip?
5. Can FPI generate a concise travel risk brief for aviation/security leadership?

---

## 3. Core User Stories

| ID | User Story | Priority |
|---|---|---|
| AV-001 | As an aviation user, I want to search for an airport by name, city, IATA, ICAO, or FAA code so I can begin a trip scan quickly. | P0 |
| AV-002 | As an aviation user, I want to customize the scan radius so I can control how many nearby Walmart facilities are included. | P0 |
| AV-003 | As an aviation user, I want FPI to list nearby Walmart stores, DCs, Sam's Clubs, FCs, and critical facilities sorted by distance and risk. | P0 |
| AV-004 | As an aviation user, I want FPI to ingest FAA/airport status data and flag relevant aviation watch items. | P0/P1 |
| AV-005 | As an aviation user, I want FPI to ingest NOAA weather data and identify weather risks during the trip window. | P0/P1 |
| AV-006 | As an aviation/security user, I want a trip risk score that combines weather, airport, facility, EP, incident, and support readiness. | P0 |
| AV-007 | As an EP/security user, I want FPI to recommend pre-trip readiness actions with owners and evidence requirements. | P1 |
| AV-008 | As a leader, I want Ask FPI to generate a concise aviation travel brief I can copy, export, or send for review. | P0 |
| AV-009 | As a system admin, I want all generated briefs and risk scores to be auditable. | P1 |
| AV-010 | As a product/demo owner, I want synthetic demo mode so we can brief leadership without exposing sensitive data. | P0 |

---

## 4. MVP Scope

### In Scope for MVP

- New navigation item: **Aviation Travel Readiness**
- Airport search component using seeded airport data
- Custom radius selector
- Radius scan that identifies nearby Walmart facilities by latitude/longitude
- Nearby facilities table with distance, type, facility risk, top driver, and recommended action
- Trip risk score card with transparent risk drivers
- FAA/Airport Watch panel using seeded or API-ready data structure
- NOAA Weather Watch panel using seeded or API-ready data structure
- Ask FPI aviation prompt chips
- Executive-ready aviation travel brief generator
- Demo scenario mode using synthetic data
- Pre-trip readiness checklist

### Out of Scope for MVP

- Autonomous go/no-go flight decisions
- Real-time flight tracking
- Direct aircraft operations control
- Sensitive traveler itinerary exposure beyond necessary trip window and airport context
- Automated law-enforcement/security deployment decisions
- Full mobile app rebuild
- Predictive machine learning model beyond transparent weighted scoring

---

## 5. Primary Workflow

1. User opens **Aviation Travel Readiness**.
2. User searches/selects an airport.
3. User sets radius, facility type filters, and trip date/time window.
4. FPI scans Walmart facilities within the selected radius.
5. FPI calculates distance and later drive-time estimates.
6. FPI merges facility posture, open FPI risks, and readiness indicators.
7. FPI ingests FAA/airport watch items.
8. FPI ingests NOAA weather alerts/forecast for the airport and nearby facilities.
9. FPI generates overall trip risk score and risk drivers.
10. FPI recommends pre-trip actions.
11. User selects **Generate Trip Brief**.
12. Ask FPI produces executive-ready aviation travel brief.
13. User assigns readiness actions and tracks evidence/verification.

---

## 6. User Interface Requirements

### 6.1 Aviation Command Center

Top KPI cards:

| KPI | Description |
|---|---|
| Planned Trips | Count of active trip plans |
| Airports Monitored | Number of airports in active trip/radius scans |
| High-Risk Trip Windows | Trips currently rated High or Critical |
| Facilities Within Radius | Count from selected airport scan |
| FAA Watch Items | Relevant FAA/airport flags |
| Weather Alerts | Active NOAA watches/warnings/advisories |
| Open Readiness Actions | Unresolved pre-trip tasks |
| Briefs Generated | Count of generated aviation briefs |

Main layout:

- Left panel: airport search, radius selector, filters, saved trips
- Center panel: map/radius view and nearby facility list
- Right panel: trip risk score, risk drivers, recommended actions, Ask FPI

### 6.2 Airport Radius Scanner

Inputs:

| Field | Type | Required | Notes |
|---|---|---|---|
| Airport | Search/select | Yes | Search by name, city, FAA, IATA, ICAO |
| Radius Miles | Slider/dropdown | Yes | Default 25 miles; options 5, 10, 25, 50, 75, 100 |
| Trip Start | Date/time | Recommended | Used for weather window |
| Trip End | Date/time | Recommended | Used for weather window |
| Facility Types | Multi-select | No | Stores, DCs, Sam's, FCs, corporate, all |
| Traveler Type | Dropdown | No | Executive, crew, support, field/security |
| Risk Domains | Multi-select | No | FAA, weather, facility, EP, incident, support |

Outputs:

- Airport summary card
- Radius map
- Nearby facilities table
- Risk score card
- FAA/Airport Watch panel
- NOAA Weather Watch panel
- Recommended actions
- Generate brief button

### 6.3 Nearby Facilities Table

Required columns:

| Column | Description |
|---|---|
| Facility | Facility name/number |
| Type | Store, DC, FC, Sam's, etc. |
| City/State | Location |
| Distance | Miles from airport |
| Drive Time | Optional in MVP; use placeholder if not available |
| Facility Risk | Existing FPI risk score/band |
| Top Driver | Main facility risk driver |
| EP Readiness | Stable, Watch, Gap, Unknown |
| Weather Exposure | Low, Watch, Elevated, High |
| Recommended Action | Review, verify, monitor, use as support, avoid |

---

## 7. Data Model

### 7.1 Seed/Data Files

Create or extend the following files:

```text
/data/aviation/airports.json
/data/aviation/tripPlans.json
/data/aviation/faaAlerts.json
/data/aviation/weatherAlerts.json
/data/aviation/aviationRiskSignals.json
/data/aviation/tripRiskScores.json
/data/aviation/tripReadinessActions.json
/data/aviation/tripBriefs.json
/data/facilities.json
/data/airportFacilities.json
/data/assistantKnowledge.json
```

### 7.2 Airport Object

```json
{
  "airport_id": "AIR-XNA-001",
  "faa_id": "XNA",
  "iata_code": "XNA",
  "icao_code": "KXNA",
  "airport_name": "Northwest Arkansas National Airport",
  "airport_type": "commercial",
  "city": "Bentonville/Fayetteville",
  "state": "AR",
  "latitude": 36.2819,
  "longitude": -94.3068,
  "status": "active",
  "source_freshness": "seeded_demo",
  "last_updated": "2026-05-08T00:00:00Z"
}
```

### 7.3 Facility Object Extension

Add latitude/longitude and aviation relevance fields to existing facility records:

```json
{
  "facility_id": "WM-STORE-1001",
  "facility_number": "1001",
  "facility_name": "Walmart Supercenter 1001",
  "facility_type": "Supercenter",
  "city": "Bentonville",
  "state": "AR",
  "latitude": 36.3729,
  "longitude": -94.2088,
  "facility_risk_score": 42,
  "facility_risk_band": "Watch",
  "top_risk_driver": "Open camera maintenance case",
  "ep_readiness_status": "Watch",
  "aviation_support_candidate": true
}
```

### 7.4 Trip Plan Object

```json
{
  "trip_id": "AV-TRIP-0001",
  "airport_id": "AIR-XNA-001",
  "trip_name": "Northwest Arkansas Aviation Readiness Scan",
  "trip_start": "2026-05-14T08:00:00-05:00",
  "trip_end": "2026-05-14T17:00:00-05:00",
  "radius_miles": 25,
  "facility_types": ["Supercenter", "Neighborhood Market", "Sam's Club", "Distribution Center"],
  "traveler_type": "Executive",
  "created_by": "aviation_user",
  "status": "draft",
  "risk_score": 68,
  "risk_band": "Elevated",
  "confidence": 86,
  "primary_drivers": ["Severe weather watch", "One high-risk nearby facility", "EP readiness gap"],
  "last_scanned": "2026-05-08T00:00:00Z"
}
```

### 7.5 FAA Alert Object

```json
{
  "alert_id": "FAA-0001",
  "airport_id": "AIR-XNA-001",
  "alert_type": "NOTAM",
  "severity": "Watch",
  "title": "Runway/taxiway limitation",
  "summary": "Demo FAA watch item for aviation readiness scoring.",
  "effective_start": "2026-05-14T06:00:00-05:00",
  "effective_end": "2026-05-14T18:00:00-05:00",
  "source": "FAA",
  "source_url": null,
  "confidence": 80,
  "status": "active"
}
```

### 7.6 NOAA Weather Alert Object

```json
{
  "weather_alert_id": "WX-0001",
  "airport_id": "AIR-XNA-001",
  "affected_facility_ids": ["WM-STORE-1001"],
  "alert_type": "Severe Thunderstorm Watch",
  "severity": "Elevated",
  "summary": "Thunderstorms possible during arrival window with high wind gusts and lightning exposure.",
  "effective_start": "2026-05-14T12:00:00-05:00",
  "effective_end": "2026-05-14T20:00:00-05:00",
  "source": "NOAA",
  "source_url": null,
  "confidence": 90,
  "status": "active"
}
```

### 7.7 Readiness Action Object

```json
{
  "action_id": "AV-ACTION-0001",
  "trip_id": "AV-TRIP-0001",
  "title": "Verify EP readiness for highest-risk nearby facility",
  "description": "Confirm local leadership contact, camera posture, access control status, and arrival support plan.",
  "owner_role": "Executive Protection",
  "due_time": "2026-05-14T06:00:00-05:00",
  "priority": "High",
  "status": "Open",
  "evidence_required": true,
  "evidence_type": "Checklist confirmation or uploaded note",
  "created_from_driver": "EP readiness gap"
}
```

---

## 8. Distance and Radius Logic

### 8.1 Required Function

Implement a reusable geospatial utility:

```ts
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number
```

Use the Haversine formula for MVP.

### 8.2 Facility Scan Logic

```ts
function scanFacilitiesNearAirport({ airport, facilities, radiusMiles, facilityTypes }) {
  return facilities
    .filter(f => facilityTypes.includes(f.facility_type))
    .map(f => ({
      ...f,
      distance_miles: getDistanceMiles(airport.latitude, airport.longitude, f.latitude, f.longitude)
    }))
    .filter(f => f.distance_miles <= radiusMiles)
    .sort((a, b) => {
      if (b.facility_risk_score !== a.facility_risk_score) return b.facility_risk_score - a.facility_risk_score;
      return a.distance_miles - b.distance_miles;
    });
}
```

Sorting rule for MVP:

1. High-risk facilities first
2. Then closer facilities
3. Then facilities with EP readiness gaps

---

## 9. Risk Scoring Model

### 9.1 Weighted Model

| Domain | Weight | Signals |
|---|---:|---|
| Weather Risk | 25% | NOAA warnings/watches, wind, lightning, flooding, winter weather |
| FAA/Airport Risk | 20% | NOTAMs, closure, runway issue, airspace constraint |
| Nearby Facility Risk | 20% | Highest/average FPI risk within radius |
| EP/Visit Readiness | 15% | Checklist gaps, stale contacts, unverified site posture |
| Incident/Safety Pattern | 10% | Recent incidents, crime/safety trend, disruption |
| Support/Vendor Readiness | 5% | Guard/vendor availability, support coverage |
| Data Confidence/Freshness | 5% | Stale data, missing source, low confidence |

### 9.2 Risk Bands

| Score | Band | Meaning |
|---:|---|---|
| 0-29 | Low | No major constraints |
| 30-49 | Watch | Monitor conditions |
| 50-69 | Elevated | Pre-trip mitigation needed |
| 70-84 | High | Leadership/EP review recommended |
| 85-100 | Critical | Escalate and reconsider plan/timing |

### 9.3 Scoring Function Pseudocode

```ts
function calculateTripRiskScore(inputs) {
  const weather = normalizeWeatherRisk(inputs.weatherAlerts) * 0.25;
  const faa = normalizeFaaRisk(inputs.faaAlerts) * 0.20;
  const facility = normalizeFacilityRisk(inputs.nearbyFacilities) * 0.20;
  const ep = normalizeEpReadinessRisk(inputs.nearbyFacilities, inputs.tripChecklist) * 0.15;
  const incident = normalizeIncidentRisk(inputs.incidentSignals) * 0.10;
  const support = normalizeSupportRisk(inputs.vendorSupport) * 0.05;
  const confidence = normalizeDataConfidenceRisk(inputs.sourceFreshness) * 0.05;

  const score = Math.round(weather + faa + facility + ep + incident + support + confidence);

  return {
    score,
    band: getRiskBand(score),
    drivers: rankTopDrivers(inputs),
    confidence: calculateConfidence(inputs)
  };
}
```

---

## 10. Ask FPI Aviation Prompt Chips

Add these prompt chips to the Aviation Travel Readiness screen:

| Prompt Chip | Expected Output |
|---|---|
| Scan Walmarts near this airport | Nearby facility list with distance and risk |
| Generate aviation trip brief | Executive-ready brief |
| Explain the trip risk score | Score breakdown and top drivers |
| What should we verify before departure? | Pre-trip action checklist |
| Which nearby facility is highest risk? | Facility risk explanation |
| Which facility is best for support/staging? | Recommended support site |
| What weather could affect this trip? | NOAA-based weather summary |
| Are there FAA watch items? | FAA/airport watch summary |
| Create readiness actions | Action list with owner, due time, evidence |

### Ask FPI System Instruction for Aviation Mode

```text
You are Ask FPI operating in Aviation Travel Readiness mode. Your job is to help Walmart aviation, executive protection, and security teams evaluate travel readiness around selected airports. Use only available FPI, FAA, NOAA, facility, and user-provided trip data. Do not make autonomous flight go/no-go decisions. Do not expose sensitive traveler details unless provided and necessary. Always distinguish verified data from missing or stale data. Produce concise, operationally useful summaries with risk drivers, recommended actions, owners, and evidence requirements.
```

---

## 11. Aviation Travel Brief Template

Generated brief must follow this structure:

```text
FPI AVIATION TRAVEL READINESS BRIEF

Trip Summary
- Airport:
- Trip Window:
- Radius:
- Facilities Scanned:
- Facility Types Included:

Overall Risk
- Trip Risk Score:
- Risk Band:
- Confidence:
- Primary Risk Drivers:

Airport / FAA Watch
- Current Airport Status:
- Relevant FAA/NOTAM Items:
- Airspace/Operational Concerns:
- Data Freshness:

NOAA Weather Outlook
- Active Alerts:
- Forecasted Concerns:
- Wind/Lightning/Flooding/Winter Weather:
- Timing vs Trip Window:

Nearby Walmart Facilities
- Highest-Risk Facility:
- Closest Facility:
- Recommended Support/Staging Facility:
- Facilities Requiring Verification:

Executive Protection / Security Readiness
- EP Readiness Status:
- Known Gaps:
- Required Verifications:

Recommended Actions Before Departure
1.
2.
3.

Recommended Actions Upon Arrival
1.
2.
3.

Open Questions / Missing Data
-
-

Prepared by FPI Aviation Travel Readiness
```

---

## 12. Component Build List

### Frontend Components

| Component | Purpose | Priority |
|---|---|---|
| AviationCommandCenter.tsx | Module landing page | P0 |
| AirportSearch.tsx | Airport lookup/select | P0 |
| RadiusSelector.tsx | Radius slider/dropdown | P0 |
| FacilityRadiusMap.tsx | Map and facility pins | P1 |
| NearbyFacilitiesTable.tsx | List facilities in radius | P0 |
| TripRiskScoreCard.tsx | Score/band/drivers | P0 |
| FAAWatchPanel.tsx | FAA/airport alerts | P0 |
| WeatherRiskPanel.tsx | NOAA/weather alerts | P0 |
| TripReadinessActions.tsx | Action checklist | P1 |
| TripBriefPanel.tsx | Generated brief viewer | P0 |
| AskFPIAviationPanel.tsx | Aviation prompt chips | P0 |
| AviationDemoScenario.tsx | Synthetic demo mode | P0 |

### Services / Utilities

| Service | Purpose | Priority |
|---|---|---|
| airportService.ts | Load/search airports | P0 |
| facilityGeoService.ts | Radius matching and distance | P0 |
| aviationRiskEngine.ts | Calculate trip risk | P0 |
| faaService.ts | Load/normalize FAA alerts | P0/P1 |
| weatherService.ts | Load/normalize NOAA alerts | P0/P1 |
| tripBriefService.ts | Generate brief payload | P0 |
| readinessActionService.ts | Create/manage trip actions | P1 |
| sourceFreshnessService.ts | Track stale/missing data | P1 |

---

## 13. AI Builder Run Instructions

Use these instructions for Loveable, Cursor, Replit, Windsurf, Bolt, or similar AI coding tools.

### Builder Task 1 — Add Module Route and Navigation

```text
Add a new FPI module named Aviation Travel Readiness. Add it to the main navigation and route it to /aviation-travel-readiness. The page should follow the existing FPI visual style and layout. Do not remove or break any existing FPI modules.
```

Acceptance criteria:

- New nav item appears.
- Route loads without errors.
- Existing FPI pages still work.
- Page title reads Aviation Travel Readiness.

### Builder Task 2 — Create Seed Data

```text
Create aviation seed data under /data/aviation. Add airports.json, tripPlans.json, faaAlerts.json, weatherAlerts.json, aviationRiskSignals.json, tripRiskScores.json, tripReadinessActions.json, and tripBriefs.json. Add or extend facilities.json with latitude, longitude, facility risk score, facility type, top risk driver, and EP readiness status.
```

Acceptance criteria:

- App can load airport and facility seed data.
- At least 5 airports are included.
- At least 25 demo facilities are included.
- Demo facilities include stores, Sam's Clubs, DCs, and fulfillment/corporate examples.

### Builder Task 3 — Build Airport Search and Radius Scanner

```text
Build an AirportSearch component and RadiusSelector component. Allow airport search by name, city, FAA code, IATA code, and ICAO code. Add a radius selector with 5, 10, 25, 50, 75, and 100 mile options, defaulted to 25 miles.
```

Acceptance criteria:

- User can select an airport.
- User can change radius.
- Selected airport and radius are stored in page state.
- Scan button triggers facility filtering.

### Builder Task 4 — Implement Radius Facility Matching

```text
Implement Haversine distance logic and scan facilities within the selected airport radius. Display matching facilities in a NearbyFacilitiesTable sorted by highest risk first, then closest distance.
```

Acceptance criteria:

- Facilities outside the radius are excluded.
- Facilities inside the radius are displayed.
- Distance is shown in miles rounded to one decimal place.
- Table sorts by risk score descending, then distance ascending.

### Builder Task 5 — Add Trip Risk Score

```text
Build aviationRiskEngine.ts using the weighted model from the PRD. Combine weather, FAA, facility, EP readiness, incident, support, and data freshness inputs into a 0-100 trip risk score and Low/Watch/Elevated/High/Critical band.
```

Acceptance criteria:

- Score updates when selected airport/radius changes.
- Score shows band and top 3-5 drivers.
- Score logic is transparent and easy to tune.
- Missing data reduces confidence and can increase data freshness risk.

### Builder Task 6 — Add FAA and NOAA Panels

```text
Build FAAWatchPanel and WeatherRiskPanel. For MVP, read seeded FAA and NOAA records by airport_id and trip window. Show severity, title, summary, timing, source, confidence, and status.
```

Acceptance criteria:

- FAA panel displays relevant seeded FAA watch items.
- Weather panel displays relevant seeded NOAA weather alerts.
- Empty state explains no relevant alerts found.
- Each alert shows source and confidence.

### Builder Task 7 — Build Ask FPI Aviation Prompt Chips

```text
Add Ask FPI Aviation prompt chips and wire them to generated summaries based on selected airport, radius, nearby facilities, FAA alerts, weather alerts, and trip risk score. Prompt chips should include: Generate aviation trip brief, Explain trip risk score, What should we verify before departure, Which facility is highest risk, Which facility is best for support/staging, What weather could affect this trip, Are there FAA watch items, and Create readiness actions.
```

Acceptance criteria:

- Prompt chips appear on aviation page.
- Clicking a prompt generates a useful response in the panel.
- Responses use selected airport and current scan data.
- Responses include caveats for seeded/demo/stale data.

### Builder Task 8 — Generate Aviation Travel Brief

```text
Build TripBriefPanel and tripBriefService. Generate a structured aviation travel readiness brief using the template in the PRD. Allow copy-to-clipboard and save-to-tripBriefs behavior if the app supports persistence.
```

Acceptance criteria:

- Brief follows required template.
- Brief includes airport, trip window, radius, facilities scanned, risk score, FAA watch, NOAA weather, highest-risk facility, recommended support facility, EP readiness, actions, and missing data.
- User can copy the brief.
- Brief is visually clean and executive-ready.

### Builder Task 9 — Add Readiness Actions

```text
Create readiness actions from top risk drivers. Each action should include title, description, owner role, due time, priority, status, evidence required, and source risk driver.
```

Acceptance criteria:

- User can generate actions from current trip risk drivers.
- Actions appear in a checklist/table.
- Actions can show status: Open, In Progress, Verified, Closed.
- Evidence requirement is visible.

### Builder Task 10 — Create Demo Scenario Mode

```text
Add a demo scenario named Executive Regional Airport Trip. The demo should preselect an airport, set a 25-mile radius, load several nearby Walmart facilities, show one high-risk facility, one FAA watch item, one NOAA severe weather alert, a trip risk score in the Elevated or High band, and generate an aviation travel brief.
```

Acceptance criteria:

- Demo scenario can be launched with one click.
- Scenario tells a clear story.
- No real sensitive trip details are used.
- Leadership can understand the value in under 3 minutes.

---

## 14. API Integration Plan

### MVP

Use seeded data with API-ready schemas. Do not block the prototype on live integrations.

### Production

Integrate approved data sources in this order:

1. Walmart facility master data
2. Existing FPI facility risk/posture data
3. NOAA weather data
4. FAA airport/NOTAM/status data
5. Internal incident/safety data
6. Vendor/support coverage data
7. Route/drive-time provider if approved

Each integration must include:

- Source name
- Source URL or system of record
- Refresh cadence
- Last updated timestamp
- Confidence value
- Fallback behavior
- Error state behavior

---

## 15. Security, Governance, and Guardrails

Required rules:

| Rule | Requirement |
|---|---|
| Human decision authority | FPI may recommend; it must not make autonomous go/no-go flight decisions. |
| Source labeling | Every risk driver must show source and freshness where available. |
| Confidence scoring | Missing, stale, or seeded/demo data must be clearly labeled. |
| Role-based access | Limit aviation travel details to approved users. |
| Sensitive data minimization | Do not expose unnecessary traveler identity, itinerary, or executive movement details. |
| Auditability | Store generated briefs, score changes, actions, and user activity where persistence exists. |
| Demo safety | Use synthetic airports/trips/facilities when briefing outside approved environments. |
| Human review | Require aviation/security review before operational action is taken. |

---

## 16. Acceptance Criteria for MVP Completion

The MVP is complete when:

- Aviation Travel Readiness appears in FPI navigation.
- User can select an airport and radius.
- User can scan nearby Walmart facilities.
- Facilities are distance-calculated and risk-ranked.
- FAA/Airport Watch panel displays seeded records.
- NOAA Weather Watch panel displays seeded records.
- Trip risk score calculates and explains drivers.
- Ask FPI prompt chips generate aviation-specific outputs.
- User can generate a structured aviation travel brief.
- User can generate readiness actions from top risk drivers.
- Demo scenario works end-to-end with synthetic data.
- Existing FPI functionality remains intact.

---

## 17. Final Build Directive for AI Tools

```text
Build the Aviation Travel Readiness module as an extension of FPI. Preserve the current FPI design language, navigation, command center logic, risk scoring philosophy, Ask FPI assistant pattern, and demo-readiness. Do not remove existing features. Start with seeded JSON data and API-ready schemas. Build a clean MVP that demonstrates airport search, custom radius scanning, nearby Walmart facility risk ranking, FAA/NOAA signal panels, trip risk scoring, readiness actions, and executive-ready travel brief generation. Clearly label demo/seeded data, source freshness, confidence, and missing data. Keep all decisions advisory and require human review for operational action.
```
