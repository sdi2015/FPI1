import { useMemo, useState } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyTechnologyHealthScope } from '../../data/technologyHealthScope';
import { formatDate, formatNumber, getDevicePostureIssues } from '../../data/technologyHealthSelectors';
import type { RecorderHealth, TechnologyHealthData, TechnologyIssue } from '../../data/technologyHealthTypes';
import { useTechnologyHealthData } from '../../data/useTechnologyHealthData';

export type NetworkDevicePostureViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type PostureTab = 'overview' | 'freshness' | 'domains' | 'recorders' | 'governance';

const postureTabs: Array<{ id: PostureTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'Posture' },
  { id: 'freshness', label: 'Data Health', eyebrow: 'Inputs' },
  { id: 'domains', label: 'Device Domains', eyebrow: 'Controls' },
  { id: 'recorders', label: 'Recorder Dependencies', eyebrow: 'VMS' },
  { id: 'governance', label: 'Governance', eyebrow: 'Readiness' },
];

export function NetworkDevicePostureView({ fireSites, storeScope, onChangeScopeRequest }: NetworkDevicePostureViewProps) {
  const [activeTab, setActiveTab] = useState<PostureTab>('overview');
  const techState = useTechnologyHealthData();
  const scopedTechnologyData = useMemo(() => (techState.data ? applyTechnologyHealthScope(techState.data, fireSites, storeScope) : null), [techState.data, fireSites, storeScope]);

  return (
    <section className="tech-page" aria-label="Network and Security Device Posture">
      <header className="tech-header device-header">
        <div>
          <p className="tech-eyebrow">Security Device Posture Intelligence</p>
          <h1>Network & Security Device Posture</h1>
          <p>Adapter health, source freshness, access/LPR/security-device posture, VMS recorder dependency health, and integration-governance readiness for technical controls.</p>
        </div>
        <div className="tech-mode"><span>MODE</span>ADAPTER READY</div>
      </header>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {techState.loading ? <StatePanel title="Loading device posture dataset" message="Preparing normalized TechnologyIssue and adapter-health data." /> : null}
      {techState.error ? <StatePanel title="Device posture dataset unavailable" message={techState.error} danger /> : null}

      {scopedTechnologyData ? (
        <>
          <nav className="tech-tab-bar compact" aria-label="Network device posture sub tabs">
            {postureTabs.map((tab) => (
              <button className={activeTab === tab.id ? 'tech-tab active' : 'tech-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}>
                <span>{tab.eyebrow}</span>{tab.label}
              </button>
            ))}
          </nav>
          {activeTab === 'overview' ? <PostureOverview data={scopedTechnologyData} /> : null}
          {activeTab === 'freshness' ? <SourceFreshness data={scopedTechnologyData} /> : null}
          {activeTab === 'domains' ? <DeviceDomains data={scopedTechnologyData} /> : null}
          {activeTab === 'recorders' ? <RecorderDependencies data={scopedTechnologyData} /> : null}
          {activeTab === 'governance' ? <GovernanceReadiness data={scopedTechnologyData} /> : null}
        </>
      ) : null}
    </section>
  );
}

function PostureOverview({ data }: { data: TechnologyHealthData }) {
  const issues = getDevicePostureIssues(data);
  const staleSources = data.sourceFreshness.filter((source) => ['Aging', 'Stale', 'Unknown'].includes(source.freshness_status));
  const offlineRecorders = data.recorderHealth.filter((recorder) => !recorder.alive || recorder.recorderStatus.toLowerCase() !== 'online');
  return (
    <>
      <section className="tech-kpi-grid" aria-label="Device posture KPIs">
        <Kpi label="Posture issues" value={formatNumber(issues.length)} detail="Normalized TechnologyIssue records" tone="blue" />
        <Kpi label="Data warnings" value={formatNumber(staleSources.length)} detail="Aging, stale, or unknown inputs" tone="yellow" />
        <Kpi label="Recorder dependencies" value={formatNumber(data.recorderHealth.length)} detail={`${formatNumber(offlineRecorders.length)} require review`} tone="sky" />
        <Kpi label="Data connection" value={data.adapterRun.result} detail={`${formatNumber(data.adapterRun.record_count)} normalized records`} tone="white" />
      </section>
      <PostureFocusStrip />
      <section className="tech-grid">
        <section className="tech-card wide"><CardHeading eyebrow="Normalized posture model" title="Device posture uses TechnologyIssue records before UI/scoring/remediation." pill="CANONICAL" tone="ready" /><p>{data.metadata.sourceNote}</p><div className="tech-metric-grid"><Metric label="Data checks" value={formatNumber(data.metadata.analyzedFileCount)} helper="Input coverage reviewed" /><Metric label="Warnings" value={formatNumber(data.adapterRun.warnings.length)} helper="Adapter run notices" /><Metric label="Governance checks" value={formatNumber(data.governanceChecklist.length)} helper="Before future live integration" /><Metric label="Data mode" value={data.metadata.dataMode} helper={data.metadata.classification} /></div></section>
        <section className="tech-card"><CardHeading eyebrow="Current device posture" title="Issue summary" /><IssueList issues={issues} /></section>
      </section>
    </>
  );
}

function PostureFocusStrip() {
  return (
    <section className="tech-focus-strip" aria-label="Network and security device posture operating model">
      <article><span>01</span><strong>Normalize device findings</strong><small>Translate access control, LPR, recorder, and network/security-device signals into TechnologyIssue records.</small></article>
      <article><span>02</span><strong>Validate source confidence</strong><small>Show adapter status, source freshness, confidence, and warnings before downstream scoring or remediation.</small></article>
      <article><span>03</span><strong>Govern technical detail</strong><small>Keep raw identifiers role-gated while surfacing actionable posture, dependency, and integration-readiness summaries.</small></article>
    </section>
  );
}

function SourceFreshness({ data }: { data: TechnologyHealthData }) {
  return (
    <section className="tech-grid">
      <section className="tech-card wide"><CardHeading eyebrow="Adapter run" title="Technology health adapter status" pill={data.adapterRun.result.toUpperCase()} tone={data.adapterRun.result === 'Success' ? 'ready' : 'watch'} /><div className="tech-metric-grid"><Metric label="Adapter" value={data.adapterRun.adapter_id} helper={data.adapterRun.adapter_mode} /><Metric label="Started" value={formatDate(data.adapterRun.run_started_at)} helper="Demo run timestamp" /><Metric label="Completed" value={formatDate(data.adapterRun.run_completed_at)} helper="Demo run timestamp" /><Metric label="Record count" value={formatNumber(data.adapterRun.record_count)} helper="Normalized issues emitted" /></div><ul className="tech-note-list">{data.adapterRun.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>
      <section className="tech-card"><CardHeading eyebrow="Data health" title="Collection confidence" /><div className="tech-record-list">{data.sourceFreshness.map((source) => <article className="tech-record" key={source.source_id}><strong>{source.source_label}</strong><span>{source.adapter_mode} · {source.confidence} confidence</span><small>{source.freshness_status} · Last update {formatDate(source.last_demo_update)}</small></article>)}</div></section>
    </section>
  );
}

function DeviceDomains({ data }: { data: TechnologyHealthData }) {
  const issues = getDevicePostureIssues(data);
  const grouped = groupByDomain(issues);
  return <section className="tech-grid">{Object.entries(grouped).map(([domain, domainIssues]) => <section className="tech-card" key={domain}><CardHeading eyebrow="Device domain" title={domain} pill={`${domainIssues.length} ISSUE${domainIssues.length === 1 ? '' : 'S'}`} tone={domainIssues.some((issue) => issue.status === 'Critical' || issue.status === 'Degraded') ? 'watch' : 'stable'} /><IssueList issues={domainIssues} /></section>)}</section>;
}

function RecorderDependencies({ data }: { data: TechnologyHealthData }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const rows = useMemo(() => data.recorderHealth.filter((recorder) => statusFilter === 'all' || recorder.recorderStatus === statusFilter), [data.recorderHealth, statusFilter]);
  const statusOptions = Array.from(new Set(data.recorderHealth.map((recorder) => recorder.recorderStatus))).sort();
  return (
    <section className="tech-card">
      <div className="tech-directory-header"><div><p className="tech-eyebrow">Recorder / VMS dependencies</p><h2>Sanitized recorder health</h2></div><strong>{rows.length} recorders</strong></div>
      <div className="tech-filters"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All recorder statuses</option>{statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select></div>
      <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Site alias</th><th>Recorder</th><th>Status</th><th>Alive</th><th>Cameras</th><th>Last seen</th></tr></thead><tbody>{rows.map((recorder) => <RecorderRow recorder={recorder} key={`${recorder.siteAlias}-${recorder.recorderAlias}`} />)}</tbody></table></div>
    </section>
  );
}

function GovernanceReadiness({ data }: { data: TechnologyHealthData }) {
  return (
    <section className="tech-grid">
      <section className="tech-card wide"><CardHeading eyebrow="Future integration controls" title="Required governance before live adapters" pill="NO LIVE WRITEBACK" tone="critical" /><p>Live integrations remain placeholders until governance approves source access, security handling, role-gated technical detail, and read/write behavior.</p><div className="tech-governance-grid">{data.governanceChecklist.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong><small>Required before production adapter activation</small></article>)}</div></section>
      <section className="tech-card"><CardHeading eyebrow="Role gating" title="Default display rules" /><ul className="tech-note-list"><li>Default UI uses safe summaries and sanitized aggregate/store-level rows.</li><li>Raw IP, MAC, firmware, hostnames, and camera identifiers should stay out of leader views.</li><li>Engineer detail should be exposed only through approved role-gated references.</li><li>Remediation and scoring should consume normalized TechnologyIssue records only.</li></ul></section>
    </section>
  );
}

function IssueList({ issues }: { issues: TechnologyIssue[] }) {
  return <div className="tech-record-list">{issues.map((issue) => <article className="tech-record" key={issue.issue_id}><strong>{issue.domain} · {issue.status}</strong><span>{issue.severity} severity · {issue.confidence} confidence · {issue.freshness_status}</span><small>{issue.summary}</small><small>Risk drivers: {issue.risk_driver_ids.length ? issue.risk_driver_ids.join(', ') : 'None'} · Remediation: {issue.creates_remediation_id}</small></article>)}{issues.length === 0 ? <p className="tech-empty">No normalized posture issues in this selection.</p> : null}</div>;
}

function RecorderRow({ recorder }: { recorder: RecorderHealth }) {
  return <tr><td><strong>{recorder.siteAlias}</strong></td><td>{recorder.recorderAlias}<small>{recorder.vmsPlatform}</small></td><td><StatusPill label={recorder.recorderStatus.toUpperCase()} tone={recorder.alive ? 'ready' : 'critical'} /></td><td>{recorder.alive ? 'Yes' : 'No'}</td><td>{formatNumber(recorder.cameraCount)}</td><td>{formatDate(recorder.lastSeen)}</td></tr>;
}

function groupByDomain(issues: TechnologyIssue[]): Record<string, TechnologyIssue[]> {
  return issues.reduce<Record<string, TechnologyIssue[]>>((accumulator, issue) => {
    accumulator[issue.domain] = accumulator[issue.domain] ?? [];
    accumulator[issue.domain].push(issue);
    return accumulator;
  }, {});
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

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="tech-card tech-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}
