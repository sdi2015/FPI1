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

type TabId = 'planner' | 'stops' | 'map' | 'locations' | 'risk' | 'actions' | 'report' | 'demo';
type StopDataMap<T> = Record<string, T[]>;

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'planner', label: 'Trip Planner' },
  { id: 'stops', label: 'Airport Stops' },
  { id: 'map', label: 'Radius Map' },
  { id: 'locations', label: 'Walmart Locations' },
  { id: 'risk', label: 'Airport Risk' },
  { id: 'actions', label: 'Readiness Actions' },
  { id: 'report', label: 'Travel Risk Report' },
  { id: 'demo', label: 'Demo' },
];

const riskBands: FacilityRiskBand[] = ['Low', 'Watch', 'Elevated', 'High', 'Critical', 'Unknown'];
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
    for (const stop of trip.airports) {
      // Sequential scans avoid flooding browser fetches and keep status predictable.
      // eslint-disable-next-line no-await-in-loop
      await scanStop(stop);
    }
    setActiveTab('locations');
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

  return (
    <section className="aviation-command-center aviation-ops-command-center aviation-guided-workspace">
      <header className="aviation-hero panel aviation-panel">
        <div><p className="eyebrow">Aviation Travel Readiness</p><h1>Multi-airport trip planning workflow</h1><p className="aviation-caveat">Create a full route, scan Walmart locations around each airport radius, select locations for the plan, and generate a color-coded Travel Risk Report.</p></div>
        <div className="aviation-summary-cards"><SummaryTile label="Stops" value={trip.airports.length} /><SummaryTile label="Selected Walmart locations" value={trip.selected_facilities.filter((selection) => selection.selected).length} /><SummaryTile label="Overall risk" value={overallRisk.band} /></div>
      </header>

      <nav className="aviation-tabs aviation-review-tabs" aria-label="Aviation Travel Readiness workflow tabs">{tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'aviation-tab-button active' : 'aviation-tab-button'} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>

      {activeTab === 'planner' ? <TripPlannerTab trip={trip} facilityTypes={facilityTypes} startStop={startStop} endStop={endStop} hasRequiredAirports={hasRequiredAirports} scanning={Boolean(scanningStopId)} onPatchTrip={patchTrip} onSetStart={(airport) => handleEndpointSelect(airport, 'Start')} onSetEnd={(airport) => handleEndpointSelect(airport, 'End')} onAddIntermediate={handleAddIntermediate} onGlobalRadius={handleGlobalRadius} onToggleFacilityType={(type) => patchTrip({ facility_types: trip.facility_types.includes(type) ? trip.facility_types.filter((item) => item !== type) : [...trip.facility_types, type] })} onSaveTrip={() => patchTrip({ trip_status: hasRequiredAirports ? 'Planned' : 'Draft' })} onScanAll={scanAllStops} /> : null}
      {activeTab === 'stops' ? <AirportStopsTab trip={trip} stopFacilities={stopFacilities} stopRisks={stopRisks} scanningStopId={scanningStopId} onScanStop={scanStop} onUpdateStop={updateStop} onUpdateRadius={(stopId, radius) => setStops(updateAirportStopRadius(trip.airports, stopId, radius))} onRemoveStop={(stopId) => setStops(removeAirportStop(trip.airports, stopId))} onMoveStop={(stopId, direction) => setStops(moveIntermediateStop(trip.airports, stopId, direction))} onChangeAirport={(stop, airport) => setStops(trip.airports.map((item) => item.stop_id === stop.stop_id ? { ...airportToStop(airport, stop.stop_type, stop.sequence, stop.radius_miles), stop_id: stop.stop_id, scan_status: 'Needs Refresh' } : item))} onViewLocations={(stopId) => { setSelectedStopFilter(stopId); setActiveTab('locations'); }} onViewRisk={() => setActiveTab('risk')} /> : null}
      {activeTab === 'map' ? <RouteMapTab trip={trip} stopFacilities={stopFacilities} selectedMap={selectedMap} selectedStopId={selectedStopFilter} onSelectStop={setSelectedStopFilter} onToggleFacility={toggleFacility} /> : null}
      {activeTab === 'locations' ? <WalmartLocationsTab rows={filteredRows} stops={trip.airports} selectedStopFilter={selectedStopFilter} riskFilter={riskFilter} selectedOnly={selectedOnly} search={facilitySearch} onStopFilter={setSelectedStopFilter} onRiskFilter={setRiskFilter} onSelectedOnly={setSelectedOnly} onSearch={setFacilitySearch} onToggleFacility={toggleFacility} onUpdateSelection={updateSelection} onSelectSupport={() => selectByPredicate((facility) => facility.aviation_support_candidate)} onSelectHighRisk={() => selectByPredicate((facility) => ['High', 'Critical'].includes(facility.facility_risk_band))} onClearSelections={() => patchTrip({ selected_facilities: [] })} /> : null}
      {activeTab === 'risk' ? <AirportRiskTab trip={trip} stopRisks={stopRisks} stopFacilities={stopFacilities} stopFaaAlerts={stopFaaAlerts} stopWeatherAlerts={stopWeatherAlerts} overallRisk={overallRisk} /> : null}
      {activeTab === 'actions' ? <ReadinessActionsTab trip={trip} rows={allFacilityRows} stopRisks={stopRisks} /> : null}
      {activeTab === 'report' ? <ReportTab payload={reportPayload} messages={reportMessages} generated={generatedReport} allowNoLocations={allowNoLocationsReport} copyMessage={copyMessage} onAllowNoLocations={setAllowNoLocationsReport} onGenerate={() => { setGeneratedReport(true); patchTrip({ trip_status: 'Report Generated' }); }} onCopyText={() => copyText(renderMultiAirportTravelRiskReportText(reportPayload), 'Plain-text report copied.')} onCopyHtml={() => copyText(renderMultiAirportTravelRiskReportHtml(reportPayload), 'HTML report copied.')} onDownload={() => downloadMultiAirportReportHtml(reportPayload)} onPrint={printReport} onEmail={() => prepareMultiAirportRiskEmail(reportPayload)} /> : null}
      {activeTab === 'demo' ? <DemoTab onLaunch={async () => { await launchDemoTrip(setTrip); setActiveTab('planner'); }} /> : null}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) { return <article className="aviation-summary-card"><span>{label}</span><strong>{value}</strong></article>; }

