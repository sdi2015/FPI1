import { useEffect, useMemo, useState } from 'react';
import { ScopeContextChip } from '../ScopeContextChip';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyExternalCoordinationScope } from '../../data/externalCoordinationScope';
import { formatNumber, readinessTone, riskTone } from '../../data/externalCoordinationSelectors';
import type { ExternalAgencyContact, ExternalCoordinationData, ExternalCoordinationFacility } from '../../data/externalCoordinationTypes';
import { useExternalCoordinationData } from '../../data/useExternalCoordinationData';

export type ExternalCoordinationViewProps = {
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

type CoordinationTab = 'overview' | 'programs' | 'contacts' | 'da' | 'matrix' | 'vendors' | 'adapter';

type LegacyWorkflow = 'ELM' | 'FPP' | 'SRM' | 'Multiple' | 'New FPI Workflow';
type CoordinationStatus = 'Open' | 'In Progress' | 'Evidence Requested' | 'Escalated' | 'Complete';
type CoordinationPriority = 'P1' | 'P2' | 'P3';

type CoordinationActionItem = {
  id: string;
  priority: CoordinationPriority;
  facilityId: string;
  facilityName: string;
  marketRegion: string;
  coordinationType: string;
  externalParty: string;
  internalOwner: string;
  legacyWorkflow: LegacyWorkflow;
  relatedIncidentSignal: string;
  evidenceNeeded: string;
  status: CoordinationStatus;
  dueDate: string;
  lastContactDate: string;
  nextStep: string;
  notes: string;
  escalated: boolean;
  evidenceRequested: boolean;
};

type CoordinationFilters = {
  search: string;
  store: string;
  market: string;
  priority: string;
  status: string;
  coordinationType: string;
  externalParty: string;
  owner: string;
  legacyWorkflow: string;
  overdueOnly: boolean;
  evidenceNeededOnly: boolean;
  escalatedOnly: boolean;
};

const coordinationOwners = ['FPI Operations', 'AP Market Manager', 'Technical Controls', 'Legal / ELM Liaison', 'Security Operations', 'Vendor Manager'];
const legacyWorkflows: LegacyWorkflow[] = ['ELM', 'FPP', 'SRM', 'Multiple', 'New FPI Workflow'];
const coordinationStatuses: CoordinationStatus[] = ['Open', 'In Progress', 'Evidence Requested', 'Escalated', 'Complete'];
const coordinationPriorities: CoordinationPriority[] = ['P1', 'P2', 'P3'];

type ProgramSource = {
  id: 'ELM' | 'SRM' | 'FPP';
  name: string;
  purpose: string;
  associateUse: string;
  usefulFields: string[];
  status: 'Adapter Needed' | 'Reference Ready';
};

const programSources: ProgramSource[] = [
  { id: 'ELM', name: 'Enterprise Legal Management', purpose: 'Legal matter, evidence request, subpoena, preservation, and prosecutor coordination context.', associateUse: 'Helps associates understand if an incident has legal handoff requirements, evidence preservation needs, or DA/prosecutor follow-up.', usefulFields: ['Matter / case reference', 'Agency or prosecutor request', 'Evidence preservation status', 'Legal hold indicator', 'Response owner'] , status: 'Adapter Needed' },
  { id: 'SRM', name: 'Security Risk Management', purpose: 'Security incident, repeat offender, AP escalation, threat pattern, and risk disposition context.', associateUse: 'Helps field and AP teams understand repeat patterns, current risk posture, and whether external coordination is warranted.', usefulFields: ['Incident pattern', 'Threat category', 'Repeat event count', 'AP / market owner', 'Escalation disposition'], status: 'Adapter Needed' },
  { id: 'FPP', name: 'Facility Protection Program', purpose: 'Facility controls, life-safety posture, technical remediation, and protection readiness context.', associateUse: 'Helps associates connect external coordination to facility protection gaps, camera/alarm readiness, work queue status, and evidence availability.', usefulFields: ['Facility risk tier', 'Open protection work', 'Camera / alarm readiness', 'Life-safety status', 'Vendor or technician dependency'], status: 'Reference Ready' },
];

const tabs: Array<{ id: CoordinationTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'Coordination' },
  { id: 'programs', label: 'Program Intel', eyebrow: 'ELM/SRM/FPP' },
  { id: 'contacts', label: 'LE Contacts', eyebrow: 'Police/Sheriff' },
  { id: 'da', label: 'DA / Prosecutor', eyebrow: 'Jurisdiction' },
  { id: 'matrix', label: 'Escalation Matrix', eyebrow: 'Handoff' },
  { id: 'vendors', label: 'Security Vendors', eyebrow: 'Partners' },
  { id: 'adapter', label: 'Live Lookup', eyebrow: 'Code Puppy' },
];

