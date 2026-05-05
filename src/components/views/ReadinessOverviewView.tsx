import { LockedScopeSummary } from '../LockedScopeSummary';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import { capabilities, pillars, type Capability, type Pillar } from '../../data/program';
import type { FpiDashboardMetrics, FpiFacility, FpiKpi, FpiTopRiskFacility, StatusTone } from '../../data/fpiTypes';
import type { FpiServiceMetricsModel } from '../../data/fpiServiceMetrics';
import type { StoreScopeState } from '../../data/storeScope';

export type ReadinessOverviewViewProps = {
  facilities: FpiFacility[];
  dashboardMetrics: FpiDashboardMetrics;
  activeCapability: Capability;
  serviceMetrics: FpiServiceMetricsModel | null;
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
  onFacilitySelect: (facilityId: string) => void;
  onCapabilitySelect: (capabilityId: string) => void;
};

export function ReadinessOverviewView({
  facilities,
  dashboardMetrics,
  activeCapability,
  serviceMetrics,
  fireSites,
  storeScope,
  onChangeScopeRequest,
  onFacilitySelect,
  onCapabilitySelect,
}: ReadinessOverviewViewProps) {
  return (
    <>
      <HeroSummary metrics={dashboardMetrics} />
      <LockedScopeSummary sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      <ExecutiveStatusStrip metrics={dashboardMetrics} />

      <section className="progress-grid" aria-label="FPI program progress indicators">
        {pillars.map((pillar) => (
          <ProgressCard pillar={pillar} key={pillar.id} />
        ))}
      </section>

      <section className="kpi-grid" aria-label="Key FPI indicators">
        {dashboardMetrics.kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      <section className="dashboard-grid" aria-label="Dashboard operational detail">
        <SelectedServiceCard activeCapability={activeCapability} serviceMetrics={serviceMetrics} />
        <ReadinessDistribution metrics={dashboardMetrics} />
        <ProgramSignals metrics={dashboardMetrics} />
        <TopRiskFacilities facilities={dashboardMetrics.topRiskFacilities} onSelectFacility={onFacilitySelect} />
        <ServiceAreaBuildout activeCapabilityId={activeCapability.id} onSelectCapability={onCapabilitySelect} />
      </section>
    </>
  );
}

function HeroSummary({ metrics }: { metrics: FpiDashboardMetrics }) {
  return (
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">Command Center dashboard</p>
        <h1>Facility protection command center</h1>
        <p>
          {metrics.headline.split(metrics.overallStatus)[0]}
          <strong>{metrics.overallStatus}</strong>
          {metrics.headline.split(metrics.overallStatus).slice(1).join(metrics.overallStatus)}
        </p>
      </div>
      <div className="mode-pill" aria-label="Mode Synthetic data">
        <span>MODE</span>
        Synthetic data
      </div>
    </header>
  );
}

function ExecutiveStatusStrip({ metrics }: { metrics: FpiDashboardMetrics }) {
  return (
    <section className="executive-strip" aria-label="Executive status summary">
      {metrics.executiveStatus.map((item) => (
        <article className="executive-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <StatusPill label={item.trend} tone={item.tone} />
        </article>
      ))}
    </section>
  );
}

function ProgressCard({ pillar }: { pillar: Pillar }) {
  return (
    <article className="progress-card">
      <div className="card-heading compact-heading">
        <div>
          <p className="eyebrow">{pillar.signal}</p>
          <h2>{pillar.title}</h2>
        </div>
        <strong>{pillar.progress}%</strong>
      </div>
      <p>{pillar.description}</p>
      <div className="progress-track" role="progressbar" aria-valuenow={pillar.progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pillar.progress}%` }} />
      </div>
    </article>
  );
}

function KpiCard({ kpi }: { kpi: FpiKpi }) {
  const isPriority = kpi.label === 'Critical exceptions' || kpi.label === 'Panel trouble';

  return (
    <article className={isPriority ? 'kpi-card priority-kpi' : 'kpi-card'}>
      <div className="kpi-topline">
        <span>{kpi.label}</span>
        <StatusPill label={kpi.status} tone={kpi.tone} />
      </div>
      <strong>{kpi.value}</strong>
      <small>{kpi.trend}</small>
      <p>{kpi.caption}</p>
    </article>
  );
}

function SelectedServiceCard({ activeCapability, serviceMetrics }: { activeCapability: Capability; serviceMetrics: FpiServiceMetricsModel | null }) {
  return (
    <section className="panel selected-service-panel" aria-labelledby="selected-service-title">
      <div className="card-heading service-heading">
        <div>
          <p className="eyebrow">Selected service</p>
          <h2 id="selected-service-title">{activeCapability.title}</h2>
        </div>
        <StatusPill label={activeCapability.status.toUpperCase()} tone="watch" />
      </div>
      <p>{activeCapability.description}</p>
      <div className="service-meta-grid service-live-metrics">
        {(serviceMetrics?.metrics ?? []).map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.helperText ? <small>{metric.helperText}</small> : null}
          </div>
        ))}
      </div>
      <div className="service-meta-grid service-context-grid">
        <div><span>Primary metric</span><strong>{activeCapability.metric}</strong></div>
        <div><span>Accountable owner</span><strong>{activeCapability.owner}</strong></div>
        <div><span>Next build</span><strong>Detail workflow</strong></div>
      </div>
    </section>
  );
}

function ReadinessDistribution({ metrics }: { metrics: FpiDashboardMetrics }) {
  const summary = metrics.readinessDistribution.map((band) => `${band.label} ${band.value}%`).join(' / ');

  return (
    <section className="panel readiness-panel" aria-labelledby="readiness-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Risk-tier health</p>
          <h2 id="readiness-title">Readiness distribution</h2>
        </div>
        <span className="trend-note">Derived from facility risk tiers</span>
      </div>
      <p>{summary}.</p>
      <div className="bar-stack" role="img" aria-label={`Readiness distribution: ${summary}`}>
        {metrics.readinessDistribution.map((band) => (
          <span key={band.label} style={{ width: `${band.value}%`, background: band.color }}>
            {band.value >= 14 ? `${band.value}%` : ''}
          </span>
        ))}
      </div>
      <div className="band-list">
        {metrics.readinessDistribution.map((band) => (
          <div key={band.label}>
            <span style={{ background: band.color }} aria-hidden="true" />
            <p>{band.label}</p>
            <strong>{band.value}%</strong>
            <small>{band.count} facilities • {band.note}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProgramSignals({ metrics }: { metrics: FpiDashboardMetrics }) {
  return (
    <section className="panel activity-panel" aria-labelledby="signals-title">
      <div className="card-heading"><div><p className="eyebrow">Operating cadence</p><h2 id="signals-title">Latest program signals</h2></div></div>
      <ol className="activity-list">
        {metrics.latestSignals.map((item) => <li key={item}>{item}</li>)}
      </ol>
    </section>
  );
}

function ServiceAreaBuildout({ activeCapabilityId, onSelectCapability }: { activeCapabilityId: string; onSelectCapability: (id: string) => void }) {
  return (
    <section className="panel module-map-panel" aria-labelledby="service-buildout-title">
      <div className="card-heading"><div><p className="eyebrow">Capability map</p><h2 id="service-buildout-title">Service area buildout</h2></div></div>
      <div className="module-map">
        {capabilities.map((capability) => (
          <button
            type="button"
            key={capability.id}
            className={capability.id === activeCapabilityId ? 'module-chip active' : 'module-chip'}
            aria-pressed={capability.id === activeCapabilityId}
            onClick={() => onSelectCapability(capability.id)}
          >
            <StatusPill label={capability.status.toUpperCase()} tone={statusToneForCapability(capability.status)} />
            <strong>{capability.title}</strong>
            <small>{capability.metric} • {capability.owner}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function TopRiskFacilities({ facilities, onSelectFacility }: { facilities: FpiTopRiskFacility[]; onSelectFacility: (facilityId: string) => void }) {
  return (
    <section className="panel top-risk-panel" aria-labelledby="top-risk-title">
      <div className="card-heading"><div><p className="eyebrow">Facility posture</p><h2 id="top-risk-title">Top-risk facilities</h2></div><StatusPill label="LIVE" tone="watch" /></div>
      <div className="top-risk-list">
        {facilities.map((facility) => (
          <button className="top-risk-item" type="button" key={facility.facilityId} onClick={() => onSelectFacility(facility.facilityId)}>
            <div><strong>{facility.facilityName}</strong><span>{facility.region} • {facility.market}</span></div>
            <StatusPill label={facility.riskTier.toUpperCase()} tone={riskTierTone(facility.riskTier)} />
            <p>{facility.activeSignals} active signals · {facility.criticalExceptions} critical exceptions · {facility.openWorkItems} open work items</p>
            <small>Primary concern: {facility.primaryIssueType}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function riskTierTone(riskTier: FpiTopRiskFacility['riskTier']): StatusTone {
  if (riskTier === 'Critical') return 'critical';
  if (riskTier === 'High') return 'watch';
  if (riskTier === 'Medium') return 'stable';
  return 'ready';
}

function statusToneForCapability(status: Capability['status']): StatusTone {
  if (status === 'Ready') return 'ready';
  if (status === 'Buildout') return 'buildout';
  return 'watch';
}
