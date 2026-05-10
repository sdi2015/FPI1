import type { AviationOpsTab } from '../components/aviation/AviationTabNav';

export const AVIATION_TAB_PREFERENCES_KEY = 'fpi_aviation_tab_preferences';

export type AviationTabPreference = {
  tab_id: AviationOpsTab;
  label: string;
  visible: boolean;
  order: number;
};

export type AviationTabPreferences = {
  version: number;
  updated_at: string;
  tabs: AviationTabPreference[];
};

export type AviationAvailableTab = {
  tab_id: AviationOpsTab;
  label: string;
  operational: boolean;
};

function now() {
  return new Date().toISOString();
}

export function getDefaultAviationTabPreferences(availableTabs: AviationAvailableTab[]): AviationTabPreferences {
  return { version: 1, updated_at: now(), tabs: availableTabs.map((tab, index) => ({ tab_id: tab.tab_id, label: tab.label, visible: true, order: index })) };
}

export function normalizeAviationTabPreferences(preferences: AviationTabPreferences): AviationTabPreferences {
  return { ...preferences, tabs: [...preferences.tabs].sort((a, b) => a.order - b.order).map((tab, index) => ({ ...tab, order: index })) };
}

export function mergeAviationTabPreferences(saved: AviationTabPreferences | null, availableTabs: AviationAvailableTab[]): AviationTabPreferences {
  if (!saved) return getDefaultAviationTabPreferences(availableTabs);
  const availableById = new Map(availableTabs.map((tab) => [tab.tab_id, tab]));
  const tabs: AviationTabPreference[] = [];
  saved.tabs.filter((tab) => availableById.has(tab.tab_id)).sort((a, b) => a.order - b.order).forEach((tab) => {
    const available = availableById.get(tab.tab_id)!;
    tabs.push({ tab_id: available.tab_id, label: available.label, visible: tab.visible, order: tabs.length });
  });
  availableTabs.forEach((available) => {
    if (!tabs.some((tab) => tab.tab_id === available.tab_id)) tabs.push({ tab_id: available.tab_id, label: available.label, visible: true, order: tabs.length });
  });
  return ensureOperationalTabVisible(normalizeAviationTabPreferences({ version: 1, updated_at: now(), tabs }), availableTabs);
}

export function loadAviationTabPreferences(availableTabs: AviationAvailableTab[]): AviationTabPreferences {
  if (typeof window === 'undefined') return getDefaultAviationTabPreferences(availableTabs);
  try {
    const raw = window.localStorage.getItem(AVIATION_TAB_PREFERENCES_KEY);
    const merged = mergeAviationTabPreferences(raw ? JSON.parse(raw) as AviationTabPreferences : null, availableTabs);
    saveAviationTabPreferences(merged);
    return merged;
  } catch {
    const defaults = getDefaultAviationTabPreferences(availableTabs);
    saveAviationTabPreferences(defaults);
    return defaults;
  }
}

export function saveAviationTabPreferences(preferences: AviationTabPreferences): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AVIATION_TAB_PREFERENCES_KEY, JSON.stringify({ ...normalizeAviationTabPreferences(preferences), updated_at: now() }));
}

export function resetAviationTabPreferences(availableTabs: AviationAvailableTab[]): AviationTabPreferences {
  const defaults = getDefaultAviationTabPreferences(availableTabs);
  saveAviationTabPreferences(defaults);
  return defaults;
}

export function ensureOperationalTabVisible(preferences: AviationTabPreferences, availableTabs: AviationAvailableTab[]): AviationTabPreferences {
  const operationalIds = new Set(availableTabs.filter((tab) => tab.operational).map((tab) => tab.tab_id));
  if (preferences.tabs.some((tab) => tab.visible && operationalIds.has(tab.tab_id))) return preferences;
  const firstOperational = preferences.tabs.find((tab) => operationalIds.has(tab.tab_id));
  if (!firstOperational) return preferences;
  return { ...preferences, tabs: preferences.tabs.map((tab) => tab.tab_id === firstOperational.tab_id ? { ...tab, visible: true } : tab) };
}

export function setAviationTabVisibility(preferences: AviationTabPreferences, availableTabs: AviationAvailableTab[], tabId: AviationOpsTab, visible: boolean): AviationTabPreferences {
  return ensureOperationalTabVisible(normalizeAviationTabPreferences({ ...preferences, tabs: preferences.tabs.map((tab) => tab.tab_id === tabId ? { ...tab, visible } : tab), updated_at: now() }), availableTabs);
}

export function moveAviationTabUp(preferences: AviationTabPreferences, tabId: AviationOpsTab): AviationTabPreferences {
  const tabs = [...preferences.tabs].sort((a, b) => a.order - b.order);
  const index = tabs.findIndex((tab) => tab.tab_id === tabId);
  if (index <= 0) return preferences;
  [tabs[index - 1], tabs[index]] = [tabs[index], tabs[index - 1]];
  return normalizeAviationTabPreferences({ ...preferences, tabs, updated_at: now() });
}

export function moveAviationTabDown(preferences: AviationTabPreferences, tabId: AviationOpsTab): AviationTabPreferences {
  const tabs = [...preferences.tabs].sort((a, b) => a.order - b.order);
  const index = tabs.findIndex((tab) => tab.tab_id === tabId);
  if (index < 0 || index >= tabs.length - 1) return preferences;
  [tabs[index], tabs[index + 1]] = [tabs[index + 1], tabs[index]];
  return normalizeAviationTabPreferences({ ...preferences, tabs, updated_at: now() });
}
