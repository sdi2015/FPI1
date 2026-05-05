import { useMemo, useState } from 'react';
import { LockedScopeSummary } from '../LockedScopeSummary';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyTechnologyHealthScope } from '../../data/technologyHealthScope';
import { formatDate, formatNumber, formatPercent, getCameraTechnologyIssues, percent, sortStoresByTechnicalRisk } from '../../data/technologyHealthSelectors';
import type { StoreCameraHealth, TechnologyHealthData } from '../../data/technologyHealthTypes';
import { useTechnologyHealthData } from '../../data/useTechnologyHealthData';

export type CameraTechnicalControlViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type CameraTab = 'overview' | 'region' | 'inventory' | 'compliance' | 'retention' | 'predictive' | 'workqueue';

type StoreFilter = 'all' | 'Healthy' | 'Warning' | 'Critical';

const cameraTabs: Array<{ id: CameraTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'Health' },
  { id: 'region', label: 'Region Health', eyebrow: 'Stores' },
  { id: 'inventory', label: 'CCTV Inventory', eyebrow: 'Assets' },
  { id: 'compliance', label: 'AP-14 Compliance', eyebrow: 'Policy' },
  { id: 'retention', label: 'Retention & Profiles', eyebrow: 'Evidence' },
  { id: 'predictive', label: 'Predictive Agent', eyebrow: 'Forecast' },
  { id: 'workqueue', label: 'Work Queue', eyebrow: 'Action' },
];

