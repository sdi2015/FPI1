import { useEffect, useMemo, useState } from 'react';
import type { FpiFacility, StatusTone } from '../../data/fpiTypes';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StoreScopeState } from '../../data/storeScope';
import type { EprData, EprFacility, EprHotel, EprIncident, EprSecuritySolution, EprTask } from '../../data/eprTypes';
import { applyEprScope } from '../../data/eprScope';
import { useEprData } from '../../data/useEprData';
import { RouteMap } from '../RouteMap';
import { VisitBriefWizard } from '../VisitBriefWizard';
import { HandoffModal } from '../HandoffModal';
import {
  exportRouteCsv,
  exportRouteGpx,
  exportRouteIcs,
  exportRouteJson,
  triggerDownload,
} from '../../data/routeExporters';

export type ExecutiveProtectionReadinessViewProps = {
  facilities: FpiFacility[];
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type EprTab = 'overview' | 'visits' | 'hotels' | 'incidents' | 'mitigation' | 'tasks' | 'analysis';

type EprIncidentDraft = {
  id: string;
  priority: 'P1' | 'P2' | 'P3';
  owner: string;
  subject: string;
  summary: string;
  evidenceNeeded: string[];
  requestedResponse: string;
  recommendedAction: string;
};

type EprTaskDraft = {
  id: string;
  priority: string;
  owner: string;
  subject: string;
  summary: string;
  evidenceNeeded: string[];
  requestedResponse: string;
  recommendedAction: string;
};

type EprHotelDraft = {
  id: string;
  priority: 'Preferred' | 'Review';
  hotelName: string;
  subject: string;
  summary: string;
  recommendation: string;
  evidenceNeeded: string[];
  requestedResponse: string;
};

type EprMitigationDraft = {
  id: string;
  priority: 'Recommended' | 'Review';
  solutionName: string;
  subject: string;
  summary: string;
  recommendation: string;
  evidenceNeeded: string[];
  requestedResponse: string;
};

// 'overview' (Readiness), 'tasks' (Tasks & Governance), and 'analysis' (Data Provenance) tabs
// are intentionally hidden from the EPR sub-nav per product request.
// The matching components below are kept intact so they can be re-enabled by adding them back to this array.
const tabs: Array<{ id: EprTab; label: string; eyebrow: string }> = [
  { id: 'visits', label: 'Visit Planner', eyebrow: 'Travel' },
  { id: 'hotels', label: 'Hotel Intelligence', eyebrow: 'Safety' },
  { id: 'mitigation', label: 'Security Mitigation', eyebrow: 'Controls' },
  { id: 'incidents', label: 'Incident Risk', eyebrow: 'Risk' },
];

const EPR_PANEL_LAYOUT_STORAGE_KEY = 'fpi-epr-panel-layout-v1';
type StoredPanelLayout = Record<string, { width: number; height: number }>;

function readStoredPanelLayout(): StoredPanelLayout {
  if (typeof window === 'undefined') return {};
  try {
    const value = window.localStorage.getItem(EPR_PANEL_LAYOUT_STORAGE_KEY);
    return value ? JSON.parse(value) as StoredPanelLayout : {};
  } catch {
    return {};
  }
}

function restoreEprPanelLayout() {
  if (typeof document === 'undefined') return;
  const layout = readStoredPanelLayout();
  document.querySelectorAll<HTMLElement>('[data-resizable-panel]').forEach((panel) => {
    const panelId = panel.dataset.resizablePanel;
    const size = panelId ? layout[panelId] : null;
    if (!size) return;
    panel.style.width = `${size.width}px`;
    panel.style.height = `${size.height}px`;
  });
}

function saveResizablePanelSize(event: unknown) {
  if (typeof window === 'undefined') return;
  const panel = (event as { currentTarget?: EventTarget | null }).currentTarget;
  if (!(panel instanceof HTMLElement)) return;
  const panelId = panel.dataset.resizablePanel;
  if (!panelId) return;
  const layout = readStoredPanelLayout();
  layout[panelId] = { width: panel.offsetWidth, height: panel.offsetHeight };
  window.localStorage.setItem(EPR_PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function resetEprResizableLayout() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(EPR_PANEL_LAYOUT_STORAGE_KEY);
  }
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLElement>('[data-resizable-panel]').forEach((panel) => {
    panel.style.width = '';
    panel.style.height = '';
  });
}

export function ExecutiveProtectionReadinessView({
  facilities,
  fireSites,
  storeScope,
  onChangeScopeRequest,
}: ExecutiveProtectionReadinessViewProps) {
  const [activeTab, setActiveTab] = useState<EprTab>('visits');
  const eprState = useEprData();

  useEffect(() => {
    window.requestAnimationFrame(restoreEprPanelLayout);
  }, [activeTab]);
  const eprData = useMemo(() => (eprState.data ? applyEprScope(eprState.data, fireSites, storeScope) : null), [eprState.data, fireSites, storeScope]);
  const topRiskFacilities = useMemo(() => getTopRiskFacilities(eprData), [eprData]);

  return (
    <section className="epr-page" aria-label="Executive Protection Readiness workspace">
      <header className="dashboard-header service-view-header epr-header">
        <div>
          <p className="eyebrow">EPR workspace</p>
          <h1>Executive Protection Readiness</h1>
          <p>
            Dedicated workspace for executive protection, field travel, hotel safety intelligence, incident risk,
            security mitigation, and readiness governance. Command Center remains a separate operational tab.
          </p>
        </div>
        <StatusPill label={eprState.loading ? 'LOADING' : eprState.error ? 'DATA ISSUE' : 'DATA LOADED'} tone={eprState.error ? 'critical' : eprState.loading ? 'buildout' : 'ready'} />
      </header>

      {eprState.loading ? <StatePanel title="Loading EPR data package" message="Preparing the analyzed executive protection, travel, hotel, incident, and mitigation data." /> : null}
      {eprState.error ? <StatePanel title="EPR data unavailable" message={eprState.error} tone="critical" /> : null}

      {eprData ? (
        <>
          <div className="epr-tab-toolbar">
            <nav className="epr-tab-bar" aria-label="Executive Protection Readiness sub tabs">
              {tabs.map((tab) => (
                <button className={tab.id === activeTab ? 'epr-tab active' : 'epr-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={tab.id === activeTab}>
                  <span>{tab.eyebrow}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
            <button className="epr-reset-layout-button" type="button" onClick={resetEprResizableLayout}>Reset Layout</button>
          </div>

          {activeTab === 'visits' ? <VisitPlannerTab data={eprData} /> : null}
          {activeTab === 'hotels' ? <HotelIntelligenceTab data={eprData} /> : null}
          {activeTab === 'incidents' ? <IncidentRiskTab data={eprData} /> : null}
          {activeTab === 'mitigation' ? <MitigationTab data={eprData} allStores={eprState.data?.field_operations.facilities ?? eprData.field_operations.facilities} /> : null}
        </>
      ) : null}
    </section>
  );
}

function OverviewTab({ data, topRiskFacilities, onTabSelect }: { data: EprData; topRiskFacilities: EprFacility[]; onTabSelect: (tab: EprTab) => void }) {
  const kpis = data.kpis;
  return (
    <>
      <section className="dashboard-grid epr-grid" aria-label="EPR overview detail">
        <section className="panel selected-service-panel">
          <div className="card-heading service-heading">
            <div>
              <p className="eyebrow">Operating picture</p>
              <h2>Executive travel, facility visit, hotel safety, incident risk, and mitigation readiness.</h2>
            </div>
            <StatusPill label="IMPLEMENTED" tone="ready" />
          </div>
          <p>Use this workspace to identify visit-priority facilities, validate hotel safety options, review incident exposure, and keep mitigation tasks moving with clear ownership.</p>
          <div className="service-meta-grid service-live-metrics">
            {data.executive_summary.modules.map((module) => (
              <div key={module}><span>Module</span><strong>{module}</strong></div>
            ))}
          </div>
        </section>

        <section className="panel top-risk-panel">
          <div className="card-heading"><div><p className="eyebrow">Field risk</p><h2>Highest visit-priority facilities</h2></div></div>
          <div className="top-risk-list">
            {topRiskFacilities.map((facility) => (
              <div className="top-risk-item readonly" key={facility.facility_id}>
                <div><strong>{facility.facility_name}</strong><span>{facility.market} • {facility.region}</span></div>
                <StatusPill label={`RISK ${Math.round(facility.risk_score)}`} tone={facility.risk_score >= 70 ? 'watch' : 'stable'} />
                <p>{facility.open_task_count} open tasks · {facility.overdue_task_count} overdue · {facility.critical_task_count} critical</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel module-map-panel">
          <div className="card-heading"><div><p className="eyebrow">Readiness focus</p><h2>What leaders should review first</h2></div><StatusPill label="DECISION VIEW" tone="ready" /></div>
          <div className="module-map">
            {[
              { label: 'Visit route risk', tab: 'visits' as EprTab, helper: 'Build a draft route and identify critical/overdue task exposure.' },
              { label: 'Hotel safety options', tab: 'hotels' as EprTab, helper: 'Review hotel safety scoring, preferred options, and travel handoff context.' },
              { label: 'Incident exposure', tab: 'incidents' as EprTab, helper: 'Inspect recent incident patterns that may affect executive movement.' },
              { label: 'Open critical tasks', tab: 'tasks' as EprTab, helper: 'Prioritize owner follow-up, SLA risk, and evidence requirements.' },
              { label: 'Mitigation options', tab: 'mitigation' as EprTab, helper: 'Compare recommended controls and prevention value.' },
              { label: 'Owner follow-up', tab: 'tasks' as EprTab, helper: 'Coordinate accountability and readiness governance actions.' },
            ].map((item) => (
              <button className="module-chip epr-review-chip" type="button" key={item.label} onClick={() => onTabSelect(item.tab)}><StatusPill label="OPEN" tone="stable" /><strong>{item.label}</strong><small>{item.helper}</small></button>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

function VisitPlannerTab({ data }: { data: EprData }) {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [briefOpen, setBriefOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const facilities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...data.visit_planner.route_facilities]
      .filter((facility) => riskFilter === 'all' || (riskFilter === 'critical' ? facility.risk_score >= 80 : riskFilter === 'high' ? facility.risk_score >= 70 && facility.risk_score < 80 : facility.risk_score < 70))
      .filter((facility) => !term || [facility.facility_name, facility.facility_id, facility.market, facility.region, facility.city, facility.state].join(' ').toLowerCase().includes(term))
      .sort((a, b) => b.risk_score - a.risk_score);
  }, [data.visit_planner.route_facilities, riskFilter, search]);
  const selectedRoute = useMemo(() => selectedRouteIds.map((id) => data.visit_planner.route_facilities.find((facility) => facility.facility_id === id)).filter((facility): facility is EprFacility => Boolean(facility)), [data.visit_planner.route_facilities, selectedRouteIds]);
  const addToRoute = (facility: EprFacility) => setSelectedRouteIds((current) => current.includes(facility.facility_id) ? current : [...current, facility.facility_id]);
  const removeFromRoute = (facilityId: number) => setSelectedRouteIds((current) => current.filter((id) => id !== facilityId));

  return (
    <section className="dashboard-grid epr-grid epr-visit-grid">
      <section className="panel fire-facilities-panel epr-resizable-panel" data-resizable-panel="visit-route-queue" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Route queue</p><h2>Facilities available for executive/field visit planning</h2></div><StatusPill label={`${facilities.length} MATCHES`} tone="stable" /></div>
        <div className="epr-controls"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search facility, market, region, city" /><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="all">All risk levels</option><option value="critical">Critical risk 80+</option><option value="high">High risk 70-79</option><option value="moderate">Moderate risk below 70</option></select></div>
        <div className="epr-table-shell"><table><thead><tr><th>Facility</th><th>Market</th><th>Risk</th><th>Tasks</th><th>Route</th></tr></thead><tbody>{facilities.map((facility) => <FacilityRow facility={facility} key={facility.facility_id} onAdd={addToRoute} selected={selectedRouteIds.includes(facility.facility_id)} />)}</tbody></table></div>
      </section>
      <section className="panel epr-route-panel epr-resizable-panel" data-resizable-panel="visit-draft-route" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Draft route</p><h2>Selected visit route and handoff summary</h2></div><StatusPill label="MOCK ONLY" tone="track" /></div>
        {selectedRoute.length === 0 ? <p className="epr-empty-state">No facilities selected yet. Add facilities from the route queue to build a draft visit route.</p> : <div className="epr-route-body"><RouteMap facilities={selectedRoute} /><div className="epr-route-list">{selectedRoute.map((facility, index) => <article key={facility.facility_id}><div><span>{String(index + 1).padStart(2, '0')}</span><strong>{facility.facility_name}</strong><small>{facility.market} · {facility.region} · Risk {Math.round(facility.risk_score)}</small></div><button className="epr-action-button secondary" type="button" onClick={() => removeFromRoute(facility.facility_id)}>Remove</button></article>)}</div></div>}
        <div className="epr-draft-actions"><button className="epr-action-button" type="button" disabled={selectedRoute.length === 0} onClick={() => setBriefOpen(true)}>Create Visit Brief</button><details className="epr-export-menu"><summary className="epr-action-button" aria-disabled={selectedRoute.length === 0} role="button">Export Route ▾</summary><div className="epr-export-menu-list" role="menu"><button type="button" role="menuitem" disabled={selectedRoute.length === 0} onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); triggerDownload(exportRouteCsv(selectedRoute)); }}><strong>Spreadsheet (CSV)</strong><span>One row per stop · Excel-friendly</span></button><button type="button" role="menuitem" disabled={selectedRoute.length === 0} onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); triggerDownload(exportRouteGpx(selectedRoute)); }}><strong>GPS route (GPX)</strong><span>Import into Google Maps / Garmin / Apple Maps</span></button><button type="button" role="menuitem" disabled={selectedRoute.length === 0} onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); triggerDownload(exportRouteIcs(selectedRoute)); }}><strong>Calendar invites (ICS)</strong><span>One event per stop · Outlook / Google Cal</span></button><button type="button" role="menuitem" disabled={selectedRoute.length === 0} onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); triggerDownload(exportRouteJson(selectedRoute)); }}><strong>Raw data (JSON)</strong><span>For dashboards / API consumers</span></button></div></details><button className="epr-action-button secondary" type="button" disabled={selectedRoute.length === 0} onClick={() => setHandoffOpen(true)}>Send Handoff (mock)</button></div>
        <p className="epr-disclaimer">Draft only — no calendar export, notification, booking, or production workflow is triggered.</p>
      </section>
      {briefOpen && (
        <VisitBriefWizard
          facilities={selectedRoute}
          hotels={data.hotel_intelligence.hotels}
          incidents={data.incident_intelligence.recent_incident_sample}
          tasks={data.tasks_governance.tasks}
          onClose={() => setBriefOpen(false)}
        />
      )}
      {handoffOpen && (
        <HandoffModal
          route={selectedRoute}
          onClose={() => setHandoffOpen(false)}
        />
      )}
    </section>
  );
}