export function ExternalCoordinationView({ fireSites, storeScope, onChangeScopeRequest }: ExternalCoordinationViewProps) {
  const [activeTab, setActiveTab] = useState<CoordinationTab>('overview');
  const state = useExternalCoordinationData();
  const scopedData = useMemo(() => (state.data ? applyExternalCoordinationScope(state.data, fireSites, storeScope) : null), [state.data, fireSites, storeScope]);

  return (
    <section className="external-page" aria-label="Law Enforcement, Security Vendor Analysis, and External Coordination">
      <header className="external-header">
        <div>
          <p className="external-eyebrow">Law enforcement, DA, and security partner readiness</p>
          <h1>External Coordination Center</h1>
          <p>FPI workspace for consolidating external coordination workflows historically handled across ELM, FPP, and SRM. Track law enforcement, prosecutor/DA, vendor, evidence, technical-control, and incident-intelligence actions for the selected facility scope.</p>
        </div>
        <div className="external-mode"><span>MODE</span>FPI WORKSPACE</div>
      </header>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      {state.loading ? <StatePanel title="Loading external coordination data" message="Preparing law enforcement, prosecutor, and security partner contact cards for the current store scope." /> : null}
      {state.error ? <StatePanel title="External coordination data unavailable" message={state.error} danger /> : null}

      {scopedData ? (
        <>
          <nav className="external-tab-bar" aria-label="External Coordination sub tabs">
            {tabs.map((tab) => <button className={activeTab === tab.id ? 'external-tab active' : 'external-tab'} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}><span>{tab.eyebrow}</span>{tab.label}</button>)}
          </nav>
          {activeTab === 'overview' ? <Overview data={scopedData} /> : null}
          {activeTab === 'programs' ? <ProgramIntelligence data={scopedData} /> : null}
          {activeTab === 'contacts' ? <ContactDirectory facilities={scopedData.facilities} /> : null}
          {activeTab === 'da' ? <ProsecutorCards facilities={scopedData.facilities} /> : null}
          {activeTab === 'matrix' ? <EscalationMatrix data={scopedData} /> : null}
          {activeTab === 'vendors' ? <SecurityVendors facilities={scopedData.facilities} /> : null}
          {activeTab === 'adapter' ? <LiveLookupAdapter data={scopedData} /> : null}
        </>
      ) : null}
    </section>
  );
}

function Overview({ data }: { data: ExternalCoordinationData }) {
  const [items, setItems] = useState<CoordinationActionItem[]>(() => buildCoordinationItems(data));
  const [filters, setFilters] = useState<CoordinationFilters>({
    search: '',
    store: 'all',
    market: 'all',
    priority: 'all',
    status: 'all',
    coordinationType: 'all',
    externalParty: 'all',
    owner: 'all',
    legacyWorkflow: 'all',
    overdueOnly: false,
    evidenceNeededOnly: false,
    escalatedOnly: false,
  });
  const [draft, setDraft] = useState<CoordinationActionItem | null>(null);

  useEffect(() => {
    setItems(buildCoordinationItems(data));
    setDraft(null);
  }, [data]);

  const today = todayIso();
  const filteredItems = useMemo(() => filterCoordinationItems(items, filters, today), [items, filters, today]);
  const openItems = items.filter((item) => item.status !== 'Complete');
  const overdueCount = openItems.filter((item) => item.dueDate < today).length;
  const evidenceCount = openItems.filter((item) => item.evidenceRequested || item.evidenceNeeded.length > 0).length;
  const escalatedCount = openItems.filter((item) => item.escalated || item.status === 'Escalated').length;

  const filterOptions = useMemo(() => ({
    stores: unique(items.map((item) => `${item.facilityName} (${item.facilityId})`)),
    markets: unique(items.map((item) => item.marketRegion)),
    coordinationTypes: unique(items.map((item) => item.coordinationType)),
    externalParties: unique(items.map((item) => item.externalParty)),
    owners: unique(items.map((item) => item.internalOwner)),
  }), [items]);

  function updateItem(id: string, patch: Partial<CoordinationActionItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <>
      <section className="external-kpi-grid" aria-label="External coordination KPIs">
        <Kpi label="Open Actions" value={formatNumber(openItems.length)} detail="Active FPI coordination records" tone="blue" />
        <Kpi label="Escalated" value={formatNumber(escalatedCount)} detail="Leadership or legal attention" tone="yellow" />
        <Kpi label="Evidence Needed" value={formatNumber(evidenceCount)} detail="Requests, packets, footage, reports" tone="sky" />
        <Kpi label="Overdue" value={formatNumber(overdueCount)} detail="Past due and not complete" tone="white" />
      </section>

      <section className="external-grid">
        <section className="external-card wide external-program-hero">
          <CardHeading eyebrow="FPI operating model" title="External Coordination Center" pill="ELM / FPP / SRM CONSOLIDATED" tone="ready" />
          <p>
            FPI centralizes external coordination into one workspace so associates can see legal/evidence actions from ELM,
            protection-readiness actions from FPP, and security-risk actions from SRM without switching between disconnected queues.
            This view remains scoped to selected stores and does not write to external systems.
          </p>
        </section>

        <LegacyWorkflowConsolidation items={items} />
        <ProgramSourcePanel compact />
      </section>

      <section className="external-card wide external-coordination-workspace" aria-labelledby="coordination-table-title">
        <div className="external-directory-header">
          <div>
            <p className="external-eyebrow">Action tracking</p>
            <h2 id="coordination-table-title">Main coordination queue</h2>
          </div>
          <strong>{filteredItems.length} of {items.length} records</strong>
        </div>
        <CoordinationFiltersPanel filters={filters} options={filterOptions} onChange={setFilters} />
        <CoordinationTable items={filteredItems} onUpdate={updateItem} onPrepareDraft={setDraft} />
      </section>

      {draft ? <CoordinationDraftPanel item={draft} onClose={() => setDraft(null)} /> : null}
    </>
  );
}

