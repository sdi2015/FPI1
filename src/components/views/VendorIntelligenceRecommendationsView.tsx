import { useMemo, useState } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import { getScopedStoreIds, type StoreScopeState } from '../../data/storeScope';
import { filterVendors, formatNumber, formatScore, getCapabilityOptions, getTopVendorSolutions, scoreTone } from '../../data/vendorIntelligenceSelectors';
import type { ProviderReportDraft, SentryAssessmentRequest, VendorIntelligenceData, VendorSolution } from '../../data/vendorIntelligenceTypes';
import { useVendorIntelligenceData } from '../../data/useVendorIntelligenceData';

export type VendorIntelligenceRecommendationsViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type VendorTab = 'overview' | 'recommendations' | 'reports' | 'assessments' | 'directory' | 'governance';

const tabs: Array<{ id: VendorTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'SENTRY' },
  { id: 'recommendations', label: 'Recommendations', eyebrow: 'Solve' },
  { id: 'reports', label: 'Provider Reports', eyebrow: 'Store' },
  { id: 'assessments', label: 'Assessments', eyebrow: 'Request' },
  { id: 'directory', label: 'Vendor Directory', eyebrow: 'Tracker' },
  { id: 'governance', label: 'Governance', eyebrow: 'Controls' },
];

export function VendorIntelligenceRecommendationsView({ fireSites, storeScope, onChangeScopeRequest }: VendorIntelligenceRecommendationsViewProps) {
  const [activeTab, setActiveTab] = useState<VendorTab>('overview');
  const vendorState = useVendorIntelligenceData();
  const scopedStoreIds = useMemo(() => getScopedStoreIds(fireSites, storeScope), [fireSites, storeScope]);

  return (
    <section className="vendor-page" aria-label="Vendor Intelligence and Recommendations">
      <header className="vendor-header">
     <div>
          <p className="vendor-eyebrow">SENTRY-sponsored vendor intelligence</p>
          <h1>Vendor Intelligence & Recommendations</h1>
          <p>Store-accessible workspace for provider feedback, SENTRY assessment requests, and named vendor recommendations mapped to facility protection issues.</p>
        </div>
        <div className="vendor-mode"><span>SPONSORED BY</span>SENTRY</div>
      </header>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {vendorState.loading ? <StatePanel title="Loading SENTRY vendor intelligence" message="Preparing Emerging Tech Tracker records, recommendations, and assessment workflow templates." /> : null}
      {vendorState.error ? <StatePanel title="SENTRY vendor data unavailable" message={vendorState.error} danger /> : null}

      {vendorState.data ? (
        <>
          <nav className="vendor-tab-bar" aria-label="Vendor Intelligence and Recommendations sub tabs">
            {tabs.map((tab) => <button className={activeTab === tab.id ? 'vendor-tab active' : 'vendor-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}><span>{tab.eyebrow}</span>{tab.label}</button>)}
          </nav>
          {activeTab === 'overview' ? <VendorOverview data={vendorState.data} scopedStoreCount={scopedStoreIds.length || fireSites.length} /> : null}
          {activeTab === 'recommendations' ? <Recommendations data={vendorState.data} /> : null}
          {activeTab === 'reports' ? <ProviderReports data={vendorState.data} fireSites={fireSites} storeScope={storeScope} /> : null}
          {activeTab === 'assessments' ? <AssessmentRequests data={vendorState.data} fireSites={fireSites} storeScope={storeScope} /> : null}
          {activeTab === 'directory' ? <VendorDirectory vendors={vendorState.data.vendors} /> : null}
          {activeTab === 'governance' ? <VendorGovernance data={vendorState.data} /> : null}
        </>
      ) : null}
    </section>
  );
}

function VendorOverview({ data, scopedStoreCount }: { data: VendorIntelligenceData; scopedStoreCount: number }) {
  const topVendors = getTopVendorSolutions(data.vendors, 6);
  return (
    <>
      <section className="vendor-kpi-grid" aria-label="SENTRY vendor intelligence KPIs">
        <Kpi label="Recommended" value={formatNumber(data.summary.recommendedCandidates)} detail="Score 70+ candidates" tone="white" />
        <Kpi label="Assessed" value={formatNumber(data.summary.assessedSolutions)} detail="Assessment or status present" tone="yellow" />
        <Kpi label="Tracked vendors" value={formatNumber(data.summary.trackedVendors)} detail="Named companies in SENTRY trackers" tone="blue" />
        <Kpi label="Store scope" value={formatNumber(scopedStoreCount)} detail="Can submit provider feedback" tone="yellow" />
      </section>

      <section className="vendor-focus-strip" aria-label="Vendor intelligence operating model">
        <article><span>01</span><strong>Report provider performance</strong><small>Store users can prepare good or bad current-provider reports using an API-ready payload.</small></article>
        <article><span>02</span><strong>Request SENTRY assessment</strong><small>Prospective vendors can be routed into a simulated SENTRY assessment queue for evaluation.</small></article>
        <article><span>03</span><strong>Match issue to vendors</strong><small>FPI issues map to named candidates from SENTRY-sponsored tracker intelligence.</small></article>
      </section>

      <section className="vendor-grid">
        <section className="vendor-card wide"><CardHeading eyebrow="Top named candidates" title="Highest scoring SENTRY tracker solutions" pill="SENTRY" tone="ready" /><VendorMiniList vendors={topVendors} /></section>
        <section className="vendor-card"><CardHeading eyebrow="Capability mix" title="Mapped capability areas" /><ChartRows rows={data.capabilityCounts} /></section>
        <section className="vendor-card"><CardHeading eyebrow="Category mix" title="Tracker categories" /><ChartRows rows={data.categoryCounts} /></section>
        <section className="vendor-card wide"><CardHeading eyebrow="Program positioning" title="Sponsored by SENTRY, operationalized by FPI" pill="NO WRITEBACK" tone="watch" /><p>{data.metadata.governanceNote}</p><div className="vendor-metric-grid"><Metric label="Sponsor" value={data.metadata.sponsor} helper="Displayed in FPI as source sponsorship" /><Metric label="Recommended" value={formatNumber(data.summary.recommendedCandidates)} helper="Candidates scoring 70+" /><Metric label="Assessed" value={formatNumber(data.summary.assessedSolutions)} helper="Assessment or status present" /><Metric label="Mode" value="API-ready" helper="Reports and requests are workflow seams" /></div></section>
      </section>
    </>
  );
}

function Recommendations({ data }: { data: VendorIntelligenceData }) {
  return <section className="vendor-grid">{data.solutionPlays.map((play) => <section className="vendor-card wide" key={play.playId}><CardHeading eyebrow={play.capabilityTag} title={play.issue} pill={`${play.recommendedCandidates.length} CANDIDATES`} tone="ready" /><p>{play.whenToUse}</p><div className="vendor-candidate-grid">{play.recommendedCandidates.map((candidate) => <article className="vendor-candidate" key={candidate.vendorId}><div><strong>{candidate.company}</strong><StatusPill label={formatScore(candidate.recommendationScore)} tone={scoreTone(candidate.recommendationScore)} /></div><span>{candidate.technologyProduct}</span><small>{candidate.category} · {candidate.maturityLevel}</small><p>{candidate.rationale}</p><div className="vendor-tags">{candidate.capabilityTags.map((tag) => <span key={tag}>{tag}</span>)}</div></article>)}</div></section>)}</section>;
}

function ProviderReports({ data, fireSites, storeScope }: { data: VendorIntelligenceData; fireSites: FireAlarmSite[]; storeScope: StoreScopeState }) {
  const storeIds = getScopedStoreIds(fireSites, storeScope);
  const availableStoreIds = storeIds.length ? storeIds : fireSites.map((site) => site.id);
  const [draft, setDraft] = useState<ProviderReportDraft>({ facilityId: availableStoreIds[0] ?? '', providerName: '', reportType: data.providerReportTemplate.reportTypes[0] ?? 'Service Concern', rating: '3', summary: '', impact: '', requestedFollowUp: 'Review with SENTRY / FPI vendor intelligence' });
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  function update<K extends keyof ProviderReportDraft>(key: K, value: ProviderReportDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function preparePayload() {
    setPayload({
      payloadType: 'fpi.vendorProviderReport.v1',
      apiStatus: data.providerReportTemplate.apiStatus,
      sponsor: 'SENTRY',
      submittedAt: new Date().toISOString(),
      report: draft,
    });
  }

  return (
    <section className="vendor-grid">
      <section className="vendor-card wide"><CardHeading eyebrow="Store provider feedback" title="Create a good or bad current-provider report" pill="API SEAM" tone="watch" /><p>Reports are prepared as structured payloads for future backend/SENTRY workflow integration. This shell does not submit to production systems.</p><div className="vendor-form-grid"><label>Store<select value={draft.facilityId} onChange={(event) => update('facilityId', event.target.value)}>{availableStoreIds.map((id) => <option value={id} key={id}>Store {id}</option>)}</select></label><label>Provider name<input value={draft.providerName} onChange={(event) => update('providerName', event.target.value)} placeholder="Current security provider" /></label><label>Report type<select value={draft.reportType} onChange={(event) => update('reportType', event.target.value)}>{data.providerReportTemplate.reportTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label><label>Rating<select value={draft.rating} onChange={(event) => update('rating', event.target.value)}><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Mixed</option><option value="2">2 - Concern</option><option value="1">1 - Critical Concern</option></select></label><label className="wide">Summary<textarea value={draft.summary} onChange={(event) => update('summary', event.target.value)} placeholder="What happened? What went well or poorly?" /></label><label className="wide">Impact<textarea value={draft.impact} onChange={(event) => update('impact', event.target.value)} placeholder="Store impact, safety impact, evidence gap, SLA issue, or positive outcome" /></label><label className="wide">Requested follow-up<input value={draft.requestedFollowUp} onChange={(event) => update('requestedFollowUp', event.target.value)} /></label></div><button className="vendor-primary-button" type="button" onClick={preparePayload}>Prepare report payload</button></section>
      <section className="vendor-card"><CardHeading eyebrow="Prepared report" title="Submission readiness summary" />{payload ? <div className="vendor-payload-summary"><p>Provider report prepared for future backend submission. No production system was updated.</p><div className="vendor-metric-grid single"><Metric label="Facility" value={String(draft.facilityId || 'Not selected')} helper="Selected reporting store" /><Metric label="Provider" value={draft.providerName || 'Not provided'} helper={draft.reportType} /><Metric label="Rating" value={draft.rating} helper="User-entered assessment" /></div><details><summary>Show technical payload</summary><pre className="vendor-payload">{JSON.stringify(payload, null, 2)}</pre></details></div> : <p>No report prepared yet. Complete the report form and prepare the API-ready payload.</p>}</section>
    </section>
  );
}

function AssessmentRequests({ data, fireSites, storeScope }: { data: VendorIntelligenceData; fireSites: FireAlarmSite[]; storeScope: StoreScopeState }) {
  const [queue, setQueue] = useState<SentryAssessmentRequest[]>(data.assessmentQueue);
  const [vendorName, setVendorName] = useState('');
  const [product, setProduct] = useState('');
  const [reason, setReason] = useState('');
  const storeIds = getScopedStoreIds(fireSites, storeScope);
  const storeContext = storeIds.length ? `${storeIds.length} scoped stores` : 'All canonical FPI stores';

  function addRequest() {
    if (!vendorName.trim() || !product.trim()) return;
    const next: SentryAssessmentRequest = { requestId: `SA-DEMO-${queue.length + 1}`, company: vendorName.trim(), technologyProduct: product.trim(), requestedBy: 'FPI Store / Market User', storeContext, status: 'Intake Draft', priority: 'Medium', reason: reason.trim() || 'Prospective vendor assessment requested through SENTRY.', createdAt: new Date().toISOString() };
    setQueue([next, ...queue]);
    setVendorName('');
    setProduct('');
    setReason('');
  }

  return <section className="vendor-grid"><section className="vendor-card"><CardHeading eyebrow="Prospective vendor" title="Request SENTRY assessment" pill="SIMULATED" tone="watch" /><div className="vendor-form-grid single"><label>Vendor / company<input value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor name" /></label><label>Product / service<input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="Technology or service" /></label><label>Assessment reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What issue should this vendor solve?" /></label></div><button className="vendor-primary-button" type="button" onClick={addRequest}>Add to simulated SENTRY queue</button></section><section className="vendor-card wide"><CardHeading eyebrow="SENTRY assessment queue" title="Assessment requests and tracker candidates" /><div className="vendor-table-wrap"><table className="vendor-table"><thead><tr><th>Request</th><th>Vendor</th><th>Status</th><th>Priority</th><th>Store context</th><th>Reason</th></tr></thead><tbody>{queue.map((request) => <tr key={request.requestId}><td><strong>{request.requestId}</strong><small>{new Date(request.createdAt).toLocaleDateString()}</small></td><td>{request.company}<small>{request.technologyProduct}</small></td><td><StatusPill label={request.status} tone={request.status.includes('Pending') ? 'watch' : 'stable'} /></td><td>{request.priority}</td><td>{request.storeContext}</td><td>{request.reason}</td></tr>)}</tbody></table></div></section></section>;
}

function VendorDirectory({ vendors }: { vendors: VendorSolution[] }) {
  const [search, setSearch] = useState('');
  const [capability, setCapability] = useState('all');
  const capabilities = useMemo(() => getCapabilityOptions(vendors), [vendors]);
  const rows = useMemo(() => filterVendors(vendors, search, capability).slice(0, 50), [vendors, search, capability]);
  return <section className="vendor-card"><div className="vendor-directory-header"><div><p className="vendor-eyebrow">SENTRY tracker directory</p><h2>Top matching vendor and solution candidates</h2></div><strong>{rows.length} shown</strong></div><div className="vendor-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, product, category, use case" /><select value={capability} onChange={(event) => setCapability(event.target.value)}><option value="all">All capabilities</option>{capabilities.map((item) => <option value={item} key={item}>{item}</option>)}</select></div><div className="vendor-table-wrap"><table className="vendor-table"><thead><tr><th>Score</th><th>Company</th><th>Product</th><th>Category</th><th>Capabilities</th><th>Assessment</th><th>Source</th></tr></thead><tbody>{rows.map((vendor) => <VendorRow vendor={vendor} key={vendor.id} />)}</tbody></table></div></section>;
}

function VendorGovernance({ data }: { data: VendorIntelligenceData }) {
  return <section className="vendor-grid"><section className="vendor-card wide"><CardHeading eyebrow="SENTRY sponsorship" title="How FPI should present and govern vendor intelligence" pill="CONTROLLED" tone="critical" /><p>FPI should clearly state that this vendor intelligence is sponsored by SENTRY. Store-level reporting and assessment requests should route through approved workflow services before production use.</p><ul className="vendor-note-list"><li>Show SENTRY sponsorship wherever vendor candidates or assessment options appear.</li><li>Separate store feedback from formal vendor performance determinations until reviewed.</li><li>Role-gate sensitive vendor evaluations, commercial terms, assessment notes, and legal/procurement detail.</li><li>Require backend workflow approval before submitting provider reports or SENTRY assessment requests.</li><li>Preserve audit trail: submitter, facility, provider, report type, rating, evidence, and review status.</li></ul></section><section className="vendor-card"><CardHeading eyebrow="Source files" title="Tracker imports" />{data.metadata.sourceFiles.map((file) => <article className="vendor-record" key={file}><strong>{file}</strong><span>SENTRY Emerging Tech Tracker source</span></article>)}</section></section>;
}

function VendorMiniList({ vendors }: { vendors: VendorSolution[] }) {
  return <div className="vendor-mini-list">{vendors.map((vendor) => <article key={vendor.id}><div className="vendor-score"><strong>{formatScore(vendor.recommendationScore)}</strong><span>score</span></div><div><strong>{vendor.company}</strong><span>{vendor.technologyProduct}</span><small>{vendor.category} · {vendor.maturityLevel}</small></div></article>)}</div>;
}

function VendorRow({ vendor }: { vendor: VendorSolution }) {
  return <tr><td><StatusPill label={formatScore(vendor.recommendationScore)} tone={scoreTone(vendor.recommendationScore)} /></td><td><strong>{vendor.company}</strong><small>{vendor.dateTracked || 'Date unavailable'}</small></td><td>{vendor.technologyProduct}<small>{vendor.maturityLevel}</small></td><td>{vendor.category}</td><td>{vendor.capabilityTags.map((tag) => <small key={tag}>{tag}</small>)}</td><td>{vendor.assessmentStatus}<small>{vendor.analysisCompleted || vendor.initialAssessmentResults || 'Assessment detail pending'}</small></td><td>{vendor.sourceWorkbook}<small>{vendor.sourceSheet}</small></td></tr>;
}

function ChartRows({ rows }: { rows: Array<[string, number]> }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return <div className="vendor-chart-rows">{rows.map(([label, value]) => <div className="vendor-chart-row" key={label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><div><span style={{ width: `${Math.max(5, (value / max) * 100)}%` }} /></div></div>)}</div>;
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'yellow' | 'sky' | 'white' }) {
  return <article className={`vendor-kpi tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function CardHeading({ eyebrow, title, pill, tone = 'stable' }: { eyebrow: string; title: string; pill?: string; tone?: StatusTone }) {
  return <div className="vendor-card-heading"><div><p className="vendor-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{pill ? <StatusPill label={pill} tone={tone} /> : null}</div>;
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="vendor-card vendor-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}
