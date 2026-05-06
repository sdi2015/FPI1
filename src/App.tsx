import { useEffect, useMemo, useState } from 'react';
import { FacilityDetailPanel } from './components/FacilityDetailPanel';
import { CameraTechnicalControlView } from './components/views/CameraTechnicalControlView';
import { ExecutiveProtectionReadinessView } from './components/views/ExecutiveProtectionReadinessView';
import { ExternalCoordinationView } from './components/views/ExternalCoordinationView';
import { FireSystemServiceView } from './components/views/FireSystemServiceView';
import { NetworkDevicePostureView } from './components/views/NetworkDevicePostureView';
import { PlaceholderServiceView } from './components/views/PlaceholderServiceView';
import { ReadinessOverviewView } from './components/views/ReadinessOverviewView';
import { RemediationOrchestrationView } from './components/views/RemediationOrchestrationView';
import { SettingsView } from './components/views/SettingsView';
import { ThreatDetectionRiskScoringView } from './components/views/ThreatDetectionRiskScoringView';
import { VendorIntelligenceRecommendationsView } from './components/views/VendorIntelligenceRecommendationsView';
import { getFacilityDetailModel } from './data/fpiSelectors';
import { calculateFpiDashboardMetrics } from './data/fpiMetrics';
import { applyStoreScopeToFpiProgram } from './data/fpiStoreScope';
import { createAllStoresScope, getStoreScopeSummary, hasEmptyStoreScope, type StoreScopeMode, type StoreScopeState } from './data/storeScope';
import { getServiceMetrics } from './data/fpiServiceMetrics';
import { capabilities, pillars, type Capability } from './data/program';
import { capabilityIdForService, serviceIdForCapability, SERVICE_IDS, type ServiceId } from './data/serviceIds';
import type { StatusTone } from './data/fpiTypes';
import { useFpiProgramData, type FpiProgramDataState } from './data/useFpiProgramData';
import { useFireAlarmData } from './data/useFireAlarmData';

type Screen = 'landing' | 'dashboard';

const defaultServiceId = SERVICE_IDS.COMMAND_CENTER;
const STORE_SCOPE_STORAGE_KEY = 'fpi-store-scope';
const validServiceIds = Object.values(SERVICE_IDS) as ServiceId[];

function getServiceIdFromHash(): ServiceId | null {
  if (typeof window === 'undefined') return null;
  const hashValue = window.location.hash.replace(/^#\/?/, '');
  return validServiceIds.includes(hashValue as ServiceId) ? (hashValue as ServiceId) : null;
}

function updateServiceHash(serviceId: ServiceId) {
  if (typeof window === 'undefined') return;
  const nextHash = `#/${serviceId}`;
  if (window.location.hash !== nextHash) {
    window.history.pushState(null, '', nextHash);
  }
}

function clearServiceHash() {
  if (typeof window === 'undefined') return;
  window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
}

function loadStoredStoreScope(): StoreScopeState {
  if (typeof window === 'undefined') return createAllStoresScope();

  try {
    const storedValue = window.localStorage.getItem(STORE_SCOPE_STORAGE_KEY);
    if (!storedValue) return createAllStoresScope();

    const parsed = JSON.parse(storedValue) as Partial<StoreScopeState>;
    if (!isValidStoreScope(parsed)) return createAllStoresScope();

    return parsed;
  } catch {
    return createAllStoresScope();
  }
}

function isValidStoreScope(value: Partial<StoreScopeState>): value is StoreScopeState {
  const validModes: StoreScopeMode[] = ['all', 'regions', 'stores'];
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.mode === 'string' &&
      validModes.includes(value.mode as StoreScopeMode) &&
      Array.isArray(value.selectedRegionNames) &&
      value.selectedRegionNames.every((region) => typeof region === 'string') &&
      Array.isArray(value.selectedStoreIds) &&
      value.selectedStoreIds.every((storeId) => typeof storeId === 'string'),
  );
}

