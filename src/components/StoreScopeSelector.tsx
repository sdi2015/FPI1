import { useMemo, useState } from 'react';
import type { FireAlarmSite } from '../data/fireAlarmTypes';
import {
  createAllStoresScope,
  createRegionStoreScope,
  createSelectedStoresScope,
  getRegionsFromSites,
  getStoreScopeSummary,
  type StoreScopeState,
} from '../data/storeScope';

export type StoreScopeSelectorProps = {
  sites: FireAlarmSite[];
  scope: StoreScopeState;
  onScopeChange: (nextScope: StoreScopeState) => void;
};

export function StoreScopeSelector({ sites, scope, onScopeChange }: StoreScopeSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const selectedStoreIds = useMemo(() => new Set(scope.selectedStoreIds), [scope.selectedStoreIds]);
  const selectedRegions = useMemo(() => new Set(scope.selectedRegionNames), [scope.selectedRegionNames]);
  const regions = useMemo(() => getRegionsFromSites(sites), [sites]);
  const filteredSites = useMemo(() => filterSites(sites, searchTerm), [sites, searchTerm]);
  const summary = getStoreScopeSummary(scope, sites);
  const includedSites = useMemo(() => countIncludedSites(sites, scope), [sites, scope]);

  function toggleRegion(region: string) {
    const nextRegions = new Set(scope.mode === 'regions' ? scope.selectedRegionNames : []);
    if (nextRegions.has(region)) nextRegions.delete(region);
    else nextRegions.add(region);
    onScopeChange(createRegionStoreScope(Array.from(nextRegions)));
  }

  function toggleStore(siteId: string) {
    if (scope.mode !== 'stores') {
      onScopeChange(createSelectedStoresScope([siteId]));
      return;
    }

    const nextIds = new Set(scope.selectedStoreIds);
    if (nextIds.has(siteId)) nextIds.delete(siteId);
    else nextIds.add(siteId);
    onScopeChange(createSelectedStoresScope(Array.from(nextIds)));
  }

  function removeSelectedRegion(region: string) {
    onScopeChange(createRegionStoreScope(scope.selectedRegionNames.filter((selectedRegion) => selectedRegion !== region)));
  }

  function removeSelectedStore(siteId: string) {
    onScopeChange(createSelectedStoresScope(scope.selectedStoreIds.filter((selectedStoreId) => selectedStoreId !== siteId)));
  }

  return (
    <section className="panel facility-scope-panel store-scope-panel" aria-labelledby="store-scope-title">
      <div className="facility-scope-heading">
        <div>
          <p className="eyebrow">Executive Protection Readiness Scope</p>
          <h2 id="store-scope-title">{summary}</h2>
          <p>
            Select the fire-system store population once here. This store or region lock follows the user across every
            service tab, including Fire-System Monitoring & Assurance.
          </p>
        </div>
        <div className="facility-scope-actions" aria-label="Store scope actions">
          <button type="button" onClick={() => onScopeChange(createAllStoresScope())}>View All Stores</button>
          <button type="button" onClick={() => onScopeChange(createRegionStoreScope(regions.slice(0, 1)))}>Region Mode</button>
          <button type="button" onClick={() => onScopeChange(createSelectedStoresScope([]))}>Store Mode / Clear</button>
        </div>
      </div>

      <div className="scope-summary-grid" aria-label="Current store scope metrics">
        <ScopeMetric label="Current lock" value={scope.mode === 'all' ? 'All fire stores' : scope.mode === 'regions' ? 'Region selection' : 'Store selection'} />
        <ScopeMetric label="Stores included" value={includedSites} />
        <ScopeMetric label="Regions available" value={regions.length} />
        <ScopeMetric label="MD / VA stores" value={`${sites.filter((site) => site.state === 'MD').length} / ${sites.filter((site) => site.state === 'VA').length}`} />
        <ScopeMetric label="Dataset" value="Fire alarm" />
      </div>

      <SelectedScopeTray sites={sites} scope={scope} onRemoveRegion={removeSelectedRegion} onRemoveStore={removeSelectedStore} />

      <div className="store-region-grid" aria-label="Fire-system regions">
        {regions.map((region) => (
          <button
            type="button"
            key={region}
            className={scope.mode === 'regions' && selectedRegions.has(region) ? 'region-chip active' : 'region-chip'}
            aria-pressed={scope.mode === 'regions' && selectedRegions.has(region)}
            onClick={() => toggleRegion(region)}
          >
            <strong>{region}</strong>
            <small>{sites.filter((site) => site.region === region).length} stores</small>
          </button>
        ))}
      </div>

      <label className="facility-search-label" htmlFor="store-scope-search">Search fire-system stores</label>
      <input
        id="store-scope-search"
        className="facility-search-input"
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search by store ID, name, city, state, region, format, panel type, contractor, or AHJ"
      />

      <div className="facility-checkbox-list" aria-label="Fire-system stores">
        {filteredSites.length > 0 ? filteredSites.map((site) => {
          const checked = scope.mode === 'all' || (scope.mode === 'regions' && selectedRegions.has(site.region)) || selectedStoreIds.has(site.id);
          return (
            <label className="facility-checkbox-row" key={site.id}>
              <input type="checkbox" checked={checked} onChange={() => toggleStore(site.id)} />
              <span>
                <strong>{site.name}</strong>
                <small>{site.id} • {site.region} • {site.city}, {site.state} • {site.format} • {site.panelType} • risk {site.riskScore}</small>
              </span>
            </label>
          );
        }) : <p className="facility-scope-empty">No fire-system stores match the current search.</p>}
      </div>
    </section>
  );
}

