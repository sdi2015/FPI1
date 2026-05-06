import { useEffect, useMemo, useState } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyTechnologyHealthScope } from '../../data/technologyHealthScope';
import { formatDate, formatNumber, formatPercent, getCameraTechnologyIssues, getHealthyStores, getOfflineCameraStores, getUnhealthyStores, healthLabelForPercent, healthToneForPercent, percent, sortStoresByTechnicalRisk, type HealthThresholdTone } from '../../data/technologyHealthSelectors';
import type { CameraWarrantyData, CameraWarrantyRecord } from '../../data/cameraWarrantyTypes';
import type { StoreCameraHealth, TechnologyHealthData } from '../../data/technologyHealthTypes';
import { useCameraWarrantyData } from '../../data/useCameraWarrantyData';
import { useTechnologyHealthData } from '../../data/useTechnologyHealthData';

export type CameraTechnicalControlViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type CameraTab = 'overview' | 'region' | 'inventory' | 'compliance' | 'retention' | 'warranty' | 'predictive' | 'workqueue';

type StoreFilter = 'all' | 'Healthy' | 'Warning' | 'Critical';
type OverviewModal = 'regionHealth' | 'healthyStores' | 'unhealthyStores' | 'offlineCameras' | 'storesMonitored' | 'fleetHealth' | null;

type OfflineCameraRow = {
  storeNumber: string;
  storeName: string;
  cameraName: string;
  ipAddress: string;
  daysOffline: number;
  lastSeen: string;
  cameraType: 'IP' | 'Analog';
  recorderName: string;
  reason: string;
};

type TechnologyEventCard = {
  title: string;
  category: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  recorderName: string;
  description: string;
  examples: string[];
};

const cameraTabs: Array<{ id: CameraTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'Health' },
  { id: 'region', label: 'Region Health', eyebrow: 'Stores' },
  { id: 'inventory', label: 'CCTV Inventory', eyebrow: 'Assets' },
  { id: 'compliance', label: 'AP-14 Compliance', eyebrow: 'Policy' },
  { id: 'retention', label: 'Retention & Profiles', eyebrow: 'Evidence' },
  { id: 'warranty', label: 'Warranty', eyebrow: 'Lifecycle' },
  { id: 'predictive', label: 'Predictive Agent', eyebrow: 'Forecast' },
  { id: 'workqueue', label: 'Work Queue', eyebrow: 'Action' },
];

export function CameraTechnicalControlView({ fireSites, storeScope, onChangeScopeRequest }: CameraTechnicalControlViewProps) {
  const [activeTab, setActiveTab] = useState<CameraTab>('overview');
  const techState = useTechnologyHealthData();
  const warrantyState = useCameraWarrantyData();
  const scopedTechnologyData = useMemo(() => (techState.data ? applyTechnologyHealthScope(techState.data, fireSites, storeScope) : null), [techState.data, fireSites, storeScope]);

  return (
    <section className="tech-page" aria-label="Camera and Technical Control Monitoring">
      <header className="tech-header tech-command-header">
        <div>
          <p className="tech-eyebrow">Walmart Global Governance · CCTV / VMS Operations Intelligence</p>
          <h1>Camera & Technical Control Monitoring</h1>
          <p>Enterprise camera posture, VSRV server-recorder health, AP-14 policy guidance, retention/profile evidence, predictive issue detection, and simulated ticket orchestration for Global Governance operations.</p>
        </div>
        <div className="tech-brand-cluster" aria-label="Walmart Global Governance data mode">
          <img className="tech-spark" src="/brand/walmart/spark/WMT-Spark-SparkYellow-RGB.svg" alt="Walmart Spark" />
          <div className="tech-mode"><span>MODE</span>SANITIZED DEMO DATA · NO WRITEBACK</div>
        </div>
      </header>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
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
          {activeTab === 'warranty' ? <WarrantyView data={warrantyState.data} loading={warrantyState.loading} error={warrantyState.error} fireSites={fireSites} storeScope={storeScope} /> : null}
          {activeTab === 'predictive' ? <PredictiveView data={scopedTechnologyData} /> : null}
          {activeTab === 'workqueue' ? <WorkQueueView data={scopedTechnologyData} /> : null}
        </>
      ) : null}
    </section>
  );
}