function HotelIntelligenceTab({ data }: { data: EprData }) {
  const [selectedHotel, setSelectedHotel] = useState<EprHotel | null>(null);
  const scoring = data.hotel_intelligence.safety_scoring;
  const weights = scoring.weights && typeof scoring.weights === 'object' ? Object.entries(scoring.weights as Record<string, number>) : [];
  // Filters intentionally hidden per product request — show all hotels, ranked by safety then preferred status then price.
  const hotels = useMemo(() => [...data.hotel_intelligence.hotels].sort((a, b) => {
    const safetyDelta = hotelSafetyScore(b) - hotelSafetyScore(a);
    if (safetyDelta !== 0) return safetyDelta;
    const preferredDelta = Number(b.walmart_preferred) - Number(a.walmart_preferred);
    if (preferredDelta !== 0) return preferredDelta;
    return a.price_per_night - b.price_per_night;
  }), [data.hotel_intelligence.hotels]);
  const selectedDraft = selectedHotel ? createHotelDraft(selectedHotel) : null;

  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Travel safety intelligence</p><h2>Hotel Safety Intelligence + travel handoff</h2></div><StatusPill label="SAFETY SCORED" tone="ready" /></div>
        <p>Hotels are ranked by safety score first, Walmart-preferred status second, and price third. Use the filters to create a mock travel recommendation without booking or contacting a travel team.</p>
        <div className="service-meta-grid">
          {weights.map(([label, weight]) => <div key={label}><span>{formatLabel(label)}</span><strong>{Math.round(Number(weight) * 100)}%</strong></div>)}
        </div>
      </section>
      <section className="panel epr-hotel-draft-panel epr-resizable-panel" data-resizable-panel="hotel-draft" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Mock workflow</p><h2>Travel recommendation draft</h2></div><StatusPill label="DRAFT ONLY" tone="track" /></div>
        <HotelDraftPanel draft={selectedDraft} onClear={() => setSelectedHotel(null)} />
      </section>
      <section className="epr-hotel-grid">
        {hotels.map((hotel) => <HotelCard hotel={hotel} key={hotel.hotel_id} onShortlist={setSelectedHotel} selected={selectedHotel?.hotel_id === hotel.hotel_id} />)}
      </section>
    </section>
  );
}

