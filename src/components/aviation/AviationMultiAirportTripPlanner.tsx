import { useEffect, useMemo, useState } from 'react';
import { AirportSearch } from './AirportSearch';
import { AviationDemoScenarioTab } from './AviationReadinessTabs';
import { RadiusSelector } from './RadiusSelector';
import { getAirportById } from '../../services/airportService';
import { downloadMultiAirportReportHtml, prepareMultiAirportRiskEmail, renderMultiAirportTravelRiskReportHtml, renderMultiAirportTravelRiskReportText, validateMultiAirportReport, type AviationMultiAirportReportPayload } from '../../services/aviationMultiAirportReportService';
import { addAirportStop, airportToStop, buildSelectedFacility, calculateAirportRisk, calculateOverallTripRisk, createEmptyAviationTrip, moveIntermediateStop, removeAirportStop, resequenceStops, scanFacilitiesForAirportStop, setEndpointStop, updateAirportStopRadius, type AviationAirportRisk } from '../../services/aviationTripService';
import { getFacilitiesForAviationScan } from '../../services/facilityDataAdapter';
import { getFAAAlertsForAirport } from '../../services/faaService';
import { getWeatherAlertsForAirport } from '../../services/weatherService';
import type { Airport, AviationMultiAirportTrip, AviationSelectedFacility, AviationTravelerType, AviationTripAirportStop, FAAAlert, FacilityRiskBand, FacilityWithDistance, NormalizedFacility, WeatherAlert } from '../../types/aviation';

type TabId = 'planner' | 'stops' | 'locations' | 'map' | 'risk' | 'weather' | 'actions' | 'hotels' | 'report';
type CommandView = 'landing' | 'workflow';
type StopDataMap<T> = Record<string, T[]>;

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'planner', label: 'Route' },
  { id: 'stops', label: 'Airport Stops' },
  { id: 'locations', label: 'Facilities' },
  { id: 'map', label: 'Map' },
  { id: 'risk', label: 'Airport Stop Risk' },
  { id: 'weather', label: 'Weather' },
  { id: 'actions', label: 'Readiness Actions' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'report', label: 'Travel Risk Report' },
];

const riskBands: FacilityRiskBand[] = ['Low', 'Watch', 'Elevated', 'High', 'Critical', 'Unknown'];

const commandWorkflowSummaries = [
  { tripName: 'Executive Regional Travel Readiness', status: 'Active', start: 'XNA', end: 'MSY', additionalStops: 1, window: 'May 14, 2026 · 1200-2000', risk: 'High', actions: 5, weather: 'Elevated', airport: 'High', updated: 'Seeded demo · 12 min ago', reviewReason: 'Severe weather alert during arrival window and high-risk facility inside radius.' },
  { tripName: 'Dallas Leadership Support', status: 'Planned', start: 'XNA', end: 'DAL', additionalStops: 0, window: 'May 16, 2026 · 0900-1700', risk: 'Elevated', actions: 3, weather: 'Watch', airport: 'Elevated', updated: 'Seeded demo · 45 min ago', reviewReason: 'FAA/NOTAM watch item and EP readiness gap.' },
  { tripName: 'Houston Field Security Visit', status: 'Monitoring', start: 'DFW', end: 'HOU', additionalStops: 1, window: 'May 18, 2026 · 0800-1900', risk: 'Watch', actions: 2, weather: 'Watch', airport: 'Low', updated: 'Seeded demo · 1 hr ago', reviewReason: '' },
  { tripName: 'Completed Gulf Region Demo', status: 'Completed', start: 'HOU', end: 'MSY', additionalStops: 0, window: 'May 01, 2026 · Completed', risk: 'Low', actions: 0, weather: 'Low', airport: 'Low', updated: 'Seeded demo · archived', reviewReason: '' },
] as const;

const commandAirportWatchItems = [
  { airport: 'DAL', tripName: 'Dallas Leadership Support', risk: 'Elevated', type: 'FAA / NOTAM', summary: 'Taxiway closure watch item overlaps arrival planning window.', source: 'FAA seeded demo', updated: '35 min ago' },
  { airport: 'MSY', tripName: 'Executive Regional Travel Readiness', risk: 'High', type: 'Airport Delay', summary: 'Ground delay pattern may affect arrival staging and support timing.', source: 'FAA seeded demo', updated: '12 min ago' },
  { airport: 'XNA', tripName: 'Executive Regional Travel Readiness', risk: 'Watch', type: 'Data Freshness', summary: 'Live NOTAM integration pending; verify source before operational use.', source: 'FPI source monitor', updated: '1 hr ago' },
] as const;

const commandWeatherWatchItems = [
  { airport: 'MSY', tripName: 'Executive Regional Travel Readiness', risk: 'High', type: 'Severe Thunderstorm', timing: 'Arrival window', summary: 'Lightning and wind risk may affect ground movement and site arrival.', source: 'NOAA seeded demo', confidence: 78 },
  { airport: 'DAL', tripName: 'Dallas Leadership Support', risk: 'Elevated', type: 'Wind Advisory', timing: 'Departure window', summary: 'Elevated crosswind timing requires aviation and EP review.', source: 'NOAA seeded demo', confidence: 72 },
] as const;
const riskColor: Record<string, string> = { Pending: '#64748b', Low: '#22c55e', Watch: '#facc15', Elevated: '#f59e0b', High: '#ef4444', Critical: '#7f1d1d', Unknown: '#94a3b8' };

function codeForStop(stop: AviationTripAirportStop | null | undefined): string {
  return stop ? (stop.iata_code ?? stop.faa_id ?? stop.icao_code ?? stop.airport_id) : 'Pending';
}

function selectionKey(stopId: string, facilityId: string): string {
  return `${stopId}::${facilityId}`;
}

function selectedKey(selection: AviationSelectedFacility): string {
  return selectionKey(selection.stop_id, selection.facility_id);
}

