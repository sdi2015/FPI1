import { ScopeContextChip } from '../ScopeContextChip';
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

type CommandCenterExecutiveMetrics = {
  posture: FpiDashboardMetrics['overallStatus'];
  facilitiesProfiled: number;
  criticalExceptions: number;
  activeSignals: number;
  panelTrouble: number;
  activeWorkQueue: number;
  elmLocationCount: number;
  geocodedFacilities: number;
  elmMediumPriority: number;
  elmHighPriority: number;
  dataReadiness: number;
  profileCompleteness: number;
  governanceConfidence: number;
  trend: string;
  dataMode: string;
};

const readinessInterpretations: Record<string, { title: string; signal: string; interpretation: string }> = {
  ingestion: {
    title: 'Data Readiness',
    signal: 'Executive operating signal',
    interpretation:
      'Most core facility, device, vendor, monitoring, and readiness signals are normalized into a usable program view.',
  },
  profiling: {
    title: 'Facility Risk Profile Completeness',
    signal: 'Risk profile confidence',
    interpretation:
      'Facility profiles are usable for executive review, but remaining gaps may affect risk scoring confidence.',
  },
  governance: {
    title: 'Governance & Evidence Confidence',
    signal: 'Leadership evidence quality',
    interpretation:
      'Evidence quality is strong enough for leadership dashboarding, audit review, and remediation governance.',
  },
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
  const executiveMetrics = buildExecutiveMetrics(dashboardMetrics);

  return (
    <>
      <HeroSummary metrics={executiveMetrics} />
      <LeadershipAttentionRequired metrics={executiveMetrics} onCapabilitySelect={onCapabilitySelect} />
      <ExecutiveKpiRow metrics={executiveMetrics} onCapabilitySelect={onCapabilitySelect} />

      <section className="dashboard-grid executive-risk-grid" aria-label="Executive risk drivers and facility heat map">
        <TopDriversOfWatchPosture metrics={executiveMetrics} />
        <FacilityRiskHeatMap facilities={dashboardMetrics.topRiskFacilities} onSelectFacility={onFacilitySelect} />
      </section>

      <section className="progress-grid" aria-label="Operational Readiness">
        {pillars.map((pillar) => (
          <ProgressCard pillar={pillar} key={pillar.id} />
        ))}
      </section>

      <section className="dashboard-grid" aria-label="Recent exceptions and supporting operational detail">
        <RecentExceptionsActivity metrics={dashboardMetrics} />
        <ReadinessDistribution metrics={dashboardMetrics} />
        <DataConfidencePanel metrics={executiveMetrics} />
        <SelectedServiceCard activeCapability={activeCapability} serviceMetrics={serviceMetrics} />
        <ServiceAreaBuildout activeCapabilityId={activeCapability.id} onSelectCapability={onCapabilitySelect} />
      </section>

      <ScopeContextChip sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      <CommandCenterGuidancePanel onChangeScope={onChangeScopeRequest} />
      <AdditionalProgramMetrics metrics={dashboardMetrics} />
    </>
  );
}

