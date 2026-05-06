import { useMemo, useState } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyThreatRiskScope } from '../../data/threatRiskScope';
import { formatNumber, formatScore, getCoordinationCandidates, getSeverityTone, getTierTone, getTopRiskFacilities, getTopThreatSignals } from '../../data/threatRiskSelectors';
import type { ThreatBestPractice, ThreatRiskData, ThreatRiskFacility, ThreatRiskSignal, ThreatRiskSource } from '../../data/threatRiskTypes';
import { useThreatRiskData } from '../../data/useThreatRiskData';

export type ThreatDetectionRiskScoringViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type ThreatTab = 'overview' | 'leaderboard' | 'signals' | 'sources' | 'guidance' | 'model';

type DraftRequestType = 'RASA Review Request' | 'Security Technology Ticket' | 'Enterprise Governance Follow-Up' | 'Store Context Request' | 'External Coordination Prep';

type MockDraft = {
  id: string;
  sourceType: 'facility' | 'signal';
  sourceId: string;
  facilityId: string;
  facilityName: string;
  priority: 'P1' | 'P2' | 'P3';
  requestType: DraftRequestType;
  owner: string;
  subject: string;
  summary: string;
  whyItMatters: string[];
  recommendedAction: string;
  evidenceNeeded: string[];
  requestedResponse: string;
  status: 'Draft';
  mode: 'Mock Only';
};

const tabs: Array<{ id: ThreatTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'Risk' },
  { id: 'leaderboard', label: 'Priority Facilities', eyebrow: 'Triage' },
  { id: 'signals', label: 'Incident Intelligence', eyebrow: 'Incidents' },
  { id: 'sources', label: 'Protection Signals', eyebrow: 'Inputs' },
  { id: 'guidance', label: 'Collaboration', eyebrow: 'Teams' },
  { id: 'model', label: 'Risk Model', eyebrow: 'Governance' },
];

const collaborationLanes = [
  {
    team: 'RASA / Risk Intelligence',
    purpose: 'Validate incident patterns, repeat-location behavior, and escalation needs before leadership review.',
    actions: ['Review severe incident pattern', 'Confirm repeat-facility driver', 'Recommend escalation path'],
  },
  {
    team: 'Security Technology',
    purpose: 'Confirm whether cameras, panels, access controls, or network health may affect protection readiness.',
    actions: ['Check camera and recorder health', 'Review device coverage gaps', 'Confirm remediation status'],
  },
  {
    team: 'Enterprise / Program Governance',
    purpose: 'Coordinate ownership, evidence quality, SLA risk, and executive reporting for elevated facilities.',
    actions: ['Confirm accountable owner', 'Review open action burden', 'Prepare leadership brief'],
  },
  {
    team: 'Store-Facing Partners',
    purpose: 'Provide local operating context and confirm whether mitigation actions are practical for the facility.',
    actions: ['Confirm store conditions', 'Validate associate/customer impact', 'Provide follow-up context'],
  },
];

