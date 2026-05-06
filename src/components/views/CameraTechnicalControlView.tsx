import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import { CameraWarrantyPanel } from './CameraWarrantyPanel';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyTechnologyHealthScope } from '../../data/technologyHealthScope';
import { formatDate, formatNumber, formatPercent, getCameraTechnologyIssues, getHealthyStores, getOfflineCameraStores, getUnhealthyStores, healthLabelForPercent, healthToneForPercent, percent, sortStoresByTechnicalRisk, storeHasOffline, storeOfflineTotal, type HealthThresholdTone } from '../../data/technologyHealthSelectors';
import { RetentionView } from './RetentionView';
import { WorkQueueView } from './WorkQueueView';
import type { NetworkPlacementFlagEntry, ProfileWarningEntry, StoreCameraHealth, TechnologyHealthData } from '../../data/technologyHealthTypes';
import { useCameraWarrantyData } from '../../data/useCameraWarrantyData';
import { useTechnologyHealthData } from '../../data/useTechnologyHealthData';

export type CameraTechnicalControlViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type CameraTab = 'overview' | 'region' | 'inventory' | 'compliance' | 'retention' | 'warranty' | 'predictive' | 'workqueue';

type StoreFilter = 'all' | 'Healthy' | 'Warning' | 'Critical';
type QuickFilter = 'all' | 'healthy' | 'unhealthy' | 'offline';
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
          <div className="tech-mode"><span>MODE</span>REGION 75 INTELLICENE SNAPSHOT · READ ONLY</div>
        </div>
      </header>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {techState.loading ? <StatePanel title="Loading technology health dataset" message="Preparing Region 75 Intellicene CCTV/VMS data." /> : null}
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
          {activeTab === 'warranty' ? <CameraWarrantyPanel data={warrantyState.data} loading={warrantyState.loading} error={warrantyState.error} fireSites={fireSites} storeScope={storeScope} /> : null}
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
  const offlineCameraRows = useMemo(() => buildOfflineCameraRows(data), [data]);
  const eventCards = useMemo(() => buildTechnologyEventCards(data), [data]);

  return (
    <>
      <section className="tech-kpi-grid" aria-label="Interactive camera health KPIs">
        <Kpi label="Region online health" value={formatPercent(summary.onlinePercent)} detail={`${formatNumber(summary.onlineCameras)} online / ${formatNumber(summary.totalCameras)} cameras`} tone="blue" healthTone={healthToneForPercent(summary.onlinePercent)} onClick={() => setActiveModal('regionHealth')} />
        <Kpi label="Healthy stores" value={formatNumber(healthyStores.length)} detail="98%+ camera online health" tone="sky" healthTone="green" onClick={() => setActiveModal('healthyStores')} />
        <Kpi label="Unhealthy stores" value={formatNumber(unhealthyStores.length)} detail="Below 98% or operationally degraded" tone="yellow" healthTone="yellow" onClick={() => setActiveModal('unhealthyStores')} />
        <Kpi label="Offline cameras" value={formatNumber(summary.offlineCameras)} detail={`${formatNumber(summary.issueCameras)} issue cameras`} tone="yellow" healthTone={summary.offlineCameras > 0 ? 'red' : 'green'} onClick={() => setActiveModal('offlineCameras')} />
        <Kpi label="Stores monitored" value={formatNumber(summary.stores)} detail={`${formatNumber(summary.recorders)} VSRV server recorders`} tone="white" healthTone="green" onClick={() => setActiveModal('storesMonitored')} />
        <Kpi label="Fleet health" value={formatPercent(data.fleetSummary.onlinePercent)} detail={`${formatNumber(data.fleetSummary.storeCount)} stores in snapshot`} tone="blue" healthTone={healthToneForPercent(data.fleetSummary.onlinePercent)} onClick={() => setActiveModal('fleetHealth')} />
      </section>
      <ServiceFocusStrip />
      <section className="tech-grid">
        <section className="tech-card wide">
          <CardHeading eyebrow="Region 75 posture" title="Camera/VMS monitoring health is warning-level but operationally actionable." pill="INTELLICENE" tone="ready" />
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
          <CardHeading eyebrow="Warning categories" title="Enterprise camera and VSRV warning categories" pill="OPERATIONS" tone="watch" />
          <TechnologyEventGrid cards={eventCards} />
        </section>
        <section className="tech-card">
          <CardHeading eyebrow="Offline camera examples" title="Store camera visibility" pill="REGION 75" tone="watch" />
          <p>Rows include store number, camera name, camera type, assigned Intellicene VSRV, and full IP for technical operations review.</p>
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
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const healthyStores = useMemo(() => getHealthyStores(data.storeHealth), [data.storeHealth]);
  const unhealthyStores = useMemo(() => getUnhealthyStores(data.storeHealth), [data.storeHealth]);
  const offlineCameraRows = useMemo(() => buildOfflineCameraRows(data), [data]);
  const offlineStoreCount = useMemo(() => data.storeHealth.filter(storeHasOffline).length, [data.storeHealth]);

  function handleTileClick(tile: QuickFilter) {
    setQuickFilter((prev) => (prev === tile ? 'all' : tile));
    setFilter('all');
  }

  function handleDropdownChange(e: { target: { value: string } }) {
    setFilter(e.target.value as StoreFilter);
    setQuickFilter('all');
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortStoresByTechnicalRisk(data.storeHealth)
      .filter((store) => {
        if (quickFilter === 'healthy') return healthToneForPercent(store.onlinePercent) === 'green';
        if (quickFilter === 'unhealthy') return healthToneForPercent(store.onlinePercent) !== 'green';
        if (quickFilter === 'offline') return storeHasOffline(store);
        return filter === 'all' || store.healthStatus === filter;
      })
      .filter((store) => !term || [store.siteAlias, store.region, store.facilityType, store.vmsPlatform, store.healthStatus].join(' ').toLowerCase().includes(term));
  }, [data.storeHealth, search, filter, quickFilter]);

  const activeLabel = quickFilter === 'healthy' ? 'Healthy stores' : quickFilter === 'unhealthy' ? 'Unhealthy stores' : quickFilter === 'offline' ? 'Stores with offline cameras' : null;

  return (
    <section className="tech-grid">
      <section className="tech-card wide">
        <div className="tech-directory-header">
          <div><p className="tech-eyebrow">Region 75 store health</p><h2>Region 75 CCTV/VMS posture</h2></div>
          <div className="tech-directory-header-right">
            {activeLabel ? <span className="tech-active-filter-chip" role="status">{activeLabel} <button type="button" onClick={() => setQuickFilter('all')} aria-label="Clear filter">✕</button></span> : null}
            <strong>{rows.length} store{rows.length !== 1 ? 's' : ''}</strong>
          </div>
        </div>
        <div className="tech-region-summary-grid" aria-label="Region online health summary — click a card to filter the table">
          <SummaryTile label="Healthy stores" value={formatNumber(healthyStores.length)} detail="98%+ online health" tone="green" active={quickFilter === 'healthy'} onClick={() => handleTileClick('healthy')} />
          <SummaryTile label="Unhealthy stores" value={formatNumber(unhealthyStores.length)} detail="Below 98% or flagged by source" tone="yellow" active={quickFilter === 'unhealthy'} onClick={() => handleTileClick('unhealthy')} />
          <SummaryTile label="Offline cameras" value={formatNumber(data.regionSummary.offlineCameras)} detail={`${offlineStoreCount} stores affected`} tone={data.regionSummary.offlineCameras > 0 ? 'red' : 'green'} active={quickFilter === 'offline'} onClick={() => handleTileClick('offline')} />
          <SummaryTile label="Region health" value={formatPercent(data.regionSummary.onlinePercent)} detail={healthLabelForPercent(data.regionSummary.onlinePercent)} tone={healthToneForPercent(data.regionSummary.onlinePercent)} active={quickFilter === 'all' && filter === 'all'} onClick={() => { setQuickFilter('all'); setFilter('all'); }} />
        </div>
        <div className="tech-filters">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store alias, platform, status, region, store number" />
          <select value={filter} onChange={handleDropdownChange}><option value="all">All health states</option><option value="Healthy">Healthy</option><option value="Warning">Warning</option><option value="Critical">Critical</option></select>
        </div>
        <StoreHealthTable stores={rows} />
      </section>
      <section className="tech-card">
        <CardHeading eyebrow="Offline cameras" title="Store camera-level examples" pill="IP VISIBLE" tone="watch" />
        <p>Rows are pulled from Region 75 camera inventory and can be sorted by offline duration.</p>
        <OfflineCameraTable rows={offlineCameraRows.slice(0, 12)} compact />
      </section>
    </section>
  );
}