function IncidentRiskTab({ data }: { data: EprData }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState<EprIncidentDraft | null>(null);
  const incidentTypes = Array.from(new Set(data.incident_intelligence.recent_incident_sample.map((incident) => incident.incident_type))).sort();
  const severities = Array.from(new Set(data.incident_intelligence.recent_incident_sample.map((incident) => String(incident.severity)))).sort();
  const states = Array.from(new Set(data.incident_intelligence.recent_incident_sample.map((incident) => incident.state).filter((state): state is string => Boolean(state)))).sort();
  const filteredIncidents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.incident_intelligence.recent_incident_sample
      .filter((incident) => typeFilter === 'all' || incident.incident_type === typeFilter)
      .filter((incident) => severityFilter === 'all' || String(incident.severity) === severityFilter)
      .filter((incident) => stateFilter === 'all' || incident.state === stateFilter)
      .filter((incident) => !term || [incident.id, incident.facility_id, incident.incident_type, incident.description, incident.city, incident.state, incident.region, incident.market].join(' ').toLowerCase().includes(term))
      .slice(0, 25);
  }, [data.incident_intelligence.recent_incident_sample, search, severityFilter, stateFilter, typeFilter]);

  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Incident intelligence</p><h2>Risk signals for executive movement and facility visits</h2></div><StatusPill label={`${formatNumber(data.kpis.incident_records)} INCIDENTS`} tone="watch" /></div>
        <p>Filter recent incident signals, identify movement risk, and create mock coordination drafts for review. Drafts remain local-only and do not send messages or create production tickets.</p>
        <div className="service-meta-grid service-live-metrics">
          {data.incident_intelligence.incident_type_counts.slice(0, 5).map(([type, count]) => <div key={type}><span>{type}</span><strong>{count}</strong></div>)}
        </div>
      </section>
      <section className="panel fire-signals-panel epr-resizable-panel" data-resizable-panel="incident-records" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Recent sample</p><h2>Recent incident records</h2></div><StatusPill label={`${filteredIncidents.length} MATCHES`} tone="stable" /></div>
        <div className="epr-controls epr-incident-controls"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents, store, city, description" /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All incident types</option>{incidentTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select><select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="all">All severities</option>{severities.map((severity) => <option value={severity} key={severity}>Severity {severity}</option>)}</select><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="all">All states</option>{states.map((state) => <option value={state} key={state}>{state}</option>)}</select></div>
        <RecordList incidents={filteredIncidents} onCreateDraft={(incident) => setSelectedDraft(createIncidentDraft(incident))} />
      </section>
      <section className="panel epr-incident-draft-panel epr-resizable-panel" data-resizable-panel="incident-draft" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Mock workflow</p><h2>Incident communication and ticket draft</h2></div><StatusPill label="DRAFT ONLY" tone="track" /></div>
        <IncidentDraftPanel draft={selectedDraft} onClear={() => setSelectedDraft(null)} />
      </section>
    </section>
  );
}

