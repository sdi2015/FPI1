export type FacilityTypeFilterProps = {
  facilityTypes: string[];
  selectedFacilityTypes: string[];
  countsByType?: Record<string, number>;
  onToggleFacilityType: (type: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

export function FacilityTypeFilter({ facilityTypes, selectedFacilityTypes, countsByType = {}, onToggleFacilityType, onSelectAll, onClearAll }: FacilityTypeFilterProps) {
  const allSelected = selectedFacilityTypes.length === 0;
  return (
    <section className="panel aviation-panel aviation-filter-panel" aria-labelledby="facility-type-filter-title">
      <div className="card-heading compact-heading">
        <div>
          <p className="eyebrow">Walmart facility filters</p>
          <h3 id="facility-type-filter-title">Facility types</h3>
        </div>
        <span className="mode-pill">{allSelected ? 'All Walmart Facilities' : `${selectedFacilityTypes.length} selected`}</span>
      </div>
      <div className="aviation-button-row aviation-filter-actions">
        <button type="button" className={allSelected ? 'ops-action-button' : 'ops-action-button secondary'} onClick={onSelectAll}>All Walmart Facilities</button>
        <button type="button" className="ops-action-button secondary" onClick={onClearAll}>Deselect all</button>
      </div>
      <div className="aviation-chip-list aviation-type-chip-list" role="group" aria-label="Facility type filters">
        {facilityTypes.map((type) => {
          const selected = allSelected || selectedFacilityTypes.includes(type);
          const count = countsByType[type] ?? 0;
          return (
            <button key={type} type="button" className={selected ? 'aviation-filter-chip selected' : 'aviation-filter-chip'} aria-pressed={selected} onClick={() => onToggleFacilityType(type)}>
              <span>{type}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
