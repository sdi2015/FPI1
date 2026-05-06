import { useMemo, useState } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import { agingBucket, buildRemediationItems, getRemediationKpis, getRoutingRules, groupByStatus, isOverdue, summarizeBy } from '../../data/remediationSelectors';
import type { RemediationItem, RemediationSeverity, RemediationStatus } from '../../data/remediationTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyTechnologyHealthScope } from '../../data/technologyHealthScope';
import { formatDate, formatNumber } from '../../data/technologyHealthSelectors';
import { useTechnologyHealthData } from '../../data/useTechnologyHealthData';

export type RemediationOrchestrationViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type RemediationTab = 'queue' | 'triage' | 'sla' | 'routing' | 'evidence' | 'automation';
type SeverityFilter = 'all' | RemediationSeverity;

const tabs: Array<{ id: RemediationTab; label: string; eyebrow: string }> = [
  { id: 'queue', label: 'Command Queue', eyebrow: 'Actions' },
  { id: 'triage', label: 'Triage Board', eyebrow: 'Kanban' },
  { id: 'sla', label: 'SLA & Aging', eyebrow: 'Risk' },
  { id: 'routing', label: 'Assignment & Routing', eyebrow: 'Owners' },
  { id: 'evidence', label: 'Evidence & Verification', eyebrow: 'Proof' },
  { id: 'automation', label: 'Automation Readiness', eyebrow: 'Controls' },
];

export function RemediationOrchestrationView({ fireSites, storeScope, onChangeScopeRequest }: RemediationOrchestrationViewProps) {
  const [activeTab, setActiveTab] = useState<RemediationTab>('queue');
  const techState = useTechnologyHealthData();
  const scopedTechnologyData = useMemo(() => (techState.data ? applyTechnologyHealthScope(techState.data, fireSites, storeScope) : null), [techState.data, fireSites, storeScope]);
  const items = useMemo(() => (scopedTechnologyData ? buildRemediationItems(scopedTechnologyData) : []), [scopedTechnologyData]);

  return (
    <section className="remediation-page" aria-label="Remediation Orchestration">
      <header className="remediation-header">
        <div>
          <p className="remediation-eyebrow">Action Command Center</p>
          <h1>Remediation Orchestration</h1>
          <p>Turn camera, recorder, network, access-control, and security-device findings into accountable actions, SLA tracking, evidence collection, and verified closure.</p>
        </div>
        <div className="remediation-mode"><span>MODE</span>SIMULATED / NO WRITEBACK</div>
      </header>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {techState.loading ? <StatePanel title="Loading remediation inputs" message="Preparing Camera and Network/Posture findings for remediation orchestration." /> : null}
      {techState.error ? <StatePanel title="Remediation inputs unavailable" message={techState.error} danger /> : null}

      {scopedTechnologyData ? (
        <>
          <nav className="remediation-tab-bar" aria-label="Remediation Orchestration sub tabs">
            {tabs.map((tab) => <button className={activeTab === tab.id ? 'remediation-tab active' : 'remediation-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}><span>{tab.eyebrow}</span>{tab.label}</button>)}
          </nav>
          {activeTab === 'queue' ? <CommandQueue items={items} /> : null}
          {activeTab === 'triage' ? <TriageBoard items={items} /> : null}
          {activeTab === 'sla' ? <SlaAging items={items} /> : null}
          {activeTab === 'routing' ? <RoutingRules /> : null}
          {activeTab === 'evidence' ? <EvidenceVerification items={items} /> : null}
          {activeTab === 'automation' ? <AutomationReadiness /> : null}
        </>
      ) : null}
    </section>
  );
}

function CommandQueue({ items }: { items: RemediationItem[] }) {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [source, setSource] = useState('all');
  const kpis = getRemediationKpis(items);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => item.status !== 'Verified Complete')
      .filter((item) => severity === 'all' || item.severity === severity)
      .filter((item) => source === 'all' || item.sourceService === source)
      .filter((item) => !term || [item.title, item.description, item.facilityAlias, item.category, item.ownerTeam, item.channel, item.status, item.sourceService].join(' ').toLowerCase().includes(term))
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || Date.parse(a.dueAt) - Date.parse(b.dueAt));
  }, [items, search, severity, source]);

  return (
    <>
      <section className="remediation-kpi-grid">
        <Kpi label="Open actions" value={formatNumber(kpis.totalOpen)} detail="Camera + Network/Posture derived" tone="blue" />
        <Kpi label="Critical / High" value={formatNumber(kpis.criticalHigh)} detail="Priority P1/P2 attention" tone="yellow" />
        <Kpi label="Overdue" value={formatNumber(kpis.overdue)} detail="Past simulated SLA due" tone="critical" />
        <Kpi label="SLA on track" value={`${kpis.onTrackPercent}%`} detail={`${formatNumber(kpis.evidenceRequired)} require evidence`} tone="sky" />
      </section>
      <section className="remediation-card">
        <div className="remediation-directory-header"><div><p className="remediation-eyebrow">Unified command queue</p><h2>Open remediation actions</h2></div><strong>{rows.length} actions</strong></div>
        <div className="remediation-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search finding, facility, owner, channel, status" /><select value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)}><option value="all">All severities</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option><option value="Informational">Informational</option></select><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option><option value="Camera & Technical Control Monitoring">Camera & Technical Control</option><option value="Network & Security Device Posture">Network & Device Posture</option></select></div>
        <RemediationTable items={rows} />
      </section>
    </>
  );
}

