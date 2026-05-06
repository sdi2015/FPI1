import { useMemo, useState } from 'react';
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

type CoordinationTab = 'overview' | 'contacts' | 'da' | 'matrix' | 'vendors' | 'adapter';

const tabs: Array<{ id: CoordinationTab; label: string; eyebrow: string }> = [
  { id: 'overview', label: 'Overview', eyebrow: 'Coordination' },
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
          <h1>External Coordination Intelligence</h1>
          <p>Store-level view of nearby law enforcement, sheriff, prosecutor/DA information, security vendor coordination paths, and evidence handoff readiness for selected facilities.</p>
        </div>
        <div className="external-mode"><span>MODE</span>VIEW ONLY</div>
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
  return (
    <>
      <section className="external-kpi-grid" aria-label="External coordination KPIs">
        <Kpi label="Escalated" value={formatNumber(data.summary.escalatedFacilities)} detail="Critical coordination review" tone="yellow" />
        <Kpi label="Review" value={formatNumber(data.summary.reviewFacilities)} detail="Repeat/severe incident context" tone="blue" />
        <Kpi label="Agency contacts" value={formatNumber(data.summary.agencyContacts)} detail="Police, sheriff, DA/prosecutor" tone="sky" />
        <Kpi label="DA contacts" value={formatNumber(data.summary.prosecutorContacts)} detail="Jurisdiction cards" tone="yellow" />
      </section>
      <section className="external-grid">
        <section className="external-card wide"><CardHeading eyebrow="Selected stores" title="Coordination readiness by facility" pill="VIEW ONLY" tone="watch" /><FacilityReadinessList facilities={data.facilities} /></section>
        <section className="external-card"><CardHeading eyebrow="Playbooks" title="External handoff paths" />{data.playbooks.map((playbook) => <article className="external-record" key={playbook.id}><strong>{playbook.title}</strong><span>{playbook.recommendedPath}</span><small>Evidence: {playbook.evidenceNeeded.join(', ')}</small></article>)}</section>
        <section className="external-card"><CardHeading eyebrow="Governance" title="Verify before operational use" pill="VERIFY" tone="critical" /><p>{data.metadata.governanceNote}</p><p>{data.metadata.lookupStatus}</p></section>
      </section>
    </>
  );
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
  return <section className="external-grid">{facilities.map((facility) => <section className="external-card" key={facility.facilityId}><CardHeading eyebrow={`Store ${facility.facilityId} · ${facility.county}`} title={facility.prosecutor.name} pill={facility.prosecutor.type.toUpperCase()} tone="stable" /><ContactBlock contact={facility.prosecutor} /><p>{facility.recommendedNextStep}</p></section>)}</section>;
}

function EscalationMatrix({ data }: { data: ExternalCoordinationData }) {
  return <section className="external-card"><div className="external-directory-header"><div><p className="external-eyebrow">Escalation and evidence handoff matrix</p><h2>Store coordination queue</h2></div><strong>{data.coordinationRequests.length} records</strong></div><div className="external-table-wrap"><table className="external-table"><thead><tr><th>Priority</th><th>Store</th><th>Type</th><th>Status</th><th>Summary</th><th>Next step</th></tr></thead><tbody>{data.coordinationRequests.map((request) => <tr key={request.requestId}><td>{request.priority}</td><td><strong>{request.facilityName}</strong><small>{request.facilityId}</small></td><td>{request.type}</td><td><StatusPill label={request.status} tone="watch" /></td><td>{request.summary}</td><td>{request.nextStep}</td></tr>)}</tbody></table></div></section>;
}

function SecurityVendors({ facilities }: { facilities: ExternalCoordinationFacility[] }) {
  const partners = facilities[0]?.securityVendorPartners ?? [];
  return <section className="external-grid">{partners.map((partner) => <section className="external-card" key={partner.partnerId}><CardHeading eyebrow={partner.type} title={partner.name} pill={partner.status.toUpperCase()} tone={partner.status.includes('SENTRY') ? 'ready' : 'watch'} /><p>{partner.coverage}</p><p>{partner.coordinationUse}</p></section>)}</section>;
}

function LiveLookupAdapter({ data }: { data: ExternalCoordinationData }) {
  return <section className="external-grid"><section className="external-card wide"><CardHeading eyebrow="Approved live lookup seam" title="Code Puppy/internal geospatial public-safety lookup adapter" pill="NOT CONNECTED" tone="critical" /><p>{data.metadata.lookupStatus}</p><div className="external-metric-grid"><Metric label="Desired adapter" value={data.metadata.desiredLiveAdapter} helper="Awaiting approved endpoint/tool details" /><Metric label="Scope key" value={data.metadata.scopeKey} helper="Use canonical store facility_id" /><Metric label="Mode" value={data.metadata.dataMode} helper="Seeded public reference plus adapter-ready fields" /><Metric label="Generated" value={new Date(data.metadata.generatedAt).toLocaleDateString()} helper="Local JSON build" /></div></section><section className="external-card"><CardHeading eyebrow="Required response fields" title="What the live tool should return" /><ul className="external-note-list"><li>Agency name, type, jurisdiction, address, public phone, website.</li><li>DA/prosecutor office name, type, address, public phone, website.</li><li>Distance from selected store and source freshness timestamp.</li><li>Confidence level and source attribution.</li><li>Do not expose sensitive/personal contacts unless source and role access are approved.</li></ul></section></section>;
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
