import { useEffect, useState } from 'react';
import { AviationTabSettings } from './AviationTabSettings';
import { loadAviationTabPreferences, type AviationAvailableTab, type AviationTabPreferences } from '../../services/aviationTabPreferenceService';

export type AviationOpsTab = 'dashboard' | 'planner' | 'scanner' | 'risk' | 'alerts' | 'saved' | 'reports' | 'admin';

export const aviationTabs: AviationAvailableTab[] = [
  { tab_id: 'dashboard', label: 'Overview', operational: true },
  { tab_id: 'scanner', label: 'Airport Scan', operational: true },
  { tab_id: 'planner', label: 'Plan', operational: true },
  { tab_id: 'risk', label: 'Risk', operational: true },
  { tab_id: 'alerts', label: 'Alerts', operational: true },
  { tab_id: 'saved', label: 'Trips', operational: true },
  { tab_id: 'reports', label: 'Reports', operational: false },
  { tab_id: 'admin', label: 'Admin', operational: false },
];

const tabMeta: Record<AviationOpsTab, { icon: string; hint: string }> = {
  dashboard: { icon: '01', hint: 'Command summary' },
  scanner: { icon: '02', hint: 'Airport radius' },
  planner: { icon: '03', hint: 'Trip setup' },
  risk: { icon: '04', hint: 'Score & actions' },
  alerts: { icon: '05', hint: 'FAA / weather' },
  saved: { icon: '06', hint: 'Saved plans' },
  reports: { icon: '07', hint: 'Briefs & exports' },
  admin: { icon: '08', hint: 'Governance' },
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
