import { useMemo, useState } from 'react';
import type { FacilityScopeState } from '../data/fpiScope';
import { createAllFacilitiesScope, createSelectedFacilitiesScope, getFacilityScopeSummary } from '../data/fpiScope';
import type { FpiDashboardMetrics, FpiFacility } from '../data/fpiTypes';

export type FacilityScopeSelectorProps = {
  facilities: FpiFacility[];
  scope: FacilityScopeState;
  metrics: FpiDashboardMetrics | null;
  onScopeChange: (nextScope: FacilityScopeState) => void;
};

export function FacilityScopeSelector({ facilities, scope, metrics, onScopeChange }: FacilityScopeSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const selectedIds = useMemo(() => new Set(scope.selectedFacilityIds), [scope.selectedFacilityIds]);
  const filteredFacilities = useMemo(
    () => filterFacilities(facilities, searchTerm),
    [facilities, searchTerm],
  );
  const summary = getFacilityScopeSummary(scope, facilities.length);

  function toggleFacility(facilityId: string) {
    const nextIds = new Set(scope.mode === 'all' ? facilities.map((facility) => facility.facilityId) : scope.selectedFacilityIds);

    if (nextIds.has(facilityId)) {
      nextIds.delete(facilityId);
    } else {
      nextIds.add(facilityId);
    }

    onScopeChange(createSelectedFacilitiesScope(Array.from(nextIds)));
  }

  return (
    <section className="panel facility-scope-panel" aria-labelledby="facility-scope-title">
      <div className="facility-scope-heading">
        <div>
          <p className="eyebrow">Facility Scope</p>
          <h2 id="facility-scope-title">{summary}</h2>
          <p>The dashboard and selected service metrics reflect this current store/facility population.</p>
        </div>
        <div className="facility-scope-actions" aria-label="Facility scope actions">
          <button type="button" onClick={() => onScopeChange(createAllFacilitiesScope())}>
            Select All
          </button>
          <button type="button" onClick={() => onScopeChange(createSelectedFacilitiesScope([]))}>
            Clear Selection
          </button>
        </div>
      </div>

      <div className="scope-summary-grid" aria-label="Current facility scope metrics">
        <ScopeMetric label="Current scope" value={scope.mode === 'all' ? 'All facilities' : 'Selected facilities'} />
        <ScopeMetric label="Facilities included" value={metrics?.facilitiesProfiled ?? 0} />
        <ScopeMetric label="Critical exceptions" value={metrics?.criticalExceptions ?? 0} />
        <ScopeMetric label="Active signals" value={metrics?.activeSignals ?? 0} />
        <ScopeMetric label="Open work items" value={metrics?.activeWorkQueue ?? 0} />
      </div>

      <label className="facility-search-label" htmlFor="facility-scope-search">
        Search facilities
      </label>
      <input
        id="facility-scope-search"
        className="facility-search-input"
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search by facility name, ID, market, city, or state"
      />

      <div className="facility-checkbox-list" aria-label="Facilities">
        {filteredFacilities.length > 0 ? (
          filteredFacilities.map((facility) => {
            const checked = scope.mode === 'all' || selectedIds.has(facility.facilityId);
            return (
              <label className="facility-checkbox-row" key={facility.facilityId}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFacility(facility.facilityId)}
                />
                <span>
                  <strong>{facility.facilityName}</strong>
                  <small>
                    {facility.facilityId} • {facility.region} • {facility.market} • {facility.city}, {facility.state} •{' '}
                    {facility.riskTier}
                  </small>
                </span>
              </label>
            );
          })
        ) : (
          <p className="facility-scope-empty">No facilities match the current search.</p>
        )}
      </div>
    </section>
  );
}

function ScopeMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function filterFacilities(facilities: FpiFacility[], searchTerm: string): FpiFacility[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return facilities;

  return facilities.filter((facility) =>
    [facility.facilityName, facility.facilityId, facility.market, facility.region, facility.city, facility.state]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch),
  );
}