function HeroSummary({ metrics }: { metrics: CommandCenterExecutiveMetrics }) {
  const statusCluster = [
    { label: 'Current Posture', value: metrics.posture },
    { label: 'Trend', value: metrics.trend },
    { label: 'Executive Attention Required', value: metrics.criticalExceptions > 0 ? 'Yes' : 'No' },
    { label: 'Highest Risk Domain', value: 'Remediation / Technical Controls' },
    { label: 'ELM Locations', value: formatNumber(metrics.elmLocationCount) },
    { label: 'Geocoded Facilities', value: formatNumber(metrics.geocodedFacilities) },
    { label: 'Data Mode', value: metrics.dataMode },
  ];

  return (
    <header className="dashboard-header executive-dashboard-header">
      <div className="executive-hero-copy">
        <p className="eyebrow">Command Center dashboard</p>
        <h1>Facility Protection Command Center</h1>
        <p className="posture-summary">
          Current Posture: <strong>{metrics.posture}</strong>
        </p>
        <p>
          {formatNumber(metrics.facilitiesProfiled)} facilities monitored | {formatNumber(metrics.elmLocationCount)} ELM locations |{' '}
          {formatNumber(metrics.geocodedFacilities)} geocoded | {formatNumber(metrics.activeWorkQueue)} active work items
        </p>
        <p className="executive-summary-copy">
          <strong>Executive Summary:</strong> FPI now includes the national ELM location inventory for location-aware facility
          protection planning. Current exposure remains driven by active remediation items, technical control issues,
          life-safety/device health signals, and {formatNumber(metrics.elmMediumPriority + metrics.elmHighPriority)} ELM
          location pins marked for review.
        </p>
      </div>
      <aside className="hero-status-cluster" aria-label="Executive situation status">
        {statusCluster.map((item) => (
          <div className="status-cluster-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </aside>
    </header>
  );
}


function LeadershipAttentionRequired({
  metrics,
  onCapabilitySelect,
}: {
  metrics: CommandCenterExecutiveMetrics;
  onCapabilitySelect: (capabilityId: string) => void;
}) {
  const leadershipAttentionItems = [
    {
      priority: 'P1',
      issue: `${formatNumber(metrics.criticalExceptions)} active critical exceptions`,
      businessImpact: 'Unresolved exposure across the facility portfolio',
      owner: 'Security Operations',
      action: 'Review Critical Exceptions',
      targetCapabilityId: 'remediation-orchestration',
    },
    {
      priority: 'P1',
      issue: `${formatNumber(metrics.activeWorkQueue)} active work queue items`,
      businessImpact: 'Remediation backlog may create SLA and governance pressure',
      owner: 'Program Owner',
      action: 'Open Work Queue',
      targetCapabilityId: 'remediation-orchestration',
    },
    {
      priority: 'P2',
      issue: `${formatNumber(metrics.panelTrouble)} panel trouble`,
      businessImpact: 'Device health issue may affect monitoring reliability',
      owner: 'Technical Controls',
      action: 'Investigate Panel Trouble',
      targetCapabilityId: 'fire-system-monitoring',
    },
    {
      priority: 'P2',
      issue: `${formatNumber(metrics.activeSignals)} active alarm signals`,
      businessImpact: 'Requires signal validation and false-alarm review',
      owner: 'Command Center',
      action: 'Review Signals',
      targetCapabilityId: 'fire-system-monitoring',
    },
  ];

  return (
    <section className="panel leadership-attention-panel" aria-labelledby="leadership-attention-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Executive decisions</p>
          <h2 id="leadership-attention-title">Leadership Attention Required</h2>
        </div>
        <StatusPill label="ACTION" tone="watch" />
      </div>
      <div className="leadership-attention-grid">
        {leadershipAttentionItems.map((item) => (
          <article className="leadership-attention-item" key={`${item.priority}-${item.action}`}>
            <div className="leadership-attention-headline">
              <StatusPill label={item.priority} tone={item.priority === 'P1' ? 'critical' : 'watch'} />
              <strong>{item.issue}</strong>
            </div>
            <p>{item.businessImpact}</p>
            <div className="leadership-attention-meta">
              <span>Owner</span>
              <strong>{item.owner}</strong>
            </div>
            <button type="button" onClick={() => onCapabilitySelect(item.targetCapabilityId)}>
              {item.action}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExecutiveKpiRow({
  metrics,
  onCapabilitySelect,
}: {
  metrics: CommandCenterExecutiveMetrics;
  onCapabilitySelect: (capabilityId: string) => void;
}) {
  const executiveKpis = [
    {
      title: 'Protection Posture',
      value: metrics.posture,
      trend: metrics.trend,
      interpretation: 'Active exceptions require continued governance review.',
      action: 'Review Risk Drivers',
      targetCapabilityId: 'command-center',
    },
    {
      title: 'Critical Exposure',
      value: `${formatNumber(metrics.criticalExceptions)} Critical Exceptions`,
      trend: 'Needs Review',
      interpretation: 'Critical/P1 records remain active across the portfolio.',
      action: 'Review Critical Exceptions',
      targetCapabilityId: 'remediation-orchestration',
    },
    {
      title: 'Action Backlog',
      value: `${formatNumber(metrics.activeWorkQueue)} Active Work Items`,
      trend: 'Under Governance',
      interpretation: 'Active remediation queue requires ownership and SLA tracking.',
      action: 'Open Work Queue',
      targetCapabilityId: 'remediation-orchestration',
    },
    {
      title: 'System Health',
      value: `${formatNumber(metrics.panelTrouble)} Panel Trouble / ${formatNumber(metrics.activeSignals)} Active Signals`,
      trend: 'Monitor',
      interpretation: 'Device and signal health require technical validation.',
      action: 'Review Device Health',
      targetCapabilityId: 'fire-system-monitoring',
    },
  ];

  return (
    <section className="executive-kpi-grid" aria-label="Executive KPI row">
      {executiveKpis.map((kpi) => (
        <article className="executive-kpi-tile" key={kpi.title}>
          <div className="kpi-topline">
            <span>{kpi.title}</span>
            <StatusPill label={kpi.trend} tone={kpi.trend === 'Needs Review' ? 'watch' : 'stable'} />
          </div>
          <strong>{kpi.value}</strong>
          <p>{kpi.interpretation}</p>
          <button type="button" onClick={() => onCapabilitySelect(kpi.targetCapabilityId)}>
            {kpi.action}
          </button>
        </article>
      ))}
    </section>
  );
}

function CommandCenterGuidancePanel({ onChangeScope }: { onChangeScope: () => void }) {
  const operatingSteps = [
    {
      step: '1',
      title: 'Confirm scope',
      detail: 'Validate the store or region scope before making leadership decisions.',
    },
    {
      step: '2',
      title: 'Review posture',
      detail: 'Use the WATCH posture, KPI row, and risk drivers to understand exposure.',
    },
    {
      step: '3',
      title: 'Assign action',
      detail: 'Open the attention items and route work to the accountable service owner.',
    },
    {
      step: '4',
      title: 'Track movement',
      detail: 'Revisit exceptions, work queue, and facility risk until risk moves down.',
    },
  ];

  return (
    <section className="panel command-guidance-panel" aria-labelledby="command-guidance-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">How to use this dashboard</p>
          <h2 id="command-guidance-title">Executive operating rhythm</h2>
        </div>
        <StatusPill label="GUIDED VIEW" tone="stable" />
      </div>
      <div className="command-guidance-grid">
        {operatingSteps.map((item) => (
          <article key={item.step}>
            <span>{item.step}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="command-guidance-actions" aria-label="Executive dashboard actions">
        <button type="button" onClick={onChangeScope}>Change Scope</button>
        <button type="button" disabled>Generate Executive Brief — Coming Soon</button>
        <button type="button" disabled>Export Dashboard — Coming Soon</button>
      </div>
    </section>
  );
}

function DataConfidencePanel({ metrics }: { metrics: CommandCenterExecutiveMetrics }) {
  const confidenceItems = [
    { label: 'Data Mode', value: metrics.dataMode },
    { label: 'Facilities Profiled', value: formatNumber(metrics.facilitiesProfiled) },
    { label: 'Data Readiness', value: `${metrics.dataReadiness}%` },
    { label: 'Facility Risk Profile Completeness', value: `${metrics.profileCompleteness}%` },
    { label: 'Governance & Evidence Confidence', value: `${metrics.governanceConfidence}%` },
  ];

  return (
    <section className="panel data-confidence-panel" aria-labelledby="data-confidence-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Trust layer</p>
          <h2 id="data-confidence-title">Data Confidence & Coverage</h2>
        </div>
        <StatusPill label="ELM ENRICHED" tone="ready" />
      </div>
      <p>
        This dashboard is safe for leadership review as a synthetic operating picture. Confidence is strongest where
        normalized signals, facility profiles, and evidence records are available in the current scope.
      </p>
      <div className="data-confidence-grid">
        {confidenceItems.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopDriversOfWatchPosture({ metrics }: { metrics: CommandCenterExecutiveMetrics }) {
  const profileCompletenessGap = 100 - metrics.profileCompleteness;
  const riskDrivers = [
    {
      rank: 1,
      driver: 'Critical active records',
      count: formatNumber(metrics.criticalExceptions),
      why: 'Indicates unresolved high-priority exposure',
    },
    {
      rank: 2,
      driver: 'Active remediation queue',
      count: formatNumber(metrics.activeWorkQueue),
      why: 'Shows governance workload and possible SLA pressure',
    },
    {
      rank: 3,
      driver: 'Panel trouble',
      count: formatNumber(metrics.panelTrouble),
      why: 'May affect monitoring reliability',
    },
    {
      rank: 4,
      driver: 'Active alarm signals',
      count: formatNumber(metrics.activeSignals),
      why: 'Requires triage and validation',
    },
    {
      rank: 5,
      driver: 'Profile completeness gap',
      count: `${profileCompletenessGap}% incomplete`,
      why: 'Limits confidence in risk scoring',
    },
  ];

  return (
    <section className="panel risk-drivers-panel" aria-labelledby="risk-drivers-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Posture rationale</p>
          <h2 id="risk-drivers-title">Top Drivers of Current WATCH Posture</h2>
        </div>
        <StatusPill label={metrics.posture} tone="watch" />
      </div>
      <div className="risk-driver-list">
        {riskDrivers.map((driver) => (
          <article className="risk-driver-item" key={driver.rank}>
            <span className="risk-driver-rank">{driver.rank}</span>
            <div>
              <strong>{driver.driver}</strong>
              <p>{driver.why}</p>
            </div>
            <span className="risk-driver-count">{driver.count}</span>
          </article>
        ))}
      </div>
    </section>
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
  const executiveReadiness = readinessInterpretations[pillar.id];
  const title = executiveReadiness?.title ?? pillar.title;
  const signal = executiveReadiness?.signal ?? pillar.signal;
  const interpretation = executiveReadiness?.interpretation ?? pillar.description;

  return (
    <article className="progress-card">
      <div className="card-heading compact-heading">
        <div>
          <p className="eyebrow">{signal}</p>
          <h2>{title}</h2>
        </div>
        <strong>{pillar.progress}%</strong>
      </div>
      <p>{interpretation}</p>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pillar.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title}: ${pillar.progress}% complete`}
      >
        <span style={{ width: `${pillar.progress}%` }} />
      </div>
    </article>
  );
}

function AdditionalProgramMetrics({ metrics }: { metrics: FpiDashboardMetrics }) {
  return (
    <details className="panel dashboard-more-metrics">
      <summary>
        <span>Additional program metrics</span>
        <strong>Open supporting dashboard data</strong>
      </summary>
      <ExecutiveStatusStrip metrics={metrics} />
      <section className="kpi-grid" aria-label="Supporting FPI indicators">
        {metrics.kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>
    </details>
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

function RecentExceptionsActivity({ metrics }: { metrics: FpiDashboardMetrics }) {
  const activityCategories = [
    {
      title: 'Recent High-Severity Signals',
      status: metrics.activeSignals > 0 ? `${formatNumber(metrics.activeSignals)} active signals` : 'No active signals',
      detail: metrics.latestSignals[0] ?? 'No recent high-severity signals available in the current scope.',
      tone: metrics.activeSignals > 0 ? 'watch' : 'ready',
    },
    {
      title: 'Open Critical Exceptions',
      status: `${formatNumber(metrics.criticalExceptions)} active`,
      detail: 'Critical exception records remain visible for leadership review and remediation governance.',
      tone: metrics.criticalExceptions > 0 ? 'critical' : 'ready',
    },
    {
      title: 'Recently Updated Work Items',
      status: `${formatNumber(metrics.activeWorkQueue)} in queue`,
      detail: metrics.latestSignals[1] ?? 'No recently updated work items available in the current synthetic data scope.',
      tone: metrics.activeWorkQueue > 0 ? 'watch' : 'ready',
    },
    {
      title: 'Panel / Device Health Events',
      status: `${formatNumber(metrics.panelTrouble)} panel trouble`,
      detail: metrics.latestSignals[2] ?? 'No linked device health events found for the current scope.',
      tone: metrics.panelTrouble > 0 ? 'watch' : 'ready',
    },
  ] as const;

  return (
    <section className="panel activity-panel" aria-labelledby="activity-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Operating cadence</p>
          <h2 id="activity-title">Recent Exceptions & Activity</h2>
        </div>
      </div>
      <div className="activity-category-grid">
        {activityCategories.map((item) => (
          <article key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <StatusPill label={item.status} tone={item.tone} />
            </div>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
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

function FacilityRiskHeatMap({ facilities, onSelectFacility }: { facilities: FpiTopRiskFacility[]; onSelectFacility: (facilityId: string) => void }) {
  return (
    <section className="panel top-risk-panel facility-risk-heatmap-panel" aria-labelledby="facility-risk-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Facility posture</p>
          <h2 id="facility-risk-title">Facility Risk Heat Map</h2>
        </div>
        <StatusPill label="SYNTHETIC DATA" tone="watch" />
      </div>
      <div className="facility-risk-table" role="table" aria-label="Ranked facility risk table">
        <div className="facility-risk-row facility-risk-header" role="row">
          <span role="columnheader">Facility</span>
          <span role="columnheader">Risk Tier</span>
          <span role="columnheader">Critical Exceptions</span>
          <span role="columnheader">Work Items</span>
          <span role="columnheader">Life Safety</span>
          <span role="columnheader">Tech Health</span>
          <span role="columnheader">Primary Concern</span>
          <span role="columnheader">Action</span>
        </div>
        {facilities.map((facility) => (
          <div className="facility-risk-row" role="row" key={facility.facilityId}>
            <div role="cell" className="facility-risk-name">
              <strong>{facility.facilityName}</strong>
              <small>{facility.region} • {facility.market}</small>
            </div>
            <div role="cell"><StatusPill label={facility.riskTier.toUpperCase()} tone={riskTierTone(facility.riskTier)} /></div>
            <span role="cell">{facility.criticalExceptions}</span>
            <span role="cell">{facility.openWorkItems}</span>
            <span role="cell">{lifeSafetyStatus(facility)}</span>
            <span role="cell">{technicalHealthStatus(facility)}</span>
            <span role="cell" className="facility-risk-concern">{facility.primaryIssueType}</span>
            <div role="cell">
              <button type="button" onClick={() => onSelectFacility(facility.facilityId)} aria-label={`Review ${facility.facilityName}`}>
                Review
              </button>
            </div>
          </div>
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

function lifeSafetyStatus(facility: FpiTopRiskFacility): string {
  if (facility.panelTrouble > 0) return 'Trouble';
  if (facility.activeSignals > 0) return 'Watch';
  return 'Stable';
}

function technicalHealthStatus(facility: FpiTopRiskFacility): string {
  const issue = facility.primaryIssueType.toLowerCase();
  if (facility.panelTrouble > 0 || issue.includes('camera') || issue.includes('device') || issue.includes('technical')) return 'Watch';
  if (facility.criticalExceptions > 0) return 'Needs Review';
  return 'Stable';
}

function statusToneForCapability(status: Capability['status']): StatusTone {
  if (status === 'Ready') return 'ready';
  if (status === 'Buildout') return 'buildout';
  return 'watch';
}

function buildExecutiveMetrics(metrics: FpiDashboardMetrics): CommandCenterExecutiveMetrics {
  return {
    posture: metrics.overallStatus,
    facilitiesProfiled: metrics.facilitiesProfiled,
    criticalExceptions: metrics.criticalExceptions,
    activeSignals: metrics.activeSignals,
    panelTrouble: metrics.panelTrouble,
    activeWorkQueue: metrics.activeWorkQueue,
    elmLocationCount: metrics.elmLocationCount,
    geocodedFacilities: metrics.geocodedFacilities,
    elmMediumPriority: metrics.elmMediumPriority,
    elmHighPriority: metrics.elmHighPriority,
    dataReadiness: pillars.find((pillar) => pillar.id === 'ingestion')?.progress ?? 86,
    profileCompleteness: pillars.find((pillar) => pillar.id === 'profiling')?.progress ?? 74,
    governanceConfidence: pillars.find((pillar) => pillar.id === 'governance')?.progress ?? 91,
    trend: 'Stable',
    dataMode: metrics.elmLocationCount > 0 ? 'ELM enriched' : 'Synthetic data',
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