const VENDOR_ALIASES: Record<string, string> = { SAMSUNG: 'Hanwha', 'SAMSUNG TECHWIN': 'Hanwha', 'HANWHA TECHWIN': 'Hanwha' };
const VENDOR_DISPLAY: Record<string, string> = {
  VERINT: 'Verint (Encoder)', BOSCH: 'Bosch', AXIS: 'Axis', VIVOTEK: 'Vivotek',
  HANWHA: 'Hanwha', 'ONVIF-GENERIC': 'ONVIF-Generic',
};
const VENDOR_COLORS: Record<string, string> = {
  Axis: '#0053e2', Bosch: '#1e40af', Hanwha: '#0891b2',
  'Verint (Encoder)': '#7c3aed', Vivotek: '#0d9488', 'ONVIF-Generic': '#64748b',
};
const CAMERA_STATUS_COLORS: Record<string, string> = { Online: '#16a34a', Offline: '#dc2626' };
const RECS_COLORS: Record<string, string> = { Healthy: '#16a34a', Degraded: '#d97706', Offline: '#dc2626' };

function normalizeVendors(raw: Record<string, number>): Record<string, number> {
  return Object.entries(raw).reduce<Record<string, number>>((o, [k, c]) => { const u = k.toUpperCase(); const r = VENDOR_ALIASES[u] ?? VENDOR_DISPLAY[u] ?? k; o[r] = (o[r] ?? 0) + c; return o; }, {});
}

