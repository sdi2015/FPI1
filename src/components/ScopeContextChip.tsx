import type { FireAlarmSite } from '../data/fireAlarmTypes';
import { getStoreScopeModeLabel, getStoreScopeSummary, type StoreScopeState } from '../data/storeScope';

export type ScopeContextChipProps = {
  sites: FireAlarmSite[];
  scope: StoreScopeState;
  onChangeScope: () => void;
};

export function ScopeContextChip({ sites, scope, onChangeScope }: ScopeContextChipProps) {
  const summary = getStoreScopeSummary(scope, sites);
  const included = countIncludedSites(sites, scope);

  return (
    <section className="scope-context-chip" aria-label="Current application scope">
      <div>
        <span>Scope</span>
        <strong>{summary}</strong>
        <small>{included} stores in view · {getStoreScopeModeLabel(scope)}</small>
      </div>
      <button type="button" onClick={onChangeScope}>Change Scope</button>
    </section>
  );
}

function countIncludedSites(sites: FireAlarmSite[], scope: StoreScopeState): number {
  if (scope.mode === 'all') return sites.length;
  if (scope.mode === 'regions') return sites.filter((site) => scope.selectedRegionNames.includes(site.region)).length;
  return scope.selectedStoreIds.length;
}
