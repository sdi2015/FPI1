import { useMemo, useState } from 'react';
import { StoreScopeSelector } from '../StoreScopeSelector';
import { DEFAULT_NAVIGATION_CONFIG, normalizeNavigationConfig, saveNavigationConfig, type NavigationItemConfig, type NavigationSectionId } from '../../data/navigationConfig';
import { pillars } from '../../data/program';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { FpiDashboardMetrics } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';

export type SettingsViewProps = {
  fireSites: FireAlarmSite[];
  fireAlarmLoading: boolean;
  fireAlarmError: string | null;
  storeScope: StoreScopeState;
  onStoreScopeChange: (nextScope: StoreScopeState) => void;
  navigationConfig?: NavigationItemConfig[];
  onNavigationConfigChange?: (config: NavigationItemConfig[]) => void;
  dashboardMetrics?: FpiDashboardMetrics;
};

type SettingsTab = 'scope' | 'navigation' | 'system' | 'preferences';

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'scope', label: 'Scope' },
  { id: 'navigation', label: 'Custom Navigation' },
  { id: 'system', label: 'Data / System Status' },
  { id: 'preferences', label: 'Preferences' },
];

const sectionLabels: Record<NavigationSectionId, string> = {
  command: 'Command',
  modules: 'Modules',
  aviation: 'Aviation',
  workspace: 'Workspace',
};

export function SettingsView({ fireSites, fireAlarmLoading, fireAlarmError, storeScope, onStoreScopeChange, navigationConfig, onNavigationConfigChange, dashboardMetrics }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('scope');
  const normalizedNavigationConfig = useMemo(() => normalizeNavigationConfig(navigationConfig ?? DEFAULT_NAVIGATION_CONFIG), [navigationConfig]);
  return (
    <section className="settings-page" aria-label="FPI settings workspace">
      <header className="dashboard-header settings-header">
        <div>
          <p className="eyebrow">Application settings</p>
          <h1>Scope, preferences, and dashboard controls</h1>
          <p>
            Manage scope, navigation, and local workspace preferences from one settings control plane.
          </p>
        </div>
        <div className="mode-pill" aria-label="Settings mode"><span>GLOBAL</span>Control plane</div>
      </header>

      <nav className="settings-tabs" aria-label="Settings sections">
        {settingsTabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'settings-tab active' : 'settings-tab'} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </nav>

      {activeTab === 'scope' ? <ScopeControlTab fireSites={fireSites} fireAlarmLoading={fireAlarmLoading} fireAlarmError={fireAlarmError} storeScope={storeScope} onStoreScopeChange={onStoreScopeChange} /> : null}
      {activeTab === 'navigation' ? <CustomNavigationSettings navigationConfig={normalizedNavigationConfig} onNavigationConfigChange={onNavigationConfigChange} /> : null}
      {activeTab === 'system' ? <DataSystemStatusTab fireAlarmLoading={fireAlarmLoading} fireAlarmError={fireAlarmError} fireSites={fireSites} dashboardMetrics={dashboardMetrics} /> : null}
      {activeTab === 'preferences' ? <PreferencesTab /> : null}
    </section>
  );
}

function ScopeControlTab({ fireSites, fireAlarmLoading, fireAlarmError, storeScope, onStoreScopeChange }: Pick<SettingsViewProps, 'fireSites' | 'fireAlarmLoading' | 'fireAlarmError' | 'storeScope' | 'onStoreScopeChange'>) {
  return <>
    <section className="settings-overview-grid" aria-label="Scope overview">
      <article className="panel settings-card"><p className="eyebrow">Store population</p><h2>One scope for all services</h2><p>Choose all stores, one or more regions, or a specific list of stores. Service dashboards automatically recalculate against that population.</p></article>
      <article className="panel settings-card"><p className="eyebrow">Scope propagation</p><h2>Shared dashboard context</h2><p>The selected scope flows across Command Center, EPR, Fire-System Monitoring, and future FPI service dashboards.</p></article>
      <article className="panel settings-card"><p className="eyebrow">Governance</p><h2>Local UI state</h2><p>Scope settings are stored locally for this shell and are ready for backend persistence when available.</p></article>
    </section>
    {fireAlarmLoading ? <StatePanel title="Loading canonical store list" message="Preparing the shared FPI facility population for scope settings." /> : null}
    {fireAlarmError ? <StatePanel title="Store settings unavailable" message={fireAlarmError} tone="critical" /> : null}
    {!fireAlarmLoading && !fireAlarmError ? <StoreScopeSelector sites={fireSites} scope={storeScope} onScopeChange={onStoreScopeChange} /> : null}
  </>;
}

