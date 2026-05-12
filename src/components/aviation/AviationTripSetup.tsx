import { AirportSearch } from './AirportSearch';
import { RadiusSelector } from './RadiusSelector';
import type { Airport, AviationTravelerType } from '../../types/aviation';

const riskDomainOptions = ['FAA', 'Weather', 'Facility', 'Executive Protection', 'Incident/Safety', 'Support/Vendor', 'Data freshness'];

export function AviationTripSetup({
  airport,
  radiusMiles,
  tripStart,
  tripEnd,
  facilityTypes,
  selectedFacilityTypes,
  travelerType,
  riskDomains,
  scanDisabled,
  scanning,
  scanIsStale,
  onSelectAirport,
  onRadiusChange,
  onTripStartChange,
  onTripEndChange,
  onToggleFacilityType,
  onSelectAllFacilityTypes,
  onTravelerTypeChange,
  onToggleRiskDomain,
  onRunScan,
}: {
  airport: Airport | null;
  radiusMiles: number;
  tripStart: string;
  tripEnd: string;
  facilityTypes: string[];
  selectedFacilityTypes: string[];
  travelerType: AviationTravelerType;
  riskDomains: string[];
  scanDisabled: boolean;
  scanning: boolean;
  scanIsStale: boolean;
  onSelectAirport: (airport: Airport) => void;
  onRadiusChange: (radiusMiles: number) => void;
  onTripStartChange: (value: string) => void;
  onTripEndChange: (value: string) => void;
  onToggleFacilityType: (type: string) => void;
  onSelectAllFacilityTypes: () => void;
  onTravelerTypeChange: (value: AviationTravelerType) => void;
  onToggleRiskDomain: (domain: string) => void;
  onRunScan: () => void;
}) {
  return (
    <section className="aviation-trip-setup-grid" aria-label="Trip setup">
      <AirportSearch selectedAirport={airport} onSelectAirport={onSelectAirport} />
      <RadiusSelector radiusMiles={radiusMiles} airportCode={airport?.iata_code ?? airport?.faa_id} scanIsStale={scanIsStale} onChange={onRadiusChange} />
      <section className="panel aviation-panel aviation-trip-setup-details">
        <div className="card-heading">
          <div><p className="eyebrow">Plan Trip</p><h3>Trip window and mission filters</h3></div>
          <span className="mode-pill">Demo / Seeded Data</span>
        </div>
        <div className="aviation-detail-grid">
          <label>Trip Start<input className="aviation-input aviation-date-time-input" type="datetime-local" value={tripStart} onChange={(event) => onTripStartChange(event.target.value)} /></label>
          <label>Trip End<input className="aviation-input aviation-date-time-input" type="datetime-local" value={tripEnd} onChange={(event) => onTripEndChange(event.target.value)} /></label>
          <label>Traveler Type<select className="aviation-input" value={travelerType} onChange={(event) => onTravelerTypeChange(event.target.value as AviationTravelerType)}><option>Executive</option><option>Crew</option><option>Support</option><option>Field / Security</option></select></label>
        </div>
        <div className="aviation-field-group">
          <p className="eyebrow">Facility Types</p>
          <div className="aviation-filter-row">
            <button type="button" className={selectedFacilityTypes.length === 0 ? 'aviation-filter-chip selected' : 'aviation-filter-chip'} onClick={onSelectAllFacilityTypes}>All</button>
            {facilityTypes.map((type) => <button key={type} type="button" className={selectedFacilityTypes.includes(type) ? 'aviation-filter-chip selected' : 'aviation-filter-chip'} onClick={() => onToggleFacilityType(type)}>{type}</button>)}
          </div>
        </div>
        <div className="aviation-field-group">
          <p className="eyebrow">Risk Domains</p>
          <div className="aviation-filter-row">
            {riskDomainOptions.map((domain) => <button key={domain} type="button" className={riskDomains.includes(domain) ? 'aviation-filter-chip selected' : 'aviation-filter-chip'} onClick={() => onToggleRiskDomain(domain)}>{domain}</button>)}
          </div>
        </div>
        <button type="button" className="ops-action-button aviation-primary-scan-button" disabled={scanDisabled || scanning} onClick={onRunScan}>{scanning ? 'Running aviation readiness scan...' : 'Run Aviation Readiness Scan'}</button>
      </section>
    </section>
  );
}
