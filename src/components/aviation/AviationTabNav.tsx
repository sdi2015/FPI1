import { useEffect, useState } from 'react';
import { AviationTabSettings } from './AviationTabSettings';
import { loadAviationTabPreferences, type AviationAvailableTab, type AviationTabPreferences } from '../../services/aviationTabPreferenceService';

export type AviationOpsTab = 'dashboard' | 'scanner' | 'nearby' | 'facility-detail' | 'risk' | 'faa' | 'weather' | 'actions' | 'ask-fpi' | 'briefs' | 'demo' | 'admin' | 'audit' | 'planner' | 'saved';

export const aviationTabs: AviationAvailableTab[] = [
  { tab_id: 'dashboard', label: 'Aviation Command Center', operational: true },
  { tab_id: 'scanner', label: 'Airport Radius Scanner', operational: true },
  { tab_id: 'nearby', label: 'Nearby Facilities', operational: true },
  { tab_id: 'facility-detail', label: 'Facility Detail / Support Staging', operational: true },
  { tab_id: 'risk', label: 'Trip Risk Score', operational: true },
  { tab_id: 'faa', label: 'FAA / Airport Watch', operational: true },
  { tab_id: 'weather', label: 'NOAA Weather Watch', operational: true },
  { tab_id: 'actions', label: 'Readiness Actions', operational: true },
  { tab_id: 'ask-fpi', label: 'Ask FPI Aviation', operational: true },
  { tab_id: 'briefs', label: 'Aviation Travel Briefs', operational: true },
  { tab_id: 'demo', label: 'Demo Scenario Mode', operational: true },
  { tab_id: 'admin', label: 'Admin / Data Sources', operational: false },
  { tab_id: 'audit', label: 'Audit / Activity Log', operational: false },
  { tab_id: 'planner', label: 'Legacy Plan', operational: false },
  { tab_id: 'saved', label: 'Saved Trips', operational: false },
];

const tabMeta: Record<AviationOpsTab, { icon: string; hint: string }> = {
  dashboard: { icon: '01', hint: 'Executive dashboard' }, scanner: { icon: '02', hint: 'Guided radius scan' }, nearby: { icon: '03', hint: 'Facilities in radius' }, 'facility-detail': { icon: '04', hint: 'Support staging' }, risk: { icon: '05', hint: 'Score model' }, faa: { icon: '06', hint: 'FAA / airport' }, weather: { icon: '07', hint: 'NOAA weather' }, actions: { icon: '08', hint: 'Track tasks' }, 'ask-fpi': { icon: '09', hint: 'Aviation assistant' }, briefs: { icon: '10', hint: 'Briefs' }, demo: { icon: '11', hint: 'Synthetic demo' }, admin: { icon: '12', hint: 'Data sources' }, audit: { icon: '13', hint: 'Activity log' }, planner: { icon: '14', hint: 'Legacy trip setup' }, saved: { icon: '15', hint: 'Saved plans' },
};

export function AviationTabNav({ activeTab, onChange }: { activeTab: AviationOpsTab; onChange: (tab: AviationOpsTab) => void }) {
  const [preferences, setPreferences] = useState<AviationTabPreferences>(loadAviationTabPreferences(aviationTabs));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const visibleTabs = preferences.tabs.filter((tab) => tab.visible).sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.tab_id === activeTab)) {
      onChange(visibleTabs[0]?.tab_id ?? 'dashboard');
    }
  }, [activeTab, onChange, visibleTabs]);

  return (
    <>
      <nav className="aviation-tabs aviation-ops-tabs" aria-label="Aviation operations navigation">
        <div className="aviation-tab-scroll">
          {visibleTabs.map((tab) => {
            const meta = tabMeta[tab.tab_id];
            return <button key={tab.tab_id} type="button" className={activeTab === tab.tab_id ? 'aviation-tab-button active' : 'aviation-tab-button'} aria-current={activeTab === tab.tab_id ? 'page' : undefined} onClick={() => onChange(tab.tab_id)}><span className="aviation-tab-index">{meta.icon}</span><span><strong>{tab.label}</strong><small>{meta.hint}</small></span></button>;
          })}
        </div>
        <button type="button" className="aviation-tab-settings" onClick={() => setSettingsOpen(true)} aria-label="Customize Aviation tabs">Customize</button>
      </nav>
      {settingsOpen ? <AviationTabSettings availableTabs={aviationTabs} preferences={preferences} onClose={() => setSettingsOpen(false)} onPreferencesChange={setPreferences} /> : null}
    </>
  );
}
