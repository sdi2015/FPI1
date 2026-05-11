import { AirportSearch } from './AirportSearch';
import { FacilityRadiusMap } from './FacilityRadiusMap';
import { FacilityTypeFilter } from './FacilityTypeFilter';
import { NearbyFacilitiesTable } from './NearbyFacilitiesTable';
import { RadiusSelector } from './RadiusSelector';
import type { Airport, FacilitySortMode, FacilityWithDistance } from '../../types/aviation';

export function AviationAirportScanner({ selectedAirport, radiusMiles, facilityTypes, selectedFacilityTypes, nearbyFacilities, selectedFacilityId, canViewEPReadiness, sortMode, lastScannedAt, scanning, tripStart = '', tripEnd = '', travelerType = 'Executive', riskDomains = [], onAirportSelect, onRadiusChange, onToggleFacilityType, onSelectAllFacilityTypes, onClearFacilityTypes, onSortChange, onScan, onClearScan, onSaveTrip, onGenerateRisk, onGenerateBrief, onFacilitySelect, onTripStartChange = () => undefined, onTripEndChange = () => undefined, onTravelerTypeChange = () => undefined, onToggleRiskDomain = () => undefined }: { selectedAirport: Airport | null; radiusMiles: number; facilityTypes: string[]; selectedFacilityTypes: string[]; nearbyFacilities: FacilityWithDistance[]; selectedFacilityId: string | null; canViewEPReadiness: boolean; sortMode: FacilitySortMode; lastScannedAt: string | null; scanning: boolean; tripStart?: string; tripEnd?: string; travelerType?: string; riskDomains?: string[]; onAirportSelect: (airport: Airport) => void; onRadiusChange: (value: number) => void; onToggleFacilityType: (type: string) => void; onSelectAllFacilityTypes: () => void; onClearFacilityTypes: () => void; onSortChange: (mode: FacilitySortMode) => void; onScan: () => void; onClearScan: () => void; onSaveTrip: () => void; onGenerateRisk: () => void; onGenerateBrief: () => void; onFacilitySelect: (facility: FacilityWithDistance) => void; onTripStartChange?: (value: string) => void; onTripEndChange?: (value: string) => void; onTravelerTypeChange?: (value: string) => void; onToggleRiskDomain?: (domain: string) => void }) {
  const selectedFacility = nearbyFacilities.find((facility) => facility.facility_id === selectedFacilityId);
  const countsByType = nearbyFacilities.reduce<Record<string, number>>((counts, facility) => ({ ...counts, [facility.facility_type]: (counts[facility.facility_type] ?? 0) + 1 }), {});
  const highRiskCount = nearbyFacilities.filter((facility) => ['Elevated', 'High', 'Critical'].includes(facility.facility_risk_band)).length;
  const epGapCount = nearbyFacilities.filter((facility) => facility.ep_readiness_status === 'Gap').length;
  const closest = nearbyFacilities.reduce<FacilityWithDistance | null>((best, facility) => !best || facility.distance_miles < best.distance_miles ? facility : best, null);
  const bestSupport = nearbyFacilities.find((facility) => facility.aviation_support_candidate) ?? null;
  const highestRisk = nearbyFacilities[0] ?? null;
  const airportCode = selectedAirport?.iata_code ?? selectedAirport?.faa_id ?? selectedAirport?.icao_code;

  return (
    <div className="aviation-scanner-page aviation-operational-scan-page">
      <section className="panel aviation-panel aviation-scan-hero">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Airport Radius Scanner</p>
            <h2>Guided five-step airport readiness scan</h2>
          </div>
          <span className="mode-pill">Operational workflow</span>
        </div>
        <p className="aviation-caveat">No live external APIs are called unless provider config explicitly enables them. Facility scans use seeded/approved local data by default.</p>
      </section>

      <section className="aviation-guided-steps" aria-label="Airport radius scan workflow">
        <div className="aviation-step-card"><span>Step 1</span><AirportSearch selectedAirport={selectedAirport} onSelectAirport={onAirportSelect} /></div>
        <div className="aviation-step-card"><span>Step 2</span><RadiusSelector radiusMiles={radiusMiles} airportCode={airportCode} onChange={onRadiusChange} /></div>
        <section className="panel aviation-panel aviation-step-card"><span>Step 3</span><div className="card-heading"><div><p className="eyebrow">Set trip window</p><h3>Arrival / departure timing</h3></div><span className="mode-pill">Local timezone</span></div><div className="aviation-detail-grid"><label>Trip start<input className="aviation-input" type="datetime-local" value={tripStart} onChange={(event) => onTripStartChange(event.target.value)} /></label><label>Trip end<input className="aviation-input" type="datetime-local" value={tripEnd} onChange={(event) => onTripEndChange(event.target.value)} /></label></div><div className="aviation-button-row"><button className="ops-action-button secondary" onClick={() => { const now = new Date(); onTripStartChange(now.toISOString().slice(0, 16)); }}>Today</button><button className="ops-action-button secondary" onClick={() => { const now = new Date(); const end = new Date(now.getTime() + 24 * 60 * 60 * 1000); onTripStartChange(now.toISOString().slice(0, 16)); onTripEndChange(end.toISOString().slice(0, 16)); }}>Next 24 Hours</button><button className="ops-action-button secondary" onClick={() => { onTripStartChange(''); onTripEndChange(''); }}>Clear trip window</button></div></section>
        <section className="panel aviation-panel aviation-step-card"><span>Step 4</span><FacilityTypeFilter facilityTypes={facilityTypes} selectedFacilityTypes={selectedFacilityTypes} countsByType={countsByType} onToggleFacilityType={onToggleFacilityType} onSelectAll={onSelectAllFacilityTypes} onClearAll={onClearFacilityTypes} /><label className="aviation-custom-radius"><span>Traveler type</span><select className="aviation-input" value={travelerType} onChange={(event) => onTravelerTypeChange(event.target.value)}><option>Executive</option><option>Crew</option><option>Support</option><option>Field / Security</option></select></label><div className="aviation-chip-list">{['FAA', 'Weather', 'Facility', 'Executive Protection', 'Incident', 'Support', 'Data freshness'].map((domain) => <button key={domain} className={riskDomains.includes(domain) ? 'aviation-filter-chip selected' : 'aviation-filter-chip'} onClick={() => onToggleRiskDomain(domain)}>{domain}</button>)}</div></section>
        <section className="panel aviation-panel aviation-step-card"><span>Step 5</span><div className="card-heading"><div><p className="eyebrow">Run scan</p><h3>Airport Radius Scan</h3></div></div><button className="ops-action-button" disabled={!selectedAirport || scanning} onClick={onScan}>{scanning ? 'Scanning...' : 'Run Airport Radius Scan'}</button><p className="aviation-caveat">After scan: airport, radius, facilities, high-risk count, FAA items, weather alerts, timestamp, and confidence are summarized below.</p></section>
      </section>

      <section className="panel aviation-panel aviation-scan-action-bar">
        <div className="aviation-button-row">
          <button className="ops-action-button" disabled={!selectedAirport || scanning} onClick={onScan}>{scanning ? 'Scanning facilities...' : 'Scan Nearby Walmart Facilities'}</button>
          <button className="ops-action-button secondary" onClick={onClearScan}>Clear Scan</button>
          <button className="ops-action-button secondary" disabled={!selectedAirport} onClick={onSaveTrip}>Save Scan as Trip</button>
          <button className="ops-action-button secondary" disabled={!selectedAirport} onClick={onGenerateRisk}>Generate Risk Assessment</button>
          <button className="ops-action-button secondary" disabled={!selectedAirport} onClick={onGenerateBrief}>Generate Brief</button>
        </div>
        <p className="aviation-caveat">{lastScannedAt ? `Last scanned: ${new Date(lastScannedAt).toLocaleString()}` : 'Select an airport and run a scan to populate the map and facility table.'}</p>
      </section>

      <section className="aviation-summary-cards" aria-label="Scan summary cards">
        <SummaryCard label="Facilities Found" value={nearbyFacilities.length} helper={`${highRiskCount} elevated/high risk`} />
        <SummaryCard label="Highest Risk" value={highestRisk ? `${highestRisk.facility_number} — ${highestRisk.facility_risk_band}` : 'N/A'} helper={highestRisk?.top_risk_driver ?? 'Run scan to calculate'} />
        <SummaryCard label="Closest Facility" value={closest ? `${closest.facility_number} — ${closest.distance_miles.toFixed(1)} mi` : 'N/A'} helper={closest?.facility_type ?? 'Run scan to calculate'} />
        <SummaryCard label="Best Support" value={bestSupport ? `${bestSupport.facility_number}` : 'N/A'} helper={bestSupport?.facility_type ?? 'No candidate selected'} />
        <SummaryCard label="Readiness Items" value={epGapCount} helper="EP readiness gaps" />
      </section>

      <section className="aviation-map-and-detail">
        <FacilityRadiusMap airport={selectedAirport} radiusMiles={radiusMiles} facilities={nearbyFacilities} selectedFacilityId={selectedFacilityId} onFacilitySelect={onFacilitySelect} />
        {selectedFacility ? <article className="panel aviation-panel aviation-selected-card"><span className="eyebrow">Selected facility</span><strong>{selectedFacility.facility_name}</strong><span>{selectedFacility.facility_type} • {selectedFacility.city}, {selectedFacility.state}</span><span>{selectedFacility.distance_miles.toFixed(1)} mi • ~{selectedFacility.estimated_drive_time_minutes} min • {selectedFacility.facility_risk_band}</span><span>EP {canViewEPReadiness ? selectedFacility.ep_readiness_status : 'Restricted'} • Support {selectedFacility.aviation_support_candidate ? 'Yes' : 'No'}</span><p>{selectedFacility.recommended_action}</p></article> : <article className="panel aviation-panel"><p className="aviation-empty">Select a facility marker or table row to view operational details.</p></article>}
      </section>

      <NearbyFacilitiesTable facilities={nearbyFacilities} canViewEPReadiness={canViewEPReadiness} sortMode={sortMode} onSortChange={onSortChange} onFacilitySelect={onFacilitySelect} />
      <FlightOperationsPlaceholder />
    </div>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return <article className="panel aviation-panel aviation-summary-card"><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function FlightOperationsPlaceholder() {
  return (
    <section className="panel aviation-panel aviation-flight-placeholder">
      <div className="card-heading"><div><p className="eyebrow">Flight Operations Tracking</p><h3>Future flight-leg integration</h3></div><span className="mode-pill">Placeholder</span></div>
      <p>Live flight tracking is not connected yet. Future integration can support planned flight legs, aircraft status, arrival/departure windows, and aviation operations notes without exposing sensitive traveler information.</p>
      <div className="aviation-placeholder-fields"><span>Flight / Trip ID</span><span>Aircraft / Team optional</span><span>Departure airport</span><span>Destination airport</span><span>ETD / ETA</span><span>Status</span><span>Operational notes</span></div>
    </section>
  );
}