function LegacyWorkflowConsolidation({ items }: { items: CoordinationActionItem[] }) {
  const openItems = items.filter((item) => item.status !== 'Complete');
  const counts = legacyWorkflows.map((workflow) => ({
    workflow,
    count: openItems.filter((item) => item.legacyWorkflow === workflow || (workflow !== 'New FPI Workflow' && item.legacyWorkflow === 'Multiple')).length,
  }));

  return (
    <section className="external-card external-legacy-panel">
      <CardHeading eyebrow="Legacy Workflow Consolidation" title="FPI centralizes ELM, FPP, and SRM coordination" pill="ONE WORKSPACE" tone="watch" />
      <p>Open actions are tracked in one FPI queue while preserving which legacy workflow is being replaced or consolidated.</p>
      <div className="external-legacy-grid">
        {counts.map((item) => (
          <div key={item.workflow}>
            <span>{item.workflow}</span>
            <strong>{item.count}</strong>
            <small>open actions</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoordinationFiltersPanel({
  filters,
  options,
  onChange,
}: {
  filters: CoordinationFilters;
  options: { stores: string[]; markets: string[]; coordinationTypes: string[]; externalParties: string[]; owners: string[] };
  onChange: (filters: CoordinationFilters) => void;
}) {
  const update = (patch: Partial<CoordinationFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="external-filter-panel" aria-label="External coordination filters">
      <input type="search" value={filters.search} onChange={(event) => update({ search: event.target.value })} placeholder="Search store, market, issue, agency, owner, evidence, next step, notes..." />
      <select value={filters.store} onChange={(event) => update({ store: event.target.value })} aria-label="Filter by store">
        <option value="all">All stores</option>
        {options.stores.map((store) => <option key={store} value={store}>{store}</option>)}
      </select>
      <select value={filters.market} onChange={(event) => update({ market: event.target.value })} aria-label="Filter by market or region">
        <option value="all">All markets / regions</option>
        {options.markets.map((market) => <option key={market} value={market}>{market}</option>)}
      </select>
      <select value={filters.priority} onChange={(event) => update({ priority: event.target.value })} aria-label="Filter by priority">
        <option value="all">All priorities</option>
        {coordinationPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
      </select>
      <select value={filters.status} onChange={(event) => update({ status: event.target.value })} aria-label="Filter by status">
        <option value="all">All statuses</option>
        {coordinationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <select value={filters.coordinationType} onChange={(event) => update({ coordinationType: event.target.value })} aria-label="Filter by coordination type">
        <option value="all">All coordination types</option>
        {options.coordinationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <select value={filters.externalParty} onChange={(event) => update({ externalParty: event.target.value })} aria-label="Filter by external party">
        <option value="all">All external parties</option>
        {options.externalParties.map((party) => <option key={party} value={party}>{party}</option>)}
      </select>
      <select value={filters.owner} onChange={(event) => update({ owner: event.target.value })} aria-label="Filter by owner">
        <option value="all">All owners</option>
        {unique([...coordinationOwners, ...options.owners]).map((owner) => <option key={owner} value={owner}>{owner}</option>)}
      </select>
      <select value={filters.legacyWorkflow} onChange={(event) => update({ legacyWorkflow: event.target.value })} aria-label="Filter by legacy workflow replaced">
        <option value="all">All legacy workflows</option>
        {legacyWorkflows.map((workflow) => <option key={workflow} value={workflow}>{workflow}</option>)}
      </select>
      <label><input type="checkbox" checked={filters.overdueOnly} onChange={(event) => update({ overdueOnly: event.target.checked })} /> Overdue only</label>
      <label><input type="checkbox" checked={filters.evidenceNeededOnly} onChange={(event) => update({ evidenceNeededOnly: event.target.checked })} /> Evidence needed</label>
      <label><input type="checkbox" checked={filters.escalatedOnly} onChange={(event) => update({ escalatedOnly: event.target.checked })} /> Escalated only</label>
    </div>
  );
}

function CoordinationTable({
  items,
  onUpdate,
  onPrepareDraft,
}: {
  items: CoordinationActionItem[];
  onUpdate: (id: string, patch: Partial<CoordinationActionItem>) => void;
  onPrepareDraft: (item: CoordinationActionItem) => void;
}) {
  return (
    <div className="external-table-wrap external-coordination-table-wrap">
      <table className="external-table external-coordination-table">
        <thead>
          <tr>
            <th>Priority</th><th>Store / Facility</th><th>Market / Region</th><th>Coordination Type</th><th>External Party</th><th>Internal Owner</th><th>Legacy Workflow Replaced</th><th>Related Incident / Signal</th><th>Evidence Needed</th><th>Status</th><th>Due Date</th><th>Last Contact</th><th>Next Step</th><th>Notes</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? items.map((item) => (
            <tr key={item.id} className={item.escalated || item.status === 'Escalated' ? 'external-row-escalated' : undefined}>
              <td><StatusPill label={item.priority} tone={priorityTone(item.priority)} /></td>
              <td><strong>{item.facilityName}</strong><small>{item.facilityId}</small></td>
              <td>{item.marketRegion}</td>
              <td>{item.coordinationType}</td>
              <td>{item.externalParty}</td>
              <td><select value={item.internalOwner} onChange={(event) => onUpdate(item.id, { internalOwner: event.target.value })}>{coordinationOwners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></td>
              <td><StatusPill label={item.legacyWorkflow} tone={item.legacyWorkflow === 'Multiple' ? 'critical' : 'watch'} /></td>
              <td>{item.relatedIncidentSignal}</td>
              <td><label className="external-inline-check"><input type="checkbox" checked={item.evidenceRequested} onChange={(event) => onUpdate(item.id, { evidenceRequested: event.target.checked, status: event.target.checked ? 'Evidence Requested' : item.status })} /> {item.evidenceNeeded}</label></td>
              <td><select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as CoordinationStatus, escalated: event.target.value === 'Escalated' ? true : item.escalated })}>{coordinationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
              <td><input type="date" value={item.dueDate} onChange={(event) => onUpdate(item.id, { dueDate: event.target.value })} /></td>
              <td><input type="date" value={item.lastContactDate} onChange={(event) => onUpdate(item.id, { lastContactDate: event.target.value })} /></td>
              <td><textarea value={item.nextStep} onChange={(event) => onUpdate(item.id, { nextStep: event.target.value })} rows={3} /></td>
              <td><textarea value={item.notes} onChange={(event) => onUpdate(item.id, { notes: event.target.value })} placeholder="Add annotation..." rows={3} /></td>
              <td>
                <div className="external-row-actions">
                  <button type="button" onClick={() => onPrepareDraft(item)}>Prepare Coordination Draft</button>
                  <button type="button" onClick={() => onUpdate(item.id, { escalated: true, status: 'Escalated' })}>Escalate</button>
                  <button type="button" onClick={() => onUpdate(item.id, { status: item.status === 'Complete' ? 'Open' : 'Complete' })}>{item.status === 'Complete' ? 'Reopen' : 'Complete'}</button>
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan={15}>No matching coordination records found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CoordinationDraftPanel({ item, onClose }: { item: CoordinationActionItem; onClose: () => void }) {
  return (
    <section className="external-card wide external-draft-panel" aria-labelledby="coordination-draft-title">
      <div className="external-directory-header">
        <div><p className="external-eyebrow">Coordination brief</p><h2 id="coordination-draft-title">Prepared Coordination Draft</h2></div>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <div className="external-draft-grid">
        <Metric label="Store" value={`${item.facilityName} (${item.facilityId})`} helper={item.marketRegion} />
        <Metric label="Issue Summary" value={item.relatedIncidentSignal} helper={item.coordinationType} />
        <Metric label="External Party" value={item.externalParty} helper="Verify contact before outreach" />
        <Metric label="Internal Owner" value={item.internalOwner} helper="Accountable FPI owner" />
        <Metric label="Evidence Needed" value={item.evidenceNeeded} helper={item.evidenceRequested ? 'Evidence requested' : 'Request not yet marked'} />
        <Metric label="Recommended Next Step" value={item.nextStep} helper="Editable in the queue" />
        <Metric label="Due Date" value={item.dueDate} helper="Coordination target" />
        <Metric label="Legacy Workflow Replaced" value={item.legacyWorkflow} helper="ELM / FPP / SRM consolidation field" />
      </div>
    </section>
  );
}

function ProgramIntelligence({ data }: { data: ExternalCoordinationData }) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const sourceRows = useMemo(() => programSources.filter((source) => !term || [source.id, source.name, source.purpose, source.associateUse, source.status, ...source.usefulFields].join(' ').toLowerCase().includes(term)), [term]);
  const facilityRows = useMemo(() => data.facilities.filter((facility) => !term || [facility.facilityId, facility.facilityName, facility.city, facility.state, facility.county, facility.region, facility.riskTier, facility.coordinationReadiness, facility.escalationReason, facility.recommendedNextStep, facility.primaryAgency.name, facility.prosecutor.name].join(' ').toLowerCase().includes(term)), [data.facilities, term]);
  const requestRows = useMemo(() => data.coordinationRequests.filter((request) => !term || [request.requestId, request.facilityId, request.facilityName, request.type, request.status, request.priority, request.summary, request.nextStep].join(' ').toLowerCase().includes(term)), [data.coordinationRequests, term]);

  return <section className="external-grid"><section className="external-card wide external-program-hero"><CardHeading eyebrow="Program intelligence layer" title="ELM, SRM, and FPP context for associate coordination" pill="ADAPTER READY" tone="watch" /><p>This view does not write to ELM, SRM, FPP, law enforcement, or legal systems. It defines the safer intake model FPI should use so Walmart associates can see legal, security-risk, and facility-protection context in one coordination workspace once approved feeds are connected.</p><div className="external-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs, store, county, agency, request, risk, evidence, legal hold..." aria-label="Search external coordination program intelligence" /></div></section><ProgramSourcePanel sources={sourceRows} /><section className="external-card wide"><CardHeading eyebrow="Associate resource view" title="Facility context synthesized from coordination data" pill={`${facilityRows.length} STORES`} tone="stable" /><div className="external-table-wrap"><table className="external-table"><thead><tr><th>Store</th><th>FPP context</th><th>SRM context</th><th>ELM context</th><th>Associate next step</th></tr></thead><tbody>{facilityRows.length ? facilityRows.map((facility) => <tr key={facility.facilityId}><td><strong>{facility.facilityName}</strong><small>{facility.city}, {facility.state} · {facility.county}</small></td><td><StatusPill label={facility.riskTier} tone={riskTone(facility.riskTier)} /><small>Risk score {facility.riskScore}</small></td><td><StatusPill label={facility.coordinationReadiness} tone={readinessTone(facility.coordinationReadiness)} /><small>{facility.escalationReason}</small></td><td><strong>{facility.prosecutor.name}</strong><small>Verify matter/legal hold in approved ELM source before action.</small></td><td>{facility.recommendedNextStep}</td></tr>) : <tr><td colSpan={5}>No matching facility context found.</td></tr>}</tbody></table></div></section><section className="external-card wide"><CardHeading eyebrow="Coordination queue" title="Requests enriched by program context" pill={`${requestRows.length} RECORDS`} tone="watch" /><div className="external-table-wrap"><table className="external-table"><thead><tr><th>Priority</th><th>Store</th><th>Program lens</th><th>Status</th><th>Summary</th><th>Next step</th></tr></thead><tbody>{requestRows.length ? requestRows.map((request) => <tr key={request.requestId}><td>{request.priority}</td><td><strong>{request.facilityName}</strong><small>{request.facilityId}</small></td><td><ProgramLens requestType={request.type} /></td><td><StatusPill label={request.status} tone="watch" /></td><td>{request.summary}</td><td>{request.nextStep}</td></tr>) : <tr><td colSpan={6}>No matching coordination records found.</td></tr>}</tbody></table></div></section></section>;
}

function ProgramSourcePanel({ sources = programSources, compact = false }: { sources?: ProgramSource[]; compact?: boolean }) {
  return <section className={compact ? 'external-card external-program-sources' : 'external-card wide external-program-sources'}><CardHeading eyebrow="Program sources" title="Information FPI should ingest for better associate guidance" pill="ELM / SRM / FPP" tone="ready" /><div className="external-program-source-grid">{sources.map((source) => <article className="external-program-source" key={source.id}><div><strong>{source.id}</strong><span>{source.name}</span></div><StatusPill label={source.status} tone={source.status === 'Reference Ready' ? 'ready' : 'watch'} /><p>{compact ? source.purpose : source.associateUse}</p>{compact ? null : <small>Useful fields: {source.usefulFields.join(', ')}</small>}</article>)}</div>{sources.length ? null : <p>No matching program sources found.</p>}</section>;
}

function ProgramLens({ requestType }: { requestType: string }) {
  const lowerType = requestType.toLowerCase();
  const lenses = ['FPP'];
  if (lowerType.includes('evidence') || lowerType.includes('prosecutor') || lowerType.includes('law')) lenses.push('ELM');
  if (lowerType.includes('risk') || lowerType.includes('threat') || lowerType.includes('incident') || lowerType.includes('escalation')) lenses.push('SRM');
  return <div className="external-program-lens">{Array.from(new Set(lenses)).map((lens) => <span key={lens}>{lens}</span>)}</div>;
}

function ContactDirectory({ facilities }: { facilities: ExternalCoordinationFacility[] }) {
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return facilities.filter((facility) => !term || [facility.facilityId, facility.city, facility.state, facility.county, facility.primaryAgency.name, facility.sheriffAgency.name].join(' ').toLowerCase().includes(term));
  }, [facilities, search]);
  return <section className="external-card"><div className="external-directory-header"><div><p className="external-eyebrow">Police / sheriff contacts</p><h2>Law enforcement contact cards by store</h2></div><strong>{rows.length} stores</strong></div><div className="external-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store, city, county, agency" /></div><div className="external-contact-grid">{rows.map((facility) => <FacilityContactCard facility={facility} key={facility.facilityId} />)}</div></section>;
}

function ProsecutorCards({ facilities }: { facilities: ExternalCoordinationFacility[] }) {
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return facilities.filter((facility) => !term || [facility.facilityId, facility.facilityName, facility.city, facility.state, facility.county, facility.prosecutor.name, facility.prosecutor.type, facility.prosecutor.address, facility.prosecutor.phone, facility.recommendedNextStep].join(' ').toLowerCase().includes(term));
  }, [facilities, search]);
  return <><section className="external-card wide"><div className="external-directory-header"><div><p className="external-eyebrow">DA / prosecutor search</p><h2>Find jurisdiction and evidence handoff contacts</h2></div><strong>{rows.length} stores</strong></div><div className="external-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search store, county, prosecutor, address, phone, next step" /></div></section><section className="external-grid">{rows.length ? rows.map((facility) => <section className="external-card" key={facility.facilityId}><CardHeading eyebrow={`Store ${facility.facilityId} · ${facility.county}`} title={facility.prosecutor.name} pill={facility.prosecutor.type.toUpperCase()} tone="stable" /><ContactBlock contact={facility.prosecutor} /><p>{facility.recommendedNextStep}</p></section>) : <section className="external-card wide"><h2>No matching prosecutor records</h2><p>Try a different store, county, prosecutor office, or contact detail.</p></section>}</section></>;
}

function EscalationMatrix({ data }: { data: ExternalCoordinationData }) {
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.coordinationRequests.filter((request) => !term || [request.requestId, request.facilityId, request.facilityName, request.type, request.status, request.priority, request.summary, request.nextStep].join(' ').toLowerCase().includes(term));
  }, [data.coordinationRequests, search]);
  return <section className="external-card"><div className="external-directory-header"><div><p className="external-eyebrow">Escalation and evidence handoff matrix</p><h2>Store coordination queue</h2></div><strong>{rows.length} records</strong></div><div className="external-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request, store, priority, type, status, summary, next step" /></div><div className="external-table-wrap"><table className="external-table"><thead><tr><th>Priority</th><th>Store</th><th>Type</th><th>Status</th><th>Summary</th><th>Next step</th></tr></thead><tbody>{rows.length ? rows.map((request) => <tr key={request.requestId}><td>{request.priority}</td><td><strong>{request.facilityName}</strong><small>{request.facilityId}</small></td><td>{request.type}</td><td><StatusPill label={request.status} tone="watch" /></td><td>{request.summary}</td><td>{request.nextStep}</td></tr>) : <tr><td colSpan={6}>No matching coordination records found.</td></tr>}</tbody></table></div></section>;
}

function SecurityVendors({ facilities }: { facilities: ExternalCoordinationFacility[] }) {
  const [search, setSearch] = useState('');
  const partners = facilities[0]?.securityVendorPartners ?? [];
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return partners.filter((partner) => !term || [partner.partnerId, partner.name, partner.type, partner.coverage, partner.coordinationUse, partner.status].join(' ').toLowerCase().includes(term));
  }, [partners, search]);
  return <><section className="external-card wide"><div className="external-directory-header"><div><p className="external-eyebrow">Security vendor search</p><h2>Find vendor coordination resources</h2></div><strong>{rows.length} partners</strong></div><div className="external-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendor, coverage, status, use case" /></div></section><section className="external-grid">{rows.length ? rows.map((partner) => <section className="external-card" key={partner.partnerId}><CardHeading eyebrow={partner.type} title={partner.name} pill={partner.status.toUpperCase()} tone={partner.status.includes('SENTRY') ? 'ready' : 'watch'} /><p>{partner.coverage}</p><p>{partner.coordinationUse}</p></section>) : <section className="external-card wide"><h2>No matching security vendor resources</h2><p>Try a different partner, coverage type, or use case.</p></section>}</section></>;
}

function LiveLookupAdapter({ data }: { data: ExternalCoordinationData }) {
  return <section className="external-grid"><section className="external-card wide"><CardHeading eyebrow="Approved live lookup seam" title="Code Puppy/internal geospatial public-safety lookup adapter" pill="NOT CONNECTED" tone="critical" /><p>{data.metadata.lookupStatus}</p><div className="external-metric-grid"><Metric label="Desired adapter" value={data.metadata.desiredLiveAdapter} helper="Awaiting approved endpoint/tool details" /><Metric label="Scope key" value={data.metadata.scopeKey} helper="Use canonical store facility_id" /><Metric label="Mode" value={data.metadata.dataMode} helper="Seeded public reference plus adapter-ready fields" /><Metric label="Generated" value={new Date(data.metadata.generatedAt).toLocaleDateString()} helper="Local JSON build" /></div></section><section className="external-card"><CardHeading eyebrow="Required response fields" title="What the live tool should return" /><ul className="external-note-list"><li>Agency name, type, jurisdiction, address, public phone, website.</li><li>DA/prosecutor office name, type, address, public phone, website.</li><li>Distance from selected store and source freshness timestamp.</li><li>Confidence level and source attribution.</li><li>Do not expose sensitive/personal contacts unless source and role access are approved.</li></ul></section></section>;
}

function buildCoordinationItems(data: ExternalCoordinationData): CoordinationActionItem[] {
  const requestsByFacility = new Map(data.coordinationRequests.map((request) => [request.facilityId, request]));
  return data.facilities.map((facility, index) => {
    const request = requestsByFacility.get(facility.facilityId);
    const coordinationType = normalizeCoordinationType(request?.type, facility);
    const legacyWorkflow = legacyWorkflowFor(coordinationType, request?.summary ?? facility.escalationReason);
    const evidenceNeeded = evidenceFor(coordinationType);
    const priority = priorityFor(facility, request?.priority);
    const lastContactDate = addDaysIso(-1 * ((index % 5) + 1));
    return {
      id: request?.requestId ?? `FPI-EXT-${facility.facilityId}`,
      priority,
      facilityId: facility.facilityId,
      facilityName: facility.facilityName,
      marketRegion: `${facility.county} · ${facility.region}`,
      coordinationType,
      externalParty: externalPartyFor(coordinationType, facility),
      internalOwner: ownerFor(coordinationType),
      legacyWorkflow,
      relatedIncidentSignal: request?.summary ?? facility.escalationReason,
      evidenceNeeded,
      status: statusFor(facility.coordinationReadiness, request?.status),
      dueDate: addDaysIso(priority === 'P1' ? 1 : priority === 'P2' ? 3 : 7),
      lastContactDate,
      nextStep: nextStepFor(coordinationType, facility.recommendedNextStep),
      notes: `Seeded from ${legacyWorkflow} context. ${facility.escalationReason}`,
      escalated: facility.coordinationReadiness === 'Escalated' || request?.priority === 'High',
      evidenceRequested: false,
    };
  });
}

function filterCoordinationItems(items: CoordinationActionItem[], filters: CoordinationFilters, today: string): CoordinationActionItem[] {
  const term = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    const storeLabel = `${item.facilityName} (${item.facilityId})`;
    const searchable = [item.priority, item.facilityId, item.facilityName, item.marketRegion, item.coordinationType, item.externalParty, item.internalOwner, item.legacyWorkflow, item.relatedIncidentSignal, item.evidenceNeeded, item.status, item.dueDate, item.lastContactDate, item.nextStep, item.notes].join(' ').toLowerCase();
    return (!term || searchable.includes(term))
      && (filters.store === 'all' || filters.store === storeLabel)
      && (filters.market === 'all' || filters.market === item.marketRegion)
      && (filters.priority === 'all' || filters.priority === item.priority)
      && (filters.status === 'all' || filters.status === item.status)
      && (filters.coordinationType === 'all' || filters.coordinationType === item.coordinationType)
      && (filters.externalParty === 'all' || filters.externalParty === item.externalParty)
      && (filters.owner === 'all' || filters.owner === item.internalOwner)
      && (filters.legacyWorkflow === 'all' || filters.legacyWorkflow === item.legacyWorkflow)
      && (!filters.overdueOnly || (item.status !== 'Complete' && item.dueDate < today))
      && (!filters.evidenceNeededOnly || item.evidenceRequested || item.evidenceNeeded.length > 0)
      && (!filters.escalatedOnly || item.escalated || item.status === 'Escalated');
  });
}

