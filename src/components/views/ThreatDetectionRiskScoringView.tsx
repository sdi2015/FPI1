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
        <section className="threat-card wide"><CardHeading eyebrow="Proactive triage" title="Recommended action queue" pill="NEXT BEST ACTION" tone="watch" /><ActionQueue facilities={actionQueue} /></section>
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

function evidenceForFacility(facility: ThreatRiskFacility): string {
  const evidence = ['incident summary'];
  if (facility.technicalIssueCount > 0) evidence.push('device health');
  if (facility.fireTroubleCount > 0) evidence.push('life-safety status');
  if (facility.openTaskCount > 0) evidence.push('open actions');
  return evidence.join(', ');
}

function ActionQueue({ facilities }: { facilities: ThreatRiskFacility[] }) {
  return <div className="threat-table-wrap"><table className="threat-table"><thead><tr><th>Priority</th><th>Facility</th><th>Why it matters</th><th>Recommended owner</th><th>Next action</th><th>Evidence needed</th></tr></thead><tbody>{facilities.map((facility, index) => <tr key={facility.facilityId}><td><StatusPill label={index < 2 ? 'P1' : 'P2'} tone={index < 2 ? 'critical' : 'watch'} /></td><td><strong>Store {facility.facilityId}</strong><small>{facility.city}, {facility.state} · {facility.riskTier}</small></td><td>{facility.topDriver}<small>{facility.drivers.slice(0, 2).join(' · ')}</small></td><td>{ownerForFacility(facility)}</td><td>{facility.recommendedAction}</td><td>{evidenceForFacility(facility)}</td></tr>)}</tbody></table></div>;
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
  const categories = Array.from(new Set(data.signals.map((signal) => signal.category))).sort();
  const signals = useMemo(() => data.signals.filter((signal) => category === 'all' || signal.category === category).sort((a, b) => b.riskContribution - a.riskContribution), [data.signals, category]);

  return (
    <section className="threat-grid">
      <section className="threat-card wide"><div className="threat-directory-header"><div><p className="threat-eyebrow">Incident intelligence</p><h2>Signals requiring review or action</h2></div><strong>{signals.length} signals</strong></div><p>Use this feed to quickly ingest current incident-driven risk and determine where RASA, Security Technology, Enterprise, or store-facing teams should collaborate next.</p><div className="threat-filters"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></div><div className="threat-signal-feed">{signals.map((signal) => <SignalCard signal={signal} key={signal.id} />)}</div></section>
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

function SignalCard({ signal }: { signal: ThreatRiskSignal }) {
  return <article className="threat-signal-card"><div><StatusPill label={signal.severity} tone={getSeverityTone(signal.severity)} /><span className="threat-contribution">+{signal.riskContribution}</span></div><strong>{signal.signalType}</strong><span>Store {signal.facilityId} · {signal.facilityName} · {signal.city}, {signal.state}</span><p>{signal.summary}</p><small>{signal.recommendedAction}</small><div className="threat-tags">{signal.sourceIds.map((source) => <span key={source}>{sourceLabel(source)}</span>)}{signal.bestPracticeRefs.map((ref) => <span key={ref}>{ref}</span>)}</div></article>;
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
