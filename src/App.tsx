import { useMemo, useState } from 'react';
import { activity, capabilities, kpis, pillars, type Capability, type Kpi, type Pillar } from './data/program';

type Screen = 'landing' | 'dashboard';
type StatusTone = 'ready' | 'watch' | 'buildout' | 'critical' | 'stable' | 'track' | 'expanding';

const readinessBands = [
  { label: 'Verified', value: 44, color: '#4DBDF5', tone: 'ready', note: '+6% this cycle' },
  { label: 'In review', value: 28, color: '#A9DDF7', tone: 'stable', note: 'verification queue' },
  { label: 'Needs action', value: 18, color: '#FFC220', tone: 'watch', note: 'owner review' },
  { label: 'Escalated', value: 10, color: '#FFFFFF', tone: 'critical', note: 'governance track' },
];

const executiveStatus = [
  { label: 'Overall Status', value: 'WATCH', tone: 'watch' as const, trend: 'program posture' },
  { label: 'Facilities Profiled', value: '1,284', tone: 'expanding' as const, trend: '+128 this cycle' },
  { label: 'Critical Exceptions', value: '37', tone: 'watch' as const, trend: '-11 WoW' },
  { label: 'Monitoring Uptime', value: '98.6%', tone: 'stable' as const, trend: '+0.8 pts' },
  { label: 'Remediation SLA', value: '91%', tone: 'track' as const, trend: 'on track' },
];

const kpiStatusByLabel: Record<string, { status: string; tone: StatusTone; caption: string }> = {
  'Facilities profiled': { status: 'EXPANDING', tone: 'expanding', caption: 'Coverage increasing across profiled facilities' },
  'Critical exceptions': { status: 'WATCH', tone: 'watch', caption: 'Priority exceptions remain under active governance' },
  'Monitoring uptime': { status: 'STABLE', tone: 'stable', caption: 'Monitoring availability is within expected range' },
  'Remediation SLAs': { status: 'ON TRACK', tone: 'track', caption: 'Remediation performance is meeting target' },
};

const defaultCapabilityId = 'external-coordination';

function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [activeCapabilityId, setActiveCapabilityId] = useState(defaultCapabilityId);

  const activeCapability = useMemo(
    () => capabilities.find((capability) => capability.id === activeCapabilityId) ?? capabilities[0],
    [activeCapabilityId],
  );

  if (screen === 'dashboard') {
    return (
      <DashboardShell
        activeCapabilityId={activeCapabilityId}
        onSelectCapability={setActiveCapabilityId}
        onBackToLanding={() => setScreen('landing')}
        activeCapability={activeCapability}
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
  activeCapabilityId,
  activeCapability,
  onSelectCapability,
  onBackToLanding,
}: {
  activeCapabilityId: string;
  activeCapability: Capability;
  onSelectCapability: (id: string) => void;
  onBackToLanding: () => void;
}) {
  return (
    <div className="dashboard-shell">
      <SidebarNav
        activeCapabilityId={activeCapabilityId}
        onSelectCapability={onSelectCapability}
        onBackToLanding={onBackToLanding}
      />

      <main className="dashboard-content" aria-label="FPI facility protection dashboard">
        <HeroSummary />
        <ExecutiveStatusStrip />

        <section className="progress-grid" aria-label="FPI program progress indicators">
          {pillars.map((pillar) => (
            <ProgressCard pillar={pillar} key={pillar.id} />
          ))}
        </section>

        <section className="kpi-grid" aria-label="Key FPI indicators">
          {kpis.map((kpi) => (
            <KpiCard kpi={kpi} key={kpi.label} />
          ))}
        </section>

        <section className="dashboard-grid" aria-label="Dashboard operational detail">
          <SelectedServiceCard activeCapability={activeCapability} />
          <ReadinessDistribution />
          <ProgramSignals />
          <FacilitySpatialPreview />
          <ServiceAreaBuildout activeCapabilityId={activeCapabilityId} onSelectCapability={onSelectCapability} />
        </section>
      </main>
    </div>
  );
}