function normalizeCoordinationType(type: string | undefined, facility: ExternalCoordinationFacility): string {
  const text = `${type ?? ''} ${facility.escalationReason} ${facility.recommendedNextStep}`.toLowerCase();
  if (text.includes('parking')) return 'Parking Lot Safety / Patrol Coordination';
  if (text.includes('theft') || text.includes('orc') || text.includes('repeat')) return 'Repeat Theft / ORC Coordination';
  if (text.includes('camera') || text.includes('alarm') || text.includes('technical') || text.includes('control')) return 'Technical Control Failure';
  if (text.includes('evidence') || text.includes('prosecutor') || text.includes('da')) return 'Evidence / Prosecutor Handoff';
  if (facility.coordinationReadiness === 'Escalated') return 'Escalated External Coordination';
  return type ?? 'External Agency Coordination';
}

function nextStepFor(coordinationType: string, fallback: string): string {
  const type = coordinationType.toLowerCase();
  if (type.includes('parking')) return 'Recommend guard patrol, drones, mobile surveillance, lighting review, and law enforcement coordination.';
  if (type.includes('theft') || type.includes('orc')) return 'Recommend AP/FPI leadership review, law enforcement liaison, evidence package, provider camera review, and incident intelligence summary.';
  if (type.includes('technical')) return 'Recommend provider service ticket, controls governance follow-up, and evidence request.';
  return fallback;
}