export function ThreatDetectionRiskScoringView({ fireSites, storeScope, onChangeScopeRequest }: ThreatDetectionRiskScoringViewProps) {
  const [activeTab, setActiveTab] = useState<ThreatTab>('overview');
  const threatState = useThreatRiskData();
  const scopedThreatData = useMemo(() => (threatState.data ? applyThreatRiskScope(threatState.data, fireSites, storeScope) : null), [threatState.data, fireSites, storeScope]);

  return (
    <section className="threat-page" aria-label="Risk Intelligence">
      <header className="threat-header">
        <div>
          <p className="threat-eyebrow">FPI proactive facility risk intelligence</p>
          <h1>Risk Intelligence</h1>
          <p>Convert incidents, protection signals, technology health, life-safety exceptions, remediation work, and field context into a proactive facility risk view that helps teams see what changed, who should act, and what evidence is needed next.</p>
        </div>
        <div className="threat-mode"><span>MODE</span>FPI INTELLIGENCE</div>
      </header>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {threatState.loading ? <StatePanel title="Loading risk intelligence dataset" message="Preparing facility risk, incident intelligence, protection signals, collaboration lanes, and best-practice references." /> : null}
      {threatState.error ? <StatePanel title="Risk intelligence dataset unavailable" message={threatState.error} danger /> : null}

      {scopedThreatData ? (
        <>
          <nav className="threat-tab-bar" aria-label="Risk Intelligence sub tabs">
            {tabs.map((tab) => (
              <button className={activeTab === tab.id ? 'threat-tab active' : 'threat-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}>
                <span>{tab.eyebrow}</span>{tab.label}
              </button>
            ))}
          </nav>
          {activeTab === 'overview' ? <ThreatOverview data={scopedThreatData} /> : null}
          {activeTab === 'leaderboard' ? <RiskLeaderboard facilities={scopedThreatData.facilities} /> : null}
          {activeTab === 'signals' ? <ThreatSignals data={scopedThreatData} /> : null}
          {activeTab === 'sources' ? <SourceIntelligence sources={scopedThreatData.sources} /> : null}
          {activeTab === 'guidance' ? <CollaborationHub practices={scopedThreatData.bestPractices} /> : null}
          {activeTab === 'model' ? <ScoringModel data={scopedThreatData} /> : null}
        </>
      ) : null}
    </section>
  );
}

function ThreatOverview({ data }: { data: ThreatRiskData }) {
  const [selectedDraft, setSelectedDraft] = useState<MockDraft | null>(null);
  const topFacilities = getTopRiskFacilities(data.facilities, 5);
  const topSignals = getTopThreatSignals(data.signals, 6);
  const coordinationCandidates = getCoordinationCandidates(data.facilities);
  const actionQueue = getProactiveActionQueue(data.facilities, 6);

  return (
    <>
      <section className="threat-kpi-grid" aria-label="Risk Intelligence KPIs">
        <Kpi label="Facilities requiring review" value={formatNumber(data.summary.criticalFacilities + data.summary.highFacilities)} detail="Critical/high FPI posture" tone="critical" />
        <Kpi label="Severe incident signals" value={formatNumber(data.summary.severeSignals)} detail="Modeled from available incident intelligence" tone="yellow" />
        <Kpi label="Protection signals" value={formatNumber(data.summary.threatSignals)} detail="Incident, technology, life-safety, and action signals" tone="sky" />
        <Kpi label="Open protection actions" value={formatNumber(data.summary.openThreatTasks)} detail="Critical/high work needing ownership" tone="yellow" />
      </section>

      <section className="threat-focus-strip" aria-label="Risk intelligence operating flow">
        <article><span>01</span><strong>Ingest</strong><small>Incident intelligence, technology health, life-safety, remediation, and field context normalize into a facility view.</small></article>
        <article><span>02</span><strong>Prioritize</strong><small>Explainable scoring highlights the facilities, drivers, and evidence gaps that need review first.</small></article>
        <article><span>03</span><strong>Coordinate</strong><small>Recommended actions route work to RASA, Security Technology, Enterprise partners, and store-facing teams.</small></article>
      </section>

      <section className="threat-grid">
        <section className="threat-card wide"><CardHeading eyebrow="Proactive triage" title="Recommended action queue" pill="NEXT BEST ACTION" tone="watch" /><ActionQueue facilities={actionQueue} onCreateDraft={(facility) => setSelectedDraft(createMockDraftFromFacility(facility))} /></section>
        <section className="threat-card wide"><CardHeading eyebrow="Mock workflow" title="Communication & Ticket Drafting" pill="DRAFT ONLY" tone="stable" /><p>Generate a structured mock draft from a tracked facility. Use it to align RASA, Security Technology, Enterprise partners, and store-facing teams on next steps. Drafts are mock-only and do not send messages or create production tickets.</p><MockDraftPanel draft={selectedDraft} onClear={() => setSelectedDraft(null)} /></section>
        <section className="threat-card wide"><CardHeading eyebrow="Priority facilities" title="Facility risk leaderboard" pill="EXPLAINABLE" tone="watch" /><RiskList facilities={topFacilities} /></section>
        <section className="threat-card"><CardHeading eyebrow="Incident intelligence" title="Top protection signals" /><SignalList signals={topSignals} />
        </section>
        <section className="threat-card"><CardHeading eyebrow="Collaboration needed" title="Facilities needing coordinated follow-up" /><div className="threat-record-list">{coordinationCandidates.map((facility) => <article className="threat-record" key={facility.facilityId}><strong>Store {facility.facilityId} · {facility.riskTier}</strong><span>{facility.city}, {facility.state} · {facility.topDriver}</span><small>{facility.recommendedAction}</small></article>)}</div></section>
        <section className="threat-card wide"><CardHeading eyebrow="Governance note" title="Risk Intelligence is a prioritization and coordination aid" pill="CONTROLLED" tone="critical" /><p>{data.metadata.governanceNote}</p><div className="threat-metric-grid"><Metric label="Review queue" value={formatNumber(actionQueue.length)} helper="Highest-priority action candidates surfaced first" /><Metric label="Collaboration candidates" value={formatNumber(coordinationCandidates.length)} helper="Cross-team review recommended" /><Metric label="Data mode" value={data.metadata.dataMode} helper={data.metadata.classification} /><Metric label="Action posture" value="Coordinate" helper="Use evidence and owner lanes before escalation" /></div></section>
      </section>
    </>
  );
}

function getProactiveActionQueue(facilities: ThreatRiskFacility[], limit: number): ThreatRiskFacility[] {
  return [...facilities]
    .sort((a, b) => (b.criticalTaskCount + b.severeIncidentCount + b.technicalIssueCount + b.fireTroubleCount) - (a.criticalTaskCount + a.severeIncidentCount + a.technicalIssueCount + a.fireTroubleCount))
    .slice(0, limit);
}

function ownerForFacility(facility: ThreatRiskFacility): string {
  if (facility.severeIncidentCount >= 5) return 'RASA / Risk Intelligence';
  if (facility.technicalIssueCount >= 4) return 'Security Technology';
  if (facility.fireTroubleCount >= 2) return 'Enterprise / Life Safety';
  return 'Store-Facing Partners';
}

function evidenceListForFacility(facility: ThreatRiskFacility): string[] {
  const evidence = ['Incident summary'];
  if (facility.technicalIssueCount > 0) evidence.push('Device health');
  if (facility.fireTroubleCount > 0) evidence.push('Life-safety status');
  if (facility.openTaskCount > 0) evidence.push('Open actions');
  evidence.push('Store context');
  return evidence;
}

function evidenceForFacility(facility: ThreatRiskFacility): string {
  return evidenceListForFacility(facility).join(', ');
}

function priorityForFacility(facility: ThreatRiskFacility): 'P1' | 'P2' | 'P3' {
  if (facility.riskTier === 'Critical' || facility.severeIncidentCount >= 5 || facility.criticalTaskCount >= 3) return 'P1';
  if (facility.riskTier === 'High' || facility.technicalIssueCount > 0 || facility.fireTroubleCount > 0) return 'P2';
  return 'P3';
}

function requestTypeForFacility(facility: ThreatRiskFacility): DraftRequestType {
  if (facility.severeIncidentCount >= 5) return 'RASA Review Request';
  if (facility.technicalIssueCount >= 4) return 'Security Technology Ticket';
  if (facility.fireTroubleCount >= 2) return 'Enterprise Governance Follow-Up';
  if (facility.riskTier === 'Critical') return 'External Coordination Prep';
  return 'Store Context Request';
}

function createMockDraftFromFacility(facility: ThreatRiskFacility): MockDraft {
  const priority = priorityForFacility(facility);
  const requestType = requestTypeForFacility(facility);
  const owner = ownerForFacility(facility);
  return {
    id: `draft-${facility.facilityId}-${requestType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    sourceType: 'facility',
    sourceId: facility.facilityId,
    facilityId: facility.facilityId,
    facilityName: facility.facilityName,
    priority,
    requestType,
    owner,
    subject: `${priority} FPI Risk Intelligence Review Needed — Store ${facility.facilityId}`,
    summary: `Risk Intelligence surfaced Store ${facility.facilityId} (${facility.facilityName}) as ${facility.riskTier} based on current incident activity, protection signals, technical-control health, life-safety exceptions, and open action burden.`,
    whyItMatters: [
      `${formatNumber(facility.incidentCount)} tracked incident signals, including ${formatNumber(facility.severeIncidentCount)} severe`,
      `${formatNumber(facility.criticalTaskCount)} critical tasks and ${formatNumber(facility.openTaskCount)} total open actions`,
      `${formatNumber(facility.technicalIssueCount)} technical-control gaps and ${formatNumber(facility.fireTroubleCount)} life-safety exceptions`,
      facility.topDriver,
    ],
    recommendedAction: facility.recommendedAction,
    evidenceNeeded: evidenceListForFacility(facility),
    requestedResponse: 'Please review the listed evidence and provide disposition, accountable owner, mitigation status, and any recommended escalation path. This draft is for coordination only until an approved workflow integration is available.',
    status: 'Draft',
    mode: 'Mock Only',
  };
}

function priorityForSignal(signal: ThreatRiskSignal): 'P1' | 'P2' | 'P3' {
  if (signal.severity === 'Critical' || signal.riskContribution >= 8) return 'P1';
  if (signal.severity === 'High' || signal.riskContribution >= 5) return 'P2';
  return 'P3';
}

function requestTypeForSignal(signal: ThreatRiskSignal): DraftRequestType {
  if (signal.category === 'Technology Gap' || signal.category === 'Access Control') return 'Security Technology Ticket';
  if (signal.category === 'Fire/Life Safety') return 'Enterprise Governance Follow-Up';
  if (signal.category === 'External Coordination' || signal.category === 'Weapon' || signal.category === 'Violence') return 'RASA Review Request';
  if (signal.category === 'Vendor') return 'External Coordination Prep';
  return 'Store Context Request';
}

function ownerForSignal(signal: ThreatRiskSignal): string {
  const requestType = requestTypeForSignal(signal);
  if (requestType === 'Security Technology Ticket') return 'Security Technology';
  if (requestType === 'Enterprise Governance Follow-Up') return 'Enterprise / Life Safety';
  if (requestType === 'RASA Review Request') return 'RASA / Risk Intelligence';
  if (requestType === 'External Coordination Prep') return 'Enterprise / Program Governance';
  return 'Store-Facing Partners';
}

function evidenceListForSignal(signal: ThreatRiskSignal): string[] {
  const evidence = ['Signal summary', 'Incident context', 'Store context'];
  signal.sourceIds.forEach((source) => evidence.push(sourceLabel(source)));
  signal.bestPracticeRefs.forEach((ref) => evidence.push(ref));
  return Array.from(new Set(evidence));
}

function createMockDraftFromSignal(signal: ThreatRiskSignal): MockDraft {
  const priority = priorityForSignal(signal);
  const requestType = requestTypeForSignal(signal);
  const owner = ownerForSignal(signal);
  return {
    id: `draft-${signal.id}-${requestType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    sourceType: 'signal',
    sourceId: signal.id,
    facilityId: signal.facilityId,
    facilityName: signal.facilityName,
    priority,
    requestType,
    owner,
    subject: `${priority} ${signal.signalType} Review Needed — Store ${signal.facilityId}`,
    summary: `Risk Intelligence surfaced a ${signal.severity.toLowerCase()} ${signal.category.toLowerCase()} signal for Store ${signal.facilityId} (${signal.facilityName}) with +${signal.riskContribution} modeled risk contribution.`,
    whyItMatters: [
      signal.summary,
      `${signal.severity} severity with ${signal.confidence.toLowerCase()} confidence`,
      `Category: ${signal.category}`,
      `Source context: ${signal.sourceIds.map((source) => sourceLabel(source)).join(', ')}`,
    ],
    recommendedAction: signal.recommendedAction,
    evidenceNeeded: evidenceListForSignal(signal),
    requestedResponse: 'Please review the signal context and provide disposition, validation notes, accountable owner, and mitigation status. This draft is for coordination only until an approved workflow integration is available.',
    status: 'Draft',
    mode: 'Mock Only',
  };
}

function ActionQueue({ facilities, onCreateDraft }: { facilities: ThreatRiskFacility[]; onCreateDraft: (facility: ThreatRiskFacility) => void }) {
  return <div className="threat-table-wrap"><table className="threat-table"><thead><tr><th>Priority</th><th>Facility</th><th>Why it matters</th><th>Recommended owner</th><th>Next action</th><th>Evidence needed</th><th>Mock workflow</th></tr></thead><tbody>{facilities.map((facility) => { const priority = priorityForFacility(facility); return <tr key={facility.facilityId}><td><StatusPill label={priority} tone={priority === 'P1' ? 'critical' : priority === 'P2' ? 'watch' : 'stable'} /></td><td><strong>Store {facility.facilityId}</strong><small>{facility.city}, {facility.state} · {facility.riskTier}</small></td><td>{facility.topDriver}<small>{facility.drivers.slice(0, 2).join(' · ')}</small></td><td>{ownerForFacility(facility)}</td><td>{facility.recommendedAction}</td><td>{evidenceForFacility(facility)}</td><td><button className="threat-action-button" type="button" onClick={() => onCreateDraft(facility)}>Create Draft</button></td></tr>; })}</tbody></table></div>;
}

function MockDraftPanel({ draft, onClear }: { draft: MockDraft | null; onClear: () => void }) {
  if (!draft) {
    return <div className="threat-draft-empty"><strong>No draft selected</strong><p>Select <b>Create Draft</b> from a facility or signal to generate a mock communication or ticket draft. No production workflow will be triggered.</p></div>;
  }

  return <article className="threat-draft-panel" aria-live="polite"><div className="threat-draft-header"><div><StatusPill label={draft.priority} tone={draft.priority === 'P1' ? 'critical' : draft.priority === 'P2' ? 'watch' : 'stable'} /><StatusPill label={draft.mode} tone="stable" /></div><button className="threat-action-button secondary" type="button" onClick={onClear}>Clear Draft</button></div><div className="threat-draft-grid"><div><span>Draft Type</span><strong>{draft.requestType}</strong></div><div><span>Recommended Owner</span><strong>{draft.owner}</strong></div><div><span>Status</span><strong>{draft.status}</strong></div><div><span>Source</span><strong>{draft.sourceType === 'signal' ? 'Signal' : 'Facility'} · Store {draft.facilityId}</strong><small>{draft.facilityName}</small></div></div><div className="threat-draft-body"><h3>{draft.subject}</h3><p>{draft.summary}</p><h4>Why this matters</h4><ul className="threat-note-list compact">{draft.whyItMatters.map((item) => <li key={item}>{item}</li>)}</ul><h4>Recommended next action</h4><p>{draft.recommendedAction}</p><h4>Evidence needed</h4><div className="threat-tags">{draft.evidenceNeeded.map((item) => <span key={item}>{item}</span>)}</div><h4>Requested response</h4><p>{draft.requestedResponse}</p></div><div className="threat-draft-actions"><button className="threat-action-button" type="button" disabled>Create Ticket — Mock Only</button><button className="threat-action-button" type="button" disabled>Send Communication — Mock Only</button><button className="threat-action-button secondary" type="button" disabled>Copy Draft — Coming Soon</button></div><p className="threat-draft-disclaimer">Draft only — no production communication is sent and no ticket is created.</p></article>;
}

function RiskLeaderboard({ facilities }: { facilities: ThreatRiskFacility[] }) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return facilities
      .filter((facility) => tier === 'all' || facility.riskTier === tier)
      .filter((facility) => !term || [facility.facilityId, facility.facilityName, facility.city, facility.state, facility.market, facility.region, facility.topDriver].join(' ').toLowerCase().includes(term))
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [facilities, search, tier]);

  return (
    <section className="threat-card">
      <div className="threat-directory-header"><div><p className="threat-eyebrow">Priority facilities</p><h2>Risk score, drivers, and recommended next action</h2></div><strong>{rows.length} facilities</strong></div>
      <div className="threat-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store, city, state, market, driver" /><select value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">All tiers</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
      <div className="threat-table-wrap"><table className="threat-table"><thead><tr><th>Facility</th><th>Score</th><th>Tier</th><th>Drivers</th><th>Incident signals</th><th>Controls</th><th>Recommended action</th></tr></thead><tbody>{rows.map((facility) => <FacilityRow facility={facility} key={facility.facilityId} />)}</tbody></table></div>
    </section>
  );
}

