import { useMemo, useState } from 'react';
import { LockedScopeSummary } from '../LockedScopeSummary';
import type { FpiFacility, StatusTone } from '../../data/fpiTypes';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StoreScopeState } from '../../data/storeScope';
import type { EprData, EprFacility, EprHotel, EprIncident, EprSecuritySolution, EprTask } from '../../data/eprTypes';
import { applyEprScope } from '../../data/eprScope';
import { useEprData } from '../../data/useEprData';

export type ExecutiveProtectionReadinessViewProps = {
  facilities: FpiFacility[];
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type EprTab = 'overview' | 'visits' | 'hotels' | 'incidents' | 'mitigation' | 'tasks' | 'analysis';

const tabs: Array<{ id: EprTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'Readiness' },
  { id: 'visits', label: 'Visit Planner', eyebrow: 'Travel' },
  { id: 'hotels', label: 'Hotel Intelligence', eyebrow: 'Safety' },
  { id: 'incidents', label: 'Incident Risk', eyebrow: 'Risk' },
  { id: 'mitigation', label: 'Security Mitigation', eyebrow: 'Controls' },
  { id: 'tasks', label: 'Tasks & Governance', eyebrow: 'Action' },
  { id: 'analysis', label: 'Source Analysis', eyebrow: 'Handoff' },
];

