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
type SlaFocus = 'all' | 'overdue' | 'atRisk' | 'dueSoon' | 'blocked' | 'onTrack';
type EvidenceFocus = 'all' | 'alerts' | 'overdue' | 'pending' | 'missing' | 'verified';
type RemediationColorTier = 'red' | 'orange' | 'yellow' | 'green';

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
  const open = items.filter((item) => item.status !== 'Verified Complete');
  const tierCounts = summarizeBy(open, (item) => triageTierLabel(getRemediationColorTier(item)));

  return (
    <>
      <section className="remediation-card wide triage-command-panel" aria-label="Triage board legend and summary">
        <CardHeading eyebrow="Triage priority" title="Color-coded action board" pill="RED / ORANGE / YELLOW / GREEN" tone="watch" />
        <p>Use the color treatment and text labels together. Red cards need immediate action, orange cards are at risk, yellow cards need monitoring or verification, and green cards are complete or on track.</p>
        <div className="remediation-tier-legend">
          <span className="tier-red"><i aria-hidden="true" />Red: Immediate action</span>
          <span className="tier-orange"><i aria-hidden="true" />Orange: At risk</span>
          <span className="tier-yellow"><i aria-hidden="true" />Yellow: Monitor / verify</span>
          <span className="tier-green"><i aria-hidden="true" />Green: On track / complete</span>
        </div>
        <div className="remediation-tier-summary">
          <Metric label="Immediate action" value={formatNumber(tierCounts['Red'] ?? 0)} helper="Overdue, blocked, P1, or critical" tier="red" />
          <Metric label="At risk" value={formatNumber(tierCounts['Orange'] ?? 0)} helper="High priority or due soon" tier="orange" />
          <Metric label="Monitor / verify" value={formatNumber(tierCounts['Yellow'] ?? 0)} helper="Evidence or verification needed" tier="yellow" />
          <Metric label="On track" value={formatNumber(tierCounts['Green'] ?? 0)} helper="Stable or complete" tier="green" />
        </div>
      </section>
      <section className="remediation-kanban" aria-label="Remediation triage board">
        {statuses.map((status) => (
          <div className="remediation-lane" key={status}>
            <div className="remediation-lane-header"><h2>{status}</h2><span>{grouped[status].length}</span></div>
            {grouped[status].map((item) => <RemediationCard item={item} key={item.remediationId} />)}
          </div>
        ))}
      </section>
    </>
  );
}