function MitigationTab({ data, allStores }: { data: EprData; allStores: EprFacility[] }) {
  const [storeFilter, setStoreFilter] = useState('all');
  const [selectedSolution, setSelectedSolution] = useState<EprSecuritySolution | null>(null);
  // Catalog is intentionally not filtered — store selection is contextual (which store you're shopping for) and surfaces in the draft panel.
  // Store list is the FULL unscoped facility set, so this picker is never narrowed by any dashboard-level scope chip.
  const solutions = useMemo(() => [...data.security_mitigation.solutions].sort((a, b) => b.effectiveness_rating - a.effectiveness_rating), [data.security_mitigation.solutions]);
  const stores = useMemo(() => [...allStores].sort((a, b) => a.facility_name.localeCompare(b.facility_name)), [allStores]);
  const selectedStore = storeFilter === 'all' ? null : stores.find((store) => String(store.facility_id) === storeFilter) ?? null;
  // Incidents at the selected store — always pulled from the FULL unscoped mitigation incident list so dashboard scope filters can't hide them.
  const storeIncidents = useMemo(() => {
    if (!selectedStore) return [];
    return data.security_mitigation.incidents
      .filter((incident) => Number(incident.facility_id) === Number(selectedStore.facility_id))
      .map((incident) => ({ incident, cost: incidentCostEstimate(incident) }))
      .sort((a, b) => b.cost - a.cost);
  }, [data.security_mitigation.incidents, selectedStore]);
  const storeIncidentTotal = storeIncidents.reduce((sum, row) => sum + row.cost, 0);
  // Aggregate distinct incident types at this store, mapped to event counts — fuels both suggestion and vendor-fallback logic.
  const storeIncidentTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { incident } of storeIncidents) counts.set(incident.incident_type, (counts.get(incident.incident_type) ?? 0) + 1);
    return counts;
  }, [storeIncidents]);
  const suggestions = useMemo(() => getStoreSuggestions(storeIncidentTypes, solutions), [solutions, storeIncidentTypes]);
  // KPI math for the picker panel: recommended solution cost + projected ROI vs the incident-impact bleed.
  // Effectiveness is averaged across recommended solutions and applied to total incident cost as the "loss prevented" estimate.
  const recommendedSolutions = useMemo(() => solutions.filter((solution) => suggestions.recommendedSolutionIds.has(solution.id)), [solutions, suggestions.recommendedSolutionIds]);
  const recommendedSolutionCost = recommendedSolutions.reduce((sum, solution) => sum + solutionFiveYearCost(solution), 0);
  const avgRecommendedEffectiveness = recommendedSolutions.length > 0 ? recommendedSolutions.reduce((sum, solution) => sum + solution.effectiveness_rating, 0) / recommendedSolutions.length : 0;
  const projectedLossPrevented = Math.round(storeIncidentTotal * (avgRecommendedEffectiveness / 100));
  const estimatedNetImpact = projectedLossPrevented - recommendedSolutionCost;
  const selectedDraft = selectedSolution ? createMitigationDraft(selectedSolution, selectedStore?.facility_name) : null;

  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Security Mitigation Manager</p><h2>Recommended controls and projected-prevention ROI</h2></div><StatusPill label="RULES MAPPED" tone="ready" /></div>
        <p>Security mitigation recommendations are staged here for potential execution in store.</p>
      </section>
      <section className="panel epr-store-picker-panel">
        <div className="card-heading"><div><p className="eyebrow">Pick a store</p><h2>Score solutions for a specific facility</h2></div>{selectedStore ? <StatusPill label={`SCOPED — ${selectedStore.facility_name}`} tone="ready" /> : null}</div>
        <div className="epr-controls epr-mitigation-controls">
          <label className="epr-store-picker"><span>Select your store</span><select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} aria-label="Select your store"><option value="all">— Choose a store —</option>{stores.map((store) => <option value={String(store.facility_id)} key={store.facility_id}>{store.facility_name} — {store.market}</option>)}</select></label>
        </div>
      </section>
      {selectedStore ? (
        <section className="panel epr-store-incidents-panel">
          <div className="card-heading">
            <div><p className="eyebrow">Store impact</p><h2>Recent incidents at {selectedStore.facility_name}</h2></div>
            <StatusPill label={`${storeIncidents.length} EVENTS · ${formatCurrency(storeIncidentTotal)} EST IMPACT`} tone={storeIncidentTotal > 200000 ? 'critical' : storeIncidentTotal > 75000 ? 'watch' : 'stable'} />
          </div>
          <p>Estimated cost-per-event reflects direct loss + law-enforcement response + investigation time + EAP / legal exposure, scaled by reported severity. Use the totals to size the case for the controls below.</p>
          {storeIncidents.length === 0 ? <p className="epr-empty-state">No mitigation incidents on file for {selectedStore.facility_name}. 🎉</p> : (
            <div className="epr-store-incidents-table">
              <table>
                <thead><tr><th>Date</th><th>Incident type</th><th>Severity</th><th style={{ textAlign: 'right' }}>Est. cost to Walmart</th></tr></thead>
                <tbody>
                  {storeIncidents.map(({ incident, cost }) => (
                    <tr key={incident.id}>
                      <td>{incident.incident_date ?? '—'}<small>{incident.incident_time ?? ''}</small></td>
                      <td><strong>{incident.incident_type}</strong>{incident.description ? <small>{incident.description.length > 140 ? `${incident.description.slice(0, 140)}…` : incident.description}</small> : null}</td>
                      <td><StatusPill label={severityLabel(incident.severity)} tone={severityTone(incident.severity)} /></td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{formatCurrency(cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>Total estimated impact</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{formatCurrency(storeIncidentTotal)}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
          {(suggestions.recommendedSolutionIds.size > 0 || suggestions.vendorFallbacks.length > 0) ? (
            <div className="epr-suggestions-block">
              {suggestions.recommendedSolutionIds.size > 0 ? (
                <div className="epr-suggestions-internal">
                  <h3>✨ Suggested controls from the catalog</h3>
                  <ul>
                    {[...suggestions.recommendedSolutionIds].map((id) => {
                      const solution = solutions.find((entry) => entry.id === id);
                      return solution ? <li key={id}><strong>{solution.name}</strong> — {solution.effectiveness_rating}% effective · 5-yr base {formatCurrency(solutionFiveYearCost(solution))}</li> : null;
                    })}
                  </ul>
                </div>
              ) : null}
              {suggestions.vendorFallbacks.length > 0 ? (
                <div className="epr-suggestions-vendor">
                  <h3>🔎 No internal control mapped — explore Vendor Intelligence</h3>
                  <ul>
                    {suggestions.vendorFallbacks.map((entry) => (
                      <li key={entry.incidentType}><strong>{entry.incidentType}</strong> ({entry.eventCount} event{entry.eventCount === 1 ? '' : 's'}): {entry.hint}</li>
                    ))}
                  </ul>
                  <p className="epr-vendor-pointer">Open the <b>Vendor Intelligence</b> module from the main nav to search the 1,663-vendor SENTRY tracker for these capabilities.</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="panel fire-remediation-panel">
        <div className="card-heading"><div><p className="eyebrow">Solutions catalog</p><h2>Mitigation option shortlist</h2></div><StatusPill label={selectedStore && suggestions.recommendedSolutionIds.size > 0 ? `${suggestions.recommendedSolutionIds.size} RECOMMENDED · ${solutions.length} TOTAL` : `${solutions.length} SOLUTIONS`} tone={selectedStore && suggestions.recommendedSolutionIds.size > 0 ? 'ready' : 'stable'} /></div>
        <div className="epr-card-list">{solutions.length === 0 ? <p className="epr-empty-state">No mitigation options available.</p> : solutions.map((solution) => <SolutionCard solution={solution} key={solution.id} onShortlist={setSelectedSolution} selected={selectedSolution?.id === solution.id} recommended={suggestions.recommendedSolutionIds.has(solution.id)} />)}</div>
      </section>
      <section className="panel epr-mitigation-draft-panel epr-resizable-panel" data-resizable-panel="mitigation-draft" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Mock workflow</p><h2>Mitigation comparison and governance draft</h2></div><StatusPill label="DRAFT ONLY" tone="track" /></div>
        <MitigationDraftPanel draft={selectedDraft} onClear={() => setSelectedSolution(null)} />
      </section>
    </section>
  );
}

function TasksGovernanceTab({ data }: { data: EprData }) {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [evidenceFilter, setEvidenceFilter] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState<EprTaskDraft | null>(null);
  const allTasks = useMemo(() => [...data.tasks_governance.tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)), [data.tasks_governance.tasks]);
  const priorities = Array.from(new Set(allTasks.map((task) => task.priority))).sort((a, b) => priorityRank(a) - priorityRank(b));
  const statuses = Array.from(new Set(allTasks.map((task) => task.status))).sort();
  const owners = Array.from(new Set(allTasks.map((task) => task.owner_name))).sort();
  const tasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allTasks
      .filter((task) => priorityFilter === 'all' || task.priority === priorityFilter)
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => ownerFilter === 'all' || task.owner_name === ownerFilter)
      .filter((task) => evidenceFilter === 'all' || (evidenceFilter === 'required' ? task.evidence_required : !task.evidence_required))
      .filter((task) => !term || [task.task_id, task.title, task.description, task.facility_id, task.facility_name, task.owner_name, task.owner_role, task.market, task.region, task.status, task.priority].join(' ').toLowerCase().includes(term));
  }, [allTasks, evidenceFilter, ownerFilter, priorityFilter, search, statusFilter]);

  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Readiness action queue</p><h2>Task ownership, remediation state, evidence, and SLA governance</h2></div><StatusPill label="WORKFLOW" tone="track" /></div>
        <p>Filter ownership, evidence, status, and priority to identify follow-up needs. Drafts are mock-only and do not update task status or notify owners.</p>
        <div className="service-meta-grid service-live-metrics">
          <div><span>Total tasks</span><strong>{data.kpis.tasks}</strong></div>
          <div><span>Remediations</span><strong>{data.kpis.remediations}</strong></div>
          <div><span>Critical</span><strong>{allTasks.filter((task) => task.priority === 'Critical').length}</strong></div>
          <div><span>Evidence required</span><strong>{allTasks.filter((task) => task.evidence_required).length}</strong></div>
          <div><span>Owners</span><strong>{new Set(allTasks.map((task) => task.owner_name)).size}</strong></div>
        </div>
      </section>
      <section className="panel fire-workqueue-panel epr-resizable-panel" data-resizable-panel="task-queue" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Task queue</p><h2>Priority task sample</h2></div><StatusPill label={`${tasks.length} MATCHES`} tone="stable" /></div>
        <div className="epr-controls epr-task-controls"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, owners, facilities" /><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option>{priorities.map((priority) => <option value={priority} key={priority}>{priority}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select><select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="all">All owners</option>{owners.map((owner) => <option value={owner} key={owner}>{owner}</option>)}</select><select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value)}><option value="all">All evidence states</option><option value="required">Evidence required</option><option value="not-required">No evidence required</option></select></div>
        <div className="epr-table-shell"><table><thead><tr><th>Task</th><th>Owner</th><th>Priority</th><th>Status</th><th>Follow-up</th></tr></thead><tbody>{tasks.slice(0, 25).map((task) => <TaskRow task={task} key={task.task_id} onCreateDraft={(item) => setSelectedDraft(createTaskDraft(item))} />)}</tbody></table></div>
      </section>
      <section className="panel epr-task-draft-panel epr-resizable-panel" data-resizable-panel="task-draft" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Mock workflow</p><h2>Owner follow-up and governance draft</h2></div><StatusPill label="DRAFT ONLY" tone="track" /></div>
        <TaskDraftPanel draft={selectedDraft} onClear={() => setSelectedDraft(null)} />
      </section>
    </section>
  );
}

function SourceAnalysisTab({ data }: { data: EprData }) {
  const [search, setSearch] = useState('');
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('path');
  const extensions = Array.from(new Set(data.source_inventory.map((item) => item.extension))).sort();
  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...data.source_inventory]
      .filter((item) => extensionFilter === 'all' || item.extension === extensionFilter)
      .filter((item) => sizeFilter === 'all' || (sizeFilter === 'small' ? item.bytes < 100000 : sizeFilter === 'medium' ? item.bytes >= 100000 && item.bytes < 1000000 : item.bytes >= 1000000))
      .filter((item) => !term || [item.path, item.extension, item.bytes].join(' ').toLowerCase().includes(term))
      .sort((a, b) => sortBy === 'size' ? b.bytes - a.bytes : sortBy === 'type' ? a.extension.localeCompare(b.extension) : a.path.localeCompare(b.path));
  }, [data.source_inventory, extensionFilter, search, sizeFilter, sortBy]);
  const groups = filteredInventory.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.extension] = (accumulator[item.extension] ?? 0) + 1;
    return accumulator;
  }, {});
  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Completed file analysis</p><h2>Every source asset was inventoried and mapped</h2></div><StatusPill label="COMPLETE" tone="ready" /></div>
        <p>{data.metadata.classification}</p>
        <div className="service-meta-grid service-live-metrics">
          <div><span>Filtered files</span><strong>{filteredInventory.length}</strong></div>
          <div><span>Total files</span><strong>{data.source_inventory.length}</strong></div>
          <div><span>Environment</span><strong>{data.metadata.data_environment}</strong></div>
          {Object.entries(groups).slice(0, 4).map(([extension, count]) => <div key={extension}><span>{extension}</span><strong>{count}</strong></div>)}
        </div>
      </section>
      <section className="panel fire-facilities-panel epr-resizable-panel" data-resizable-panel="source-inventory" onMouseUp={saveResizablePanelSize} onTouchEnd={saveResizablePanelSize}>
        <div className="card-heading"><div><p className="eyebrow">Inventory</p><h2>Analyzed source files</h2></div><StatusPill label={`${filteredInventory.length} MATCHES`} tone="stable" /></div>
        <div className="epr-controls epr-source-controls"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search source path, type, size" /><select value={extensionFilter} onChange={(event) => setExtensionFilter(event.target.value)}><option value="all">All file types</option>{extensions.map((extension) => <option value={extension} key={extension}>{extension}</option>)}</select><select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}><option value="all">All sizes</option><option value="small">Under 100KB</option><option value="medium">100KB-1MB</option><option value="large">1MB+</option></select><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="path">Sort by path</option><option value="type">Sort by type</option><option value="size">Sort by size</option></select></div>
        <div className="epr-table-shell"><table><thead><tr><th>Path</th><th>Type</th><th>Size</th></tr></thead><tbody>{filteredInventory.length === 0 ? <tr><td colSpan={3}>No source files match the current filters.</td></tr> : filteredInventory.map((item) => <tr key={item.path}><td><strong>{item.path}</strong></td><td>{item.extension}</td><td>{formatNumber(item.bytes)} B</td></tr>)}</tbody></table></div>
      </section>
    </section>
  );
}

