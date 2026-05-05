# FPI-TECH-001 Analysis — Camera / Technical Controls + Network / Security Device Posture

Status: **Analysis complete; implementation recommended but not yet applied in this pass.**

Source analyzed:

`C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\03_Workspaces\Chris R - Working Folder\01_Task_Work\FPI-TECH-001`

Active UI target:

`C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\02_Active_Build\FPI_202605`

Generated analysis artifact:

- `TECH_SOURCE_ANALYSIS_SUMMARY.json`

---

## 1. What is in the source package

The folder contains two related but distinct deliverables:

### A. Canonical FPI Technology Health model

Location:

- `01_Normalized_Model/synthetic-technology-health-adapter-output.json`
- `01_Normalized_Model/technology-health-adapter-output.schema.json`
- `01_Normalized_Model/technology-health-integration-contract.md`
- `01_Normalized_Model/technology-health-mapping.md`

This is the safest and cleanest integration contract for the main FPI UI. It defines normalized `TechnologyIssue` records with approved FPI vocabulary:

- Domains: `Camera/VMS`, `Recorder`, `Access Control`, `Network/Security Device`, `LPR`, `Fire Alarm`, `Other`
- Statuses: `Normal`, `Warning`, `Degraded`, `Critical`, `Unknown`, `Not Applicable`
- Severity: `Informational`, `Low`, `Medium`, `High`, `Critical`
- Freshness: `Current`, `Aging`, `Stale`, `Unknown`, `Not Applicable`
- Confidence: `High`, `Medium`, `Low`, `Unknown`

Current synthetic issue counts:

| Domain | Count |
|---|---:|
| Camera/VMS | 1 |
| Recorder | 1 |
| Access Control | 1 |
| LPR | 1 |

Current status counts:

| Status | Count |
|---|---:|
| Degraded | 1 |
| Warning | 1 |
| Normal | 1 |
| Unknown | 1 |

Validation result:

```text
FPI technology health validation passed.
Validated issues: 4
Validated sources: 4
No sensitive URL/IP/credential patterns found in synthetic output.
```

### B. CCTV / VMS Monitoring prototype

Location:

- `04_CCTV_Monitoring_Demo/`

This contains a much richer standalone CCTV/VMS dashboard prototype with:

- Region 75 VMS health data
- VMS/recorder inventory
- camera inventory
- online/offline health
- IP vs analog breakdowns
- retention/profile checks
- policy compliance checks
- predictive CCTV agent logic
- ticket simulation workflow
- QR assets for store drill-through

Important Region 75 safe aggregate metrics:

| Metric | Value |
|---|---:|
| Stores | 106 |
| VMS recorders | 214 |
| Cameras | 25,943 |
| Online cameras | 24,973 |
| Offline cameras | 970 |
| Online health | 96.3% |
| Healthy stores | 88 |
| Warning stores | 15 |
| Critical stores | 3 |

The real API summary also includes broader fleet-level aggregate metrics:

| Metric | Value |
|---|---:|
| Fleet cameras | 1,143,804 |
| Online cameras | 1,115,046 |
| Offline cameras | 12,044 |
| Online percent | 97.5% |
| Store count | 5,466 |
| Green stores | 4,070 |
| Yellow stores | 746 |
| Red stores | 650 |

---

## 2. Data handling findings

### Safe to use directly

These should be used as the primary input for FPI UI implementation:

- `01_Normalized_Model/synthetic-technology-health-adapter-output.json`
- `01_Normalized_Model/technology-health-adapter-output.schema.json`
- `01_Normalized_Model/technology-health-integration-contract.md`
- `01_Normalized_Model/technology-health-mapping.md`
- Aggregated fields from `04_CCTV_Monitoring_Demo/real-api-health-summary.json`
- Aggregated and scrambled store-level fields from `04_CCTV_Monitoring_Demo/region75-vms-health.json`

### Use with caution / sanitize before FPI UI

The CCTV prototype includes files that are useful for modeling but should **not** be copied wholesale into the FPI UI:

- `region75-realdata.json`
- `region75-vms-health.json` camera-level records
- `region75-retention.json`
- bundled/demo HTML artifacts
- QR manifest URLs
- source reference HTML

Reason: some datasets include technical identifiers such as IP-like values, MAC-like values, firmware, camera names, host/device fields, and source-derived operational detail. Even if some data is scrambled, default FPI leader views should stay aggregate/sanitized and role-gated.

### Validation note

The normalized FPI technology-health output passes validation. The standalone CCTV demo validator currently fails in this environment because it detects non-reserved IP patterns and a very large generated bundle. That does **not** block using the normalized model, but it confirms that we should sanitize or aggregate CCTV demo data before importing it into the main FPI UI.