export function CameraTechnicalControlView({ fireSites, storeScope, onChangeScopeRequest }: CameraTechnicalControlViewProps) {
  const [activeTab, setActiveTab] = useState<CameraTab>('overview');
  const techState = useTechnologyHealthData();
  const scopedTechnologyData = useMemo(() => (techState.data ? applyTechnologyHealthScope(techState.data, fireSites, storeScope) : null), [techState.data, fireSites, storeScope]);

  return (
    <section className="tech-page" aria-label="Camera and Technical Control Monitoring">
      <header className="tech-header">
        <div>
          <p className="tech-eyebrow">CCTV / VMS Operations Intelligence</p>
          <h1>Camera & Technical Control Monitoring</h1>
          <p>Sanitized Region 75 camera posture, VMS/recorder health, AP-14 policy guidance, retention/profile evidence, predictive issue detection, and simulated ticket orchestration.</p>
        </div>
        <div className="tech-mode"><span>MODE</span>SANITIZED DEMO DATA</div>
      </header>

      <LockedScopeSummary sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {techState.loading ? <StatePanel title="Loading technology health dataset" message="Preparing sanitized CCTV/VMS and technology-health data." /> : null}
      {techState.error ? <StatePanel title="Technology health dataset unavailable" message={techState.error} danger /> : null}

      {scopedTechnologyData ? (
        <>
          <nav className="tech-tab-bar" aria-label="Camera technical control sub tabs">
            {cameraTabs.map((tab) => (
              <button className={activeTab === tab.id ? 'tech-tab active' : 'tech-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}>
                <span>{tab.eyebrow}</span>{tab.label}
              </button>
            ))}
          </nav>
          {activeTab === 'overview' ? <CameraOverview data={scopedTechnologyData} /> : null}
          {activeTab === 'region' ? <RegionHealth data={scopedTechnologyData} /> : null}
          {activeTab === 'inventory' ? <CctvInventory data={scopedTechnologyData} /> : null}
          {activeTab === 'compliance' ? <ComplianceView data={scopedTechnologyData} /> : null}
          {activeTab === 'retention' ? <RetentionView data={scopedTechnologyData} /> : null}
          {activeTab === 'predictive' ? <PredictiveView data={scopedTechnologyData} /> : null}
          {activeTab === 'workqueue' ? <WorkQueueView data={scopedTechnologyData} /> : null}
        </>
      ) : null}
    </section>
  );
}

function CameraOverview({ data }: { data: TechnologyHealthData }) {
  const summary = data.regionSummary;
  const cameraIssues = getCameraTechnologyIssues(data);
  return (
    <>
      <section className="tech-kpi-grid" aria-label="Camera health KPIs">
        <Kpi label="Region online health" value={formatPercent(summary.onlinePercent)} detail={`${formatNumber(summary.onlineCameras)} online / ${formatNumber(summary.totalCameras)} cameras`} tone="blue" />
        <Kpi label="Offline cameras" value={formatNumber(summary.offlineCameras)} detail={`${formatNumber(summary.issueCameras)} issue cameras`} tone="yellow" />
        <Kpi label="Stores monitored" value={formatNumber(summary.stores)} detail={`${formatNumber(summary.recorders)} VMS recorders`} tone="sky" />
        <Kpi label="Fleet health" value={formatPercent(data.fleetSummary.onlinePercent)} detail={`${formatNumber(data.fleetSummary.storeCount)} stores in snapshot`} tone="white" />
      </section>
      <ServiceFocusStrip />
      <section className="tech-grid">
        <section className="tech-card wide">
          <CardHeading eyebrow="Region 75 posture" title="Camera/VMS monitoring health is warning-level but operationally actionable." pill="SANITIZED" tone="ready" />
          <p>{data.metadata.sourceNote}</p>
          <div className="tech-metric-grid">
            <Metric label="IP cameras" value={formatNumber(summary.ipCameras)} helper={`${percent(summary.ipCameras, summary.totalCameras)}% of region`} />
            <Metric label="Analog cameras" value={formatNumber(summary.analogCameras)} helper={`${percent(summary.analogCameras, summary.totalCameras)}% of region`} />
            <Metric label="Profile warnings" value={formatNumber(data.complianceSummary.profileWarnings)} helper="No Recording Profiles Set / missing source" />
            <Metric label="Network placement flags" value={formatNumber(data.complianceSummary.networkPlacementFlags)} helper="Sanitized subnet placement indicators" />
          </div>
        </section>
        <section className="tech-card">
          <CardHeading eyebrow="Normalized issues" title="TechnologyIssue links" />
          <div className="tech-record-list">
            {cameraIssues.map((issue) => <IssueCard issue={issue} key={issue.issue_id} />)}
          </div>
        </section>
      </section>
    </>
  );
}

function ServiceFocusStrip() {
  return (
    <section className="tech-focus-strip" aria-label="Camera technical control operating model">
      <article><span>01</span><strong>Detect coverage degradation</strong><small>Monitor offline cameras, issue cameras, VMS health, and store-level posture without exposing raw camera identifiers.</small></article>
      <article><span>02</span><strong>Assure evidence readiness</strong><small>Track retention/profile exceptions, AP-14 policy implications, and sanitized compliance signals for audit-ready follow-up.</small></article>
      <article><span>03</span><strong>Orchestrate service action</strong><small>Convert grouped outage clusters into simulated ticket candidates with severity, assignment, evidence, and SLA context.</small></article>
    </section>
  );
}

function RegionHealth({ data }: { data: TechnologyHealthData }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StoreFilter>('all');
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortStoresByTechnicalRisk(data.storeHealth)
      .filter((store) => filter === 'all' || store.healthStatus === filter)
      .filter((store) => !term || [store.siteAlias, store.region, store.facilityType, store.vmsPlatform, store.healthStatus].join(' ').toLowerCase().includes(term));
  }, [data.storeHealth, search, filter]);

  return (
    <section className="tech-card">
      <div className="tech-directory-header"><div><p className="tech-eyebrow">Sanitized store health</p><h2>Region 75 CCTV/VMS posture</h2></div><strong>{rows.length} stores</strong></div>
      <div className="tech-filters">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store alias, platform, status, region" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as StoreFilter)}><option value="all">All health states</option><option value="Healthy">Healthy</option><option value="Warning">Warning</option><option value="Critical">Critical</option></select>
      </div>
      <StoreHealthTable stores={rows} />
    </section>
  );
}

