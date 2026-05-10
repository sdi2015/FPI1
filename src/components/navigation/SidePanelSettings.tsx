import { useMemo, useState } from 'react';
import { moveTabDown, moveTabUp, resetSidePanelPreferences, saveSidePanelDisplayMode, saveSidePanelPreferences, setTabVisibility, type SidePanelAvailableTab, type SidePanelDisplayMode, type SidePanelPreferences } from '../../services/sidePanelPreferenceService';

export function SidePanelSettings({
  availableTabs,
  preferences,
  displayMode,
  onClose,
  onPreferencesChange,
  onDisplayModeChange,
}: {
  availableTabs: SidePanelAvailableTab[];
  preferences: SidePanelPreferences;
  displayMode: SidePanelDisplayMode;
  onClose: () => void;
  onPreferencesChange: (preferences: SidePanelPreferences) => void;
  onDisplayModeChange: (mode: SidePanelDisplayMode) => void;
}) {
  const [draft, setDraft] = useState(preferences);
  const [search, setSearch] = useState('');
  const availableById = useMemo(() => new Map(availableTabs.map((tab) => [tab.tab_id, tab])), [availableTabs]);
  const filteredTabs = draft.tabs
    .filter((tab) => availableById.has(tab.tab_id))
    .filter((tab) => {
      const available = availableById.get(tab.tab_id);
      const text = `${tab.label} ${available?.description ?? ''} ${available?.group ?? ''}`.toLowerCase();
      return text.includes(search.trim().toLowerCase());
    });

  function apply(next: SidePanelPreferences) {
    setDraft(next);
  }

  function saveAndClose() {
    saveSidePanelPreferences(draft);
    onPreferencesChange(draft);
    onClose();
  }

  function resetDefaults() {
    if (!window.confirm('Are you sure you want to reset your side panel layout?')) return;
    const defaults = resetSidePanelPreferences(availableTabs);
    setDraft(defaults);
    onPreferencesChange(defaults);
  }

  function setDisplayMode(mode: SidePanelDisplayMode) {
    saveSidePanelDisplayMode(mode);
    onDisplayModeChange(mode);
  }

  return (
    <div className="side-panel-settings-backdrop" role="presentation">
      <section className="side-panel-settings-modal" role="dialog" aria-modal="true" aria-labelledby="side-panel-settings-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Personal workspace</p>
            <h2 id="side-panel-settings-title">Customize Navigation</h2>
            <p className="side-panel-settings-note">Choose which modules appear in your side panel. This is only a UI preference; module permissions and restricted actions still apply.</p>
          </div>
          <button type="button" className="ops-action-button secondary" onClick={onClose}>Close</button>
        </div>

        <div className="side-panel-settings-toolbar">
          <label className="side-panel-search-label">Search modules<input className="aviation-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search modules..." /></label>
          <label className="side-panel-compact-toggle"><input type="checkbox" checked={displayMode === 'compact'} onChange={(event) => setDisplayMode(event.target.checked ? 'compact' : 'expanded')} /> Compact side panel</label>
        </div>

        <div className="side-panel-settings-list">
          {filteredTabs.map((tab) => {
            const available = availableById.get(tab.tab_id)!;
            const index = draft.tabs.findIndex((item) => item.tab_id === tab.tab_id);
            return (
              <article className="side-panel-settings-row" key={tab.tab_id}>
                <div>
                  <div className="side-panel-row-title"><strong>{tab.label}</strong>{available.group ? <span className="mode-pill">{available.group}</span> : null}</div>
                  <p>{available.description}</p>
                  <span className="side-panel-access-note">Access: {available.access_note ?? 'Some actions may be restricted based on role.'}</span>
                </div>
                <div className="side-panel-row-actions">
                  <label className="side-panel-visible-toggle"><input type="checkbox" checked={tab.visible} onChange={(event) => apply(setTabVisibility(draft, tab.tab_id, event.target.checked))} /> Visible</label>
                  <button type="button" className="ops-action-button secondary" disabled={index <= 0} onClick={() => apply(moveTabUp(draft, tab.tab_id))}>Move Up</button>
                  <button type="button" className="ops-action-button secondary" disabled={index === draft.tabs.length - 1} onClick={() => apply(moveTabDown(draft, tab.tab_id))}>Move Down</button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="side-panel-settings-footer">
          <button type="button" className="ops-action-button secondary" onClick={resetDefaults}>Reset to Default</button>
          <button type="button" className="ops-action-button" onClick={saveAndClose}>Save Navigation</button>
        </div>
      </section>
    </div>
  );
}
