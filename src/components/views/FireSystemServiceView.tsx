import { useMemo, useState } from 'react';
import { FacilityScopeSelector } from '../FacilityScopeSelector';
import type { FacilityScopeState } from '../../data/fpiScope';
import type { FpiDashboardMetrics, FpiProgramData, StatusTone } from '../../data/fpiTypes';
import type { FireAlarmDashboardModel, FireAlarmKpi, FireAlarmSiteSummary } from '../../data/fireAlarmTypes';
import { useFireAlarmData } from '../../data/useFireAlarmData';

export type FireSystemServiceViewProps = {
  programData: FpiProgramData;
  facilities: FpiProgramData['facilities'];
  dashboardMetrics: FpiDashboardMetrics;
  facilityScope: FacilityScopeState;
  onScopeChange: (nextScope: FacilityScopeState) => void;
  onFacilitySelect: (facilityId: string) => void;
};

export function FireSystemServiceView({ facilities, dashboardMetrics, facilityScope, onScopeChange }: FireSystemServiceViewProps) {
  const fireAlarmState = useFireAlarmData();
  const [siteSearch, setSiteSearch] = useState('');
  const filteredPrioritySites = useMemo(
    () => filterSites(fireAlarmState.model?.prioritySites ?? [], siteSearch),
    [fireAlarmState.model?.prioritySites, siteSearch],
  );

  return (
    <>
      <header className="dashboard-header service-view-header">
        <div>
          <p className="eyebrow">Service dashboard • Fire alarm handoff dataset</p>
          <h1>Fire-System Monitoring & Assurance</h1>
          <p>
            Assurance view for fire panels, sprinkler supervisory panels, fire/life-safety events, inspection cadence,
            deficiencies, contractor follow-up, AHJ coordination, and fire-system recommendations.
          </p>
        </div>
        <StatusPill label={fireAlarmState.model?.status ?? 'LOADING'} tone={statusToneForFireStatus(fireAlarmState.model?.status)} />
      </header>

      <FacilityScopeSelector facilities={facilities} scope={facilityScope} metrics={dashboardMetrics} onScopeChange={onScopeChange} />

      {fireAlarmState.loading ? <StatePanel title="Loading fire-system handoff data" message="Preparing the fire alarm operations intelligence export." /> : null}
      {fireAlarmState.error ? <StatePanel title="Fire-system data is unavailable" message={fireAlarmState.error} tone="critical" /> : null}

      {fireAlarmState.data && fireAlarmState.model ? (
        <>
          <section className="fire-dataset-banner panel" aria-label="Fire-system dataset details">
            <div>
              <p className="eyebrow">Dataset source</p>
              <h2>{fireAlarmState.data.description}</h2>
              <p>
                Exported {formatDate(fireAlarmState.data.exportDate)} • version {fireAlarmState.data.version}. This view uses the dedicated
                fire alarm operations JSON while preserving the FPI facility scope selector for the broader command-center context.
              </p>
            </div>
            <div className="mode-pill"><span>SITES</span>{fireAlarmState.data.summary.totalSites}</div>
          </section>

          <section className="kpi-grid fire-kpi-grid" aria-label="Fire-system monitoring indicators">
            {fireAlarmState.model.kpis.map((kpi) => <FireKpiCard kpi={kpi} key={kpi.label} />)}
          </section>

          <section className="dashboard-grid fire-service-grid" aria-label="Fire-system operational detail">
            <PanelAndMonitoringSection model={fireAlarmState.model} />
            <RiskAndComplianceSection model={fireAlarmState.model} />
            <PrioritySitesSection sites={filteredPrioritySites} search={siteSearch} onSearchChange={setSiteSearch} />
            <DeficienciesSection model={fireAlarmState.model} />
            <EventsAndAhjSection model={fireAlarmState.model} />
            <RecommendationsSection model={fireAlarmState.model} />
          </section>
        </>
      ) : null}
    </>
  );
}

function FireKpiCard({ kpi }: { kpi: FireAlarmKpi }) {
  const isPriority = kpi.tone === 'critical' || kpi.label === 'Open Deficiencies' || kpi.label === 'Active Trouble Sites';

  return (
    <article className={isPriority ? 'kpi-card priority-kpi' : 'kpi-card'}>
      <div className="kpi-topline">
        <span>{kpi.label}</span>
        <StatusPill label={kpi.status} tone={kpi.tone} />
      </div>
      <strong>{kpi.value}</strong>
      <small>Fire alarm operations export</small>
      <p>{kpi.caption}</p>
    </article>
  );
}

