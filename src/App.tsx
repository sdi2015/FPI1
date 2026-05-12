import { useEffect, useMemo, useState } from 'react';
import { FacilityDetailPanel } from './components/FacilityDetailPanel';
import { FloatingNovaAssistant } from './components/FloatingNovaAssistant';
import { AviationTravelReadinessPage as AviationCommandCenter } from './components/aviation/AviationTravelReadinessPage';
import { CameraTechnicalControlView } from './components/views/CameraTechnicalControlView';
import { ExecutiveProtectionReadinessView } from './components/views/ExecutiveProtectionReadinessView';
import { SecurityMitigationManagerView } from './components/views/SecurityMitigationManagerView';
import { ExternalCoordinationView } from './components/views/ExternalCoordinationView';
import { FireSystemServiceView } from './components/views/FireSystemServiceView';
import { NetworkDevicePostureView } from './components/views/NetworkDevicePostureView';
import { NovaAgentView } from './components/views/NovaAgentView';
import { PlaceholderServiceView } from './components/views/PlaceholderServiceView';
import { ReadinessOverviewView } from './components/views/ReadinessOverviewView';
import { RemediationOrchestrationView } from './components/views/RemediationOrchestrationView';
import { SettingsView } from './components/views/SettingsView';
import { ThreatDetectionRiskScoringView } from './components/views/ThreatDetectionRiskScoringView';
import { VendorIntelligenceRecommendationsView } from './components/views/VendorIntelligenceRecommendationsView';
import { getFacilityDetailModel } from './data/fpiSelectors';
import { calculateFpiDashboardMetrics } from './data/fpiMetrics';
import { buildNovaContext } from './data/novaContextBuilder';
import { applyStoreScopeToFpiProgram } from './data/fpiStoreScope';
import { createAllStoresScope, getStoreScopeSummary, hasEmptyStoreScope, type StoreScopeMode, type StoreScopeState } from './data/storeScope';
import { getServiceMetrics, type FpiServiceMetricsModel } from './data/fpiServiceMetrics';
import { capabilities, pillars, type Capability, type Pillar } from './data/program';
import { capabilityIdForService, serviceIdForCapability, SERVICE_IDS, type ServiceId } from './data/serviceIds';
import { loadNavigationConfig, saveNavigationConfig, type NavigationItemConfig, type NavigationSectionId } from './data/navigationConfig';
import type { FpiDashboardMetrics, FpiKpi, FpiRiskTier, FpiTopRiskFacility, StatusTone } from './data/fpiTypes';
import { useFpiProgramData, type FpiProgramDataState } from './data/useFpiProgramData';
import { useFireAlarmData } from './data/useFireAlarmData';
import { applyTheme, getInitialThemePreference, persistThemePreference, resolveTheme, type ThemePreference } from './theme/themePreference';


type Screen = 'landing' | 'dashboard';

const defaultServiceId = SERVICE_IDS.COMMAND_CENTER;
const STORE_SCOPE_STORAGE_KEY = 'fpi-store-scope';
const LANDING_SESSION_KEY = 'fpiLandingEntered';
const validServiceIds = Object.values(SERVICE_IDS) as ServiceId[];