function FacilityRow({ facility, onAdd, selected = false }: { facility: EprFacility; onAdd?: (facility: EprFacility) => void; selected?: boolean }) {
  return <tr><td><strong>{facility.facility_name}</strong><small>{facility.facility_id}</small></td><td>{facility.market}<small>{facility.region}</small></td><td>{Math.round(facility.risk_score)}</td><td>{facility.open_task_count} open / {facility.overdue_task_count} overdue</td>{onAdd ? <td><button className="epr-action-button" type="button" onClick={() => onAdd(facility)} disabled={selected}>{selected ? 'Added' : 'Add to Route'}</button></td> : null}</tr>;
}

function HotelCard({ hotel, onShortlist, selected = false }: { hotel: EprHotel; onShortlist?: (hotel: EprHotel) => void; selected?: boolean }) {
  const safety = hotelSafetyScore(hotel);
  return (
    <article className={selected ? 'panel epr-hotel-card selected' : 'panel epr-hotel-card'}>
      {hotel.image_url ? <img src={hotel.image_url} alt="" loading="lazy" /> : null}
      <div className="card-heading"><div><p className="eyebrow">{hotel.brand}</p><h2>{hotel.name}</h2></div><StatusPill label={`${safety}/100`} tone={safety >= 85 ? 'ready' : 'watch'} /></div>
      <p>{hotel.address}, {hotel.city}, {hotel.state}</p>
      <div className="service-meta-grid">
        <div><span>Rate</span><strong>${hotel.price_per_night.toFixed(2)}</strong></div>
        <div><span>Rating</span><strong>{hotel.rating}</strong></div>
        <div><span>Crime index</span><strong>{hotel.safety_score?.crime_index ?? 'N/A'}</strong></div>
      </div>
      <div className="badge-list">{hotel.walmart_preferred ? <span className="scope-chip selected">Walmart preferred</span> : null}{hotel.safety_score?.safety_features.slice(0, 4).map((feature) => <span className="scope-chip selected" key={feature}>{feature}</span>)}</div>
      {onShortlist ? <button className="epr-action-button epr-card-action" type="button" onClick={() => onShortlist(hotel)}>{selected ? 'Shortlisted' : 'Shortlist Hotel'}</button> : null}
    </article>
  );
}

