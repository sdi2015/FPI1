import type { FireAlarmSite } from './fireAlarmTypes';

export type StoreScopeMode = 'all' | 'regions' | 'stores';

export type StoreScopeState = {
  mode: StoreScopeMode;
  selectedRegionNames: string[];
  selectedStoreIds: string[];
};

export function createAllStoresScope(): StoreScopeState {
  return { mode: 'all', selectedRegionNames: [], selectedStoreIds: [] };
}

export function createRegionStoreScope(regionNames: string[]): StoreScopeState {
  return { mode: 'regions', selectedRegionNames: uniqueStrings(regionNames), selectedStoreIds: [] };
}

export function createSelectedStoresScope(storeIds: string[]): StoreScopeState {
  return { mode: 'stores', selectedRegionNames: [], selectedStoreIds: uniqueStrings(storeIds) };
}

export function isStoreInScope(site: Pick<FireAlarmSite, 'id' | 'region'>, scope: StoreScopeState): boolean {
  if (scope.mode === 'all') return true;
  if (scope.mode === 'regions') return scope.selectedRegionNames.includes(site.region);
  return scope.selectedStoreIds.includes(site.id);
}

export function hasEmptyStoreScope(scope: StoreScopeState): boolean {
  return (scope.mode === 'regions' && scope.selectedRegionNames.length === 0) || (scope.mode === 'stores' && scope.selectedStoreIds.length === 0);
}

export function getScopedStoreIds(sites: FireAlarmSite[], scope: StoreScopeState): string[] {
  if (hasEmptyStoreScope(scope)) return [];
  return sites.filter((site) => isStoreInScope(site, scope)).map((site) => site.id);
}

export function getStoreScopeSummary(scope: StoreScopeState, sites: FireAlarmSite[]): string {
  if (scope.mode === 'all') return `All ${formatNumber(sites.length)} canonical FPI stores included`;
  if (scope.mode === 'regions') {
    if (scope.selectedRegionNames.length === 0) return 'No regions selected';
    const count = sites.filter((site) => scope.selectedRegionNames.includes(site.region)).length;
    return `${scope.selectedRegionNames.join(', ')} • ${formatNumber(count)} stores included`;
  }
  if (scope.selectedStoreIds.length === 0) return 'No stores selected';
  return `${formatNumber(scope.selectedStoreIds.length)} of ${formatNumber(sites.length)} canonical FPI stores selected`;
}

export function getStoreScopeModeLabel(scope: StoreScopeState): string {
  if (scope.mode === 'all') return 'All stores';
  if (scope.mode === 'regions') return 'Region locked';
  return 'Store locked';
}

export function getRegionsFromSites(sites: FireAlarmSite[]): string[] {
  return uniqueStrings(sites.map((site) => site.region)).sort((a, b) => a.localeCompare(b));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
