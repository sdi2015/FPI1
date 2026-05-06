import { useEffect, useMemo, useState } from 'react';
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

type RemediationTab = 'workbench' | 'queue' | 'triage' | 'sla' | 'routing' | 'evidence' | 'automation';
type SeverityFilter = 'all' | RemediationSeverity;
type SlaFocus = 'all' | 'overdue' | 'atRisk' | 'dueSoon' | 'blocked' | 'onTrack';
type EvidenceFocus = 'all' | 'alerts' | 'overdue' | 'pending' | 'missing' | 'verified';
type RemediationColorTier = 'red' | 'orange' | 'yellow' | 'green';
type WorkbenchStatus = 'New' | 'Assigned' | 'Evidence Requested' | 'Evidence Received' | 'Ready for Verification' | 'Verified Closed';
type RiskDowngradeEligibility = 'Not Eligible' | 'Evidence Incomplete' | 'Owner Needed' | 'Pending Verification' | 'Eligible for Downgrade' | 'Downgraded/Closed';
type WorkbenchQuickFilter = 'all' | 'overdue' | 'missingEvidence' | 'ownerNeeded' | 'vendorFollowUp' | 'externalNeeded' | 'readyVerification' | 'verifiedClosed' | 'downgradeEligible';

type EvidenceChecklistItem = {
  id: string;
  label: string;
  received: boolean;
};

type EvidenceAction = {
  id: string;
  priority: string;
  storeFacility: string;
  market: string;
  riskTier: string;
  sourceModule: string;
  issueType: string;
  riskFinding: string;
  actionSummary: string;
  recommendedOwner: string;
  assignedOwner: string;
  vendorExternalParty: string;
  dueDate: string;
  status: WorkbenchStatus;
  evidenceChecklist: EvidenceChecklistItem[];
  closureConfidence: number;
  nextStep: string;
  notes: string;
  vendorContacted: boolean;
  escalated: boolean;
};

type WorkbenchFilters = {
  search: string;
  store: string;
  market: string;
  riskTier: string;
  sourceModule: string;
  issueType: string;
  priority: string;
  status: string;
  owner: string;
  vendor: string;
  dueDate: string;
  quickFilter: WorkbenchQuickFilter;
};

const tabs: Array<{ id: RemediationTab; label: string; eyebrow: string }> = [
  { id: 'workbench', label: 'Evidence-to-Action', eyebrow: 'Workbench' },
  { id: 'queue', label: 'Command Queue', eyebrow: 'Actions' },
  { id: 'triage', label: 'Triage Board', eyebrow: 'Kanban' },
  { id: 'sla', label: 'SLA & Aging', eyebrow: 'Risk' },
  { id: 'routing', label: 'Assignment & Routing', eyebrow: 'Owners' },
  { id: 'evidence', label: 'Evidence & Verification', eyebrow: 'Proof' },
  { id: 'automation', label: 'Automation Readiness', eyebrow: 'Controls' },
];