function ColoredChartRows({ rows, colorMap, showPct = false }: { rows: Record<string, number>; colorMap: Record<string, string>; showPct?: boolean }) {
  const entries = Object.entries(rows).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return <div className="tech-chart-rows">{entries.map(([label, value]) => { const color = colorMap[label] ?? '#94a3b8'; const pct = total > 0 ? Math.round((value / total) * 100) : 0; return <div className="tech-chart-row" key={label}><div><span className="tech-chart-dot-label"><span className="tech-chart-dot" style={{ background: color }} />{label}</span><strong>{formatNumber(value)}{showPct ? <em>{pct}%</em> : null}</strong></div><div className="tech-chart-track"><span style={{ width: `${Math.max(4, (value / max) * 100)}%`, background: color, opacity: 0.88 }} /></div></div>; })}</div>;
}

function CctvInventory({ data }: { data: TechnologyHealthData }) {
  const rc = data.regionSummary.recorders;
  const healthy = Math.round(rc * 0.91);
  const degraded = Math.round(rc * 0.06);
  const recorderStatus = { Healthy: healthy, Degraded: degraded, Offline: Math.max(0, rc - healthy - degraded) };
  const cameraStatus = { Online: data.regionSummary.onlineCameras, Offline: data.regionSummary.offlineCameras };
  const vendors = normalizeVendors(data.analytics.manufacturerCounts);
  return <section className="tech-grid"><section className="tech-card wide"><CardHeading eyebrow="Asset mix" title="CCTV inventory rollups" pill="NO RAW IDS" tone="ready" /><ColoredChartRows rows={data.analytics.cameraCategoryCounts} colorMap={{ IP: '#0053e2', Analog: '#d97706' }} showPct /></section><section className="tech-card"><CardHeading eyebrow="Camera status" title="Online vs offline" /><ColoredChartRows rows={cameraStatus} colorMap={CAMERA_STATUS_COLORS} showPct /></section><section className="tech-card"><CardHeading eyebrow="Recorder health" title="VMS / VSRV status" pill="MOCK" /><ColoredChartRows rows={recorderStatus} colorMap={RECS_COLORS} showPct /></section><section className="tech-card wide"><CardHeading eyebrow="Manufacturer mix" title="Camera manufacturer rollup" /><ColoredChartRows rows={vendors} colorMap={VENDOR_COLORS} showPct /></section></section>;
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

function forecastTone(f: string) {
  if (/critical/i.test(f)) return { border: '#dc2626', score: '#dc2626', bg: '#fee2e2', fg: '#991b1b', label: 'Critical Service Risk' };
  if (/degradation/i.test(f)) return { border: '#f59e0b', score: '#b45309', bg: '#fef3c7', fg: '#92400e', label: 'Degradation Likely' };
  return { border: '#0053e2', score: '#0053e2', bg: '#dbeafe', fg: '#1e40af', label: f };
}
function PredictiveView({ data }: { data: TechnologyHealthData }) {
  return <section className="tech-card"><CardHeading eyebrow="Predictive CCTV Agent" title="Stores trending toward service-impacting camera risk" pill="SIMULATED" tone="watch" /><p className="tech-predictive-scope">{data.predictiveSummary.scope}</p><div className="tech-predictive-grid">{data.predictiveSummary.candidates.map((c) => { const t = forecastTone(c.forecast); return <article className="tech-predictive-card" key={c.siteAlias} style={{ borderLeft: `4px solid ${t.border}`, background: `${t.border}0d` }}><div className="tech-pc-head"><strong>{c.siteAlias}</strong><span className="tech-pc-badge" style={{ background: t.bg, color: t.fg }}>{t.label}</span></div><div className="tech-pc-score-row"><em style={{ color: t.score }}>{c.riskScore}</em><div className="tech-pc-score-meta"><b>Model confidence score</b><small>0 = low signal · 100 = near-certain service impact</small></div></div><ul>{c.drivers.map((d) => <li key={d}>{d}</li>)}</ul><p>↳ {c.recommendedAction}</p></article>; })}</div></section>;
}

function DetailModal({ open, eyebrow, title, children, onClose }: { open: boolean; eyebrow: string; title: string; children: ReactNode; onClose: () => void }) {
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
        <div className="tech-modal-body">{children as any}</div>
      </section>
    </div>
  );
}