function TripPlannerTab({ trip, facilityTypes, startStop, endStop, hasRequiredAirports, scanning, onPatchTrip, onSetStart, onSetEnd, onAddIntermediate, onGlobalRadius, onToggleFacilityType, onSaveTrip, onScanAll }: { trip: AviationMultiAirportTrip; facilityTypes: string[]; startStop: AviationTripAirportStop | null; endStop: AviationTripAirportStop | null; hasRequiredAirports: boolean; scanning: boolean; onPatchTrip: (updates: Partial<AviationMultiAirportTrip>) => void; onSetStart: (airport: Airport) => void; onSetEnd: (airport: Airport) => void; onAddIntermediate: (airport: Airport) => void; onGlobalRadius: (radius: number) => void; onToggleFacilityType: (type: string) => void; onSaveTrip: () => void; onScanAll: () => void }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Trip Planner</p><h2>Create or select a trip</h2></div><span className="mode-pill">Risk {trip.overall_risk_band ?? 'Pending'}</span></div><p className="aviation-empty">{hasRequiredAirports ? 'Starting and ending airports are selected. Add intermediate airports if the trip has additional stops.' : 'Create a trip by selecting a starting airport and ending airport. Add intermediate airports if the trip has additional stops.'}</p><div className="aviation-detail-grid"><label>Trip name<input className="aviation-input" value={trip.trip_name} onChange={(event) => onPatchTrip({ trip_name: event.target.value })} placeholder="Name this aviation readiness trip" /></label><label>Traveler type<select className="aviation-input" value={trip.traveler_type} onChange={(event) => onPatchTrip({ traveler_type: event.target.value as AviationTravelerType })}><option>Executive</option><option>Crew</option><option>Support</option><option>Field / Security</option></select></label><label>Trip start<input className="aviation-input" type="datetime-local" value={trip.trip_start} onChange={(event) => onPatchTrip({ trip_start: event.target.value })} /></label><label>Trip end<input className="aviation-input" type="datetime-local" value={trip.trip_end} onChange={(event) => onPatchTrip({ trip_end: event.target.value })} /></label></div><RadiusSelector radiusMiles={trip.default_radius_miles} onChange={onGlobalRadius} /><section className="aviation-detail-grid"><div><p className="eyebrow">Starting airport</p><AirportSearch selectedAirport={startStop ? stopToSearchAirport(startStop) : null} onSelectAirport={onSetStart} /></div><div><p className="eyebrow">Ending airport</p><AirportSearch selectedAirport={endStop ? stopToSearchAirport(endStop) : null} onSelectAirport={onSetEnd} /></div><div><p className="eyebrow">Add intermediate airport</p><AirportSearch selectedAirport={null} onSelectAirport={onAddIntermediate} /></div></section><section className="panel aviation-panel compact"><p className="eyebrow">Facility type filters</p><div className="aviation-filter-row"><button type="button" className={trip.facility_types.length === 0 ? 'aviation-filter-chip active' : 'aviation-filter-chip'} onClick={() => onPatchTrip({ facility_types: [] })}>All Walmart facility types</button>{facilityTypes.map((type) => <button key={type} type="button" className={trip.facility_types.includes(type) ? 'aviation-filter-chip active' : 'aviation-filter-chip'} onClick={() => onToggleFacilityType(type)}>{type}</button>)}</div></section><div className="aviation-button-row"><button className="ops-action-button" disabled={!trip.trip_name.trim() || !hasRequiredAirports} onClick={onSaveTrip}>Save Trip</button><button className="ops-action-button" disabled={!hasRequiredAirports || scanning} onClick={onScanAll}>{scanning ? 'Scanning...' : 'Run Full Trip Scan'}</button></div></section>;
}

