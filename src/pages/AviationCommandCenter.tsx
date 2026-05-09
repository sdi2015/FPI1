import { useEffect, useMemo, useState } from 'react';
import { AirportSearch } from '../components/aviation/AirportSearch';
import { AskFPIAviationPanel } from '../components/aviation/AskFPIAviationPanel';
import { AviationDemoScenario } from '../components/aviation/AviationDemoScenario';
import { AviationAuditTimeline } from '../components/aviation/AviationAuditTimeline';
import { AviationGovernanceMatrix } from '../components/aviation/AviationGovernanceMatrix';
import { AviationHandoffPacketPanel } from '../components/aviation/AviationHandoffPacketPanel';
import { AviationLiveIntegrationDecisionMatrix } from '../components/aviation/AviationLiveIntegrationDecisionMatrix';
import { AviationPilotBanner } from '../components/aviation/AviationPilotBanner';
import { AviationPilotFeedbackPanel } from '../components/aviation/AviationPilotFeedbackPanel';
import { AviationPilotIssueTracker } from '../components/aviation/AviationPilotIssueTracker';
import { AviationPilotMetricsPanel } from '../components/aviation/AviationPilotMetricsPanel';
import { AviationPilotReadoutReportPanel } from '../components/aviation/AviationPilotReadoutReportPanel';
import { AviationPilotUatRunLog } from '../components/aviation/AviationPilotUatRunLog';
import { AviationProductionPilotReadinessScorePanel } from '../components/aviation/AviationProductionPilotReadinessScorePanel';
import { AviationStakeholderDecisionLog } from '../components/aviation/AviationStakeholderDecisionLog';
import { AviationStakeholderPilotPlanPanel } from '../components/aviation/AviationStakeholderPilotPlanPanel';
import { AviationTripDetail } from '../components/aviation/AviationTripDetail';
import { FAAWatchPanel } from '../components/aviation/FAAWatchPanel';
import { FacilityRadiusMap } from '../components/aviation/FacilityRadiusMap';
import { IntegrationStatusPanel } from '../components/aviation/IntegrationStatusPanel';
import { NearbyFacilitiesTable } from '../components/aviation/NearbyFacilitiesTable';
import { NoaaLiveIntegrationReadinessPanel } from '../components/aviation/NoaaLiveIntegrationReadinessPanel';
import { ProductionReadinessChecklist } from '../components/aviation/ProductionReadinessChecklist';
import { RadiusSelector } from '../components/aviation/RadiusSelector';
import { SavedTripsPanel } from '../components/aviation/SavedTripsPanel';
import { TripBriefPanel } from '../components/aviation/TripBriefPanel';
import { TripReadinessActions } from '../components/aviation/TripReadinessActions';
import { TripRiskScoreCard } from '../components/aviation/TripRiskScoreCard';
import { WeatherRiskPanel } from '../components/aviation/WeatherRiskPanel';
import { getAirportById } from '../services/airportService';
import { recordAviationAuditEvent } from '../services/aviationAuditService';
import { getAviationPermissions } from '../services/aviationAuthorizationService';
import { isApprovedPilotRole } from '../services/aviationPilotConfig';
import { calculateTripRiskScore } from '../services/aviationRiskEngine';
import { deleteTripPlan, duplicateTripPlan, getSavedTripPlans, saveTripPlan } from '../services/aviationTripStorageService';
import { getFacilitiesForAviationScan } from '../services/facilityDataAdapter';
import { scanFacilitiesNearAirport } from '../services/facilityGeoService';
import { getFAAAlertsForAirport, type FAAProviderResult } from '../services/faaService';
import { generateReadinessActions, updateReadinessActionStatus } from '../services/readinessActionService';
import { generateTripBrief } from '../services/tripBriefService';
import { getWeatherAlertsForAirport, type WeatherProviderResult } from '../services/weatherService';
import type { Airport, AviationTripPlan, AviationUserRole, FacilityWithDistance, NormalizedFacility, TripReadinessAction } from '../types/aviation';

