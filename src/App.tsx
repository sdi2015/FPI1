import { useEffect, useMemo, useState } from 'react';
import { FacilityDetailPanel } from './components/FacilityDetailPanel';
import { FireSystemServiceView } from './components/views/FireSystemServiceView';
import { PlaceholderServiceView } from './components/views/PlaceholderServiceView';
import { ReadinessOverviewView } from './components/views/ReadinessOverviewView';
import { getFacilityDetailModel } from './data/fpiSelectors';
import { calculateFpiDashboardMetrics } from './data/fpiMetrics';
import { applyFacilityScope, createAllFacilitiesScope, hasEmptySelectedScope, isFacilityInScope, type FacilityScopeState } from './data/fpiScope';
import { createAllStoresScope, type StoreScopeState } from './data/storeScope';
import { getServiceMetrics, type FpiServiceMetricsModel } from './data/fpiServiceMetrics';
import { capabilities, pillars, type Capability, type Pillar } from './data/program';
import { capabilityIdForService, serviceIdForCapability, SERVICE_IDS, type ServiceId } from './data/serviceIds';
import type { FpiDashboardMetrics, FpiKpi, FpiTopRiskFacility, StatusTone } from './data/fpiTypes';
import { useFpiProgramData, type FpiProgramDataState } from './data/useFpiProgramData';
import { useFireAlarmData } from './data/useFireAlarmData';

type Screen = 'landing' | 'dashboard';

const defaultServiceId = SERVICE_IDS.READINESS;

function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [selectedService, setSelectedService] = useState<ServiceId>(defaultServiceId);
  const fpiState = useFpiProgramData();

  const activeCapability = useMemo(
    () => capabilities.find((capability) => capability.id === capabilityIdForService(selectedService)) ?? capabilities[0],
    [selectedService],
  );

  if (screen === 'dashboard') {
    return (
      <DashboardShell
        selectedService={selectedService}
        onSelectService={setSelectedService}
        onBackToLanding={() => setScreen('landing')}
        activeCapability={activeCapability}
        fpiState={fpiState}
      />
    );
  }

  return <Landing onEnter={() => setScreen('dashboard')} />;
}