function PanelAndMonitoringSection({ model }: { model: FireAlarmDashboardModel }) {
  return (
    <section className="panel fire-panel-health-panel" aria-labelledby="panel-monitoring-title">
      <div className="card-heading"><div><p className="eyebrow">Panel / Fire / Device Health</p><h2 id="panel-monitoring-title">Panel and monitoring profile</h2></div></div>
      <div className="service-meta-grid">
        <div><span>High-risk sites</span><strong>{model.highRiskSites}</strong></div>
        <div><span>Active trouble sites</span><strong>{model.activeTroubleSites}</strong></div>
        <div><span>Overdue inspections</span><strong>{model.overdueInspections}</strong></div>
      </div>
      <BreakdownList title="Panel type distribution" items={model.panelTypeBreakdown} />
      <BreakdownList title="Monitoring type distribution" items={model.monitoringTypeBreakdown} />
    </section>
  );
}

function RiskAndComplianceSection({ model }: { model: FireAlarmDashboardModel }) {
  return (
    <section className="panel fire-signals-panel" aria-labelledby="risk-compliance-title">
      <div className="card-heading"><div><p className="eyebrow">Risk & Compliance</p><h2 id="risk-compliance-title">Compliance posture</h2></div><StatusPill label={model.status} tone={statusToneForFireStatus(model.status)} /></div>
      <div className="service-meta-grid">
        <div><span>Open deficiencies</span><strong>{model.openDeficiencies}</strong></div>
        <div><span>False alarms 90 days</span><strong>{model.falseAlarms90Days}</strong></div>
        <div><span>AHJ follow-up sites</span><strong>{model.ahjCoordination.length}</strong></div>
      </div>
      <BreakdownList title="Compliance status" items={model.complianceBreakdown} />
      <BreakdownList title="Contractor assignment" items={model.contractorBreakdown} />
    </section>
  );
}

function PrioritySitesSection({ sites, search, onSearchChange }: { sites: FireAlarmSiteSummary[]; search: string; onSearchChange: (value: string) => void }) {
  return (
    <section className="panel fire-facilities-panel" aria-labelledby="priority-fire-sites-title">
      <div className="card-heading"><div><p className="eyebrow">Fire-System Site Table</p><h2 id="priority-fire-sites-title">Priority sites requiring assurance review</h2></div></div>
      <label className="facility-search-label" htmlFor="fire-site-search">Search fire-system sites</label>
      <input
        id="fire-site-search"
        className="facility-search-input"
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by site, ID, city, state, contractor, AHJ, or panel type"
      />
      <div className="top-risk-list fire-site-list">
        {sites.length > 0 ? sites.map((site) => (
          <article className="top-risk-item fire-site-card" key={site.id}>
            <div>
              <strong>{site.name}</strong>
              <span>{site.id} • {site.city}, {site.state} • {site.region}</span>
            </div>
            <StatusPill label={site.complianceStatus.toUpperCase()} tone={toneForCompliance(site.complianceStatus)} />
            <p>{site.panelType} · {site.monitoringType} · risk score {site.riskScore}</p>
            <small>{site.openDeficiencies} deficiencies · {site.activeTroubles} troubles · {site.falseAlarms90Days} false alarms · {site.primaryConcern}</small>
            <small>Contractor: {site.contractor} • AHJ: {site.ahj}</small>
          </article>
        )) : <p className="empty-records">No fire-system sites match the current search.</p>}
      </div>
    </section>
  );
}

function DeficienciesSection({ model }: { model: FireAlarmDashboardModel }) {
  return (
    <section className="panel fire-exceptions-panel" aria-labelledby="deficiencies-title">
      <div className="card-heading"><div><p className="eyebrow">Fire-System Critical Exceptions</p><h2 id="deficiencies-title">Open deficiencies</h2></div></div>
      <RecordList emptyText="No open deficiencies in the fire alarm export.">
        {model.openDeficiencyRecords.map((deficiency) => (
          <article className="facility-record" key={deficiency.id}>
            <strong>{deficiency.finding ?? deficiency.category ?? 'Fire-system deficiency'}</strong>
            <span>{deficiency.siteId} • {deficiency.category ?? 'Category N/A'} • {deficiency.status ?? 'Status N/A'}</span>
            <small>{deficiency.severity ?? 'Unknown'} severity • due {formatDate(deficiency.dueDate)}</small>
          </article>
        ))}
      </RecordList>
    </section>
  );
}