function ThreatSignals({ data }: { data: ThreatRiskData }) {
  const [category, setCategory] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState<MockDraft | null>(null);
  const categories = Array.from(new Set(data.signals.map((signal) => signal.category))).sort();
  const signals = useMemo(() => data.signals.filter((signal) => category === 'all' || signal.category === category).sort((a, b) => b.riskContribution - a.riskContribution), [data.signals, category]);

  return (
    <section className="threat-grid">
      <section className="threat-card wide"><div className="threat-directory-header"><div><p className="threat-eyebrow">Incident intelligence</p><h2>Signals requiring review or action</h2></div><strong>{signals.length} signals</strong></div><p>Use this feed to quickly ingest current incident-driven risk and determine where RASA, Security Technology, Enterprise, or store-facing teams should collaborate next.</p><div className="threat-filters"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></div><div className="threat-signal-feed">{signals.map((signal) => <SignalCard signal={signal} key={signal.id} onCreateDraft={(item) => setSelectedDraft(createMockDraftFromSignal(item))} />)}</div></section>
      <section className="threat-card wide"><CardHeading eyebrow="Mock workflow" title="Signal Communication & Ticket Draft" pill="DRAFT ONLY" tone="stable" /><p>Create a mock draft directly from an incident or protection signal. This preserves the tracked event context while making ownership, evidence, and requested response clear.</p><MockDraftPanel draft={selectedDraft} onClear={() => setSelectedDraft(null)} /></section>
      <section className="threat-card"><CardHeading eyebrow="Incident types" title="Top detected patterns" /><ChartRows rows={data.incidentTypeCounts} /></section>
      <section className="threat-card"><CardHeading eyebrow="Market concentration" title="Elevated facility concentration" /><ChartRows rows={data.marketRiskCounts} /></section>
    </section>
  );
}