function TriageBoard({ items }: { items: RemediationItem[] }) {
  const grouped = groupByStatus(items);
  const statuses: RemediationStatus[] = ['New', 'Triaged', 'Assigned', 'In Progress', 'Blocked', 'Pending Verification', 'Verified Complete'];
  return <section className="remediation-kanban" aria-label="Remediation triage board">{statuses.map((status) => <div className="remediation-lane" key={status}><div className="remediation-lane-header"><h2>{status}</h2><span>{grouped[status].length}</span></div>{grouped[status].map((item) => <RemediationCard item={item} key={item.remediationId} />)}</div>)}</section>;
}

function SlaAging({ items }: { items: RemediationItem[] }) {
  const open = items.filter((item) => item.status !== 'Verified Complete');
  const byAging = summarizeBy(open, agingBucket);
  const byOwner = summarizeBy(open, (item) => item.ownerTeam);
  const overdue = open.filter(isOverdue);
  return <section className="remediation-grid"><section className="remediation-card wide"><CardHeading eyebrow="SLA pressure" title="Aging buckets and overdue actions" pill={`${overdue.length} OVERDUE`} tone={overdue.length ? 'critical' : 'ready'} /><ChartRows rows={byAging} /></section><section className="remediation-card"><CardHeading eyebrow="Owner load" title="Actions by owner team" /><ChartRows rows={byOwner} /></section><section className="remediation-card wide"><CardHeading eyebrow="Critical path" title="Overdue or at-risk actions" /><RemediationTable items={overdue.length ? overdue : open.slice(0, 8)} compact /></section></section>;
}

function RoutingRules() {
  return <section className="remediation-card"><CardHeading eyebrow="Routing logic" title="Assignment and channel rules" pill="SIMULATED" tone="watch" /><div className="remediation-table-wrap"><table className="remediation-table"><thead><tr><th>Finding type</th><th>Source</th><th>Channel</th><th>Owner</th><th>Trigger</th><th>Evidence</th></tr></thead><tbody>{getRoutingRules().map((rule) => <tr key={rule.findingType}><td><strong>{rule.findingType}</strong></td><td>{rule.sourceService}</td><td>{rule.channel}</td><td>{rule.ownerTeam}</td><td>{rule.severityTrigger}</td><td>{rule.evidenceExpectation}</td></tr>)}</tbody></table></div></section>;
}

function EvidenceVerification({ items }: { items: RemediationItem[] }) {
  const evidenceItems = items.filter((item) => item.evidenceRequired);
  const byEvidence = summarizeBy(evidenceItems, (item) => item.evidenceStatus);
  return <section className="remediation-grid"><section className="remediation-card"><CardHeading eyebrow="Evidence status" title="Proof required to close" /><ChartRows rows={byEvidence} /></section><section className="remediation-card wide"><CardHeading eyebrow="Verification queue" title="Evidence checklist by action" /><div className="remediation-evidence-list">{evidenceItems.slice(0, 12).map((item) => <article key={item.remediationId}><div><strong>{item.title}</strong><span>{item.facilityAlias} · {item.evidenceStatus}</span></div><ul>{item.evidenceChecklist.map((check) => <li key={check}>{check}</li>)}</ul></article>)}</div></section></section>;
}