function emptyRisk(): AviationAirportRisk {
  return { score: 0, band: 'Pending', confidence: 0, drivers: ['Risk remains Pending until scan runs.'] };
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AviationMultiAirportTripPlanner() {
  const [commandView, setCommandView] = useState<CommandView>('landing');
  const [trip, setTrip] = useState<AviationMultiAirportTrip>(createEmptyAviationTrip());
  const [facilitySource, setFacilitySource] = useState<NormalizedFacility[]>([]);
  const [stopFacilities, setStopFacilities] = useState<StopDataMap<FacilityWithDistance>>({});
  const [stopFaaAlerts, setStopFaaAlerts] = useState<StopDataMap<FAAAlert>>({});
  const [stopWeatherAlerts, setStopWeatherAlerts] = useState<StopDataMap<WeatherAlert>>({});
  const [stopRisks, setStopRisks] = useState<Record<string, AviationAirportRisk>>({});
  const [activeTab, setActiveTab] = useState<TabId>('planner');
  const [scanningStopId, setScanningStopId] = useState<string | null>(null);
  const [selectedStopFilter, setSelectedStopFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [facilitySearch, setFacilitySearch] = useState('');
  const [generatedReport, setGeneratedReport] = useState(false);
  const [allowNoLocationsReport, setAllowNoLocationsReport] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [manualFacilityOpen, setManualFacilityOpen] = useState(false);
  const [manualFacilityDraft, setManualFacilityDraft] = useState({ stopId: '', facilityName: '', facilityNumber: '', facilityType: 'Other', address: '', city: '', state: '', latitude: '', longitude: '', reason: '' });

  useEffect(() => {
    getFacilitiesForAviationScan().then(setFacilitySource).catch(() => setFacilitySource([]));
  }, []);

  const startStop = trip.airports.find((stop) => stop.stop_type === 'Start') ?? null;
  const endStop = trip.airports.find((stop) => stop.stop_type === 'End') ?? null;
  const hasRequiredAirports = Boolean(startStop && endStop);
  const facilityTypes = useMemo(() => Array.from(new Set(facilitySource.map((facility) => facility.facility_type))).sort(), [facilitySource]);
  const selectedMap = useMemo(() => new Map(trip.selected_facilities.filter((selection) => selection.selected).map((selection) => [selectedKey(selection), selection])), [trip.selected_facilities]);

  const overallRisk = useMemo(() => calculateOverallTripRisk(trip.airports.map((stop) => stopRisks[stop.stop_id] ?? emptyRisk()), trip.selected_facilities.filter((selection) => selection.selected)), [trip.airports, stopRisks, trip.selected_facilities]);

  const allFacilityRows = useMemo(() => trip.airports.flatMap((stop) => (stopFacilities[stop.stop_id] ?? []).map((facility) => ({ stop, facility, selection: selectedMap.get(selectionKey(stop.stop_id, facility.facility_id)) }))), [trip.airports, stopFacilities, selectedMap]);
  const selectedVisitRows = useMemo(() => allFacilityRows.filter((row) => Boolean(row.selection)), [allFacilityRows]);

  const filteredRows = useMemo(() => {
    const query = facilitySearch.trim().toLowerCase();
    return allFacilityRows.filter(({ stop, facility, selection }) => {
      if (selectedStopFilter !== 'all' && stop.stop_id !== selectedStopFilter) return false;
      if (riskFilter !== 'all' && facility.facility_risk_band !== riskFilter) return false;
      if (selectedOnly && !selection) return false;
      if (!query) return true;
      return [facility.facility_name, facility.facility_number, facility.city, facility.state, facility.facility_type].some((value) => value?.toLowerCase().includes(query));
    });
  }, [allFacilityRows, facilitySearch, riskFilter, selectedOnly, selectedStopFilter]);

  const reportPayload = useMemo<AviationMultiAirportReportPayload>(() => ({
    reportId: `FPI-AV-${trip.trip_id}`,
    generatedAt: new Date().toISOString(),
    preparedBy: 'FPI Aviation Travel Readiness',
    dataMode: 'seeded_demo',
    trip: { ...trip, overall_risk_score: overallRisk.score, overall_risk_band: overallRisk.band, confidence: overallRisk.confidence },
    stops: trip.airports.map((stop) => {
      const facilities = stopFacilities[stop.stop_id] ?? [];
      return {
        stop,
        facilities,
        selectedFacilities: facilities.map((facility) => ({ facility, selection: selectedMap.get(selectionKey(stop.stop_id, facility.facility_id)) })).filter((item): item is { facility: FacilityWithDistance; selection: AviationSelectedFacility } => Boolean(item.selection)),
        faaAlerts: stopFaaAlerts[stop.stop_id] ?? [],
        weatherAlerts: stopWeatherAlerts[stop.stop_id] ?? [],
        risk: stopRisks[stop.stop_id] ?? emptyRisk(),
      };
    }),
    overallRisk,
    missingCoordinateCount: 0,
  }), [trip, overallRisk, stopFacilities, selectedMap, stopFaaAlerts, stopWeatherAlerts, stopRisks]);

  const reportMessages = useMemo(() => validateMultiAirportReport(reportPayload).filter((message) => allowNoLocationsReport || !message.includes('Select Walmart locations')), [reportPayload, allowNoLocationsReport]);

  function patchTrip(updates: Partial<AviationMultiAirportTrip>) {
    setTrip((current) => ({ ...current, ...updates }));
    setGeneratedReport(false);
  }

  function applyFacilityTypeFilters(nextTypes: string[]) {
    const normalizedTypes = Array.from(new Set(nextTypes)).sort();
    const rescannedFacilities = new Map<string, FacilityWithDistance[]>();

    for (const stop of trip.airports) {
      if (stop.scan_status !== 'Not Scanned') rescannedFacilities.set(stop.stop_id, scanFacilitiesForAirportStop(stop, facilitySource, normalizedTypes));
    }

    setStopFacilities((current) => {
      const next = { ...current };
      rescannedFacilities.forEach((facilities, stopId) => { next[stopId] = facilities; });
      return next;
    });

    const validSelectionKeys = new Set<string>();
    rescannedFacilities.forEach((facilities, stopId) => facilities.forEach((facility) => validSelectionKeys.add(selectionKey(stopId, facility.facility_id))));
    const nextSelections = trip.selected_facilities.filter((selection) => !rescannedFacilities.has(selection.stop_id) || validSelectionKeys.has(selectedKey(selection)));

    setStopRisks((current) => {
      const next = { ...current };
      rescannedFacilities.forEach((facilities, stopId) => {
        const selectedFacilityIds = nextSelections.filter((selection) => selection.stop_id === stopId && selection.selected).map((selection) => selection.facility_id);
        next[stopId] = calculateAirportRisk({ facilities, selectedFacilityIds, faaAlerts: stopFaaAlerts[stopId] ?? [], weatherAlerts: stopWeatherAlerts[stopId] ?? [], scanHasRun: true });
      });
      return next;
    });

    setTrip((current) => ({
      ...current,
      facility_types: normalizedTypes,
      selected_facilities: nextSelections,
      airports: current.airports.map((stop) => {
        const facilities = rescannedFacilities.get(stop.stop_id);
        if (!facilities) return stop;
        const selectedFacilityIds = nextSelections.filter((selection) => selection.stop_id === stop.stop_id && selection.selected).map((selection) => selection.facility_id);
        const risk = calculateAirportRisk({ facilities, selectedFacilityIds, faaAlerts: stopFaaAlerts[stop.stop_id] ?? [], weatherAlerts: stopWeatherAlerts[stop.stop_id] ?? [], scanHasRun: true });
        return { ...stop, scan_status: 'Scanned', nearby_facility_ids: facilities.map((facility) => facility.facility_id), selected_facility_ids: selectedFacilityIds, airport_risk_score: risk.score, airport_risk_band: risk.band };
      }),
      overall_risk_band: rescannedFacilities.size ? calculateOverallTripRisk(current.airports.map((stop) => {
        const facilities = rescannedFacilities.get(stop.stop_id);
        if (!facilities) return stopRisks[stop.stop_id] ?? emptyRisk();
        const selectedFacilityIds = nextSelections.filter((selection) => selection.stop_id === stop.stop_id && selection.selected).map((selection) => selection.facility_id);
        return calculateAirportRisk({ facilities, selectedFacilityIds, faaAlerts: stopFaaAlerts[stop.stop_id] ?? [], weatherAlerts: stopWeatherAlerts[stop.stop_id] ?? [], scanHasRun: true });
      }), nextSelections.filter((selection) => selection.selected)).band : current.overall_risk_band,
    }));
    setSelectedStopFilter('all');
    setGeneratedReport(false);
  }

  function toggleFacilityTypeFilter(type: string) {
    applyFacilityTypeFilters(trip.facility_types.includes(type) ? trip.facility_types.filter((item) => item !== type) : [...trip.facility_types, type]);
  }

  function setStops(stops: AviationTripAirportStop[]) {
    setTrip((current) => ({ ...current, airports: resequenceStops(stops), selected_facilities: current.selected_facilities.filter((selection) => stops.some((stop) => stop.stop_id === selection.stop_id)), overall_risk_band: 'Pending' }));
    setGeneratedReport(false);
  }

  function updateStop(stopId: string, update: Partial<AviationTripAirportStop>) {
    setStops(trip.airports.map((stop) => stop.stop_id === stopId ? { ...stop, ...update } : stop));
  }

  function handleEndpointSelect(airport: Airport, endpoint: 'Start' | 'End') {
    setStops(setEndpointStop(trip.airports, airport, endpoint, trip.default_radius_miles));
  }

  function handleAddIntermediate(airport: Airport) {
    setStops(addAirportStop(trip.airports, airport, trip.default_radius_miles));
  }

  function handleGlobalRadius(radius: number) {
    setTrip((current) => ({ ...current, default_radius_miles: radius, airports: current.airports.map((stop) => ({ ...stop, radius_miles: stop.radius_miles || radius, scan_status: stop.scan_status === 'Scanned' ? 'Needs Refresh' : stop.scan_status })) }));
    setGeneratedReport(false);
  }

  async function scanStop(stop: AviationTripAirportStop) {
    setScanningStopId(stop.stop_id);
    const facilities = scanFacilitiesForAirportStop(stop, facilitySource, trip.facility_types);
    const [faa, weather] = await Promise.all([getFAAAlertsForAirport(stop.airport_id, trip.trip_start, trip.trip_end), getWeatherAlertsForAirport({ ...stop, status: 'active', source_freshness: 'seeded_demo', last_updated: new Date().toISOString() }, trip.trip_start, trip.trip_end)]);
    const selectedFacilityIds = trip.selected_facilities.filter((selection) => selection.stop_id === stop.stop_id && selection.selected).map((selection) => selection.facility_id);
    const risk = calculateAirportRisk({ facilities, selectedFacilityIds, faaAlerts: faa.alerts, weatherAlerts: weather.alerts, scanHasRun: true });
    setStopFacilities((current) => ({ ...current, [stop.stop_id]: facilities }));
    setStopFaaAlerts((current) => ({ ...current, [stop.stop_id]: faa.alerts }));
    setStopWeatherAlerts((current) => ({ ...current, [stop.stop_id]: weather.alerts }));
    setStopRisks((current) => ({ ...current, [stop.stop_id]: risk }));
    setTrip((current) => ({
      ...current,
      trip_status: 'Scanned',
      last_scanned: new Date().toISOString(),
      airports: current.airports.map((item) => item.stop_id === stop.stop_id ? { ...item, scan_status: 'Scanned', nearby_facility_ids: facilities.map((facility) => facility.facility_id), selected_facility_ids: current.selected_facilities.filter((selection) => selection.stop_id === item.stop_id && selection.selected).map((selection) => selection.facility_id), airport_risk_score: risk.score, airport_risk_band: risk.band, faa_watch_count: faa.alerts.length, weather_alert_count: weather.alerts.length } : item),
    }));
    setScanningStopId(null);
    setGeneratedReport(false);
  }

  async function scanAllStops() {
    setSelectedStopFilter('all');
    for (const stop of trip.airports) {
      // Sequential scans avoid flooding browser fetches and keep status predictable.
      // eslint-disable-next-line no-await-in-loop
      await scanStop(stop);
    }
    setSelectedStopFilter('all');
    setActiveTab('locations');
  }

  function openReportFromPlanner() {
    setCommandView('workflow');
    setActiveTab('report');
    if (reportMessages.length === 0) setGeneratedReport(true);
  }

  function startNewWorkflow() {
    setTrip(createEmptyAviationTrip());
    setStopFacilities({});
    setStopFaaAlerts({});
    setStopWeatherAlerts({});
    setStopRisks({});
    setSelectedStopFilter('all');
    setActiveTab('planner');
    setGeneratedReport(false);
    setCommandView('workflow');
  }

  async function launchCommandDemo() {
    await launchDemoTrip(setTrip);
    setStopFacilities({});
    setStopFaaAlerts({});
    setStopWeatherAlerts({});
    setStopRisks({});
    setSelectedStopFilter('all');
    setActiveTab('planner');
    setGeneratedReport(false);
    setCommandView('workflow');
  }

  function openWorkflowFromLanding() {
    setCommandView('workflow');
    setActiveTab('planner');
  }

  function addManualFacility() {
    const stop = trip.airports.find((item) => item.stop_id === manualFacilityDraft.stopId) ?? trip.airports[0];
    if (!stop || !manualFacilityDraft.facilityName.trim()) return;
    const latitude = Number(manualFacilityDraft.latitude) || stop.latitude;
    const longitude = Number(manualFacilityDraft.longitude) || stop.longitude;
    const distance = Math.max(0, Math.hypot(latitude - stop.latitude, longitude - stop.longitude) * 69);
    const facility: FacilityWithDistance = {
      facility_id: `MANUAL-${Date.now()}`,
      facility_number: manualFacilityDraft.facilityNumber || 'Manual',
      facility_name: `${manualFacilityDraft.facilityName} (Manual)`,
      facility_type: manualFacilityDraft.facilityType as NormalizedFacility['facility_type'],
      city: manualFacilityDraft.city || stop.city,
      state: manualFacilityDraft.state || stop.state,
      latitude,
      longitude,
      facility_risk_score: 45,
      facility_risk_band: 'Watch',
      top_risk_driver: manualFacilityDraft.reason || 'Manually added facility requires validation.',
      ep_readiness_status: 'Unknown',
      aviation_support_candidate: false,
      source_freshness: 'seeded_demo',
      distance_miles: distance,
      estimated_drive_time_minutes: Math.max(5, Math.round(distance / 35 * 60)),
      drive_time_source: 'estimated',
      weather_exposure: 'Watch',
      recommended_action: 'Review manual facility details and verify local readiness',
    };
    setStopFacilities((current) => ({ ...current, [stop.stop_id]: [...(current[stop.stop_id] ?? []), facility] }));
    toggleFacility(stop, facility, true);
    setManualFacilityOpen(false);
    setManualFacilityDraft({ stopId: stop.stop_id, facilityName: '', facilityNumber: '', facilityType: 'Other', address: '', city: '', state: '', latitude: '', longitude: '', reason: '' });
  }

  function toggleFacility(stop: AviationTripAirportStop, facility: FacilityWithDistance, selected: boolean) {
    setTrip((current) => {
      const key = selectionKey(stop.stop_id, facility.facility_id);
      const without = current.selected_facilities.filter((selection) => selectedKey(selection) !== key);
      const nextSelections = selected ? [...without, buildSelectedFacility(current.trip_id, stop, facility, true)] : without;
      return { ...current, selected_facilities: nextSelections, airports: current.airports.map((item) => item.stop_id === stop.stop_id ? { ...item, selected_facility_ids: nextSelections.filter((selection) => selection.stop_id === item.stop_id && selection.selected).map((selection) => selection.facility_id) } : item) };
    });
    setGeneratedReport(false);
  }

  function updateSelection(stop: AviationTripAirportStop, facility: FacilityWithDistance, updates: Partial<AviationSelectedFacility>) {
    setTrip((current) => {
      const key = selectionKey(stop.stop_id, facility.facility_id);
      const existing = current.selected_facilities.find((selection) => selectedKey(selection) === key) ?? buildSelectedFacility(current.trip_id, stop, facility, true);
      return { ...current, selected_facilities: [...current.selected_facilities.filter((selection) => selectedKey(selection) !== key), { ...existing, ...updates, selected: true }] };
    });
    setGeneratedReport(false);
  }

  function selectByPredicate(predicate: (facility: FacilityWithDistance) => boolean) {
    for (const { stop, facility, selection } of allFacilityRows) if (!selection && predicate(facility)) toggleFacility(stop, facility, true);
  }

  async function copyText(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    setCopyMessage(message);
  }

  function printReport() {
    const html = renderMultiAirportTravelRiskReportHtml(reportPayload);
    const host = document.createElement('div');
    host.id = 'aviation-report-print-host';
    host.innerHTML = html;
    document.body.appendChild(host);
    document.body.classList.add('aviation-report-printing');
    const cleanup = () => { document.body.classList.remove('aviation-report-printing'); host.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  }

  if (commandView === 'landing') {
    return <AviationTravelCommandLanding onNewWorkflow={startNewWorkflow} onDemo={launchCommandDemo} onOpenWorkflow={openWorkflowFromLanding} onOpenReport={openReportFromPlanner} />;
  }

  return (
    <section className="aviation-command-center aviation-ops-command-center aviation-guided-workspace aviation-travel-command-workflow">
      <header className="aviation-hero panel aviation-panel">
        <div><p className="eyebrow">Travel Workflow</p><h1>Aviation Travel Command</h1><p className="aviation-caveat">Create a route, scan Walmart locations around each airport radius, add facilities as trip support locations, review map and risk breakdowns, and generate a color-coded Travel Risk Report. Advisory only; Aviation, EP, and Security leadership retain final review.</p><div className="aviation-hero-primary-actions"><button className="ops-action-button secondary" onClick={() => setCommandView('landing')}>Back to Aviation Travel Command</button><button className="ops-action-button" disabled={!hasRequiredAirports || Boolean(scanningStopId)} onClick={scanAllStops}>{scanningStopId ? 'Scanning route...' : 'Scan all airport stops'}</button><button className="ops-action-button secondary" onClick={() => setActiveTab('actions')}>Create Readiness Actions</button><button className="ops-action-button secondary" onClick={openReportFromPlanner}>Generate Travel Risk Report</button></div></div>
        <div className="aviation-summary-cards"><SummaryTile label="Airport stops" value={trip.airports.length} /><SummaryTile label="Selected facilities" value={selectedVisitRows.length} /><SummaryTile label="Overall travel risk" value={overallRisk.band} /></div>
      </header>

      <nav className="aviation-tabs aviation-review-tabs" aria-label="Aviation Travel Readiness workflow tabs">{tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'aviation-tab-button active' : 'aviation-tab-button'} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>

      {activeTab === 'planner' ? <TripPlannerTab trip={trip} facilityTypes={facilityTypes} startStop={startStop} endStop={endStop} hasRequiredAirports={hasRequiredAirports} scanning={Boolean(scanningStopId)} onPatchTrip={patchTrip} onSetStart={(airport) => handleEndpointSelect(airport, 'Start')} onSetEnd={(airport) => handleEndpointSelect(airport, 'End')} onAddIntermediate={handleAddIntermediate} onGlobalRadius={handleGlobalRadius} onToggleFacilityType={toggleFacilityTypeFilter} onSelectAllFacilityTypes={() => applyFacilityTypeFilters([])} onSaveTrip={() => patchTrip({ trip_status: hasRequiredAirports ? 'Planned' : 'Draft' })} onScanAll={scanAllStops} onOpenReport={openReportFromPlanner} /> : null}
      {activeTab === 'stops' ? <AirportStopsTab trip={trip} stopFacilities={stopFacilities} stopRisks={stopRisks} scanningStopId={scanningStopId} onScanStop={scanStop} onUpdateStop={updateStop} onUpdateRadius={(stopId, radius) => setStops(updateAirportStopRadius(trip.airports, stopId, radius))} onRemoveStop={(stopId) => setStops(removeAirportStop(trip.airports, stopId))} onMoveStop={(stopId, direction) => setStops(moveIntermediateStop(trip.airports, stopId, direction))} onChangeAirport={(stop, airport) => setStops(trip.airports.map((item) => item.stop_id === stop.stop_id ? { ...airportToStop(airport, stop.stop_type, stop.sequence, stop.radius_miles), stop_id: stop.stop_id, scan_status: 'Needs Refresh' } : item))} onViewLocations={(stopId) => { setSelectedStopFilter(stopId); setActiveTab('locations'); }} onViewRisk={() => setActiveTab('risk')} /> : null}
      {activeTab === 'map' ? <RouteMapTab trip={trip} stopFacilities={stopFacilities} selectedMap={selectedMap} selectedStopId={selectedStopFilter} onSelectStop={setSelectedStopFilter} onToggleFacility={toggleFacility} /> : null}
      {activeTab === 'locations' ? <WalmartLocationsTab rows={filteredRows} stops={trip.airports} selectedStopFilter={selectedStopFilter} riskFilter={riskFilter} selectedOnly={selectedOnly} search={facilitySearch} onStopFilter={setSelectedStopFilter} onRiskFilter={setRiskFilter} onSelectedOnly={setSelectedOnly} onSearch={setFacilitySearch} onToggleFacility={toggleFacility} onUpdateSelection={updateSelection} onSelectSupport={() => selectByPredicate((facility) => facility.aviation_support_candidate)} onSelectHighRisk={() => selectByPredicate((facility) => ['High', 'Critical'].includes(facility.facility_risk_band))} onClearSelections={() => patchTrip({ selected_facilities: [] })} selectedVisitCount={selectedVisitRows.length} onViewMap={() => setActiveTab('map')} onContinue={() => setActiveTab('map')} onOpenReport={openReportFromPlanner} onAddManual={() => { setManualFacilityDraft((current) => ({ ...current, stopId: selectedStopFilter !== 'all' ? selectedStopFilter : trip.airports[0]?.stop_id ?? '' })); setManualFacilityOpen(true); }} /> : null}
      {activeTab === 'risk' ? <AirportRiskTab trip={trip} stopRisks={stopRisks} stopFacilities={stopFacilities} stopFaaAlerts={stopFaaAlerts} stopWeatherAlerts={stopWeatherAlerts} overallRisk={overallRisk} /> : null}
      {activeTab === 'weather' ? <WorkflowWeatherTab trip={trip} stopWeatherAlerts={stopWeatherAlerts} /> : null}
      {activeTab === 'actions' ? <ReadinessActionsTab trip={trip} rows={allFacilityRows} stopRisks={stopRisks} /> : null}
      {activeTab === 'hotels' ? <HotelLodgingReadinessTab trip={trip} /> : null}
      {activeTab === 'report' ? <ReportTab payload={reportPayload} messages={reportMessages} generated={generatedReport} allowNoLocations={allowNoLocationsReport} copyMessage={copyMessage} onAllowNoLocations={setAllowNoLocationsReport} onGenerate={() => { setGeneratedReport(true); patchTrip({ trip_status: 'Report Generated' }); }} onCopyText={() => copyText(renderMultiAirportTravelRiskReportText(reportPayload), 'Plain-text report copied.')} onCopyHtml={() => copyText(renderMultiAirportTravelRiskReportHtml(reportPayload), 'HTML report copied.')} onDownload={() => downloadMultiAirportReportHtml(reportPayload)} onPrint={printReport} onEmail={() => prepareMultiAirportRiskEmail(reportPayload)} /> : null}
      {manualFacilityOpen ? <ManualFacilityModal stops={trip.airports} draft={manualFacilityDraft} onChange={setManualFacilityDraft} onCancel={() => setManualFacilityOpen(false)} onSave={addManualFacility} /> : null}
    </section>
  );
}

function AviationTravelCommandLanding({ onNewWorkflow, onDemo, onOpenWorkflow, onOpenReport }: { onNewWorkflow: () => void; onDemo: () => void; onOpenWorkflow: () => void; onOpenReport: () => void }) {
  const reviewWorkflows = commandWorkflowSummaries.filter((workflow) => ['Elevated', 'High', 'Critical'].includes(workflow.risk));
  const kpis = [
    ['Active Trips', '4', '2 planned / 1 active / 1 monitoring'],
    ['Trips Requiring Review', String(reviewWorkflows.length), 'Elevated, High, or Critical workflows'],
    ['Airports in Active Plans', '9', 'Route stops across active workflows'],
    ['Facilities in Radius', '32', 'Seeded/demo Walmart facilities scanned'],
    ['Open Readiness Actions', '10', 'Aviation, EP, Security, field owners'],
    ['Weather Watch Items', String(commandWeatherWatchItems.length), 'NOAA seeded/demo watch items'],
    ['Airport Risk Watch Items', String(commandAirportWatchItems.length), 'FAA/NOTAM and airport operations'],
    ['Travel Risk Reports Generated', '6', 'Recent report history'],
  ];
  return <section className="aviation-command-center aviation-travel-command-landing"><header className="aviation-hero panel aviation-panel"><div><p className="eyebrow">FPI Aviation Program</p><h1>Aviation Travel Command</h1><p className="aviation-caveat">Plan, monitor, and assess aviation-related travel readiness across active trips, airport stops, nearby facilities, weather, and readiness actions. Seeded/demo data is labeled and all outputs are advisory for Aviation, EP, and Security review.</p><div className="aviation-hero-primary-actions"><button className="ops-action-button" onClick={onNewWorkflow}>+ New Travel Workflow</button><button className="ops-action-button secondary" onClick={onDemo}>Demo Scenario</button></div></div></header><section className="aviation-command-kpi-grid">{kpis.map(([label, value, helper]) => <SummaryTile key={label} label={label} value={value} helper={helper} />)}</section><section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Program workload</p><h2>Active Travel Workflows</h2></div></div><div className="aviation-workflow-card-grid">{commandWorkflowSummaries.map((workflow) => <article className="aviation-workflow-card" key={workflow.tripName}><div><span className="mode-pill">{workflow.status}</span><strong>{workflow.tripName}</strong><p>{workflow.start} → {workflow.end} · {workflow.additionalStops} additional stop(s)</p></div><div className="aviation-workflow-metrics"><span>Trip window <strong>{workflow.window}</strong></span><span>Overall travel risk <strong style={{ color: riskColor[workflow.risk] }}>{workflow.risk}</strong></span><span>Open actions <strong>{workflow.actions}</strong></span><span>Weather risk <strong>{workflow.weather}</strong></span><span>Airport risk <strong>{workflow.airport}</strong></span><span>Last updated <strong>{workflow.updated}</strong></span></div><div className="aviation-button-row"><button className="ops-action-button" onClick={onOpenWorkflow}>Open Workflow</button><button className="ops-action-button secondary" onClick={onOpenReport}>Generate Travel Risk Report</button><button className="ops-action-button secondary" onClick={onOpenWorkflow}>Review Readiness Actions</button><button className="ops-action-button secondary" onClick={onOpenWorkflow}>View Map</button></div></article>)}</div></section><section className="aviation-command-two-column"><CommandReviewPanel workflows={reviewWorkflows} /><CommandAirportWatchPanel /><CommandWeatherWatchPanel /><CommandActionsPanel /><CommandReportsPanel onOpenReport={onOpenReport} /></section></section>;
}

function CommandReviewPanel({ workflows }: { workflows: typeof commandWorkflowSummaries[number][] }) { return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Review queue</p><h2>Trips Requiring Review</h2></div></div>{workflows.map((workflow) => <article className="aviation-command-row" key={workflow.tripName}><strong>{workflow.tripName}</strong><span style={{ color: riskColor[workflow.risk] }}>{workflow.risk}</span><p>{workflow.reviewReason || 'Human review recommended due to elevated readiness posture.'}</p></article>)}</section>; }
function CommandAirportWatchPanel() { return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Airport risk</p><h2>Airport Risk Watch</h2></div></div>{commandAirportWatchItems.map((item) => <article className="aviation-command-row" key={`${item.airport}-${item.type}`}><strong>{item.airport} · {item.type}</strong><span style={{ color: riskColor[item.risk] }}>{item.risk}</span><p>{item.tripName}: {item.summary}</p><small>{item.source} · {item.updated}</small></article>)}</section>; }
function CommandWeatherWatchPanel() { return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Weather</p><h2>Weather Watch</h2></div></div>{commandWeatherWatchItems.map((item) => <article className="aviation-command-row" key={`${item.airport}-${item.type}`}><strong>{item.airport} · {item.type}</strong><span style={{ color: riskColor[item.risk] }}>{item.risk}</span><p>{item.timing}: {item.summary}</p><small>{item.source} · confidence {item.confidence}%</small></article>)}</section>; }
function CommandActionsPanel() { const actions = ['Confirm severe weather timing against planned arrival window.', 'Review FAA / NOTAM item affecting airport operations.', 'Verify EP readiness for highest-risk nearby facility.', 'Validate hotel security posture before overnight stay.']; return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Open work</p><h2>Open Readiness Actions</h2></div></div>{actions.map((action, index) => <article className="aviation-command-row" key={action}><strong>{action}</strong><span>{index < 2 ? 'High' : 'Medium'} · Open</span><p>Owner: {index === 0 ? 'Aviation' : index === 1 ? 'Global Security' : 'Executive Protection'} · Evidence required</p></article>)}</section>; }
function CommandReportsPanel({ onOpenReport }: { onOpenReport: () => void }) { return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Reports</p><h2>Recent Travel Risk Reports</h2></div></div>{commandWorkflowSummaries.slice(0, 3).map((workflow) => <article className="aviation-command-row" key={`report-${workflow.tripName}`}><strong>{workflow.tripName} Report</strong><span style={{ color: riskColor[workflow.risk] }}>{workflow.risk}</span><p>Generated by FPI Aviation Travel Command · {workflow.updated}</p><div className="aviation-button-row"><button className="ops-action-button secondary" onClick={onOpenReport}>View</button><button className="ops-action-button secondary" onClick={onOpenReport}>Copy</button><button className="ops-action-button secondary" onClick={onOpenReport}>Export</button></div></article>)}</section>; }

function SummaryTile({ label, value, helper }: { label: string; value: string | number; helper?: string }) { return <article className="aviation-summary-card"><span>{label}</span><strong>{value}</strong>{helper ? <small>{helper}</small> : null}</article>; }

function TripPlannerTab({ trip, facilityTypes, startStop, endStop, hasRequiredAirports, scanning, onPatchTrip, onSetStart, onSetEnd, onAddIntermediate, onGlobalRadius, onToggleFacilityType, onSelectAllFacilityTypes, onSaveTrip, onScanAll, onOpenReport }: { trip: AviationMultiAirportTrip; facilityTypes: string[]; startStop: AviationTripAirportStop | null; endStop: AviationTripAirportStop | null; hasRequiredAirports: boolean; scanning: boolean; onPatchTrip: (updates: Partial<AviationMultiAirportTrip>) => void; onSetStart: (airport: Airport) => void; onSetEnd: (airport: Airport) => void; onAddIntermediate: (airport: Airport) => void; onGlobalRadius: (radius: number) => void; onToggleFacilityType: (type: string) => void; onSelectAllFacilityTypes: () => void; onSaveTrip: () => void; onScanAll: () => void; onOpenReport: () => void }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Trip Planner</p><h2>Create or select a trip</h2></div><span className="mode-pill">Risk {trip.overall_risk_band ?? 'Pending'}</span></div><p className="aviation-empty">{hasRequiredAirports ? 'Starting and ending airports are selected. Add intermediate airports if the trip has additional stops.' : 'Create a trip by selecting a starting airport and ending airport. Add intermediate airports if the trip has additional stops.'}</p><div className="aviation-detail-grid"><label>Trip name<input className="aviation-input" value={trip.trip_name} onChange={(event) => onPatchTrip({ trip_name: event.target.value })} placeholder="Name this aviation readiness trip" /></label><label>Traveler type<select className="aviation-input" value={trip.traveler_type} onChange={(event) => onPatchTrip({ traveler_type: event.target.value as AviationTravelerType })}><option>Executive</option><option>Crew</option><option>Support</option><option>Field / Security</option></select></label><label>Trip start<input className="aviation-input" type="datetime-local" value={trip.trip_start} onChange={(event) => onPatchTrip({ trip_start: event.target.value })} /></label><label>Trip end<input className="aviation-input" type="datetime-local" value={trip.trip_end} onChange={(event) => onPatchTrip({ trip_end: event.target.value })} /></label></div><RadiusSelector radiusMiles={trip.default_radius_miles} onChange={onGlobalRadius} /><section className="aviation-detail-grid"><div><p className="eyebrow">Starting airport</p><AirportSearch selectedAirport={startStop ? stopToSearchAirport(startStop) : null} onSelectAirport={onSetStart} /></div><div><p className="eyebrow">Ending airport</p><AirportSearch selectedAirport={endStop ? stopToSearchAirport(endStop) : null} onSelectAirport={onSetEnd} /></div><div><p className="eyebrow">Add intermediate airport</p><AirportSearch selectedAirport={null} onSelectAirport={onAddIntermediate} /></div></section><section className="panel aviation-panel compact"><p className="eyebrow">Facility type filters</p><div className="aviation-filter-row"><button type="button" className={trip.facility_types.length === 0 ? 'aviation-filter-chip selected' : 'aviation-filter-chip'} aria-pressed={trip.facility_types.length === 0} onClick={onSelectAllFacilityTypes}>All Walmart facility types</button>{facilityTypes.map((type) => <button key={type} type="button" className={trip.facility_types.includes(type) ? 'aviation-filter-chip selected' : 'aviation-filter-chip'} aria-pressed={trip.facility_types.includes(type)} onClick={() => onToggleFacilityType(type)}>{type}</button>)}</div></section><div className="aviation-button-row"><button className="ops-action-button" disabled={!trip.trip_name.trim() || !hasRequiredAirports} onClick={onSaveTrip}>Save Trip</button><button className="ops-action-button" disabled={!hasRequiredAirports || scanning} onClick={onScanAll}>{scanning ? 'Scanning...' : 'Run Full Trip Scan'}</button><button className="ops-action-button secondary" onClick={onOpenReport}>Generate Travel Risk Report</button></div></section>;
}

function stopToSearchAirport(stop: AviationTripAirportStop): Airport { return { airport_id: stop.airport_id, airport_name: stop.airport_name, faa_id: stop.faa_id, iata_code: stop.iata_code, icao_code: stop.icao_code, city: stop.city, state: stop.state, latitude: stop.latitude, longitude: stop.longitude, status: 'active', source_freshness: 'seeded_demo', last_updated: new Date().toISOString() }; }

function AirportStopsTab({ trip, stopFacilities, stopRisks, scanningStopId, onScanStop, onUpdateStop, onUpdateRadius, onRemoveStop, onMoveStop, onChangeAirport, onViewLocations, onViewRisk }: { trip: AviationMultiAirportTrip; stopFacilities: StopDataMap<FacilityWithDistance>; stopRisks: Record<string, AviationAirportRisk>; scanningStopId: string | null; onScanStop: (stop: AviationTripAirportStop) => void; onUpdateStop: (stopId: string, update: Partial<AviationTripAirportStop>) => void; onUpdateRadius: (stopId: string, radius: number) => void; onRemoveStop: (stopId: string) => void; onMoveStop: (stopId: string, direction: -1 | 1) => void; onChangeAirport: (stop: AviationTripAirportStop, airport: Airport) => void; onViewLocations: (stopId: string) => void; onViewRisk: () => void }) {
  if (!trip.airports.length) return <section className="panel aviation-panel"><p className="aviation-empty">Select starting and ending airports to build the trip route.</p></section>;
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Airport Stops</p><h2>Route timeline</h2></div></div><div className="aviation-stop-timeline">{trip.airports.map((stop, index) => { const risk = stopRisks[stop.stop_id] ?? emptyRisk(); return <article className="aviation-selected-card" key={stop.stop_id}><span className="eyebrow">{stop.stop_type} · Stop {stop.sequence}</span><strong>{stop.airport_name}</strong><span>{stop.city}, {stop.state} · {codeForStop(stop)}</span><span>Radius: <input className="aviation-input" type="number" min={1} max={250} value={stop.radius_miles} onChange={(event) => onUpdateRadius(stop.stop_id, Number(event.target.value))} /> miles</span><div className="aviation-detail-grid"><label>Arrival<input className="aviation-input" type="datetime-local" value={stop.arrival_time ?? ''} onChange={(event) => onUpdateStop(stop.stop_id, { arrival_time: event.target.value })} /></label><label>Departure<input className="aviation-input" type="datetime-local" value={stop.departure_time ?? ''} onChange={(event) => onUpdateStop(stop.stop_id, { departure_time: event.target.value })} /></label><span>Scan status: <strong>{stop.scan_status}</strong></span><span>Walmart found: <strong>{(stopFacilities[stop.stop_id] ?? []).length}</strong></span><span>Walmart selected: <strong>{stop.selected_facility_ids.length}</strong></span><span>FAA watch: <strong>{stop.faa_watch_count ?? 0}</strong></span><span>NOAA weather: <strong>{stop.weather_alert_count ?? 0}</strong></span><span>Risk: <strong style={{ color: riskColor[risk.band] }}>{risk.band} {risk.band !== 'Pending' ? `· ${risk.score}` : ''}</strong></span></div><details><summary>Change airport</summary><AirportSearch selectedAirport={stopToSearchAirport(stop)} onSelectAirport={(airport) => onChangeAirport(stop, airport)} /></details><div className="aviation-button-row"><button className="ops-action-button" onClick={() => onScanStop(stop)} disabled={scanningStopId === stop.stop_id}>{scanningStopId === stop.stop_id ? 'Scanning...' : 'Scan This Airport'}</button><button className="ops-action-button secondary" onClick={() => onViewLocations(stop.stop_id)}>View Nearby Walmart Locations</button><button className="ops-action-button secondary" onClick={onViewRisk}>View Airport Risk</button>{stop.stop_type === 'Intermediate' ? <><button className="ops-action-button secondary" disabled={index <= 1} onClick={() => onMoveStop(stop.stop_id, -1)}>Move Up</button><button className="ops-action-button secondary" disabled={index >= trip.airports.length - 2} onClick={() => onMoveStop(stop.stop_id, 1)}>Move Down</button><button className="ops-action-button danger" onClick={() => onRemoveStop(stop.stop_id)}>Remove Stop</button></> : null}</div></article>; })}</div></section>;
}

function RouteMapTab({ trip, stopFacilities, selectedMap, selectedStopId, onSelectStop, onToggleFacility }: { trip: AviationMultiAirportTrip; stopFacilities: StopDataMap<FacilityWithDistance>; selectedMap: Map<string, AviationSelectedFacility>; selectedStopId: string; onSelectStop: (stopId: string) => void; onToggleFacility: (stop: AviationTripAirportStop, facility: FacilityWithDistance, selected: boolean) => void }) {
  const stops = selectedStopId === 'all' ? trip.airports : trip.airports.filter((stop) => stop.stop_id === selectedStopId);
  if (!trip.airports.length) return <section className="panel aviation-panel"><p className="aviation-empty">Select starting and ending airports to build the trip map.</p></section>;
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Radius Map</p><h2>Route, radius rings, and Walmart locations</h2></div><select className="aviation-input" value={selectedStopId} onChange={(event) => onSelectStop(event.target.value)}><option value="all">All airports</option>{trip.airports.map((stop) => <option key={stop.stop_id} value={stop.stop_id}>{stop.sequence}. {codeForStop(stop)}</option>)}</select></div><div className="aviation-route-map-canvas"><svg viewBox="0 0 100 54" role="img" aria-label="Simplified aviation route map">{trip.airports.length > 1 ? <polyline points={trip.airports.map((_, index) => `${10 + index * (80 / Math.max(1, trip.airports.length - 1))},20`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2 1" /> : null}{trip.airports.map((stop, index) => <g key={stop.stop_id}><circle cx={10 + index * (80 / Math.max(1, trip.airports.length - 1))} cy="20" r={Math.max(4, Math.min(18, stop.radius_miles / 6))} fill="rgba(37,99,235,.08)" stroke="rgba(37,99,235,.4)" /><circle cx={10 + index * (80 / Math.max(1, trip.airports.length - 1))} cy="20" r="2.2" fill={stop.stop_type === 'Start' ? '#16a34a' : stop.stop_type === 'End' ? '#dc2626' : '#2563eb'} /><text x={10 + index * (80 / Math.max(1, trip.airports.length - 1))} y="15" textAnchor="middle" fontSize="3">{stop.stop_type === 'Start' ? 'Start' : stop.stop_type === 'End' ? 'End' : `Stop ${stop.sequence}`}</text><text x={10 + index * (80 / Math.max(1, trip.airports.length - 1))} y="27" textAnchor="middle" fontSize="3">{codeForStop(stop)}</text></g>)}</svg></div><MapBreakdown stops={stops} stopFacilities={stopFacilities} selectedMap={selectedMap} /><div className="aviation-location-grid">{stops.flatMap((stop) => (stopFacilities[stop.stop_id] ?? []).map((facility) => ({ stop, facility }))).map(({ stop, facility }) => { const selected = selectedMap.has(selectionKey(stop.stop_id, facility.facility_id)); return <article key={`${stop.stop_id}-${facility.facility_id}`} className="aviation-selected-card"><span className="eyebrow">{codeForStop(stop)} · {facility.distance_miles.toFixed(1)} mi</span><strong>{facility.facility_name} #{facility.facility_number}</strong><span>{facility.facility_type} · {facility.city}, {facility.state}</span><span style={{ color: riskColor[facility.facility_risk_band] }}>Risk {facility.facility_risk_band} · EP {facility.ep_readiness_status} · Weather {facility.weather_exposure}</span><span>{facility.recommended_action}</span><button className={selected ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => onToggleFacility(stop, facility, !selected)}>{selected ? 'Deselect' : 'Select'} for report</button></article>; })}</div>{trip.airports.some((stop) => stop.scan_status === 'Not Scanned') ? <p className="aviation-empty">Airports selected but not all scanned. Airport markers and radius context are available; run scans to show Walmart facility markers.</p> : null}</section>;
}

function MapBreakdown({ stops, stopFacilities, selectedMap }: { stops: AviationTripAirportStop[]; stopFacilities: StopDataMap<FacilityWithDistance>; selectedMap: Map<string, AviationSelectedFacility> }) {
  if (!stops.length) return null;
  const totals = stops.map((stop) => {
    const facilities = stopFacilities[stop.stop_id] ?? [];
    const selectedCount = facilities.filter((facility) => selectedMap.has(selectionKey(stop.stop_id, facility.facility_id))).length;
    const highRiskCount = facilities.filter((facility) => ['High', 'Critical'].includes(facility.facility_risk_band)).length;
    const nearest = [...facilities].sort((a, b) => a.distance_miles - b.distance_miles)[0];
    return { stop, facilities, selectedCount, highRiskCount, nearest };
  });
  return <section className="aviation-map-breakdown"><div><p className="eyebrow">Map breakdown</p><h3>Airport radius coverage</h3></div><div className="aviation-map-breakdown-grid">{totals.map(({ stop, facilities, selectedCount, highRiskCount, nearest }) => <article key={stop.stop_id}><strong>{stop.sequence}. {codeForStop(stop)} · {stop.stop_type}</strong><span>{stop.airport_name}</span><span>Radius {stop.radius_miles} mi · Stores found {facilities.length} · Store visits {selectedCount}</span><span>High/Critical stores {highRiskCount}</span><span>Nearest store: {nearest ? `${nearest.facility_name} #${nearest.facility_number} (${nearest.distance_miles.toFixed(1)} mi)` : 'Scan this airport to populate stores'}</span></article>)}</div></section>;
}

function WalmartLocationsTab({ rows, stops, selectedStopFilter, riskFilter, selectedOnly, search, selectedVisitCount, onStopFilter, onRiskFilter, onSelectedOnly, onSearch, onToggleFacility, onUpdateSelection, onSelectSupport, onSelectHighRisk, onClearSelections, onViewMap, onContinue, onOpenReport, onAddManual }: { rows: Array<{ stop: AviationTripAirportStop; facility: FacilityWithDistance; selection?: AviationSelectedFacility }>; stops: AviationTripAirportStop[]; selectedStopFilter: string; riskFilter: string; selectedOnly: boolean; search: string; selectedVisitCount: number; onStopFilter: (value: string) => void; onRiskFilter: (value: string) => void; onSelectedOnly: (value: boolean) => void; onSearch: (value: string) => void; onToggleFacility: (stop: AviationTripAirportStop, facility: FacilityWithDistance, selected: boolean) => void; onUpdateSelection: (stop: AviationTripAirportStop, facility: FacilityWithDistance, updates: Partial<AviationSelectedFacility>) => void; onSelectSupport: () => void; onSelectHighRisk: () => void; onClearSelections: () => void; onViewMap: () => void; onContinue: () => void; onOpenReport: () => void; onAddManual: () => void }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Walmart Locations</p><h2>Operational selection table</h2></div></div><div className="aviation-detail-grid"><select className="aviation-input" value={selectedStopFilter} onChange={(event) => onStopFilter(event.target.value)}><option value="all">All airport stops</option>{stops.map((stop) => <option key={stop.stop_id} value={stop.stop_id}>{stop.sequence}. {codeForStop(stop)} · {stop.stop_type}</option>)}</select><select className="aviation-input" value={riskFilter} onChange={(event) => onRiskFilter(event.target.value)}><option value="all">All risk bands</option>{riskBands.map((band) => <option key={band}>{band}</option>)}</select><label><input type="checkbox" checked={selectedOnly} onChange={(event) => onSelectedOnly(event.target.checked)} /> Selected only</label><input className="aviation-input" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search facility name, number, city, or state" /></div><div className="aviation-button-row"><button className="ops-action-button secondary" onClick={onSelectSupport}>Select all support/staging</button><button className="ops-action-button secondary" onClick={onSelectHighRisk}>Select all high-risk verification</button><button className="ops-action-button secondary" onClick={onClearSelections}>Clear selections</button><button className="ops-action-button secondary" onClick={onAddManual}>+ Add Facility Manually</button><button className="ops-action-button secondary" onClick={onViewMap}>View map breakdown</button><button className="ops-action-button" onClick={onContinue}>Continue to Map ({selectedVisitCount} selected)</button><button className="ops-action-button secondary" onClick={onOpenReport}>Generate Travel Risk Report</button></div>{rows.length === 0 ? <p className="aviation-empty">No Walmart locations found for the current airport/filter view. Run the full trip scan or scan each airport stop, then clear filters or choose All airport stops.</p> : <div className="aviation-table-wrap"><table className="aviation-data-table"><thead><tr><th>Select</th><th>Airport stop</th><th>Facility</th><th>Facility type</th><th>City/state</th><th>Distance</th><th>Facility risk</th><th>EP readiness</th><th>Weather</th><th>Recommended role</th><th>Recommended action / note</th></tr></thead><tbody>{rows.map(({ stop, facility, selection }) => <tr key={`${stop.stop_id}-${facility.facility_id}`}><td><input type="checkbox" checked={Boolean(selection)} onChange={(event) => onToggleFacility(stop, facility, event.target.checked)} /></td><td>{stop.sequence}. {codeForStop(stop)}</td><td>{facility.facility_name} #{facility.facility_number}</td><td>{facility.facility_type}</td><td>{facility.city}, {facility.state}</td><td>{facility.distance_miles.toFixed(1)} mi</td><td><span style={{ color: riskColor[facility.facility_risk_band] }}>{facility.facility_risk_band}</span></td><td>{facility.ep_readiness_status}</td><td>{facility.weather_exposure}</td><td><select className="aviation-input" value={selection?.recommended_role ?? 'Monitor'} onChange={(event) => onUpdateSelection(stop, facility, { recommended_role: event.target.value as AviationSelectedFacility['recommended_role'] })}><option>Support / Staging</option><option>Monitor</option><option>Verification Required</option><option>Avoid</option><option>Visit Site</option></select></td><td>{facility.recommended_action}<input className="aviation-input" value={selection?.selection_reason ?? ''} onChange={(event) => onUpdateSelection(stop, facility, { selection_reason: event.target.value })} placeholder="Selection note or reason" /></td></tr>)}</tbody></table></div>}</section>;
}

function StoreVisitsTab({ rows, onOpenLocations, onOpenReport }: { rows: Array<{ stop: AviationTripAirportStop; facility: FacilityWithDistance; selection?: AviationSelectedFacility }>; onOpenLocations: () => void; onOpenReport: () => void }) {
  const orderedRows = [...rows].sort((a, b) => a.stop.sequence - b.stop.sequence || a.facility.distance_miles - b.facility.distance_miles);
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Store Visits</p><h2>Selected Walmart locations added to this trip</h2></div><span className="mode-pill">{orderedRows.length} visits</span></div><p className="aviation-empty">Selecting a Walmart location adds it as a store visit for the route and includes it in the Travel Risk Report.</p>{orderedRows.length === 0 ? <div className="aviation-empty-state-actions"><p className="aviation-empty">No store visits have been added yet. Run the airport scan, then select Walmart locations from the locations table.</p><button className="ops-action-button" onClick={onOpenLocations}>Select Walmart Locations</button></div> : <><div className="aviation-store-visit-grid">{orderedRows.map(({ stop, facility, selection }, index) => <article key={`${stop.stop_id}-${facility.facility_id}`} className="aviation-store-visit-card"><span className="eyebrow">Visit {index + 1} · {stop.stop_type} airport {codeForStop(stop)}</span><strong>{facility.facility_name} #{facility.facility_number}</strong><span>{facility.facility_type} · {facility.city}, {facility.state}</span><span>{facility.distance_miles.toFixed(1)} miles from {stop.airport_name} · Drive time {facility.estimated_drive_time_minutes ?? 'TBD'} min</span><span>Role: <strong>{selection?.recommended_role ?? 'Monitor'}</strong></span><span style={{ color: riskColor[facility.facility_risk_band] }}>Facility risk: {facility.facility_risk_band}</span>{selection?.selection_reason ? <p>{selection.selection_reason}</p> : <p>{facility.recommended_action}</p>}</article>)}</div><div className="aviation-button-row"><button className="ops-action-button secondary" onClick={onOpenLocations}>Edit store visits</button><button className="ops-action-button" onClick={onOpenReport}>Generate Travel Risk Report</button></div></>}</section>;
}

function AirportRiskTab({ trip, stopRisks, stopFacilities, stopFaaAlerts, stopWeatherAlerts, overallRisk }: { trip: AviationMultiAirportTrip; stopRisks: Record<string, AviationAirportRisk>; stopFacilities: StopDataMap<FacilityWithDistance>; stopFaaAlerts: StopDataMap<FAAAlert>; stopWeatherAlerts: StopDataMap<WeatherAlert>; overallRisk: AviationAirportRisk }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Airport Risk</p><h2>Overall and per-airport risk</h2></div><span className="mode-pill">{overallRisk.band} {overallRisk.band !== 'Pending' ? overallRisk.score : ''}</span></div><div className="aviation-summary-cards"><SummaryTile label="Overall trip risk" value={overallRisk.band} /><SummaryTile label="Overall score" value={overallRisk.band === 'Pending' ? 'Pending' : overallRisk.score} /><SummaryTile label="Confidence" value={overallRisk.confidence ? `${overallRisk.confidence}%` : 'Pending'} /></div>{overallRisk.band === 'Pending' ? <p className="aviation-empty">Risk remains Pending until at least one airport radius scan runs.</p> : null}<div className="aviation-location-grid">{trip.airports.map((stop) => { const risk = stopRisks[stop.stop_id] ?? emptyRisk(); const facilities = stopFacilities[stop.stop_id] ?? []; return <article key={stop.stop_id} className="aviation-selected-card"><span className="eyebrow">{stop.stop_type} · {codeForStop(stop)}</span><strong style={{ color: riskColor[risk.band] }}>{risk.band} {risk.band !== 'Pending' ? `· ${risk.score}` : ''}</strong><span>FAA watch items: {(stopFaaAlerts[stop.stop_id] ?? []).length}</span><span>NOAA weather alerts: {(stopWeatherAlerts[stop.stop_id] ?? []).length}</span><span>Facilities in radius: {facilities.length}</span><span>Selected Walmart exposure: {stop.selected_facility_ids.length}</span><ul>{risk.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul></article>; })}</div></section>;
}

function WorkflowWeatherTab({ trip, stopWeatherAlerts }: { trip: AviationMultiAirportTrip; stopWeatherAlerts: StopDataMap<WeatherAlert> }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Weather readiness</p><h2>Weather risk by airport stop</h2></div><span className="mode-pill">Advisory</span></div><p className="aviation-caveat">Weather is included in Airport Stop Risk, readiness actions, reports, and the map overlay placeholder. Verify live NOAA/aviation weather before operational action.</p><div className="aviation-location-grid">{trip.airports.map((stop) => { const alerts = stopWeatherAlerts[stop.stop_id] ?? []; return <article className="aviation-selected-card" key={stop.stop_id}><span className="eyebrow">{stop.stop_type} · {codeForStop(stop)}</span><strong>{stop.airport_name}</strong><span>Current weather: Seeded/demo placeholder</span><span>Forecast during trip window: Verify live source</span><span>Severe alerts: {alerts.length}</span><span>Wind risk: {alerts.some((a) => a.alert_type.toLowerCase().includes('wind')) ? 'Elevated' : 'Watch'}</span><span>Lightning risk: {alerts.some((a) => a.alert_type.toLowerCase().includes('thunder')) ? 'High' : 'Watch'}</span><span>Flooding / winter / visibility: Review if alert present</span>{alerts.length ? <ul>{alerts.map((alert) => <li key={alert.weather_alert_id}>{alert.alert_type} · {alert.severity} · {alert.summary}</li>)}</ul> : <p>No seeded weather alerts loaded for this stop. Run Scan Facilities to refresh weather watch items.</p>}</article>; })}</div></section>;
}

function HotelLodgingReadinessTab({ trip }: { trip: AviationMultiAirportTrip }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Future-ready module</p><h2>Hotel & Lodging Readiness</h2></div><span className="mode-pill">MVP placeholder</span></div><p className="aviation-caveat">Hotel selection and lodging risk assessment will support hotel search, manual lodging entry, area risk review, distance from airport, distance from selected Walmart facilities, and executive protection readiness scoring.</p><div className="aviation-button-row"><button className="ops-action-button secondary">+ Add Hotel / Lodging Site</button></div><div className="aviation-location-grid">{trip.airports.map((stop) => <article key={stop.stop_id} className="aviation-selected-card"><span className="eyebrow">{codeForStop(stop)}</span><strong>Hotel readiness pending</strong><span>Distance from airport: TBD</span><span>Hotel risk band: Unknown</span><span>Security notes: Manual entry placeholder</span><span>Selected for report: Pending</span></article>)}</div></section>;
}

function ManualFacilityModal({ stops, draft, onChange, onCancel, onSave }: { stops: AviationTripAirportStop[]; draft: { stopId: string; facilityName: string; facilityNumber: string; facilityType: string; address: string; city: string; state: string; latitude: string; longitude: string; reason: string }; onChange: (draft: { stopId: string; facilityName: string; facilityNumber: string; facilityType: string; address: string; city: string; state: string; latitude: string; longitude: string; reason: string }) => void; onCancel: () => void; onSave: () => void }) {
  const update = (key: keyof typeof draft, value: string) => onChange({ ...draft, [key]: value });
  return <div className="aviation-modal-backdrop"><section className="panel aviation-panel aviation-manual-modal" role="dialog" aria-modal="true" aria-labelledby="manual-facility-title"><div className="card-heading"><div><p className="eyebrow">Manual facility</p><h2 id="manual-facility-title">+ Add Facility Manually</h2></div></div><div className="aviation-detail-grid"><label>Airport stop<select className="aviation-input" value={draft.stopId} onChange={(event) => update('stopId', event.target.value)}>{stops.map((stop) => <option key={stop.stop_id} value={stop.stop_id}>{stop.sequence}. {codeForStop(stop)} · {stop.airport_name}</option>)}</select></label><label>Facility Name<input className="aviation-input" value={draft.facilityName} onChange={(event) => update('facilityName', event.target.value)} /></label><label>Facility Number<input className="aviation-input" value={draft.facilityNumber} onChange={(event) => update('facilityNumber', event.target.value)} /></label><label>Facility Type<select className="aviation-input" value={draft.facilityType} onChange={(event) => update('facilityType', event.target.value)}><option>Walmart Supercenter</option><option>Neighborhood Market</option><option>Sam's Club</option><option>Distribution Center</option><option>Fulfillment Center</option><option>Corporate / Critical Support</option><option>Other</option></select></label><label>Address<input className="aviation-input" value={draft.address} onChange={(event) => update('address', event.target.value)} /></label><label>City<input className="aviation-input" value={draft.city} onChange={(event) => update('city', event.target.value)} /></label><label>State<input className="aviation-input" value={draft.state} onChange={(event) => update('state', event.target.value)} /></label><label>Latitude<input className="aviation-input" value={draft.latitude} onChange={(event) => update('latitude', event.target.value)} /></label><label>Longitude<input className="aviation-input" value={draft.longitude} onChange={(event) => update('longitude', event.target.value)} /></label><label>Reason for Adding<input className="aviation-input" value={draft.reason} onChange={(event) => update('reason', event.target.value)} /></label></div><p className="aviation-caveat">Manual facilities are labeled Manual and included in map, Airport Stop Risk context, readiness actions, and Travel Risk Report data for human review.</p><div className="aviation-button-row"><button className="ops-action-button" onClick={onSave} disabled={!draft.facilityName.trim()}>Add Manual Facility</button><button className="ops-action-button secondary" onClick={onCancel}>Cancel</button></div></section></div>;
}

function ReadinessActionsTab({ rows, stopRisks }: { trip: AviationMultiAirportTrip; rows: Array<{ stop: AviationTripAirportStop; facility: FacilityWithDistance; selection?: AviationSelectedFacility }>; stopRisks: Record<string, AviationAirportRisk> }) {
  const selectedRows = rows.filter((row) => row.selection);
  const actions = [
    ...Object.entries(stopRisks).flatMap(([stopId, risk]) => risk.band === 'High' || risk.band === 'Critical' ? [{ group: stopId, title: 'Review airport risk posture', description: risk.drivers[0] ?? 'Elevated airport risk.', priority: risk.band }] : []),
    ...selectedRows.filter((row) => ['High', 'Critical'].includes(row.facility.facility_risk_band) || row.facility.ep_readiness_status === 'Gap').map((row) => ({ group: `${codeForStop(row.stop)} / ${row.facility.facility_number}`, title: `Verify ${row.facility.facility_name}`, description: row.facility.recommended_action, priority: row.facility.facility_risk_band })),
  ];
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Readiness Actions</p><h2>Grouped by trip, airport, and Walmart location</h2></div></div>{actions.length === 0 ? <p className="aviation-empty">Generate selections and scans to surface FAA, NOAA, high-risk facility, EP readiness, missing-data, and support/staging verification actions.</p> : <table className="aviation-data-table"><thead><tr><th>Group</th><th>Action title</th><th>Description</th><th>Owner role</th><th>Priority</th><th>Due time</th><th>Evidence required</th><th>Status</th></tr></thead><tbody>{actions.map((action, index) => <tr key={`${action.group}-${index}`}><td>{action.group}</td><td>{action.title}</td><td>{action.description}</td><td>FPI / EP coordination</td><td><span style={{ color: riskColor[action.priority] }}>{action.priority}</span></td><td>Before departure</td><td>Yes</td><td>Open</td></tr>)}</tbody></table>}</section>;
}

function ReportTab({ payload, messages, generated, allowNoLocations, copyMessage, onAllowNoLocations, onGenerate, onCopyText, onCopyHtml, onDownload, onPrint, onEmail }: { payload: AviationMultiAirportReportPayload; messages: string[]; generated: boolean; allowNoLocations: boolean; copyMessage: string | null; onAllowNoLocations: (value: boolean) => void; onGenerate: () => void; onCopyText: () => void; onCopyHtml: () => void; onDownload: () => void; onPrint: () => void; onEmail: () => void }) {
  const html = useMemo(() => renderMultiAirportTravelRiskReportHtml(payload), [payload]);
  const canGenerate = messages.length === 0;
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Travel Risk Report</p><h2>FPI Aviation Travel Risk Report</h2></div><span className="mode-pill">{payload.overallRisk.band}</span></div>{messages.length ? <section className="aviation-report-validation"><strong>Report prerequisites</strong>{messages.map((message) => <p key={message}>{message}</p>)}{messages.some((message) => message.includes('Select Walmart locations')) ? <label><input type="checkbox" checked={allowNoLocations} onChange={(event) => onAllowNoLocations(event.target.checked)} /> Confirm no Walmart locations are required for this report.</label> : null}</section> : null}<div className="report-action-bar"><button className="ops-action-button" disabled={!canGenerate} onClick={onGenerate}>Generate Report</button><button className="ops-action-button secondary" disabled={!generated} onClick={onCopyText}>Copy Plain Text</button><button className="ops-action-button secondary" disabled={!generated} onClick={onCopyHtml}>Copy HTML</button><button className="ops-action-button secondary" disabled={!generated} onClick={onDownload}>Download HTML</button><button className="ops-action-button secondary" disabled={!generated} onClick={onPrint}>Print / Save PDF</button><button className="ops-action-button secondary" disabled={!generated} onClick={onEmail}>Prepare Email</button></div>{copyMessage ? <p className="aviation-caveat">{copyMessage}</p> : null}<p className="aviation-caveat">Prepare Email uses mailto and does not claim to send email. Full formatted report can be copied or downloaded from FPI.</p>{generated ? <div className="aviation-report-preview" dangerouslySetInnerHTML={{ __html: html.replace(/^<!doctype html><html><head>[\s\S]*?<body>/i, '').replace(/<\/body><\/html>$/i, '') }} /> : <p className="aviation-empty">Generate the report to preview the color-coded executive-ready output.</p>}</section>;
}

function DemoTab({ onLaunch }: { onLaunch: () => void }) { return <section className="panel aviation-panel"><AviationDemoScenarioTab onLaunchDemo={onLaunch} /><button className="ops-action-button" onClick={onLaunch}>Launch Multi-Airport Demo Trip</button></section>; }

async function launchDemoTrip(setTrip: (trip: AviationMultiAirportTrip) => void) {
  const [xna, dfw] = await Promise.all([getAirportById('AIR-XNA'), getAirportById('AIR-DFW')]);
  const trip = createEmptyAviationTrip();
  trip.trip_name = 'Executive Multi-Airport Trip Demo';
  trip.traveler_type = 'Executive';
  trip.trip_start = '2026-05-14T12:00';
  trip.trip_end = '2026-05-14T20:00';
  trip.default_radius_miles = 50;
  if (xna) trip.airports = setEndpointStop(trip.airports, xna, 'Start', 50);
  if (dfw) trip.airports = setEndpointStop(trip.airports, dfw, 'End', 50);
  setTrip(trip);
}