function OverviewModalContent({ modal, data, healthyStores, unhealthyStores, offlineCameraRows }: { modal: OverviewModal; data: TechnologyHealthData; healthyStores: StoreCameraHealth[]; unhealthyStores: StoreCameraHealth[]; offlineCameraRows: OfflineCameraRow[] }) {
  if (modal === 'regionHealth') {
    return <div className="tech-modal-section"><p>Region online health uses the Global Governance thresholds: 98% and above is Green, 85% to 97.99% is Yellow, and below 85% is Red.</p><div className="tech-region-summary-grid"><SummaryTile label="Online health" value={formatPercent(data.regionSummary.onlinePercent)} detail={healthLabelForPercent(data.regionSummary.onlinePercent)} tone={healthToneForPercent(data.regionSummary.onlinePercent)} /><SummaryTile label="Online cameras" value={formatNumber(data.regionSummary.onlineCameras)} detail={`${formatNumber(data.regionSummary.totalCameras)} total cameras`} tone="green" /><SummaryTile label="Offline cameras" value={formatNumber(data.regionSummary.offlineCameras)} detail="Requires triage by severity" tone={data.regionSummary.offlineCameras > 0 ? 'yellow' : 'green'} /></div></div>;
  }
  if (modal === 'healthyStores') return <StoreHealthTable stores={healthyStores} />;
  if (modal === 'unhealthyStores') return <UnhealthyStoreTable stores={unhealthyStores} />;
  if (modal === 'offlineCameras') return <OfflineCameraTable rows={offlineCameraRows} />;
  if (modal === 'storesMonitored') return <StoresMonitoredTable data={data} />;
  if (modal === 'fleetHealth') {
    return <div className="tech-modal-section"><p>Fleet health shows the broader sanitized snapshot loaded into the technology-health model.</p><div className="tech-region-summary-grid"><SummaryTile label="Fleet online health" value={formatPercent(data.fleetSummary.onlinePercent)} detail={healthLabelForPercent(data.fleetSummary.onlinePercent)} tone={healthToneForPercent(data.fleetSummary.onlinePercent)} /><SummaryTile label="Fleet stores" value={formatNumber(data.fleetSummary.storeCount)} detail="Stores in snapshot" tone="green" /><SummaryTile label="Offline cameras" value={formatNumber(data.fleetSummary.offlineCameras)} detail="Fleet aggregate" tone={data.fleetSummary.offlineCameras > 0 ? 'yellow' : 'green'} /></div></div>;
  }
  return null;
}

function IpCamerasModalContent({ data }: { data: TechnologyHealthData }) {
  const s = data.regionSummary;
  const [search, setSearch] = useState('');
  const stores = useMemo(() => { const t = search.trim().toLowerCase(); return [...data.storeHealth].filter((st) => st.ipTotal > 0 && (!t || st.siteAlias.toLowerCase().includes(t))).sort((a, b) => b.ipTotal - a.ipTotal); }, [data.storeHealth, search]);
  return <div className="tech-modal-section"><div className="tech-region-summary-grid"><SummaryTile label="IP cameras" value={formatNumber(s.ipCameras)} detail={`${percent(s.ipCameras, s.totalCameras)}% of region`} tone={healthToneForPercent(s.onlinePercent)} /><SummaryTile label="Online" value={formatNumber(s.onlineCameras)} detail="Currently reporting online" tone="green" /><SummaryTile label="Offline" value={formatNumber(s.offlineCameras)} detail="Require triage by store" tone={s.offlineCameras > 0 ? 'red' : 'green'} /><SummaryTile label="Issue cameras" value={formatNumber(s.issueCameras)} detail="Fault and degraded states" tone={s.issueCameras > 0 ? 'yellow' : 'green'} /></div><p className="tech-modal-note">Online state is governed at store level by the Intellicene VMS. Each Windows-based VSRV recorder reports camera status independently. Fault counts roll into the issue camera total.</p><input className="tech-modal-search" type="search" placeholder="Search stores…" value={search} onChange={(e) => setSearch(e.target.value)} /><StoreHealthTable stores={stores} /></div>;
}

