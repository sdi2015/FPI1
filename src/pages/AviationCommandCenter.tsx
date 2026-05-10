import { useEffect, useMemo, useState } from 'react';
import { AviationAdminGovernance } from '../components/aviation/AviationAdminGovernance';
import { AviationAirportScanner } from '../components/aviation/AviationAirportScanner';
import { AviationAlertsIntelligence } from '../components/aviation/AviationAlertsIntelligence';
import { AviationAuditTimeline } from '../components/aviation/AviationAuditTimeline';
import { AviationDataValidationPanel } from '../components/aviation/AviationDataValidationPanel';
import { AviationHeaderSummary } from '../components/aviation/AviationHeaderSummary';
import { AviationOperationsDashboard } from '../components/aviation/AviationOperationsDashboard';
import { AviationReportsCenter } from '../components/aviation/AviationReportsCenter';
import { AviationTabNav, type AviationOpsTab } from '../components/aviation/AviationTabNav';
import { AviationTripDetail } from '../components/aviation/AviationTripDetail';
import { AviationTripPlanner } from '../components/aviation/AviationTripPlanner';
import { SavedTripsPanel } from '../components/aviation/SavedTripsPanel';
import { TripReadinessActions } from '../components/aviation/TripReadinessActions';
import { TripRiskScoreCard } from '../components/aviation/TripRiskScoreCard';
import { getAirportById } from '../services/airportService';
import { recordAviationAuditEvent } from '../services/aviationAuditService';
import { getAviationPermissions } from '../services/aviationAuthorizationService';
import { canUseLocalAviationRoleSelector, getCurrentAviationIdentity, type AviationIdentity } from '../services/aviationIdentityService';
import { isApprovedPilotRole } from '../services/aviationPilotConfig';
import { calculateTripRiskScore } from '../services/aviationRiskEngine';
import { deleteTripPlan, duplicateTripPlan, getSavedTripPlans, saveTripPlan } from '../services/aviationTripStorageService';
import { getFacilitiesForAviationScan } from '../services/facilityDataAdapter';
import { scanFacilitiesNearAirport, sortScannedFacilities } from '../services/facilityGeoService';
import { getFAAAlertsForAirport, type FAAProviderResult } from '../services/faaService';
import { generateReadinessActions, updateReadinessActionStatus } from '../services/readinessActionService';
import { generateTripBrief } from '../services/tripBriefService';
import { getWeatherAlertsForAirport, type WeatherProviderResult } from '../services/weatherService';
import type { Airport, AviationTripPlan, AviationUserRole, FacilitySortMode, FacilityWithDistance, NormalizedFacility, TripReadinessAction } from '../types/aviation';

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
  const [scanResults, setScanResults] = useState<FacilityWithDistance[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<FacilitySortMode>('risk');
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [tripName, setTripName] = useState<string>('Executive regional airport readiness plan');
  const [tripNotes, setTripNotes] = useState<string>('');
  const [tripStart, setTripStart] = useState<string>('');
  const [tripEnd, setTripEnd] = useState<string>('');
  const [role, setRole] = useState<AviationUserRole>('aviation_admin');
  const [identity, setIdentity] = useState<AviationIdentity | null>(null);
  const [faaResult, setFaaResult] = useState<FAAProviderResult>(emptyFAAResult);
  const [weatherResult, setWeatherResult] = useState<WeatherProviderResult>(emptyWeatherResult);
  const [readinessActions, setReadinessActions] = useState<TripReadinessAction[]>([]);
  const [savedTrips, setSavedTrips] = useState<AviationTripPlan[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string>(newTripId());
  const [detailTrip, setDetailTrip] = useState<AviationTripPlan | null>(null);
  const [activeTab, setActiveTab] = useState<AviationOpsTab>('dashboard');
  const [briefVisible, setBriefVisible] = useState(false);

  const roleSelectorAllowed = canUseLocalAviationRoleSelector();
  const permissions = useMemo(() => identity?.permissions ?? getAviationPermissions(role), [identity?.permissions, role]);
  const facilityTypes = useMemo(() => Array.from(new Set(facilitySource.map((facility) => facility.facility_type))).sort(), [facilitySource]);
  const nearbyFacilities = useMemo(() => sortScannedFacilities(scanResults.filter((facility) => selectedFacilityTypes.length === 0 || selectedFacilityTypes.includes(facility.facility_type)), sortMode), [scanResults, selectedFacilityTypes, sortMode]);
  const risk = useMemo(() => calculateTripRiskScore({ nearbyFacilities, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts, hasSelectedAirport: Boolean(selectedAirport) }), [nearbyFacilities, faaResult.alerts, weatherResult.alerts, selectedAirport]);
  const generatedBrief = useMemo(() => generateTripBrief({ airport: selectedAirport, radiusMiles, tripStart, tripEnd, facilityTypes: selectedFacilityTypes, nearbyFacilities, risk, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts }), [selectedAirport, radiusMiles, tripStart, tripEnd, selectedFacilityTypes, nearbyFacilities, risk, faaResult.alerts, weatherResult.alerts]);
  const currentTripForValidation = useMemo<AviationTripPlan | null>(() => selectedAirport ? buildCurrentTrip('draft') : null, [selectedAirport, tripName, tripStart, tripEnd, radiusMiles, selectedFacilityTypes, nearbyFacilities, faaResult.alerts, weatherResult.alerts, risk, readinessActions, generatedBrief, currentTripId]);

  useEffect(() => {
    getCurrentAviationIdentity().then((currentIdentity) => {
      setIdentity(currentIdentity);
      if (!roleSelectorAllowed) setRole(currentIdentity.active_role);
    }).catch(() => undefined);
    recordAviationAuditEvent({ event_type: 'aviation_module_opened', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: 'Aviation Operations Command Center opened.' });
    getFacilitiesForAviationScan().then(setFacilitySource).catch(() => setFacilitySource([]));
    refreshSavedTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recordAviationAuditEvent({ event_type: 'trip_risk_calculated', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Trip risk calculated: ${risk.score} (${risk.band}).`, source_context: { provider: 'fpiRiskProvider', source_status: 'seeded_demo', confidence: risk.confidence } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk.score]);

  useEffect(() => {
    let cancelled = false;
    async function loadProviderData() {
      if (!selectedAirport) {
        setFaaResult(emptyFAAResult);
        setWeatherResult(emptyWeatherResult);
        return;
      }
      const [faa, weather] = await Promise.all([getFAAAlertsForAirport(selectedAirport.airport_id, tripStart, tripEnd), getWeatherAlertsForAirport(selectedAirport, tripStart, tripEnd)]);
      if (!cancelled) {
        setFaaResult(faa);
        setWeatherResult(weather);
        recordAviationAuditEvent({ event_type: 'faa_alerts_loaded', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport.airport_id, summary: `${faa.alerts.length} FAA alert(s) loaded.`, source_context: { provider: 'faaProvider', source_status: faa.source, confidence: faa.confidence } });
        recordAviationAuditEvent({ event_type: 'weather_alerts_loaded', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport.airport_id, summary: `${weather.alerts.length} weather alert(s) loaded.`, source_context: { provider: 'weatherProvider', source_status: weather.source, confidence: weather.confidence } });
      }
    }
    loadProviderData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAirport, tripStart, tripEnd]);

  function buildCurrentTrip(status: AviationTripPlan['status']): AviationTripPlan {
    const stamp = new Date().toISOString();
    if (!selectedAirport) throw new Error('Airport is required to build a trip plan.');
    return { trip_id: currentTripId, trip_name: tripName || `Aviation scan - ${selectedAirport.faa_id ?? selectedAirport.airport_name}`, airport_id: selectedAirport.airport_id, airport_snapshot: selectedAirport, trip_start: tripStart || null, trip_end: tripEnd || null, radius_miles: radiusMiles, facility_types: selectedFacilityTypes, nearby_facilities: nearbyFacilities, faa_alerts: faaResult.alerts, weather_alerts: weatherResult.alerts, risk_score: risk.score, risk_band: risk.band, confidence: risk.confidence, primary_drivers: risk.drivers, readiness_actions: readinessActions, generated_brief: generatedBrief, status, created_at: stamp, updated_at: stamp, last_scanned: stamp, source_freshness: 'seeded_demo' };
  }

  async function refreshSavedTrips() {
    setSavedTrips(await getSavedTripPlans());
  }

  function selectAirport(airport: Airport) {
    setSelectedAirport(airport);
    setTripName((current) => current || `Aviation readiness - ${airport.faa_id ?? airport.airport_name}`);
    recordAviationAuditEvent({ event_type: 'airport_selected', actor_role: role, trip_id: currentTripId, airport_id: airport.airport_id, summary: `Airport selected: ${airport.airport_name}.`, source_context: { provider: 'airportProvider', source_status: airport.source_freshness, confidence: 85 } });
  }

  function handleScan() {
    if (!selectedAirport) return;
    setScanning(true);
    const matches = scanFacilitiesNearAirport({ airport: selectedAirport, facilities: facilitySource, radiusMiles, facilityTypes: [], sortMode });
    setScanResults(matches);
    const visibleMatches = matches.filter((facility) => selectedFacilityTypes.length === 0 || selectedFacilityTypes.includes(facility.facility_type));
    setSelectedFacilityId(visibleMatches[0]?.facility_id ?? matches[0]?.facility_id ?? null);
    setLastScannedAt(new Date().toISOString());
    setScanning(false);
    setActiveTab('scanner');
    recordAviationAuditEvent({ event_type: 'facilities_scanned', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport.airport_id, summary: `${matches.length} facilities scanned within ${radiusMiles} miles.`, source_context: { provider: 'facilityProvider', source_status: 'seeded_demo', confidence: 60 }, metadata: { facilityTypes: selectedFacilityTypes, sortMode } });
  }

  function clearScan() {
    setScanResults([]);
    setSelectedFacilityId(null);
    setLastScannedAt(null);
  }

  function toggleFacilityType(type: string) {
    setSelectedFacilityTypes((current) => {
      const active = current.includes('__none__') ? [] : current;
      const next = active.includes(type) ? active.filter((item) => item !== type) : [...active, type];
      recordAviationAuditEvent({ event_type: 'facility_filters_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Facility filters changed: ${next.length ? next.join(', ') : 'All Walmart Facilities'}.` });
      return next;
    });
  }

  function selectAllFacilityTypes() {
    setSelectedFacilityTypes([]);
    recordAviationAuditEvent({ event_type: 'facility_filters_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: 'Facility filters changed: All Walmart Facilities.' });
  }

  function clearFacilityTypes() {
    setSelectedFacilityTypes(['__none__']);
    recordAviationAuditEvent({ event_type: 'facility_filters_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: 'Facility filters changed: none selected.' });
  }

  function changeSortMode(mode: FacilitySortMode) {
    setSortMode(mode);
  }

  function selectFacilityMarker(facility: FacilityWithDistance) {
    setSelectedFacilityId(facility.facility_id);
    recordAviationAuditEvent({ event_type: 'facility_marker_selected', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Facility selected from map/table: ${facility.facility_name}.`, metadata: { facility_id: facility.facility_id, distance_miles: facility.distance_miles } });
  }

  function generateActions() {
    const actions = generateReadinessActions({ tripId: currentTripId, weatherAlerts: weatherResult.alerts, faaAlerts: faaResult.alerts, nearbyFacilities, risk });
    setReadinessActions(actions);
    setActiveTab('risk');
    recordAviationAuditEvent({ event_type: 'readiness_actions_generated', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `${actions.length} readiness action(s) generated.` });
  }

  function updateActionStatus(actionId: string, status: TripReadinessAction['status']) {
    setReadinessActions((actions) => updateReadinessActionStatus(actions, actionId, status));
    recordAviationAuditEvent({ event_type: 'readiness_action_status_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Readiness action ${actionId} changed to ${status}.` });
  }

  async function saveCurrentTrip() {
    if (!selectedAirport) return;
    const trip = buildCurrentTrip('draft');
    await saveTripPlan(trip);
    recordAviationAuditEvent({ event_type: 'trip_saved', actor_role: role, trip_id: trip.trip_id, airport_id: trip.airport_id, summary: `Trip saved: ${trip.trip_name}.` });
    recordAviationAuditEvent({ event_type: 'scan_saved_as_trip', actor_role: role, trip_id: trip.trip_id, airport_id: trip.airport_id, summary: `Scan saved as trip: ${trip.trip_name}.` });
    await refreshSavedTrips();
  }

  function openTrip(trip: AviationTripPlan) {
    recordAviationAuditEvent({ event_type: 'trip_opened', actor_role: role, trip_id: trip.trip_id, airport_id: trip.airport_id, summary: `Trip opened: ${trip.trip_name}.` });
    setDetailTrip(trip);
    setCurrentTripId(trip.trip_id);
    setTripName(trip.trip_name);
    setSelectedAirport(trip.airport_snapshot);
    setRadiusMiles(trip.radius_miles);
    setTripStart(trip.trip_start ?? '');
    setTripEnd(trip.trip_end ?? '');
    setSelectedFacilityTypes(trip.facility_types);
    setScanResults(trip.nearby_facilities);
    setFaaResult({ alerts: trip.faa_alerts, source: 'seeded_demo', last_updated: trip.updated_at, confidence: trip.confidence, status: trip.faa_alerts.length ? 'ok' : 'no_data' });
    setWeatherResult({ alerts: trip.weather_alerts, source: 'seeded_demo', last_updated: trip.updated_at, confidence: trip.confidence, status: trip.weather_alerts.length ? 'ok' : 'no_data' });
    setReadinessActions(trip.readiness_actions);
    setSelectedFacilityId(trip.nearby_facilities[0]?.facility_id ?? null);
    setLastScannedAt(trip.last_scanned);
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
    setTripName('Executive Regional Airport Trip Demo');
    setSelectedAirport(airport);
    setRadiusMiles(25);
    setTripStart(demoStart);
    setTripEnd(demoEnd);
    setSelectedFacilityTypes([]);
    setScanResults(scanned);
    setSelectedFacilityId(scanned[0]?.facility_id ?? null);
    setLastScannedAt(new Date().toISOString());
    setFaaResult(faa);
    setWeatherResult(weather);
    setReadinessActions(generateReadinessActions({ tripId, weatherAlerts: weather.alerts, faaAlerts: faa.alerts, nearbyFacilities: scanned, risk: demoRisk }));
    setActiveTab('dashboard');
  }

  return (
    <section className="aviation-command-center aviation-ops-command-center">
      <AviationHeaderSummary role={role} selectedAirport={selectedAirport} tripName={tripName} risk={risk} onPlanTrip={() => setActiveTab('planner')} onRunScan={handleScan} onLaunchDemo={launchDemoScenario} onGenerateBrief={() => { setBriefVisible(true); setActiveTab('reports'); }} onSaveTrip={saveCurrentTrip} />
      <section className="aviation-context-bar" aria-label="Aviation context and access">
        <div className="panel aviation-panel aviation-context-card"><p className="eyebrow">Pilot mode</p><strong>Advisory workflow</strong><p className="aviation-caveat">Demo fallback remains active. Live APIs run only when explicitly enabled. Authorized human review is required.</p></div>
        <div className="panel aviation-panel aviation-context-card aviation-role-strip"><div><p className="eyebrow">Access</p>{roleSelectorAllowed ? <select className="aviation-input" value={role} onChange={(event) => setRole(event.target.value as AviationUserRole)} aria-label="Current aviation role"><option value="aviation_admin">Aviation Admin</option><option value="aviation_user">Aviation User</option><option value="executive_protection">Executive Protection</option><option value="global_security">Global Security</option><option value="field_security">Field Security</option><option value="fpi_admin">FPI Admin</option><option value="viewer">Viewer</option></select> : <strong>{identity?.display_name ?? 'Enterprise IAM user'} · {role}</strong>}</div><p className="aviation-caveat">{isApprovedPilotRole(role) ? 'Approved controlled-pilot role.' : 'Limited / not in approved pilot role list.'} {roleSelectorAllowed ? 'Local selector available outside production.' : 'Role controlled by enterprise IAM.'}</p></div>
      </section>
      <AviationTabNav activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'dashboard' ? <AviationOperationsDashboard savedTrips={savedTrips} nearbyFacilities={nearbyFacilities} readinessActions={readinessActions} faaAlerts={faaResult.alerts} weatherAlerts={weatherResult.alerts} currentRisk={risk} onPlanTrip={() => setActiveTab('planner')} onLaunchDemo={launchDemoScenario} onOpenScanner={() => setActiveTab('scanner')} onGenerateBrief={() => { setBriefVisible(true); setActiveTab('reports'); }} onViewIntegrations={() => setActiveTab('admin')} onOpenTrip={openTrip} /> : null}

      {activeTab === 'planner' ? <AviationTripPlanner role={role} selectedAirport={selectedAirport} tripName={tripName} tripStart={tripStart} tripEnd={tripEnd} radiusMiles={radiusMiles} facilityTypes={facilityTypes} selectedFacilityTypes={selectedFacilityTypes} notes={tripNotes} onAirportSelect={selectAirport} onTripNameChange={setTripName} onTripStartChange={setTripStart} onTripEndChange={setTripEnd} onRadiusChange={(miles) => { setRadiusMiles(miles); recordAviationAuditEvent({ event_type: 'radius_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Radius changed to ${miles} miles.` }); }} onToggleFacilityType={toggleFacilityType} onNotesChange={setTripNotes} onSaveTrip={saveCurrentTrip} onRunScan={handleScan} onGenerateRisk={() => setActiveTab('risk')} onGenerateActions={generateActions} onGenerateBrief={() => { setBriefVisible(true); setActiveTab('reports'); }} /> : null}

      {activeTab === 'scanner' ? <AviationAirportScanner selectedAirport={selectedAirport} radiusMiles={radiusMiles} facilityTypes={facilityTypes} selectedFacilityTypes={selectedFacilityTypes.includes('__none__') ? [] : selectedFacilityTypes} nearbyFacilities={nearbyFacilities} selectedFacilityId={selectedFacilityId} canViewEPReadiness={permissions.canViewEPReadiness} sortMode={sortMode} lastScannedAt={lastScannedAt} scanning={scanning} onAirportSelect={selectAirport} onRadiusChange={(miles) => { setRadiusMiles(miles); recordAviationAuditEvent({ event_type: 'radius_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Radius changed to ${miles} miles.` }); }} onToggleFacilityType={toggleFacilityType} onSelectAllFacilityTypes={selectAllFacilityTypes} onClearFacilityTypes={clearFacilityTypes} onSortChange={changeSortMode} onScan={handleScan} onClearScan={clearScan} onSaveTrip={saveCurrentTrip} onGenerateRisk={() => setActiveTab('risk')} onGenerateBrief={() => { setBriefVisible(true); setActiveTab('reports'); }} onFacilitySelect={selectFacilityMarker} /> : null}

      {activeTab === 'risk' ? <div className="aviation-risk-page"><TripRiskScoreCard risk={risk} canViewRecommendation={permissions.canViewGoNoGoRecommendation} />{currentTripForValidation ? <AviationDataValidationPanel trip={currentTripForValidation} canViewSensitive={permissions.canViewSensitiveTripDetails} /> : <section className="panel aviation-panel"><p className="aviation-empty">No selected airport. Select an airport and run a scan before readiness validation.</p></section>}<TripReadinessActions actions={readinessActions} canCreateActions={permissions.canCreateReadinessActions} canViewEPReadiness={permissions.canViewEPReadiness} onGenerateActions={generateActions} onStatusChange={updateActionStatus} /></div> : null}

      {activeTab === 'alerts' ? <AviationAlertsIntelligence airport={selectedAirport} faaResult={faaResult} weatherResult={weatherResult} facilities={nearbyFacilities} /> : null}

      {activeTab === 'saved' ? <div className="aviation-saved-page"><SavedTripsPanel trips={savedTrips} onSave={saveCurrentTrip} onOpen={openTrip} onDuplicate={duplicateSavedTrip} onDelete={deleteSavedTrip} /><AviationAuditTimeline tripId={currentTripId} limit={12} /></div> : null}

      {activeTab === 'reports' ? <AviationReportsCenter actorRole={role} tripId={currentTripId} airport={selectedAirport} radiusMiles={radiusMiles} tripStart={tripStart} tripEnd={tripEnd} facilityTypes={selectedFacilityTypes} nearbyFacilities={nearbyFacilities} risk={risk} faaAlerts={faaResult.alerts} weatherAlerts={weatherResult.alerts} canGenerateBrief={permissions.canGenerateBrief || briefVisible} canCopyBrief={permissions.canCopyBrief} /> : null}

      {activeTab === 'admin' ? <AviationAdminGovernance role={role} tripId={currentTripId} /> : null}
      {activeTab === 'admin' ? <AviationAuditTimeline limit={20} /> : null}
      {detailTrip ? <AviationTripDetail trip={detailTrip} currentRole={role} onClose={() => setDetailTrip(null)} onTripUpdated={(trip) => { setDetailTrip(trip); refreshSavedTrips(); }} /> : null}
    </section>
  );
}