function CustomNavigationSettings({ navigationConfig, onNavigationConfigChange }: { navigationConfig: NavigationItemConfig[]; onNavigationConfigChange?: (config: NavigationItemConfig[]) => void }) {
  const [draft, setDraft] = useState<NavigationItemConfig[]>(normalizeNavigationConfig(navigationConfig));
  const [status, setStatus] = useState('');
  const sections: NavigationSectionId[] = ['command', 'modules', 'aviation', 'workspace'];

  function apply(next: NavigationItemConfig[]) {
    setDraft(normalizeNavigationConfig(next));
    setStatus('Unsaved changes');
  }

  function updateItem(id: string, updates: Partial<NavigationItemConfig>) {
    apply(draft.map((item) => {
      if (item.id !== id) return item;
      const locked = Boolean(item.locked);
      return { ...item, ...updates, enabled: locked ? true : updates.enabled ?? item.enabled, section: locked ? item.section : updates.section ?? item.section };
    }));
  }

  function move(id: string, direction: -1 | 1) {
    const ordered = [...draft].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    apply(ordered.map((item, order) => ({ ...item, order })));
  }

  function resetDefaults() {
    const defaults = normalizeNavigationConfig(DEFAULT_NAVIGATION_CONFIG);
    setDraft(defaults);
    onNavigationConfigChange?.(defaults);
    saveNavigationConfig(defaults);
    setStatus('Navigation restored to defaults.');
  }

  function save() {
    const normalized = normalizeNavigationConfig(draft);
    saveNavigationConfig(normalized);
    onNavigationConfigChange?.(normalized);
    setDraft(normalized);
    setStatus('Navigation saved.');
  }

  return <section className="panel settings-card" aria-label="Custom Navigation settings">
    <div className="card-heading"><div><p className="eyebrow">Custom Navigation</p><h2>Sidebar navigation configuration</h2><p>Control which modules appear in the sidebar, rename non-locked items, reorder items, and group modules by section.</p></div>{status ? <span className="status-pill status-stable">{status}</span> : null}</div>
    <div className="navigation-settings-list">
      {sections.map((section) => {
        const items = draft.filter((item) => item.section === section).sort((a, b) => a.order - b.order);
        return <div key={section} className="navigation-settings-section"><p className="nav-label">{sectionLabels[section]}</p>{items.length === 0 ? <p className="sidebar-empty-note">No items in this section.</p> : items.map((item) => <article className="navigation-settings-row" key={item.id}><div><div className="side-panel-row-title"><strong>{item.label}</strong>{item.locked ? <span className="locked-badge">Locked</span> : null}</div><p>{item.description}</p><small>{item.serviceId}</small></div><div className="nav-config-actions"><input className="aviation-input" aria-label={`Label for ${item.label}`} value={item.label} disabled={item.locked} onChange={(event) => updateItem(item.id, { label: event.target.value })} /><label className="side-panel-visible-toggle"><input type="checkbox" checked={item.enabled || Boolean(item.locked)} disabled={item.locked} onChange={(event) => updateItem(item.id, { enabled: event.target.checked })} /> Enabled</label><select className="aviation-input" value={item.section} disabled={item.locked} onChange={(event) => updateItem(item.id, { section: event.target.value as NavigationSectionId })}>{sections.map((sectionOption) => <option key={sectionOption} value={sectionOption}>{sectionLabels[sectionOption]}</option>)}</select><button type="button" className="ops-action-button secondary" onClick={() => move(item.id, -1)}>Up</button><button type="button" className="ops-action-button secondary" onClick={() => move(item.id, 1)}>Down</button></div></article>)}</div>;
      })}
    </div>
    <div className="side-panel-settings-footer"><button type="button" className="ops-action-button secondary" onClick={resetDefaults}>Restore Defaults</button><button type="button" className="ops-action-button" onClick={save}>Save Navigation</button></div>
  </section>;
}

