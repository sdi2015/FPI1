import { AirportSearch } from './AirportSearch';
import { FacilityRadiusMap } from './FacilityRadiusMap';
import { FacilityTypeFilter } from './FacilityTypeFilter';
import { NearbyFacilitiesTable } from './NearbyFacilitiesTable';
import { RadiusSelector } from './RadiusSelector';
import type { Airport, FacilitySortMode, FacilityWithDistance } from '../../types/aviation';

export function AviationAirportScanner({ selectedAirport, radiusMiles, facilityTypes, selectedFacilityTypes, nearbyFacilities, selectedFacilityId, canViewEPReadiness, sortMode, lastScannedAt, scanning, onAirportSelect, onRadiusChange, onToggleFacilityType, onSelectAllFacilityTypes, onClearFacilityTypes, onSortChange, onScan, onClearScan, onSaveTrip, onGenerateRisk, onGenerateBrief, onFacilitySelect }: { selectedAirport: Airport | null; radiusMiles: number; facilityTypes: string[]; selectedFacilityTypes: string[]; nearbyFacilities: FacilityWithDistance[]; selectedFacilityId: string | null; canViewEPReadiness: boolean; sortMode: FacilitySortMode; lastScannedAt: string | null; scanning: boolean; onAirportSelect: (airport: Airport) => void; onRadiusChange: (value: number) => void; onToggleFacilityType: (type: string) => void; onSelectAllFacilityTypes: () => void; onClearFacilityTypes: () => void; onSortChange: (mode: FacilitySortMode) => void; onScan: () => void; onClearScan: () => void; onSaveTrip: () => void; onGenerateRisk: () => void; onGenerateBrief: () => void; onFacilitySelect: (facility: FacilityWithDistance) => void }) {
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
            <p className="eyebrow">Airport Facility Scan</p>
            <h2>Search airport, select radius, choose Walmart facility types</h2>
          </div>
          <span className="mode-pill">Operational workflow</span>
        </div>
        <p className="aviation-caveat">No live external APIs are called unless provider config explicitly enables them. Facility scans use seeded/approved local data by default.</p>
      </section>

      <section className="aviation-scan-controls-grid" aria-label="Airport facility scan controls">
        <AirportSearch selectedAirport={selectedAirport} onSelectAirport={onAirportSelect} />
        <RadiusSelector radiusMiles={radiusMiles} airportCode={airportCode} onChange={onRadiusChange} />
        <FacilityTypeFilter facilityTypes={facilityTypes} selectedFacilityTypes={selectedFacilityTypes} countsByType={countsByType} onToggleFacilityType={onToggleFacilityType} onSelectAll={onSelectAllFacilityTypes} onClearAll={onClearFacilityTypes} />
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