function SourceIntelligence({ sources }: { sources: ThreatRiskSource[] }) {
  return <section className="threat-grid"><section className="threat-card wide"><CardHeading eyebrow="Protection signals" title="FPI signal sources and readiness" pill="SYNTHETIC / DEMO" tone="stable" /><p>Risk Intelligence combines available signals into one proactive operating view so users can review provided context instead of manually stitching together incident, device, life-safety, and action data.</p></section>{sources.map((source) => <section className="threat-card" key={source.sourceId}><CardHeading eyebrow={source.sourceType} title={source.sourceName} pill={source.integrationStatus.toUpperCase()} tone={source.integrationStatus === 'Loaded' ? 'ready' : source.integrationStatus === 'Reference Only' ? 'stable' : 'watch'} /><div className="threat-metric-grid single"><Metric label="Freshness" value={source.freshnessStatus} helper={`${source.confidence} confidence`} /><Metric label="Records loaded" value={formatNumber(source.recordsLoaded)} helper="Current demo context" /></div><p>{source.notes}</p></section>)}</section>;
}

function CollaborationHub({ practices }: { practices: ThreatBestPractice[] }) {
  return <section className="threat-grid"><section className="threat-card wide"><CardHeading eyebrow="Cross-team collaboration" title="Shared action lanes for elevated facilities" pill="FPI OPERATING MODEL" tone="watch" /><p>Use these lanes to move from intelligence to coordinated action. Each team gets a clear reason to engage, likely actions, and the evidence needed to reduce repeated manual follow-up.</p><div className="threat-focus-strip embedded">{collaborationLanes.map((lane, index) => <article key={lane.team}><span>{String(index + 1).padStart(2, '0')}</span><strong>{lane.team}</strong><small>{lane.purpose}</small><ul className="threat-note-list compact">{lane.actions.map((action) => <li key={action}>{action}</li>)}</ul></article>)}</div></section><BestPracticeGuidance practices={practices} /></section>;
}