function evidenceFor(coordinationType: string): string {
  const type = coordinationType.toLowerCase();
  if (type.includes('parking')) return 'Parking lot incident summary, patrol logs, camera clips, lighting photos';
  if (type.includes('theft') || type.includes('orc')) return 'Incident intelligence summary, case numbers, footage, AP narrative, suspect pattern';
  if (type.includes('technical')) return 'Service ticket, device health screenshot, outage timeline, vendor notes';
  if (type.includes('prosecutor') || type.includes('evidence')) return 'Evidence package, preservation status, case reference, legal request';
  return 'Incident summary, store contact, evidence checklist, recommended outreach path';
}

function legacyWorkflowFor(coordinationType: string, summary: string): LegacyWorkflow {
  const text = `${coordinationType} ${summary}`.toLowerCase();
  if ((text.includes('technical') || text.includes('control')) && (text.includes('evidence') || text.includes('incident'))) return 'Multiple';
  if (text.includes('prosecutor') || text.includes('evidence') || text.includes('legal')) return 'ELM';
  if (text.includes('technical') || text.includes('camera') || text.includes('alarm') || text.includes('parking')) return 'FPP';
  if (text.includes('orc') || text.includes('theft') || text.includes('risk') || text.includes('incident')) return 'SRM';
  return 'New FPI Workflow';
}

