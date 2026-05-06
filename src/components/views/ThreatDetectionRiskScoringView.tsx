import { useMemo, useState } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyThreatRiskScope } from '../../data/threatRiskScope';
import { formatNumber, formatScore, getCoordinationCandidates, getSeverityTone, getTopRiskFacilities, getTopThreatSignals } from '../../data/threatRiskSelectors';
import type { ThreatBestPractice, ThreatRiskData, ThreatRiskFacility, ThreatRiskSignal, ThreatRiskSource } from '../../data/threatRiskTypes';
import { useThreatRiskData } from '../../data/useThreatRiskData';

export type ThreatDetectionRiskScoringViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type ThreatTab = 'overview' | 'leaderboard' | 'signals' | 'sources' | 'guidance' | 'model';

type DraftRequestType =
  | 'RASA Review Request'
  | 'Security Technology Ticket'
  | 'Global Tech Validation'
  | 'Compliance Review Prep'
  | 'Legal / External Risk Prep'
  | 'Enterprise Governance Follow-Up'
  | 'Store Context Request'
  | 'External Coordination Prep';

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
    trigger: 'Critical/high facility tier, repeated severe incidents, or external coordination signal.',
    deliverable: 'Validated risk narrative, escalation recommendation, and facility watch disposition.',
    actions: ['Review severe incident pattern', 'Confirm repeat-facility driver', 'Recommend escalation path'],
  },
  {
    team: 'Global Tech',
    purpose: 'Validate data pipelines, system dependencies, source availability, and integration blockers that affect confidence.',
    trigger: 'Source freshness is aging/stale, adapter is planned, or users need technology-system validation.',
    deliverable: 'Data-health disposition, blocker owner, and target path for trusted operational use.',
    actions: ['Validate source feed health', 'Confirm adapter or access blocker', 'Document remediation path'],
  },
  {
    team: 'Compliance',
    purpose: 'Confirm evidence quality, audit readiness, policy alignment, and retention expectations before escalation.',
    trigger: 'Life-safety, evidence, audit, retention, or policy impact is present.',
    deliverable: 'Compliance notes, evidence checklist, and governance-ready disposition.',
    actions: ['Review evidence requirements', 'Confirm policy/control impact', 'Prepare audit-ready notes'],
  },
  {
    team: 'Legal',
    purpose: 'Review sensitive external, law-enforcement, privacy, or high-risk incident context before broader action.',
    trigger: 'Weapon, violence, law-enforcement, external coordination, or sensitive information is involved.',
    deliverable: 'Legal guardrails, approved coordination language, and escalation constraints.',
    actions: ['Review sensitive context', 'Confirm external coordination guardrails', 'Approve escalation language'],
  },
  {
    team: 'Security Technology',
    purpose: 'Confirm whether cameras, panels, access controls, or network health may affect protection readiness.',
    trigger: 'Technology Gap, Access Control, panel trouble, or camera/control issue is a top driver.',
    deliverable: 'Technical-control validation, remediation owner, and device-health status.',
    actions: ['Check camera and recorder health', 'Review device coverage gaps', 'Confirm remediation status'],
  },
  {
    team: 'FPI Governance / Store-Facing Partners',
    purpose: 'Coordinate ownership, practical store context, SLA risk, and executive reporting for elevated facilities.',
    trigger: 'Open action burden, blocked work, store-operating constraints, or leadership reporting need.',
    deliverable: 'Named owner, action due date, store context, and leadership-ready status note.',
    actions: ['Confirm accountable owner', 'Validate store conditions', 'Prepare leadership brief'],
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
  const tierCounts = getTierCounts(data.facilities);
  const facilitiesNeedingReview = data.summary.criticalFacilities + data.summary.highFacilities;
  const highestRiskFacility = topFacilities[0];

  return (
    <>
      <section className="threat-executive-summary threat-card wide" aria-label="Risk Intelligence executive summary">
        <CardHeading eyebrow="Executive overview" title="What Risk Intelligence is telling us" pill={data.metadata.dataMode.toUpperCase()} tone="watch" />
        <div className="threat-summary-grid">
          <div className="threat-summary-lead">
            <strong>{formatNumber(facilitiesNeedingReview)} facilities need leadership review.</strong>
            <p>
              Risk Intelligence combines incidents, protection signals, technical-control health, life-safety exceptions,
              and open work into one explainable view. Start with red/orange facilities, validate the top signals, and use
              the action draft to align owners before escalation.
            </p>
          </div>
          <div className="threat-next-actions" aria-label="Recommended executive actions">
            <span>Recommended next steps</span>
            <ol>
              <li>Review red and orange facilities in Triage Priority Facilities.</li>
              <li>Use Incident Intelligence filters and charts to isolate patterns.</li>
              <li>Prepare action drafts only when owner, evidence, and next step are clear.</li>
            </ol>
          </div>
        </div>
        <div className="threat-tier-summary" aria-label="Facility risk tier summary">
          <TierLegend />
          <div className="threat-tier-counts">
            <FacilityTierBadge tier="Critical" count={tierCounts.Critical} />
            <FacilityTierBadge tier="High" count={tierCounts.High} />
            <FacilityTierBadge tier="Medium" count={tierCounts.Medium} />
            <FacilityTierBadge tier="Low" count={tierCounts.Low} />
          </div>
        </div>
      </section>

      <section className="threat-kpi-grid" aria-label="Risk Intelligence KPIs">
        <Kpi label="Facilities requiring review" value={formatNumber(data.summary.criticalFacilities + data.summary.highFacilities)} detail="Critical/high FPI posture" tone="critical" />
        <Kpi label="Severe incident signals" value={formatNumber(data.summary.severeSignals)} detail="Modeled from available incident intelligence" tone="yellow" />
        <Kpi label="Protection signals" value={formatNumber(data.summary.threatSignals)} detail="Incident, technology, life-safety, and action signals" tone="sky" />
        <Kpi label="Open protection actions" value={formatNumber(data.summary.openThreatTasks)} detail="Critical/high work needing ownership" tone="yellow" />
      </section>

      <section className="threat-focus-strip" aria-label="Risk intelligence operating flow">
        <article><span>01</span><strong>See the exposure</strong><small>Plain-language summary, tier colors, and top facilities show where leadership should focus first.</small></article>
        <article><span>02</span><strong>Filter the signal</strong><small>Charts and filters help users isolate incident patterns, markets, severity, and confidence before taking action.</small></article>
        <article><span>03</span><strong>Coordinate action</strong><small>Action drafts turn a facility or signal into an owner, evidence checklist, and safe next-step brief.</small></article>
      </section>

      <section className="threat-grid">
        <section className="threat-card wide"><CardHeading eyebrow="Proactive triage" title="Recommended action queue" pill="NEXT BEST ACTION" tone="watch" /><ActionQueue facilities={actionQueue} onCreateDraft={(facility) => setSelectedDraft(createMockDraftFromFacility(facility))} /></section>
        <section className="threat-card wide"><CardHeading eyebrow="Action draft builder" title="Prepare an owner-ready next-step draft" pill="NO SUBMISSION" tone="stable" /><p>Preparing a draft does not create a ticket or send a message. It converts the selected facility or signal into a clear review brief with owner, evidence, business reason, and recommended next action.</p><MockDraftPanel draft={selectedDraft} onClear={() => setSelectedDraft(null)} /></section>
        <section className="threat-card wide"><CardHeading eyebrow="Priority facilities" title="Top facilities driving current risk" pill={highestRiskFacility ? `${highestRiskFacility.riskTier.toUpperCase()} LEAD` : 'EXPLAINABLE'} tone="watch" /><RiskList facilities={topFacilities} /></section>
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

function getTierCounts(facilities: ThreatRiskFacility[]): Record<ThreatRiskFacility['riskTier'], number> {
  return facilities.reduce<Record<ThreatRiskFacility['riskTier'], number>>((counts, facility) => {
    counts[facility.riskTier] += 1;
    return counts;
  }, { Critical: 0, High: 0, Medium: 0, Low: 0 });
}

function tierColorLabel(tier: ThreatRiskFacility['riskTier']): string {
  if (tier === 'Critical') return 'Red';
  if (tier === 'High') return 'Orange';
  if (tier === 'Medium') return 'Yellow';
  return 'Green';
}

function tierClass(tier: ThreatRiskFacility['riskTier']): string {
  return `tier-${tier.toLowerCase()}`;
}

function TierLegend() {
  const tiers: ThreatRiskFacility['riskTier'][] = ['Critical', 'High', 'Medium', 'Low'];
  return <div className="threat-tier-legend" aria-label="Risk tier color legend">{tiers.map((tier) => <span className={tierClass(tier)} key={tier}><i aria-hidden="true" />{tierColorLabel(tier)} = {tier}</span>)}</div>;
}

function FacilityTierBadge({ tier, count }: { tier: ThreatRiskFacility['riskTier']; count: number }) {
  return <div className={`facility-tier-badge ${tierClass(tier)}`}><span>{tierColorLabel(tier)} tier</span><strong>{formatNumber(count)}</strong><small>{tier}</small></div>;
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
  if (facility.technicalIssueCount >= 4) return 'Global Tech Validation';
  if (facility.fireTroubleCount >= 2) return 'Compliance Review Prep';
  if (facility.riskTier === 'Critical') return 'Legal / External Risk Prep';
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
  if (signal.category === 'Technology Gap' || signal.category === 'Access Control') return 'Global Tech Validation';
  if (signal.category === 'Fire/Life Safety') return 'Compliance Review Prep';
  if (signal.category === 'External Coordination' || signal.category === 'Weapon' || signal.category === 'Violence') return 'Legal / External Risk Prep';
  if (signal.category === 'Vendor') return 'External Coordination Prep';
  return 'Store Context Request';
}

function ownerForSignal(signal: ThreatRiskSignal): string {
  const requestType = requestTypeForSignal(signal);
  if (requestType === 'Security Technology Ticket' || requestType === 'Global Tech Validation') return 'Global Tech / Security Technology';
  if (requestType === 'Compliance Review Prep') return 'Compliance / Life Safety';
  if (requestType === 'Legal / External Risk Prep' || requestType === 'RASA Review Request') return 'Legal + RASA / Risk Intelligence';
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
  return <div className="threat-table-wrap"><table className="threat-table"><thead><tr><th>Priority</th><th>Tier</th><th>Facility</th><th>Why it matters</th><th>Recommended owner</th><th>Next action</th><th>Evidence needed</th><th>Action draft</th></tr></thead><tbody>{facilities.map((facility) => { const priority = priorityForFacility(facility); return <tr key={facility.facilityId} className={`facility-row-${tierClass(facility.riskTier)}`}><td><StatusPill label={priority} tone={priority === 'P1' ? 'critical' : priority === 'P2' ? 'watch' : 'stable'} /></td><td><TierPill tier={facility.riskTier} /></td><td><strong>Store {facility.facilityId}</strong><small>{facility.city}, {facility.state}</small></td><td>{facility.topDriver}<small>{facility.drivers.slice(0, 2).join(' · ')}</small></td><td>{ownerForFacility(facility)}</td><td>{facility.recommendedAction}</td><td>{evidenceForFacility(facility)}</td><td><button className="threat-action-button" type="button" onClick={() => onCreateDraft(facility)}>Prepare Action Draft</button></td></tr>; })}</tbody></table></div>;
}

function MockDraftPanel({ draft, onClear }: { draft: MockDraft | null; onClear: () => void }) {
  if (!draft) {
    return <div className="threat-draft-empty"><strong>No action draft prepared</strong><p>Select <b>Prepare Action Draft</b> from a facility or signal. This creates a safe review brief only: it does not send a message, create a ticket, or write to any production system.</p></div>;
  }

  return <article className="threat-draft-panel" aria-live="polite"><div className="threat-draft-header"><div><StatusPill label={draft.priority} tone={draft.priority === 'P1' ? 'critical' : draft.priority === 'P2' ? 'watch' : 'stable'} /><StatusPill label="Prepared draft only" tone="stable" /></div><button className="threat-action-button secondary" type="button" onClick={onClear}>Clear Draft</button></div><div className="threat-draft-purpose"><strong>What this does</strong><p>This converts the selected risk record into an owner-ready action brief for review. It helps teams align on context, evidence, owner, and next step before any approved workflow is used.</p></div><div className="threat-draft-grid"><div><span>Draft Type</span><strong>{draft.requestType}</strong></div><div><span>Recommended Owner</span><strong>{draft.owner}</strong></div><div><span>Status</span><strong>{draft.status}</strong></div><div><span>Source</span><strong>{draft.sourceType === 'signal' ? 'Signal' : 'Facility'} · Store {draft.facilityId}</strong><small>{draft.facilityName}</small></div></div><div className="threat-draft-body"><h3>{draft.subject}</h3><p>{draft.summary}</p><h4>Why this matters</h4><ul className="threat-note-list compact">{draft.whyItMatters.map((item) => <li key={item}>{item}</li>)}</ul><h4>Recommended next action</h4><p>{draft.recommendedAction}</p><h4>Evidence needed</h4><div className="threat-tags">{draft.evidenceNeeded.map((item) => <span key={item}>{item}</span>)}</div><h4>Requested response</h4><p>{draft.requestedResponse}</p></div><div className="threat-draft-actions"><button className="threat-action-button" type="button" disabled>Create Ticket — Mock Only</button><button className="threat-action-button" type="button" disabled>Send Communication — Mock Only</button><button className="threat-action-button secondary" type="button" disabled>Copy Draft — Coming Soon</button></div><p className="threat-draft-disclaimer">Draft only — no production communication is sent and no ticket is created.</p></article>;
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
      <div className="threat-directory-header"><div><p className="threat-eyebrow">Triage priority facilities</p><h2>Risk score, tier color, drivers, and recommended next action</h2></div><strong>{rows.length} facilities</strong></div>
      <p>Use the color-coded tiers to triage quickly: red facilities need immediate leadership attention, orange facilities need active review, yellow facilities need monitoring, and green facilities are stable in the current scope.</p>
      <TierLegend />
      <div className="threat-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store, city, state, market, driver" /><select value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">All tiers</option><option value="Critical">Critical / Red</option><option value="High">High / Orange</option><option value="Medium">Medium / Yellow</option><option value="Low">Low / Green</option></select></div>
      <div className="threat-table-wrap"><table className="threat-table"><thead><tr><th>Facility</th><th>Score</th><th>Tier</th><th>Drivers</th><th>Incident signals</th><th>Controls</th><th>Recommended action</th></tr></thead><tbody>{rows.map((facility) => <FacilityRow facility={facility} key={facility.facilityId} />)}</tbody></table></div>
    </section>
  );
}

function ThreatSignals({ data }: { data: ThreatRiskData }) {
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [confidence, setConfidence] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState<MockDraft | null>(null);
  const categories = Array.from(new Set(data.signals.map((signal) => signal.category))).sort();
  const severities = Array.from(new Set(data.signals.map((signal) => signal.severity))).sort();
  const confidences = Array.from(new Set(data.signals.map((signal) => signal.confidence))).sort();
  const signals = useMemo(() => data.signals
    .filter((signal) => category === 'all' || signal.category === category)
    .filter((signal) => severity === 'all' || signal.severity === severity)
    .filter((signal) => confidence === 'all' || signal.confidence === confidence)
    .sort((a, b) => b.riskContribution - a.riskContribution), [data.signals, category, severity, confidence]);
  const categoryRows = useMemo(() => summarizeSignals(signals, 'category'), [signals]);
  const severityRows = useMemo(() => summarizeSignals(signals, 'severity'), [signals]);
  const marketRows = useMemo(() => summarizeSignals(signals, 'state'), [signals]);
  const severeCount = signals.filter((signal) => signal.severity === 'Critical' || signal.severity === 'High').length;
  const highestContribution = signals[0]?.riskContribution ?? 0;
  const resetFilters = () => { setCategory('all'); setSeverity('all'); setConfidence('all'); };

  return (
    <section className="threat-grid">
      <section className="threat-card wide"><div className="threat-directory-header"><div><p className="threat-eyebrow">Incident intelligence</p><h2>Interactive signal analysis and action triage</h2></div><strong>{signals.length} signals</strong></div><p>Filter incident and protection signals by category, severity, and confidence. Select chart bars to focus the feed, then prepare an action draft only when the owner and evidence are clear.</p><div className="threat-metric-grid"><Metric label="Filtered signals" value={formatNumber(signals.length)} helper="Records in current view" /><Metric label="High / critical" value={formatNumber(severeCount)} helper="Needs review or action" /><Metric label="Highest contribution" value={`+${highestContribution}`} helper="Top modeled risk contribution" /><Metric label="Filters active" value={category === 'all' && severity === 'all' && confidence === 'all' ? 'None' : 'Yes'} helper="Charts can update filters" /></div><div className="threat-filters three"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severities</option>{severities.map((item) => <option value={item} key={item}>{item}</option>)}</select><select value={confidence} onChange={(event) => setConfidence(event.target.value)}><option value="all">All confidence levels</option>{confidences.map((item) => <option value={item} key={item}>{item}</option>)}</select></div><div className="threat-filter-actions"><button className="threat-action-button secondary" type="button" onClick={resetFilters}>Reset Filters</button><span>Click category or severity bars below to filter the signal feed.</span></div><div className="threat-signal-feed">{signals.map((signal) => <SignalCard signal={signal} key={signal.id} onCreateDraft={(item) => setSelectedDraft(createMockDraftFromSignal(item))} />)}{signals.length === 0 ? <p className="threat-empty">No signals match the current filters.</p> : null}</div></section>
      <section className="threat-card wide"><CardHeading eyebrow="Action draft builder" title="Prepare signal action draft" pill="NO SUBMISSION" tone="stable" /><p>Preparing a draft preserves the tracked signal context while making ownership, evidence, and requested response clear. It does not send a communication or create a production ticket.</p><MockDraftPanel draft={selectedDraft} onClear={() => setSelectedDraft(null)} /></section>
      <section className="threat-card"><CardHeading eyebrow="Interactive graph" title="Signals by category" /><InteractiveChartRows rows={categoryRows} activeValue={category} onSelect={(label) => setCategory(category === label ? 'all' : label)} /></section>
      <section className="threat-card"><CardHeading eyebrow="Interactive graph" title="Signals by severity" /><InteractiveChartRows rows={severityRows} activeValue={severity} onSelect={(label) => setSeverity(severity === label ? 'all' : label)} /></section>
      <section className="threat-card wide"><CardHeading eyebrow="Geographic concentration" title="Signal concentration by state" /><ChartRows rows={marketRows} /></section>
    </section>
  );
}

function SourceIntelligence({ sources }: { sources: ThreatRiskSource[] }) {
  const [status, setStatus] = useState('all');
  const [sourceType, setSourceType] = useState('all');
  const statuses = Array.from(new Set(sources.map((source) => source.integrationStatus))).sort();
  const sourceTypes = Array.from(new Set(sources.map((source) => source.sourceType))).sort();
  const filteredSources = sources.filter((source) => (status === 'all' || source.integrationStatus === status) && (sourceType === 'all' || source.sourceType === sourceType));
  const loadedRecords = filteredSources.reduce((total, source) => total + source.recordsLoaded, 0);
  const loadedCount = filteredSources.filter((source) => source.integrationStatus === 'Loaded').length;
  const watchCount = filteredSources.filter((source) => source.integrationStatus !== 'Loaded').length;

  return <section className="threat-grid"><section className="threat-card wide"><CardHeading eyebrow="Inputs · Protection signals" title="Source readiness and what each input contributes" pill="SYNTHETIC / DEMO" tone="stable" /><p>Use this view to understand which inputs are loaded, which are reference-only or planned, and how each source supports FPI risk decisions. The goal is to reduce manual stitching across incident, device, life-safety, remediation, vendor, and external coordination data.</p><div className="threat-metric-grid"><Metric label="Visible sources" value={formatNumber(filteredSources.length)} helper="Current filter result" /><Metric label="Loaded sources" value={formatNumber(loadedCount)} helper="Ready for current demo view" /><Metric label="Needs attention" value={formatNumber(watchCount)} helper="Planned, reference, approval, or unavailable" /><Metric label="Records represented" value={formatNumber(loadedRecords)} helper="Filtered source records" /></div><div className="threat-filters"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All readiness states</option>{statuses.map((item) => <option value={item} key={item}>{item}</option>)}</select><select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="all">All source types</option>{sourceTypes.map((item) => <option value={item} key={item}>{item}</option>)}</select></div></section>{filteredSources.map((source) => <section className="threat-card" key={source.sourceId}><CardHeading eyebrow={source.sourceType} title={source.sourceName} pill={source.integrationStatus.toUpperCase()} tone={source.integrationStatus === 'Loaded' ? 'ready' : source.integrationStatus === 'Reference Only' ? 'stable' : 'watch'} /><div className="threat-metric-grid single"><Metric label="Freshness" value={source.freshnessStatus} helper={`${source.confidence} confidence`} /><Metric label="Records loaded" value={formatNumber(source.recordsLoaded)} helper="Current demo context" /></div><h3>How users should use this input</h3><p>{sourceUseGuidance(source)}</p><h3>Readiness note</h3><p>{source.notes}</p></section>)}{filteredSources.length === 0 ? <section className="threat-card wide"><p className="threat-empty">No protection signal sources match the current filters.</p></section> : null}</section>;
}

function CollaborationHub({ practices }: { practices: ThreatBestPractice[] }) {
  return <section className="threat-grid"><section className="threat-card wide"><CardHeading eyebrow="Cross-team collaboration" title="Action lanes that make Risk Intelligence useful to FPI" pill="FPI OPERATING MODEL" tone="watch" /><p>Use these lanes to move from intelligence to coordinated action. Each partner has a defined trigger, expected output, and action checklist so the dashboard supports real FPI governance instead of only showing data.</p><div className="collaboration-lane-grid">{collaborationLanes.map((lane, index) => <article key={lane.team} className="collaboration-lane-card"><div><span>{String(index + 1).padStart(2, '0')}</span><strong>{lane.team}</strong></div><p>{lane.purpose}</p><dl><dt>Engage when</dt><dd>{lane.trigger}</dd><dt>Expected output</dt><dd>{lane.deliverable}</dd></dl><ul className="threat-note-list compact">{lane.actions.map((action) => <li key={action}>{action}</li>)}</ul></article>)}</div></section><BestPracticeGuidance practices={practices} /></section>;
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
  return <tr className={`facility-row-${tierClass(facility.riskTier)}`}><td><strong>Store {facility.facilityId}</strong><small>{facility.facilityName} · {facility.city}, {facility.state}</small></td><td><strong>{formatScore(facility.riskScore)}</strong></td><td><TierPill tier={facility.riskTier} /></td><td>{facility.drivers.slice(0, 3).map((driver) => <small key={driver}>{driver}</small>)}</td><td>{formatNumber(facility.incidentCount)} incidents<small>{formatNumber(facility.severeIncidentCount)} severe</small></td><td>{formatNumber(facility.technicalIssueCount)} tech gaps<small>{formatNumber(facility.fireTroubleCount)} fire exceptions</small></td><td>{facility.recommendedAction}</td></tr>;
}

function TierPill({ tier }: { tier: ThreatRiskFacility['riskTier'] }) {
  return <span className={`threat-tier-pill ${tierClass(tier)}`}><i aria-hidden="true" />{tierColorLabel(tier)} · {tier}</span>;
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

function sourceUseGuidance(source: ThreatRiskSource): string {
  if (source.sourceType === 'Internal System') return 'Use as operational evidence for facility posture, source freshness, and technical or incident validation.';
  if (source.sourceType === 'Walmart Program') return 'Use to connect FPI program context, remediation work, and governance ownership to risk decisions.';
  if (source.sourceType === 'Public Safety Guidance') return 'Use as reference context for recommended practices; do not treat it as a detected facility event.';
  if (source.sourceType === 'Security Vendor') return 'Use to validate vendor, monitoring, or technology-control context before escalation.';
  if (source.sourceType === 'Law Enforcement') return 'Use only with approved access and legal/external coordination guardrails.';
  return 'Use as supplemental intake context that should be validated before executive escalation.';
}

function SignalCard({ signal, onCreateDraft }: { signal: ThreatRiskSignal; onCreateDraft?: (signal: ThreatRiskSignal) => void }) {
  return <article className="threat-signal-card"><div><StatusPill label={signal.severity} tone={getSeverityTone(signal.severity)} /><span className="threat-contribution">+{signal.riskContribution}</span></div><strong>{signal.signalType}</strong><span>Store {signal.facilityId} · {signal.facilityName} · {signal.city}, {signal.state}</span><p>{signal.summary}</p><small>{signal.recommendedAction}</small><div className="threat-signal-actions"><div className="threat-tags">{signal.sourceIds.map((source) => <span key={source}>{sourceLabel(source)}</span>)}{signal.bestPracticeRefs.map((ref) => <span key={ref}>{ref}</span>)}</div>{onCreateDraft ? <button className="threat-action-button" type="button" onClick={() => onCreateDraft(signal)}>Prepare Action Draft</button> : null}</div></article>;
}

function summarizeSignals(signals: ThreatRiskSignal[], key: 'category' | 'severity' | 'state'): Array<[string, number]> {
  const counts = signals.reduce<Record<string, number>>((summary, signal) => {
    const label = signal[key];
    summary[label] = (summary[label] ?? 0) + 1;
    return summary;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function InteractiveChartRows({ rows, activeValue, onSelect }: { rows: Array<[string, number]>; activeValue: string; onSelect: (label: string) => void }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return <div className="threat-chart-rows interactive">{rows.map(([label, value]) => <button className={activeValue === label ? 'threat-chart-row active' : 'threat-chart-row'} type="button" key={label} onClick={() => onSelect(label)} aria-pressed={activeValue === label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><div><span style={{ width: `${Math.max(5, (value / max) * 100)}%` }} /></div></button>)}{rows.length === 0 ? <p className="threat-empty">No records in the current scope.</p> : null}</div>;
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