function HotelDraftPanel({ draft, onClear }: { draft: EprHotelDraft | null; onClear: () => void }) {
  if (!draft) return <p className="epr-empty-state">Select <b>Shortlist Hotel</b> from a hotel card to generate a mock travel recommendation. No booking or travel-team communication will be triggered.</p>;
  return <article className="epr-draft-panel"><div className="epr-draft-header"><div><StatusPill label={draft.priority} tone={draft.priority === 'Preferred' ? 'ready' : 'watch'} /><StatusPill label="MOCK ONLY" tone="stable" /></div><button className="epr-action-button secondary" type="button" onClick={onClear}>Clear Draft</button></div><div className="service-meta-grid service-live-metrics epr-draft-grid"><div><span>Hotel</span><strong>{draft.hotelName}</strong></div><div><span>Status</span><strong>Draft</strong></div><div><span>Source</span><strong>{draft.id.replace('hotel-draft-', '')}</strong></div></div><h3>{draft.subject}</h3><p>{draft.summary}</p><h4>Recommendation</h4><p>{draft.recommendation}</p><h4>Evidence needed</h4><div className="badge-list">{draft.evidenceNeeded.map((item) => <span className="scope-chip selected" key={item}>{item}</span>)}</div><h4>Requested response</h4><p>{draft.requestedResponse}</p><div className="epr-draft-actions"><button className="epr-action-button" type="button" disabled>Prepare Travel Recommendation — Mock Only</button><button className="epr-action-button" type="button" disabled>Send to Travel Team — Mock Only</button><button className="epr-action-button secondary" type="button" disabled>Book Hotel — Disabled</button></div><p className="epr-disclaimer">Draft only — no booking, travel-team communication, or production workflow is triggered.</p></article>;
}

function createHotelDraft(hotel: EprHotel): EprHotelDraft {
  const safety = hotelSafetyScore(hotel);
  return {
    id: `hotel-draft-${hotel.hotel_id}`,
    priority: hotel.walmart_preferred && safety >= 85 ? 'Preferred' : 'Review',
    hotelName: hotel.name,
    subject: `EPR Travel Safety Recommendation — ${hotel.name}`,
    summary: `${hotel.name} in ${hotel.city}, ${hotel.state} has a safety score of ${safety}/100, rating ${hotel.rating}, and nightly rate ${formatCurrency(hotel.price_per_night)}. ${hotel.walmart_preferred ? 'This option is marked Walmart preferred.' : 'This option is not marked Walmart preferred and should be reviewed before selection.'}`,
    recommendation: safety >= 85 ? 'Recommended for shortlist pending travel-team validation, route context, and executive movement timing.' : 'Review before selection due to safety score or preference status; compare against higher-scored options before handoff.',
    evidenceNeeded: ['Safety score', 'Hotel preference status', 'Rate and rating', 'Distance/route context', 'Travel-team validation'],
    requestedResponse: 'Please validate whether this hotel is appropriate for the visit itinerary and confirm any booking constraints or safety concerns. This is a mock-only recommendation draft.',
  };
}

function hotelSafetyScore(hotel: EprHotel): number {
  return hotel.safety_score?.overall_score ?? 0;
}

function RecordList({ incidents, onCreateDraft }: { incidents: EprIncident[]; onCreateDraft?: (incident: EprIncident) => void }) {
  if (incidents.length === 0) return <p className="epr-empty-state">No incident records match the current filters.</p>;
  return <div className="facility-record-list">{incidents.map((incident) => <div className="facility-record epr-incident-record" key={incident.id}><div><strong>{incident.incident_type}</strong><span>{incident.facility_id ? `Store #${incident.facility_id}` : 'Security incident'} · {incident.city || 'Unknown'}, {incident.state || 'N/A'} · Severity {incident.severity}</span><small>{incident.description}</small></div>{onCreateDraft ? <button className="epr-action-button" type="button" onClick={() => onCreateDraft(incident)}>Create Draft</button> : null}</div>)}</div>;
}

function createIncidentDraft(incident: EprIncident): EprIncidentDraft {
  const priority = incidentPriority(incident);
  return {
    id: `incident-draft-${incident.id}`,
    priority,
    owner: incidentOwner(incident),
    subject: `${priority} EPR Incident Review Needed — ${incident.facility_id ? `Store ${incident.facility_id}` : incident.city || 'Unassigned Location'}`,
    summary: `${incident.incident_type} signal recorded for ${incident.facility_id ? `Store ${incident.facility_id}` : 'an executive protection context'} in ${incident.city || 'Unknown'}, ${incident.state || 'N/A'}. Severity is ${incident.severity}.`,
    evidenceNeeded: ['Incident record', 'Location context', 'Executive movement impact', 'Store/field partner validation', 'Mitigation or follow-up owner'],
    requestedResponse: 'Please validate the incident context, confirm whether it affects executive movement or facility visit readiness, and provide disposition, owner, and mitigation status. This is a mock-only draft.',
    recommendedAction: incidentRecommendedAction(incident),
  };
}

function IncidentDraftPanel({ draft, onClear }: { draft: EprIncidentDraft | null; onClear: () => void }) {
  if (!draft) return <p className="epr-empty-state">Select <b>Create Draft</b> from an incident record to generate a mock communication or ticket draft. No production workflow will be triggered.</p>;
  return <article className="epr-draft-panel"><div className="epr-draft-header"><div><StatusPill label={draft.priority} tone={draft.priority === 'P1' ? 'critical' : draft.priority === 'P2' ? 'watch' : 'stable'} /><StatusPill label="MOCK ONLY" tone="stable" /></div><button className="epr-action-button secondary" type="button" onClick={onClear}>Clear Draft</button></div><div className="service-meta-grid service-live-metrics epr-draft-grid"><div><span>Recommended owner</span><strong>{draft.owner}</strong></div><div><span>Status</span><strong>Draft</strong></div><div><span>Source</span><strong>Incident #{draft.id.replace('incident-draft-', '')}</strong></div></div><h3>{draft.subject}</h3><p>{draft.summary}</p><h4>Recommended action</h4><p>{draft.recommendedAction}</p><h4>Evidence needed</h4><div className="badge-list">{draft.evidenceNeeded.map((item) => <span className="scope-chip selected" key={item}>{item}</span>)}</div><h4>Requested response</h4><p>{draft.requestedResponse}</p><div className="epr-draft-actions"><button className="epr-action-button" type="button" disabled>Create Ticket — Mock Only</button><button className="epr-action-button" type="button" disabled>Send Communication — Mock Only</button><button className="epr-action-button secondary" type="button" disabled>Copy Draft — Coming Soon</button></div><p className="epr-disclaimer">Draft only — no production communication is sent and no ticket is created.</p></article>;
}

