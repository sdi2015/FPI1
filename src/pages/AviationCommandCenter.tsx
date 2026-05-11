import { useEffect, useMemo, useState } from 'react';
import { AviationAdminGovernance } from '../components/aviation/AviationAdminGovernance';
import { AirportSearch } from '../components/aviation/AirportSearch';
import { AviationAuditTimeline } from '../components/aviation/AviationAuditTimeline';
import { AviationHeaderSummary } from '../components/aviation/AviationHeaderSummary';
import { FacilityTypeFilter } from '../components/aviation/FacilityTypeFilter';
import { RadiusSelector } from '../components/aviation/RadiusSelector';
import { AviationTripDetail } from '../components/aviation/AviationTripDetail';
import { AviationAdminDataSourcesTab, AviationAuditLogTab, AviationBriefsTab, AviationDemoScenarioTab, AviationFAAWatchTab, AviationFacilityDetailTab, AviationNearbyFacilitiesTab, AviationReadinessActionsTab, AviationRiskScoreTab, AviationTripContextBar, AviationWeatherWatchTab } from '../components/aviation/AviationReadinessTabs';
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
import { createFacilityReadinessAction, generateReadinessActions, updateReadinessActionEvidence, updateReadinessActionStatus } from '../services/readinessActionService';
import { generateTripBrief } from '../services/tripBriefService';
import { getWeatherAlertsForAirport, type WeatherProviderResult } from '../services/weatherService';
import type { Airport, AviationTripPlan, AviationUserRole, FAAAlert, FacilitySortMode, FacilityWithDistance, NormalizedFacility, TripReadinessAction, TripRiskResult, WeatherAlert } from '../types/aviation';

