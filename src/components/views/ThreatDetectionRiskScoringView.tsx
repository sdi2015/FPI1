import { useMemo, useState } from 'react';
import { LockedScopeSummary } from '../LockedScopeSummary';
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
  { id: 'leaderboard', label: 'Facility Leaderboard', eyebrow: 'Stores' },
  { id: 'signals', label: 'Threat Signal Feed', eyebrow: 'Intel' },
  { id: 'sources', label: 'SRM / FPP Inputs', eyebrow: 'Adapters' },
  { id: 'guidance', label: 'Best Practices', eyebrow: 'FBI / DHS' },
  { id: 'model', label: 'Scoring Model', eyebrow: 'Governance' },
];

export function ThreatDetectionRiskScoringView({ fireSites, storeScope, onChangeScopeRequest }: ThreatDetectionRiskScoringViewProps) {
  const [activeTab, setActiveTab] = useState<ThreatTab>('overview');
  const threatState = useThreatRiskData();
  const scopedThreatData = useMemo(() => (threatState.data ? applyThreatRiskScope(threatState.data, fireSites, storeScope) : null), [threatState.data, fireSites, storeScope]);

  return (
    <section className="threat-page" aria-label="Threat Detection and Risk Scoring">
      <header className="threat-header">
        <div>
          <p className="threat-eyebrow">Threat intelligence and facility risk scoring</p>
          <h1>Threat Detection & Risk Scoring</h1>
          <p>Prioritize facilities using incident patterns, critical tasks, fire/life-safety exceptions, technology-control gaps, SRM/FPP adapter seams, and public-safety best-practice guidance.</p>
        </div>
        <div className="threat-mode"><span>MODE</span>CANONICAL + REFERENCE</div>
      </header>

      <LockedScopeSummary sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {threatState.loading ? <StatePanel title="Loading threat risk dataset" message="Preparing canonical facility risk, signal feed, SRM/FPP adapter placeholders, and best-practice references." /> : null}
      {threatState.error ? <StatePanel title="Threat risk dataset unavailable" message={threatState.error} danger /> : null}

      {scopedThreatData ? (
        <>
          <nav className="threat-tab-bar" aria-label="Threat Detection and Risk Scoring sub tabs">
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
          {activeTab === 'guidance' ? <BestPracticeGuidance practices={scopedThreatData.bestPractices} /> : null}
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

  return (
    <>
      <section className="threat-kpi-grid" aria-label="Threat risk KPIs">
        <Kpi label="Facilities scored" value={formatNumber(data.summary.facilities)} detail="Canonical facility_id scope" tone="blue" />
        <Kpi label="Critical risk" value={formatNumber(data.summary.criticalFacilities)} detail="Immediate leadership review" tone="critical" />
        <Kpi label="High risk" value={formatNumber(data.summary.highFacilities)} detail="Operational triage queue" tone="yellow" />
        <Kpi label="Threat signals" value={formatNumber(data.summary.threatSignals)} detail={`${formatNumber(data.summary.severeSignals)} severe`} tone="sky" />
        <Kpi label="Open threat tasks" value={formatNumber(data.summary.openThreatTasks)} detail="Critical/high protection work" tone="yellow" />
        <Kpi label="Avg risk score" value={formatScore(data.summary.averageRiskScore)} detail="Normalized 0-100 model" tone="white" />
      </section>

      <section className="threat-focus-strip" aria-label="Threat detection operating flow">
        <article><span>01</span><strong>Signal</strong><small>Incident, SRM/FPP, technology, fire, and remediation signals normalize by facility.</small></article>
        <article><span>02</span><strong>Score</strong><small>Explainable weights convert signal severity, confidence, and control weakness into risk.</small></article>
        <article><span>03</span><strong>Act</strong><small>Recommendations link risk drivers to vendor, AP/security, and external coordination paths.</small></article>
      </section>

      <section className="threat-grid">
        <section className="threat-card wide"><CardHeading eyebrow="Highest risk facilities" title="Facility risk leaderboard" pill="EXPLAINABLE" tone="watch" /><RiskList facilities={topFacilities} /></section>
        <section className="threat-card"><CardHeading eyebrow="Signal feed" title="Top threat signals" /><SignalList signals={topSignals} />
        </section>
        <section className="threat-card"><CardHeading eyebrow="Coordination candidates" title="External / vendor readiness" /><div className="threat-record-list">{coordinationCandidates.map((facility) => <article className="threat-record" key={facility.facilityId}><strong>Store {facility.facilityId} · {facility.riskTier}</strong><span>{facility.city}, {facility.state} · {facility.topDriver}</span><small>{facility.recommendedAction}</small></article>)}</div></section>
        <section className="threat-card wide"><CardHeading eyebrow="Governance note" title="Risk scoring is a prioritization aid, not a formal threat determination" pill="CONTROLLED" tone="critical" /><p>{data.metadata.governanceNote}</p><div className="threat-metric-grid"><Metric label="Data mode" value={data.metadata.dataMode} helper={data.metadata.classification} /><Metric label="Scope key" value={data.metadata.scopeKey} helper="Shared across FPI data domains" /><Metric label="Source files" value={formatNumber(data.metadata.sourceFiles.length)} helper="Canonical generator inputs" /><Metric label="Generated" value={new Date(data.metadata.generatedAt).toLocaleDateString()} helper="Local demo JSON" /></div></section>
      </section>
    </>
  );
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
      <div className="threat-directory-header"><div><p className="threat-eyebrow">Facility risk leaderboard</p><h2>Risk score, drivers, and recommended action</h2></div><strong>{rows.length} facilities</strong></div>
      <div className="threat-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store, city, state, market, driver" /><select value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">All tiers</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
      <div className="threat-table-wrap"><table className="threat-table"><thead><tr><th>Facility</th><th>Score</th><th>Tier</th><th>Drivers</th><th>Signals</th><th>Controls</th><th>Recommended action</th></tr></thead><tbody>{rows.map((facility) => <FacilityRow facility={facility} key={facility.facilityId} />)}</tbody></table></div>
    </section>
  );
}

function ThreatSignals({ data }: { data: ThreatRiskData }) {
  const [category, setCategory] = useState('all');
  const categories = Array.from(new Set(data.signals.map((signal) => signal.category))).sort();
  const signals = useMemo(() => data.signals.filter((signal) => category === 'all' || signal.category === category).sort((a, b) => b.riskContribution - a.riskContribution), [data.signals, category]);

  return (
    <section className="threat-grid">
      <section className="threat-card wide"><div className="threat-directory-header"><div><p className="threat-eyebrow">Threat signal feed</p><h2>Signals requiring review or action</h2></div><strong>{signals.length} signals</strong></div><div className="threat-filters"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></div><div className="threat-signal-feed">{signals.map((signal) => <SignalCard signal={signal} key={signal.id} />)}</div></section>
      <section className="threat-card"><CardHeading eyebrow="Incident types" title="Top detected patterns" /><ChartRows rows={data.incidentTypeCounts} /></section>
      <section className="threat-card"><CardHeading eyebrow="Market concentration" title="High/Critical stores" /><ChartRows rows={data.marketRiskCounts} /></section>
    </section>
  );
}

function SourceIntelligence({ sources }: { sources: ThreatRiskSource[] }) {
  return <section className="threat-grid">{sources.map((source) => <section className="threat-card" key={source.sourceId}><CardHeading eyebrow={source.sourceType} title={source.sourceName} pill={source.integrationStatus.toUpperCase()} tone={source.integrationStatus === 'Loaded' ? 'ready' : source.integrationStatus === 'Reference Only' ? 'stable' : 'watch'} /><div className="threat-metric-grid single"><Metric label="Freshness" value={source.freshnessStatus} helper={`${source.confidence} confidence`} /><Metric label="Records loaded" value={formatNumber(source.recordsLoaded)} helper="Current demo context" /></div><p>{source.notes}</p></section>)}</section>;
}

function BestPracticeGuidance({ practices }: { practices: ThreatBestPractice[] }) {
  return <section className="threat-grid">{practices.map((practice) => <section className="threat-card" key={practice.id}><CardHeading eyebrow={practice.issuingBody} title={practice.title} pill="REFERENCE" tone="stable" /><p>{practice.guidanceSummary}</p><div className="threat-tags">{practice.appliesTo.map((item) => <span key={item}>{item}</span>)}</div><h3>Recommended actions</h3><ul className="threat-note-list">{practice.recommendedActions.map((action) => <li key={action}>{action}</li>)}</ul><h3>Evidence needed</h3><ul className="threat-note-list compact">{practice.evidenceNeeded.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</section>;
}

function ScoringModel({ data }: { data: ThreatRiskData }) {
  return <section className="threat-grid"><section className="threat-card wide"><CardHeading eyebrow="Explainable model" title="How the facility score is calculated" pill="0-100" tone="ready" /><div className="threat-score-model">{data.scoringModel.map((factor) => <article key={factor.factor}><div><strong>{factor.factor}</strong><span>{factor.weight}%</span></div><p>{factor.description}</p><div><span style={{ width: `${factor.weight * 4}%` }} /></div></article>)}</div></section><section className="threat-card"><CardHeading eyebrow="Governance guardrails" title="Before production use" pill="REQUIRES APPROVAL" tone="critical" /><ul className="threat-note-list"><li>Validate SRM/FPP source ownership, approved exports, retention, and access controls.</li><li>Separate public-safety reference guidance from detected threat intelligence.</li><li>Role-gate sensitive incident details, personal data, and law-enforcement coordination records.</li><li>Require analyst override notes before a formal risk tier is accepted or downgraded.</li><li>Keep remediation write-back disabled until workflow controls and audit logs are approved.</li></ul></section></section>;
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

function SignalCard({ signal }: { signal: ThreatRiskSignal }) {
  return <article className="threat-signal-card"><div><StatusPill label={signal.severity} tone={getSeverityTone(signal.severity)} /><span className="threat-contribution">+{signal.riskContribution}</span></div><strong>{signal.signalType}</strong><span>Store {signal.facilityId} · {signal.facilityName} · {signal.city}, {signal.state}</span><p>{signal.summary}</p><small>{signal.recommendedAction}</small><div className="threat-tags">{signal.sourceIds.map((source) => <span key={source}>{source}</span>)}{signal.bestPracticeRefs.map((ref) => <span key={ref}>{ref}</span>)}</div></article>;
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