export function RemediationOrchestrationView({ fireSites, storeScope, onChangeScopeRequest }: RemediationOrchestrationViewProps) {
  const [activeTab, setActiveTab] = useState<RemediationTab>('workbench');
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
          {activeTab === 'workbench' ? <EvidenceToActionWorkbench items={items} /> : null}
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

function EvidenceToActionWorkbench({ items }: { items: RemediationItem[] }) {
  const [actions, setActions] = useState<EvidenceAction[]>(buildEvidenceActions(items));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkbenchFilters>({
    search: '',
    store: 'all',
    market: 'all',
    riskTier: 'all',
    sourceModule: 'all',
    issueType: 'all',
    priority: 'all',
    status: 'all',
    owner: 'all',
    vendor: 'all',
    dueDate: '',
    quickFilter: 'all',
  });

  useEffect(() => {
    setActions(buildEvidenceActions(items));
    setSelectedId(null);
  }, [items]);

  const selectedAction = actions.find((action) => action.id === selectedId) ?? null;
  const filteredActions = useMemo(() => filterEvidenceActions(actions, filters), [actions, filters]);
  const options = useMemo(() => ({
    stores: uniqueStrings(actions.map((action) => action.storeFacility)),
    markets: uniqueStrings(actions.map((action) => action.market)),
    riskTiers: uniqueStrings(actions.map((action) => action.riskTier)),
    sourceModules: uniqueStrings(actions.map((action) => action.sourceModule)),
    issueTypes: uniqueStrings(actions.map((action) => action.issueType)),
    priorities: uniqueStrings(actions.map((action) => action.priority)),
    statuses: uniqueStrings(actions.map((action) => action.status)),
    owners: uniqueStrings(actions.flatMap((action) => [action.assignedOwner, action.recommendedOwner]).filter(Boolean)),
    vendors: uniqueStrings(actions.map((action) => action.vendorExternalParty)),
  }), [actions]);

  const summary = getWorkbenchSummary(actions);
  const pipeline = getClosurePipeline(actions);

  function updateAction(id: string, patch: Partial<EvidenceAction>) {
    setActions((current) => current.map((action) => action.id === id ? normalizeEvidenceAction({ ...action, ...patch }) : action));
  }

  function toggleEvidence(id: string, evidenceId: string) {
    setActions((current) => current.map((action) => {
      if (action.id !== id) return action;
      const evidenceChecklist = action.evidenceChecklist.map((check) => check.id === evidenceId ? { ...check, received: !check.received } : check);
      const nextStatus = evidenceChecklist.length && evidenceChecklist.every((check) => check.received) && action.status === 'Evidence Requested' ? 'Evidence Received' : action.status;
      return normalizeEvidenceAction({ ...action, evidenceChecklist, status: nextStatus });
    }));
  }

  return (
    <section className="evidence-workbench" aria-label="Evidence-to-Action Workbench">
      <section className="remediation-card wide workbench-hero-card">
        <CardHeading eyebrow="Evidence-to-Action Workbench" title="Turn FPI findings into accountable, evidence-backed remediation" pill="NO TICKET WRITEBACK" tone="watch" />
        <p>Risk Intelligence and source modules can draft actions, owners, and evidence needs. This workbench closes the operational gap by tracking accountable action, evidence readiness, vendor follow-up, verification, and risk-downgrade eligibility without creating tickets or sending messages.</p>
      </section>

      <section className="workbench-summary-grid" aria-label="Evidence-to-Action summary cards">
        <WorkbenchSummaryCard label="Open Actions" value={summary.openActions} detail="Not verified closed" active={filters.quickFilter === 'all'} onClick={() => setFilters({ ...filters, quickFilter: 'all' })} tone="blue" />
        <WorkbenchSummaryCard label="Overdue" value={summary.overdue} detail="Past due date" active={filters.quickFilter === 'overdue'} onClick={() => setFilters({ ...filters, quickFilter: 'overdue' })} tone="critical" />
        <WorkbenchSummaryCard label="Missing Evidence" value={summary.missingEvidence} detail="Checklist incomplete" active={filters.quickFilter === 'missingEvidence'} onClick={() => setFilters({ ...filters, quickFilter: 'missingEvidence' })} tone="yellow" />
        <WorkbenchSummaryCard label="Owner Needed" value={summary.ownerNeeded} detail="No assigned owner" active={filters.quickFilter === 'ownerNeeded'} onClick={() => setFilters({ ...filters, quickFilter: 'ownerNeeded' })} tone="critical" />
        <WorkbenchSummaryCard label="Vendor Follow-Ups" value={summary.vendorFollowUps} detail="Vendor/external party active" active={filters.quickFilter === 'vendorFollowUp'} onClick={() => setFilters({ ...filters, quickFilter: 'vendorFollowUp' })} tone="sky" />
        <WorkbenchSummaryCard label="External Coordination Needed" value={summary.externalNeeded} detail="Manual or agency path" active={filters.quickFilter === 'externalNeeded'} onClick={() => setFilters({ ...filters, quickFilter: 'externalNeeded' })} tone="yellow" />
        <WorkbenchSummaryCard label="Ready for Verification" value={summary.readyForVerification} detail="Evidence ready" active={filters.quickFilter === 'readyVerification'} onClick={() => setFilters({ ...filters, quickFilter: 'readyVerification' })} tone="sky" />
        <WorkbenchSummaryCard label="Verified Closed" value={summary.verifiedClosed} detail="Closure accepted" active={filters.quickFilter === 'verifiedClosed'} onClick={() => setFilters({ ...filters, quickFilter: 'verifiedClosed' })} tone="blue" />
        <WorkbenchSummaryCard label="Risk Downgrade Eligible" value={summary.downgradeEligible} detail="Ready to lower risk" active={filters.quickFilter === 'downgradeEligible'} onClick={() => setFilters({ ...filters, quickFilter: 'downgradeEligible' })} tone="green" />
      </section>

      <section className="remediation-grid">
        <section className="remediation-card wide workbench-table-card">
          <div className="remediation-directory-header"><div><p className="remediation-eyebrow">Accountable action queue</p><h2>Main action table</h2></div><strong>{filteredActions.length} actions</strong></div>
          <WorkbenchFiltersPanel filters={filters} options={options} onChange={setFilters} />
          <WorkbenchActionTable actions={filteredActions} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
        <section className="remediation-card workbench-readiness-card">
          <CardHeading eyebrow="Closure readiness" title="Verification requirements" pill={`${summary.readyForVerification} READY`} tone={summary.readyForVerification ? 'ready' : 'watch'} />
          <ClosureReadinessPanel actions={actions} />
        </section>
        <section className="remediation-card workbench-pipeline-card">
          <CardHeading eyebrow="Risk closure pipeline" title="New → Verified Closed" />
          <RiskClosurePipeline rows={pipeline} />
        </section>
      </section>

      {selectedAction ? <WorkbenchDetailDrawer action={selectedAction} onClose={() => setSelectedId(null)} onUpdate={updateAction} onToggleEvidence={toggleEvidence} /> : null}
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

function WorkbenchSummaryCard({ label, value, detail, active, tone, onClick }: { label: string; value: number; detail: string; active: boolean; tone: 'blue' | 'yellow' | 'sky' | 'critical' | 'green'; onClick: () => void }) {
  return <button className={active ? `workbench-summary-card tone-${tone} active` : `workbench-summary-card tone-${tone}`} type="button" onClick={onClick} aria-pressed={active}><span>{label}</span><strong>{formatNumber(value)}</strong><small>{detail}</small></button>;
}

function WorkbenchFiltersPanel({ filters, options, onChange }: { filters: WorkbenchFilters; options: { stores: string[]; markets: string[]; riskTiers: string[]; sourceModules: string[]; issueTypes: string[]; priorities: string[]; statuses: string[]; owners: string[]; vendors: string[] }; onChange: (filters: WorkbenchFilters) => void }) {
  const update = (patch: Partial<WorkbenchFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="workbench-filter-panel" aria-label="Evidence-to-Action filters">
      <input type="search" value={filters.search} onChange={(event) => update({ search: event.target.value })} placeholder="Search store, issue, action, owner, vendor, evidence, next step, notes..." />
      <select value={filters.store} onChange={(event) => update({ store: event.target.value })}><option value="all">All stores</option>{options.stores.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.market} onChange={(event) => update({ market: event.target.value })}><option value="all">All markets</option>{options.markets.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.riskTier} onChange={(event) => update({ riskTier: event.target.value })}><option value="all">All risk tiers</option>{options.riskTiers.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.sourceModule} onChange={(event) => update({ sourceModule: event.target.value })}><option value="all">All source modules</option>{options.sourceModules.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.issueType} onChange={(event) => update({ issueType: event.target.value })}><option value="all">All issue types</option>{options.issueTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.priority} onChange={(event) => update({ priority: event.target.value })}><option value="all">All priorities</option>{options.priorities.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.status} onChange={(event) => update({ status: event.target.value })}><option value="all">All statuses</option>{options.statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.owner} onChange={(event) => update({ owner: event.target.value })}><option value="all">All owners</option>{options.owners.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={filters.vendor} onChange={(event) => update({ vendor: event.target.value })}><option value="all">All vendors / external parties</option>{options.vendors.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <input type="date" value={filters.dueDate} onChange={(event) => update({ dueDate: event.target.value })} aria-label="Filter by due date" />
      <button type="button" onClick={() => onChange({ search: '', store: 'all', market: 'all', riskTier: 'all', sourceModule: 'all', issueType: 'all', priority: 'all', status: 'all', owner: 'all', vendor: 'all', dueDate: '', quickFilter: 'all' })}>Reset filters</button>
    </div>
  );
}

function WorkbenchActionTable({ actions, selectedId, onSelect }: { actions: EvidenceAction[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <div className="remediation-table-wrap workbench-table-wrap"><table className="remediation-table workbench-table"><thead><tr><th>Priority</th><th>Store/Facility</th><th>Risk Tier</th><th>Source Module</th><th>Issue Type</th><th>Risk Finding</th><th>Action Summary</th><th>Recommended Owner</th><th>Assigned Owner</th><th>Vendor/External Party</th><th>Due Date</th><th>Status</th><th>Evidence Needed</th><th>Evidence Received</th><th>Closure Confidence</th><th>Risk Downgrade Eligibility</th><th>Next Step</th><th>Action</th></tr></thead><tbody>{actions.map((action) => { const eligibility = getRiskDowngradeEligibility(action); const evidencePercent = getEvidencePercent(action); return <tr key={action.id} className={`${isWorkbenchOverdue(action) ? 'is-overdue' : ''} ${selectedId === action.id ? 'is-selected' : ''}`}><td><span className={`remediation-priority priority-${action.priority.toLowerCase()}`}>{action.priority}</span></td><td><strong>{action.storeFacility}</strong><small>{action.market}</small></td><td><StatusPill label={action.riskTier} tone={riskTierTone(action.riskTier)} /></td><td>{action.sourceModule}</td><td>{action.issueType}</td><td><strong>{action.riskFinding}</strong></td><td>{action.actionSummary}</td><td>{action.recommendedOwner}</td><td>{action.assignedOwner || <span className="workbench-warning-text">Owner needed</span>}</td><td>{action.vendorExternalParty}<small>{action.vendorContacted ? 'Contacted' : 'Follow-up needed'}</small></td><td>{formatDate(action.dueDate)}<small>{isWorkbenchOverdue(action) ? 'Overdue' : 'Open target'}</small></td><td><StatusPill label={action.status} tone={workbenchStatusTone(action.status)} /></td><td>{action.evidenceChecklist.map((check) => check.label).join(', ')}</td><td><strong>{evidencePercent}%</strong><small>{action.evidenceChecklist.filter((check) => check.received).length} of {action.evidenceChecklist.length}</small></td><td>{action.closureConfidence}%</td><td><StatusPill label={eligibility} tone={downgradeTone(eligibility)} /></td><td>{action.nextStep}</td><td><button className="workbench-row-button" type="button" onClick={() => onSelect(action.id)}>Open detail</button></td></tr>; })}</tbody></table>{actions.length === 0 ? <p className="remediation-empty">No evidence-backed actions match the current filters.</p> : null}</div>;
}

function WorkbenchDetailDrawer({ action, onClose, onUpdate, onToggleEvidence }: { action: EvidenceAction; onClose: () => void; onUpdate: (id: string, patch: Partial<EvidenceAction>) => void; onToggleEvidence: (id: string, evidenceId: string) => void }) {
  const eligibility = getRiskDowngradeEligibility(action);
  const readiness = getClosureReadiness(action);
  return (
    <aside className="workbench-drawer" aria-label="Action detail drawer">
      <div className="workbench-drawer-panel">
        <div className="remediation-directory-header"><div><p className="remediation-eyebrow">Row detail</p><h2>{action.storeFacility} · {action.issueType}</h2></div><button type="button" onClick={onClose}>Close</button></div>
        <div className="workbench-detail-grid">
          <Metric label="Closure confidence" value={`${action.closureConfidence}%`} helper="Calculated from owner, due date, evidence, next step, and verification" />
          <Metric label="Evidence completion" value={`${getEvidencePercent(action)}%`} helper={`${action.evidenceChecklist.filter((check) => check.received).length} of ${action.evidenceChecklist.length} evidence items received`} />
          <Metric label="Downgrade eligibility" value={eligibility} helper="Risk downgrade gate" />
        </div>
        <label>Assigned Owner<select value={action.assignedOwner} onChange={(event) => onUpdate(action.id, { assignedOwner: event.target.value })}><option value="">Owner needed</option><option value={action.recommendedOwner}>{action.recommendedOwner}</option><option value="Technical Controls">Technical Controls</option><option value="Security Operations">Security Operations</option><option value="FPI Governance">FPI Governance</option><option value="Vendor Manager">Vendor Manager</option><option value="Store / Field Ops">Store / Field Ops</option></select></label>
        <label>Status<select value={action.status} onChange={(event) => onUpdate(action.id, { status: event.target.value as WorkbenchStatus })}>{workbenchStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label>Due Date<input type="date" value={action.dueDate} onChange={(event) => onUpdate(action.id, { dueDate: event.target.value })} /></label>
        <label>Next Step<textarea rows={3} value={action.nextStep} onChange={(event) => onUpdate(action.id, { nextStep: event.target.value })} /></label>
        <label>Notes<textarea rows={4} value={action.notes} onChange={(event) => onUpdate(action.id, { notes: event.target.value })} placeholder="Add closure notes, vendor updates, verification details..." /></label>
        <div className="workbench-evidence-checklist"><strong>Evidence checklist</strong>{action.evidenceChecklist.map((check) => <label key={check.id}><input type="checkbox" checked={check.received} onChange={() => onToggleEvidence(action.id, check.id)} /> {check.label}</label>)}</div>
        <div className="workbench-readiness-gates">{readiness.gates.map((gate) => <span className={gate.ready ? 'ready' : 'blocked'} key={gate.label}>{gate.ready ? '✓' : '!'} {gate.label}</span>)}</div>
        <div className="workbench-drawer-actions">
          <button type="button" onClick={() => onUpdate(action.id, { vendorContacted: true, notes: appendNote(action.notes, 'Vendor/external party contacted from workbench.') })}>Mark vendor contacted</button>
          <button type="button" onClick={() => onUpdate(action.id, { escalated: true, notes: appendNote(action.notes, 'Escalated for leadership review.') })}>Escalate</button>
          <button type="button" onClick={() => onUpdate(action.id, { status: 'Ready for Verification' })}>Mark ready for verification</button>
          <button type="button" onClick={() => onUpdate(action.id, { status: 'Verified Closed' })}>Mark verified closed</button>
        </div>
      </div>
    </aside>
  );
}

function ClosureReadinessPanel({ actions }: { actions: EvidenceAction[] }) {
  const average = actions.length ? Math.round(actions.reduce((sum, action) => sum + action.closureConfidence, 0) / actions.length) : 0;
  const ownerReady = actions.filter((action) => Boolean(action.assignedOwner)).length;
  const evidenceReady = actions.filter((action) => getEvidencePercent(action) === 100).length;
  const verificationReady = actions.filter((action) => action.status === 'Ready for Verification' || action.status === 'Verified Closed').length;
  return <div className="workbench-readiness-list"><Metric label="Average readiness" value={`${average}%`} helper="Across filtered action population" /><Metric label="Owner assigned" value={`${ownerReady}/${actions.length}`} helper="Assigned owner present" /><Metric label="Evidence complete" value={`${evidenceReady}/${actions.length}`} helper="All checklist items received" /><Metric label="Verification gate" value={`${verificationReady}/${actions.length}`} helper="Ready or verified closed" /><p>Closure readiness requires assigned owner, due date, completed evidence checklist, documented next step, and verification status before a finding can be considered for risk downgrade.</p></div>;
}

function RiskClosurePipeline({ rows }: { rows: Array<{ status: WorkbenchStatus; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <div className="workbench-pipeline">{rows.map((row) => <div key={row.status}><div><span>{row.status}</span><strong>{formatNumber(row.count)}</strong></div><i style={{ width: `${Math.max(5, (row.count / max) * 100)}%` }} /></div>)}</div>;
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

const workbenchStatuses: WorkbenchStatus[] = ['New', 'Assigned', 'Evidence Requested', 'Evidence Received', 'Ready for Verification', 'Verified Closed'];

function buildEvidenceActions(items: RemediationItem[]): EvidenceAction[] {
  return items.slice(0, 36).map((item, index) => normalizeEvidenceAction({
    id: `eta-${item.remediationId}`,
    priority: item.priority,
    storeFacility: item.facilityAlias,
    market: item.region,
    riskTier: riskTierFor(item),
    sourceModule: sourceModuleFor(item),
    issueType: item.category,
    riskFinding: item.title,
    actionSummary: item.recommendedAction,
    recommendedOwner: item.ownerTeam,
    assignedOwner: index % 7 === 0 ? '' : item.ownerTeam,
    vendorExternalParty: vendorFor(item),
    dueDate: item.dueAt.slice(0, 10),
    status: workbenchStatusFor(item),
    evidenceChecklist: item.evidenceChecklist.map((label, evidenceIndex) => ({ id: `${item.remediationId}-${evidenceIndex}`, label, received: item.evidenceStatus === 'Verified' || item.evidenceStatus === 'Received' || (item.evidenceStatus === 'Pending Verification' && evidenceIndex < Math.max(1, item.evidenceChecklist.length - 1)) })),
    closureConfidence: 0,
    nextStep: item.nextStep || item.recommendedAction,
    notes: `Drafted from ${item.sourceService}. Source finding: ${item.sourceFindingId}. ${item.description}`,
    vendorContacted: item.status === 'In Progress' || item.status === 'Pending Verification' || index % 4 === 0,
    escalated: item.priority === 'P1' || item.status === 'Blocked',
  }));
}

function normalizeEvidenceAction(action: EvidenceAction): EvidenceAction {
  return { ...action, closureConfidence: getClosureReadiness(action).score };
}

function getWorkbenchSummary(actions: EvidenceAction[]) {
  return {
    openActions: actions.filter((action) => action.status !== 'Verified Closed').length,
    overdue: actions.filter(isWorkbenchOverdue).length,
    missingEvidence: actions.filter((action) => getEvidencePercent(action) < 100).length,
    ownerNeeded: actions.filter((action) => !action.assignedOwner).length,
    vendorFollowUps: actions.filter((action) => action.vendorExternalParty !== 'FPI Internal' && action.status !== 'Verified Closed').length,
    externalNeeded: actions.filter((action) => isExternalCoordinationNeeded(action)).length,
    readyForVerification: actions.filter((action) => action.status === 'Ready for Verification').length,
    verifiedClosed: actions.filter((action) => action.status === 'Verified Closed').length,
    downgradeEligible: actions.filter((action) => getRiskDowngradeEligibility(action) === 'Eligible for Downgrade').length,
  };
}

function filterEvidenceActions(actions: EvidenceAction[], filters: WorkbenchFilters): EvidenceAction[] {
  const term = filters.search.trim().toLowerCase();
  return actions.filter((action) => {
    const eligibility = getRiskDowngradeEligibility(action);
    const searchable = [action.storeFacility, action.market, action.issueType, action.riskFinding, action.actionSummary, action.recommendedOwner, action.assignedOwner, action.vendorExternalParty, action.evidenceChecklist.map((check) => check.label).join(' '), action.nextStep, action.notes].join(' ').toLowerCase();
    return (!term || searchable.includes(term))
      && (filters.store === 'all' || action.storeFacility === filters.store)
      && (filters.market === 'all' || action.market === filters.market)
      && (filters.riskTier === 'all' || action.riskTier === filters.riskTier)
      && (filters.sourceModule === 'all' || action.sourceModule === filters.sourceModule)
      && (filters.issueType === 'all' || action.issueType === filters.issueType)
      && (filters.priority === 'all' || action.priority === filters.priority)
      && (filters.status === 'all' || action.status === filters.status)
      && (filters.owner === 'all' || action.assignedOwner === filters.owner || action.recommendedOwner === filters.owner)
      && (filters.vendor === 'all' || action.vendorExternalParty === filters.vendor)
      && (!filters.dueDate || action.dueDate === filters.dueDate)
      && quickFilterMatches(action, filters.quickFilter, eligibility);
  }).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.dueDate.localeCompare(b.dueDate));
}

function quickFilterMatches(action: EvidenceAction, quickFilter: WorkbenchQuickFilter, eligibility: RiskDowngradeEligibility): boolean {
  if (quickFilter === 'overdue') return isWorkbenchOverdue(action);
  if (quickFilter === 'missingEvidence') return getEvidencePercent(action) < 100;
  if (quickFilter === 'ownerNeeded') return !action.assignedOwner;
  if (quickFilter === 'vendorFollowUp') return action.vendorExternalParty !== 'FPI Internal' && action.status !== 'Verified Closed';
  if (quickFilter === 'externalNeeded') return isExternalCoordinationNeeded(action);
  if (quickFilter === 'readyVerification') return action.status === 'Ready for Verification';
  if (quickFilter === 'verifiedClosed') return action.status === 'Verified Closed';
  if (quickFilter === 'downgradeEligible') return eligibility === 'Eligible for Downgrade';
  return true;
}

function getClosureReadiness(action: EvidenceAction) {
  const gates = [
    { label: 'Owner assigned', ready: Boolean(action.assignedOwner) },
    { label: 'Due date set', ready: Boolean(action.dueDate) },
    { label: 'Evidence complete', ready: getEvidencePercent(action) === 100 },
    { label: 'Next step documented', ready: Boolean(action.nextStep.trim()) },
    { label: 'Verification status', ready: action.status === 'Ready for Verification' || action.status === 'Verified Closed' },
  ];
  return { gates, score: Math.round((gates.filter((gate) => gate.ready).length / gates.length) * 100) };
}

function getRiskDowngradeEligibility(action: EvidenceAction): RiskDowngradeEligibility {
  if (action.status === 'Verified Closed') return 'Downgraded/Closed';
  if (!action.assignedOwner) return 'Owner Needed';
  if (getEvidencePercent(action) < 100) return 'Evidence Incomplete';
  if (!action.dueDate || !action.nextStep.trim()) return 'Not Eligible';
  if (action.status !== 'Ready for Verification') return 'Pending Verification';
  return 'Eligible for Downgrade';
}

function getClosurePipeline(actions: EvidenceAction[]): Array<{ status: WorkbenchStatus; count: number }> {
  return workbenchStatuses.map((status) => ({ status, count: actions.filter((action) => action.status === status).length }));
}

function getEvidencePercent(action: EvidenceAction): number {
  if (!action.evidenceChecklist.length) return 100;
  return Math.round((action.evidenceChecklist.filter((check) => check.received).length / action.evidenceChecklist.length) * 100);
}

function isWorkbenchOverdue(action: EvidenceAction): boolean {
  return action.status !== 'Verified Closed' && action.dueDate < '2026-05-05';
}

function sourceModuleFor(item: RemediationItem): string {
  if (item.sourceService.includes('Camera')) return item.category.includes('Access') || item.category.includes('LPR') ? 'Camera / Technical Controls' : 'Camera / Technical Controls';
  if (item.category === 'Network / Security Device') return 'Device Posture';
  if (item.category === 'Source Freshness') return 'Controls Governance';
  return 'Risk Intelligence';
}

function riskTierFor(item: RemediationItem): string {
  if (item.severity === 'Critical') return 'Critical';
  if (item.severity === 'High') return 'High';
  if (item.severity === 'Medium') return 'Moderate';
  return 'Low';
}

function vendorFor(item: RemediationItem): string {
  if (item.channel === 'ServiceChannel') return 'CCTV service vendor';
  if (item.channel === 'Security Engineering') return 'Security engineering / device vendor';
  if (item.channel === 'Manual Coordination') return 'External Coordination';
  if (item.channel === 'Me@Walmart') return 'Store / Field Ops';
  return 'FPI Internal';
}

function workbenchStatusFor(item: RemediationItem): WorkbenchStatus {
  if (item.status === 'Verified Complete') return 'Verified Closed';
  if (item.status === 'Pending Verification') return 'Ready for Verification';
  if (item.evidenceStatus === 'Received') return 'Evidence Received';
  if (item.evidenceRequired && (item.status === 'Assigned' || item.status === 'In Progress')) return 'Evidence Requested';
  if (item.status === 'Assigned' || item.status === 'In Progress' || item.status === 'Blocked') return 'Assigned';
  return 'New';
}

function isExternalCoordinationNeeded(action: EvidenceAction): boolean {
  return action.vendorExternalParty === 'External Coordination' || action.issueType.includes('Access') || action.issueType.includes('LPR') || action.escalated;
}

function appendNote(existing: string, note: string): string {
  return `${existing}${existing ? '\n' : ''}${new Date().toISOString().slice(0, 10)}: ${note}`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function riskTierTone(tier: string): StatusTone {
  if (tier === 'Critical') return 'critical';
  if (tier === 'High' || tier === 'Moderate') return 'watch';
  return 'stable';
}

function workbenchStatusTone(status: WorkbenchStatus): StatusTone {
  if (status === 'Verified Closed') return 'ready';
  if (status === 'Ready for Verification' || status === 'Evidence Received') return 'watch';
  if (status === 'New' || status === 'Evidence Requested') return 'stable';
  return 'watch';
}

function downgradeTone(eligibility: RiskDowngradeEligibility): StatusTone {
  if (eligibility === 'Downgraded/Closed' || eligibility === 'Eligible for Downgrade') return 'ready';
  if (eligibility === 'Owner Needed' || eligibility === 'Evidence Incomplete') return 'critical';
  return 'watch';
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