function EventsAndAhjSection({ model }: { model: FireAlarmDashboardModel }) {
  return (
    <section className="panel fire-workqueue-panel" aria-labelledby="events-ahj-title">
      <div className="card-heading"><div><p className="eyebrow">Fire & Life-Safety Events / AHJ Coordination</p><h2 id="events-ahj-title">Recent events and coordination needs</h2></div></div>
      <RecordList emptyText="No recent fire-system events in the export.">
        {model.recentEvents.slice(0, 5).map((event) => (
          <article className="facility-record" key={event.id}>
            <strong>{event.type ?? 'Fire-system event'}</strong>
            <span>{event.siteId} • {event.area ?? 'Area N/A'} • {event.rootCause ?? 'Root cause N/A'}</span>
            <small>{formatDate(event.date)} • acknowledge {event.timeToAcknowledge ?? 'N/A'} min • restore {event.timeToRestore ?? 'N/A'} min</small>
          </article>
        ))}
      </RecordList>
      <BreakdownList title="AHJ follow-up candidates" items={model.ahjCoordination.slice(0, 5).map((site) => ({ label: `${site.name} / ${site.ahj}`, count: site.riskScore }))} />
    </section>
  );
}

function RecommendationsSection({ model }: { model: FireAlarmDashboardModel }) {
  return (
    <section className="panel fire-remediation-panel" aria-labelledby="recommendations-title">
      <div className="card-heading"><div><p className="eyebrow">Remediation Status</p><h2 id="recommendations-title">Recommendations and follow-up actions</h2></div></div>
      <RecordList emptyText="No recommendations in the fire alarm export.">
        {model.recommendations.map((recommendation) => (
          <article className="facility-record" key={recommendation.id}>
            <strong>{recommendation.title ?? recommendation.category ?? 'Fire-system recommendation'}</strong>
            <span>{recommendation.siteId} • {recommendation.category ?? 'Category N/A'} • confidence {recommendation.confidence ?? 'N/A'}</span>
            <small>{recommendation.severity ?? 'Unknown'} severity • due {formatDate(recommendation.suggestedDue)}</small>
          </article>
        ))}
      </RecordList>
    </section>
  );
}

function BreakdownList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <div className="fire-breakdown">
      <h3>{title}</h3>
      {items.length > 0 ? items.map((item) => (
        <div key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>
      )) : <p className="empty-records">No breakdown records available.</p>}
    </div>
  );
}

function RecordList({ emptyText, children }: { emptyText: string; children: any }) {
  const records = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return records.length > 0 ? <div className="facility-record-list fire-record-list">{children}</div> : <p className="empty-records">{emptyText}</p>;
}

function StatePanel({ title, message, tone = 'stable' }: { title: string; message: string; tone?: StatusTone }) {
  return (
    <section className="panel dashboard-state-panel" role={tone === 'critical' ? 'alert' : 'status'}>
      <div className="card-heading"><div><p className="eyebrow">Fire-system data</p><h2>{title}</h2></div><StatusPill label={tone === 'critical' ? 'ERROR' : 'STATUS'} tone={tone} /></div>
      <p>{message}</p>
    </section>
  );
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function statusToneForFireStatus(status?: string): StatusTone {
  if (status === 'ESCALATED') return 'critical';
  if (status === 'WATCH') return 'watch';
  if (status === 'READY') return 'ready';
  return 'stable';
}

function toneForCompliance(status: string): StatusTone {
  const normalized = status.toLowerCase();
  if (normalized.includes('normal') || normalized.includes('compliant')) return 'ready';
  if (normalized.includes('critical') || normalized.includes('overdue')) return 'critical';
  return 'watch';
}

function filterSites(sites: FireAlarmSiteSummary[], search: string): FireAlarmSiteSummary[] {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return sites;

  return sites.filter((site) =>
    [site.id, site.name, site.city, site.state, site.region, site.panelType, site.monitoringType, site.contractor, site.ahj, site.complianceStatus]
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}

function formatDate(value?: string): string {
  if (!value) return 'N/A';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
}
