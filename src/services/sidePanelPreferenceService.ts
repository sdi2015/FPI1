export const SIDE_PANEL_PREFERENCES_KEY = 'fpi_side_panel_preferences';
export const SIDE_PANEL_DISPLAY_MODE_KEY = 'fpi_side_panel_display_mode';

export type SidePanelDisplayMode = 'expanded' | 'compact';

export type SidePanelAvailableTab = {
  tab_id: string;
  label: string;
  route: string;
  description: string;
  group?: string;
  access_note?: string;
};

export type SidePanelTabPreference = {
  tab_id: string;
  label: string;
  route: string;
  visible: boolean;
  order: number;
};

export type SidePanelPreferences = {
  version: number;
  updated_at: string;
  tabs: SidePanelTabPreference[];
};

function now() {
  return new Date().toISOString();
}

export function getDefaultSidePanelPreferences(availableTabs: SidePanelAvailableTab[]): SidePanelPreferences {
  return {
    version: 1,
    updated_at: now(),
    tabs: availableTabs.map((tab, index) => ({
      tab_id: tab.tab_id,
      label: tab.label,
      route: tab.route,
      visible: true,
      order: index,
    })),
  };
}

function normalizePreferences(preferences: SidePanelPreferences): SidePanelPreferences {
  return {
    ...preferences,
    tabs: [...preferences.tabs]
      .sort((a, b) => a.order - b.order)
      .map((tab, index) => ({ ...tab, order: index })),
  };
}

export function mergeSidePanelPreferences(saved: SidePanelPreferences | null, availableTabs: SidePanelAvailableTab[]): SidePanelPreferences {
  if (!saved) return getDefaultSidePanelPreferences(availableTabs);

  const availableById = new Map(availableTabs.map((tab) => [tab.tab_id, tab]));
  const mergedTabs: SidePanelTabPreference[] = [];

  saved.tabs
    .filter((tab) => availableById.has(tab.tab_id))
    .sort((a, b) => a.order - b.order)
    .forEach((tab) => {
      const available = availableById.get(tab.tab_id)!;
      mergedTabs.push({
        tab_id: available.tab_id,
        label: available.label,
        route: available.route,
        visible: tab.visible,
        order: mergedTabs.length,
      });
    });

  availableTabs.forEach((available) => {
    if (!mergedTabs.some((tab) => tab.tab_id === available.tab_id)) {
      mergedTabs.push({
        tab_id: available.tab_id,
        label: available.label,
        route: available.route,
        visible: true,
        order: mergedTabs.length,
      });
    }
  });

  return normalizePreferences({ version: 1, updated_at: now(), tabs: mergedTabs });
}

export function loadSidePanelPreferences(availableTabs: SidePanelAvailableTab[]): SidePanelPreferences {
  if (typeof window === 'undefined') return getDefaultSidePanelPreferences(availableTabs);

  try {
    const raw = window.localStorage.getItem(SIDE_PANEL_PREFERENCES_KEY);
    const parsed = raw ? (JSON.parse(raw) as SidePanelPreferences) : null;
    const merged = mergeSidePanelPreferences(parsed, availableTabs);
    saveSidePanelPreferences(merged);
    return merged;
  } catch {
    const defaults = getDefaultSidePanelPreferences(availableTabs);
    saveSidePanelPreferences(defaults);
    return defaults;
  }
}

export function saveSidePanelPreferences(preferences: SidePanelPreferences): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDE_PANEL_PREFERENCES_KEY, JSON.stringify({ ...normalizePreferences(preferences), updated_at: now() }));
}

export function resetSidePanelPreferences(availableTabs: SidePanelAvailableTab[]): SidePanelPreferences {
  const defaults = getDefaultSidePanelPreferences(availableTabs);
  saveSidePanelPreferences(defaults);
  return defaults;
}

export function setTabVisibility(preferences: SidePanelPreferences, tabId: string, visible: boolean): SidePanelPreferences {
  return normalizePreferences({
    ...preferences,
    updated_at: now(),
    tabs: preferences.tabs.map((tab) => (tab.tab_id === tabId ? { ...tab, visible } : tab)),
  });
}

export function moveTabUp(preferences: SidePanelPreferences, tabId: string): SidePanelPreferences {
  const tabs = [...preferences.tabs].sort((a, b) => a.order - b.order);
  const index = tabs.findIndex((tab) => tab.tab_id === tabId);
  if (index <= 0) return preferences;
  [tabs[index - 1], tabs[index]] = [tabs[index], tabs[index - 1]];
  return normalizePreferences({ ...preferences, updated_at: now(), tabs });
}

export function moveTabDown(preferences: SidePanelPreferences, tabId: string): SidePanelPreferences {
  const tabs = [...preferences.tabs].sort((a, b) => a.order - b.order);
  const index = tabs.findIndex((tab) => tab.tab_id === tabId);
  if (index < 0 || index >= tabs.length - 1) return preferences;
  [tabs[index], tabs[index + 1]] = [tabs[index + 1], tabs[index]];
  return normalizePreferences({ ...preferences, updated_at: now(), tabs });
}

export function loadSidePanelDisplayMode(): SidePanelDisplayMode {
  if (typeof window === 'undefined') return 'expanded';
  return window.localStorage.getItem(SIDE_PANEL_DISPLAY_MODE_KEY) === 'compact' ? 'compact' : 'expanded';
}

export function saveSidePanelDisplayMode(mode: SidePanelDisplayMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDE_PANEL_DISPLAY_MODE_KEY, mode);
}