function ownerFor(coordinationType: string): string {
  const type = coordinationType.toLowerCase();
  if (type.includes('technical')) return 'Technical Controls';
  if (type.includes('prosecutor') || type.includes('evidence')) return 'Legal / ELM Liaison';
  if (type.includes('theft') || type.includes('orc')) return 'Security Operations';
  if (type.includes('parking')) return 'AP Market Manager';
  return 'FPI Operations';
}

function externalPartyFor(coordinationType: string, facility: ExternalCoordinationFacility): string {
  const type = coordinationType.toLowerCase();
  if (type.includes('prosecutor') || type.includes('evidence')) return facility.prosecutor.name;
  if (type.includes('technical')) return facility.securityVendorPartners[0]?.name ?? 'Security / technical provider';
  if (type.includes('parking') || type.includes('theft') || type.includes('orc')) return facility.primaryAgency.name;
  return facility.primaryAgency.name;
}

function priorityFor(facility: ExternalCoordinationFacility, requestPriority?: 'High' | 'Medium' | 'Low'): CoordinationPriority {
  if (requestPriority === 'High' || facility.coordinationReadiness === 'Escalated' || facility.riskTier === 'Critical') return 'P1';
  if (requestPriority === 'Medium' || facility.coordinationReadiness === 'Review' || facility.riskTier === 'High') return 'P2';
  return 'P3';
}