export function ExecutiveProtectionReadinessView({
  facilities,
  fireSites,
  storeScope,
  onChangeScopeRequest,
}: ExecutiveProtectionReadinessViewProps) {
  const [activeTab, setActiveTab] = useState<EprTab>('overview');
  const eprState = useEprData();
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

      <LockedScopeSummary sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />

      {eprState.loading ? <StatePanel title="Loading EPR data package" message="Preparing the analyzed executive protection, travel, hotel, incident, and mitigation data." /> : null}
      {eprState.error ? <StatePanel title="EPR data unavailable" message={eprState.error} tone="critical" /> : null}

      {eprData ? (
        <>
          <nav className="epr-tab-bar" aria-label="Executive Protection Readiness sub tabs">
            {tabs.map((tab) => (
              <button className={tab.id === activeTab ? 'epr-tab active' : 'epr-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={tab.id === activeTab}>
                <span>{tab.eyebrow}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' ? <OverviewTab data={eprData} scopedFacilityCount={facilities.length} topRiskFacilities={topRiskFacilities} /> : null}
          {activeTab === 'visits' ? <VisitPlannerTab data={eprData} /> : null}
          {activeTab === 'hotels' ? <HotelIntelligenceTab data={eprData} /> : null}
          {activeTab === 'incidents' ? <IncidentRiskTab data={eprData} /> : null}
          {activeTab === 'mitigation' ? <MitigationTab data={eprData} /> : null}
          {activeTab === 'tasks' ? <TasksGovernanceTab data={eprData} /> : null}
          {activeTab === 'analysis' ? <SourceAnalysisTab data={eprData} /> : null}
        </>
      ) : null}
    </section>
  );
}

function OverviewTab({ data, scopedFacilityCount, topRiskFacilities }: { data: EprData; scopedFacilityCount: number; topRiskFacilities: EprFacility[] }) {
  const kpis = data.kpis;
  return (
    <>
      <section className="executive-strip" aria-label="EPR source package summary">
        <ExecutiveItem label="Files analyzed" value={data.metadata.file_count_analyzed} trend="Complete" tone="ready" />
        <ExecutiveItem label="Incident records" value={kpis.incident_records} trend="Risk data" tone="watch" />
        <ExecutiveItem label="Security incidents" value={kpis.security_incidents} trend="SMM source" tone="critical" />
        <ExecutiveItem label="Route facilities" value={kpis.visit_facilities} trend="Visit planner" tone="stable" />
        <ExecutiveItem label="Hotel options" value={kpis.hotel_recommendations} trend="Safety scored" tone="track" />
        <ExecutiveItem label="Active UI scope" value={scopedFacilityCount} trend="Main FPI scope" tone="expanding" />
      </section>

      <section className="dashboard-grid epr-grid" aria-label="EPR overview detail">
        <section className="panel selected-service-panel">
          <div className="card-heading service-heading">
            <div>
              <p className="eyebrow">Implementation placement</p>
              <h2>EPR now owns travel, visit planning, hotel safety, incident risk, and security mitigation workflows.</h2>
            </div>
            <StatusPill label="IMPLEMENTED" tone="ready" />
          </div>
          <p>{data.executive_summary.recommended_ui_home}</p>
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
          <div className="card-heading"><div><p className="eyebrow">Document analysis</p><h2>Source package coverage</h2></div><StatusPill label="ALL FILES" tone="ready" /></div>
          <p>{data.metadata.analysis_status}</p>
          <div className="module-map">
            {['FastAPI routes', 'Jinja templates', 'SQLite incident data', 'Spotnana mock', 'Security recommender', 'Markdown handoffs'].map((item) => (
              <div className="module-chip" key={item}><StatusPill label="MAPPED" tone="stable" /><strong>{item}</strong><small>Mapped into the EPR tab or planned service tabs.</small></div>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

function VisitPlannerTab({ data }: { data: EprData }) {
  const facilities = [...data.visit_planner.route_facilities].sort((a, b) => b.risk_score - a.risk_score);
  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Visit planning and routing</p><h2>Executive/field visit route builder</h2></div><StatusPill label="DATA BACKED" tone="ready" /></div>
        <p>The Cody handoff Visit Planner maps high-risk facilities, route order, calendar export, and travel handoff logic into EPR.</p>
        <ol className="activity-list epr-workflow-list">
          {data.visit_planner.workflow.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>
      <section className="panel fire-facilities-panel">
        <div className="card-heading"><div><p className="eyebrow">Route queue</p><h2>Facilities available for executive/field visit planning</h2></div></div>
        <div className="epr-table-shell"><table><thead><tr><th>Facility</th><th>Market</th><th>Risk</th><th>Tasks</th></tr></thead><tbody>{facilities.map((facility) => <FacilityRow facility={facility} key={facility.facility_id} />)}</tbody></table></div>
      </section>
    </section>
  );
}

function HotelIntelligenceTab({ data }: { data: EprData }) {
  const scoring = data.hotel_intelligence.safety_scoring;
  const weights = scoring.weights && typeof scoring.weights === 'object' ? Object.entries(scoring.weights as Record<string, number>) : [];
  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Travel safety intelligence</p><h2>Hotel Safety Intelligence + Spotnana handoff</h2></div><StatusPill label="SAFETY SCORED" tone="ready" /></div>
        <p>Hotels are ranked by safety score first, Walmart-preferred status second, and price third. The original Spotnana mock is represented as a booking handoff workflow inside EPR.</p>
        <div className="service-meta-grid">
          {weights.map(([label, weight]) => <div key={label}><span>{formatLabel(label)}</span><strong>{Math.round(Number(weight) * 100)}%</strong></div>)}
        </div>
      </section>
      <section className="epr-hotel-grid">
        {data.hotel_intelligence.hotels.map((hotel) => <HotelCard hotel={hotel} key={hotel.hotel_id} />)}
      </section>
    </section>
  );
}

function IncidentRiskTab({ data }: { data: EprData }) {
  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Incident intelligence</p><h2>Risk signals for executive movement and facility visits</h2></div><StatusPill label="855 INCIDENTS" tone="watch" /></div>
        <div className="service-meta-grid service-live-metrics">
          {data.incident_intelligence.incident_type_counts.slice(0, 5).map(([type, count]) => <div key={type}><span>{type}</span><strong>{count}</strong></div>)}
        </div>
      </section>
      <section className="panel fire-signals-panel">
        <div className="card-heading"><div><p className="eyebrow">Recent sample</p><h2>Recent incident records</h2></div></div>
        <RecordList incidents={data.incident_intelligence.recent_incident_sample.slice(0, 12)} />
      </section>
    </section>
  );
}

function MitigationTab({ data }: { data: EprData }) {
  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Security Mitigation Manager</p><h2>Recommended controls and projected-prevention ROI</h2></div><StatusPill label="RULES MAPPED" tone="ready" /></div>
        <p>Security mitigation recommendations from the Cody app are staged here for EPR coordination with security vendors and external partners.</p>
        <div className="module-map epr-rule-map">
          {data.security_mitigation.recommender_rules.map((rule) => <div className="module-chip" key={rule}><StatusPill label="RULE" tone="stable" /><strong>{rule}</strong></div>)}
        </div>
      </section>
      <section className="panel fire-remediation-panel">
        <div className="card-heading"><div><p className="eyebrow">Solutions catalog</p><h2>{data.security_mitigation.solutions.length} mitigation options</h2></div></div>
        <div className="epr-card-list">{data.security_mitigation.solutions.map((solution) => <SolutionCard solution={solution} key={solution.id} />)}</div>
      </section>
    </section>
  );
}

function TasksGovernanceTab({ data }: { data: EprData }) {
  const tasks = [...data.tasks_governance.tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Readiness action queue</p><h2>Task ownership, remediation state, evidence, and SLA governance</h2></div><StatusPill label="WORKFLOW" tone="track" /></div>
        <div className="service-meta-grid service-live-metrics">
          <div><span>Total tasks</span><strong>{data.kpis.tasks}</strong></div>
          <div><span>Remediations</span><strong>{data.kpis.remediations}</strong></div>
          <div><span>Critical</span><strong>{tasks.filter((task) => task.priority === 'Critical').length}</strong></div>
          <div><span>Evidence required</span><strong>{tasks.filter((task) => task.evidence_required).length}</strong></div>
          <div><span>Owners</span><strong>{new Set(tasks.map((task) => task.owner_name)).size}</strong></div>
        </div>
      </section>
      <section className="panel fire-workqueue-panel">
        <div className="card-heading"><div><p className="eyebrow">Task queue</p><h2>Priority task sample</h2></div></div>
        <div className="epr-table-shell"><table><thead><tr><th>Task</th><th>Owner</th><th>Priority</th><th>Status</th></tr></thead><tbody>{tasks.slice(0, 12).map((task) => <TaskRow task={task} key={task.task_id} />)}</tbody></table></div>
      </section>
    </section>
  );
}

function SourceAnalysisTab({ data }: { data: EprData }) {
  const groups = data.source_inventory.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.extension] = (accumulator[item.extension] ?? 0) + 1;
    return accumulator;
  }, {});
  return (
    <section className="dashboard-grid epr-grid">
      <section className="panel selected-service-panel">
        <div className="card-heading"><div><p className="eyebrow">Completed file analysis</p><h2>Every source asset was inventoried and mapped</h2></div><StatusPill label="COMPLETE" tone="ready" /></div>
        <p>{data.metadata.classification}</p>
        <div className="service-meta-grid service-live-metrics">
          {Object.entries(groups).map(([extension, count]) => <div key={extension}><span>{extension}</span><strong>{count}</strong></div>)}
        </div>
      </section>
      <section className="panel fire-facilities-panel">
        <div className="card-heading"><div><p className="eyebrow">Inventory</p><h2>Analyzed source files</h2></div></div>
        <div className="epr-table-shell"><table><thead><tr><th>Path</th><th>Type</th><th>Size</th></tr></thead><tbody>{data.source_inventory.map((item) => <tr key={item.path}><td>{item.path}</td><td>{item.extension}</td><td>{formatNumber(item.bytes)} B</td></tr>)}</tbody></table></div>
      </section>
    </section>
  );
}

function ExecutiveItem({ label, value, trend, tone }: { label: string; value: string | number; trend: string; tone: StatusTone }) {
  return <article className="executive-item"><span>{label}</span><strong>{formatNumber(value)}</strong><StatusPill label={trend} tone={tone} /></article>;
}

function FacilityRow({ facility }: { facility: EprFacility }) {
  return <tr><td><strong>{facility.facility_name}</strong><small>{facility.facility_id}</small></td><td>{facility.market}<small>{facility.region}</small></td><td>{Math.round(facility.risk_score)}</td><td>{facility.open_task_count} open / {facility.overdue_task_count} overdue</td></tr>;
}

function HotelCard({ hotel }: { hotel: EprHotel }) {
  const safety = hotel.safety_score?.overall_score ?? 0;
  return (
    <article className="panel epr-hotel-card">
      {hotel.image_url ? <img src={hotel.image_url} alt="" loading="lazy" /> : null}
      <div className="card-heading"><div><p className="eyebrow">{hotel.brand}</p><h2>{hotel.name}</h2></div><StatusPill label={`${safety}/100`} tone={safety >= 85 ? 'ready' : 'watch'} /></div>
      <p>{hotel.address}, {hotel.city}, {hotel.state}</p>
      <div className="service-meta-grid">
        <div><span>Rate</span><strong>${hotel.price_per_night.toFixed(2)}</strong></div>
        <div><span>Rating</span><strong>{hotel.rating}</strong></div>
        <div><span>Crime index</span><strong>{hotel.safety_score?.crime_index ?? 'N/A'}</strong></div>
      </div>
      <div className="badge-list">{hotel.safety_score?.safety_features.slice(0, 4).map((feature) => <span className="scope-chip selected" key={feature}>{feature}</span>)}</div>
    </article>
  );
}

function RecordList({ incidents }: { incidents: EprIncident[] }) {
  return <div className="facility-record-list">{incidents.map((incident) => <div className="facility-record" key={incident.id}><strong>{incident.incident_type}</strong><span>{incident.facility_id ? `Store #${incident.facility_id}` : 'Security incident'} · {incident.city || 'Unknown'}, {incident.state || 'N/A'} · Severity {incident.severity}</span><small>{incident.description}</small></div>)}</div>;
}

function SolutionCard({ solution }: { solution: EprSecuritySolution }) {
  return <article className="facility-record epr-solution-card"><strong>{solution.name}</strong><span>{formatLabel(solution.solution_type)} · {solution.effectiveness_rating}% effective</span><small>{solution.coverage_area}</small><small>5-year base cost: {formatCurrency(solution.upfront_cost + solution.annual_cost * 5)}</small></article>;
}

function TaskRow({ task }: { task: EprTask }) {
  return <tr><td><strong>{task.task_id}</strong><small>{task.title}</small></td><td>{task.owner_name}<small>{task.owner_role}</small></td><td><StatusPill label={task.priority} tone={task.priority === 'Critical' ? 'critical' : task.priority === 'High' ? 'watch' : 'stable'} /></td><td>{task.status}<small>{task.facility_name}</small></td></tr>;
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
