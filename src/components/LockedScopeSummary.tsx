import type { FireAlarmSite } from '../data/fireAlarmTypes';
import type { StatusTone } from '../data/fpiTypes';
import { getStoreScopeModeLabel, getStoreScopeSummary, type StoreScopeState } from '../data/storeScope';

export type LockedScopeSummaryProps = {
  sites: FireAlarmSite[];
  scope: StoreScopeState;
  onChangeScope: () => void;
};

export function LockedScopeSummary({ sites, scope, onChangeScope }: LockedScopeSummaryProps) {
  const summary = getStoreScopeSummary(scope, sites);
  const included = countIncludedSites(sites, scope);
  const selections = getSelectionLabels(sites, scope);

  return (
    <section className="panel locked-scope-panel" aria-labelledby="locked-scope-title">
      <div>
        <p className="eyebrow">Locked app scope</p>
        <h2 id="locked-scope-title">{summary}</h2>
        <p>This scope was selected in Executive Protection Readiness and now applies across service views.</p>
        <div className="locked-scope-chip-list" aria-label="Selected stores or regions">
          {selections.map((selection) => <span className="scope-chip selected" key={selection}>{selection}</span>)}
        </div>
      </div>
      <div className="locked-scope-actions">
        <StatusPill label={getStoreScopeModeLabel(scope)} tone="ready" />
        <strong>{included}</strong>
        <span>stores in current view</span>
        <button type="button" onClick={onChangeScope}>Change in Executive Readiness</button>
      </div>
    </section>
  );
}

function getSelectionLabels(sites: FireAlarmSite[], scope: StoreScopeState): string[] {
  if (scope.mode === 'all') return ['All fire-system stores'];
  if (scope.mode === 'regions') return scope.selectedRegionNames.length > 0 ? scope.selectedRegionNames : ['No regions selected'];

  const selectedSites = sites.filter((site) => scope.selectedStoreIds.includes(site.id));
  if (selectedSites.length === 0) return ['No stores selected'];
  return selectedSites.slice(0, 8).map((site) => `${site.id} · ${site.name}`).concat(selectedSites.length > 8 ? [`+${selectedSites.length - 8} more`] : []);
}

function countIncludedSites(sites: FireAlarmSite[], scope: StoreScopeState): number {
  if (scope.mode === 'all') return sites.length;
  if (scope.mode === 'regions') return sites.filter((site) => scope.selectedRegionNames.includes(site.region)).length;
  return scope.selectedStoreIds.length;
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}