function SidebarNav({
  activeCapabilityId,
  onSelectCapability,
  onBackToLanding,
}: {
  activeCapabilityId: string;
  onSelectCapability: (id: string) => void;
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
        {capabilities.map((capability) => (
          <button
            className={capability.id === activeCapabilityId ? 'nav-item active' : 'nav-item'}
            key={capability.id}
            type="button"
            aria-current={capability.id === activeCapabilityId ? 'page' : undefined}
            onClick={() => onSelectCapability(capability.id)}
          >
            <span>{capability.eyebrow}</span>
            {capability.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function HeroSummary() {
  return (
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">FPI dashboard shell</p>
        <h1>Facility protection posture overview</h1>
        <p>
          Overall posture is <strong>WATCH</strong> across 1,284 profiled facilities, with 37 critical exceptions and 91%
          remediation SLA performance.
        </p>
      </div>
      <div className="mode-pill" aria-label="Mode Synthetic data">
        <span>MODE</span>
        Synthetic data
      </div>
    </header>
  );
}

function ExecutiveStatusStrip() {
  return (
    <section className="executive-strip" aria-label="Executive status summary">
      {executiveStatus.map((item) => (
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

function KpiCard({ kpi }: { kpi: Kpi }) {
  const meta = kpiStatusByLabel[kpi.label];
  const isPriority = kpi.label === 'Critical exceptions';

  return (
    <article className={isPriority ? 'kpi-card priority-kpi' : 'kpi-card'}>
      <div className="kpi-topline">
        <span>{kpi.label}</span>
        <StatusPill label={meta.status} tone={meta.tone} />
      </div>
      <strong>{kpi.value}</strong>
      <small>{kpi.trend}</small>
      <p>{meta.caption}</p>
    </article>
  );
}

function SelectedServiceCard({ activeCapability }: { activeCapability: Capability }) {
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
      <div className="service-meta-grid">
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

function ReadinessDistribution() {
  return (
    <section className="panel readiness-panel" aria-labelledby="readiness-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Verification health</p>
          <h2 id="readiness-title">Readiness distribution</h2>
        </div>
        <span className="trend-note">Verified +6% this cycle</span>
      </div>
      <p>44% verified / 28% in review / 28% require action or escalation.</p>
      <div
        className="bar-stack"
        role="img"
        aria-label="Readiness distribution: Verified 44%, In review 28%, Needs action 18%, Escalated 10%"
      >
        {readinessBands.map((band) => (
          <span
            key={band.label}
            style={{ width: `${band.value}%`, background: band.color }}
            aria-label={`${band.label} ${band.value}%`}
          >
            {band.value >= 18 ? `${band.value}%` : ''}
          </span>
        ))}
      </div>
      <div className="band-list">
        {readinessBands.map((band) => (
          <div key={band.label}>
            <span style={{ background: band.color }} aria-hidden="true" />
            <p>{band.label}</p>
            <strong>{band.value}%</strong>
            <small>{band.note}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProgramSignals() {
  return (
    <section className="panel activity-panel" aria-labelledby="signals-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Operating cadence</p>
          <h2 id="signals-title">Latest program signals</h2>
        </div>
      </div>
      <ol className="activity-list">
        {activity.map((item) => (
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

function FacilitySpatialPreview() {
  return (
    <section className="panel spatial-preview" aria-labelledby="spatial-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Spatial intelligence</p>
          <h2 id="spatial-title">Facility posture preview</h2>
        </div>
        <StatusPill label="STATIC" tone="stable" />
      </div>
      <div className="isometric-map" aria-hidden="true">
        <span className="site-node verified">Verified</span>
        <span className="site-node review">In review</span>
        <span className="site-node action">Needs action</span>
        <span className="site-node escalated">Escalated</span>
      </div>
      <p>
        Lightweight non-WebGL preview: verified sites remain the largest cohort, while 28% require action or escalation.
      </p>
      <button type="button" className="spatial-button">Open spatial view</button>
    </section>
  );
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function statusToneForCapability(status: Capability['status']): StatusTone {
  if (status === 'Ready') return 'ready';
  if (status === 'Buildout') return 'buildout';
  return 'watch';
}

export default App;