function AutomationReadiness() {
  const controls = ['Source owner approval', 'Writeback approval', 'Role-based access rules', 'Audit logging and retention', 'Duplicate ticket prevention', 'Secrets management', 'Failure and retry handling', 'Rate-limit handling'];
  return <section className="remediation-grid"><section className="remediation-card wide"><CardHeading eyebrow="Future automation" title="Controls required before live ticket creation" pill="NO WRITEBACK" tone="critical" /><p>The current remediation page is a simulated orchestration queue. It does not create live ServiceChannel, Me@Walmart, vendor, or security-engineering tickets.</p><div className="remediation-readiness-grid">{controls.map((control, index) => <article key={control}><span>{String(index + 1).padStart(2, '0')}</span><strong>{control}</strong><small>Required before production automation activation</small></article>)}</div></section><section className="remediation-card"><CardHeading eyebrow="Current mode" title="What this page does now" /><ul className="remediation-note-list"><li>Consumes Camera and Network/Posture demo findings.</li><li>Normalizes actions, owners, SLA, evidence, and channel recommendations.</li><li>Displays operational queues and governance readiness.</li><li>Does not write back to production systems.</li></ul></section></section>;
}

function RemediationTable({ items, compact = false }: { items: RemediationItem[]; compact?: boolean }) {
  return <div className="remediation-table-wrap"><table className="remediation-table"><thead><tr><th>Priority</th><th>Finding</th><th>Source</th><th>Facility</th><th>Owner</th><th>Status</th>{compact ? null : <th>Evidence</th>}<th>Due</th></tr></thead><tbody>{items.map((item) => <tr key={item.remediationId} className={isOverdue(item) ? 'is-overdue' : undefined}><td><PriorityPill item={item} /></td><td><strong>{item.title}</strong><small>{item.category} · {item.nextStep}</small></td><td>{item.sourceService}</td><td>{item.facilityAlias}<small>{item.region}</small></td><td>{item.ownerTeam}<small>{item.channel}</small></td><td><StatusPill label={item.status} tone={statusTone(item.status)} /></td>{compact ? null : <td>{item.evidenceStatus}<small>{item.evidenceRequired ? 'Required' : 'Not required'}</small></td>}<td>{formatDate(item.dueAt)}<small>{isOverdue(item) ? 'Overdue' : `${item.slaHours}h SLA`}</small></td></tr>)}</tbody></table>{items.length === 0 ? <p className="remediation-empty">No remediation actions match the current filters.</p> : null}</div>;
}

function RemediationCard({ item }: { item: RemediationItem }) {
  return <article className={isOverdue(item) ? 'remediation-board-card overdue' : 'remediation-board-card'}><div><PriorityPill item={item} /><StatusPill label={item.severity} tone={severityTone(item.severity)} /></div><strong>{item.title}</strong><span>{item.facilityAlias} · {item.sourceService}</span><small>{item.ownerTeam} · Due {formatDate(item.dueAt)}</small><p>{item.recommendedAction}</p></article>;
}

function ChartRows({ rows }: { rows: Record<string, number> }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return <div className="remediation-chart-rows">{entries.map(([label, value]) => <div className="remediation-chart-row" key={label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><div><span style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div></div>)}</div>;
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'yellow' | 'sky' | 'critical' }) {
  return <article className={`remediation-kpi tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function CardHeading({ eyebrow, title, pill, tone = 'stable' }: { eyebrow: string; title: string; pill?: string; tone?: StatusTone }) {
  return <div className="remediation-card-heading"><div><p className="remediation-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{pill ? <StatusPill label={pill} tone={tone} /> : null}</div>;
}

function PriorityPill({ item }: { item: RemediationItem }) {
  return <span className={`remediation-priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span>;
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="remediation-card remediation-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}

function priorityRank(priority: string): number {
  return { P1: 1, P2: 2, P3: 3, P4: 4 }[priority] ?? 9;
}

function severityTone(severity: RemediationSeverity): StatusTone {
  if (severity === 'Critical') return 'critical';
  if (severity === 'High' || severity === 'Medium') return 'watch';
  return 'stable';
}

function statusTone(status: RemediationStatus): StatusTone {
  if (status === 'Blocked') return 'critical';
  if (status === 'Pending Verification' || status === 'In Progress') return 'watch';
  if (status === 'Verified Complete') return 'ready';
  return 'stable';
}
