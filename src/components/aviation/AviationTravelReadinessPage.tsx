import { useEffect, useMemo, useState } from 'react';
import { AviationMissionOverview } from './AviationMissionOverview';
import { AviationTripSetup } from './AviationTripSetup';
import { AskFPIAviationPanel } from './AskFPIAviationPanel';
import { FAAWatchPanel } from './FAAWatchPanel';
import { FacilityRadiusMap } from './FacilityRadiusMap';
import { NearbyFacilitiesDecisionTable } from './NearbyFacilitiesDecisionTable';
import { TripBriefPanel } from './TripBriefPanel';
import { TripReadinessActions } from './TripReadinessActions';
import { TripRiskScoreCard } from './TripRiskScoreCard';
import { WeatherRiskPanel } from './WeatherRiskPanel';
import { getAirportById } from '../../services/airportService';
import { calculateTripRiskScore } from '../../services/aviationRiskEngine';
import { getFacilitiesForAviationScan } from '../../services/facilityDataAdapter';
import { scanFacilitiesNearAirport } from '../../services/facilityGeoService';
import { getFAAAlertsForAirport, type FAAProviderResult } from '../../services/faaService';
import { generateTripBrief } from '../../services/tripBriefService';
import { saveTripPlan } from '../../services/aviationTripStorageService';
import { generateReadinessActions, updateReadinessActionStatus } from '../../services/readinessActionService';
import { getWeatherAlertsForAirport, type WeatherProviderResult } from '../../services/weatherService';
import type { Airport, AviationTripPlan, AviationTravelerType, FacilityWithDistance, NormalizedFacility, TripReadinessAction } from '../../types/aviation';

