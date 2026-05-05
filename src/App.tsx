import { useMemo, useState } from 'react';
import { activity, capabilities, kpis, pillars } from './data/program';

type Screen = 'landing' | 'dashboard';

const readinessBands = [
  { label: 'Verified', value: 44, color: '#4DBDF5' },
  { label: 'In review', value: 28, color: '#A9DDF7' },
  { label: 'Needs action', value: 18, color: '#FFC220' },
  { label: 'Escalated', value: 10, color: '#FFFFFF' },
];

function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [activeCapabilityId, setActiveCapabilityId] = useState(capabilities[0].id);

  const activeCapability = useMemo(
    () => capabilities.find((capability) => capability.id === activeCapabilityId) ?? capabilities[0],
    [activeCapabilityId],
  );

  if (screen === 'dashboard') {
    return (
      <Dashboard
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
              <div className="progress-track" aria-label={`${pillar.title} ${pillar.progress}%`}>
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

function Dashboard({
  activeCapabilityId,
  activeCapability,
  onSelectCapability,
  onBackToLanding,
}: {
  activeCapabilityId: string;
  activeCapability: (typeof capabilities)[number];
  onSelectCapability: (id: string) => void;
  onBackToLanding: () => void;
}) {
  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="FPI dashboard navigation">
        <button className="logo-button" type="button" onClick={onBackToLanding} aria-label="Back to landing page">
          <span className="spark-mark">✦</span>
          <span>
            FPI
            <small>Command Center</small>
          </span>
        </button>

        <nav>
          <p className="nav-label">Program services</p>
          {capabilities.map((capability) => (
            <button
              className={capability.id === activeCapabilityId ? 'nav-item active' : 'nav-item'}
              key={capability.id}
              type="button"
              onClick={() => onSelectCapability(capability.id)}
            >
              <span>{capability.eyebrow}</span>
              {capability.title}
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">FPI dashboard shell</p>
            <h1>Facility protection posture overview</h1>
            <p>
              Mock-only operating view for readiness, monitoring assurance, posture, threat scoring, remediation, and
              coordination governance.
            </p>
          </div>
          <div className="header-badge">
            <span>Mode</span>
            Synthetic data
          </div>
        </header>

        <section className="command-ribbon" aria-label="FPI operating layers">
          {pillars.map((pillar) => (
            <article key={pillar.id}>
              <span>{pillar.signal}</span>
              <strong>{pillar.title}</strong>
              <div className="micro-track"><i style={{ width: `${pillar.progress}%` }} /></div>
            </article>
          ))}
        </section>

        <section className="kpi-grid" aria-label="Key FPI indicators">
          {kpis.map((kpi) => (
            <article className={`kpi-card tone-${kpi.tone}`} key={kpi.label}>
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
              <small>{kpi.trend}</small>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <article className="panel active-service-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Selected service</p>
                <h2>{activeCapability.title}</h2>
              </div>
              <span className={`status-pill status-${activeCapability.status.toLowerCase()}`}>{activeCapability.status}</span>
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
          </article>

          <article className="panel readiness-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Verification health</p>
                <h2>Readiness distribution</h2>
              </div>
            </div>
            <div className="bar-stack" aria-label="Readiness distribution by status">
              {readinessBands.map((band) => (
                <span key={band.label} style={{ width: `${band.value}%`, background: band.color }} title={band.label} />
              ))}
            </div>
            <div className="band-list">
              {readinessBands.map((band) => (
                <div key={band.label}>
                  <span style={{ background: band.color }} />
                  <p>{band.label}</p>
                  <strong>{band.value}%</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Operating cadence</p>
                <h2>Latest program signals</h2>
              </div>
            </div>
            <ol className="activity-list">
              {activity.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </article>

          <article className="panel module-map-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Capability map</p>
                <h2>Service area buildout</h2>
              </div>
            </div>
            <div className="module-map">
              {capabilities.map((capability) => (
                <button
                  type="button"
                  key={capability.id}
                  className={capability.id === activeCapabilityId ? 'module-chip active' : 'module-chip'}
                  onClick={() => onSelectCapability(capability.id)}
                >
                  <span>{capability.status}</span>
                  {capability.title}
                </button>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

export default App;