const emptyFAAResult: FAAProviderResult = { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data' };
const emptyWeatherResult: WeatherProviderResult = { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data' };

function newTripId() {
  return `TRIP-${Date.now()}`;
}

export function AviationCommandCenter() {
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<number>(25);
  const [selectedFacilityTypes, setSelectedFacilityTypes] = useState<string[]>([]);
  const [facilitySource, setFacilitySource] = useState<NormalizedFacility[]>([]);
  const [nearbyFacilities, setNearbyFacilities] = useState<FacilityWithDistance[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [tripStart, setTripStart] = useState<string>('');
  const [tripEnd, setTripEnd] = useState<string>('');
  const [role, setRole] = useState<AviationUserRole>('aviation_admin');
  const [faaResult, setFaaResult] = useState<FAAProviderResult>(emptyFAAResult);
  const [weatherResult, setWeatherResult] = useState<WeatherProviderResult>(emptyWeatherResult);
  const [readinessActions, setReadinessActions] = useState<TripReadinessAction[]>([]);
  const [savedTrips, setSavedTrips] = useState<AviationTripPlan[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string>(newTripId());
  const [detailTrip, setDetailTrip] = useState<AviationTripPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'trips' | 'data' | 'governance' | 'feedback' | 'metrics' | 'handoff'>('scanner');

  const permissions = useMemo(() => getAviationPermissions(role), [role]);
  const facilityTypes = useMemo(() => Array.from(new Set(facilitySource.map((facility) => facility.facility_type))).sort(), [facilitySource]);
  const risk = useMemo(
    () => calculateTripRiskScore({ nearbyFacilities, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts, hasSelectedAirport: Boolean(selectedAirport) }),
    [nearbyFacilities, faaResult.alerts, weatherResult.alerts, selectedAirport],
  );
  const generatedBrief = useMemo(() => generateTripBrief({ airport: selectedAirport, radiusMiles, tripStart, tripEnd, facilityTypes: selectedFacilityTypes, nearbyFacilities, risk, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts }), [selectedAirport, radiusMiles, tripStart, tripEnd, selectedFacilityTypes, nearbyFacilities, risk, faaResult.alerts, weatherResult.alerts]);

  useEffect(() => {
    recordAviationAuditEvent({ event_type: 'aviation_module_opened', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: 'Aviation Travel Readiness module opened.' });
    getFacilitiesForAviationScan().then(setFacilitySource).catch(() => setFacilitySource([]));
    refreshSavedTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recordAviationAuditEvent({ event_type: 'trip_risk_calculated', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Trip risk calculated: ${risk.score} (${risk.band}).`, source_context: { provider: 'fpiRiskProvider', source_status: 'seeded_demo', confidence: risk.confidence } });
  }, [risk.score]);

  useEffect(() => {
    let cancelled = false;
    async function loadProviderData() {
      if (!selectedAirport) {
        setFaaResult(emptyFAAResult);
        setWeatherResult(emptyWeatherResult);
        return;
      }
      const [faa, weather] = await Promise.all([
        getFAAAlertsForAirport(selectedAirport.airport_id, tripStart, tripEnd),
        getWeatherAlertsForAirport(selectedAirport, tripStart, tripEnd),
      ]);
      if (!cancelled) {
        setFaaResult(faa);
        setWeatherResult(weather);
        recordAviationAuditEvent({ event_type: 'faa_alerts_loaded', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport.airport_id, summary: `${faa.alerts.length} FAA alert(s) loaded.`, source_context: { provider: 'faaProvider', source_status: faa.source, confidence: faa.confidence } });
        recordAviationAuditEvent({ event_type: 'weather_alerts_loaded', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport.airport_id, summary: `${weather.alerts.length} weather alert(s) loaded.`, source_context: { provider: 'weatherProvider', source_status: weather.source, confidence: weather.confidence } });
      }
    }
    loadProviderData();
    return () => { cancelled = true; };
  }, [selectedAirport, tripStart, tripEnd]);

  async function refreshSavedTrips() {
    setSavedTrips(await getSavedTripPlans());
  }

  function handleScan() {
    if (!selectedAirport) return;
    const matches = scanFacilitiesNearAirport({ airport: selectedAirport, facilities: facilitySource, radiusMiles, facilityTypes: selectedFacilityTypes });
    setNearbyFacilities(matches);
    setSelectedFacilityId(matches[0]?.facility_id ?? null);
    recordAviationAuditEvent({ event_type: 'facilities_scanned', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport.airport_id, summary: `${matches.length} facilities scanned within ${radiusMiles} miles.`, source_context: { provider: 'facilityProvider', source_status: 'seeded_demo', confidence: 60 } });
  }

  function toggleFacilityType(type: string) {
    setSelectedFacilityTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  function generateActions() {
    const actions = generateReadinessActions({ tripId: currentTripId, weatherAlerts: weatherResult.alerts, faaAlerts: faaResult.alerts, nearbyFacilities, risk });
    setReadinessActions(actions);
    recordAviationAuditEvent({ event_type: 'readiness_actions_generated', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `${actions.length} readiness action(s) generated.` });
  }

  function updateActionStatus(actionId: string, status: TripReadinessAction['status']) {
    setReadinessActions((actions) => updateReadinessActionStatus(actions, actionId, status));
    recordAviationAuditEvent({ event_type: 'readiness_action_status_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Readiness action ${actionId} changed to ${status}.` });
  }

  async function saveCurrentTrip() {
    if (!selectedAirport) return;
    const stamp = new Date().toISOString();
    const trip: AviationTripPlan = {
      trip_id: currentTripId,
      trip_name: `Aviation scan - ${selectedAirport.faa_id ?? selectedAirport.airport_name}`,
      airport_id: selectedAirport.airport_id,
      airport_snapshot: selectedAirport,
      trip_start: tripStart || null,
      trip_end: tripEnd || null,
      radius_miles: radiusMiles,
      facility_types: selectedFacilityTypes,
      nearby_facilities: nearbyFacilities,
      faa_alerts: faaResult.alerts,
      weather_alerts: weatherResult.alerts,
      risk_score: risk.score,
      risk_band: risk.band,
      confidence: risk.confidence,
      primary_drivers: risk.drivers,
      readiness_actions: readinessActions,
      generated_brief: generatedBrief,
      status: 'draft',
      created_at: stamp,
      updated_at: stamp,
      last_scanned: stamp,
      source_freshness: 'seeded_demo',
    };
    await saveTripPlan(trip);
    recordAviationAuditEvent({ event_type: 'trip_saved', actor_role: role, trip_id: trip.trip_id, airport_id: trip.airport_id, summary: `Trip saved: ${trip.trip_name}.` });
    await refreshSavedTrips();
  }

  function openTrip(trip: AviationTripPlan) {
    recordAviationAuditEvent({ event_type: 'trip_opened', actor_role: role, trip_id: trip.trip_id, airport_id: trip.airport_id, summary: `Trip opened: ${trip.trip_name}.` });
    setDetailTrip(trip);
    setCurrentTripId(trip.trip_id);
    setSelectedAirport(trip.airport_snapshot);
    setRadiusMiles(trip.radius_miles);
    setTripStart(trip.trip_start ?? '');
    setTripEnd(trip.trip_end ?? '');
    setSelectedFacilityTypes(trip.facility_types);
    setNearbyFacilities(trip.nearby_facilities);
    setFaaResult({ alerts: trip.faa_alerts, source: 'seeded_demo', last_updated: trip.updated_at, confidence: trip.confidence, status: trip.faa_alerts.length ? 'ok' : 'no_data' });
    setWeatherResult({ alerts: trip.weather_alerts, source: 'seeded_demo', last_updated: trip.updated_at, confidence: trip.confidence, status: trip.weather_alerts.length ? 'ok' : 'no_data' });
    setReadinessActions(trip.readiness_actions);
    setSelectedFacilityId(trip.nearby_facilities[0]?.facility_id ?? null);
  }

  async function duplicateSavedTrip(tripId: string) {
    const duplicated = await duplicateTripPlan(tripId);
    recordAviationAuditEvent({ event_type: 'trip_duplicated', actor_role: role, trip_id: duplicated.trip_id, airport_id: duplicated.airport_id, summary: `Trip duplicated from ${tripId}.` });
    await refreshSavedTrips();
    openTrip(duplicated);
  }

  async function deleteSavedTrip(tripId: string) {
    await deleteTripPlan(tripId);
    recordAviationAuditEvent({ event_type: 'trip_deleted', actor_role: role, trip_id: tripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Trip deleted: ${tripId}.` });
    if (tripId === currentTripId) setCurrentTripId(newTripId());
    await refreshSavedTrips();
  }

  async function launchDemoScenario() {
    recordAviationAuditEvent({ event_type: 'demo_scenario_launched', actor_role: role, trip_id: currentTripId, airport_id: 'AIR-XNA', summary: 'One-click Executive Regional Airport Trip demo launched.' });
    const airport = await getAirportById('AIR-XNA');
    if (!airport) return;
    const demoStart = '2026-05-14T12:00';
    const demoEnd = '2026-05-14T20:00';
    const tripId = newTripId();
    const facilities = facilitySource.length ? facilitySource : await getFacilitiesForAviationScan();
    const scanned = scanFacilitiesNearAirport({ airport, facilities, radiusMiles: 25, facilityTypes: [] });
    const [faa, weather] = await Promise.all([getFAAAlertsForAirport(airport.airport_id, demoStart, demoEnd), getWeatherAlertsForAirport(airport, demoStart, demoEnd)]);
    const demoRisk = calculateTripRiskScore({ nearbyFacilities: scanned, faaAlerts: faa.alerts, weatherAlerts: weather.alerts, hasSelectedAirport: true });
    setCurrentTripId(tripId);
    setSelectedAirport(airport);
    setRadiusMiles(25);
    setTripStart(demoStart);
    setTripEnd(demoEnd);
    setSelectedFacilityTypes([]);
    setNearbyFacilities(scanned);
    setSelectedFacilityId(scanned[0]?.facility_id ?? null);
    setFaaResult(faa);
    setWeatherResult(weather);
    setReadinessActions(generateReadinessActions({ tripId, weatherAlerts: weather.alerts, faaAlerts: faa.alerts, nearbyFacilities: scanned, risk: demoRisk }));
  }

  return (
    <section className="aviation-command-center">
      <header className="dashboard-header aviation-header">
        <div>
          <p className="eyebrow">FPI aviation module · Phase 1.5 demo hardening</p>
          <h1>Aviation Travel Readiness</h1>
          <p>Airport radius scanning, Walmart facility risk ranking, FAA/NOAA provider adapters, advisory recommendations, saved trip scans, readiness actions, and a visual radius map.</p>
        </div>
        <div className="mode-pill" aria-label="Mode uploaded and seeded data"><span>MODE</span> Uploaded airport GeoJSON + seeded demo risk data</div>
      </header>

      <AviationPilotBanner />
      <section className="aviation-note panel">
        <strong>Production data note:</strong> Phase 4 controlled pilot mode preserves seeded/demo behavior. Airport data lazy-loads from static JSON; facility, FAA, NOAA, and support data are adapter-backed demo fallbacks unless provider config explicitly enables live_api. FPI recommendations are advisory only.
      </section>
      <nav className="aviation-tabs" aria-label="Aviation pilot navigation">
 {[
          ['scanner', 'Trip Scanner'], ['trips', 'Trip Detail / Saved Trips'], ['data', 'Data & Integrations'], ['governance', 'Governance'], ['feedback', 'Pilot Feedback'], ['metrics', 'Pilot Metrics'], ['handoff', 'Production Handoff'],
        ].map(([id, label]) => <button key={id} type="button" className={activeTab === id ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => setActiveTab(id as typeof activeTab)}>{label}</button>)}
      </nav>

      {activeTab === 'scanner' ? <div className="aviation-layout">
        <aside className="aviation-left">
          <AviationDemoScenario onLaunch={launchDemoScenario} />
          <section className="panel aviation-panel">
            <div className="card-heading"><div><p className="eyebrow">Role-based access</p><h3>Current Role</h3></div></div>
            <select className="aviation-input" value={role} onChange={(event) => setRole(event.target.value as AviationUserRole)}>
              <option value="aviation_admin">Aviation Admin</option><option value="aviation_user">Aviation User</option><option value="executive_protection">Executive Protection</option><option value="global_security">Global Security</option><option value="field_security">Field Security</option><option value="fpi_admin">FPI Admin</option><option value="viewer">Viewer</option>
            </select>
            <p className="aviation-caveat">Pilot role status: {isApprovedPilotRole(role) ? 'approved for controlled pilot' : 'limited / not in approved pilot role list'}.</p>
          </section>
          <AirportSearch selectedAirport={selectedAirport} onSelectAirport={(airport) => { setSelectedAirport(airport); recordAviationAuditEvent({ event_type: 'airport_selected', actor_role: role, trip_id: currentTripId, airport_id: airport.airport_id, summary: `Airport selected: ${airport.airport_name}.`, source_context: { provider: 'airportProvider', source_status: airport.source_freshness, confidence: 85 } }); }} />
          <RadiusSelector radiusMiles={radiusMiles} onChange={(miles) => { setRadiusMiles(miles); recordAviationAuditEvent({ event_type: 'radius_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Radius changed to ${miles} miles.` }); }} />
          <section className="panel aviation-panel">
            <div className="card-heading"><div><p className="eyebrow">Trip window</p><h3>Timing</h3></div></div>
            <input className="aviation-input" type="datetime-local" value={tripStart} onChange={(event) => setTripStart(event.target.value)} aria-label="Trip start" />
            <input className="aviation-input" type="datetime-local" value={tripEnd} onChange={(event) => setTripEnd(event.target.value)} aria-label="Trip end" />
            {!permissions.canViewSensitiveTripDetails ? <p className="aviation-empty">Trip details are restricted for this role. Future production auth will enforce enterprise role claims.</p> : null}
          </section>
          <section className="panel aviation-panel">
            <div className="card-heading"><div><p className="eyebrow">Facility filters</p><h3>Types</h3></div></div>
            <div className="aviation-chip-list">{facilityTypes.map((type) => <button key={type} type="button" className={selectedFacilityTypes.includes(type) ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => toggleFacilityType(type)}>{type}</button>)}</div>
            <button type="button" className="ops-action-button aviation-scan-button" disabled={!selectedAirport} onClick={handleScan}>Scan Facilities</button>
          </section>
          <SavedTripsPanel trips={savedTrips} onSave={saveCurrentTrip} onOpen={openTrip} onDuplicate={duplicateSavedTrip} onDelete={deleteSavedTrip} />
        </aside>

        <main className="aviation-center">
          <FacilityRadiusMap airport={selectedAirport} radiusMiles={radiusMiles} facilities={nearbyFacilities} selectedFacilityId={selectedFacilityId} onFacilitySelect={(facility) => setSelectedFacilityId(facility.facility_id)} />
          <NearbyFacilitiesTable facilities={nearbyFacilities} canViewEPReadiness={permissions.canViewEPReadiness} />
          <TripReadinessActions actions={readinessActions} canCreateActions={permissions.canCreateReadinessActions} canViewEPReadiness={permissions.canViewEPReadiness} onGenerateActions={generateActions} onStatusChange={updateActionStatus} />
        </main>

        <aside className="aviation-right">
          <TripRiskScoreCard risk={risk} canViewRecommendation={permissions.canViewGoNoGoRecommendation} />
          <FAAWatchPanel result={faaResult} />
          <WeatherRiskPanel result={weatherResult} />
          <AskFPIAviationPanel airport={selectedAirport} facilities={nearbyFacilities} risk={risk} faaAlerts={faaResult.alerts} weatherAlerts={weatherResult.alerts} />
          <TripBriefPanel airport={selectedAirport} radiusMiles={radiusMiles} tripStart={tripStart} tripEnd={tripEnd} facilityTypes={selectedFacilityTypes} nearbyFacilities={nearbyFacilities} risk={risk} faaAlerts={faaResult.alerts} weatherAlerts={weatherResult.alerts} canGenerateBrief={permissions.canGenerateBrief} canCopyBrief={permissions.canCopyBrief} actorRole={role} tripId={currentTripId} />
          <AviationAuditTimeline tripId={currentTripId} limit={8} />
        </aside>
      </div> : null}
      {activeTab === 'trips' ? <section className="aviation-layout"><aside className="aviation-left"><AviationDemoScenario onLaunch={launchDemoScenario} /><SavedTripsPanel trips={savedTrips} onSave={saveCurrentTrip} onOpen={openTrip} onDuplicate={duplicateSavedTrip} onDelete={deleteSavedTrip} /></aside><main className="aviation-center"><AviationAuditTimeline limit={20} /></main></section> : null}
      {activeTab === 'data' ? <section><IntegrationStatusPanel /><NoaaLiveIntegrationReadinessPanel /><AviationLiveIntegrationDecisionMatrix /><ProductionReadinessChecklist /></section> : null}
      {activeTab === 'governance' ? <section><AviationStakeholderPilotPlanPanel /><AviationGovernanceMatrix /><ProductionReadinessChecklist /></section> : null}
      {activeTab === 'feedback' ? <section><AviationPilotUatRunLog actorRole={role} /><AviationStakeholderDecisionLog actorRole={role} /><AviationPilotFeedbackPanel actorRole={role} tripId={currentTripId} /><AviationPilotIssueTracker actorRole={role} /></section> : null}
      {activeTab === 'metrics' ? <section><AviationProductionPilotReadinessScorePanel /><AviationPilotMetricsPanel /></section> : null}
      {activeTab === 'handoff' ? <section><AviationPilotReadoutReportPanel actorRole={role} /><AviationHandoffPacketPanel actorRole={role} /></section> : null}
      {detailTrip ? <AviationTripDetail trip={detailTrip} currentRole={role} onClose={() => setDetailTrip(null)} onTripUpdated={(trip) => { setDetailTrip(trip); refreshSavedTrips(); }} /> : null}
    </section>
  );
}