function getServiceIdFromHash(): ServiceId | null {
  if (typeof window === 'undefined') return null;
  const hashValue = window.location.hash.replace(/^#\/?/, '');
  if (validServiceIds.includes(hashValue as ServiceId)) return hashValue as ServiceId;

  const pathValue = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  return validServiceIds.includes(pathValue as ServiceId) ? (pathValue as ServiceId) : null;
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
  const initialThemePreference = getInitialThemePreference();
  const initialServiceFromHash = getServiceIdFromHash();
  const initialLandingEntered =
    typeof window !== 'undefined' && window.sessionStorage.getItem(LANDING_SESSION_KEY) === 'true';
  const [screen, setScreen] = useState<Screen>(initialServiceFromHash || initialLandingEntered ? 'dashboard' : 'landing');
  const [selectedService, setSelectedService] = useState<ServiceId>(initialServiceFromHash ?? defaultServiceId);
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialThemePreference);
  const [theme, setTheme] = useState<'dark' | 'light'>(resolveTheme(initialThemePreference));
  const fpiState = useFpiProgramData();

  useEffect(() => {
    const resolvedTheme = resolveTheme(themePreference);
    setTheme(resolvedTheme);
    applyTheme(resolvedTheme);
    persistThemePreference(themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== 'system' || typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mediaQuery) return undefined;

    function handleSystemThemeChange() {
      const resolvedTheme = resolveTheme('system');
      setTheme(resolvedTheme);
      applyTheme(resolvedTheme);
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [themePreference]);

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
    window.sessionStorage.setItem(LANDING_SESSION_KEY, 'true');
    setScreen('dashboard');
    updateServiceHash(selectedService);
  }

  function handleBackToLanding() {
    window.sessionStorage.removeItem(LANDING_SESSION_KEY);
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
        onThemeToggle={() => setThemePreference((current) => (resolveTheme(current) === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  return (
    <Landing
      onEnter={handleEnterDashboard}
      theme={theme}
      onThemeToggle={() => setThemePreference((current) => (resolveTheme(current) === 'dark' ? 'light' : 'dark'))}
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
  const [accessCancelled, setAccessCancelled] = useState(false);

  function handleExit() {
    setAccessCancelled(true);
    if (window.history.length > 1) {
      window.history.back();
    }
  }

  return (
    <main className="fpi-landing-shell">
      <div className="top-controls landing-top-controls">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
      <section className="fpi-landing-hero" aria-label="Facility Protection Intelligence pre-entry screen">
        <div className="space-bg" aria-hidden="true">
          <span className="stars-layer layer-one" />
          <span className="stars-layer layer-two" />
          <span className="stars-layer layer-three" />
          <span className="nebula-glow" />
          <span className="aurora-sweep" />
          <span className="scan-grid" />
        </div>

        <div className="fpi-landing-content">
          <div className="spark-flight-wrapper">
            <span className="spark-ring ring-one" aria-hidden="true" />
            <span className="spark-ring ring-two" aria-hidden="true" />
            <img className="spark-flight" src="/brand/walmart/spark/WMT-Spark-SparkYellow-RGB.svg" alt="Walmart Spark" />
          </div>
          <div className="landing-copy">
            <h1>Facility Protection Intelligence</h1>
            <p>Command Center Experience</p>
          </div>

          <div className="landing-actions" role="group" aria-label="FPI entry actions">
            <button className="primary-button landing-enter-button" type="button" onClick={onEnter} aria-label="Enter Facility Protection Intelligence dashboard">
              Enter FPI
            </button>
            <button className="ghost-button landing-exit-button" type="button" onClick={handleExit} aria-label="Exit pre-entry screen">
              Exit
            </button>
          </div>
          {accessCancelled ? (
            <p className="landing-cancelled" role="status">
              Access cancelled. You may close this window or return to login.
            </p>
          ) : null}
          <div className="landing-security-note" aria-label="Security notice">
            Authorized users only. Activity may be monitored in accordance with company policy.
          </div>
        </div>
      </section>
      <footer className="landing-brand-footer landing-brand-footer--floating" aria-label="Walmart brand footer">
        <img className="walmart-wordmark" src={theme === 'dark' ? '/brand/walmart/wordmark/WMT-Wordmark-Standard-White-RGB.svg' : '/brand/walmart/wordmark/WMT-Wordmark-Standard-TrueBlue-RGB.svg'} alt="Walmart" />
        <span>Facility Protection Intelligence · Authorized Users Only</span>
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
  const [navigationConfig, setNavigationConfig] = useState<NavigationItemConfig[]>(loadNavigationConfig());
  const [novaDrawerOpen, setNovaDrawerOpen] = useState(false);
  const [isNovaWidgetDismissed, setIsNovaWidgetDismissed] = useState<boolean>(typeof window !== 'undefined' && window.localStorage.getItem('fpi_nova_floating_button_dismissed') === 'true');
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
  const novaContext = useMemo(
    () => buildNovaContext({ activeCapability, metrics, programData: scopedProgramData ?? undefined, fireAlarmData: fireAlarmState.data, scopeSummary, storeScope }),
    [activeCapability, metrics, scopedProgramData, fireAlarmState.data, scopeSummary, storeScope],
  );

  useEffect(() => {
    window.localStorage.setItem(STORE_SCOPE_STORAGE_KEY, JSON.stringify(storeScope));
  }, [storeScope]);

  useEffect(() => {
    saveNavigationConfig(navigationConfig);
  }, [navigationConfig]);

  useEffect(() => {
    function closeNovaOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setNovaDrawerOpen(false);
    }
    window.addEventListener('keydown', closeNovaOnEscape);
    return () => window.removeEventListener('keydown', closeNovaOnEscape);
  }, []);

  function dismissNovaWidget() {
    setIsNovaWidgetDismissed(true);
    setNovaDrawerOpen(false);
    window.localStorage.setItem('fpi_nova_floating_button_dismissed', 'true');
  }

  function restoreNovaWidget() {
    setIsNovaWidgetDismissed(false);
    window.localStorage.removeItem('fpi_nova_floating_button_dismissed');
  }

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
      <SidebarNav selectedService={selectedService} onSelectService={onSelectService} onBackToLanding={onBackToLanding} theme={theme} navigationConfig={navigationConfig} />

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
            {selectedService === SERVICE_IDS.NOVA ? (
              <NovaAgentView context={novaContext} onRestoreFloatingButton={restoreNovaWidget} />
            ) : selectedService === SERVICE_IDS.SETTINGS ? (
              <SettingsView
                fireSites={fireSites}
                fireAlarmLoading={fireAlarmState.loading}
                fireAlarmError={fireAlarmState.error}
                storeScope={storeScope}
                onStoreScopeChange={setStoreScope}
                navigationConfig={navigationConfig}
                onNavigationConfigChange={setNavigationConfig}
                dashboardMetrics={metrics}
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
            ) : selectedService === SERVICE_IDS.SECURITY_MITIGATION ? (
              <SecurityMitigationManagerView
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
            ) : selectedService === SERVICE_IDS.AVIATION_TRAVEL_READINESS ? (
              <AviationCommandCenter />
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
        {selectedService !== SERVICE_IDS.NOVA ? (
          <FloatingNovaAssistant
            context={novaContext}
            open={novaDrawerOpen}
            dismissed={isNovaWidgetDismissed}
            onOpen={() => setNovaDrawerOpen(true)}
            onClose={() => setNovaDrawerOpen(false)}
            onDismiss={dismissNovaWidget}
          />
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
  const posture = isEmptyScope ? 'No scope' : metrics?.overallStatus === 'READY' ? 'Stable' : metrics?.overallStatus === 'WATCH' ? 'Watch' : metrics?.overallStatus === 'CRITICAL' ? 'Critical' : metrics?.overallStatus === 'UNAVAILABLE' ? 'Unavailable' : isLoading ? 'Loading' : 'Watch';
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
                <StatusPill label={item.tone === 'ready' ? 'Ok' : item.tone === 'critical' ? 'Check' : item.tone === 'buildout' ? 'Loading' : item.tone === 'stable' ? 'Stable' : item.tone === 'track' ? 'Track' : 'Watch'} tone={item.tone} />
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
  navigationConfig,
}: {
  selectedService: ServiceId;
  onSelectService: (id: ServiceId) => void;
  onBackToLanding: () => void;
  theme: 'dark' | 'light';
  navigationConfig: NavigationItemConfig[];
}) {
  const capabilityByServiceId = useMemo(() => new Map(capabilities.map((capability) => [serviceIdForCapability(capability.id), capability])), []);
  const sections: Array<{ id: NavigationSectionId; label: string }> = [{ id: 'command', label: 'Command' }, { id: 'modules', label: 'Modules' }, { id: 'aviation', label: 'Aviation' }, { id: 'workspace', label: 'Workspace' }];
  const visibleItems = navigationConfig.filter((item) => (item.enabled || item.locked) && validServiceIds.includes(item.serviceId));

  function getStatusToneForItem(item: NavigationItemConfig): StatusTone {
    const capability = capabilityByServiceId.get(item.serviceId);
    return capability ? capabilityStatusTone(capability.status) : item.statusTone ?? 'track';
  }

  return (
    <aside className="sidebar" aria-label="FPI dashboard navigation">
      <button className="logo-button" type="button" onClick={onBackToLanding} aria-label="Back to landing page">
        <img className="brand-spark" src="/brand/walmart/spark/WMT-Spark-SparkYellow-RGB.svg" alt="Walmart Spark" />
        <span>
          FPI
          <small>Command Center</small>
        </span>
      </button>

      <nav aria-label="Customizable FPI navigation" className="sidebar-command-nav">
        {visibleItems.length === 0 ? <p className="sidebar-empty-note">No visible modules. Open Settings → Custom Navigation to restore tabs.</p> : null}
        {sections.map((section) => {
          const sectionItems = visibleItems.filter((item) => item.section === section.id).sort((a, b) => a.order - b.order);
          if (sectionItems.length === 0) return null;
          return <div key={section.id} className="sidebar-nav-section"><p className="nav-label">{section.label}</p>{sectionItems.map((item) => {
            const statusTone = getStatusToneForItem(item);
            return (
              <button
                className={`${item.serviceId === selectedService ? 'nav-item active' : 'nav-item'}${item.serviceId === SERVICE_IDS.COMMAND_CENTER ? ' command-center-nav-item' : ''}`}
                key={item.id}
                type="button"
                aria-current={item.serviceId === selectedService ? 'page' : undefined}
                title={item.description ?? item.label}
                onClick={() => onSelectService(item.serviceId)}
              >
                <span className="nav-title-row">
                  <strong>{item.label}</strong>
                  <span className={`nav-status-dot nav-status-${statusTone}`} aria-label={`${statusTone} status`} />
                </span>
              </button>
            );
          })}</div>;
        })}
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

function statusToneForCapability(status: Capability['status']): StatusTone {
  return capabilityStatusTone(status);
}

function riskTierTone(tier: FpiRiskTier): StatusTone {
  if (tier === 'Critical') return 'critical';
  if (tier === 'High') return 'watch';
  if (tier === 'Medium') return 'stable';
  if (tier === 'Low') return 'ready';
  return 'buildout';
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
  const hiddenLabels = new Set(['Trend', 'Executive attention required', 'Highest risk domain']);
  const visibleStatusItems = metrics.executiveStatus.filter((item) => !hiddenLabels.has(item.label));

  return (
    <section className="executive-strip" aria-label="Executive status summary">
      {visibleStatusItems.map((item) => (
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

export default App;