function App() {
  const initialTheme =
    typeof window !== 'undefined' && window.localStorage.getItem('fpi-theme') === 'light' ? 'light' : 'dark';
  const initialServiceFromHash = getServiceIdFromHash();
  const [screen, setScreen] = useState<Screen>(initialServiceFromHash ? 'dashboard' : 'landing');
  const [selectedService, setSelectedService] = useState<ServiceId>(initialServiceFromHash ?? defaultServiceId);
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme);
  const fpiState = useFpiProgramData();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('fpi-theme', theme);
  }, [theme]);

  useEffect(() => {
    function handleHashChange() {
      const serviceId = getServiceIdFromHash();
      if (!serviceId) {
        setScreen('landing');
        return;
      }
      setSelectedService(serviceId);
      setScreen('dashboard');
    }

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const activeCapability = useMemo(
    () => capabilities.find((capability) => capability.id === capabilityIdForService(selectedService)) ?? capabilities[0],
    [selectedService],
  );

  function handleSelectService(serviceId: ServiceId) {
    setSelectedService(serviceId);
    setScreen('dashboard');
    updateServiceHash(serviceId);
  }

  function handleEnterDashboard() {
    setScreen('dashboard');
    updateServiceHash(selectedService);
  }

  function handleBackToLanding() {
    setScreen('landing');
    clearServiceHash();
  }

  if (screen === 'dashboard') {
    return (
      <DashboardShell
        selectedService={selectedService}
        onSelectService={handleSelectService}
        onBackToLanding={handleBackToLanding}
        activeCapability={activeCapability}
        fpiState={fpiState}
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  return (
    <Landing
      onEnter={handleEnterDashboard}
      theme={theme}
      onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
    />
  );
}

function ThemeToggle({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Toggle light and dark mode">
      <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
      <strong>{theme === 'dark' ? '🌙' : '☀️'}</strong>
    </button>
  );
}

function Landing({
  onEnter,
  theme,
  onThemeToggle,
}: {
  onEnter: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}) {
  return (
    <main className="landing-shell">
      <div className="top-controls">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
      <section className="hero-panel">
        <div className="hero-content">
          <div className="brand-row" aria-label="FPI program brand">
            <img className="brand-spark" src="/brand/walmart/spark/WMT-Spark-SparkYellow-RGB.svg" alt="Walmart Spark" />
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

      <footer className="landing-brand-footer" aria-label="Walmart brand footer">
        <img className="walmart-wordmark" src={theme === 'dark' ? '/brand/walmart/wordmark/WMT-Wordmark-Standard-White-RGB.svg' : '/brand/walmart/wordmark/WMT-Wordmark-Standard-TrueBlue-RGB.svg'} alt="Walmart" />
        <span>Facility Protection Intelligence internal prototype</span>
      </footer>
    </main>
  );
}

function DashboardShell({
  selectedService,
  activeCapability,
  onSelectService,
  onBackToLanding,
  fpiState,
  theme,
  onThemeToggle,
}: {
  selectedService: ServiceId;
  activeCapability: Capability;
  onSelectService: (id: ServiceId) => void;
  onBackToLanding: () => void;
  fpiState: FpiProgramDataState;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}) {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [storeScope, setStoreScope] = useState<StoreScopeState>(loadStoredStoreScope());
  const fireAlarmState = useFireAlarmData();
  const globalMetrics = fpiState.data?.dashboardMetrics;
  const programData = fpiState.data?.programData;
  const fireSites = fireAlarmState.data?.sites ?? [];
  const scopedProgramData = useMemo(
    () => (programData ? applyStoreScopeToFpiProgram(programData, fireSites, storeScope) : null),
    [programData, fireSites, storeScope],
  );
  const metrics = useMemo(
    () => (scopedProgramData ? calculateFpiDashboardMetrics(scopedProgramData) : globalMetrics),
    [scopedProgramData, globalMetrics],
  );
  const isEmptyScope = hasEmptyStoreScope(storeScope);
  const selectedFacility = useMemo(
    () => (scopedProgramData && selectedFacilityId ? getFacilityDetailModel(scopedProgramData, selectedFacilityId) : null),
    [scopedProgramData, selectedFacilityId],
  );
  const serviceMetrics = useMemo(
    () => (scopedProgramData ? getServiceMetrics(scopedProgramData, activeCapability.id, activeCapability.title) : null),
    [scopedProgramData, activeCapability.id, activeCapability.title],
  );
  const scopeSummary = useMemo(() => getStoreScopeSummary(storeScope, fireSites), [storeScope, fireSites]);

  useEffect(() => {
    window.localStorage.setItem(STORE_SCOPE_STORAGE_KEY, JSON.stringify(storeScope));
  }, [storeScope]);

  useEffect(() => {
    if (!selectedFacilityId || !scopedProgramData) return;
    if (!scopedProgramData.facilities.some((facility) => facility.facilityId === selectedFacilityId)) {
      setSelectedFacilityId(null);
    }
  }, [scopedProgramData, selectedFacilityId]);

  function handleCapabilitySelect(capabilityId: string) {
    onSelectService(serviceIdForCapability(capabilityId));
  }

  function handleChangeStoreScopeRequest() {
    onSelectService(SERVICE_IDS.SETTINGS);
  }

  return (
    <div className="dashboard-shell">
      <SidebarNav selectedService={selectedService} onSelectService={onSelectService} onBackToLanding={onBackToLanding} theme={theme} />

      <main className="dashboard-content" aria-label="FPI facility protection dashboard">
        <CompactCommandBar
          activeCapability={activeCapability}
          metrics={metrics}
          scopeSummary={scopeSummary}
          fpiLoading={fpiState.loading}
          fpiError={fpiState.error}
          fireLoading={fireAlarmState.loading}
          fireError={fireAlarmState.error}
          isEmptyScope={isEmptyScope}
          theme={theme}
          onThemeToggle={onThemeToggle}
          onCommandCenter={() => onSelectService(SERVICE_IDS.COMMAND_CENTER)}
          onChangeScope={handleChangeStoreScopeRequest}
          onSettings={() => onSelectService(SERVICE_IDS.SETTINGS)}
        />
        {fpiState.loading ? <DashboardStatePanel title="Loading FPI master data" message="Preparing the local master JSON dataset and calculating dashboard metrics." /> : null}
        {fpiState.error ? <DashboardStatePanel title="Dashboard data is unavailable" message={fpiState.error} tone="critical" /> : null}
        {!fpiState.loading && !fpiState.error && !metrics ? (
          <DashboardStatePanel title="No dashboard data" message="The master dataset loaded but did not produce a dashboard model." tone="watch" />
        ) : null}

        {metrics && programData && scopedProgramData ? (
          <>
            {selectedService === SERVICE_IDS.SETTINGS ? (
              <SettingsView
                fireSites={fireSites}
                fireAlarmLoading={fireAlarmState.loading}
                fireAlarmError={fireAlarmState.error}
                storeScope={storeScope}
                onStoreScopeChange={setStoreScope}
              />
            ) : isEmptyScope ? (
              <>
                <PlaceholderServiceView
                  title={activeCapability.title}
                  description={activeCapability.description}
                  facilities={scopedProgramData.facilities}
                  fireSites={fireSites}
                  storeScope={storeScope}
                  onChangeScopeRequest={handleChangeStoreScopeRequest}
                />
                <DashboardStatePanel
                  title="No facilities selected"
                  message="Select one or more stores to view dashboard metrics, service posture, and operational records."
                  tone="watch"
                />
              </>
            ) : selectedService === SERVICE_IDS.COMMAND_CENTER ? (
              <ReadinessOverviewView
                facilities={scopedProgramData.facilities}
                dashboardMetrics={metrics}
                activeCapability={activeCapability}
                serviceMetrics={serviceMetrics}
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
                onFacilitySelect={setSelectedFacilityId}
                onCapabilitySelect={handleCapabilitySelect}
              />
            ) : selectedService === SERVICE_IDS.EPR ? (
              <ExecutiveProtectionReadinessView
                facilities={scopedProgramData.facilities}
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            ) : selectedService === SERVICE_IDS.FIRE_SYSTEM ? (
              <FireSystemServiceView
                programData={scopedProgramData}
                facilities={scopedProgramData.facilities}
                fireAlarmData={fireAlarmState.data}
                fireAlarmLoading={fireAlarmState.loading}
                fireAlarmError={fireAlarmState.error}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
                onFacilitySelect={setSelectedFacilityId}
              />
            ) : selectedService === SERVICE_IDS.CAMERA_CONTROLS ? (
              <CameraTechnicalControlView
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            ) : selectedService === SERVICE_IDS.DEVICE_POSTURE ? (
              <NetworkDevicePostureView
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            ) : selectedService === SERVICE_IDS.THREAT_RISK ? (
              <ThreatDetectionRiskScoringView
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            ) : selectedService === SERVICE_IDS.REMEDIATION ? (
              <RemediationOrchestrationView
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            ) : selectedService === SERVICE_IDS.VENDOR_INTELLIGENCE ? (
              <VendorIntelligenceRecommendationsView
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            ) : selectedService === SERVICE_IDS.EXTERNAL_COORDINATION ? (
              <ExternalCoordinationView
                fireSites={fireSites}
                storeScope={storeScope}
                onChangeScopeRequest={handleChangeStoreScopeRequest}
              />
            ) : (
              <PlaceholderServiceView
                title={activeCapability.title}
                description={activeCapability.description}
                facilities={scopedProgramData.facilities}
                fireSites={fireSites}
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

function CompactCommandBar({
  activeCapability,
  metrics,
  scopeSummary,
  fpiLoading,
  fpiError,
  fireLoading,
  fireError,
  isEmptyScope,
  theme,
  onThemeToggle,
  onCommandCenter,
  onChangeScope,
  onSettings,
}: {
  activeCapability: Capability;
  metrics?: NonNullable<FpiProgramDataState['data']>['dashboardMetrics'];
  scopeSummary: string;
  fpiLoading: boolean;
  fpiError: string | null;
  fireLoading: boolean;
  fireError: string | null;
  isEmptyScope: boolean;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onCommandCenter: () => void;
  onChangeScope: () => void;
  onSettings: () => void;
}) {
  const hasDataIssue = Boolean(fpiError || fireError);
  const isLoading = fpiLoading || fireLoading;
  const posture = isEmptyScope ? 'NO SCOPE' : metrics?.overallStatus ?? (isLoading ? 'LOADING' : 'WATCH');
  const tone: StatusTone = hasDataIssue ? 'critical' : isEmptyScope ? 'watch' : isLoading ? 'buildout' : metrics?.overallStatus === 'CRITICAL' ? 'critical' : metrics?.overallStatus === 'WATCH' ? 'watch' : 'ready';
  const diagnostics = [
    { label: 'FPI data', value: fpiError ? 'Issue' : fpiLoading ? 'Loading' : 'Loaded', tone: fpiError ? 'critical' : fpiLoading ? 'buildout' : 'ready' },
    { label: 'Fire data', value: fireError ? 'Issue' : fireLoading ? 'Loading' : 'Loaded', tone: fireError ? 'critical' : fireLoading ? 'buildout' : 'ready' },
    { label: 'Scope', value: isEmptyScope ? 'No facilities' : scopeSummary, tone: isEmptyScope ? 'watch' : 'stable' },
    { label: 'Active view', value: activeCapability.navLabel ?? activeCapability.title, tone: 'track' },
  ] satisfies Array<{ label: string; value: string; tone: StatusTone }>;

  return (
    <section className="compact-command-bar" aria-label="Dashboard command bar">
      <div className="compact-command-main">
        <div>
          <span>Current view</span>
          <strong>{activeCapability.navLabel ?? activeCapability.title}</strong>
        </div>
        <button type="button" className="compact-scope-pill" onClick={onChangeScope} aria-label={`Change dashboard scope. Current scope: ${scopeSummary}`}>
          <span>Scope</span>
          <strong>{scopeSummary}</strong>
        </button>
        <StatusPill label={posture} tone={tone} />
      </div>
      <div className="compact-command-actions" aria-label="Dashboard quick actions">
        <details className="system-health-popover">
          <summary>System Health</summary>
          <div className="system-health-menu">
            {diagnostics.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <StatusPill label={item.tone === 'ready' ? 'OK' : item.tone === 'critical' ? 'CHECK' : item.tone.toUpperCase()} tone={item.tone} />
              </article>
            ))}
          </div>
        </details>
        <button type="button" className="ops-action-button" onClick={onCommandCenter}>Command Center</button>
        <button type="button" className="ops-action-button secondary" onClick={onChangeScope}>Change Scope</button>
        <button type="button" className="ops-action-button secondary" onClick={onSettings}>Settings</button>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
    </section>
  );
}

function SidebarNav({
  selectedService,
  onSelectService,
  onBackToLanding,
  theme,
}: {
  selectedService: ServiceId;
  onSelectService: (id: ServiceId) => void;
  onBackToLanding: () => void;
  theme: 'dark' | 'light';
}) {
  const commandCenterCapability = capabilities.find((capability) => serviceIdForCapability(capability.id) === SERVICE_IDS.COMMAND_CENTER);
  const programServiceCapabilities = capabilities.filter((capability) => serviceIdForCapability(capability.id) !== SERVICE_IDS.COMMAND_CENTER);

  return (
    <aside className="sidebar" aria-label="FPI dashboard navigation">
      <button className="logo-button" type="button" onClick={onBackToLanding} aria-label="Back to landing page">
        <img className="brand-spark" src="/brand/walmart/spark/WMT-Spark-SparkYellow-RGB.svg" alt="Walmart Spark" />
        <span>
          FPI
          <small>Command Center</small>
        </span>
      </button>

      {commandCenterCapability ? (
        <nav aria-label="Command Center navigation" className="sidebar-command-nav">
          <button
            className={selectedService === SERVICE_IDS.COMMAND_CENTER ? 'nav-item active command-center-nav-item' : 'nav-item command-center-nav-item'}
            type="button"
            aria-current={selectedService === SERVICE_IDS.COMMAND_CENTER ? 'page' : undefined}
            onClick={() => onSelectService(SERVICE_IDS.COMMAND_CENTER)}
          >
            <span className="nav-title-row">
              <strong>{commandCenterCapability.navLabel ?? commandCenterCapability.title}</strong>
              <span className={`nav-status-dot nav-status-${capabilityStatusTone(commandCenterCapability.status)}`} aria-label={`${commandCenterCapability.status} status`} />
            </span>
          </button>
        </nav>
      ) : null}

      <nav aria-label="Program service navigation">
        <p className="nav-label">Modules</p>
        {programServiceCapabilities.map((capability) => {
          const serviceId = serviceIdForCapability(capability.id);
          return (
            <button
              className={serviceId === selectedService ? 'nav-item active' : 'nav-item'}
              key={capability.id}
              type="button"
              aria-current={serviceId === selectedService ? 'page' : undefined}
              onClick={() => onSelectService(serviceId)}
            >
              <span className="nav-title-row">
                <strong>{capability.navLabel ?? capability.title}</strong>
                <span className={`nav-status-dot nav-status-${capabilityStatusTone(capability.status)}`} aria-label={`${capability.status} status`} />
              </span>
            </button>
          );
        })}
      </nav>

      <nav aria-label="Application settings navigation" className="sidebar-settings-nav">
        <p className="nav-label">Workspace</p>
        <button
          className={selectedService === SERVICE_IDS.SETTINGS ? 'nav-item active' : 'nav-item'}
          type="button"
          aria-current={selectedService === SERVICE_IDS.SETTINGS ? 'page' : undefined}
          onClick={() => onSelectService(SERVICE_IDS.SETTINGS)}
        >
          <span className="nav-title-row"><strong>Settings</strong><span className="nav-status-dot nav-status-track" aria-label="Workspace controls" /></span>
        </button>
      </nav>

      <footer className="sidebar-brand-footer" aria-label="Walmart brand footer">
        <img className="walmart-wordmark" src={theme === 'dark' ? '/brand/walmart/wordmark/WMT-Wordmark-Standard-White-RGB.svg' : '/brand/walmart/wordmark/WMT-Wordmark-Standard-TrueBlue-RGB.svg'} alt="Walmart" />
        <span>Internal prototype</span>
      </footer>
    </aside>
  );
}

function capabilityStatusTone(status: Capability['status']): StatusTone {
  return status === 'Ready' ? 'ready' : status === 'Watching' ? 'watch' : 'buildout';
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

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

export default App;