function statusFor(readiness: ExternalCoordinationFacility['coordinationReadiness'], requestStatus?: string): CoordinationStatus {
  if (readiness === 'Escalated') return 'Escalated';
  if (requestStatus?.toLowerCase().includes('evidence')) return 'Evidence Requested';
  if (requestStatus?.toLowerCase().includes('progress') || readiness === 'Review') return 'In Progress';
  return 'Open';
}

function priorityTone(priority: CoordinationPriority): StatusTone {
  if (priority === 'P1') return 'critical';
  if (priority === 'P2') return 'watch';
  return 'stable';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function FacilityReadinessList({ facilities }: { facilities: ExternalCoordinationFacility[] }) {
  return <div className="external-readiness-list">{facilities.map((facility) => <article key={facility.facilityId}><div><strong>Store {facility.facilityId} · {facility.city}, {facility.state}</strong><span>{facility.county} · {facility.escalationReason}</span><small>{facility.recommendedNextStep}</small></div><div><StatusPill label={facility.coordinationReadiness} tone={readinessTone(facility.coordinationReadiness)} /><StatusPill label={facility.riskTier} tone={riskTone(facility.riskTier)} /></div></article>)}</div>;
}

function FacilityContactCard({ facility }: { facility: ExternalCoordinationFacility }) {
  return <article className="external-contact-card"><div className="external-contact-heading"><div><strong>Store {facility.facilityId}</strong><span>{facility.city}, {facility.state} · {facility.county}</span></div><StatusPill label={facility.coordinationReadiness} tone={readinessTone(facility.coordinationReadiness)} /></div><ContactBlock contact={facility.primaryAgency} /><ContactBlock contact={facility.sheriffAgency} /></article>;
}

function ContactBlock({ contact }: { contact: ExternalAgencyContact }) {
  return <div className="external-contact-block"><strong>{contact.name}</strong><span>{contact.type}</span><small>{contact.address}</small><small>{contact.phone}</small>{contact.website ? <a href={contact.website} target="_blank" rel="noreferrer">Agency website</a> : null}</div>;
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'yellow' | 'sky' | 'white' }) {
  return <article className={`external-kpi tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function CardHeading({ eyebrow, title, pill, tone = 'stable' }: { eyebrow: string; title: string; pill?: string; tone?: StatusTone }) {
  return <div className="external-card-heading"><div><p className="external-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{pill ? <StatusPill label={pill} tone={tone} /> : null}</div>;
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="external-card external-state"><h2>{title}</h2><p className={danger ? 'danger' : ''}>{message}</p></section>;
}