function SelectedScopeTray({
  sites,
  scope,
  onRemoveRegion,
  onRemoveStore,
}: {
  sites: FireAlarmSite[];
  scope: StoreScopeState;
  onRemoveRegion: (region: string) => void;
  onRemoveStore: (siteId: string) => void;
}) {
  const selectedSites = sites.filter((site) => scope.selectedStoreIds.includes(site.id));

  if (scope.mode === 'all') {
    return (
      <div className="selected-scope-tray" aria-label="Current selected scope">
        <span className="scope-chip selected">All 75 fire-system stores</span>
      </div>
    );
  }

  if (scope.mode === 'regions') {
    return (
      <div className="selected-scope-tray" aria-label="Selected regions">
        {scope.selectedRegionNames.length > 0 ? scope.selectedRegionNames.map((region) => (
          <button type="button" className="scope-chip selected" key={region} onClick={() => onRemoveRegion(region)}>
            {region}<small>Remove</small>
          </button>
        )) : <span className="scope-chip muted">No regions selected</span>}
      </div>
    );
  }

  return (
    <div className="selected-scope-tray" aria-label="Selected stores">
      {selectedSites.length > 0 ? selectedSites.map((site) => (
        <button type="button" className="scope-chip selected" key={site.id} onClick={() => onRemoveStore(site.id)}>
          {site.id} · {site.name}<small>Remove</small>
        </button>
      )) : <span className="scope-chip muted">No stores selected</span>}
    </div>
  );
}

function ScopeMetric({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function countIncludedSites(sites: FireAlarmSite[], scope: StoreScopeState): number {
  if (scope.mode === 'all') return sites.length;
  if (scope.mode === 'regions') return sites.filter((site) => scope.selectedRegionNames.includes(site.region)).length;
  return scope.selectedStoreIds.length;
}

function filterSites(sites: FireAlarmSite[], searchTerm: string): FireAlarmSite[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return sites;

  return sites.filter((site) =>
    [site.id, site.name, site.city, site.state, site.region, site.format, site.panelType, site.monitoringType, site.contractor, site.ahj]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch),
  );
}