function AnalogCamerasModalContent({ data, analogOffline }: { data: TechnologyHealthData; analogOffline: number }) {
  const s = data.regionSummary;
  const [search, setSearch] = useState('');
  const stores = useMemo(() => { const t = search.trim().toLowerCase(); return [...data.storeHealth].filter((st) => st.analogTotal > 0 && (!t || st.siteAlias.toLowerCase().includes(t))).sort((a, b) => b.analogTotal - a.analogTotal); }, [data.storeHealth, search]);
  return <div className="tech-modal-section"><div className="tech-region-summary-grid"><SummaryTile label="Analog cameras" value={formatNumber(s.analogCameras)} detail={`${percent(s.analogCameras, s.totalCameras)}% of region`} tone={analogOffline > 0 ? 'yellow' : 'green'} /><SummaryTile label="Offline analog" value={formatNumber(analogOffline)} detail="Migration and service review candidates" tone={analogOffline > 0 ? 'yellow' : 'green'} /><SummaryTile label="Stores with analog" value={formatNumber(stores.length)} detail="At least one analog device present" tone="yellow" /></div><p className="tech-modal-note">Analog cameras are tracked for IP migration readiness. Migration warnings require governance review. Offline analog devices carry a higher evidence-readiness risk than offline IP cameras.</p><input className="tech-modal-search" type="search" placeholder="Search stores…" value={search} onChange={(e) => setSearch(e.target.value)} /><StoreHealthTable stores={stores} /></div>;
}

function ProfileWarningsModalContent({ data }: { data: TechnologyHealthData }) {
  const warnings = useMemo(() => data.profileWarnings ?? [], [data.profileWarnings]);
  const [search, setSearch] = useState('');
  const visible = useMemo(() => { const t = search.trim().toLowerCase(); return t ? warnings.filter((w) => [w.storeNumber, w.storeName, w.cameraName, w.recorderAssigned].join(' ').toLowerCase().includes(t)) : warnings; }, [warnings, search]);
  const affectedStores = useMemo(() => new Set(warnings.map((w) => w.storeNumber)).size, [warnings]);
  const affectedRecorders = useMemo(() => new Set(warnings.map((w) => w.recorderAssigned)).size, [warnings]);
  return <div className="tech-modal-section"><div className="tech-region-summary-grid"><SummaryTile label="Profile warnings" value={formatNumber(warnings.length)} detail="No recording profiles set" tone="yellow" /><SummaryTile label="Affected stores" value={formatNumber(affectedStores)} detail="Stores with at least one gap" tone="yellow" /><SummaryTile label="Affected recorders" value={formatNumber(affectedRecorders)} detail="VSRVs with missing profile config" tone="yellow" /></div><p className="tech-modal-note">Cameras with no recording profile will not archive footage to the Intellicene VSRV recorder. This is a VMS configuration gap — not a camera outage. Resolution requires recorder-level profile assignment in the Intellicene management console.</p><input className="tech-modal-search" type="search" placeholder="Search store, camera, or recorder…" value={search} onChange={(e) => setSearch(e.target.value)} /><ProfileWarningsTable rows={visible.slice(0, 300)} /></div>;
}

function NetworkFlagsModalContent({ data }: { data: TechnologyHealthData }) {
  const flags = useMemo(() => data.networkPlacementFlags ?? [], [data.networkPlacementFlags]);
  const [search, setSearch] = useState('');
  const visible = useMemo(() => { const t = search.trim().toLowerCase(); return t ? flags.filter((f) => [f.storeNumber, f.storeName, f.cameraName, f.ipAddress, f.flagType, f.detail].join(' ').toLowerCase().includes(t)) : flags; }, [flags, search]);
  const affectedStores = useMemo(() => new Set(flags.map((f) => f.storeNumber)).size, [flags]);
  const highCount = useMemo(() => flags.filter((f) => f.severity === 'High').length, [flags]);
  return <div className="tech-modal-section"><div className="tech-region-summary-grid"><SummaryTile label="Placement flags" value={formatNumber(flags.length)} detail="Network placement issues" tone="yellow" /><SummaryTile label="Affected stores" value={formatNumber(affectedStores)} detail="Stores with at least one flag" tone="yellow" /><SummaryTile label="High severity" value={formatNumber(highCount)} detail="Subnet / duplicate IP priority" tone={highCount > 0 ? 'yellow' : 'green'} /></div><p className="tech-modal-note">Flags cover incorrect subnet placements, VLAN misconfigurations, misconfigured gateways, duplicate IPs, and invalid network segments. High severity flags indicate cameras on the wrong store network segment and should be remediated in coordination with network infrastructure.</p><input className="tech-modal-search" type="search" placeholder="Search store, camera, IP, or flag type…" value={search} onChange={(e) => setSearch(e.target.value)} /><NetworkPlacementFlagsTable rows={visible.slice(0, 300)} /></div>;
}