function incidentPriority(incident: EprIncident): 'P1' | 'P2' | 'P3' {
  const severity = Number(incident.severity);
  const type = incident.incident_type.toLowerCase();
  if (severity >= 4 || type.includes('weapon') || type.includes('violence') || type.includes('assault')) return 'P1';
  if (severity >= 3 || type.includes('theft') || type.includes('trespass')) return 'P2';
  return 'P3';
}

function incidentOwner(incident: EprIncident): string {
  const type = incident.incident_type.toLowerCase();
  if (type.includes('weapon') || type.includes('violence') || type.includes('assault')) return 'RASA / Risk Intelligence';
  if (type.includes('camera') || type.includes('access') || type.includes('alarm')) return 'Security Technology';
  if (type.includes('fire') || type.includes('life')) return 'Enterprise / Life Safety';
  return 'Store-Facing Partners';
}

function incidentRecommendedAction(incident: EprIncident): string {
  const priority = incidentPriority(incident);
  if (priority === 'P1') return 'Escalate for immediate EPR review, validate location context, and confirm whether route, visit timing, or protective posture should change.';
  if (priority === 'P2') return 'Assign an owner to validate the record, check repeat-location context, and determine whether additional mitigation is needed before travel.';
  return 'Track for awareness, confirm no active executive movement impact, and document any required store-facing follow-up.';
}

function SolutionCard({ solution, onShortlist, selected = false, recommended = false }: { solution: EprSecuritySolution; onShortlist?: (solution: EprSecuritySolution) => void; selected?: boolean; recommended?: boolean }) {
  const classes = ['facility-record', 'epr-solution-card'];
  if (selected) classes.push('selected');
  if (recommended) classes.push('recommended');
  return <article className={classes.join(' ')}>{recommended ? <span className="epr-recommended-badge" title="Suggested for the selected store based on its incident history">✨ Recommended</span> : null}<strong>{solution.name}</strong><span>{formatLabel(solution.solution_type)} · {solution.effectiveness_rating}% effective</span><small>{solution.coverage_area}</small><small>5-year base cost: {formatCurrency(solutionFiveYearCost(solution))}</small>{onShortlist ? <button className="epr-action-button epr-card-action" type="button" onClick={() => onShortlist(solution)}>{selected ? 'Shortlisted' : 'Shortlist Control'}</button> : null}</article>;
}

function MitigationDraftPanel({ draft, onClear }: { draft: EprMitigationDraft | null; onClear: () => void }) {
  if (!draft) return <p className="epr-empty-state">Select <b>Shortlist Control</b> from a mitigation option to generate a mock comparison and governance draft. No purchase, vendor communication, or production workflow will be triggered.</p>;
  return <article className="epr-draft-panel"><div className="epr-draft-header"><div><StatusPill label={draft.priority} tone={draft.priority === 'Recommended' ? 'ready' : 'watch'} /><StatusPill label="MOCK ONLY" tone="stable" /></div><button className="epr-action-button secondary" type="button" onClick={onClear}>Clear Draft</button></div><div className="service-meta-grid service-live-metrics epr-draft-grid"><div><span>Solution</span><strong>{draft.solutionName}</strong></div><div><span>Status</span><strong>Draft</strong></div><div><span>Source</span><strong>{draft.id.replace('mitigation-draft-', '')}</strong></div></div><h3>{draft.subject}</h3><p>{draft.summary}</p><h4>Recommendation</h4><p>{draft.recommendation}</p><h4>Evidence needed</h4><div className="badge-list">{draft.evidenceNeeded.map((item) => <span className="scope-chip selected" key={item}>{item}</span>)}</div><h4>Requested response</h4><p>{draft.requestedResponse}</p><div className="epr-draft-actions"><button className="epr-action-button" type="button" disabled>Create Governance Review — Mock Only</button><button className="epr-action-button" type="button" disabled>Send to Vendor Team — Mock Only</button><button className="epr-action-button secondary" type="button" disabled>Approve Purchase — Disabled</button></div><p className="epr-disclaimer">Draft only — no purchase, vendor contact, or production workflow is triggered.</p></article>;
}

function createMitigationDraft(solution: EprSecuritySolution, storeName?: string): EprMitigationDraft {
  const cost = solutionFiveYearCost(solution);
  const storeContext = storeName ? ` for ${storeName}` : '';
  return {
    id: `mitigation-draft-${solution.id}`,
    priority: solution.effectiveness_rating >= 85 && cost < 150000 ? 'Recommended' : 'Review',
    solutionName: solution.name,
    subject: `EPR Mitigation Review — ${solution.name}${storeContext}`,
    summary: `${solution.name} is a ${formatLabel(solution.solution_type)} control with ${solution.effectiveness_rating}% effectiveness, coverage area of ${solution.coverage_area}, and estimated 5-year base cost of ${formatCurrency(cost)}${storeContext ? `. Staged${storeContext}` : ''}.`,
    recommendation: solution.effectiveness_rating >= 85 ? 'Recommended for governance comparison pending facility applicability, vendor readiness, and budget validation.' : 'Review before prioritization; compare against higher-effectiveness or lower-cost controls before vendor handoff.',
    evidenceNeeded: ['Control effectiveness', '5-year cost estimate', 'Facility applicability', 'Prevented incident types', 'Vendor/program owner validation'],
    requestedResponse: 'Please validate applicability, implementation constraints, budget path, and whether this option should move into formal governance review. This is a mock-only mitigation draft.',
  };
}

function solutionFiveYearCost(solution: EprSecuritySolution): number {
  return solution.upfront_cost + solution.annual_cost * 5;
}

// Estimated cost-per-event to Walmart by incident type (direct loss + LE response + investigation + EAP/legal exposure).
// Flat $12,500 fallback matches the canonical generator's default when no specific category is defined.
const INCIDENT_COST_BY_TYPE: Readonly<Record<string, number>> = {
  'Person with a Gun': 72000,
  'Aggravated Assault': 48000,
  'Burglary': 34000,
  'Battery': 22000,
  'Suicide / Attempt': 18000,
  'Lost/Missing Person': 9500,
  'Threat of Violence': 7500,
  'Vandalism / Criminal Mischief': 4200,
};
const INCIDENT_COST_FALLBACK = 12500;
// Severity multiplier applied on top of the base cost so a severity-3 incident costs more than severity-1.
const INCIDENT_SEVERITY_MULTIPLIER: Readonly<Record<string, number>> = { '1': 0.6, '2': 1.0, '3': 1.5 };

function incidentCostEstimate(incident: EprIncident): number {
  const base = INCIDENT_COST_BY_TYPE[incident.incident_type] ?? INCIDENT_COST_FALLBACK;
  const multiplier = INCIDENT_SEVERITY_MULTIPLIER[String(incident.severity)] ?? 1.0;
  return Math.round(base * multiplier);
}

function severityLabel(severity: number | string): string {
  const value = String(severity);
  return value === '3' ? 'High' : value === '2' ? 'Medium' : value === '1' ? 'Low' : value;
}

function severityTone(severity: number | string): StatusTone {
  const value = String(severity);
  return value === '3' ? 'critical' : value === '2' ? 'watch' : 'stable';
}

