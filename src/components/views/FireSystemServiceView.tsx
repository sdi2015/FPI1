import { useMemo, useState } from 'react';
import { FireAlarmSiteDetailPanel } from '../FireAlarmSiteDetailPanel';
import { ScopeContextChip } from '../ScopeContextChip';
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
  type FireAlarmKpiTone,
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
type AlarmFilter = 'all' | 'low' | 'watch' | 'elevated' | 'critical';
type DeficiencyFilter = 'all' | 'none' | 'open' | 'highPressure';
type SortKey = 'riskScore' | 'falseAlarms90Days' | 'openDeficiencies' | 'activeTroubles' | 'nextInspectionDue';

export function FireSystemServiceView({ fireAlarmData, fireAlarmLoading, fireAlarmError, storeScope, onChangeScopeRequest }: FireSystemServiceViewProps) {
  const [siteSearch, setSiteSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [alarmFilter, setAlarmFilter] = useState<AlarmFilter>('all');
  const [deficiencyFilter, setDeficiencyFilter] = useState<DeficiencyFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const lockedData = useMemo(() => (fireAlarmData ? applyFireAlarmScope(fireAlarmData, storeScope) : null), [fireAlarmData, storeScope]);
  const lockedSiteIds = useMemo(() => lockedData?.sites.map((site) => site.id) ?? [], [lockedData]);
  const model = useMemo(
    () => (lockedData && lockedSiteIds.length > 0 ? getFireAlarmDashboardModel(lockedData, lockedSiteIds) : null),
    [lockedData, lockedSiteIds.join('|')],
  );
  const filteredRows = useMemo(() => filterAndSortRows(model?.siteDirectoryRows ?? [], siteSearch, riskFilter, statusFilter, regionFilter, alarmFilter, deficiencyFilter, sortKey), [model, siteSearch, riskFilter, statusFilter, regionFilter, alarmFilter, deficiencyFilter, sortKey]);
  const selectedDetail = selectedSiteId && model ? model.siteDetailsById[selectedSiteId] ?? null : null;
  const regionOptions = useMemo(() => Array.from(new Set((model?.siteDirectoryRows ?? []).map((row) => row.region))).sort(), [model]);
  const resetFilters = () => {
    setSiteSearch('');
    setRiskFilter('all');
    setStatusFilter('all');
    setRegionFilter('all');
    setAlarmFilter('all');
    setDeficiencyFilter('all');
    setSortKey('riskScore');
  };

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

      {fireAlarmData ? <ScopeContextChip sites={fireAlarmData.sites} scope={storeScope} onChangeScope={onChangeScopeRequest} /> : null}
      {fireAlarmLoading ? <StatePanel title="Loading fire alarm dataset" message="Preparing Fire Alarm Operations Intelligence." /> : null}
      {fireAlarmError ? <StatePanel title="Fire alarm dataset unavailable" message={fireAlarmError} danger /> : null}
      {fireAlarmData && hasEmptyStoreScope(storeScope) ? <StatePanel title="No fire-system stores selected" message="Open Settings to include stores or regions in the global dashboard scope." /> : null}

      {lockedData && model ? (
        <>
          <KpiGrid kpis={model.kpis} onKpiSelect={(label) => applyKpiFilter(label, setRiskFilter, setStatusFilter, setAlarmFilter, setDeficiencyFilter)} />
          <FirePostureOverview model={model} rows={filteredRows} />
          <ChartGrid model={model} onRiskSelect={(label) => setRiskFilter(label.toLowerCase() as RiskFilter)} onFalseAlarmSiteSelect={(label) => setSiteSearch(label.split(' - ')[0])} onDeficiencySelect={(label) => setDeficiencyFilter(label === 'Low' ? 'open' : 'highPressure')} />
          <OperationalTables model={model} onSelectSite={setSelectedSiteId} />
          <RecommendedActions rows={filteredRows} onSelectSite={setSelectedSiteId} />
          <SiteDirectory
            rows={filteredRows}
            search={siteSearch}
            riskFilter={riskFilter}
            statusFilter={statusFilter}
            sortKey={sortKey}
            onSearchChange={setSiteSearch}
            onRiskFilterChange={setRiskFilter}
            regionFilter={regionFilter}
            alarmFilter={alarmFilter}
            deficiencyFilter={deficiencyFilter}
            regionOptions={regionOptions}
            onStatusFilterChange={setStatusFilter}
            onRegionFilterChange={setRegionFilter}
            onAlarmFilterChange={setAlarmFilter}
            onDeficiencyFilterChange={setDeficiencyFilter}
            onSortChange={setSortKey}
            onResetFilters={resetFilters}
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

function KpiGrid({ kpis, onKpiSelect }: { kpis: FireAlarmKpi[]; onKpiSelect: (label: string) => void }) {
  return <section className="fire-ops-kpi-grid" aria-label="Fire and Life Safety KPI cards">{kpis.map((kpi) => <button type="button" className={`fire-ops-kpi tone-${kpi.tone}`} key={kpi.label} onClick={() => onKpiSelect(kpi.label)} title={`Filter by ${kpi.label}`}><span>{kpi.label}</span><strong>{kpi.value}</strong><small>{kpi.actionLabel ?? 'Review'}</small></button>)}</section>;
}

function FirePostureOverview({ model, rows }: { model: FireAlarmDashboardModel; rows: FireAlarmSiteDirectoryRow[] }) {
  const totalSites = model.siteDirectoryRows.length || 1;
  const healthySites = model.siteDirectoryRows.filter((row) => row.riskLevel === 'Low' && row.activeTroubles === 0).length;
  const readinessScore = Math.max(0, Math.round((healthySites / totalSites) * 100 - model.siteDirectoryRows.reduce((sum, row) => sum + row.activeTroubles, 0) * 2));
  const criticalAndHigh = model.siteDirectoryRows.filter((row) => row.riskLevel === 'Critical' || row.riskLevel === 'High').length;
  const topFalseAlarm = [...model.siteDirectoryRows].sort((a, b) => b.falseAlarms90Days - a.falseAlarms90Days)[0];
  return (
    <section className="fire-ops-posture-grid" aria-label="Fire and life safety posture overview">
      <section className="fire-ops-card fire-readiness-card">
        <div className="fire-ops-card-heading"><div><p className="fire-ops-eyebrow">Readiness score</p><h2>Fire/Life-Safety operating posture</h2></div><RiskBadge level={readinessScore >= 85 ? 'Low' : readinessScore >= 70 ? 'Medium' : 'High'} score={readinessScore} /></div>
        <div className="fire-readiness-gauge" style={{ '--score': readinessScore } as Record<string, number>}><strong>{readinessScore}%</strong><span>Readiness</span></div>
        <p>{criticalAndHigh} high/critical sites require governance visibility. {rows.length} sites match the current filter set.</p>
      </section>
      <section className="fire-ops-card fire-insight-card">
        <p className="fire-ops-eyebrow">Executive signal</p>
        <h2>Current portfolio exposure</h2>
        <div className="fire-insight-metrics"><div><span>High/Critical</span><strong>{criticalAndHigh}</strong></div><div><span>Top nuisance site</span><strong>{topFalseAlarm ? topFalseAlarm.siteId : 'N/A'}</strong></div><div><span>90D false alarms</span><strong>{topFalseAlarm ? topFalseAlarm.falseAlarms90Days : 0}</strong></div></div>
        <p>{topFalseAlarm ? `${topFalseAlarm.siteName} in ${topFalseAlarm.city}, ${topFalseAlarm.state} leads nuisance alarm volume and should be reviewed for device health, panel trouble, and vendor follow-up.` : 'No nuisance alarm concentration in the current scope.'}</p>
      </section>
    </section>
  );
}

function ChartGrid({ model, onRiskSelect, onFalseAlarmSiteSelect, onDeficiencySelect }: { model: FireAlarmDashboardModel; onRiskSelect: (label: string) => void; onFalseAlarmSiteSelect: (label: string) => void; onDeficiencySelect: (label: string) => void }) {
  return (
    <section className="fire-ops-chart-grid" aria-label="Fire alarm analytics charts">
      <ChartCard title="False/Nuisance Alarm Trend" subtitle="Monthly trend with spike visibility"><LineTrendChart data={model.falseAlarmsByMonth} color="#f97316" /><p className="fire-chart-insight">Spikes above prior months should be reviewed for repeat devices, environmental triggers, and vendor response quality.</p></ChartCard>
      <ChartCard title="Top Sites by False Alarms" subtitle="Trailing 90 days"><HorizontalBarChart data={model.topSitesByFalseAlarms} onSelect={onFalseAlarmSiteSelect} /></ChartCard>
      <ChartCard title="Sites by Risk Level" subtitle="Click a segment to filter portfolio"><DonutChart data={model.sitesByRiskLevel} onSelect={onRiskSelect} /></ChartCard>
      <ChartCard title="Service Tickets by Root Cause" subtitle="Service record analytics"><HorizontalBarChart data={model.serviceTicketsByRootCause} /></ChartCard>
      <ChartCard title="Open Deficiencies by Severity" subtitle="Remediation pressure"><HorizontalBarChart data={model.deficienciesBySeverity} onSelect={onDeficiencySelect} /><p className="fire-chart-insight">Critical and high deficiencies represent immediate remediation pressure and should be assigned owner follow-up.</p></ChartCard>
      <ChartCard title="Inspection Compliance Trend" subtitle="Inspection/report volume"><LineTrendChart data={model.inspectionCompliance} color="#4dbdf5" /><p className="fire-chart-insight">Target operating expectation: maintain inspection completion at or above 95% with no overdue life-safety inspections.</p></ChartCard>
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

function RecommendedActions({ rows, onSelectSite }: { rows: FireAlarmSiteDirectoryRow[]; onSelectSite: (siteId: string) => void }) {
  const actions = buildRecommendedActions(rows);
  return (
    <section className="fire-ops-card fire-actions-panel" aria-label="Recommended fire and life safety actions">
      <div className="fire-ops-card-heading"><div><p className="fire-ops-eyebrow">Next best actions</p><h2>Recommended Actions</h2></div><strong>{actions.length} actions</strong></div>
      <div className="fire-action-list">{actions.map((action) => <button type="button" key={action.siteId + action.title} onClick={() => onSelectSite(action.siteId)}><StatusDot tone={action.tone} /><div><strong>{action.title}</strong><small>{action.detail}</small></div><span>{action.action}</span></button>)}</div>
    </section>
  );
}

function StatusDot({ tone }: { tone: FireAlarmKpiTone }) {
  return <i className={`fire-status-dot tone-${tone}`} aria-hidden="true" />;
}

function SummaryList({ title, rows, metric, onSelectSite }: { title: string; rows: Array<{ siteId: string; siteName: string; city: string; state: string; riskLevel: FireAlarmRiskLevel; riskScore: number; activeTroubles: number; openDeficiencies: number; falseAlarms90Days: number }>; metric: 'riskScore' | 'activeTroubles' | 'openDeficiencies' | 'falseAlarms90Days'; onSelectSite: (siteId: string) => void }) {
  return (
    <section className="fire-ops-card fire-ops-list-card"><div className="fire-ops-card-heading"><h2>{title}</h2></div>
      <div className="fire-ops-summary-list">{rows.slice(0, 8).map((row) => <button type="button" key={row.siteId} onClick={() => onSelectSite(row.siteId)}><span className="risk-dot" style={{ background: riskColor(row.riskLevel) }} /><div><strong>{row.siteName}</strong><small>{row.siteId} • {row.city}, {row.state}</small></div><em>{row[metric]}</em></button>)}{rows.length === 0 ? <p className="fire-ops-empty">No records in this selection.</p> : null}</div>
    </section>
  );
}

function SiteDirectory({ rows, search, riskFilter, statusFilter, regionFilter, alarmFilter, deficiencyFilter, sortKey, regionOptions, onSearchChange, onRiskFilterChange, onStatusFilterChange, onRegionFilterChange, onAlarmFilterChange, onDeficiencyFilterChange, onSortChange, onResetFilters, onSelectSite }: { rows: FireAlarmSiteDirectoryRow[]; search: string; riskFilter: RiskFilter; statusFilter: string; regionFilter: string; alarmFilter: AlarmFilter; deficiencyFilter: DeficiencyFilter; sortKey: SortKey; regionOptions: string[]; onSearchChange: (value: string) => void; onRiskFilterChange: (value: RiskFilter) => void; onStatusFilterChange: (value: string) => void; onRegionFilterChange: (value: string) => void; onAlarmFilterChange: (value: AlarmFilter) => void; onDeficiencyFilterChange: (value: DeficiencyFilter) => void; onSortChange: (value: SortKey) => void; onResetFilters: () => void; onSelectSite: (siteId: string) => void }) {
  return (
    <section className="fire-ops-card fire-ops-directory-card">
      <div className="fire-ops-directory-header"><div><p className="fire-ops-eyebrow">Searchable Site Directory</p><h2>Fire Alarm Portfolio</h2></div><strong>{rows.length} sites</strong></div>
      <div className="fire-ops-filters">
        <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search by site, ID, city, state, region, panel, contractor, or AHJ" />
        <select value={riskFilter} onChange={(event) => onRiskFilterChange(event.target.value as RiskFilter)}><option value="all">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
        <select value={regionFilter} onChange={(event) => onRegionFilterChange(event.target.value)}><option value="all">All regions</option>{regionOptions.map((region) => <option value={region} key={region}>{region}</option>)}</select>
        <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}><option value="all">All statuses</option><option value="normal">Normal</option><option value="operational">Operational</option><option value="remodel">Remodel</option></select>
        <select value={alarmFilter} onChange={(event) => onAlarmFilterChange(event.target.value as AlarmFilter)}><option value="all">All false alarm ranges</option><option value="low">0-1 false alarms</option><option value="watch">2-3 false alarms</option><option value="elevated">4-5 false alarms</option><option value="critical">6+ false alarms</option></select>
        <select value={deficiencyFilter} onChange={(event) => onDeficiencyFilterChange(event.target.value as DeficiencyFilter)}><option value="all">All deficiencies</option><option value="none">No open deficiencies</option><option value="open">Any open deficiencies</option><option value="highPressure">High pressure 3+</option></select>
        <select value={sortKey} onChange={(event) => onSortChange(event.target.value as SortKey)}><option value="riskScore">Sort by risk</option><option value="falseAlarms90Days">Sort by false alarms</option><option value="openDeficiencies">Sort by deficiencies</option><option value="activeTroubles">Sort by troubles</option><option value="nextInspectionDue">Sort by inspection due</option></select>
        <button type="button" className="fire-filter-reset" onClick={onResetFilters}>Reset Filters</button>
      </div>
      <div className="fire-ops-table-wrap"><table className="fire-ops-table"><thead><tr><th><button type="button" onClick={() => onSortChange('riskScore')}>Store/Site</button></th><th>City/State</th><th>Region/Market</th><th>Status</th><th><button type="button" onClick={() => onSortChange('activeTroubles')}>Troubles</button></th><th><button type="button" onClick={() => onSortChange('falseAlarms90Days')}>False Alarms 90D</button></th><th><button type="button" onClick={() => onSortChange('openDeficiencies')}>Deficiencies</button></th><th>Last Inspection</th><th><button type="button" onClick={() => onSortChange('nextInspectionDue')}>Next Due</button></th><th>Owner</th><th>Recommended Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.siteId} className={`risk-${row.riskLevel.toLowerCase()}`} onClick={() => onSelectSite(row.siteId)}><td><strong>{row.siteId}</strong><small>{row.siteName}</small></td><td>{row.city}, {row.state}</td><td>{row.region}<small>{row.panelType}</small></td><td><RiskBadge level={row.riskLevel} score={row.riskScore} /><small>{row.status}</small></td><td><CountBadge value={row.activeTroubles} tone={row.activeTroubles > 0 ? 'warning' : 'good'} /></td><td><CountBadge value={row.falseAlarms90Days} tone={falseAlarmTone(row.falseAlarms90Days)} /></td><td><CountBadge value={row.openDeficiencies} tone={row.openDeficiencies > 2 ? 'danger' : row.openDeficiencies > 0 ? 'warning' : 'good'} /></td><td>{formatDate(row.lastInspection)}</td><td>{formatDate(row.nextInspectionDue)}</td><td>{row.contractor}</td><td>{recommendedActionForRow(row)}</td></tr>)}</tbody></table>{rows.length === 0 ? <p className="fire-ops-empty">No sites match the current filters.</p> : null}</div>
    </section>
  );
}

function RiskBadge({ level, score }: { level: FireAlarmRiskLevel; score: number }) {
  return <span className="fire-risk-badge" style={{ color: riskColor(level), borderColor: riskColor(level), background: `${riskColor(level)}22` }}>{level} · {score}</span>;
}

function CountBadge({ value, tone }: { value: number; tone: FireAlarmKpiTone }) {
  return <span className={`fire-count-badge tone-${tone}`}>{value}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="fire-ops-card fire-ops-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}

function filterAndSortRows(rows: FireAlarmSiteDirectoryRow[], search: string, riskFilter: RiskFilter, statusFilter: string, regionFilter: string, alarmFilter: AlarmFilter, deficiencyFilter: DeficiencyFilter, sortKey: SortKey): FireAlarmSiteDirectoryRow[] {
  const normalized = search.trim().toLowerCase();
  return rows
    .filter((row) => riskFilter === 'all' || row.riskLevel.toLowerCase() === riskFilter)
    .filter((row) => statusFilter === 'all' || `${row.status} ${row.complianceStatus}`.toLowerCase().includes(statusFilter))
    .filter((row) => regionFilter === 'all' || row.region === regionFilter)
    .filter((row) => matchesAlarmFilter(row.falseAlarms90Days, alarmFilter))
    .filter((row) => matchesDeficiencyFilter(row.openDeficiencies, deficiencyFilter))
    .filter((row) => !normalized || [row.siteId, row.siteName, row.city, row.state, row.region, row.panelType, row.monitoringType, row.contractor, row.ahj].join(' ').toLowerCase().includes(normalized))
    .sort((a, b) => sortKey === 'nextInspectionDue' ? Date.parse(a.nextInspectionDue) - Date.parse(b.nextInspectionDue) : Number(b[sortKey]) - Number(a[sortKey]));
}

function matchesAlarmFilter(count: number, filter: AlarmFilter): boolean {
  if (filter === 'low') return count <= 1;
  if (filter === 'watch') return count >= 2 && count <= 3;
  if (filter === 'elevated') return count >= 4 && count <= 5;
  if (filter === 'critical') return count >= 6;
  return true;
}

function matchesDeficiencyFilter(count: number, filter: DeficiencyFilter): boolean {
  if (filter === 'none') return count === 0;
  if (filter === 'open') return count > 0;
  if (filter === 'highPressure') return count >= 3;
  return true;
}

function falseAlarmTone(count: number): FireAlarmKpiTone {
  if (count >= 6) return 'danger';
  if (count >= 4) return 'warning';
  if (count >= 2) return 'info';
  return 'good';
}

function recommendedActionForRow(row: FireAlarmSiteDirectoryRow): string {
  if (row.riskLevel === 'Critical' || row.riskScore >= 90) return 'Escalate critical posture';
  if (row.activeTroubles > 0) return 'Investigate panel/device trouble';
  if (row.openDeficiencies >= 3) return 'Remediate deficiency backlog';
  if (row.falseAlarms90Days >= 4) return 'Review nuisance alarm root cause';
  if (isPastDue(row.nextInspectionDue)) return 'Schedule overdue inspection';
  return 'Monitor normal controls';
}

function buildRecommendedActions(rows: FireAlarmSiteDirectoryRow[]): Array<{ siteId: string; title: string; detail: string; action: string; tone: FireAlarmKpiTone }> {
  const sorted = [...rows].sort((a, b) => b.riskScore - a.riskScore || b.falseAlarms90Days - a.falseAlarms90Days);
  const actions = sorted.flatMap((row) => {
    const rowActions: Array<{ siteId: string; title: string; detail: string; action: string; tone: FireAlarmKpiTone }> = [];
    if (row.riskLevel === 'Critical' || row.riskLevel === 'High') rowActions.push({ siteId: row.siteId, title: `Review ${row.siteId} high-risk posture`, detail: `${row.siteName} has risk score ${row.riskScore} with ${row.openDeficiencies} open deficiencies.`, action: 'View Details', tone: 'danger' });
    if (row.activeTroubles > 0) rowActions.push({ siteId: row.siteId, title: `Investigate ${row.activeTroubles} active trouble condition${row.activeTroubles > 1 ? 's' : ''}`, detail: `${row.city}, ${row.state} requires device/panel health validation.`, action: 'Investigate', tone: 'warning' });
    if (row.falseAlarms90Days >= 4) rowActions.push({ siteId: row.siteId, title: `Reduce nuisance alarms at ${row.siteId}`, detail: `${row.falseAlarms90Days} false/nuisance alarms in the trailing 90 days.`, action: 'Review Root Cause', tone: row.falseAlarms90Days >= 6 ? 'danger' : 'warning' });
    if (isPastDue(row.nextInspectionDue)) rowActions.push({ siteId: row.siteId, title: `Schedule overdue inspection for ${row.siteId}`, detail: `Next inspection due ${formatDate(row.nextInspectionDue)}.`, action: 'Schedule', tone: 'danger' });
    return rowActions;
  });
  return actions.slice(0, 5);
}

function applyKpiFilter(label: string, setRiskFilter: (value: RiskFilter) => void, setStatusFilter: (value: string) => void, setAlarmFilter: (value: AlarmFilter) => void, setDeficiencyFilter: (value: DeficiencyFilter) => void): void {
  if (label.includes('Normal')) {
    setRiskFilter('low');
    setStatusFilter('normal');
  } else if (label.includes('Troubles')) {
    setStatusFilter('all');
  } else if (label.includes('Overdue')) {
    setStatusFilter('all');
  } else if (label.includes('False')) {
    setAlarmFilter('watch');
  } else if (label.includes('Deficiencies')) {
    setDeficiencyFilter('open');
  } else if (label.includes('Risk') || label.includes('Critical')) {
    setRiskFilter('high');
  }
}

function isPastDue(value?: string): boolean {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function formatDate(value?: string): string {
  if (!value) return 'N/A';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
}