function stopToSearchAirport(stop: AviationTripAirportStop): Airport { return { airport_id: stop.airport_id, airport_name: stop.airport_name, faa_id: stop.faa_id, iata_code: stop.iata_code, icao_code: stop.icao_code, city: stop.city, state: stop.state, latitude: stop.latitude, longitude: stop.longitude, status: 'active', source_freshness: 'seeded_demo', last_updated: new Date().toISOString() }; }

function AirportStopsTab({ trip, stopFacilities, stopRisks, scanningStopId, onScanStop, onUpdateStop, onUpdateRadius, onRemoveStop, onMoveStop, onChangeAirport, onViewLocations, onViewRisk }: { trip: AviationMultiAirportTrip; stopFacilities: StopDataMap<FacilityWithDistance>; stopRisks: Record<string, AviationAirportRisk>; scanningStopId: string | null; onScanStop: (stop: AviationTripAirportStop) => void; onUpdateStop: (stopId: string, update: Partial<AviationTripAirportStop>) => void; onUpdateRadius: (stopId: string, radius: number) => void; onRemoveStop: (stopId: string) => void; onMoveStop: (stopId: string, direction: -1 | 1) => void; onChangeAirport: (stop: AviationTripAirportStop, airport: Airport) => void; onViewLocations: (stopId: string) => void; onViewRisk: () => void }) {
  if (!trip.airports.length) return <section className="panel aviation-panel"><p className="aviation-empty">Select starting and ending airports to build the trip route.</p></section>;
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Airport Stops</p><h2>Route timeline</h2></div></div><div className="aviation-stop-timeline">{trip.airports.map((stop, index) => { const risk = stopRisks[stop.stop_id] ?? emptyRisk(); return <article className="aviation-selected-card" key={stop.stop_id}><span className="eyebrow">{stop.stop_type} · Stop {stop.sequence}</span><strong>{stop.airport_name}</strong><span>{stop.city}, {stop.state} · {codeForStop(stop)}</span><span>Radius: <input className="aviation-input" type="number" min={1} max={250} value={stop.radius_miles} onChange={(event) => onUpdateRadius(stop.stop_id, Number(event.target.value))} /> miles</span><div className="aviation-detail-grid"><label>Arrival<input className="aviation-input" type="datetime-local" value={stop.arrival_time ?? ''} onChange={(event) => onUpdateStop(stop.stop_id, { arrival_time: event.target.value })} /></label><label>Departure<input className="aviation-input" type="datetime-local" value={stop.departure_time ?? ''} onChange={(event) => onUpdateStop(stop.stop_id, { departure_time: event.target.value })} /></label><span>Scan status: <strong>{stop.scan_status}</strong></span><span>Walmart found: <strong>{(stopFacilities[stop.stop_id] ?? []).length}</strong></span><span>Walmart selected: <strong>{stop.selected_facility_ids.length}</strong></span><span>FAA watch: <strong>{stop.faa_watch_count ?? 0}</strong></span><span>NOAA weather: <strong>{stop.weather_alert_count ?? 0}</strong></span><span>Risk: <strong style={{ color: riskColor[risk.band] }}>{risk.band} {risk.band !== 'Pending' ? `· ${risk.score}` : ''}</strong></span></div><details><summary>Change airport</summary><AirportSearch selectedAirport={stopToSearchAirport(stop)} onSelectAirport={(airport) => onChangeAirport(stop, airport)} /></details><div className="aviation-button-row"><button className="ops-action-button" onClick={() => onScanStop(stop)} disabled={scanningStopId === stop.stop_id}>{scanningStopId === stop.stop_id ? 'Scanning...' : 'Scan This Airport'}</button><button className="ops-action-button secondary" onClick={() => onViewLocations(stop.stop_id)}>View Nearby Walmart Locations</button><button className="ops-action-button secondary" onClick={onViewRisk}>View Airport Risk</button>{stop.stop_type === 'Intermediate' ? <><button className="ops-action-button secondary" disabled={index <= 1} onClick={() => onMoveStop(stop.stop_id, -1)}>Move Up</button><button className="ops-action-button secondary" disabled={index >= trip.airports.length - 2} onClick={() => onMoveStop(stop.stop_id, 1)}>Move Down</button><button className="ops-action-button danger" onClick={() => onRemoveStop(stop.stop_id)}>Remove Stop</button></> : null}</div></article>; })}</div></section>;
}