// Map each incident type to the catalog solution names that meaningfully reduce that risk.
// Names must match the canonical solution `name` field exactly so lookup is O(1).
const INCIDENT_TO_SOLUTION_NAMES: Readonly<Record<string, readonly string[]>> = {
  'Aggravated Assault': ['Targeted Off-Duty Officer Detail', 'Associate Body-Worn Cameras', 'Access Control / Panic Button Refresh'],
  'Battery': ['Targeted Off-Duty Officer Detail', 'Associate Body-Worn Cameras'],
  'Burglary': ['Access Control / Panic Button Refresh', 'License Plate Recognition (LPR)', 'PoleCop Pole-Mounted Camera Array'],
  'Person with a Gun': ['Targeted Off-Duty Officer Detail', 'Access Control / Panic Button Refresh'],
  'Threat of Violence': ['Targeted Off-Duty Officer Detail', 'Associate Body-Worn Cameras', 'Store Leadership Threat Brief'],
  'Vandalism / Criminal Mischief': ['LotCop Mobile Surveillance Trailer', 'PoleCop Pole-Mounted Camera Array'],
};

// When the catalog has no internal solution for an incident type, point the user at the Vendor Intelligence module
// with a one-line capability hint so they know what to search for there.
const INCIDENT_VENDOR_FALLBACK: Readonly<Record<string, string>> = {
  'Person with a Gun': 'Weapons detection systems (concealed-weapon scanners, AI gunshot detection) — e.g. Evolv Express, Athena Security, ZeroEyes.',
  'Lost/Missing Person': 'Real-time location + AI video search vendors for store-wide person tracking and missing-person workflows.',
  'Suicide / Attempt': 'Behavioral threat detection + crisis intervention vendors (Lyra-style EAP integrations, threat assessment platforms).',
};

type StoreSuggestions = {
  recommendedSolutionIds: ReadonlySet<number>;
  vendorFallbacks: Array<{ incidentType: string; hint: string; eventCount: number }>;
};

function getStoreSuggestions(storeIncidentTypes: ReadonlyMap<string, number>, solutions: readonly EprSecuritySolution[]): StoreSuggestions {
  const solutionByName = new Map(solutions.map((solution) => [solution.name, solution] as const));
  const recommendedSolutionIds = new Set<number>();
  const vendorFallbacks: StoreSuggestions['vendorFallbacks'] = [];
  for (const [incidentType, eventCount] of storeIncidentTypes) {
    const internalMatches = (INCIDENT_TO_SOLUTION_NAMES[incidentType] ?? []).filter((name) => solutionByName.has(name));
    if (internalMatches.length > 0) {
      for (const name of internalMatches) {
        const solution = solutionByName.get(name);
        if (solution) recommendedSolutionIds.add(solution.id);
      }
    } else {
      const hint = INCIDENT_VENDOR_FALLBACK[incidentType] ?? 'No internal control or vendor profile mapped yet — explore the Vendor Intelligence module for closest-fit options.';
      vendorFallbacks.push({ incidentType, hint, eventCount });
    }
  }
  return { recommendedSolutionIds, vendorFallbacks };
}

function TaskRow({ task, onCreateDraft }: { task: EprTask; onCreateDraft?: (task: EprTask) => void }) {
  return <tr><td><strong>{task.task_id}</strong><small>{task.title}</small></td><td>{task.owner_name}<small>{task.owner_role}</small></td><td><StatusPill label={task.priority} tone={task.priority === 'Critical' ? 'critical' : task.priority === 'High' ? 'watch' : 'stable'} /></td><td>{task.status}<small>{task.facility_name}</small>{task.evidence_required ? <small>Evidence required</small> : null}</td>{onCreateDraft ? <td><button className="epr-action-button" type="button" onClick={() => onCreateDraft(task)}>Create Follow-Up</button></td> : null}</tr>;
}

function createTaskDraft(task: EprTask): EprTaskDraft {
  return {
    id: `task-draft-${task.task_id}`,
    priority: task.priority,
    owner: task.owner_name,
    subject: `${task.priority} EPR Follow-Up Needed — ${task.task_id}`,
    summary: `${task.title} is assigned to ${task.owner_name} (${task.owner_role}) for ${task.facility_name}. Current status is ${task.status}, due ${task.due_date}, with an SLA target of ${task.sla_hours} hours.`,
    evidenceNeeded: task.evidence_required ? ['Closure evidence', 'Owner disposition', 'Facility validation', 'Mitigation notes', 'Due date/SLA confirmation'] : ['Owner disposition', 'Facility validation', 'Mitigation notes'],
    requestedResponse: 'Please confirm current disposition, expected completion date, evidence status, and any blocker requiring governance escalation. This is a mock-only follow-up draft.',
    recommendedAction: taskRecommendedAction(task),
  };
}

function TaskDraftPanel({ draft, onClear }: { draft: EprTaskDraft | null; onClear: () => void }) {
  if (!draft) return <p className="epr-empty-state">Select <b>Create Follow-Up</b> from a task row to generate a mock owner follow-up or governance ticket draft. No production workflow will be triggered.</p>;
  return <article className="epr-draft-panel"><div className="epr-draft-header"><div><StatusPill label={draft.priority} tone={draft.priority === 'Critical' ? 'critical' : draft.priority === 'High' ? 'watch' : 'stable'} /><StatusPill label="MOCK ONLY" tone="stable" /></div><button className="epr-action-button secondary" type="button" onClick={onClear}>Clear Draft</button></div><div className="service-meta-grid service-live-metrics epr-draft-grid"><div><span>Owner</span><strong>{draft.owner}</strong></div><div><span>Status</span><strong>Draft</strong></div><div><span>Source</span><strong>{draft.id.replace('task-draft-', '')}</strong></div></div><h3>{draft.subject}</h3><p>{draft.summary}</p><h4>Recommended action</h4><p>{draft.recommendedAction}</p><h4>Evidence needed</h4><div className="badge-list">{draft.evidenceNeeded.map((item) => <span className="scope-chip selected" key={item}>{item}</span>)}</div><h4>Requested response</h4><p>{draft.requestedResponse}</p><div className="epr-draft-actions"><button className="epr-action-button" type="button" disabled>Send Owner Follow-Up — Mock Only</button><button className="epr-action-button" type="button" disabled>Create Governance Ticket — Mock Only</button><button className="epr-action-button secondary" type="button" disabled>Mark Complete — Disabled</button></div><p className="epr-disclaimer">Draft only — no production communication is sent, no ticket is created, and task status is not changed.</p></article>;
}

function taskRecommendedAction(task: EprTask): string {
  if (task.priority === 'Critical') return 'Escalate for immediate owner confirmation, validate evidence requirements, and determine whether executive visit readiness is affected.';
  if (task.priority === 'High') return 'Request owner update, confirm current remediation path, and document blockers or SLA pressure for governance review.';
  if (task.evidence_required) return 'Confirm evidence path and expected completion timing before closing or downgrading the task.';
  return 'Track owner disposition and confirm whether any additional field or governance follow-up is needed.';
}

function StatePanel({ title, message, tone = 'stable' }: { title: string; message: string; tone?: StatusTone }) {
  return <section className="panel dashboard-state-panel" role={tone === 'critical' ? 'alert' : 'status'}><div className="card-heading"><div><p className="eyebrow">EPR data</p><h1>{title}</h1></div><StatusPill label={tone === 'critical' ? 'ERROR' : 'STATUS'} tone={tone} /></div><p>{message}</p></section>;
}

function getTopRiskFacilities(data: EprData | null): EprFacility[] {
  return [...(data?.field_operations.facilities ?? [])].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);
}

function priorityRank(priority: string): number {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority] ?? 4;
}

function formatLabel(value: string): string {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: string | number): string {
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}
