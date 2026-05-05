import { useMemo, useState } from 'react';
import { FireAlarmSiteDetailPanel } from '../FireAlarmSiteDetailPanel';
import { LockedScopeSummary } from '../LockedScopeSummary';
import { DonutChart } from '../charts/DonutChart';
import { HorizontalBarChart } from '../charts/HorizontalBarChart';
import { LineTrendChart } from '../charts/LineTrendChart';
import type { FpiProgramData } from '../../data/fpiTypes';
import type { FireAlarmProgramData } from '../../data/fireAlarmTypes';
import { applyFireAlarmScope } from '../../data/fireAlarmScope';
import {
  getFireAlarmDashboardModel,
  riskColor,
  type FireAlarmDashboardModel,
  type FireAlarmKpi,
  type FireAlarmRiskLevel,
  type FireAlarmSiteDirectoryRow,
} from '../../data/fireAlarmMetrics';
import { hasEmptyStoreScope, type StoreScopeState } from '../../data/storeScope';

export type FireSystemServiceViewProps = {
  programData: FpiProgramData;
  facilities: FpiProgramData['facilities'];
  fireAlarmData: FireAlarmProgramData | null;
  fireAlarmLoading: boolean;
  fireAlarmError: string | null;
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
  onFacilitySelect: (facilityId: string) => void;
};

type RiskFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
type SortKey = 'riskScore' | 'falseAlarms90Days' | 'openDeficiencies' | 'activeTroubles' | 'nextInspectionDue';