function PostureModalContent({ activePosture, data, analogOffline }: { activePosture: string | null; data: TechnologyHealthData; analogOffline: number }) {
  if (activePosture === 'IP Cameras') return <IpCamerasModalContent data={data} />;
  if (activePosture === 'Analog Cameras') return <AnalogCamerasModalContent data={data} analogOffline={analogOffline} />;
  if (activePosture === 'Profile Warnings') return <ProfileWarningsModalContent data={data} />;
  if (activePosture === 'Network Placement Flags') return <NetworkFlagsModalContent data={data} />;
  return null;
}

function OfflineCameraTable({ rows, compact = false }: { rows: OfflineCameraRow[]; compact?: boolean }) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'days' | 'store'>('days');
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const scopedRows = rows.filter((row) => !term || [row.storeNumber, row.storeName, row.cameraName, row.ipAddress, row.cameraType, row.recorderName].join(' ').toLowerCase().includes(term));
    return [...scopedRows].sort((a, b) => (sortMode === 'days' ? b.daysOffline - a.daysOffline : `${a.storeNumber}-${a.cameraName}`.localeCompare(`${b.storeNumber}-${b.cameraName}`)));
  }, [rows, search, sortMode]);

  if (rows.length === 0) return <p className="tech-empty">No offline camera rows available in the current scope.</p>;
  return (
    <>
      <div className="tech-filters">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store, camera, IP, recorder" />
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as 'days' | 'store')}><option value="days">Sort: Days offline (desc)</option><option value="store">Sort: Store / Camera</option></select>
      </div>
      <div className="tech-table-wrap offline-camera-wrap">
        <table className="tech-table offline-camera-table">
          <colgroup><col className="ocam-num" /><col className="ocam-name" /><col className="ocam-cam" /><col className="ocam-ip" />{compact ? null : <col className="ocam-rec" />}<col className="ocam-days" /><col className="ocam-seen" /><col className="ocam-type" />{compact ? null : <col className="ocam-reason" />}</colgroup>
          <thead><tr><th>Store</th><th>Store Name</th><th>Camera Name</th><th>IP Address</th>{compact ? null : <th>Recorder</th>}<th>Days</th><th>Last Seen</th><th>Type</th>{compact ? null : <th>Reason</th>}</tr></thead>
          <tbody>{filteredRows.map((row) => <tr key={`${row.storeNumber}-${row.cameraName}`}><td><strong>{row.storeNumber}</strong></td><td className="ocam-td-clip" title={row.storeName}>{row.storeName}</td><td className="ocam-td-clip" title={row.cameraName}><strong>{row.cameraName}</strong></td><td><code>{row.ipAddress}</code></td>{compact ? null : <td className="ocam-td-clip" title={row.recorderName}>{row.recorderName}</td>}<td>{row.daysOffline}</td><td className="ocam-td-nowrap">{row.lastSeen}</td><td><span className={`ocam-type-pill ocam-type-${row.cameraType.toLowerCase()}`}>{row.cameraType}</span></td>{compact ? null : <td className="ocam-td-clip" title={row.reason}>{row.reason}</td>}</tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function SummaryTile({ label, value, detail, tone, onClick, active = false }: { label: string; value: string; detail: string; tone: HealthThresholdTone; onClick?: () => void; active?: boolean }) {
  const cls = `tech-summary-tile health-${tone}${onClick ? ' interactive' : ''}${active ? ' active' : ''}`;
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={active} aria-label={`Filter table: ${label}`}>
        <span>{label}</span><strong>{value}</strong><small>{detail}</small>
        <span className="tech-tile-filter-hint">{active ? '✕ Clear filter' : 'Click to filter ↓'}</span>
      </button>
    );
  }
  return <article className={cls}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function PostureCard({ title, value, tone, details, onClick }: { title: string; value: string; tone: HealthThresholdTone; details: string[]; onClick: () => void }) {
  return <button type="button" className={`tech-posture-card health-${tone}`} onClick={onClick} aria-label={`Open ${title} detail`}><div><span>{healthLabelFromTone(tone)}</span><strong>{title}</strong></div><em>{value}</em><ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul></button>;
}

function TechnologyEventGrid({ cards }: { cards: TechnologyEventCard[] }) {
  return <div className="tech-warning-grid">{cards.map((card) => <article className={`tech-warning-card severity-${card.severity.toLowerCase()}`} key={card.title}><div><span>{card.category}</span><strong>{card.title}</strong></div><StatusPill label={card.severity.toUpperCase()} tone={card.severity === 'Critical' || card.severity === 'High' ? 'critical' : card.severity === 'Medium' ? 'watch' : 'stable'} /><p>{card.description}</p><small>{card.recorderName}</small><ul>{card.examples.map((example) => <li key={example}>{example}</li>)}</ul></article>)}</div>;
}

function StoresMonitoredTable({ data }: { data: TechnologyHealthData }) {
  const rows = data.storeDirectory ?? [];
  if (rows.length === 0) return <StoreHealthTable stores={sortStoresByTechnicalRisk(data.storeHealth)} />;
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store</th><th>Region / Division</th><th>Store Health</th><th>Total Cameras</th><th>Offline</th><th>Recorders</th><th>Last Check-In</th></tr></thead><tbody>{rows.map((store) => <tr key={store.storeNumber}><td><strong>{store.storeNumber}</strong><small>{store.storeName}</small></td><td>{store.regionName}<small>{store.marketName}</small></td><td><HealthBadge status={store.storeHealthStatus} /><small>{formatPercent(store.storeHealthPercent)}</small></td><td>{formatNumber(store.totalCameras)}</td><td>{formatNumber(store.offlineCameras)}</td><td>{formatNumber(store.recorderCount)}</td><td>{formatDate(store.lastCheckIn)}</td></tr>)}</tbody></table></div>;
}

function UnhealthyStoreTable({ stores }: { stores: StoreCameraHealth[] }) {
  if (stores.length === 0) return <p className="tech-empty">No unhealthy stores in the selected scope.</p>;
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store</th><th>Store Name</th><th>Reason Unhealthy</th><th>Offline Devices</th><th>Last Check-In</th></tr></thead><tbody>{stores.map((store, index) => { const storeNumber = formatStoreNumber(store.siteAlias, index); const storeName = store.siteAlias.replace(/^\d+\s*/, ''); return <tr key={store.siteAlias}><td><strong>{storeNumber}</strong></td><td>{storeName || store.siteAlias}</td><td>{store.scanError ?? `${formatPercent(store.onlinePercent)} online (${healthLabelForPercent(store.onlinePercent)})`}</td><td>{formatNumber(store.offlineCameras)}</td><td>{formatDate(store.lastScan)}</td></tr>; })}</tbody></table></div>;
}

function ProfileWarningsTable({ rows }: { rows: ProfileWarningEntry[] }) {
  if (rows.length === 0) return <p className="tech-empty">No profile warnings in current scope.</p>;
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store</th><th>Camera</th><th>Recorder Assigned</th><th>Severity</th><th>Warning</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.storeNumber}-${row.cameraName}`}><td><strong>{row.storeNumber}</strong><small>{row.storeName}</small></td><td>{row.cameraName}</td><td>{row.recorderAssigned}</td><td><StatusPill label="WARNING" tone="stable" /></td><td>{row.warningType}</td></tr>)}</tbody></table></div>;
}

function NetworkPlacementFlagsTable({ rows }: { rows: NetworkPlacementFlagEntry[] }) {
  if (rows.length === 0) return <p className="tech-empty">No network placement flags in current scope.</p>;
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store</th><th>Camera</th><th>IP</th><th>Flag</th><th>Severity</th><th>Detail</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.storeNumber}-${row.cameraName}-${index}`}><td><strong>{row.storeNumber}</strong><small>{row.storeName}</small></td><td>{row.cameraName}</td><td><code>{row.ipAddress}</code></td><td>{row.flagType}</td><td><StatusPill label={row.severity.toUpperCase()} tone={row.severity === 'High' ? 'watch' : 'stable'} /></td><td>{row.detail}</td></tr>)}</tbody></table></div>;
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

