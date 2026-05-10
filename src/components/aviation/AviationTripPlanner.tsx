import { AirportSearch } from './AirportSearch';
import { RadiusSelector } from './RadiusSelector';
import type { Airport, AviationUserRole } from '../../types/aviation';

export function AviationTripPlanner({
  role,
  selectedAirport,
  tripName,
  tripStart,
  tripEnd,
  radiusMiles,
  facilityTypes,
  selectedFacilityTypes,
  notes,
  onAirportSelect,
  onTripNameChange,
  onTripStartChange,
  onTripEndChange,
  onRadiusChange,
  onToggleFacilityType,
  onNotesChange,
  onSaveTrip,
  onRunScan,
  onGenerateRisk,
  onGenerateActions,
  onGenerateBrief,
}: {
  role: AviationUserRole;
  selectedAirport: Airport | null;
  tripName: string;
  tripStart: string;
  tripEnd: string;
  radiusMiles: number;
  facilityTypes: string[];
  selectedFacilityTypes: string[];
  notes: string;
  onAirportSelect: (airport: Airport) => void;
  onTripNameChange: (value: string) => void;
  onTripStartChange: (value: string) => void;
  onTripEndChange: (value: string) => void;
  onRadiusChange: (value: number) => void;
  onToggleFacilityType: (type: string) => void;
  onNotesChange: (value: string) => void;
  onSaveTrip: () => void;
  onRunScan: () => void;
  onGenerateRisk: () => void;
  onGenerateActions: () => void;
  onGenerateBrief: () => void;
}) {
  return (
    <div className="aviation-planner-grid">
      <section className="panel aviation-panel aviation-planner-main">
        <div className="card-heading"><div><p className="eyebrow">Flight / Trip Planner</p><h3>Create Aviation Readiness Plan</h3></div><span className="mode-pill">{role.split('_').join(' ')}</span></div>
        <label>Trip Name<input className="aviation-input" value={tripName} onChange={(event) => onTripNameChange(event.target.value)} placeholder="Executive regional airport trip" /></label>
        <div className="aviation-detail-grid">
          <label>Trip Start<input className="aviation-input" type="datetime-local" value={tripStart} onChange={(event) => onTripStartChange(event.target.value)} /></label>
          <label>Trip End<input className="aviation-input" type="datetime-local" value={tripEnd} onChange={(event) => onTripEndChange(event.target.value)} /></label>
        </div>
        <label>Traveler / Mission Type<select className="aviation-input"><option>Executive visit / aviation support</option><option>Security assessment</option><option>Operational support</option><option>Training / stakeholder demo</option></select></label>
        <label>Operational Purpose<textarea className="aviation-input" value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Optional non-sensitive operational notes. Do not enter traveler identity or sensitive itinerary details." /></label>
        <div className="aviation-button-row"><button className="ops-action-button" onClick={onSaveTrip} disabled={!selectedAirport}>Save Trip Plan</button><button className="ops-action-button secondary" onClick={onRunScan} disabled={!selectedAirport}>Run Airport Scan</button><button className="ops-action-button secondary" onClick={onGenerateRisk}>Generate Risk Assessment</button><button className="ops-action-button secondary" onClick={onGenerateActions}>Generate Readiness Actions</button><button className="ops-action-button secondary" onClick={onGenerateBrief}>Generate Brief</button></div>
      </section>

      <aside className="aviation-planner-side">
        <AirportSearch selectedAirport={selectedAirport} onSelectAirport={onAirportSelect} />
        {selectedAirport ? <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Selected destination airport</p><h3>{selectedAirport.airport_name}</h3></div></div><p>{selectedAirport.city}, {selectedAirport.state} • {selectedAirport.faa_id ?? selectedAirport.iata_code ?? 'No code'}</p><p className="aviation-caveat">Airport selected. Next recommended step: run an airport radius scan.</p></section> : <section className="panel aviation-panel"><p className="aviation-empty">No selected airport. Select an airport to begin an aviation readiness scan.</p></section>}
        <RadiusSelector radiusMiles={radiusMiles} onChange={onRadiusChange} />
        <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Facility filters</p><h3>Facility Types</h3></div></div><div className="aviation-chip-list">{facilityTypes.map((type) => <button key={type} type="button" className={selectedFacilityTypes.includes(type) ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => onToggleFacilityType(type)}>{type}</button>)}</div></section>
      </aside>
    </div>
  );
}