function RouteMapTab({ trip, stopFacilities, selectedMap, selectedStopId, onSelectStop, onToggleFacility }: { trip: AviationMultiAirportTrip; stopFacilities: StopDataMap<FacilityWithDistance>; selectedMap: Map<string, AviationSelectedFacility>; selectedStopId: string; onSelectStop: (stopId: string) => void; onToggleFacility: (stop: AviationTripAirportStop, facility: FacilityWithDistance, selected: boolean) => void }) {
  const stops = selectedStopId === 'all' ? trip.airports : trip.airports.filter((stop) => stop.stop_id === selectedStopId);
  if (!trip.airports.length) return <section className="panel aviation-panel"><p className="aviation-empty">Select starting and ending airports to build the trip map.</p></section>;
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Radius Map</p><h2>Route, radius rings, and Walmart locations</h2></div><select className="aviation-input" value={selectedStopId} onChange={(event) => onSelectStop(event.target.value)}><option value="all">All airports</option>{trip.airports.map((stop) => <option key={stop.stop_id} value={stop.stop_id}>{stop.sequence}. {codeForStop(stop)}</option>)}</select></div><div className="aviation-route-map-canvas"><svg viewBox="0 0 100 54" role="img" aria-label="Simplified aviation route map">{trip.airports.length > 1 ? <polyline points={trip.airports.map((_, index) => `${10 + index * (80 / Math.max(1, trip.airports.length - 1))},20`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2 1" /> : null}{trip.airports.map((stop, index) => <g key={stop.stop_id}><circle cx={10 + index * (80 / Math.max(1, trip.airports.length - 1))} cy="20" r={Math.max(4, Math.min(18, stop.radius_miles / 6))} fill="rgba(37,99,235,.08)" stroke="rgba(37,99,235,.4)" /><circle cx={10 + index * (80 / Math.max(1, trip.airports.length - 1))} cy="20" r="2.2" fill={stop.stop_type === 'Start' ? '#16a34a' : stop.stop_type === 'End' ? '#dc2626' : '#2563eb'} /><text x={10 + index * (80 / Math.max(1, trip.airports.length - 1))} y="15" textAnchor="middle" fontSize="3">{stop.stop_type === 'Start' ? 'Start' : stop.stop_type === 'End' ? 'End' : `Stop ${stop.sequence}`}</text><text x={10 + index * (80 / Math.max(1, trip.airports.length - 1))} y="27" textAnchor="middle" fontSize="3">{codeForStop(stop)}</text></g>)}</svg></div><div className="aviation-location-grid">{stops.flatMap((stop) => (stopFacilities[stop.stop_id] ?? []).map((facility) => ({ stop, facility }))).map(({ stop, facility }) => { const selected = selectedMap.has(selectionKey(stop.stop_id, facility.facility_id)); return <article key={`${stop.stop_id}-${facility.facility_id}`} className="aviation-selected-card"><span className="eyebrow">{codeForStop(stop)} · {facility.distance_miles.toFixed(1)} mi</span><strong>{facility.facility_name} #{facility.facility_number}</strong><span>{facility.facility_type} · {facility.city}, {facility.state}</span><span style={{ color: riskColor[facility.facility_risk_band] }}>Risk {facility.facility_risk_band} · EP {facility.ep_readiness_status} · Weather {facility.weather_exposure}</span><span>{facility.recommended_action}</span><button className={selected ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => onToggleFacility(stop, facility, !selected)}>{selected ? 'Deselect' : 'Select'} for report</button></article>; })}</div>{trip.airports.some((stop) => stop.scan_status === 'Not Scanned') ? <p className="aviation-empty">Airports selected but not all scanned. Airport markers and radius context are available; run scans to show Walmart facility markers.</p> : null}</section>;
}

function WalmartLocationsTab({ rows, stops, selectedStopFilter, riskFilter, selectedOnly, search, onStopFilter, onRiskFilter, onSelectedOnly, onSearch, onToggleFacility, onUpdateSelection, onSelectSupport, onSelectHighRisk, onClearSelections }: { rows: Array<{ stop: AviationTripAirportStop; facility: FacilityWithDistance; selection?: AviationSelectedFacility }>; stops: AviationTripAirportStop[]; selectedStopFilter: string; riskFilter: string; selectedOnly: boolean; search: string; onStopFilter: (value: string) => void; onRiskFilter: (value: string) => void; onSelectedOnly: (value: boolean) => void; onSearch: (value: string) => void; onToggleFacility: (stop: AviationTripAirportStop, facility: FacilityWithDistance, selected: boolean) => void; onUpdateSelection: (stop: AviationTripAirportStop, facility: FacilityWithDistance, updates: Partial<AviationSelectedFacility>) => void; onSelectSupport: () => void; onSelectHighRisk: () => void; onClearSelections: () => void }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Walmart Locations</p><h2>Operational selection table</h2></div></div><div className="aviation-detail-grid"><select className="aviation-input" value={selectedStopFilter} onChange={(event) => onStopFilter(event.target.value)}><option value="all">All airport stops</option>{stops.map((stop) => <option key={stop.stop_id} value={stop.stop_id}>{stop.sequence}. {codeForStop(stop)} · {stop.stop_type}</option>)}</select><select className="aviation-input" value={riskFilter} onChange={(event) => onRiskFilter(event.target.value)}><option value="all">All risk bands</option>{riskBands.map((band) => <option key={band}>{band}</option>)}</select><label><input type="checkbox" checked={selectedOnly} onChange={(event) => onSelectedOnly(event.target.checked)} /> Selected only</label><input className="aviation-input" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search facility name, number, city, or state" /></div><div className="aviation-button-row"><button className="ops-action-button secondary" onClick={onSelectSupport}>Select all support/staging</button><button className="ops-action-button secondary" onClick={onSelectHighRisk}>Select all high-risk verification</button><button className="ops-action-button secondary" onClick={onClearSelections}>Clear selections</button></div>{rows.length === 0 ? <p className="aviation-empty">No Walmart locations selected. Select locations to include in the Travel Risk Report.</p> : <div className="aviation-table-wrap"><table className="aviation-data-table"><thead><tr><th>Select</th><th>Airport stop</th><th>Facility</th><th>Facility type</th><th>City/state</th><th>Distance</th><th>Facility risk</th><th>EP readiness</th><th>Weather</th><th>Recommended role</th><th>Recommended action / note</th></tr></thead><tbody>{rows.map(({ stop, facility, selection }) => <tr key={`${stop.stop_id}-${facility.facility_id}`}><td><input type="checkbox" checked={Boolean(selection)} onChange={(event) => onToggleFacility(stop, facility, event.target.checked)} /></td><td>{stop.sequence}. {codeForStop(stop)}</td><td>{facility.facility_name} #{facility.facility_number}</td><td>{facility.facility_type}</td><td>{facility.city}, {facility.state}</td><td>{facility.distance_miles.toFixed(1)} mi</td><td><span style={{ color: riskColor[facility.facility_risk_band] }}>{facility.facility_risk_band}</span></td><td>{facility.ep_readiness_status}</td><td>{facility.weather_exposure}</td><td><select className="aviation-input" value={selection?.recommended_role ?? 'Monitor'} onChange={(event) => onUpdateSelection(stop, facility, { recommended_role: event.target.value as AviationSelectedFacility['recommended_role'] })}><option>Support / Staging</option><option>Monitor</option><option>Verification Required</option><option>Avoid</option><option>Visit Site</option></select></td><td>{facility.recommended_action}<input className="aviation-input" value={selection?.selection_reason ?? ''} onChange={(event) => onUpdateSelection(stop, facility, { selection_reason: event.target.value })} placeholder="Selection note or reason" /></td></tr>)}</tbody></table></div>}</section>;
}

function AirportRiskTab({ trip, stopRisks, stopFacilities, stopFaaAlerts, stopWeatherAlerts, overallRisk }: { trip: AviationMultiAirportTrip; stopRisks: Record<string, AviationAirportRisk>; stopFacilities: StopDataMap<FacilityWithDistance>; stopFaaAlerts: StopDataMap<FAAAlert>; stopWeatherAlerts: StopDataMap<WeatherAlert>; overallRisk: AviationAirportRisk }) {
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Airport Risk</p><h2>Overall and per-airport risk</h2></div><span className="mode-pill">{overallRisk.band} {overallRisk.band !== 'Pending' ? overallRisk.score : ''}</span></div><div className="aviation-summary-cards"><SummaryTile label="Overall trip risk" value={overallRisk.band} /><SummaryTile label="Overall score" value={overallRisk.band === 'Pending' ? 'Pending' : overallRisk.score} /><SummaryTile label="Confidence" value={overallRisk.confidence ? `${overallRisk.confidence}%` : 'Pending'} /></div>{overallRisk.band === 'Pending' ? <p className="aviation-empty">Risk remains Pending until at least one airport radius scan runs.</p> : null}<div className="aviation-location-grid">{trip.airports.map((stop) => { const risk = stopRisks[stop.stop_id] ?? emptyRisk(); const facilities = stopFacilities[stop.stop_id] ?? []; return <article key={stop.stop_id} className="aviation-selected-card"><span className="eyebrow">{stop.stop_type} · {codeForStop(stop)}</span><strong style={{ color: riskColor[risk.band] }}>{risk.band} {risk.band !== 'Pending' ? `· ${risk.score}` : ''}</strong><span>FAA watch items: {(stopFaaAlerts[stop.stop_id] ?? []).length}</span><span>NOAA weather alerts: {(stopWeatherAlerts[stop.stop_id] ?? []).length}</span><span>Facilities in radius: {facilities.length}</span><span>Selected Walmart exposure: {stop.selected_facility_ids.length}</span><ul>{risk.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul></article>; })}</div></section>;
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