function SlaAging({ items }: { items: RemediationItem[] }) {
  const [focus, setFocus] = useState<SlaFocus>('overdue');
  const [selectedOwner, setSelectedOwner] = useState('all');
  const open = items.filter((item) => item.status !== 'Verified Complete');
  const byAging = summarizeBy(open, agingBucket);
  const byOwner = summarizeBy(open, (item) => item.ownerTeam);
  const overdue = open.filter(isOverdue);
  const atRisk = open.filter((item) => !isOverdue(item) && isSlaAtRisk(item));
  const dueSoon = open.filter((item) => !isOverdue(item) && isDueSoon(item));
  const blocked = open.filter((item) => item.status === 'Blocked');
  const onTrack = open.filter((item) => isSlaOnTrack(item));
  const selectedItems = open
    .filter((item) => selectedOwner === 'all' || item.ownerTeam === selectedOwner)
    .filter((item) => {
      if (focus === 'overdue') return isOverdue(item);
      if (focus === 'atRisk') return !isOverdue(item) && isSlaAtRisk(item);
      if (focus === 'dueSoon') return !isOverdue(item) && isDueSoon(item);
      if (focus === 'blocked') return item.status === 'Blocked';
      if (focus === 'onTrack') return isSlaOnTrack(item);
      return true;
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || Date.parse(a.dueAt) - Date.parse(b.dueAt));

  return (
    <section className="remediation-grid">
      <section className="remediation-card wide sla-pressure-panel">
        <CardHeading eyebrow="SLA pressure" title="Click a pressure card to focus the work queue" pill={`${overdue.length} OVERDUE`} tone={overdue.length ? 'critical' : 'ready'} />
        <div className="sla-pressure-grid" role="list" aria-label="SLA pressure filters">
          <SlaPressureButton label="Overdue" value={overdue.length} detail="Past due date" active={focus === 'overdue'} tier="red" onClick={() => setFocus('overdue')} />
          <SlaPressureButton label="At Risk" value={atRisk.length} detail="High pressure before breach" active={focus === 'atRisk'} tier="orange" onClick={() => setFocus('atRisk')} />
          <SlaPressureButton label="Due Soon" value={dueSoon.length} detail="Due within 48 hours" active={focus === 'dueSoon'} tier="yellow" onClick={() => setFocus('dueSoon')} />
          <SlaPressureButton label="Blocked" value={blocked.length} detail="Needs escalation" active={focus === 'blocked'} tier="red" onClick={() => setFocus('blocked')} />
          <SlaPressureButton label="On Track" value={onTrack.length} detail="Stable open work" active={focus === 'onTrack'} tier="green" onClick={() => setFocus('onTrack')} />
          <SlaPressureButton label="All Open" value={open.length} detail="Reset focus" active={focus === 'all'} tier="green" onClick={() => setFocus('all')} />
        </div>
        <h3>Aging distribution</h3>
        <ChartRows rows={byAging} />
      </section>
      <section className="remediation-card">
        <CardHeading eyebrow="Owner load" title="Click an owner to filter" pill={selectedOwner === 'all' ? 'ALL OWNERS' : selectedOwner} tone="watch" />
        <InteractiveChartRows rows={byOwner} activeValue={selectedOwner} onSelect={(owner) => setSelectedOwner(selectedOwner === owner ? 'all' : owner)} />
      </section>
      <section className="remediation-card wide">
        <CardHeading eyebrow="Selected work queue" title={`${focusLabel(focus)}${selectedOwner === 'all' ? '' : ` · ${selectedOwner}`}`} pill={`${selectedItems.length} ACTIONS`} tone={selectedItems.length ? 'watch' : 'ready'} />
        <p>Use this table to inspect overdue or at-risk items without leaving the SLA tab. Select a different pressure card or owner to change the queue.</p>
        <RemediationTable items={selectedItems} compact />
      </section>
    </section>
  );
}

function RoutingRules() {
  return <section className="remediation-card"><CardHeading eyebrow="Routing logic" title="Assignment and channel rules" pill="SIMULATED" tone="watch" /><div className="remediation-table-wrap"><table className="remediation-table"><thead><tr><th>Finding type</th><th>Source</th><th>Channel</th><th>Owner</th><th>Trigger</th><th>Evidence</th></tr></thead><tbody>{getRoutingRules().map((rule) => <tr key={rule.findingType}><td><strong>{rule.findingType}</strong></td><td>{rule.sourceService}</td><td>{rule.channel}</td><td>{rule.ownerTeam}</td><td>{rule.severityTrigger}</td><td>{rule.evidenceExpectation}</td></tr>)}</tbody></table></div></section>;
}

function EvidenceVerification({ items }: { items: RemediationItem[] }) {
  const [focus, setFocus] = useState<EvidenceFocus>('alerts');
  const evidenceItems = items.filter((item) => item.evidenceRequired);
  const byEvidence = summarizeBy(evidenceItems, (item) => item.evidenceStatus);
  const alertItems = evidenceItems.filter(hasEvidenceAlert);
  const overdueEvidence = evidenceItems.filter((item) => item.evidenceStatus !== 'Verified' && isOverdue(item));
  const pendingVerification = evidenceItems.filter((item) => item.evidenceStatus === 'Pending Verification' || item.status === 'Pending Verification');
  const missingProof = evidenceItems.filter((item) => item.evidenceStatus === 'Required' || item.evidenceStatus === 'Rejected');
  const verified = evidenceItems.filter((item) => item.evidenceStatus === 'Verified');
  const selectedItems = evidenceItems
    .filter((item) => {
      if (focus === 'alerts') return hasEvidenceAlert(item);
      if (focus === 'overdue') return item.evidenceStatus !== 'Verified' && isOverdue(item);
      if (focus === 'pending') return item.evidenceStatus === 'Pending Verification' || item.status === 'Pending Verification';
      if (focus === 'missing') return item.evidenceStatus === 'Required' || item.evidenceStatus === 'Rejected';
      if (focus === 'verified') return item.evidenceStatus === 'Verified';
      return true;
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || Date.parse(a.dueAt) - Date.parse(b.dueAt));

  return (
    <section className="remediation-grid">
      <section className="remediation-card wide evidence-alert-panel">
        <CardHeading eyebrow="Evidence alerts" title="Items needing proof or verification attention" pill={`${alertItems.length} ALERTS`} tone={alertItems.length ? 'critical' : 'ready'} />
        <p>These are dashboard alerts derived from the current remediation data. They do not send notifications, but they show which items have unresolved evidence, overdue proof, rejected evidence, or verification aging.</p>
        <div className="sla-pressure-grid evidence-focus-grid" role="list" aria-label="Evidence focus filters">
          <SlaPressureButton label="Alerts" value={alertItems.length} detail="Needs evidence action" active={focus === 'alerts'} tier="red" onClick={() => setFocus('alerts')} />
          <SlaPressureButton label="Evidence Overdue" value={overdueEvidence.length} detail="Past due and not verified" active={focus === 'overdue'} tier="red" onClick={() => setFocus('overdue')} />
          <SlaPressureButton label="Pending Verification" value={pendingVerification.length} detail="Awaiting validation" active={focus === 'pending'} tier="yellow" onClick={() => setFocus('pending')} />
          <SlaPressureButton label="Missing / Rejected" value={missingProof.length} detail="Proof still needed" active={focus === 'missing'} tier="orange" onClick={() => setFocus('missing')} />
          <SlaPressureButton label="Verified" value={verified.length} detail="Evidence accepted" active={focus === 'verified'} tier="green" onClick={() => setFocus('verified')} />
          <SlaPressureButton label="All Evidence" value={evidenceItems.length} detail="Reset focus" active={focus === 'all'} tier="green" onClick={() => setFocus('all')} />
        </div>
      </section>
      <section className="remediation-card"><CardHeading eyebrow="Evidence status" title="Proof required to close" /><ChartRows rows={byEvidence} /></section>
      <section className="remediation-card wide"><CardHeading eyebrow="Verification queue" title={evidenceFocusLabel(focus)} pill={`${selectedItems.length} ITEMS`} tone={selectedItems.length ? 'watch' : 'ready'} /><div className="remediation-evidence-list">{selectedItems.slice(0, 16).map((item) => <EvidenceActionCard item={item} key={item.remediationId} />)}{selectedItems.length === 0 ? <p className="remediation-empty">No evidence records match the current focus.</p> : null}</div></section>
    </section>
  );
}

function AutomationReadiness() {
  const controls = [
    { name: 'Source owner approval', status: 'Needs Approval', detail: 'Each source must have an accountable owner and approved use case.' },
    { name: 'Writeback approval', status: 'Required', detail: 'Live ticket creation remains disabled until workflow controls are approved.' },
    { name: 'Role-based access rules', status: 'Needs Approval', detail: 'Sensitive remediation and evidence fields need role-gated access.' },
    { name: 'Audit logging and retention', status: 'Required', detail: 'Every automated action needs traceability, retention, and review controls.' },
    { name: 'Duplicate ticket prevention', status: 'Planned', detail: 'Automation must detect existing ServiceChannel, Me@Walmart, or vendor work.' },
    { name: 'Secrets management', status: 'Required', detail: 'Credentials and tokens need approved vaulting and rotation.' },
    { name: 'Failure and retry handling', status: 'Planned', detail: 'Failed submissions need retry limits, owner notification, and audit notes.' },
    { name: 'Rate-limit handling', status: 'Planned', detail: 'Integrations need throttling and backoff before any production activation.' },
  ];
  const readyCount = controls.filter((control) => control.status === 'Ready').length;
  const readinessScore = Math.round((readyCount / controls.length) * 100);

  return (
    <section className="remediation-grid">
      <section className="remediation-card wide automation-hero-card">
        <CardHeading eyebrow="Automation readiness" title="Controls required before live ticket creation" pill="NO WRITEBACK" tone="critical" />
        <div className="automation-warning"><strong>Live ticket creation is disabled.</strong><p>This page prepares routing logic, SLA context, and evidence expectations. It does not create ServiceChannel, Me@Walmart, vendor, or security-engineering tickets.</p></div>
        <div className="remediation-tier-summary">
          <Metric label="Readiness score" value={`${readinessScore}%`} helper="Approved production controls" />
          <Metric label="Controls tracked" value={formatNumber(controls.length)} helper="Required before writeback" />
          <Metric label="Needs approval" value={formatNumber(controls.filter((control) => control.status === 'Needs Approval').length)} helper="Owner or governance signoff" />
          <Metric label="Required / planned" value={formatNumber(controls.filter((control) => control.status !== 'Ready').length)} helper="Remaining blockers" />
        </div>
        <div className="remediation-readiness-grid enhanced">{controls.map((control, index) => <article key={control.name} className={`automation-control-card status-${control.status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{control.name}</strong><StatusPill label={control.status} tone={automationTone(control.status)} /></div><small>{control.detail}</small></article>)}</div>
      </section>
      <section className="remediation-card"><CardHeading eyebrow="Current mode" title="What this page does now" pill="SIMULATED" tone="watch" /><ul className="remediation-note-list"><li>Consumes Camera and Network/Posture demo findings.</li><li>Normalizes actions, owners, SLA, evidence, and channel recommendations.</li><li>Displays operational queues, SLA pressure, evidence alerts, and governance readiness.</li><li>Does not write back to production systems or create tickets.</li></ul><h3>Recommended next steps</h3><ul className="remediation-note-list"><li>Confirm source owners and approved data use.</li><li>Define duplicate detection and audit logging before writeback.</li><li>Keep manual review in place until control owners approve automation.</li></ul></section>
    </section>
  );
}

function Metric({ label, value, helper, tier }: { label: string; value: string; helper: string; tier?: RemediationColorTier }) {
  return <div className={tier ? `remediation-metric metric-${tier}` : 'remediation-metric'}><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function SlaPressureButton({ label, value, detail, active, tier, onClick }: { label: string; value: number; detail: string; active: boolean; tier: RemediationColorTier; onClick: () => void }) {
  return <button className={active ? `sla-pressure-button tier-${tier} active` : `sla-pressure-button tier-${tier}`} type="button" onClick={onClick} aria-pressed={active}><span>{label}</span><strong>{formatNumber(value)}</strong><small>{detail}</small></button>;
}

function EvidenceActionCard({ item }: { item: RemediationItem }) {
  const reasons = evidenceAlertReasons(item);
  return <article className={`evidence-action-card tier-${getRemediationColorTier(item)}`}><div className="evidence-action-header"><div><strong>{item.title}</strong><span>{item.facilityAlias} · {item.ownerTeam} · Due {formatDate(item.dueAt)}</span></div><StatusPill label={item.evidenceStatus} tone={item.evidenceStatus === 'Verified' ? 'ready' : item.evidenceStatus === 'Rejected' ? 'critical' : 'watch'} /></div>{reasons.length ? <div className="evidence-alert-tags">{reasons.map((reason) => <span key={reason}>{reason}</span>)}</div> : null}<ul>{item.evidenceChecklist.map((check) => <li key={check}>{check}</li>)}</ul></article>;
}

function InteractiveChartRows({ rows, activeValue, onSelect }: { rows: Record<string, number>; activeValue: string; onSelect: (label: string) => void }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return <div className="remediation-chart-rows interactive">{entries.map(([label, value]) => <button className={activeValue === label ? 'remediation-chart-row active' : 'remediation-chart-row'} type="button" key={label} onClick={() => onSelect(label)} aria-pressed={activeValue === label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><div><span style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div></button>)}{entries.length === 0 ? <p className="remediation-empty">No records available.</p> : null}</div>;
}

function RemediationTable({ items, compact = false }: { items: RemediationItem[]; compact?: boolean }) {
  return <div className="remediation-table-wrap"><table className="remediation-table"><thead><tr><th>Priority</th><th>Finding</th><th>Source</th><th>Facility</th><th>Owner</th><th>Status</th>{compact ? null : <th>Evidence</th>}<th>Due</th></tr></thead><tbody>{items.map((item) => <tr key={item.remediationId} className={isOverdue(item) ? 'is-overdue' : undefined}><td><PriorityPill item={item} /></td><td><strong>{item.title}</strong><small>{item.category} · {item.nextStep}</small></td><td>{item.sourceService}</td><td>{item.facilityAlias}<small>{item.region}</small></td><td>{item.ownerTeam}<small>{item.channel}</small></td><td><StatusPill label={item.status} tone={statusTone(item.status)} /></td>{compact ? null : <td>{item.evidenceStatus}<small>{item.evidenceRequired ? 'Required' : 'Not required'}</small></td>}<td>{formatDate(item.dueAt)}<small>{isOverdue(item) ? 'Overdue' : `${item.slaHours}h SLA`}</small></td></tr>)}</tbody></table>{items.length === 0 ? <p className="remediation-empty">No remediation actions match the current filters.</p> : null}</div>;
}

function RemediationCard({ item }: { item: RemediationItem }) {
  const tier = getRemediationColorTier(item);
  const sla = slaStatusLabel(item);
  return <article className={`remediation-board-card tier-${tier}${isOverdue(item) ? ' overdue' : ''}`}><div className="board-card-top"><PriorityPill item={item} /><StatusPill label={item.severity} tone={severityTone(item.severity)} /></div><strong>{item.title}</strong><span>{item.facilityAlias} · {item.sourceService}</span><div className="board-card-meta"><span>{item.ownerTeam}</span><span className={`sla-text tier-${tier}`}>{sla}</span></div><div className="board-card-tags"><span>{item.status}</span><span>{item.evidenceRequired ? `Evidence: ${item.evidenceStatus}` : 'Evidence: Not required'}</span></div><p><b>Next step:</b> {item.recommendedAction}</p></article>;
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

function hoursUntilDue(item: RemediationItem): number {
  return Math.ceil((Date.parse(item.dueAt) - Date.now()) / 36e5);
}

function isDueSoon(item: RemediationItem): boolean {
  const hours = hoursUntilDue(item);
  return hours >= 0 && hours <= 48;
}

function isSlaAtRisk(item: RemediationItem): boolean {
  return item.status === 'Blocked' || item.priority === 'P1' || item.priority === 'P2' || isDueSoon(item) || item.status === 'Pending Verification';
}

function isSlaOnTrack(item: RemediationItem): boolean {
  return item.status !== 'Verified Complete' && !isOverdue(item) && !isSlaAtRisk(item);
}

function slaStatusLabel(item: RemediationItem): string {
  if (item.status === 'Verified Complete') return 'Complete';
  if (isOverdue(item)) return `Overdue by ${Math.abs(hoursUntilDue(item))}h`;
  if (isDueSoon(item)) return `Due soon: ${hoursUntilDue(item)}h`;
  if (item.status === 'Blocked') return 'Blocked';
  return `${hoursUntilDue(item)}h until due`;
}

function getRemediationColorTier(item: RemediationItem): RemediationColorTier {
  if (item.status === 'Verified Complete') return 'green';
  if (isOverdue(item) || item.status === 'Blocked' || item.priority === 'P1' || item.severity === 'Critical') return 'red';
  if (isDueSoon(item) || item.priority === 'P2' || item.severity === 'High') return 'orange';
  if (item.priority === 'P4' || item.severity === 'Low' || item.severity === 'Informational') return 'green';
  return 'yellow';
}

function triageTierLabel(tier: RemediationColorTier): string {
  if (tier === 'red') return 'Red';
  if (tier === 'orange') return 'Orange';
  if (tier === 'yellow') return 'Yellow';
  return 'Green';
}

function focusLabel(focus: SlaFocus): string {
  if (focus === 'overdue') return 'Overdue actions';
  if (focus === 'atRisk') return 'At-risk actions';
  if (focus === 'dueSoon') return 'Due soon actions';
  if (focus === 'blocked') return 'Blocked actions';
  if (focus === 'onTrack') return 'On-track actions';
  return 'All open actions';
}

function evidenceFocusLabel(focus: EvidenceFocus): string {
  if (focus === 'alerts') return 'Evidence alerts requiring attention';
  if (focus === 'overdue') return 'Overdue evidence';
  if (focus === 'pending') return 'Pending verification';
  if (focus === 'missing') return 'Missing or rejected proof';
  if (focus === 'verified') return 'Verified evidence';
  return 'All evidence-required actions';
}

function evidenceAlertReasons(item: RemediationItem): string[] {
  const reasons: string[] = [];
  if (item.evidenceStatus !== 'Verified' && isOverdue(item)) reasons.push('Evidence overdue');
  if (item.status === 'Pending Verification' || item.evidenceStatus === 'Pending Verification') reasons.push('Verification aging');
  if (item.evidenceStatus === 'Required') reasons.push('Missing proof');
  if (item.evidenceStatus === 'Rejected') reasons.push('Rejected evidence');
  if (item.status === 'Blocked') reasons.push('Blocked');
  return reasons;
}

function hasEvidenceAlert(item: RemediationItem): boolean {
  return item.evidenceRequired && item.evidenceStatus !== 'Verified' && evidenceAlertReasons(item).length > 0;
}

function automationTone(status: string): StatusTone {
  if (status === 'Ready') return 'ready';
  if (status === 'Required' || status === 'Needs Approval') return 'critical';
  return 'watch';
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