export function FireSystemServiceView({ fireAlarmData, fireAlarmLoading, fireAlarmError, storeScope, onChangeScopeRequest }: FireSystemServiceViewProps) {
  const [siteSearch, setSiteSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const lockedData = useMemo(() => (fireAlarmData ? applyFireAlarmScope(fireAlarmData, storeScope) : null), [fireAlarmData, storeScope]);
  const lockedSiteIds = useMemo(() => lockedData?.sites.map((site) => site.id) ?? [], [lockedData]);
  const model = useMemo(
    () => (lockedData && lockedSiteIds.length > 0 ? getFireAlarmDashboardModel(lockedData, lockedSiteIds) : null),
    [lockedData, lockedSiteIds.join('|')],
  );
  const filteredRows = useMemo(() => filterAndSortRows(model?.siteDirectoryRows ?? [], siteSearch, riskFilter, statusFilter, sortKey), [model, siteSearch, riskFilter, statusFilter, sortKey]);
  const selectedDetail = selectedSiteId && model ? model.siteDetailsById[selectedSiteId] ?? null : null;


  return (
    <section className="fire-ops-page" aria-label="Fire Alarm Operations Intelligence dashboard">
      <header className="fire-ops-header">
        <div>
          <p className="fire-ops-eyebrow">Fire Alarm Operations Intelligence</p>
          <h1>Fire-System Monitoring & Assurance</h1>
          <p>Portfolio health, false-alarm trends, fire panel risk, inspections, deficiencies, service root causes, and PM recommendations from the fire alarm handoff dataset.</p>
        </div>
        <div className="fire-ops-mode"><span>MODE</span>MOCK DEMO DATA</div>
      </header>

      {fireAlarmData ? <LockedScopeSummary sites={fireAlarmData.sites} scope={storeScope} onChangeScope={onChangeScopeRequest} /> : null}
      {fireAlarmLoading ? <StatePanel title="Loading fire alarm dataset" message="Preparing Fire Alarm Operations Intelligence." /> : null}
      {fireAlarmError ? <StatePanel title="Fire alarm dataset unavailable" message={fireAlarmError} danger /> : null}
      {fireAlarmData && hasEmptyStoreScope(storeScope) ? <StatePanel title="No fire-system stores selected" message="Open Settings to include stores or regions in the global dashboard scope." /> : null}

      {lockedData && model ? (
        <>
          <KpiGrid kpis={model.kpis} />
          <ChartGrid model={model} />
          <OperationalTables model={model} onSelectSite={setSelectedSiteId} />
          <SiteDirectory
            rows={filteredRows}
            search={siteSearch}
            riskFilter={riskFilter}
            statusFilter={statusFilter}
            sortKey={sortKey}
            onSearchChange={setSiteSearch}
            onRiskFilterChange={setRiskFilter}
            onStatusFilterChange={setStatusFilter}
            onSortChange={setSortKey}
            onSelectSite={setSelectedSiteId}
          />
          <FireAlarmSiteDetailPanel detail={selectedDetail} onClose={() => setSelectedSiteId(null)} />
        </>
      ) : null}
    </section>
  );
}

function ScopeToggle({ sites, activeSiteIds, onToggleSite, onShowOnlySite, onShowAll }: { sites: FireAlarmProgramData['sites']; activeSiteIds: string[]; onToggleSite: (siteId: string) => void; onShowOnlySite: (siteId: string) => void; onShowAll: () => void }) {
  const activeSet = new Set(activeSiteIds);
  return (
    <section className="fire-ops-card fire-ops-selection-card">
      <div><p className="fire-ops-eyebrow">Current Fire-System Data Toggle</p><h2>Viewing {activeSiteIds.length} of {sites.length} locked stores</h2><p>Toggle stores on/off inside the locked scope, or use Solo to drill into one selected store without changing the global Settings scope.</p></div>
      <div className="fire-ops-scope-actions"><button type="button" onClick={onShowAll}>Show all locked stores</button></div>
      <div className="fire-ops-site-toggle-list">
        {sites.map((site) => (
          <div className={activeSet.has(site.id) ? 'fire-ops-site-toggle active' : 'fire-ops-site-toggle'} key={site.id}>
            <button type="button" onClick={() => onToggleSite(site.id)}>{site.id} · {site.name}<span>{site.city}, {site.state} • Risk {site.riskScore}</span></button>
            <button type="button" onClick={() => onShowOnlySite(site.id)}>Solo</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function KpiGrid({ kpis }: { kpis: FireAlarmKpi[] }) {
  return <section className="fire-ops-kpi-grid" aria-label="Fire alarm KPI cards">{kpis.map((kpi) => <article className={`fire-ops-kpi tone-${kpi.tone}`} key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong>{kpi.actionLabel ? <small>{kpi.actionLabel}</small> : null}</article>)}</section>;
}

function ChartGrid({ model }: { model: FireAlarmDashboardModel }) {
  return (
    <section className="fire-ops-chart-grid" aria-label="Fire alarm analytics charts">
      <ChartCard title="False Alarms by Month" subtitle="False/Nuisance events trend"><LineTrendChart data={model.falseAlarmsByMonth} color="#dc2626" /></ChartCard>
      <ChartCard title="Top 10 Sites by False Alarms" subtitle="Trailing 90 days"><HorizontalBarChart data={model.topSitesByFalseAlarms} /></ChartCard>
      <ChartCard title="Sites by Risk Level" subtitle="R/Y/G portfolio posture"><DonutChart data={model.sitesByRiskLevel} /></ChartCard>
      <ChartCard title="Service Tickets by Root Cause" subtitle="Service record analytics"><HorizontalBarChart data={model.serviceTicketsByRootCause} /></ChartCard>
      <ChartCard title="Open Deficiencies by Severity" subtitle="Remediation pressure"><HorizontalBarChart data={model.deficienciesBySeverity} /></ChartCard>
      <ChartCard title="Inspection Compliance Trend" subtitle="Inspection/report volume"><LineTrendChart data={model.inspectionCompliance} color="#2563eb" /></ChartCard>
    </section>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: any }) {
  return <section className="fire-ops-card fire-ops-chart-card"><div className="fire-ops-card-heading"><div><p className="fire-ops-eyebrow">{subtitle}</p><h2>{title}</h2></div></div>{children}</section>;
}

function OperationalTables({ model, onSelectSite }: { model: FireAlarmDashboardModel; onSelectSite: (siteId: string) => void }) {
  return (
    <section className="fire-ops-table-grid" aria-label="Operational fire alarm tables">
      <SummaryList title="High Risk Sites" rows={model.topRiskSites} metric="riskScore" onSelectSite={onSelectSite} />
      <SummaryList title="Active Trouble Sites" rows={model.troubledSites} metric="activeTroubles" onSelectSite={onSelectSite} />
      <SummaryList title="Open Deficiencies" rows={model.openDeficiencySites} metric="openDeficiencies" onSelectSite={onSelectSite} />
      <SummaryList title="PM Recommendations" rows={model.pmRecommendationSites} metric="falseAlarms90Days" onSelectSite={onSelectSite} />
    </section>
  );
}

function SummaryList({ title, rows, metric, onSelectSite }: { title: string; rows: Array<{ siteId: string; siteName: string; city: string; state: string; riskLevel: FireAlarmRiskLevel; riskScore: number; activeTroubles: number; openDeficiencies: number; falseAlarms90Days: number }>; metric: 'riskScore' | 'activeTroubles' | 'openDeficiencies' | 'falseAlarms90Days'; onSelectSite: (siteId: string) => void }) {
  return (
    <section className="fire-ops-card fire-ops-list-card"><div className="fire-ops-card-heading"><h2>{title}</h2></div>
      <div className="fire-ops-summary-list">{rows.slice(0, 8).map((row) => <button type="button" key={row.siteId} onClick={() => onSelectSite(row.siteId)}><span className="risk-dot" style={{ background: riskColor(row.riskLevel) }} /><div><strong>{row.siteName}</strong><small>{row.siteId} • {row.city}, {row.state}</small></div><em>{row[metric]}</em></button>)}{rows.length === 0 ? <p className="fire-ops-empty">No records in this selection.</p> : null}</div>
    </section>
  );
}

function SiteDirectory({ rows, search, riskFilter, statusFilter, sortKey, onSearchChange, onRiskFilterChange, onStatusFilterChange, onSortChange, onSelectSite }: { rows: FireAlarmSiteDirectoryRow[]; search: string; riskFilter: RiskFilter; statusFilter: string; sortKey: SortKey; onSearchChange: (value: string) => void; onRiskFilterChange: (value: RiskFilter) => void; onStatusFilterChange: (value: string) => void; onSortChange: (value: SortKey) => void; onSelectSite: (siteId: string) => void }) {
  return (
    <section className="fire-ops-card fire-ops-directory-card">
      <div className="fire-ops-directory-header"><div><p className="fire-ops-eyebrow">Searchable Site Directory</p><h2>Fire Alarm Portfolio</h2></div><strong>{rows.length} sites</strong></div>
      <div className="fire-ops-filters">
        <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search by site, ID, city, state, region, panel, contractor, or AHJ" />
        <select value={riskFilter} onChange={(event) => onRiskFilterChange(event.target.value as RiskFilter)}><option value="all">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
        <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}><option value="all">All statuses</option><option value="normal">Normal</option><option value="operational">Operational</option><option value="remodel">Remodel</option></select>
        <select value={sortKey} onChange={(event) => onSortChange(event.target.value as SortKey)}><option value="riskScore">Sort by risk</option><option value="falseAlarms90Days">Sort by false alarms</option><option value="openDeficiencies">Sort by deficiencies</option><option value="activeTroubles">Sort by troubles</option><option value="nextInspectionDue">Sort by inspection due</option></select>
      </div>
      <div className="fire-ops-table-wrap"><table className="fire-ops-table"><thead><tr><th>Site ID</th><th>Site Name</th><th>Location</th><th>Panel / Monitoring</th><th>Risk</th><th>Troubles</th><th>Deficiencies</th><th>False Alarms</th><th>Next Inspection</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.siteId} className={`risk-${row.riskLevel.toLowerCase()}`} onClick={() => onSelectSite(row.siteId)}><td>{row.siteId}</td><td><strong>{row.siteName}</strong><small>{row.contractor}</small></td><td>{row.city}, {row.state}<small>{row.region}</small></td><td>{row.panelType}<small>{row.monitoringType}</small></td><td><RiskBadge level={row.riskLevel} score={row.riskScore} /></td><td>{row.activeTroubles}</td><td>{row.openDeficiencies}</td><td>{row.falseAlarms90Days}</td><td>{formatDate(row.nextInspectionDue)}</td><td>{row.status}</td></tr>)}</tbody></table>{rows.length === 0 ? <p className="fire-ops-empty">No sites match the current filters.</p> : null}</div>
    </section>
  );
}

function RiskBadge({ level, score }: { level: FireAlarmRiskLevel; score: number }) {
  return <span className="fire-risk-badge" style={{ color: riskColor(level), borderColor: riskColor(level), background: `${riskColor(level)}18` }}>{level} · {score}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="fire-ops-card fire-ops-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}

function filterAndSortRows(rows: FireAlarmSiteDirectoryRow[], search: string, riskFilter: RiskFilter, statusFilter: string, sortKey: SortKey): FireAlarmSiteDirectoryRow[] {
  const normalized = search.trim().toLowerCase();
  return rows
    .filter((row) => riskFilter === 'all' || row.riskLevel.toLowerCase() === riskFilter)
    .filter((row) => statusFilter === 'all' || `${row.status} ${row.complianceStatus}`.toLowerCase().includes(statusFilter))
    .filter((row) => !normalized || [row.siteId, row.siteName, row.city, row.state, row.region, row.panelType, row.monitoringType, row.contractor, row.ahj].join(' ').toLowerCase().includes(normalized))
    .sort((a, b) => sortKey === 'nextInspectionDue' ? Date.parse(a.nextInspectionDue) - Date.parse(b.nextInspectionDue) : Number(b[sortKey]) - Number(a[sortKey]));
}

function formatDate(value?: string): string {
  if (!value) return 'N/A';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
}