function DataSystemStatusTab({ fireAlarmLoading, fireAlarmError, fireSites, dashboardMetrics }: { fireAlarmLoading: boolean; fireAlarmError: string | null; fireSites: FireAlarmSite[]; dashboardMetrics?: FpiDashboardMetrics }) {
  const dataReadiness = pillars.find((pillar) => pillar.id === 'ingestion')?.progress ?? 86;
  const profileCompleteness = pillars.find((pillar) => pillar.id === 'profiling')?.progress ?? 74;
  const governanceConfidence = pillars.find((pillar) => pillar.id === 'governance')?.progress ?? 91;
  const details = [
    { label: 'Data Mode', value: dashboardMetrics && dashboardMetrics.elmLocationCount > 0 ? 'ELM enriched' : 'Demo dataset' },
    { label: 'ELM Locations', value: formatNumber(dashboardMetrics?.elmLocationCount ?? 0) },
    { label: 'Geocoded Facilities', value: formatNumber(dashboardMetrics?.geocodedFacilities ?? 0) },
    { label: 'Data Readiness', value: `${dataReadiness}%` },
    { label: 'Facility Risk Profile Completeness', value: `${profileCompleteness}%` },
    { label: 'Governance & Evidence Confidence', value: `${governanceConfidence}%` },
    { label: 'Source Freshness', value: 'Demo dataset' },
    { label: 'Fire / Life-Safety Records', value: fireAlarmError ? 'Unavailable' : fireAlarmLoading ? 'Loading' : formatNumber(fireSites.length) },
  ];

  return <>
    <section className="settings-overview-grid" aria-label="Data and system status">
      <article className="panel settings-card"><p className="eyebrow">Data mode</p><h2>Admin/system details</h2><p>Data coverage, enrichment, geocoding, source freshness, and confidence indicators are shown here instead of the operational dashboards.</p></article>
      <article className="panel settings-card"><p className="eyebrow">Fire data</p><h2>{fireAlarmError ? 'Unavailable' : fireAlarmLoading ? 'Loading' : 'Loaded'}</h2><p>{fireAlarmError ?? `${fireSites.length} canonical fire/life-safety site records available for scope selection.`}</p></article>
      <article className="panel settings-card"><p className="eyebrow">Governance</p><h2>Read-only control plane</h2><p>Current build uses local JSON generated from the shared FPI data folder. No backend, auth, write-back, dispatch, or production integrations are enabled.</p></article>
    </section>
    <section className="panel settings-card" aria-label="Data coverage and confidence details">
      <div className="card-heading"><div><p className="eyebrow">Data / System Status</p><h2>Coverage, enrichment, and confidence</h2><p>These values support administration and troubleshooting; they are intentionally kept out of the main Command Center.</p></div></div>
      <div className="data-confidence-grid settings-system-grid">
        {details.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </div>
    </section>
  </>;
}

function PreferencesTab() {
  return <section className="panel settings-card"><p className="eyebrow">Preferences</p><h2>Workspace preferences</h2><p>Theme and enterprise user preferences can be added here. Current theme is controlled from the command bar.</p></section>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function StatePanel({ title, message, tone = 'stable' }: { title: string; message: string; tone?: 'stable' | 'critical' }) {
  return (
    <section className="panel dashboard-state-panel" role={tone === 'critical' ? 'alert' : 'status'}>
      <div className="card-heading"><div><p className="eyebrow">Settings data</p><h1>{title}</h1></div><span className={`status-pill status-${tone}`}>{tone === 'critical' ? 'ERROR' : 'STATUS'}</span></div>
      <p>{message}</p>
    </section>
  );
}