function CameraOverview({ data }: { data: TechnologyHealthData }) {
  const summary = data.regionSummary;
  const [activeModal, setActiveModal] = useState<OverviewModal>(null);
  const cameraIssues = getCameraTechnologyIssues(data);
  const healthyStores = useMemo(() => getHealthyStores(data.storeHealth), [data.storeHealth]);
  const unhealthyStores = useMemo(() => getUnhealthyStores(data.storeHealth), [data.storeHealth]);
  const offlineCameraRows = useMemo(() => buildOfflineCameraRows(data.storeHealth), [data.storeHealth]);
  const eventCards = useMemo(() => buildTechnologyEventCards(data), [data]);

  return (
    <>
      <section className="tech-kpi-grid" aria-label="Interactive camera health KPIs">
        <Kpi label="Region online health" value={formatPercent(summary.onlinePercent)} detail={`${formatNumber(summary.onlineCameras)} online / ${formatNumber(summary.totalCameras)} cameras`} tone="blue" healthTone={healthToneForPercent(summary.onlinePercent)} onClick={() => setActiveModal('regionHealth')} />
        <Kpi label="Healthy stores" value={formatNumber(healthyStores.length)} detail="98%+ camera online health" tone="sky" healthTone="green" onClick={() => setActiveModal('healthyStores')} />
        <Kpi label="Unhealthy stores" value={formatNumber(unhealthyStores.length)} detail="Below 98% or operationally degraded" tone="yellow" healthTone={unhealthyStores.some((store) => healthToneForPercent(store.onlinePercent) === 'red') ? 'red' : 'yellow'} onClick={() => setActiveModal('unhealthyStores')} />
        <Kpi label="Offline cameras" value={formatNumber(summary.offlineCameras)} detail={`${formatNumber(summary.issueCameras)} issue cameras`} tone="yellow" healthTone={summary.offlineCameras > 0 ? 'yellow' : 'green'} onClick={() => setActiveModal('offlineCameras')} />
        <Kpi label="Stores monitored" value={formatNumber(summary.stores)} detail={`${formatNumber(summary.recorders)} VSRV server recorders`} tone="white" healthTone="green" onClick={() => setActiveModal('storesMonitored')} />
        <Kpi label="Fleet health" value={formatPercent(data.fleetSummary.onlinePercent)} detail={`${formatNumber(data.fleetSummary.storeCount)} stores in snapshot`} tone="blue" healthTone={healthToneForPercent(data.fleetSummary.onlinePercent)} onClick={() => setActiveModal('fleetHealth')} />
      </section>
      <ServiceFocusStrip />
      <section className="tech-grid">
        <section className="tech-card wide">
          <CardHeading eyebrow="Region 75 posture" title="Camera/VMS monitoring health is warning-level but operationally actionable." pill="SANITIZED" tone="ready" />
          <p>{data.metadata.sourceNote}</p>
          <div className="tech-metric-grid">
            <Metric label="IP cameras" value={formatNumber(summary.ipCameras)} helper={`${percent(summary.ipCameras, summary.totalCameras)}% of region · online state governed at store level`} />
            <Metric label="Analog cameras" value={formatNumber(summary.analogCameras)} helper={`${percent(summary.analogCameras, summary.totalCameras)}% of region · migration warnings tracked`} />
            <Metric label="Profile warnings" value={formatNumber(data.complianceSummary.profileWarnings)} helper="No Recording Profiles Set / missing source" />
            <Metric label="Network placement flags" value={formatNumber(data.complianceSummary.networkPlacementFlags)} helper="Subnet, VLAN, gateway, duplicate IP, and invalid segment indicators" />
          </div>
        </section>
        <section className="tech-card">
          <CardHeading eyebrow="Normalized issues" title="TechnologyIssue links" />
          <div className="tech-record-list">
            {cameraIssues.map((issue) => <IssueCard issue={issue} key={issue.issue_id} />)}
          </div>
        </section>
        <section className="tech-card wide">
          <CardHeading eyebrow="Event modeling" title="Enterprise camera and VSRV warning categories" pill="SIMULATED" tone="watch" />
          <TechnologyEventGrid cards={eventCards} />
        </section>
        <section className="tech-card">
          <CardHeading eyebrow="Offline camera examples" title="Sanitized device visibility" pill="ROLE-GATED" tone="watch" />
          <p>IP addresses are masked by default. Use the eye control to reveal the sanitized IP value for review; authentication layering can be attached here later.</p>
          <OfflineCameraTable rows={offlineCameraRows.slice(0, 5)} compact />
        </section>
      </section>
      <DetailModal title={modalTitle(activeModal)} eyebrow="Camera health detail" open={activeModal !== null} onClose={() => setActiveModal(null)}>
        <OverviewModalContent modal={activeModal} data={data} healthyStores={healthyStores} unhealthyStores={unhealthyStores} offlineCameraRows={offlineCameraRows} />
      </DetailModal>
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
  const healthyStores = useMemo(() => getHealthyStores(data.storeHealth), [data.storeHealth]);
  const unhealthyStores = useMemo(() => getUnhealthyStores(data.storeHealth), [data.storeHealth]);
  const offlineCameraRows = useMemo(() => buildOfflineCameraRows(data.storeHealth), [data.storeHealth]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortStoresByTechnicalRisk(data.storeHealth)
      .filter((store) => filter === 'all' || store.healthStatus === filter)
      .filter((store) => !term || [store.siteAlias, store.region, store.facilityType, store.vmsPlatform, store.healthStatus].join(' ').toLowerCase().includes(term));
  }, [data.storeHealth, search, filter]);

  return (
    <section className="tech-grid">
      <section className="tech-card wide">
        <div className="tech-directory-header"><div><p className="tech-eyebrow">Sanitized store health</p><h2>Region 75 CCTV/VMS posture</h2></div><strong>{rows.length} stores</strong></div>
        <div className="tech-region-summary-grid" aria-label="Region online health summary">
          <SummaryTile label="Healthy stores" value={formatNumber(healthyStores.length)} detail="98%+ online health" tone="green" />
          <SummaryTile label="Unhealthy stores" value={formatNumber(unhealthyStores.length)} detail="Below 98% or flagged by source" tone={unhealthyStores.some((store) => healthToneForPercent(store.onlinePercent) === 'red') ? 'red' : 'yellow'} />
          <SummaryTile label="Offline cameras" value={formatNumber(data.regionSummary.offlineCameras)} detail="Sanitized device count" tone={data.regionSummary.offlineCameras > 0 ? 'yellow' : 'green'} />
          <SummaryTile label="Region health" value={formatPercent(data.regionSummary.onlinePercent)} detail={healthLabelForPercent(data.regionSummary.onlinePercent)} tone={healthToneForPercent(data.regionSummary.onlinePercent)} />
        </div>
        <div className="tech-filters">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store alias, platform, status, region" />
          <select value={filter} onChange={(event) => setFilter(event.target.value as StoreFilter)}><option value="all">All health states</option><option value="Healthy">Healthy</option><option value="Warning">Warning</option><option value="Critical">Critical</option></select>
        </div>
        <StoreHealthTable stores={rows} />
      </section>
      <section className="tech-card">
        <CardHeading eyebrow="Offline cameras" title="Sanitized device-level examples" pill="IP MASKED" tone="watch" />
        <p>Rows are derived from sanitized store health. IP visibility is intentionally gated behind the eye control for future authentication enforcement.</p>
        <OfflineCameraTable rows={offlineCameraRows.slice(0, 12)} compact />
      </section>
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
  const summary = data.regionSummary;
  const [activePosture, setActivePosture] = useState<string | null>(null);
  const analogOffline = data.storeHealth.reduce((total, store) => total + store.analogOffline, 0);
  return (
    <>
    <section className="tech-grid">
      <section className="tech-card wide">
        <CardHeading eyebrow="AP-14 policy-informed controls" title="Technical posture and compliance guidance" pill="CONFIGURABLE" tone="watch" />
        <p>{data.complianceSummary.policySource}</p>
        <div className="tech-posture-grid" aria-label="Camera posture and compliance cards">
          <PostureCard title="IP Cameras" value={formatNumber(summary.ipCameras)} tone={healthToneForPercent(summary.onlinePercent)} details={[`${percent(summary.ipCameras, summary.totalCameras)}% of monitored region`, 'Online % governed by store health', 'Fault counts rolled into issue cameras']} onClick={() => setActivePosture('IP Cameras')} />
          <PostureCard title="Analog Cameras" value={formatNumber(summary.analogCameras)} tone={analogOffline > 0 ? 'yellow' : 'green'} details={[`${percent(summary.analogCameras, summary.totalCameras)}% of monitored region`, `${formatNumber(analogOffline)} offline analog devices`, 'Migration warnings require governance review']} onClick={() => setActivePosture('Analog Cameras')} />
          <PostureCard title="Profile Warnings" value={formatNumber(data.complianceSummary.profileWarnings)} tone={data.complianceSummary.profileWarnings > 0 ? 'yellow' : 'green'} details={['Cameras with no recording profiles', 'Store camera recorder assignment review', 'Severity based on evidence-readiness impact']} onClick={() => setActivePosture('Profile Warnings')} />
          <PostureCard title="Network Placement Flags" value={formatNumber(data.complianceSummary.networkPlacementFlags)} tone={data.complianceSummary.networkPlacementFlags > 0 ? 'yellow' : 'green'} details={['Incorrect subnet placements', 'VLAN issues / misconfigured gateways', 'Duplicate IPs and invalid network segments']} onClick={() => setActivePosture('Network Placement Flags')} />
        </div>
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
    <DetailModal title={activePosture ?? 'Posture Detail'} eyebrow="Technical posture detail" open={activePosture !== null} onClose={() => setActivePosture(null)}>
      <PostureModalContent activePosture={activePosture} data={data} analogOffline={analogOffline} />
    </DetailModal>
    </>
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

function WarrantyView({ data, loading, error, fireSites, storeScope }: { data: CameraWarrantyData | null; loading: boolean; error: string | null; fireSites: FireAlarmSite[]; storeScope: StoreScopeState }) {
  if (loading) return <StatePanel title="Loading camera warranty data" message="Preparing Phase 1 enriched camera lifecycle records." />;
  if (error) return <StatePanel title="Camera warranty data unavailable" message={error} danger />;
  if (!data) return <StatePanel title="Camera warranty data unavailable" message="No camera warranty data loaded." danger />;
  const scopedRecords = scopeWarrantyRecords(data.records, fireSites, storeScope);
  const scopedStores = summarizeWarrantyStores(scopedRecords);
  const candidates = scopedRecords.filter((record) => record.warrantyReplacementCandidate === 'Yes');
  const missingInstall = scopedRecords.filter((record) => record.warrantyReplacementCandidate.startsWith('Unknown'));
  const reviewRows = [...candidates, ...missingInstall].slice(0, 80);
  return (
    <section className="tech-grid">
      <section className="tech-card wide">
        <CardHeading eyebrow="Camera lifecycle" title="Warranty replacement checks from Phase 1 enriched camera data" pill="SANITIZED" tone="watch" />
        <p>Network identifiers are excluded from this UI dataset. Warranty status is based on install date, camera model, and assigned canonical store number.</p>
        <div className="tech-metric-grid">
          <Metric label="Scoped cameras" value={formatNumber(scopedRecords.length)} helper={`${formatNumber(data.summary.totalCameras)} total cameras in source`} />
          <Metric label="Stores represented" value={formatNumber(scopedStores.length)} helper="Canonical store assignments from Phase 1" />
          <Metric label="Replacement candidates" value={formatNumber(candidates.length)} helper={`${data.metadata.warrantyThresholdYears}-year threshold`} />
          <Metric label="Missing install date" value={formatNumber(missingInstall.length)} helper="Needs data cleanup before warranty decision" />
        </div>
      </section>
      <section className="tech-card"><CardHeading eyebrow="Camera model mix" title="Top models" /><ChartRows rows={topModelCounts(scopedRecords)} /></section>
      <section className="tech-card wide"><CardHeading eyebrow="Store rollup" title="Warranty posture by assigned store" /><WarrantyStoreTable stores={scopedStores.slice(0, 24)} /></section>
      <section className="tech-card wide"><CardHeading eyebrow="Review queue" title="Replacement candidates and missing install dates" pill="NO RAW IP/MAC" tone="stable" /><WarrantyCameraTable records={reviewRows} /></section>
    </section>
  );
}

function DetailModal({ open, eyebrow, title, children, onClose }: { open: boolean; eyebrow: string; title: string; children: JSX.Element | null; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="tech-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="tech-modal" role="dialog" aria-modal="true" aria-labelledby="tech-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="tech-modal-header">
          <div>
            <p className="tech-eyebrow">{eyebrow}</p>
            <h2 id="tech-modal-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close camera health detail">×</button>
        </header>
        <div className="tech-modal-body">{children}</div>
      </section>
    </div>
  );
}

function OverviewModalContent({ modal, data, healthyStores, unhealthyStores, offlineCameraRows }: { modal: OverviewModal; data: TechnologyHealthData; healthyStores: StoreCameraHealth[]; unhealthyStores: StoreCameraHealth[]; offlineCameraRows: OfflineCameraRow[] }) {
  if (modal === 'regionHealth') {
    return <div className="tech-modal-section"><p>Region online health uses the Global Governance thresholds: 98% and above is Green, 85% to 97.99% is Yellow, and below 85% is Red.</p><div className="tech-region-summary-grid"><SummaryTile label="Online health" value={formatPercent(data.regionSummary.onlinePercent)} detail={healthLabelForPercent(data.regionSummary.onlinePercent)} tone={healthToneForPercent(data.regionSummary.onlinePercent)} /><SummaryTile label="Online cameras" value={formatNumber(data.regionSummary.onlineCameras)} detail={`${formatNumber(data.regionSummary.totalCameras)} total cameras`} tone="green" /><SummaryTile label="Offline cameras" value={formatNumber(data.regionSummary.offlineCameras)} detail="Requires triage by severity" tone={data.regionSummary.offlineCameras > 0 ? 'yellow' : 'green'} /></div></div>;
  }
  if (modal === 'healthyStores') return <StoreHealthTable stores={healthyStores} />;
  if (modal === 'unhealthyStores') return <StoreHealthTable stores={unhealthyStores} />;
  if (modal === 'offlineCameras') return <OfflineCameraTable rows={offlineCameraRows} />;
  if (modal === 'storesMonitored') return <StoreHealthTable stores={sortStoresByTechnicalRisk(data.storeHealth)} />;
  if (modal === 'fleetHealth') {
    return <div className="tech-modal-section"><p>Fleet health shows the broader sanitized snapshot loaded into the technology-health model.</p><div className="tech-region-summary-grid"><SummaryTile label="Fleet online health" value={formatPercent(data.fleetSummary.onlinePercent)} detail={healthLabelForPercent(data.fleetSummary.onlinePercent)} tone={healthToneForPercent(data.fleetSummary.onlinePercent)} /><SummaryTile label="Fleet stores" value={formatNumber(data.fleetSummary.storeCount)} detail="Stores in snapshot" tone="green" /><SummaryTile label="Offline cameras" value={formatNumber(data.fleetSummary.offlineCameras)} detail="Fleet aggregate" tone={data.fleetSummary.offlineCameras > 0 ? 'yellow' : 'green'} /></div></div>;
  }
  return null;
}

function PostureModalContent({ activePosture, data, analogOffline }: { activePosture: string | null; data: TechnologyHealthData; analogOffline: number }) {
  const summary = data.regionSummary;
  if (activePosture === 'IP Cameras') return <div className="tech-modal-section"><p>IP camera posture is normalized at the store-health level in the current sanitized dataset.</p><div className="tech-region-summary-grid"><SummaryTile label="IP cameras" value={formatNumber(summary.ipCameras)} detail={`${percent(summary.ipCameras, summary.totalCameras)}% of region`} tone={healthToneForPercent(summary.onlinePercent)} /><SummaryTile label="Issue cameras" value={formatNumber(summary.issueCameras)} detail="Faults and degraded camera states" tone={summary.issueCameras > 0 ? 'yellow' : 'green'} /></div></div>;
  if (activePosture === 'Analog Cameras') return <div className="tech-modal-section"><p>Analog camera posture is tracked for migration warnings, offline analog devices, and recorder assignment review.</p><div className="tech-region-summary-grid"><SummaryTile label="Analog cameras" value={formatNumber(summary.analogCameras)} detail={`${percent(summary.analogCameras, summary.totalCameras)}% of region`} tone={analogOffline > 0 ? 'yellow' : 'green'} /><SummaryTile label="Offline analog" value={formatNumber(analogOffline)} detail="Migration and service review candidates" tone={analogOffline > 0 ? 'yellow' : 'green'} /></div></div>;
  if (activePosture === 'Profile Warnings') return <div className="tech-modal-section"><p>Profile warnings include cameras with no recording profiles, missing source confidence, or store camera recorder assignment gaps.</p><StoreHealthTable stores={sortStoresByTechnicalRisk(data.storeHealth).filter((store) => store.missingProfileCount > 0)} /></div>;
  if (activePosture === 'Network Placement Flags') return <div className="tech-modal-section"><p>Network placement flags include incorrect subnet placements, VLAN issues, misconfigured gateways, duplicate IPs, and invalid network segments. Raw network details remain role-gated.</p><StoreHealthTable stores={sortStoresByTechnicalRisk(data.storeHealth).filter((store) => store.misplacedSubnetCount > 0)} /></div>;
  return null;
}

function OfflineCameraTable({ rows, compact = false }: { rows: OfflineCameraRow[]; compact?: boolean }) {
  if (rows.length === 0) return <p className="tech-empty">No offline camera rows available in the current sanitized scope.</p>;
  return (
    <div className="tech-table-wrap offline-camera-wrap">
      <table className="tech-table offline-camera-table">
        <thead><tr><th>Store Number</th><th>Store Name</th><th>Camera Name</th><th>IP Address</th>{compact ? null : <th>Recorder</th>}<th>Days Offline</th><th>Last Seen</th><th>Camera Type</th>{compact ? null : <th>Reason</th>}</tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.storeNumber}-${row.cameraName}`}><td><strong>{row.storeNumber}</strong></td><td>{row.storeName}</td><td><strong>{row.cameraName}</strong></td><td><MaskedIpAddress value={row.ipAddress} /></td>{compact ? null : <td>{row.recorderName}</td>}<td>{row.daysOffline}</td><td>{row.lastSeen}</td><td>{row.cameraType}</td>{compact ? null : <td>{row.reason}</td>}</tr>)}</tbody>
      </table>
    </div>
  );
}

function MaskedIpAddress({ value }: { value: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="masked-ip">
      <code>{visible ? value : maskIpAddress(value)}</code>
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide IP address' : 'Show IP address'} title={visible ? 'Hide IP address' : 'Show IP address'}>{visible ? '🙈' : '👁'}</button>
    </span>
  );
}

function SummaryTile({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: HealthThresholdTone }) {
  return <article className={`tech-summary-tile health-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function PostureCard({ title, value, tone, details, onClick }: { title: string; value: string; tone: HealthThresholdTone; details: string[]; onClick: () => void }) {
  return <button type="button" className={`tech-posture-card health-${tone}`} onClick={onClick} aria-label={`Open ${title} detail`}><div><span>{healthLabelFromTone(tone)}</span><strong>{title}</strong></div><em>{value}</em><ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul></button>;
}

function TechnologyEventGrid({ cards }: { cards: TechnologyEventCard[] }) {
  return <div className="tech-warning-grid">{cards.map((card) => <article className={`tech-warning-card severity-${card.severity.toLowerCase()}`} key={card.title}><div><span>{card.category}</span><strong>{card.title}</strong></div><StatusPill label={card.severity.toUpperCase()} tone={card.severity === 'Critical' ? 'critical' : card.severity === 'High' ? 'watch' : 'stable'} /><p>{card.description}</p><small>{card.recorderName}</small><ul>{card.examples.map((example) => <li key={example}>{example}</li>)}</ul></article>)}</div>;
}

function WarrantyStoreTable({ stores }: { stores: ReturnType<typeof summarizeWarrantyStores> }) {
  if (stores.length === 0) return <p className="tech-empty">No warranty store rows available for the current scope.</p>;
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store</th><th>Cameras</th><th>Replacement Candidates</th><th>Missing Install Dates</th><th>Oldest Age</th></tr></thead><tbody>{stores.map((store) => <tr key={store.storeNumber}><td><strong>{store.storeNumber}</strong><small>{store.facilityName}</small></td><td>{formatNumber(store.cameraCount)}</td><td>{formatNumber(store.warrantyCandidateCount)}</td><td>{formatNumber(store.missingInstallDateCount)}</td><td>{store.oldestCameraAgeYears === null ? 'N/A' : `${store.oldestCameraAgeYears.toFixed(2)} yrs`}<small>{store.oldestInstallDate || 'No install date'}</small></td></tr>)}</tbody></table></div>;
}

function WarrantyCameraTable({ records }: { records: CameraWarrantyRecord[] }) {
  if (records.length === 0) return <p className="tech-empty">No replacement candidates or missing install-date records in the current scope.</p>;
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store</th><th>Camera</th><th>Model</th><th>Install Date</th><th>Age</th><th>Warranty Status</th></tr></thead><tbody>{records.map((record) => <tr key={`${record.storeNumber}-${record.cameraName}`}><td><strong>{record.storeNumber}</strong><small>{record.facilityName}</small></td><td><strong>{record.cameraName}</strong><small>Firmware {record.firmware || 'N/A'}</small></td><td>{record.cameraModel}</td><td>{record.installDate || 'Missing'}</td><td>{record.warrantyAgeYears === null ? 'N/A' : `${record.warrantyAgeYears.toFixed(2)} yrs`}</td><td><StatusPill label={record.warrantyReplacementCandidate} tone={record.warrantyReplacementCandidate === 'Yes' ? 'critical' : record.warrantyReplacementCandidate.startsWith('Unknown') ? 'watch' : 'ready'} /></td></tr>)}</tbody></table></div>;
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

function Kpi({ label, value, detail, tone, healthTone, onClick }: { label: string; value: string; detail: string; tone: 'blue' | 'yellow' | 'sky' | 'white'; healthTone?: HealthThresholdTone; onClick?: () => void }) {
  const className = `tech-kpi tone-${tone}${healthTone ? ` health-${healthTone}` : ''}${onClick ? ' interactive' : ''}`;
  if (onClick) {
    return <button type="button" className={className} onClick={onClick} aria-label={`Open ${label} details`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></button>;
  }
  return <article className={className}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
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

function StatusPill({ label, tone }: { label: StatusTone | string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function scopeWarrantyRecords(records: CameraWarrantyRecord[], fireSites: FireAlarmSite[], scope: StoreScopeState): CameraWarrantyRecord[] {
  if (scope.mode === 'all') return records;
  const allowedStores = new Set(
    scope.mode === 'stores'
      ? scope.selectedStoreIds.map(normalizeStoreId)
      : fireSites.filter((site) => scope.selectedRegionNames.includes(site.region)).map((site) => normalizeStoreId(site.id)),
  );
  return records.filter((record) => allowedStores.has(normalizeStoreId(record.storeNumber)) || allowedStores.has(normalizeStoreId(record.facilityId)));
}

function summarizeWarrantyStores(records: CameraWarrantyRecord[]) {
  const byStore = new Map<string, CameraWarrantyRecord[]>();
  records.forEach((record) => byStore.set(record.storeNumber, [...(byStore.get(record.storeNumber) ?? []), record]));
  return Array.from(byStore.entries()).map(([storeNumber, storeRecords]) => {
    const ages = storeRecords.map((record) => record.warrantyAgeYears).filter((age): age is number => age !== null);
    return {
      storeNumber,
      facilityName: storeRecords[0]?.facilityName ?? `Store #${storeNumber}`,
      cameraCount: storeRecords.length,
      warrantyCandidateCount: storeRecords.filter((record) => record.warrantyReplacementCandidate === 'Yes').length,
      missingInstallDateCount: storeRecords.filter((record) => record.warrantyReplacementCandidate.startsWith('Unknown')).length,
      oldestCameraAgeYears: ages.length ? Math.max(...ages) : null,
      oldestInstallDate: storeRecords.filter((record) => record.installDate).sort((a, b) => (b.warrantyAgeYears ?? 0) - (a.warrantyAgeYears ?? 0))[0]?.installDate ?? '',
    };
  }).sort((a, b) => b.warrantyCandidateCount - a.warrantyCandidateCount || b.missingInstallDateCount - a.missingInstallDateCount || b.cameraCount - a.cameraCount);
}

function topModelCounts(records: CameraWarrantyRecord[]): Record<string, number> {
  const counts = records.reduce<Record<string, number>>((modelCounts, record) => {
    const model = record.cameraModel || 'Unknown';
    modelCounts[model] = (modelCounts[model] ?? 0) + 1;
    return modelCounts;
  }, {});
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10));
}

function normalizeStoreId(value: string): string {
  return value.match(/\d+/)?.[0] ?? value;
}

function buildOfflineCameraRows(stores: StoreCameraHealth[]): OfflineCameraRow[] {
  return getOfflineCameraStores(stores).flatMap((store, storeIndex) => {
    const rowCount = Math.min(Math.max(store.offlineCameras, 1), 3);
    return Array.from({ length: rowCount }, (_, cameraIndex) => {
      const storeNumber = formatStoreNumber(store.siteAlias, storeIndex);
      const cameraType: 'IP' | 'Analog' = cameraIndex < store.ipOffline ? 'IP' : 'Analog';
      return {
        storeNumber,
        storeName: store.siteAlias,
        cameraName: `${cameraType === 'IP' ? 'IPCAM' : 'ANLG'}-${cameraZone(cameraIndex)}-${String(cameraIndex + 1).padStart(2, '0')}`,
        ipAddress: `10.75.${(storeIndex % 180) + 20}.${(cameraIndex + 11) * 7}`,
        daysOffline: Math.max(1, Math.min(30, Math.round((100 - store.onlinePercent) / 2) + cameraIndex + 1)),
        lastSeen: formatDate(store.lastScan),
        cameraType,
        recorderName: recorderNameForStore(storeNumber, cameraIndex),
        reason: store.scanError ?? `${formatNumber(store.offlineCameras)} offline cameras · ${formatNumber(store.issueCameraCount)} issue cameras`,
      };
    });
  });
}

function buildTechnologyEventCards(data: TechnologyHealthData): TechnologyEventCard[] {
  const topStores = getOfflineCameraStores(data.storeHealth).slice(0, 4);
  const firstStoreNumber = formatStoreNumber(topStores[0]?.siteAlias ?? 'S01234', 0);
  const secondStoreNumber = formatStoreNumber(topStores[1]?.siteAlias ?? 'S04567', 1);
  return [
    { title: 'Retention Below Policy', category: 'Evidence Readiness', severity: data.regionSummary.retentionBelow30d ? 'High' : 'Medium', recorderName: recorderNameForStore(firstStoreNumber, 0), description: 'Recording retention under required threshold with insufficient archive duration indicators.', examples: ['Recording retention under required threshold', 'Insufficient archive duration', `${formatNumber(data.regionSummary.retentionBelow30d ?? 0)} records below policy threshold`] },
    { title: 'VSRV Recorder Health Degraded', category: 'Recorder Health', severity: 'High', recorderName: recorderNameForStore(firstStoreNumber, 1), description: 'Server recorder health shows degraded operating posture or instability signals.', examples: ['Cameras operating in limited mode', 'Recorder service instability', 'Recording interruption detected'] },
    { title: 'VSRV Storage Health Degraded', category: 'Storage Health', severity: 'High', recorderName: recorderNameForStore(secondStoreNumber, 0), description: 'Storage subsystem requires review for RAID, SMART, or failed-drive warnings.', examples: ['RAID degradation detected', 'Hard Drive 03 SMART Errors in RAID array', 'Disk nearing failure threshold'] },
    { title: 'VSRV Temperature Warning', category: 'Thermal Health', severity: 'Medium', recorderName: recorderNameForStore(secondStoreNumber, 1), description: 'Recorder thermal status requires validation before service impact occurs.', examples: ['Recorder overheating', 'Thermal threshold exceeded', 'Fan failure warning'] },
    { title: 'Camera Offline Alerts', category: 'Camera Availability', severity: data.regionSummary.offlineCameras > 0 ? 'High' : 'Low', recorderName: recorderNameForStore(firstStoreNumber, 0), description: 'Offline camera clusters require triage and validation against monitoring reliability.', examples: [`${formatNumber(data.regionSummary.offlineCameras)} cameras offline`, 'Multiple offline clusters detected', 'Store-level impact review required'] },
    { title: 'Repeated Camera Instability', category: 'Instability Pattern', severity: 'Medium', recorderName: recorderNameForStore(secondStoreNumber, 0), description: 'Repeated online/offline behavior indicates intermittent connectivity or device degradation.', examples: ['Camera repeatedly offline 6 times in last 30 days', 'Intermittent connectivity detected', 'Network path validation recommended'] },
  ];
}

function modalTitle(modal: OverviewModal): string {
  if (modal === 'regionHealth') return 'Region Online Health';
  if (modal === 'healthyStores') return 'Healthy Stores';
  if (modal === 'unhealthyStores') return 'Unhealthy Stores';
  if (modal === 'offlineCameras') return 'Offline Cameras';
  if (modal === 'storesMonitored') return 'Stores Monitored';
  if (modal === 'fleetHealth') return 'Fleet Health';
  return 'Camera Health Detail';
}

function formatStoreNumber(siteAlias: string, fallbackIndex: number): string {
  const digits = siteAlias.match(/\d+/)?.[0];
  return `S${String(digits ?? fallbackIndex + 1000).padStart(5, '0').slice(-5)}`;
}

function recorderNameForStore(storeNumber: string, offset: number): string {
  return `VSRV${String((offset % 2) + 1).padStart(2, '0')}.${storeNumber}.US`;
}

function cameraZone(index: number): string {
  return ['ENTRANCE', 'CHECKOUT', 'PHARMACY', 'EXTERIOR', 'RECEIVING'][index % 5];
}

function maskIpAddress(value: string): string {
  const parts = value.split('.');
  if (parts.length !== 4) return '•••.•••.•••.•••';
  return `${parts[0]}.${parts[1]}.•••.•••`;
}

function healthLabelFromTone(tone: HealthThresholdTone): string {
  if (tone === 'green') return 'Healthy';
  if (tone === 'yellow') return 'Watch';
  return 'Critical';
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="tech-card tech-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}
