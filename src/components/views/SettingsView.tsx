import { StoreScopeSelector } from '../StoreScopeSelector';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StoreScopeState } from '../../data/storeScope';

export type SettingsViewProps = {
  fireSites: FireAlarmSite[];
  fireAlarmLoading: boolean;
  fireAlarmError: string | null;
  storeScope: StoreScopeState;
  onStoreScopeChange: (nextScope: StoreScopeState) => void;
};

export function SettingsView({ fireSites, fireAlarmLoading, fireAlarmError, storeScope, onStoreScopeChange }: SettingsViewProps) {
  return (
    <section className="settings-page" aria-label="FPI settings workspace">
      <header className="dashboard-header settings-header">
        <div>
          <p className="eyebrow">Application settings</p>
          <h1>Scope, preferences, and dashboard controls</h1>
          <p>
            Manage the canonical facility or region population once here. The selected scope flows across Command Center, EPR,
            Fire-System Monitoring, and future FPI service dashboards so operational pages stay clean and focused.
          </p>
        </div>
        <div className="mode-pill" aria-label="Settings mode">
          <span>GLOBAL</span>
          Scope control
        </div>
      </header>

      <section className="settings-overview-grid" aria-label="Settings overview">
        <article className="panel settings-card">
          <p className="eyebrow">Store population</p>
          <h2>One scope for all services</h2>
          <p>Choose all stores, one or more regions, or a specific list of stores. Service dashboards automatically recalculate against that population.</p>
        </article>
        <article className="panel settings-card">
          <p className="eyebrow">Data mode</p>
          <h2>Canonical demo dataset</h2>
          <p>Current build uses local JSON generated from the shared FPI data folder. No backend, auth, write-back, dispatch, or production integrations are enabled.</p>
        </article>
        <article className="panel settings-card">
          <p className="eyebrow">Governance</p>
          <h2>Read-only control plane</h2>
 <p>Settings are UI-state driven for this shell. The next build can persist preferences once a storage target is selected.</p>
        </article>
      </section>

      {fireAlarmLoading ? <StatePanel title="Loading canonical store list" message="Preparing the shared FPI facility population for scope settings." /> : null}
      {fireAlarmError ? <StatePanel title="Store settings unavailable" message={fireAlarmError} tone="critical" /> : null}
      {!fireAlarmLoading && !fireAlarmError ? <StoreScopeSelector sites={fireSites} scope={storeScope} onScopeChange={onStoreScopeChange} /> : null}
    </section>
  );
}

function StatePanel({ title, message, tone = 'stable' }: { title: string; message: string; tone?: 'stable' | 'critical' }) {
  return (
    <section className="panel dashboard-state-panel" role={tone === 'critical' ? 'alert' : 'status'}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">Settings data</p>
          <h1>{title}</h1>
        </div>
        <span className={`status-pill status-${tone}`}>{tone === 'critical' ? 'ERROR' : 'STATUS'}</span>
      </div>
      <p>{message}</p>
    </section>
  );
}