function BestPracticeGuidance({ practices }: { practices: ThreatBestPractice[] }) {
  return <>{practices.map((practice) => <section className="threat-card" key={practice.id}><CardHeading eyebrow={practice.issuingBody} title={practice.title} pill="REFERENCE" tone="stable" /><p>{practice.guidanceSummary}</p><div className="threat-tags">{practice.appliesTo.map((item) => <span key={item}>{item}</span>)}</div><h3>Recommended actions</h3><ul className="threat-note-list">{practice.recommendedActions.map((action) => <li key={action}>{action}</li>)}</ul><h3>Evidence needed</h3><ul className="threat-note-list compact">{practice.evidenceNeeded.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</>;
}

function ScoringModel({ data }: { data: ThreatRiskData }) {
  return <section className="threat-grid"><section className="threat-card wide"><CardHeading eyebrow="Explainable model" title="How the FPI risk score is calculated" pill="0-100" tone="ready" /><p>The score is intended to help users prioritize review, not to make a formal threat determination. Each factor remains explainable so teams understand why a facility surfaced and what evidence should be checked next.</p><div className="threat-score-model">{data.scoringModel.map((factor) => <article key={factor.factor}><div><strong>{factor.factor}</strong><span>{factor.weight}%</span></div><p>{factor.description}</p><div><span style={{ width: `${factor.weight * 4}%` }} /></div></article>)}</div></section><section className="threat-card"><CardHeading eyebrow="Governance guardrails" title="Before production use" pill="REQUIRES APPROVAL" tone="critical" /><ul className="threat-note-list"><li>Validate source ownership, approved exports, retention, and access controls.</li><li>Separate public-safety reference guidance from detected facility intelligence.</li><li>Role-gate sensitive incident details, personal data, and law-enforcement coordination records.</li><li>Require analyst review notes before a formal risk tier is accepted, escalated, or downgraded.</li><li>Keep remediation write-back disabled until workflow controls and audit logs are approved.</li></ul></section></section>;
}

function RiskList({ facilities }: { facilities: ThreatRiskFacility[] }) {
  return <div className="threat-risk-list">{facilities.map((facility) => <article key={facility.facilityId}><div className="threat-score-orb"><strong>{formatScore(facility.riskScore)}</strong><span>{facility.riskTier}</span></div><div><strong>Store {facility.facilityId} · {facility.facilityName}</strong><span>{facility.city}, {facility.state} · {facility.market}</span><small>{facility.topDriver}</small></div></article>)}</div>;
}

function SignalList({ signals }: { signals: ThreatRiskSignal[] }) {
  return <div className="threat-record-list">{signals.map((signal) => <article className="threat-record" key={signal.id}><strong>{signal.signalType}</strong><span>Store {signal.facilityId} · {signal.severity} · +{signal.riskContribution} risk</span><small>{signal.recommendedAction}</small></article>)}</div>;
}

function FacilityRow({ facility }: { facility: ThreatRiskFacility }) {
  return <tr><td><strong>Store {facility.facilityId}</strong><small>{facility.facilityName} · {facility.city}, {facility.state}</small></td><td><strong>{formatScore(facility.riskScore)}</strong></td><td><StatusPill label={facility.riskTier} tone={getTierTone(facility.riskTier)} /></td><td>{facility.drivers.slice(0, 3).map((driver) => <small key={driver}>{driver}</small>)}</td><td>{formatNumber(facility.incidentCount)} incidents<small>{formatNumber(facility.severeIncidentCount)} severe</small></td><td>{formatNumber(facility.technicalIssueCount)} tech gaps<small>{formatNumber(facility.fireTroubleCount)} fire exceptions</small></td><td>{facility.recommendedAction}</td></tr>;
}

function sourceLabel(sourceId: string): string {
  const labels: Record<string, string> = {
    'incident-csv': 'Incident Intelligence',
    'incident-intelligence-intake': 'Incident Intake',
    'protection-program-intake': 'Protection Program Intake',
    'canonical-technology': 'Security Technology',
    'remediation-task-csv': 'Open Action Queue',
    'public-safety-guidance': 'Public Safety Guidance',
  };
  return labels[sourceId] ?? sourceId;
}

function SignalCard({ signal, onCreateDraft }: { signal: ThreatRiskSignal; onCreateDraft?: (signal: ThreatRiskSignal) => void }) {
  return <article className="threat-signal-card"><div><StatusPill label={signal.severity} tone={getSeverityTone(signal.severity)} /><span className="threat-contribution">+{signal.riskContribution}</span></div><strong>{signal.signalType}</strong><span>Store {signal.facilityId} · {signal.facilityName} · {signal.city}, {signal.state}</span><p>{signal.summary}</p><small>{signal.recommendedAction}</small><div className="threat-signal-actions"><div className="threat-tags">{signal.sourceIds.map((source) => <span key={source}>{sourceLabel(source)}</span>)}{signal.bestPracticeRefs.map((ref) => <span key={ref}>{ref}</span>)}</div>{onCreateDraft ? <button className="threat-action-button" type="button" onClick={() => onCreateDraft(signal)}>Create Draft</button> : null}</div></article>;
}

function ChartRows({ rows }: { rows: Array<[string, number]> }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return <div className="threat-chart-rows">{rows.map(([label, value]) => <div className="threat-chart-row" key={label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><div><span style={{ width: `${Math.max(5, (value / max) * 100)}%` }} /></div></div>)}{rows.length === 0 ? <p className="threat-empty">No records in the current scope.</p> : null}</div>;
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'yellow' | 'sky' | 'white' | 'critical' }) {
  return <article className={`threat-kpi tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function CardHeading({ eyebrow, title, pill, tone = 'stable' }: { eyebrow: string; title: string; pill?: string; tone?: StatusTone }) {
  return <div className="threat-card-heading"><div><p className="threat-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{pill ? <StatusPill label={pill} tone={tone} /> : null}</div>;
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="threat-card threat-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}