---

## 3. Recommended UI implementation

The best course is to implement a shared `Technology Health` data layer, then split the UI into two service workspaces:

1. **Camera & Technical Control Monitoring**
2. **Network & Security Device Posture**

Both should read from the same normalized technology-health package, but present different slices.

---

## 4. Camera & Technical Control Monitoring — recommended sub-tabs

Main tab: `Camera & Technical Control Monitoring`

Recommended sub-tabs:

### 4.1 Overview

Use:

- Region 75 aggregate health
- fleet aggregate health
- store health distribution
- online/offline camera counts
- VMS recorder counts

Cards/KPIs:

- Online camera health
- Offline cameras
- Issue cameras
- Store health distribution
- VMS recorders monitored
- IP vs analog camera mix

### 4.2 Region / Store Health

Use:

- sanitized `stores[]` from `region75-vms-health.json`

Display:

- store alias / synthetic facility ID
- health status
- online percent
- total cameras
- offline cameras
- VSRV count
- misplaced subnet count as a risk indicator, without showing raw network details

Avoid by default:

- raw IPs
- MAC addresses
- exact VMS hostnames
- raw camera identifiers unless role-gated

### 4.3 CCTV Inventory

Use:

- normalized store-level and recorder-level rollups

Display:

- camera totals by category
- IP/analog mix
- recorder count and recorder online/offline state
- last scan freshness
- top issue categories

Role-gated future detail:

- camera name
- model/firmware
- technical identifiers
- recorder aliases

### 4.4 Compliance / AP-14

Use:

- `AP14_POLICY_SCAN.md`
- compliance/policy logic in `businessRules.js`, `normalization.js`, and `storeComplianceView.js`

Display:

- policy exception counts
- prohibited/private-area coverage flags when metadata exists
- unauthorized audio flag placeholder
- signage/retention policy placeholders
- “authorized Security Technology Technician / contractor required” guidance for move/add/remove actions

### 4.5 Retention & Recording Profiles

Use:

- retention/profile logic from the demo
- aggregate retention status only in leader view

Display:

- retention unknown
- retention below configured threshold
- “No Recording Profiles Set” warning count
- configurable threshold disclosure

### 4.6 Predictive CCTV Agent

Use:

- `predictiveAgent.js` logic as business-rule reference

Display:

- stores trending toward critical
- likely ticket candidates
- predicted risk drivers
- suggested remediation queue

### 4.7 Work Queue / Ticket Simulation

Use:

- ticket workflow concepts from demo validation output

Display:

- grouped offline camera ticket candidates
- critical ServiceChannel-style tickets
- non-critical Me@Walmart-style tickets
- assignment group
- SLA / evidence expectation
- no real writeback in this phase

---

## 5. Network & Security Device Posture — recommended sub-tabs

Main tab: `Network & Security Device Posture`

Recommended sub-tabs:

### 5.1 Overview

Use:

- normalized `TechnologyIssue` records where domain is `Network/Security Device`, `Access Control`, `LPR`, and recorder/network-adjacent issues
- source freshness records

Display:

- posture status by domain
- freshness/confidence by source
- unknown/stale source count
- risk-driver count
- remediation links

### 5.2 Source Freshness & Adapter Health

Use:

- `source_freshness[]`
- `adapter_run`

Display:

- adapter mode
- last demo update
- current/aging/stale/unknown sources
- confidence
- warning messages

### 5.3 Device Domains

Use normalized domains:

- Access Control
- LPR
- Network/Security Device
- Recorder infrastructure
- Other security devices

Display:

- domain status cards
- issue list
- severity
- risk drivers
- remediation linkage

### 5.4 Recorder / Network Dependencies

Use recorder rollups from CCTV data, but sanitize identifiers.

Display:

- recorder count
- online/offline recorder status
- camera count by recorder
- stale recorder signal count
- last-seen freshness bands

### 5.5 Governance / Integration Readiness

Use:

- integration contract
- adapter placeholder README
- future integration requirements

Display checklist:

- source owner approval
- classification review
- secrets management design
- read-only/writeback approval
- rate limits and failure-mode design
- audit logging
- role-based access
- mapping tests
- synthetic fallback
- sign-off

---

## 6. Recommended data architecture

Create a new FPI-facing data package in the active build:

`public/data/technology-health.json`

Recommended shape:

```ts
type TechnologyHealthData = {
  metadata: {
    sourceTask: 'FPI-TECH-001';
    dataMode: 'synthetic_demo_or_sanitized_aggregate';
    classification: string;
    generatedAt: string;
  };
  adapterRun: TechnologyAdapterRun;
  sourceFreshness: TechnologySourceFreshness[];
  technologyIssues: TechnologyIssue[];
  cameraFleetSummary: CameraFleetSummary;
  regionHealthSummary: RegionHealthSummary;
  storeHealth: SanitizedStoreCameraHealth[];
  recorderHealth: SanitizedRecorderHealth[];
  complianceSummary: CameraComplianceSummary;
  predictiveSummary: PredictiveCameraSummary;
};
```

Key rule:

**The UI should consume `technology-health.json`, not the raw Chris working-folder files.**

---

## 7. Recommended implementation files

Add:

- `src/data/technologyHealthTypes.ts`
- `src/data/useTechnologyHealthData.ts`
- `src/data/technologyHealthSelectors.ts`
- `src/components/views/CameraTechnicalControlView.tsx`
- `src/components/views/NetworkDevicePostureView.tsx`
- `src/technology.css`
- `public/data/technology-health.json`

Update:

- `src/App.tsx`
  - Route `SERVICE_IDS.CAMERA_CONTROLS` to `CameraTechnicalControlView`
  - Route `SERVICE_IDS.DEVICE_POSTURE` to `NetworkDevicePostureView`
- `src/data/program.ts`
  - Update capability status/metric after implementation

---

## 8. Data mapping by FPI service

| Source concept | FPI destination |
|---|---|
| `Camera/VMS` TechnologyIssue | Camera & Technical Control Monitoring |
| `Recorder` TechnologyIssue | Camera tab, with dependency rollup in Network/Posture tab |
| Region 75 store health | Camera & Technical Control Monitoring / Region Store Health |
| Camera online/offline counts | Camera & Technical Control Monitoring / Overview |
| IP vs analog mix | Camera & Technical Control Monitoring / Inventory |
| Retention/profile issues | Camera & Technical Control Monitoring / Retention & Profiles |
| AP-14 policy scan | Camera & Technical Control Monitoring / Compliance |
| Predictive CCTV agent rules | Camera & Technical Control Monitoring / Predictive Agent |
| `Access Control` TechnologyIssue | Network & Security Device Posture / Device Domains |
| `LPR` TechnologyIssue | Network & Security Device Posture / Device Domains |
| `Network/Security Device` domain | Network & Security Device Posture / Overview and Device Domains |
| `source_freshness[]` | Network & Security Device Posture / Source Freshness |
| Adapter placeholders | Network & Security Device Posture / Governance |

---

## 9. Recommended first implementation slice

For the next build, I recommend the following minimum viable implementation:

### Phase 1 — Safe data package

- Build `public/data/technology-health.json`
- Include normalized issues and source freshness directly
- Include safe aggregate Region 75 metrics
- Include sanitized store-level rows only
- Exclude raw IP/MAC/firmware/hostnames from default UI data

### Phase 2 — Camera tab

- Add sub-tabs: Overview, Region Health, Compliance, Retention/Profile, Predictive Agent, Work Queue
- Make this highly visual, similar to the Fire Ops page but using Walmart dark/blue/yellow styling

### Phase 3 — Network / Device tab

- Add sub-tabs: Overview, Source Freshness, Device Domains, Recorder Dependencies, Governance
- Highlight adapter readiness and posture gaps

### Phase 4 — Cross-linking

- Link camera/recorder issues into Remediation Orchestration
- Link `risk_driver_ids` into Threat Detection & Risk Scoring
- Link source freshness warnings into Governance

---

## 10. Risks / decisions before implementation

Before importing full camera-level detail into the active UI, decide:

1. Should the demo UI show raw technical identifiers at all?
2. If yes, which roles can see camera IP/MAC/firmware/recorder identifiers?
3. Should Region 75 data be treated as sanitized demo data or restricted operational data?
4. Should the first build show only aggregates and store health, leaving camera-level detail for a role-gated later pass?
5. Should ticket creation remain simulation-only? Recommendation: yes.

My recommendation: **start with aggregate and sanitized store/recorder-level data only. Do not expose raw camera identifiers in the main FPI UI until role-gating is designed.**

---

## 11. Bottom line

The best path is to use Chris R's package as the foundation for a proper FPI `Technology Health` domain layer. The normalized contract is strong and safe. The CCTV prototype has excellent product logic and metrics, but should be sanitized and adapted into the FPI shell rather than copied wholesale.

Recommended UI placement:

- Put CCTV/VMS monitoring, compliance, retention, predictive agent, and ticket simulation under **Camera & Technical Control Monitoring**.
- Put adapter health, source freshness, access/LPR/security-device posture, recorder dependencies, and integration governance under **Network & Security Device Posture**.