function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="landing-shell">
      <section className="hero-panel">
        <div className="hero-content">
          <div className="brand-row" aria-label="FPI program brand">
            <span className="spark-mark">✦</span>
            <span>Facility Protection Intelligence</span>
          </div>

          <p className="eyebrow">FPI Program Command Center • Synthetic shell UI</p>
          <h1>Protection intelligence built for fast leadership decisions.</h1>
          <p className="hero-copy">
            A command-center experience for ingesting protection signals, profiling facility posture, governing evidence,
            and coordinating the work that moves critical risk down.
          </p>

          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={onEnter}>
              Enter dashboard
            </button>
            <a className="ghost-button" href="#program-pillars">
              Explore program model
            </a>
          </div>

          <div className="trust-strip" aria-label="Program highlights">
            <span>Mock data only</span>
            <span>FPI-ready shell</span>
            <span>Governance-first</span>
          </div>

          <div className="hero-metrics" aria-label="FPI operating snapshot">
            <div>
              <span>INTAKE</span>
              <strong>86%</strong>
              <small>normalized</small>
            </div>
            <div>
              <span>POSTURE</span>
              <strong>1.2K</strong>
              <small>profiles</small>
            </div>
            <div>
              <span>ACTION</span>
              <strong>91%</strong>
              <small>SLA track</small>
            </div>
          </div>
        </div>

        <div className="hero-visual" aria-label="FPI readiness overview">
          <div className="orbital-card top-card">
            <span>Risk score</span>
            <strong>812</strong>
            <small>elevated watch</small>
          </div>
          <div className="radar-core">
            <div className="radar-ring ring-one" />
            <div className="radar-ring ring-two" />
            <div className="radar-ring ring-three" />
            <div className="radar-dot dot-one" />
            <div className="radar-dot dot-two" />
            <div className="radar-dot dot-three" />
            <span>FPI</span>
          </div>
          <div className="orbital-card bottom-card">
            <span>Readiness</span>
            <strong>94%</strong>
            <small>executive view</small>
          </div>
        </div>
      </section>

      <section className="pillars-section" id="program-pillars">
        <div className="section-heading">
          <p className="eyebrow">Operating model</p>
          <h2>Three foundations for the FPI program.</h2>
          <p>
            The first build establishes the experience architecture so each service area can receive richer workflows,
            evidence views, and integrations over time.
          </p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="pillar-card" key={pillar.id}>
              <div>
                <p className="eyebrow">{pillar.signal}</p>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={pillar.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${pillar.title} ${pillar.progress}%`}
              >
                <span style={{ width: `${pillar.progress}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="capability-preview">
        <div className="section-heading compact">
          <p className="eyebrow">Service coverage</p>
          <h2>Initial shell covers every FPI service touchpoint.</h2>
        </div>
        <div className="preview-grid">
          {capabilities.map((capability) => (
            <article className="preview-card" key={capability.id}>
              <span>{capability.eyebrow}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function DashboardShell({
  selectedService,
  activeCapability,
  onSelectService,
  onBackToLanding,
  fpiState,
}: {
  selectedService: ServiceId;
  activeCapability: Capability;
  onSelectService: (id: ServiceId) => void;
  onBackToLanding: () => void;
  fpiState: FpiProgramDataState;
}) {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [facilityScope, setFacilityScope] = useState<FacilityScopeState>(createAllFacilitiesScope());
  const [storeScope, setStoreScope] = useState<StoreScopeState>(createAllStoresScope());
  const fireAlarmState = useFireAlarmData();
  const globalMetrics = fpiState.data?.dashboardMetrics;
  const programData = fpiState.data?.programData;
  const scopedProgramData = useMemo(
    () => (programData ? applyFacilityScope(programData, facilityScope) : null),
    [programData, facilityScope],
  );
  const metrics = useMemo(
    () => (scopedProgramData ? calculateFpiDashboardMetrics(scopedProgramData) : globalMetrics),
    [scopedProgramData, globalMetrics],
  );
  const isEmptyScope = hasEmptySelectedScope(facilityScope);
  const selectedFacility = useMemo(
    () => (scopedProgramData && selectedFacilityId ? getFacilityDetailModel(scopedProgramData, selectedFacilityId) : null),
    [scopedProgramData, selectedFacilityId],
  );
  const serviceMetrics = useMemo(
    () => (scopedProgramData ? getServiceMetrics(scopedProgramData, activeCapability.id, activeCapability.title) : null),
    [scopedProgramData, activeCapability.id, activeCapability.title],
  );

  useEffect(() => {
    if (!selectedFacilityId) return;
    if (!isFacilityInScope(selectedFacilityId, facilityScope)) {
      setSelectedFacilityId(null);
    }
  }, [facilityScope, selectedFacilityId]);

  function handleCapabilitySelect(capabilityId: string) {
    onSelectService(serviceIdForCapability(capabilityId));
  }

  function handleChangeStoreScopeRequest() {
    onSelectService(SERVICE_IDS.READINESS);
  }

  return (
    <div className="dashboard-shell">
      <SidebarNav selectedService={selectedService} onSelectService={onSelectService} onBackToLanding={onBackToLanding} />

      <main className="dashboard-content" aria-label="FPI facility protection dashboard">
        {fpiState.loading ? <DashboardStatePanel title="Loading FPI master data" message="Preparing the local master JSON dataset and calculating dashboard metrics." /> : null}
        {fpiState.error ? <DashboardStatePanel title="Dashboard data is unavailable" message={fpiState.error} tone="critical" /> : null}
        {!fpiState.loading && !fpiState.error && !metrics ? (
          <DashboardStatePanel title="No dashboard data" message="The master dataset loaded but did not produce a dashboard model." tone="watch" />
        ) : null}

        {metrics && programData && scopedProgramData ? (
          <>
            {isEmptyScope ? (
              <>
                <PlaceholderServiceView
                  title={activeCapability.title}
                  description={activeCapability.description}
                  facilities={programData.facilities}
                  fireSites={fireAlarmState.data?.sites ?? []}
                  storeScope={storeScope}
                  onChangeScopeRequest={handleChangeStoreScopeRequest}
                />
                <DashboardStatePanel
                  title="No facilities selected"
                  message="Select one or more stores to view dashboard metrics, service posture, and operational records."
                  tone="watch"
                />
              </>
            ) : selectedService === SERVICE_IDS.READINESS ? (
              <ReadinessOverviewView
                facilities={programData.facilities}
                fireSites={fireAlarmState.data?.sites ?? []}
                storeScope={storeScope}
                dashboardMetrics={metrics}
                activeCapability={activeCapability}
                serviceMetrics={serviceMetrics}
                onStoreScopeChange={setStoreScope}
                onFacilitySelect={setSelectedFacilityId}
                onCapabilitySelect={handleCapabilitySelect}
              />
            ) : selectedService === SERVICE_IDS.FIRE_SYSTEM ? (
              <FireSystemServiceView
                programData={scopedProgramData}
                      facilities={programData.facilities}
                fireAlarmData={fireAlarmState.data}
                fireAlarmLoading={fireAlarmState.loading}
                fireAlarmError={fireAlarmState.error}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
                onFacilitySelect={setSelectedFacilityId}
              />
            ) : (
              <PlaceholderServiceView
                title={activeCapability.title}
                description={activeCapability.description}
                facilities={programData.facilities}
                fireSites={fireAlarmState.data?.sites ?? []}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            )}
            <FacilityDetailPanel facility={selectedFacility} onClose={() => setSelectedFacilityId(null)} />
          </>
        ) : null}
      </main>
    </div>
  );
}

function SidebarNav({
  selectedService,
  onSelectService,
  onBackToLanding,
}: {
  selectedService: ServiceId;
  onSelectService: (id: ServiceId) => void;
  onBackToLanding: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="FPI dashboard navigation">
      <button className="logo-button" type="button" onClick={onBackToLanding} aria-label="Back to landing page">
        <span className="spark-mark">✦</span>
        <span>
          FPI
          <small>Command Center</small>
        </span>
      </button>

      <nav aria-label="Program service navigation">
        <p className="nav-label">Program services</p>
        {capabilities.map((capability) => {
          const serviceId = serviceIdForCapability(capability.id);
          return (
            <button
              className={serviceId === selectedService ? 'nav-item active' : 'nav-item'}
              key={capability.id}
              type="button"
              aria-current={serviceId === selectedService ? 'page' : undefined}
              onClick={() => onSelectService(serviceId)}
            >
              <span>{capability.eyebrow}</span>
              {capability.title}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function DashboardStatePanel({ title, message, tone = 'stable' }: { title: string; message: string; tone?: StatusTone }) {
  return (
    <section className="panel dashboard-state-panel" role={tone === 'critical' ? 'alert' : 'status'}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">Data foundation</p>
          <h1>{title}</h1>
        </div>
        <StatusPill label={tone === 'critical' ? 'ERROR' : 'STATUS'} tone={tone} />
      </div>
      <p>{message}</p>
    </section>
  );
}

function HeroSummary({ metrics }: { metrics: FpiDashboardMetrics }) {
  return (
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">FPI data-backed dashboard</p>
        <h1>Facility protection posture overview</h1>
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
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pillar.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pillar.signal}: ${pillar.progress}% complete`}
      >
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

function SelectedServiceCard({
  activeCapability,
  serviceMetrics,
}: {
  activeCapability: Capability;
  serviceMetrics: FpiServiceMetricsModel | null;
}) {
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
        {!serviceMetrics ? (
          <div>
            <span>Service metrics</span>
            <strong>Loading</strong>
          </div>
        ) : null}
      </div>
      <div className="service-meta-grid service-context-grid">
        <div>
          <span>Primary metric</span>
          <strong>{activeCapability.metric}</strong>
        </div>
        <div>
          <span>Accountable owner</span>
          <strong>{activeCapability.owner}</strong>
        </div>
        <div>
          <span>Next build</span>
          <strong>Detail workflow</strong>
        </div>
      </div>
      <div className="action-row" aria-label="Selected service actions">
        <button type="button">View workflow</button>
        <button type="button">Review partners</button>
        <button type="button">Open exceptions</button>
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
          <span
            key={band.label}
            style={{ width: `${band.value}%`, background: band.color }}
            aria-label={`${band.label} ${band.value}%`}
          >
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
      <div className="card-heading">
        <div>
          <p className="eyebrow">Operating cadence</p>
          <h2 id="signals-title">Latest program signals</h2>
        </div>
      </div>
      <ol className="activity-list">
        {metrics.latestSignals.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function ServiceAreaBuildout({
  activeCapabilityId,
  onSelectCapability,
}: {
  activeCapabilityId: string;
  onSelectCapability: (id: string) => void;
}) {
  return (
    <section className="panel module-map-panel" aria-labelledby="service-buildout-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Capability map</p>
          <h2 id="service-buildout-title">Service area buildout</h2>
        </div>
      </div>
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

function TopRiskFacilities({
  facilities,
  onSelectFacility,
}: {
  facilities: FpiTopRiskFacility[];
  onSelectFacility: (facilityId: string) => void;
}) {
  return (
    <section className="panel top-risk-panel" aria-labelledby="top-risk-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Facility posture</p>
          <h2 id="top-risk-title">Top-risk facilities</h2>
        </div>
        <StatusPill label="LIVE" tone="watch" />
      </div>
      <div className="top-risk-list">
        {facilities.map((facility) => (
          <button
            className="top-risk-item"
            type="button"
            key={facility.facilityId}
            onClick={() => onSelectFacility(facility.facilityId)}
            aria-label={`Open detail for ${facility.facilityName}`}
          >
            <div>
              <strong>{facility.facilityName}</strong>
              <span>{facility.region} • {facility.market}</span>
            </div>
            <StatusPill label={facility.riskTier.toUpperCase()} tone={riskTierTone(facility.riskTier)} />
            <p>
              {facility.activeSignals} active signals · {facility.criticalExceptions} critical exceptions ·{' '}
              {facility.openWorkItems} open work items
            </p>
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

export default App;