function CctvInventory({ data }: { data: TechnologyHealthData }) {
  return (
    <section className="tech-grid">
      <section className="tech-card wide"><CardHeading eyebrow="Asset mix" title="CCTV inventory rollups" pill="NO RAW IDS" tone="ready" /><ChartRows rows={data.analytics.cameraCategoryCounts} /></section>
      <section className="tech-card"><CardHeading eyebrow="Camera statuses" title="Top status labels" /><ChartRows rows={data.analytics.cameraStatusCounts} /></section>
      <section className="tech-card"><CardHeading eyebrow="Recorder health" title="VMS/recorder status" /><ChartRows rows={data.analytics.recorderStatusCounts} /></section>
      <section className="tech-card wide"><CardHeading eyebrow="Manufacturer mix" title="Camera manufacturer rollup" /><ChartRows rows={data.analytics.manufacturerCounts} /></section>
    </section>
  );
}

function ComplianceView({ data }: { data: TechnologyHealthData }) {
  return (
    <section className="tech-grid">
      <section className="tech-card wide">
        <CardHeading eyebrow="AP-14 policy-informed controls" title="Compliance guidance for CCTV monitoring" pill="CONFIGURABLE" tone="watch" />
        <p>{data.complianceSummary.policySource}</p>
        <div className="tech-metric-grid">
          <Metric label="Compliance cards" value={formatNumber(data.complianceSummary.storeComplianceCards)} helper="Store-level review cards available" />
          <Metric label="Critical ticket candidates" value={formatNumber(data.complianceSummary.criticalServiceTicketCandidates)} helper="Based on sanitized outage severity" />
          <Metric label="Profile warnings" value={formatNumber(data.complianceSummary.profileWarnings)} helper="Recording profile exceptions" />
          <Metric label="Placement flags" value={formatNumber(data.complianceSummary.networkPlacementFlags)} helper="Network/camera placement indicators" />
        </div>
      </section>
      <section className="tech-card">
        <CardHeading eyebrow="Policy implications" title="Default action rules" />
        <ol className="tech-ordered-list">{data.complianceSummary.policyImplications.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>
    </section>
  );
}

function RetentionView({ data }: { data: TechnologyHealthData }) {
  const summary = data.regionSummary;
  const stores = sortStoresByTechnicalRisk(data.storeHealth).filter((store) => store.missingProfileCount > 0 || store.issueCameraCount > 0).slice(0, 12);
  return (
    <section className="tech-grid">
      <section className="tech-card wide"><CardHeading eyebrow="Retention / profiles" title="Evidence readiness and recording profile posture" pill="AP-14 ALIGNED" tone="stable" />
        <div className="tech-metric-grid">
          <Metric label="Profiles assigned" value={formatNumber(summary.recordingProfileAssigned)} helper="When available in sanitized source" />
          <Metric label="Profiles missing" value={formatNumber(summary.recordingProfileMissing)} helper="Missing / not in source" />
          <Metric label="Retention OK" value={formatNumber(summary.retentionOk)} helper="Configurable threshold" />
          <Metric label="Retention unknown" value={formatNumber(summary.retentionUnknown)} helper="Needs source confidence" />
        </div>
      </section>
      <section className="tech-card"><CardHeading eyebrow="Profile exception stores" title="Top review candidates" /><div className="tech-record-list">{stores.map((store) => <StoreMiniCard store={store} key={store.siteAlias} />)}</div></section>
    </section>
  );
}

function PredictiveView({ data }: { data: TechnologyHealthData }) {
  return <section className="tech-card"><CardHeading eyebrow="Predictive CCTV Agent" title="Stores trending toward service-impacting camera risk" pill="SIMULATED" tone="watch" /><p>{data.predictiveSummary.scope}</p><div className="tech-predictive-grid">{data.predictiveSummary.candidates.map((candidate) => <article className="tech-predictive-card" key={candidate.siteAlias}><strong>{candidate.siteAlias}</strong><em>{candidate.riskScore}</em><span>{candidate.forecast}</span><ul>{candidate.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul><p>{candidate.recommendedAction}</p></article>)}</div></section>;
}

function WorkQueueView({ data }: { data: TechnologyHealthData }) {
  return <section className="tech-card"><CardHeading eyebrow="Ticket simulation" title="Grouped CCTV service work queue" pill="NO WRITEBACK" tone="critical" /><div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Site</th><th>Finding</th><th>Severity</th><th>Channel</th><th>Assignment</th><th>SLA</th></tr></thead><tbody>{data.workQueue.map((item) => <tr key={item.id}><td>{item.siteAlias}</td><td><strong>{item.title}</strong><small>{item.status} · Evidence required: {item.evidenceRequired ? 'Yes' : 'No'}</small></td><td><StatusPill label={item.severity} tone={item.severity === 'Critical' ? 'critical' : item.severity === 'High' ? 'watch' : 'stable'} /></td><td>{item.channel}</td><td>{item.assignmentGroup}</td><td>{item.sla}</td></tr>)}</tbody></table></div></section>;
}

function StoreHealthTable({ stores }: { stores: StoreCameraHealth[] }) {
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store alias</th><th>Status</th><th>Online</th><th>Cameras</th><th>VSRV</th><th>IP / Analog</th><th>Issues</th><th>Last scan</th></tr></thead><tbody>{stores.map((store) => <tr key={store.siteAlias}><td><strong>{store.siteAlias}</strong><small>{store.facilityType} · {store.vmsPlatform}</small></td><td><HealthBadge status={store.healthStatus} /></td><td>{formatPercent(store.onlinePercent)}</td><td>{formatNumber(store.totalCameras)}<small>{formatNumber(store.offlineCameras)} offline</small></td><td>{store.vsrvCount}</td><td>{formatNumber(store.ipTotal)} / {formatNumber(store.analogTotal)}<small>{formatNumber(store.analogOffline)} analog offline</small></td><td>{formatNumber(store.issueCameraCount)}<small>{formatNumber(store.missingProfileCount)} profile · {formatNumber(store.misplacedSubnetCount)} placement</small></td><td>{formatDate(store.lastScan)}</td></tr>)}</tbody></table></div>;
}

function StoreMiniCard({ store }: { store: StoreCameraHealth }) {
  return <article className="tech-record"><strong>{store.siteAlias}</strong><span>{store.healthStatus} · {formatPercent(store.onlinePercent)} online</span><small>{formatNumber(store.issueCameraCount)} issue cameras · {formatNumber(store.missingProfileCount)} profile warnings</small></article>;
}

function IssueCard({ issue }: { issue: ReturnType<typeof getCameraTechnologyIssues>[number] }) {
  return <article className="tech-record"><strong>{issue.domain} · {issue.status}</strong><span>{issue.severity} severity · {issue.confidence} confidence · {issue.freshness_status}</span><small>{issue.summary}</small></article>;
}

function ChartRows({ rows }: { rows: Record<string, number> }) {
  const entries = Object.entries(rows).slice(0, 10);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return <div className="tech-chart-rows">{entries.map(([label, value]) => <div className="tech-chart-row" key={label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><div className="tech-chart-track"><span style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div></div>)}</div>;
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'yellow' | 'sky' | 'white' }) {
  return <article className={`tech-kpi tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function CardHeading({ eyebrow, title, pill, tone = 'stable' }: { eyebrow: string; title: string; pill?: string; tone?: StatusTone }) {
  return <div className="tech-card-heading"><div><p className="tech-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{pill ? <StatusPill label={pill} tone={tone} /> : null}</div>;
}

function HealthBadge({ status }: { status: string }) {
  const tone: StatusTone = status === 'Critical' ? 'critical' : status === 'Warning' ? 'watch' : status === 'Healthy' ? 'ready' : 'stable';
  return <StatusPill label={status.toUpperCase()} tone={tone} />;
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="tech-card tech-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}