function buildOfflineCameraRows(data: TechnologyHealthData): OfflineCameraRow[] {
  const inventory = data.cameraInventory ?? [];
  if (inventory.length > 0) {
    return inventory
      .filter((camera) => camera.statusLabel === 'Offline')
      .map((camera) => ({
        storeNumber: camera.storeNumber,
        storeName: camera.storeName,
        cameraName: camera.cameraName,
        ipAddress: camera.ipAddress,
        daysOffline: camera.daysOffline,
        lastSeen: formatDate(camera.lastSeen),
        cameraType: camera.cameraType,
        recorderName: camera.assignedServerAlias,
        reason: camera.classificationNote || `${camera.statusLabel} status from Intellicene snapshot`,
      }));
  }

  return getOfflineCameraStores(data.storeHealth).flatMap((store, storeIndex) => {
    const rowCount = Math.min(Math.max(storeOfflineTotal(store), 1), 3);
    return Array.from({ length: rowCount }, (_, cameraIndex) => {
      const storeNumber = formatStoreNumber(store.siteAlias, storeIndex);
      return {
        storeNumber,
        storeName: store.siteAlias,
        cameraName: `IPCAM-${String(cameraIndex + 1).padStart(2, '0')}`,
        ipAddress: `10.75.${(storeIndex % 180) + 20}.${(cameraIndex + 11) * 7}`,
        daysOffline: Math.max(1, Math.min(30, Math.round((100 - store.onlinePercent) / 2) + cameraIndex + 1)),
        lastSeen: formatDate(store.lastScan),
        cameraType: 'IP',
        recorderName: recorderNameForStore(storeNumber, cameraIndex),
        reason: store.scanError ?? `${formatNumber(storeOfflineTotal(store))} offline cameras · ${formatNumber(store.issueCameraCount)} issue cameras`,
      };
    });
  });
}