const workflowSteps = ['Plan Trip', 'Scan Radius', 'Review Risk', 'Assign Readiness Actions', 'Generate Brief'];
const defaultRiskDomains = ['FAA', 'Weather', 'Facility', 'Executive Protection', 'Data freshness'];
const emptyFAAResult: FAAProviderResult = { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data' };
const emptyWeatherResult: WeatherProviderResult = { alerts: [], source: 'unknown', last_updated: new Date().toISOString(), confidence: 0, status: 'no_data' };

function newTripId() {
  return `AV-${Date.now()}`;
}

function airportCode(airport: Airport | null): string {
  return airport ? (airport.iata_code ?? airport.faa_id ?? airport.icao_code ?? airport.airport_id) : 'No airport';
}

export function AviationTravelReadinessPage() {
  const [tripId, setTripId] = useState(newTripId());
  const [airport, setAirport] = useState<Airport | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [travelerType, setTravelerType] = useState<AviationTravelerType>('Executive');
  const [riskDomains, setRiskDomains] = useState<string[]>(defaultRiskDomains);
  const [facilitySource, setFacilitySource] = useState<NormalizedFacility[]>([]);
  const [selectedFacilityTypes, setSelectedFacilityTypes] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<FacilityWithDistance[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [faaResult, setFaaResult] = useState<FAAProviderResult>(emptyFAAResult);
  const [weatherResult, setWeatherResult] = useState<WeatherProviderResult>(emptyWeatherResult);
  const [actions, setActions] = useState<TripReadinessAction[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanHasRun, setScanHasRun] = useState(false);
  const [scanIsStale, setScanIsStale] = useState(false);
  const [activeStep, setActiveStep] = useState(workflowSteps[0]);
  const [activeReviewTab, setActiveReviewTab] = useState<'facilities' | 'faa' | 'weather' | 'actions' | 'ask' | 'brief'>('facilities');
  const [briefGenerated, setBriefGenerated] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    getFacilitiesForAviationScan().then(setFacilitySource).catch(() => setFacilitySource([]));
  }, []);

  const facilityTypes = useMemo(() => Array.from(new Set(facilitySource.map((facility) => facility.facility_type))).sort(), [facilitySource]);
  const selectedFacility = useMemo(() => scanResults.find((facility) => facility.facility_id === selectedFacilityId) ?? null, [scanResults, selectedFacilityId]);
  const hiddenRecordsCount = useMemo(() => facilitySource.filter((facility) => facility.latitude === null || facility.longitude === null).length, [facilitySource]);
  const risk = useMemo(() => calculateTripRiskScore({ nearbyFacilities: scanResults, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts, hasSelectedAirport: Boolean(airport) }), [scanResults, faaResult.alerts, weatherResult.alerts, airport]);

  function markScanStale() {
    if (scanHasRun) setScanIsStale(true);
    setBriefGenerated(false);
  }

  function selectAirport(nextAirport: Airport) {
    setAirport(nextAirport);
    setScanResults([]);
    setSelectedFacilityId(null);
    setScanHasRun(false);
    setScanIsStale(false);
    setActions([]);
    setBriefGenerated(false);
    setActiveStep('Plan Trip');
  }

  function toggleFacilityType(type: string) {
    setSelectedFacilityTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
    markScanStale();
  }

  function toggleRiskDomain(domain: string) {
    setRiskDomains((current) => current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain]);
    setBriefGenerated(false);
  }

  async function runScan(targetAirport = airport, options?: { demo?: boolean; facilitySourceOverride?: NormalizedFacility[]; radiusOverride?: number; tripStartOverride?: string; tripEndOverride?: string; facilityTypesOverride?: string[] }) {
    if (!targetAirport) return;
    setScanning(true);
    setActiveStep('Scan Radius');
    try {
      const source = options?.facilitySourceOverride ?? facilitySource;
      const scanRadius = options?.radiusOverride ?? radiusMiles;
      const scanTripStart = options?.tripStartOverride ?? tripStart;
      const scanTripEnd = options?.tripEndOverride ?? tripEnd;
      const scanFacilityTypes = options?.facilityTypesOverride ?? selectedFacilityTypes;
      const facilities = scanFacilitiesNearAirport({ airport: targetAirport, facilities: source, radiusMiles: scanRadius, facilityTypes: scanFacilityTypes, sortMode: 'risk' });
      const [faa, weather] = await Promise.all([getFAAAlertsForAirport(targetAirport.airport_id, scanTripStart, scanTripEnd), getWeatherAlertsForAirport(targetAirport, scanTripStart, scanTripEnd)]);
      setScanResults(facilities);
      setSelectedFacilityId(facilities[0]?.facility_id ?? null);
      setFaaResult(faa);
      setWeatherResult(weather);
      setScanHasRun(true);
      setScanIsStale(false);
      setActiveStep('Review Risk');
      setActiveReviewTab('facilities');
      setBriefGenerated(false);
      if (options?.demo) setDemoMode(true);
    } finally {
      setScanning(false);
    }
  }

  function generateActions() {
    const generated = generateReadinessActions({ tripId, weatherAlerts: weatherResult.alerts, faaAlerts: faaResult.alerts, nearbyFacilities: scanResults, risk });
    setActions(generated);
    setActiveStep('Assign Readiness Actions');
    setActiveReviewTab('actions');
  }

  async function saveCurrentTrip() {
    if (!airport) return;
    const timestamp = new Date().toISOString();
    const plan: AviationTripPlan = {
      trip_id: tripId,
      trip_name: `${airportCode(airport)} Aviation Readiness Trip`,
      airport_id: airport.airport_id,
      airport_snapshot: airport,
      trip_start: tripStart || null,
      trip_end: tripEnd || null,
      radius_miles: radiusMiles,
      facility_types: selectedFacilityTypes,
      traveler_type: travelerType,
      nearby_facilities: scanResults,
      faa_alerts: faaResult.alerts,
      weather_alerts: weatherResult.alerts,
      risk_score: risk.score,
      risk_band: risk.band,
      confidence: risk.confidence,
      primary_drivers: risk.drivers,
      readiness_actions: actions,
      generated_brief: briefGenerated ? generateTripBrief({ airport, radiusMiles, tripStart, tripEnd, facilityTypes: selectedFacilityTypes, nearbyFacilities: scanResults, risk, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts }) : undefined,
      status: scanHasRun ? 'active' : 'draft',
      created_at: timestamp,
      updated_at: timestamp,
      last_scanned: scanHasRun ? timestamp : '',
      source_freshness: demoMode ? 'seeded_demo' : 'mixed',
    };
    await saveTripPlan(plan);
    setSaveMessage(`Saved ${plan.trip_name}`);
  }

  async function exportCurrentBrief() {
    if (!airport) return;
    const brief = generateTripBrief({ airport, radiusMiles, tripStart, tripEnd, facilityTypes: selectedFacilityTypes, nearbyFacilities: scanResults, risk, faaAlerts: faaResult.alerts, weatherAlerts: weatherResult.alerts });
    const blob = new Blob([brief], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fpi-aviation-readiness-${airportCode(airport)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function launchDemoScenario() {
    const [demoAirport, source] = await Promise.all([getAirportById('AIR-XNA'), facilitySource.length ? Promise.resolve(facilitySource) : getFacilitiesForAviationScan()]);
    if (!demoAirport) return;
    setFacilitySource(source);
    setTripId(newTripId());
    setAirport(demoAirport);
    setRadiusMiles(25);
    setTripStart('2026-05-14T12:00');
    setTripEnd('2026-05-14T20:00');
    setTravelerType('Executive');
    setSelectedFacilityTypes([]);
    setRiskDomains(defaultRiskDomains);
    setActions([]);
    setDemoMode(true);
    setTimeout(() => runScan(demoAirport, { demo: true, facilitySourceOverride: source, radiusOverride: 25, tripStartOverride: '2026-05-14T12:00', tripEndOverride: '2026-05-14T20:00', facilityTypesOverride: [] }), 0);
  }

  function addAction(action: TripReadinessAction) {
    setActions((current) => [action, ...current.filter((item) => item.action_id !== action.action_id)]);
    setActiveReviewTab('actions');
    setActiveStep('Assign Readiness Actions');
  }

  const highestRisk = scanResults[0] ?? null;
  const supportFacility = scanResults.find((facility) => facility.aviation_support_candidate && facility.ep_readiness_status !== 'Gap') ?? scanResults.find((facility) => facility.aviation_support_candidate) ?? null;

  return (
    <section className="aviation-command-center aviation-travel-readiness-page">
      <header className="aviation-hero panel aviation-panel aviation-readiness-hero">
        <div>
          <p className="eyebrow">Aviation Travel Readiness</p>
          <h1>Aviation Travel Readiness</h1>
          <p className="aviation-caveat">Assess airport-area Walmart facility posture, aviation watch items, weather exposure, and readiness gaps before planned travel.</p>
          {demoMode ? <p className="aviation-demo-label">Demo / Seeded Data — validate all operational details before use.</p> : null}
          <div className="aviation-hero-primary-actions">
            <button type="button" className="ops-action-button" onClick={launchDemoScenario}>Launch Executive Regional Airport Trip Demo</button>
            <button type="button" className="ops-action-button secondary" disabled={!airport} onClick={() => { setActiveStep('Generate Brief'); setActiveReviewTab('brief'); setBriefGenerated(true); }}>Generate Brief</button>
            <button type="button" className="ops-action-button secondary" disabled={!airport} onClick={saveCurrentTrip}>Save Trip</button>
            <button type="button" className="ops-action-button secondary" disabled={!scanHasRun || !airport} onClick={exportCurrentBrief}>Export</button>
          </div>
          {saveMessage ? <p className="aviation-save-message">{saveMessage}</p> : null}
        </div>
      </header>

      <nav className="aviation-workflow-steps" aria-label="Aviation workflow steps">
        {workflowSteps.map((step, index) => <button key={step} type="button" className={activeStep === step ? 'active' : ''} onClick={() => setActiveStep(step)}><span>{index + 1}</span>{step}</button>)}
      </nav>

      <AviationTripSetup
        airport={airport}
        radiusMiles={radiusMiles}
        tripStart={tripStart}
        tripEnd={tripEnd}
        facilityTypes={facilityTypes}
        selectedFacilityTypes={selectedFacilityTypes}
        travelerType={travelerType}
        riskDomains={riskDomains}
        scanDisabled={!airport}
        scanning={scanning}
        scanIsStale={scanIsStale}
        onSelectAirport={selectAirport}
        onRadiusChange={(value) => { setRadiusMiles(value); markScanStale(); }}
        onTripStartChange={(value) => { setTripStart(value); markScanStale(); }}
        onTripEndChange={(value) => { setTripEnd(value); markScanStale(); }}
        onToggleFacilityType={toggleFacilityType}
        onSelectAllFacilityTypes={() => { setSelectedFacilityTypes([]); markScanStale(); }}
        onTravelerTypeChange={(value) => { setTravelerType(value); setBriefGenerated(false); }}
        onToggleRiskDomain={toggleRiskDomain}
        onRunScan={() => runScan()}
      />

      <AviationMissionOverview facilities={scanResults} risk={risk} faaAlerts={faaResult.alerts} weatherAlerts={weatherResult.alerts} actions={actions} briefGenerated={briefGenerated} />

      <section className="aviation-map-operations-grid">
        <FacilityRadiusMap airport={airport} radiusMiles={radiusMiles} facilities={scanResults} selectedFacilityId={selectedFacilityId} scanHasRun={scanHasRun} scanIsStale={scanIsStale} hiddenRecordsCount={hiddenRecordsCount} onFacilitySelect={(facility) => setSelectedFacilityId(facility.facility_id)} />
        <aside className="panel aviation-panel aviation-airport-mini-panel">
          <p className="eyebrow">Selected Airport</p>
          <h3>{airport?.airport_name ?? 'Select an airport'}</h3>
          <div className="aviation-mini-facts">
            <span><small>Airport Code</small><strong>{airportCode(airport)}</strong></span>
            <span><small>Airport Status</small><strong>{airport?.status ?? 'Pending'}</strong></span>
            <span><small>Radius</small><strong>{radiusMiles} mi</strong></span>
            <span><small>Facilities Found</small><strong>{scanResults.length}</strong></span>
            <span><small>Highest-Risk Facility</small><strong>{highestRisk ? `${highestRisk.facility_number} · ${highestRisk.facility_risk_band}` : 'Pending'}</strong></span>
            <span><small>Support/Staging</small><strong>{supportFacility ? `${supportFacility.facility_number} · ${supportFacility.distance_miles.toFixed(1)} mi` : 'Pending'}</strong></span>
          </div>
          {selectedFacility ? <article className="aviation-selected-card"><span className="eyebrow">Selected facility</span><strong>{selectedFacility.facility_name}</strong><span>{selectedFacility.distance_miles.toFixed(1)} mi · {selectedFacility.facility_risk_band}</span><span>{selectedFacility.recommended_action}</span></article> : null}
          <button type="button" className="ops-action-button" disabled={!scanHasRun} onClick={generateActions}>Create Readiness Actions</button>
        </aside>
      </section>

      <section className="aviation-review-workspace panel aviation-panel">
        <div className="card-heading"><div><p className="eyebrow">Risk Review</p><h2>Mission review tabs</h2></div><span className={`aviation-risk-badge risk-${risk.band.toLowerCase()}`}>{risk.band}</span></div>
        <nav className="aviation-tabs aviation-review-tabs" aria-label="Aviation review tabs">
          {[
            ['facilities', 'Facilities'], ['faa', 'FAA Watch'], ['weather', 'Weather'], ['actions', 'Readiness Actions'], ['ask', 'Ask FPI'], ['brief', 'Brief'],
          ].map(([id, label]) => <button key={id} type="button" className={activeReviewTab === id ? 'aviation-tab-button active' : 'aviation-tab-button'} onClick={() => setActiveReviewTab(id as typeof activeReviewTab)}>{label}</button>)}
        </nav>
        {activeReviewTab === 'facilities' ? <><TripRiskScoreCard risk={risk} /><NearbyFacilitiesDecisionTable facilities={scanResults} tripId={tripId} canViewEPReadiness onFacilitySelect={(facility) => setSelectedFacilityId(facility.facility_id)} onCreateAction={addAction} /></> : null}
        {activeReviewTab === 'faa' ? <FAAWatchPanel result={faaResult} /> : null}
        {activeReviewTab === 'weather' ? <WeatherRiskPanel result={weatherResult} /> : null}
        {activeReviewTab === 'actions' ? <TripReadinessActions actions={actions} canCreateActions canViewEPReadiness onGenerateActions={generateActions} onStatusChange={(actionId, status) => setActions((current) => updateReadinessActionStatus(current, actionId, status))} /> : null}
        {activeReviewTab === 'ask' ? <AskFPIAviationPanel airport={airport} facilities={scanResults} risk={risk} faaAlerts={faaResult.alerts} weatherAlerts={weatherResult.alerts} /> : null}
        {activeReviewTab === 'brief' ? <TripBriefPanel airport={airport} radiusMiles={radiusMiles} tripStart={tripStart} tripEnd={tripEnd} facilityTypes={selectedFacilityTypes} nearbyFacilities={scanResults} risk={risk} faaAlerts={faaResult.alerts} weatherAlerts={weatherResult.alerts} canGenerateBrief canCopyBrief actorRole="aviation_admin" tripId={tripId} autoGenerate={briefGenerated} onGenerated={() => setBriefGenerated(true)} /> : null}
      </section>
    </section>
  );
}