const emptyFAAResult: FAAProviderResult = { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data' };
const emptyWeatherResult: WeatherProviderResult = { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data' };
type AviationReviewTab = 'nearby' | 'faa' | 'weather' | 'risk' | 'actions' | 'briefs' | 'demo';

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
  const [tripName, setTripName] = useState<string>('');
  const [tripNotes, setTripNotes] = useState<string>('');
  const [tripStart, setTripStart] = useState<string>('');
  const [tripEnd, setTripEnd] = useState<string>('');
  const [travelerType, setTravelerType] = useState<string>('Executive movement/support');
  const [riskDomains, setRiskDomains] = useState<string[]>(['FAA', 'Weather', 'Facility', 'Executive Protection', 'Data freshness']);
  const [role, setRole] = useState<AviationUserRole>('aviation_admin');
  const [identity, setIdentity] = useState<AviationIdentity | null>(null);
  const [faaResult, setFaaResult] = useState<FAAProviderResult>(emptyFAAResult);
  const [weatherResult, setWeatherResult] = useState<WeatherProviderResult>(emptyWeatherResult);
  const [readinessActions, setReadinessActions] = useState<TripReadinessAction[]>([]);
  const [savedTrips, setSavedTrips] = useState<AviationTripPlan[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string>(newTripId());
  const [detailTrip, setDetailTrip] = useState<AviationTripPlan | null>(null);
  const [activeTab, setActiveTab] = useState<AviationReviewTab>('nearby');
  const [briefVisible, setBriefVisible] = useState(false);

  const roleSelectorAllowed = canUseLocalAviationRoleSelector();
  const permissions = useMemo(() => identity?.permissions ?? getAviationPermissions(role), [identity?.permissions, role]);
  const facilityTypes = useMemo(() => Array.from(new Set(facilitySource.map((facility) => facility.facility_type))).sort(), [facilitySource]);
  const nearbyFacilities = useMemo(() => sortScannedFacilities(scanResults.filter((facility) => selectedFacilityTypes.length === 0 || selectedFacilityTypes.includes(facility.facility_type)), sortMode), [scanResults, selectedFacilityTypes, sortMode]);
  const risk = useMemo(() => calculateTripRiskScore({ nearbyFacilities, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts, hasSelectedAirport: Boolean(selectedAirport) }), [nearbyFacilities, faaResult.alerts, weatherResult.alerts, selectedAirport]);
  const generatedBrief = useMemo(() => generateTripBrief({ airport: selectedAirport, radiusMiles, tripStart, tripEnd, facilityTypes: selectedFacilityTypes, nearbyFacilities, risk, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts }), [selectedAirport, radiusMiles, tripStart, tripEnd, selectedFacilityTypes, nearbyFacilities, risk, faaResult.alerts, weatherResult.alerts]);
  const currentTripForValidation = useMemo<AviationTripPlan | null>(() => selectedAirport ? buildCurrentTrip('draft') : null, [selectedAirport, tripName, tripStart, tripEnd, radiusMiles, selectedFacilityTypes, nearbyFacilities, faaResult.alerts, weatherResult.alerts, risk, readinessActions, generatedBrief, currentTripId]);
  const selectedFacility = useMemo(() => nearbyFacilities.find((facility) => facility.facility_id === selectedFacilityId) ?? null, [nearbyFacilities, selectedFacilityId]);
  const aviationContext = useMemo(() => ({ airport: selectedAirport, radiusMiles, tripStart, tripEnd, facilities: nearbyFacilities, risk, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts, lastScannedAt }), [selectedAirport, radiusMiles, tripStart, tripEnd, nearbyFacilities, risk, faaResult.alerts, weatherResult.alerts, lastScannedAt]);

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
    setActiveTab('nearby');
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
    setActiveTab('actions');
    recordAviationAuditEvent({ event_type: 'readiness_actions_generated', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `${actions.length} readiness action(s) generated.` });
  }

  function updateActionStatus(actionId: string, status: TripReadinessAction['status']) {
    const oldStatus = readinessActions.find((action) => action.action_id === actionId)?.status;
    setReadinessActions((actions) => updateReadinessActionStatus(actions, actionId, status));
    recordAviationAuditEvent({ event_type: 'readiness_action_status_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Readiness action ${actionId} changed to ${status}.`, metadata: { action_id: actionId, oldValue: oldStatus, newValue: status } });
  }

  function updateActionEvidence(actionId: string, updates: Pick<Partial<TripReadinessAction>, 'evidence_note' | 'evidence_file_name' | 'evidence_received' | 'verifier_name' | 'verified_at'>) {
    setReadinessActions((actions) => updateReadinessActionEvidence(actions, actionId, updates));
    recordAviationAuditEvent({ event_type: 'readiness_action_status_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Readiness action ${actionId} evidence updated.`, metadata: { action_id: actionId, ...updates } });
  }

  function createFacilityAction(facility: FacilityWithDistance) {
    const action = createFacilityReadinessAction(currentTripId, facility);
    setReadinessActions((actions) => [action, ...actions]);
    setActiveTab('actions');
    recordAviationAuditEvent({ event_type: 'readiness_actions_generated', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Facility readiness action created for ${facility.facility_name}.`, metadata: { facility_id: facility.facility_id, action_id: action.action_id } });
  }

  function markFacilitySupportCandidate(facility: FacilityWithDistance, candidate: boolean) {
    setScanResults((facilities) => facilities.map((item) => item.facility_id === facility.facility_id ? { ...item, aviation_support_candidate: candidate, recommended_action: candidate ? 'Candidate for support/staging' : item.recommended_action } : item));
    recordAviationAuditEvent({ event_type: 'facility_marker_selected', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `${facility.facility_name} support candidate changed to ${candidate ? 'Yes' : 'No'}.`, metadata: { facility_id: facility.facility_id, oldValue: facility.aviation_support_candidate, newValue: candidate } });
  }

  function addFacilityNote(facility: FacilityWithDistance, note: string) {
    if (!note.trim()) return;
    recordAviationAuditEvent({ event_type: 'facility_marker_selected', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Facility note added for ${facility.facility_name}.`, metadata: { facility_id: facility.facility_id, note } });
  }

  function toggleRiskDomain(domain: string) {
    setRiskDomains((current) => current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain]);
  }

  async function saveCurrentTrip() {
    if (!selectedAirport || !tripName.trim()) return;
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

  function handleNewTrip() {
    setCurrentTripId(newTripId());
    setTripName('');
    setTripNotes('');
    setTripStart('');
    setTripEnd('');
    setTravelerType('Executive movement/support');
    setSelectedAirport(null);
    setRadiusMiles(25);
    setSelectedFacilityTypes([]);
    setScanResults([]);
    setSelectedFacilityId(null);
    setLastScannedAt(null);
    setFaaResult(emptyFAAResult);
    setWeatherResult(emptyWeatherResult);
    setReadinessActions([]);
    setBriefVisible(false);
    setActiveTab('nearby');
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
    setActiveTab('nearby');
  }

  const hasScanned = Boolean(lastScannedAt);
  const visibleFacilityTypes = selectedFacilityTypes.includes('__none__') ? [] : selectedFacilityTypes;

  function updateRadius(miles: number) {
    setRadiusMiles(miles);
    recordAviationAuditEvent({ event_type: 'radius_changed', actor_role: role, trip_id: currentTripId, airport_id: selectedAirport?.airport_id ?? null, summary: `Radius changed to ${miles} miles.` });
  }

  return (
    <section className="aviation-command-center aviation-ops-command-center aviation-guided-workspace">
      <AviationHeaderSummary canRunScan={Boolean(selectedAirport)} onPlanTrip={handleNewTrip} onRunScan={handleScan} />
      {(selectedAirport || tripName) ? <AviationTripContextBar airport={selectedAirport} radiusMiles={radiusMiles} tripName={tripName} tripStart={tripStart} tripEnd={tripEnd} risk={risk} hasScanned={hasScanned} /> : null}

      <main className="aviation-workspace" aria-label="Aviation Travel Readiness guided workspace">
        <section className="aviation-top-grid">
          <TripSetupCard
            selectedAirport={selectedAirport}
            tripName={tripName}
            tripStart={tripStart}
            tripEnd={tripEnd}
            missionType={travelerType}
            notes={tripNotes}
            radiusMiles={radiusMiles}
            facilityTypes={facilityTypes}
            selectedFacilityTypes={visibleFacilityTypes}
            savedTrips={savedTrips}
            canSaveTrip={Boolean(selectedAirport && tripName.trim())}
            onOpenTrip={openTrip}
            onAirportSelect={selectAirport}
            onTripNameChange={setTripName}
            onTripStartChange={setTripStart}
            onTripEndChange={setTripEnd}
            onMissionTypeChange={setTravelerType}
            onNotesChange={setTripNotes}
            onRadiusChange={updateRadius}
            onToggleFacilityType={toggleFacilityType}
            onSelectAllFacilityTypes={selectAllFacilityTypes}
            onClearFacilityTypes={clearFacilityTypes}
            onSaveTrip={saveCurrentTrip}
          />
          <ScanControlsCard
            selectedAirport={selectedAirport}
            radiusMiles={radiusMiles}
            selectedFacilityTypes={visibleFacilityTypes}
            facilityCount={nearbyFacilities.length}
            lastScannedAt={lastScannedAt}
            scanning={scanning}
            onRunScan={handleScan}
            onClearScan={clearScan}
          />
        </section>

        <ReadinessSummary hasScanned={hasScanned} facilitiesCount={nearbyFacilities.length} faaCount={faaResult.alerts.length} weatherCount={weatherResult.alerts.length} actionsCount={readinessActions.filter((action) => action.status !== 'Closed').length} riskBand={risk.band} riskScore={risk.score} />

        <ReviewWorkspace
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          hasScanned={hasScanned}
          context={aviationContext}
          selectedFacilityId={selectedFacilityId}
          canViewEPReadiness={permissions.canViewEPReadiness}
          canViewRecommendation={permissions.canViewGoNoGoRecommendation}
          canCreateActions={permissions.canCreateReadinessActions}
          canGenerateBrief={permissions.canGenerateBrief || briefVisible}
          canCopyBrief={permissions.canCopyBrief}
          sortMode={sortMode}
          selectedFacility={selectedFacility}
          readinessActions={readinessActions}
          actorRole={role}
          tripId={currentTripId}
          facilityTypes={selectedFacilityTypes}
          onSortChange={changeSortMode}
          onFacilitySelect={selectFacilityMarker}
          onCreateAction={createFacilityAction}
          onMarkSupportCandidate={markFacilitySupportCandidate}
          onAddNote={addFacilityNote}
          onExplainRisk={() => setActiveTab('risk')}
          onGenerateActions={generateActions}
          onStatusChange={updateActionStatus}
          onEvidenceChange={updateActionEvidence}
          onEnableBrief={() => setBriefVisible(true)}
          onLaunchDemo={launchDemoScenario}
        />

        <details className="panel aviation-panel aviation-admin-details" aria-label="Aviation admin details">
          <summary><span>Aviation Admin Details</span><strong>Open operational admin context</strong></summary>
          <section className="aviation-context-bar" aria-label="Aviation context and access">
            <div className="aviation-context-card"><p className="eyebrow">Pilot mode</p><strong>Advisory workflow</strong><p className="aviation-caveat">Controlled pilot details and demo fallback remain available here. Live APIs run only when explicitly enabled. Authorized human review is required.</p></div>
            <div className="aviation-context-card aviation-role-strip"><div><p className="eyebrow">Access</p>{roleSelectorAllowed ? <select className="aviation-input" value={role} onChange={(event) => setRole(event.target.value as AviationUserRole)} aria-label="Current aviation role"><option value="aviation_admin">Aviation Admin</option><option value="aviation_user">Aviation User</option><option value="executive_protection">Executive Protection</option><option value="global_security">Global Security</option><option value="field_security">Field Security</option><option value="fpi_admin">FPI Admin</option><option value="viewer">Viewer</option></select> : <strong>{identity?.display_name ?? 'Enterprise IAM user'} · {role}</strong>}</div><p className="aviation-caveat">{isApprovedPilotRole(role) ? 'Approved controlled-pilot role.' : 'Limited / not in approved pilot role list.'} {roleSelectorAllowed ? 'Local selector available outside production.' : 'Role controlled by enterprise IAM.'}</p></div>
          </section>
          <AviationAdminDataSourcesTab trips={savedTrips} context={aviationContext} />
          <AviationAdminGovernance role={role} tripId={currentTripId} />
          <AviationAuditLogTab />
        </details>
      </main>

      {detailTrip ? <AviationTripDetail trip={detailTrip} currentRole={role} onClose={() => setDetailTrip(null)} onTripUpdated={(trip) => { setDetailTrip(trip); refreshSavedTrips(); }} /> : null}
    </section>
  );
}

type ReadinessContext = { airport: Airport | null; radiusMiles: number; tripStart: string; tripEnd: string; facilities: FacilityWithDistance[]; risk: TripRiskResult; faaAlerts: FAAAlert[]; weatherAlerts: WeatherAlert[]; lastScannedAt: string | null };

function TripSetupCard({ selectedAirport, tripName, tripStart, tripEnd, missionType, notes, radiusMiles, facilityTypes, selectedFacilityTypes, savedTrips, canSaveTrip, onOpenTrip, onAirportSelect, onTripNameChange, onTripStartChange, onTripEndChange, onMissionTypeChange, onNotesChange, onRadiusChange, onToggleFacilityType, onSelectAllFacilityTypes, onClearFacilityTypes, onSaveTrip }: { selectedAirport: Airport | null; tripName: string; tripStart: string; tripEnd: string; missionType: string; notes: string; radiusMiles: number; facilityTypes: string[]; selectedFacilityTypes: string[]; savedTrips: AviationTripPlan[]; canSaveTrip: boolean; onOpenTrip: (trip: AviationTripPlan) => void; onAirportSelect: (airport: Airport) => void; onTripNameChange: (value: string) => void; onTripStartChange: (value: string) => void; onTripEndChange: (value: string) => void; onMissionTypeChange: (value: string) => void; onNotesChange: (value: string) => void; onRadiusChange: (value: number) => void; onToggleFacilityType: (type: string) => void; onSelectAllFacilityTypes: () => void; onClearFacilityTypes: () => void; onSaveTrip: () => void }) {
  return <section className="panel aviation-panel aviation-trip-setup-card"><div className="card-heading"><div><p className="eyebrow">Step 1</p><h2>Trip Setup</h2></div></div><div className="aviation-detail-grid"><label>Trip name<input className="aviation-input" value={tripName} onChange={(event) => onTripNameChange(event.target.value)} placeholder="Name this aviation readiness trip" /></label><label>Open saved trip<select className="aviation-input" value="" onChange={(event) => { const trip = savedTrips.find((item) => item.trip_id === event.target.value); if (trip) onOpenTrip(trip); }}><option value="">Select saved trip</option>{savedTrips.map((trip) => <option key={trip.trip_id} value={trip.trip_id}>{trip.trip_name}</option>)}</select></label><label>Trip start<input className="aviation-input" type="datetime-local" value={tripStart} onChange={(event) => onTripStartChange(event.target.value)} /></label><label>Trip end<input className="aviation-input" type="datetime-local" value={tripEnd} onChange={(event) => onTripEndChange(event.target.value)} /></label><label>Mission type<select className="aviation-input" value={missionType} onChange={(event) => onMissionTypeChange(event.target.value)}><option>Executive movement/support</option><option>Aviation crew support</option><option>Security assessment</option><option>Facility support staging</option><option>Training / stakeholder demo</option></select></label><label>Operational notes<textarea className="aviation-input" value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Optional non-sensitive mission notes. Do not enter traveler identity or sensitive itinerary details." /></label></div><AirportSearch selectedAirport={selectedAirport} onSelectAirport={onAirportSelect} />{!selectedAirport ? <p className="aviation-empty">Select an airport to begin the readiness scan.</p> : null}<RadiusSelector radiusMiles={radiusMiles} airportCode={selectedAirport?.iata_code ?? selectedAirport?.faa_id ?? selectedAirport?.icao_code} onChange={onRadiusChange} /><FacilityTypeFilter facilityTypes={facilityTypes} selectedFacilityTypes={selectedFacilityTypes} countsByType={{}} onToggleFacilityType={onToggleFacilityType} onSelectAll={onSelectAllFacilityTypes} onClearAll={onClearFacilityTypes} /><div className="aviation-button-row"><button className="ops-action-button" disabled={!canSaveTrip} onClick={onSaveTrip}>Save Trip</button></div>{!canSaveTrip ? <p className="aviation-caveat">Trip name and airport are required before saving.</p> : null}</section>;
}

function ScanControlsCard({ selectedAirport, radiusMiles, selectedFacilityTypes, facilityCount, lastScannedAt, scanning, onRunScan, onClearScan }: { selectedAirport: Airport | null; radiusMiles: number; selectedFacilityTypes: string[]; facilityCount: number; lastScannedAt: string | null; scanning: boolean; onRunScan: () => void; onClearScan: () => void }) {
  return <section className="panel aviation-panel aviation-scan-controls-card"><div className="card-heading"><div><p className="eyebrow">Step 2</p><h2>Airport Radius Scan</h2></div></div>{selectedAirport ? <article className="aviation-selected-card"><span className="eyebrow">Selected airport</span><strong>{selectedAirport.airport_name}</strong><span>{selectedAirport.city}, {selectedAirport.state} · {selectedAirport.faa_id ?? selectedAirport.iata_code ?? selectedAirport.icao_code ?? 'No code'}</span></article> : <p className="aviation-empty">No scan has been run yet. Select an airport and run a radius scan.</p>}<div className="aviation-detail-grid"><span>Radius: <strong>{radiusMiles} mi</strong></span><span>Facility filters: <strong>{selectedFacilityTypes.length ? selectedFacilityTypes.join(', ') : 'All facility types'}</strong></span>{lastScannedAt ? <span>Last scanned: <strong>{new Date(lastScannedAt).toLocaleString()}</strong></span> : null}{lastScannedAt ? <span>Facilities found: <strong>{facilityCount}</strong></span> : null}</div><div className="aviation-button-row"><button className="ops-action-button" disabled={!selectedAirport || scanning} onClick={onRunScan}>{scanning ? 'Scanning...' : 'Run Scan'}</button><button className="ops-action-button secondary" disabled={!lastScannedAt} onClick={onClearScan}>Clear Scan</button></div>{!selectedAirport ? <p className="aviation-caveat">Select an airport before running a scan.</p> : null}</section>;
}

function ReadinessSummary({ hasScanned, facilitiesCount, faaCount, weatherCount, actionsCount, riskBand, riskScore }: { hasScanned: boolean; facilitiesCount: number; faaCount: number; weatherCount: number; actionsCount: number; riskBand: string; riskScore: number }) {
  return <section className="panel aviation-panel aviation-readiness-summary"><div className="card-heading"><div><p className="eyebrow">Step 3</p><h2>Readiness Summary</h2></div><span className="mode-pill">Risk {hasScanned ? `${riskBand} · ${riskScore}` : 'Pending'}</span></div><div className="aviation-summary-cards"><SummaryTile label="Facilities in Radius" value={hasScanned ? facilitiesCount : 'Pending'} /><SummaryTile label="FAA Watch Items" value={hasScanned ? faaCount : 'Pending'} /><SummaryTile label="Weather Alerts" value={hasScanned ? weatherCount : 'Pending'} /><SummaryTile label="Open Readiness Actions" value={actionsCount} /></div>{!hasScanned ? <p className="aviation-empty">Trip risk will calculate after the first scan. Run a radius scan to identify nearby facilities and calculate trip risk.</p> : null}</section>;
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return <article className="aviation-summary-card"><span>{label}</span><strong>{value}</strong></article>;
}

const reviewTabs: { id: AviationReviewTab; label: string }[] = [{ id: 'nearby', label: 'Nearby Facilities' }, { id: 'faa', label: 'FAA / Airport Watch' }, { id: 'weather', label: 'NOAA Weather' }, { id: 'risk', label: 'Trip Risk' }, { id: 'actions', label: 'Actions' }, { id: 'briefs', label: 'Brief' }, { id: 'demo', label: 'Demo' }];

function ReviewWorkspace({ activeTab, onChangeTab, hasScanned, context, selectedFacilityId, canViewEPReadiness, canViewRecommendation, canCreateActions, canGenerateBrief, canCopyBrief, sortMode, selectedFacility, readinessActions, actorRole, tripId, facilityTypes, onSortChange, onFacilitySelect, onCreateAction, onMarkSupportCandidate, onAddNote, onExplainRisk, onGenerateActions, onStatusChange, onEvidenceChange, onEnableBrief, onLaunchDemo }: { activeTab: AviationReviewTab; onChangeTab: (tab: AviationReviewTab) => void; hasScanned: boolean; context: ReadinessContext; selectedFacilityId: string | null; canViewEPReadiness: boolean; canViewRecommendation: boolean; canCreateActions: boolean; canGenerateBrief: boolean; canCopyBrief: boolean; sortMode: FacilitySortMode; selectedFacility: FacilityWithDistance | null; readinessActions: TripReadinessAction[]; actorRole: string; tripId: string; facilityTypes: string[]; onSortChange: (mode: FacilitySortMode) => void; onFacilitySelect: (facility: FacilityWithDistance) => void; onCreateAction: (facility: FacilityWithDistance) => void; onMarkSupportCandidate: (facility: FacilityWithDistance, candidate: boolean) => void; onAddNote: (facility: FacilityWithDistance, note: string) => void; onExplainRisk: () => void; onGenerateActions: () => void; onStatusChange: (actionId: string, status: TripReadinessAction['status']) => void; onEvidenceChange: (actionId: string, updates: Pick<Partial<TripReadinessAction>, 'evidence_note' | 'evidence_file_name' | 'evidence_received' | 'verifier_name' | 'verified_at'>) => void; onEnableBrief: () => void; onLaunchDemo: () => void }) {
  return <section className="panel aviation-panel aviation-review-workspace"><div className="card-heading"><div><p className="eyebrow">Step 4</p><h2>Review Workspace</h2></div></div><nav className="aviation-tabs aviation-review-tabs" aria-label="Aviation review workspace tabs">{reviewTabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'aviation-tab-button active' : 'aviation-tab-button'} onClick={() => onChangeTab(tab.id)}>{tab.label}</button>)}</nav>{!hasScanned && activeTab !== 'demo' ? <NoScanState tab={activeTab} onSwitchToDemo={() => onChangeTab('demo')} /> : null}{hasScanned && activeTab === 'nearby' ? <AviationNearbyFacilitiesTab context={context} canViewEPReadiness={canViewEPReadiness} sortMode={sortMode} selectedFacilityId={selectedFacilityId} onSortChange={onSortChange} onFacilitySelect={onFacilitySelect} /> : null}{hasScanned && activeTab === 'faa' ? <AviationFAAWatchTab context={context} /> : null}{hasScanned && activeTab === 'weather' ? <AviationWeatherWatchTab context={context} /> : null}{hasScanned && activeTab === 'risk' ? <AviationRiskScoreTab context={context} canViewRecommendation={canViewRecommendation} onExplain={onExplainRisk} /> : null}{hasScanned && activeTab === 'actions' ? <AviationReadinessActionsTab actions={readinessActions} canCreateActions={canCreateActions} canViewEPReadiness={canViewEPReadiness} onGenerateActions={onGenerateActions} onStatusChange={onStatusChange} onEvidenceChange={onEvidenceChange} /> : null}{hasScanned && activeTab === 'briefs' ? <div>{!canGenerateBrief ? <section className="panel aviation-panel"><p className="aviation-empty">Generate an executive-ready aviation travel brief after the scan is complete.</p><button className="ops-action-button" onClick={onEnableBrief}>Generate Aviation Brief</button></section> : null}<AviationBriefsTab actorRole={actorRole} tripId={tripId} context={context} facilityTypes={facilityTypes} canGenerateBrief={canGenerateBrief} canCopyBrief={canCopyBrief} /></div> : null}{activeTab === 'demo' ? <AviationDemoScenarioTab onLaunchDemo={onLaunchDemo} /> : null}{hasScanned && activeTab === 'nearby' && selectedFacility ? <AviationFacilityDetailTab facility={selectedFacility} canViewEPReadiness={canViewEPReadiness} onCreateAction={onCreateAction} onMarkSupportCandidate={onMarkSupportCandidate} onAddNote={onAddNote} /> : null}</section>;
}

function NoScanState({ tab, onSwitchToDemo }: { tab: AviationReviewTab; onSwitchToDemo: () => void }) {
  const text = tab === 'nearby' ? 'Run a radius scan to identify nearby facilities and calculate trip risk.' : tab === 'faa' || tab === 'weather' ? 'Run scan to load relevant watch items.' : tab === 'actions' ? 'No readiness actions created yet. Generate actions from risk drivers after scan.' : tab === 'briefs' ? 'Generate an executive-ready aviation travel brief after the scan is complete.' : tab === 'risk' ? 'Trip risk will calculate after the first scan.' : 'Run scan to load this workspace.';
  return <section className="panel aviation-panel"><p className="aviation-empty">{text}</p><button className="ops-action-button secondary" onClick={onSwitchToDemo}>Open Demo Scenario</button></section>;
}