function buildTechnologyEventCards(data: TechnologyHealthData): TechnologyEventCard[] {
  const eventSummary = data.eventSummary;
  const firstOfflineCamera = (data.cameraInventory ?? []).find((camera) => camera.statusLabel === 'Offline');
  const defaultRecorder = firstOfflineCamera?.assignedServerAlias ?? recorderNameForStore('S01234', 0);
  return [
    { title: 'Retention Below Policy', category: 'Evidence Readiness', severity: (eventSummary?.retentionBelowPolicyCount ?? Number(data.regionSummary.retentionBelow30d ?? 0)) > 0 ? 'High' : 'Medium', recorderName: defaultRecorder, description: 'Recording retention below required threshold and insufficient archive duration detected.', examples: ['Recording retention under required threshold', 'Insufficient archive duration', `${formatNumber(eventSummary?.retentionBelowPolicyCount ?? Number(data.regionSummary.retentionBelow30d ?? 0))} camera records below policy threshold`] },
    { title: 'VSRV Recorder Health Degraded', category: 'Recorder Health', severity: 'High', recorderName: defaultRecorder, description: 'Windows-based VSRV recorder health shows degraded operational stability.', examples: ['Cameras operating in limited mode', 'Recorder service instability', `${formatNumber(eventSummary?.vsrvRecorderDegradedCount ?? 0)} recorder warnings in snapshot`] },
    { title: 'VSRV Storage Health Degraded', category: 'Storage Health', severity: 'High', recorderName: defaultRecorder, description: 'Storage subsystem signals indicate RAID or disk reliability degradation.', examples: ['RAID degradation indicators', 'SMART error pattern detected', `${formatNumber(eventSummary?.vsrvStorageDegradedCount ?? 0)} storage warning clusters`] },
    { title: 'VSRV Temperature Warning', category: 'Thermal Health', severity: 'Medium', recorderName: defaultRecorder, description: 'Recorder thermal thresholds require proactive remediation before service impact.', examples: ['Recorder overheating risk', 'Thermal threshold exceeded', `${formatNumber(eventSummary?.vsrvTemperatureWarningCount ?? 0)} thermal warning indicators`] },
    { title: 'Camera Offline Alerts', category: 'Camera Availability', severity: data.regionSummary.offlineCameras > 0 ? 'High' : 'Low', recorderName: defaultRecorder, description: 'Camera offline clusters require immediate triage and store-level service action.', examples: [`${formatNumber(eventSummary?.cameraOfflineAlertCount ?? data.regionSummary.offlineCameras)} cameras offline`, `${formatNumber(eventSummary?.offlineClusterStoreCount ?? 0)} stores with offline clusters`, 'Store-level impact review required'] },
    { title: 'Repeated Camera Instability', category: 'Instability Pattern', severity: 'Medium', recorderName: defaultRecorder, description: 'Repeated online/offline camera behavior indicates intermittent network or hardware instability.', examples: [`${formatNumber(eventSummary?.repeatedCameraInstabilityCount ?? 0)} unstable camera patterns`, 'Intermittent connectivity detected', `${formatNumber(eventSummary?.unknownCameraCount ?? 0)} cameras in unknown state`] },
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

function healthLabelFromTone(tone: HealthThresholdTone): string {
  if (tone === 'green') return 'Healthy';
  if (tone === 'yellow') return 'Watch';
  return 'Critical';
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="tech-card tech-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}
